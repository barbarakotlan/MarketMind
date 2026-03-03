"""
Selective prediction (v1) for MarketMind.

Implements leakage-safe selector training/evaluation with abstention.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import brier_score_loss

try:
    import xgboost as xgb

    XGBOOST_AVAILABLE = True
except Exception:
    xgb = None
    XGBOOST_AVAILABLE = False

from data_fetcher import prepare_data_for_ml, fetch_from_yfinance, validate_and_clean_data


SELECTIVE_SCHEMA_VERSION = "selective_v1"
SELECTIVE_MODES = {"none", "conservative", "aggressive"}
SELECTIVE_DISABLED_STATUSES = {"disabled", "disabled_conservative", "disabled_aggressive"}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ARTIFACT_ROOT = os.path.join(BASE_DIR, "model_artifacts", "selective")
DEFAULT_TAU_GRID = np.round(np.arange(0.00, 0.951, 0.01), 2)


@dataclass(frozen=True)
class SelectiveConfig:
    lookback: int = 30
    horizon: int = 1
    min_history: int = 120
    retrain_frequency: int = 5
    vol_window: int = 20
    magnitude_k: float = 0.5
    pred_deadband: float = 0.0
    one_way_cost_bps: float = 10.0
    er_window: int = 20
    er_chop_threshold: float = 0.30
    er_trend_threshold: float = 0.50
    sparse_bucket_min_fraction: float = 0.10
    conservative_min_coverage: float = 0.85
    aggressive_min_coverage: float = 0.55
    conservative_target_coverage: float = 0.90
    aggressive_target_coverage: float = 0.65
    min_trades: int = 40
    embargo_extra: int = 1
    eps: float = 1e-8
    seed: int = 42
    artifact_ttl_days: int = 7
    threshold_sharpe_tolerance: float = 0.02
    validation_require_improvement: bool = True
    validation_max_sharpe_drop: float = 0.25
    validation_max_drawdown_drop: float = 0.02
    validation_guard_fraction: float = 0.30
    validation_guard_min_rows: int = 40
    calibration_min_samples_for_isotonic: int = 1000
    calibration_min_positives_for_isotonic: int = 200
    calibration_fraction: float = 0.35

    @property
    def embargo(self) -> int:
        return int(self.lookback + self.horizon + self.embargo_extra)


def sign_with_eps(value, eps: float = 1e-8):
    if isinstance(value, (pd.Series, np.ndarray, list, tuple)):
        arr = np.asarray(value, dtype=float)
        out = np.zeros_like(arr, dtype=int)
        out[arr > eps] = 1
        out[arr < -eps] = -1
        if isinstance(value, pd.Series):
            return pd.Series(out, index=value.index)
        return out
    if value > eps:
        return 1
    if value < -eps:
        return -1
    return 0


def build_fixed_features(df: pd.DataFrame, lookback: int = 30) -> Tuple[pd.DataFrame, List[str]]:
    frame = df.copy()
    features: List[str] = []

    for i in range(1, lookback + 1):
        name = f"lag_{i}"
        frame[name] = frame["Close"].shift(i)
        features.append(name)

    for window in [5, 10, 20, 30]:
        name = f"ma_{window}"
        frame[name] = frame["Close"].rolling(window=window, min_periods=1).mean()
        features.append(name)

    for window in [5, 10, 20]:
        name = f"std_{window}"
        frame[name] = frame["Close"].rolling(window=window, min_periods=1).std()
        features.append(name)

    for window in [1, 5, 20]:
        name = f"ret_{window}"
        frame[name] = frame["Close"].pct_change(periods=window)
        features.append(name)

    for window in [5, 20]:
        name = f"volume_ratio_{window}"
        avg_volume = frame["Volume"].rolling(window=window, min_periods=1).mean()
        frame[name] = frame["Volume"] / avg_volume
        features.append(name)

    frame["trend_slope_5"] = frame["Close"].pct_change().rolling(5, min_periods=1).mean()
    frame["trend_slope_10"] = frame["Close"].pct_change().rolling(10, min_periods=1).mean()
    frame["open_close_gap"] = (frame["Open"] - frame["Close"].shift(1)) / frame["Close"].shift(1)
    frame["hl_spread"] = (frame["High"] - frame["Low"]) / frame["Close"].replace(0, np.nan)
    features.extend(["trend_slope_5", "trend_slope_10", "open_close_gap", "hl_spread"])

    frame[features] = (
        frame[features]
        .replace([np.inf, -np.inf], np.nan)
        .ffill()
        .bfill()
        .fillna(0.0)
    )
    return frame, features


def compute_open_to_open_target(df: pd.DataFrame, horizon: int = 1) -> pd.Series:
    # Decision at t close, fill at t+1 open, evaluate through t+1+H open.
    # H=1 => y[t]=(open[t+2]/open[t+1])-1
    base = df["Open"].shift(-1)
    future = df["Open"].shift(-(1 + horizon))
    target = (future / base) - 1.0
    target.name = "target_return"
    return target


def latest_available_settled_date(df: pd.DataFrame, horizon: int = 1):
    target = compute_open_to_open_target(df, horizon=horizon)
    valid = target.dropna()
    if valid.empty:
        return None
    return valid.index[-1]


def sample_windows(i: int, lookback: int, horizon: int) -> Dict[str, Tuple[int, int]]:
    return {
        "feature": (i - lookback + 1, i),
        "label": (i + 1, i + horizon),
    }


def _intervals_intersect(a: Tuple[int, int], b: Tuple[int, int]) -> bool:
    return max(a[0], b[0]) <= min(a[1], b[1])


def has_window_intersection(train_i: int, test_i: int, lookback: int, horizon: int) -> bool:
    train = sample_windows(train_i, lookback, horizon)
    test = sample_windows(test_i, lookback, horizon)
    train_intervals = [train["feature"], train["label"]]
    test_intervals = [test["feature"], test["label"]]
    for left in train_intervals:
        for right in test_intervals:
            if _intervals_intersect(left, right):
                return True
    return False


def purged_train_indices(
    candidate_indices: Iterable[int],
    test_start: int,
    lookback: int,
    horizon: int,
    embargo: Optional[int] = None,
) -> List[int]:
    effective_embargo = int(embargo if embargo is not None else (lookback + horizon + 1))
    cutoff = test_start - effective_embargo
    return [idx for idx in candidate_indices if idx <= cutoff]


def compute_efficiency_ratio(close: pd.Series, window: int = 20) -> pd.Series:
    net = (close - close.shift(window)).abs()
    noise = close.diff().abs().rolling(window=window, min_periods=window).sum()
    er = net / noise.replace(0, np.nan)
    return er.clip(lower=0.0, upper=1.0)


def bucketize_regime(
    er: pd.Series,
    chop_threshold: float = 0.30,
    trend_threshold: float = 0.50,
) -> pd.Series:
    bucket = pd.Series("unknown", index=er.index, dtype="object")
    bucket[(er >= 0.0) & (er < chop_threshold)] = "chop"
    bucket[(er >= chop_threshold) & (er < trend_threshold)] = "neutral"
    bucket[er >= trend_threshold] = "trend"
    return bucket


def apply_regime_sparsity(
    regimes: pd.Series,
    sparse_min_fraction: float = 0.10,
) -> Tuple[pd.Series, Dict[str, Dict[str, float]]]:
    counts = regimes.value_counts(dropna=False)
    total = float(max(len(regimes), 1))
    distribution: Dict[str, Dict[str, float]] = {}
    mapped = regimes.copy()
    for bucket in ["chop", "neutral", "trend", "unknown"]:
        fraction = float(counts.get(bucket, 0.0) / total)
        sparse = fraction > 0 and fraction < sparse_min_fraction
        distribution[bucket] = {
            "count": int(counts.get(bucket, 0)),
            "fraction": round(fraction, 6),
            "is_sparse": sparse,
        }
        if sparse and bucket != "unknown":
            mapped[mapped == bucket] = "unknown"
    return mapped, distribution


def _train_base_models(X_train: np.ndarray, y_train: np.ndarray, seed: int = 42):
    models = {}
    rf = RandomForestRegressor(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=3,
        random_state=seed,
        n_jobs=1,
    )
    rf.fit(X_train, y_train)
    models["random_forest"] = rf

    lr = LinearRegression()
    lr.fit(X_train, y_train)
    models["linear_regression"] = lr

    if XGBOOST_AVAILABLE:
        xgb_model = xgb.XGBRegressor(
            n_estimators=250,
            max_depth=4,
            learning_rate=0.05,
            subsample=1.0,
            colsample_bytree=1.0,
            reg_lambda=1.0,
            objective="reg:squarederror",
            random_state=seed,
            n_jobs=1,
            tree_method="hist",
        )
        xgb_model.fit(X_train, y_train)
        models["xgboost"] = xgb_model
    return models


def generate_purged_oof_predictions(
    frame: pd.DataFrame,
    feature_columns: List[str],
    target_column: str,
    config: SelectiveConfig,
) -> pd.DataFrame:
    rows = []
    model_cache = None
    last_retrain_i = None
    n = len(frame)
    candidate_indices = list(range(n))

    for i in range(n):
        train_idx = purged_train_indices(
            candidate_indices=candidate_indices,
            test_start=i,
            lookback=config.lookback,
            horizon=config.horizon,
            embargo=config.embargo,
        )
        if len(train_idx) < config.min_history:
            continue
        train = frame.iloc[train_idx]
        train = train.dropna(subset=feature_columns + [target_column])
        if len(train) < config.min_history:
            continue

        if (
            model_cache is None
            or last_retrain_i is None
            or (i - last_retrain_i) >= max(1, config.retrain_frequency)
        ):
            model_cache = _train_base_models(
                train[feature_columns].values,
                train[target_column].values,
                seed=config.seed,
            )
            last_retrain_i = i

        row = frame.iloc[i]
        if row[feature_columns].isna().any():
            continue

        x_row = row[feature_columns].values.reshape(1, -1)
        preds = {name: float(model.predict(x_row)[0]) for name, model in model_cache.items()}
        pred_vals = np.array(list(preds.values()), dtype=float)
        ensemble_pred = float(np.mean(pred_vals))
        disagreement = float(np.std(pred_vals)) if len(pred_vals) > 1 else 0.0

        entry = {
            "row_index": i,
            "date": frame.index[i],
            "raw_signal": ensemble_pred,
            "ensemble_disagreement": disagreement,
            target_column: float(row[target_column]) if pd.notna(row[target_column]) else np.nan,
        }
        if "regime_bucket" in frame.columns:
            entry["regime_bucket"] = row["regime_bucket"]
        if "regime_er" in frame.columns:
            entry["regime_er"] = float(row["regime_er"]) if pd.notna(row["regime_er"]) else 0.0
        for name, value in preds.items():
            entry[f"pred_{name}"] = value
        for col in feature_columns:
            entry[col] = float(row[col])
        rows.append(entry)

    if not rows:
        return pd.DataFrame()

    oof = pd.DataFrame(rows).set_index("date").sort_index()
    return oof


def construct_selector_labels(
    yhat_oof: pd.Series,
    y_true: pd.Series,
    vol_window: int = 20,
    magnitude_k: float = 0.5,
    eps: float = 1e-8,
    min_history: int = 120,
) -> Tuple[pd.DataFrame, Dict[str, int]]:
    aligned = pd.concat([yhat_oof.rename("yhat"), y_true.rename("y")], axis=1).dropna()
    if aligned.empty:
        return pd.DataFrame(columns=["yhat", "y", "vol_y", "correct", "signal", "valid_label", "informative"]), {
            "total": 0,
            "valid": 0,
            "invalid": 0,
            "informative": 0,
        }

    aligned["vol_y"] = aligned["y"].rolling(window=vol_window, min_periods=vol_window).std().shift(1)
    pred_sign = sign_with_eps(aligned["yhat"], eps=eps)
    true_sign = sign_with_eps(aligned["y"], eps=eps)

    aligned["correct"] = pred_sign == true_sign
    aligned["signal"] = aligned["y"].abs() > (magnitude_k * aligned["vol_y"])
    hist_ok = pd.Series(np.arange(len(aligned)) >= min_history, index=aligned.index)
    aligned["valid_label"] = (
        (pred_sign != 0)
        & aligned["vol_y"].notna()
        & (aligned["vol_y"] >= eps)
        & hist_ok
    )
    aligned["informative"] = (aligned["correct"] & aligned["signal"] & aligned["valid_label"]).astype(int)

    counts = {
        "total": int(len(aligned)),
        "valid": int(aligned["valid_label"].sum()),
        "invalid": int((~aligned["valid_label"]).sum()),
        "informative": int(aligned["informative"].sum()),
    }
    return aligned, counts


def split_contiguous(df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    n = len(df)
    train_end = int(n * 0.60)
    val_end = int(n * 0.80)
    return {
        "train": df.iloc[:train_end].copy(),
        "validation": df.iloc[train_end:val_end].copy(),
        "test": df.iloc[val_end:].copy(),
    }


def _train_selector_classifier(X: np.ndarray, y: np.ndarray, seed: int = 42):
    y = np.asarray(y, dtype=int)
    positives = int(np.sum(y))
    negatives = int(len(y) - positives)
    scale_pos_weight = float(negatives / max(positives, 1)) if positives > 0 else 1.0
    scale_pos_weight = float(np.clip(scale_pos_weight, 0.5, 10.0))

    if XGBOOST_AVAILABLE:
        clf = xgb.XGBClassifier(
            n_estimators=250,
            max_depth=4,
            learning_rate=0.05,
            subsample=1.0,
            colsample_bytree=1.0,
            reg_lambda=1.0,
            objective="binary:logistic",
            eval_metric="logloss",
            scale_pos_weight=scale_pos_weight,
            random_state=seed,
            n_jobs=1,
            tree_method="hist",
        )
    else:
        clf = RandomForestClassifier(
            n_estimators=300,
            max_depth=8,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=seed,
            n_jobs=1,
        )
    clf.fit(X, y)
    return clf


def calibrate_selector_model(
    selector_model,
    X_cal: np.ndarray,
    y_cal: np.ndarray,
    min_samples_for_isotonic: int = 1000,
    min_positives_for_isotonic: int = 200,
):
    if len(y_cal) == 0 or len(np.unique(y_cal)) < 2:
        return None, "none"
    positives = int(np.sum(y_cal))
    method = "isotonic" if (len(y_cal) >= min_samples_for_isotonic and positives >= min_positives_for_isotonic) else "sigmoid"
    calibrator = CalibratedClassifierCV(selector_model, method=method, cv="prefit")
    calibrator.fit(X_cal, y_cal)
    return calibrator, method


def _predict_selector_prob(selector_model, calibrator, X: np.ndarray) -> np.ndarray:
    if calibrator is not None:
        probs = calibrator.predict_proba(X)[:, 1]
    else:
        probs = selector_model.predict_proba(X)[:, 1]
    return np.clip(np.asarray(probs, dtype=float), 0.0, 1.0)


def _signal_from_raw(raw_signal: float, pred_deadband: float, eps: float) -> int:
    if abs(raw_signal) < pred_deadband:
        return 0
    return int(sign_with_eps(raw_signal, eps=eps))


def _compute_sharpe(daily_returns: np.ndarray) -> float:
    if len(daily_returns) == 0:
        return 0.0
    std = float(np.std(daily_returns))
    if std <= 0:
        return 0.0
    return float((np.mean(daily_returns) / std) * np.sqrt(252))


def _compute_max_drawdown(equity_curve: np.ndarray) -> float:
    if len(equity_curve) == 0:
        return 0.0
    running_max = np.maximum.accumulate(equity_curve)
    drawdowns = (equity_curve / running_max) - 1.0
    return float(np.min(drawdowns))


def simulate_abstention_scenario(
    df: pd.DataFrame,
    tau: float,
    mode: str,
    pred_deadband: float,
    one_way_cost_bps: float,
    eps: float = 1e-8,
) -> Dict[str, object]:
    if df.empty:
        return {
            "mode": mode,
            "status": "disabled",
            "tau": tau,
            "coverage_pred": 0.0,
            "coverage_trade": 0.0,
            "executed_trades": 0,
            "sharpe": 0.0,
            "max_drawdown": 0.0,
            "win_rate": 0.0,
            "trade_frequency": 0.0,
            "avg_return": 0.0,
            "frame": df.copy(),
        }

    cost = one_way_cost_bps / 10000.0
    equity = 1.0
    records = []

    for idx, row in df.iterrows():
        prob = float(row["selector_prob"])
        raw_signal = float(row["raw_signal"])
        y = float(row["target_return"])
        if mode == "none":
            abstain = False
        else:
            abstain = prob < tau

        # Open-to-open target is one-step horizon, so each row is an independent trade decision.
        # Non-zero signals open at t+1 open and close at t+1+H open (2 one-way legs).
        pos_target = 0 if abstain else _signal_from_raw(raw_signal, pred_deadband, eps)
        entry_event = 1 if pos_target != 0 else 0
        legs = 2 if pos_target != 0 else 0

        net_return = (pos_target * y) - (legs * cost)
        equity *= (1.0 + net_return)
        hit = 1 if (pos_target != 0 and sign_with_eps(y, eps=eps) == pos_target) else 0

        records.append(
            {
                "date": idx,
                "selector_prob": prob,
                "target_return": y,
                "raw_signal": raw_signal,
                "abstain": abstain,
                "pos_target": pos_target,
                "entry_event": entry_event,
                "net_return": net_return,
                "equity": equity,
                "hit": hit,
                "regime_bucket": row.get("regime_bucket", "unknown"),
            }
        )

    scenario = pd.DataFrame(records).set_index("date")
    active = scenario["pos_target"] != 0
    coverage_pred = float((~scenario["abstain"]).mean())
    coverage_trade = float(scenario["entry_event"].sum() / len(scenario))
    executed_trades = int(scenario["entry_event"].sum())
    win_rate = float(scenario.loc[active, "hit"].mean()) if active.any() else 0.0

    return {
        "mode": mode,
        "status": "ok",
        "tau": None if mode == "none" else float(tau),
        "coverage_pred": coverage_pred,
        "coverage_trade": coverage_trade,
        "executed_trades": executed_trades,
        "sharpe": _compute_sharpe(scenario["net_return"].values),
        "max_drawdown": _compute_max_drawdown(scenario["equity"].values),
        "win_rate": win_rate,
        "trade_frequency": float(executed_trades / len(scenario)),
        "avg_return": float(scenario["net_return"].mean()),
        "frame": scenario,
    }


def optimize_threshold_for_mode(
    validation_df: pd.DataFrame,
    mode: str,
    min_coverage: float,
    min_trades: int,
    pred_deadband: float,
    one_way_cost_bps: float,
    target_coverage: Optional[float] = None,
    sharpe_tolerance: float = 0.02,
    baseline_scenario: Optional[Dict[str, object]] = None,
    require_improvement: bool = False,
    max_sharpe_drop: float = 0.25,
    max_drawdown_drop: float = 0.02,
    eps: float = 1e-8,
) -> Dict[str, object]:
    def _disabled() -> Dict[str, object]:
        return {
            "status": f"disabled_{mode}",
            "tau": None,
            "coverage_pred": 0.0,
            "coverage_trade": 0.0,
            "executed_trades": 0,
            "sharpe": 0.0,
            "max_drawdown": 0.0,
            "win_rate": 0.0,
        }

    feasible: List[Dict[str, object]] = []
    for tau in DEFAULT_TAU_GRID:
        scenario = simulate_abstention_scenario(
            validation_df,
            tau=float(tau),
            mode=mode,
            pred_deadband=pred_deadband,
            one_way_cost_bps=one_way_cost_bps,
            eps=eps,
        )
        if scenario["coverage_pred"] < min_coverage:
            continue
        if scenario["executed_trades"] < min_trades:
            continue
        feasible.append(scenario)

    if not feasible:
        return _disabled()

    candidate_pool = feasible
    if baseline_scenario is not None:
        baseline_sharpe = float(baseline_scenario.get("sharpe", 0.0))
        baseline_maxdd = float(baseline_scenario.get("max_drawdown", 0.0))
        candidate_pool = [
            s
            for s in candidate_pool
            if float(s["sharpe"]) >= (baseline_sharpe - max_sharpe_drop)
            and float(s["max_drawdown"]) >= (baseline_maxdd - max_drawdown_drop)
        ]
        if require_improvement:
            candidate_pool = [
                s
                for s in candidate_pool
                if float(s["sharpe"]) > baseline_sharpe or float(s["max_drawdown"]) > baseline_maxdd
            ]

    if not candidate_pool:
        return _disabled()

    best_sharpe = max(float(s["sharpe"]) for s in candidate_pool)
    tolerance = max(float(sharpe_tolerance), 0.0)
    top = [s for s in candidate_pool if float(s["sharpe"]) >= (best_sharpe - tolerance)]
    target = float(min_coverage if target_coverage is None else target_coverage)

    def _tie_break_key(s):
        coverage_gap = abs(float(s["coverage_pred"]) - target)
        # Higher max_drawdown is better (-0.10 better than -0.20), and higher tau means more selectivity.
        return (
            coverage_gap,
            -float(s["max_drawdown"]),
            -float(s["tau"]),
        )

    best = sorted(top, key=_tie_break_key)[0]

    return {
        "status": "ok",
        "tau": float(best["tau"]),
        "coverage_pred": float(best["coverage_pred"]),
        "coverage_trade": float(best["coverage_trade"]),
        "executed_trades": int(best["executed_trades"]),
        "sharpe": float(best["sharpe"]),
        "max_drawdown": float(best["max_drawdown"]),
        "win_rate": float(best["win_rate"]),
    }


def _passes_validation_guard(
    candidate: Dict[str, object],
    baseline: Dict[str, object],
    require_improvement: bool,
    max_sharpe_drop: float,
    max_drawdown_drop: float,
) -> bool:
    cand_sharpe = float(candidate.get("sharpe", 0.0))
    cand_maxdd = float(candidate.get("max_drawdown", 0.0))
    base_sharpe = float(baseline.get("sharpe", 0.0))
    base_maxdd = float(baseline.get("max_drawdown", 0.0))

    if cand_sharpe < (base_sharpe - max_sharpe_drop):
        return False
    if cand_maxdd < (base_maxdd - max_drawdown_drop):
        return False
    if require_improvement and not (cand_sharpe > base_sharpe or cand_maxdd > base_maxdd):
        return False
    return True


def compute_regime_metrics(scenario_frame: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    out: Dict[str, Dict[str, float]] = {}
    for bucket in ["chop", "neutral", "trend", "unknown"]:
        sub = scenario_frame[scenario_frame["regime_bucket"] == bucket]
        if sub.empty:
            out[bucket] = {
                "count": 0,
                "coverage_pred": 0.0,
                "coverage_trade": 0.0,
                "trade_count": 0,
                "avg_return": 0.0,
                "win_rate": 0.0,
                "sharpe": 0.0,
                "max_drawdown": 0.0,
            }
            continue
        active = sub["pos_target"] != 0
        out[bucket] = {
            "count": int(len(sub)),
            "coverage_pred": float((~sub["abstain"]).mean()),
            "coverage_trade": float(sub["entry_event"].sum() / len(sub)),
            "trade_count": int(sub["entry_event"].sum()),
            "avg_return": float(sub["net_return"].mean()),
            "win_rate": float(sub.loc[active, "hit"].mean()) if active.any() else 0.0,
            "sharpe": _compute_sharpe(sub["net_return"].values),
            "max_drawdown": _compute_max_drawdown(sub["equity"].values),
        }
    return out


def compute_lift_curve(test_frame: pd.DataFrame, n_bins: int = 10) -> List[Dict[str, float]]:
    if test_frame.empty:
        return []
    ranked = test_frame.dropna(subset=["selector_prob"]).copy()
    if ranked.empty:
        return []

    ranked["decile"] = pd.qcut(
        ranked["selector_prob"],
        q=min(n_bins, len(ranked)),
        labels=False,
        duplicates="drop",
    )
    total = float(len(ranked))
    lift = []
    for decile in sorted(ranked["decile"].dropna().unique()):
        sub = ranked[ranked["decile"] == decile]
        lift.append(
            {
                "decile": int(decile) + 1,
                "count": int(len(sub)),
                "coverage_pred": float(len(sub) / total),
                "net_return_mean": float(sub["net_return"].mean()),
                "hit_rate": float(sub["hit"].mean()) if len(sub) else 0.0,
                "sharpe": _compute_sharpe(sub["net_return"].values),
            }
        )
    return lift


def _selector_feature_columns(base_features: List[str]) -> List[str]:
    return base_features + [
        "raw_signal",
        "raw_signal_abs",
        "ensemble_disagreement",
        "rolling_vol_y",
        "regime_er",
        "regime_is_chop",
        "regime_is_neutral",
        "regime_is_trend",
    ]


def _build_data_signature(feature_columns: List[str], config: SelectiveConfig) -> str:
    signature_payload = {
        "schema_version": SELECTIVE_SCHEMA_VERSION,
        "feature_columns": feature_columns,
        "lookback": config.lookback,
        "horizon": config.horizon,
        "embargo": config.embargo,
        "vol_window": config.vol_window,
        "magnitude_k": config.magnitude_k,
        "retrain_frequency": config.retrain_frequency,
        "pred_deadband": config.pred_deadband,
    }
    encoded = json.dumps(signature_payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _get_backend_version() -> str:
    return os.getenv("BACKEND_VERSION") or os.getenv("GIT_COMMIT") or "unknown"


def _build_selector_feature_frame(
    frame: pd.DataFrame,
    base_features: List[str],
    config: SelectiveConfig,
) -> Tuple[pd.DataFrame, List[str]]:
    out = frame.copy()
    out["raw_signal_abs"] = out["raw_signal"].abs()
    out["rolling_vol_y"] = (
        out["target_return"]
        .rolling(window=config.vol_window, min_periods=config.vol_window)
        .std()
        .shift(1)
        .ffill()
        .fillna(0.0)
    )
    out["regime_is_chop"] = (out["regime_bucket"] == "chop").astype(int)
    out["regime_is_neutral"] = (out["regime_bucket"] == "neutral").astype(int)
    out["regime_is_trend"] = (out["regime_bucket"] == "trend").astype(int)
    cols = _selector_feature_columns(base_features)
    return out, cols


def _artifact_paths(root: str, ticker: str) -> Tuple[str, str, str]:
    ticker_dir = os.path.join(root, ticker.upper())
    return ticker_dir, os.path.join(ticker_dir, "model.joblib"), os.path.join(ticker_dir, "metadata.json")


def _save_artifact(
    ticker: str,
    root: str,
    payload: Dict[str, object],
    metadata: Dict[str, object],
) -> None:
    ticker_dir, model_path, meta_path = _artifact_paths(root, ticker)
    os.makedirs(ticker_dir, exist_ok=True)
    joblib.dump(payload, model_path)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def _load_artifact(
    ticker: str,
    root: str,
) -> Tuple[Optional[Dict[str, object]], Optional[Dict[str, object]]]:
    _, model_path, meta_path = _artifact_paths(root, ticker)
    if not os.path.exists(model_path) or not os.path.exists(meta_path):
        return None, None
    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    payload = joblib.load(model_path)
    return payload, metadata


def _validate_artifact(
    metadata: Dict[str, object],
    expected_signature: str,
    latest_settled_date,
    config: SelectiveConfig,
) -> Tuple[bool, str]:
    if metadata.get("schema_version") != SELECTIVE_SCHEMA_VERSION:
        return False, "stale_artifact"
    if metadata.get("data_signature") != expected_signature:
        return False, "stale_artifact"

    created_at_str = metadata.get("created_at")
    if not created_at_str:
        return False, "stale_artifact"
    created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - created_at > timedelta(days=config.artifact_ttl_days):
        return False, "stale_artifact"

    trained_on_str = metadata.get("trained_on_end_date")
    if not trained_on_str or latest_settled_date is None:
        return False, "stale_artifact"

    trained_on = pd.Timestamp(trained_on_str)
    latest_allowed = pd.Timestamp(latest_settled_date) - pd.Timedelta(days=config.horizon)
    if trained_on > latest_allowed:
        return False, "stale_artifact"

    return True, "ok"


def run_selective_evaluation_from_df(
    ticker: str,
    df_raw: pd.DataFrame,
    config: Optional[SelectiveConfig] = None,
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
) -> Optional[Dict[str, object]]:
    config = config or SelectiveConfig()
    if df_raw is None or len(df_raw) < (config.min_history + config.lookback + config.horizon + 30):
        return None

    frame, base_feature_cols = build_fixed_features(df_raw, lookback=config.lookback)
    frame["target_return"] = compute_open_to_open_target(frame, horizon=config.horizon)
    frame["regime_er"] = compute_efficiency_ratio(frame["Close"], window=config.er_window)
    frame["regime_bucket"] = bucketize_regime(
        frame["regime_er"],
        chop_threshold=config.er_chop_threshold,
        trend_threshold=config.er_trend_threshold,
    )

    oof = generate_purged_oof_predictions(
        frame=frame,
        feature_columns=base_feature_cols,
        target_column="target_return",
        config=config,
    )
    if oof.empty:
        return None

    labels_df, label_counts = construct_selector_labels(
        yhat_oof=oof["raw_signal"],
        y_true=oof["target_return"],
        vol_window=config.vol_window,
        magnitude_k=config.magnitude_k,
        eps=config.eps,
        min_history=config.min_history,
    )
    merged = oof.join(labels_df[["vol_y", "correct", "signal", "valid_label", "informative"]], how="left")
    merged["valid_label"] = merged["valid_label"].where(merged["valid_label"].notna(), False).astype(bool)
    merged["informative"] = merged["informative"].fillna(0).astype(int)
    merged["vol_y"] = merged["vol_y"].fillna(0.0)
    merged["rolling_vol_y"] = merged["vol_y"]
    merged["regime_bucket"], regime_distribution = apply_regime_sparsity(
        merged["regime_bucket"],
        sparse_min_fraction=config.sparse_bucket_min_fraction,
    )

    selector_frame, selector_feature_cols = _build_selector_feature_frame(
        merged,
        base_features=base_feature_cols,
        config=config,
    )

    split_raw = split_contiguous(selector_frame)
    emb = config.embargo

    # Purge train/validation and validation/test boundaries while preserving enough validation rows.
    train = split_raw["train"].iloc[:-emb].copy() if len(split_raw["train"]) > emb else pd.DataFrame()
    validation = split_raw["validation"].iloc[emb:].copy() if len(split_raw["validation"]) > emb else pd.DataFrame()
    test = split_raw["test"].iloc[emb:].copy() if len(split_raw["test"]) > emb else pd.DataFrame()

    split = {"train": train, "validation": validation, "test": test}
    if train.empty or validation.empty or test.empty:
        return None

    train_labeled = train[train["valid_label"]].dropna(subset=selector_feature_cols + ["informative"])
    validation_labeled = validation[validation["valid_label"]].dropna(subset=selector_feature_cols + ["informative"])
    test_labeled = test[test["valid_label"]].dropna(subset=selector_feature_cols + ["informative"])
    if len(train_labeled) < max(50, config.min_history // 2):
        return None
    if train_labeled["informative"].nunique() < 2:
        return None

    X_train = train_labeled[selector_feature_cols].values
    y_train = train_labeled["informative"].astype(int).values
    selector_model = _train_selector_classifier(X_train, y_train, seed=config.seed)

    val_for_cal = validation_labeled.copy()
    validation_cutoff = None
    if len(val_for_cal) < 2 or val_for_cal["informative"].nunique() < 2:
        calibrator, cal_method = None, "none"
        cal_slice = val_for_cal.iloc[:0].copy()
    else:
        frac = float(np.clip(config.calibration_fraction, 0.1, 0.9))
        split_idx = int(max(2, round(len(val_for_cal) * frac)))
        split_idx = min(split_idx, len(val_for_cal))
        cal_slice = val_for_cal.iloc[:split_idx]
        if not cal_slice.empty:
            validation_cutoff = cal_slice.index[-1]
        calibrator, cal_method = calibrate_selector_model(
            selector_model,
            cal_slice[selector_feature_cols].values,
            cal_slice["informative"].astype(int).values,
            min_samples_for_isotonic=config.calibration_min_samples_for_isotonic,
            min_positives_for_isotonic=config.calibration_min_positives_for_isotonic,
        )

    for section_name, section_df in [("train", train), ("validation", validation), ("test", test)]:
        valid_features = section_df[selector_feature_cols].replace([np.inf, -np.inf], np.nan).dropna()
        probs = pd.Series(np.nan, index=section_df.index, dtype=float)
        if not valid_features.empty:
            probs.loc[valid_features.index] = _predict_selector_prob(
                selector_model,
                calibrator,
                valid_features.values,
            )
        split[section_name]["selector_prob"] = probs

    validation_eval_full = split["validation"].dropna(subset=["selector_prob", "target_return"]).copy()
    if validation_cutoff is not None:
        validation_eval = validation_eval_full[validation_eval_full.index > validation_cutoff].copy()
    else:
        validation_eval = validation_eval_full.copy()
    if len(validation_eval) < max(20, config.min_trades):
        validation_eval = validation_eval_full.copy()
    validation_eval_opt = validation_eval
    validation_eval_guard = pd.DataFrame()
    guard_frac = float(np.clip(config.validation_guard_fraction, 0.0, 0.49))
    guard_min_rows = max(10, int(config.validation_guard_min_rows))
    if guard_frac > 0 and len(validation_eval) >= (2 * guard_min_rows):
        guard_rows = max(guard_min_rows, int(round(len(validation_eval) * guard_frac)))
        guard_rows = min(guard_rows, len(validation_eval) - guard_min_rows)
        if guard_rows > 0:
            validation_eval_opt = validation_eval.iloc[:-guard_rows].copy()
            validation_eval_guard = validation_eval.iloc[-guard_rows:].copy()
            if len(validation_eval_opt) < max(20, config.min_trades):
                validation_eval_opt = validation_eval
                validation_eval_guard = pd.DataFrame()
    test_eval = split["test"].dropna(subset=["selector_prob", "target_return"]).copy()
    if validation_eval_opt.empty or test_eval.empty:
        return None

    validation_none = simulate_abstention_scenario(
        validation_eval_opt,
        tau=0.0,
        mode="none",
        pred_deadband=config.pred_deadband,
        one_way_cost_bps=config.one_way_cost_bps,
        eps=config.eps,
    )

    threshold_conservative = optimize_threshold_for_mode(
        validation_df=validation_eval_opt,
        mode="conservative",
        min_coverage=config.conservative_min_coverage,
        min_trades=config.min_trades,
        pred_deadband=config.pred_deadband,
        one_way_cost_bps=config.one_way_cost_bps,
        target_coverage=config.conservative_target_coverage,
        sharpe_tolerance=config.threshold_sharpe_tolerance,
        baseline_scenario=validation_none,
        require_improvement=config.validation_require_improvement,
        max_sharpe_drop=config.validation_max_sharpe_drop,
        max_drawdown_drop=config.validation_max_drawdown_drop,
        eps=config.eps,
    )
    threshold_aggressive = optimize_threshold_for_mode(
        validation_df=validation_eval_opt,
        mode="aggressive",
        min_coverage=config.aggressive_min_coverage,
        min_trades=config.min_trades,
        pred_deadband=config.pred_deadband,
        one_way_cost_bps=config.one_way_cost_bps,
        target_coverage=config.aggressive_target_coverage,
        sharpe_tolerance=config.threshold_sharpe_tolerance,
        baseline_scenario=validation_none,
        require_improvement=config.validation_require_improvement,
        max_sharpe_drop=config.validation_max_sharpe_drop,
        max_drawdown_drop=config.validation_max_drawdown_drop,
        eps=config.eps,
    )

    if not validation_eval_guard.empty:
        guard_none = simulate_abstention_scenario(
            validation_eval_guard,
            tau=0.0,
            mode="none",
            pred_deadband=config.pred_deadband,
            one_way_cost_bps=config.one_way_cost_bps,
            eps=config.eps,
        )
        if threshold_conservative["status"] == "ok":
            guard_conservative = simulate_abstention_scenario(
                validation_eval_guard,
                tau=float(threshold_conservative["tau"]),
                mode="conservative",
                pred_deadband=config.pred_deadband,
                one_way_cost_bps=config.one_way_cost_bps,
                eps=config.eps,
            )
            if not _passes_validation_guard(
                candidate=guard_conservative,
                baseline=guard_none,
                require_improvement=config.validation_require_improvement,
                max_sharpe_drop=config.validation_max_sharpe_drop,
                max_drawdown_drop=config.validation_max_drawdown_drop,
            ):
                threshold_conservative = {
                    "status": "disabled_conservative",
                    "tau": None,
                    "coverage_pred": 0.0,
                    "coverage_trade": 0.0,
                    "executed_trades": 0,
                    "sharpe": 0.0,
                    "max_drawdown": 0.0,
                    "win_rate": 0.0,
                }
        if threshold_aggressive["status"] == "ok":
            guard_aggressive = simulate_abstention_scenario(
                validation_eval_guard,
                tau=float(threshold_aggressive["tau"]),
                mode="aggressive",
                pred_deadband=config.pred_deadband,
                one_way_cost_bps=config.one_way_cost_bps,
                eps=config.eps,
            )
            if not _passes_validation_guard(
                candidate=guard_aggressive,
                baseline=guard_none,
                require_improvement=config.validation_require_improvement,
                max_sharpe_drop=config.validation_max_sharpe_drop,
                max_drawdown_drop=config.validation_max_drawdown_drop,
            ):
                threshold_aggressive = {
                    "status": "disabled_aggressive",
                    "tau": None,
                    "coverage_pred": 0.0,
                    "coverage_trade": 0.0,
                    "executed_trades": 0,
                    "sharpe": 0.0,
                    "max_drawdown": 0.0,
                    "win_rate": 0.0,
                }

    scenario_none = simulate_abstention_scenario(
        test_eval,
        tau=0.0,
        mode="none",
        pred_deadband=config.pred_deadband,
        one_way_cost_bps=config.one_way_cost_bps,
        eps=config.eps,
    )

    if threshold_conservative["status"] == "ok":
        scenario_conservative = simulate_abstention_scenario(
            test_eval,
            tau=float(threshold_conservative["tau"]),
            mode="conservative",
            pred_deadband=config.pred_deadband,
            one_way_cost_bps=config.one_way_cost_bps,
            eps=config.eps,
        )
    else:
        scenario_conservative = {"mode": "conservative", "status": "disabled_conservative", "frame": pd.DataFrame()}

    if threshold_aggressive["status"] == "ok":
        scenario_aggressive = simulate_abstention_scenario(
            test_eval,
            tau=float(threshold_aggressive["tau"]),
            mode="aggressive",
            pred_deadband=config.pred_deadband,
            one_way_cost_bps=config.one_way_cost_bps,
            eps=config.eps,
        )
    else:
        scenario_aggressive = {"mode": "aggressive", "status": "disabled_aggressive", "frame": pd.DataFrame()}

    scenarios = {
        "none": scenario_none,
        "conservative": scenario_conservative,
        "aggressive": scenario_aggressive,
    }
    regime_metrics = {}
    coverage_pred = {}
    coverage_trade = {}
    for mode, scenario in scenarios.items():
        if scenario.get("status") != "ok":
            regime_metrics[mode] = {}
            coverage_pred[mode] = 0.0
            coverage_trade[mode] = 0.0
            continue
        regime_metrics[mode] = compute_regime_metrics(scenario["frame"])
        coverage_pred[mode] = float(scenario["coverage_pred"])
        coverage_trade[mode] = float(scenario["coverage_trade"])

    lift_curve = compute_lift_curve(scenario_none["frame"])

    diagnostics = {
        "corr_selector_prob_vs_rolling_vol": float(
            test_eval["selector_prob"].corr(test_eval["rolling_vol_y"])
        )
        if test_eval["rolling_vol_y"].nunique() > 1
        else 0.0,
        "corr_selector_prob_vs_ensemble_disagreement": float(
            test_eval["selector_prob"].corr(test_eval["ensemble_disagreement"])
        )
        if test_eval["ensemble_disagreement"].nunique() > 1
        else 0.0,
    }

    selected_thresholds = {
        "conservative": threshold_conservative,
        "aggressive": threshold_aggressive,
    }
    mode_status = {
        "conservative": threshold_conservative["status"],
        "aggressive": threshold_aggressive["status"],
    }

    calibration_diagnostics = {}
    try:
        if len(val_for_cal) > 0:
            val_probs = _predict_selector_prob(
                selector_model,
                calibrator,
                val_for_cal[selector_feature_cols].values,
            )
            calibration_diagnostics["brier_score"] = float(
                brier_score_loss(val_for_cal["informative"].astype(int).values, val_probs)
            )
        else:
            calibration_diagnostics["brier_score"] = 0.0
    except Exception:
        calibration_diagnostics["brier_score"] = 0.0
    calibration_diagnostics["method"] = cal_method

    data_signature = _build_data_signature(base_feature_cols, config)
    latest_settled = latest_available_settled_date(frame, horizon=config.horizon)

    payload = {
        "selector_model": selector_model,
        "calibrator": calibrator,
        "selector_feature_columns": selector_feature_cols,
        "base_feature_columns": base_feature_cols,
        "config": config.__dict__,
    }
    metadata = {
        "schema_version": SELECTIVE_SCHEMA_VERSION,
        "data_signature": data_signature,
        "trained_on_end_date": str(validation.index[-1].date()),
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "taus": {
            "conservative": threshold_conservative["tau"],
            "aggressive": threshold_aggressive["tau"],
        },
        "split_config": {
            "protocol": "contiguous_60_20_20",
            "train_rows": int(len(train)),
            "validation_rows": int(len(validation)),
            "test_rows": int(len(test)),
        },
        "mode_status": mode_status,
        "backend_version": _get_backend_version(),
        "seed": config.seed,
        "latest_available_settled_date": str(latest_settled.date()) if latest_settled is not None else None,
        "calibration_diagnostics": calibration_diagnostics,
        "sample_survival_counts": {
            "overall": label_counts,
            "train_labeled": int(len(train_labeled)),
            "validation_labeled": int(len(validation_labeled)),
            "test_labeled": int(len(test_labeled)),
        },
        "training_baseline": {
            "coverage_pred_conservative": float(threshold_conservative.get("coverage_pred", 0.0)),
            "coverage_pred_aggressive": float(threshold_aggressive.get("coverage_pred", 0.0)),
        },
        "tuning": {
            "conservative_target_coverage": float(config.conservative_target_coverage),
            "aggressive_target_coverage": float(config.aggressive_target_coverage),
            "threshold_sharpe_tolerance": float(config.threshold_sharpe_tolerance),
            "calibration_fraction": float(config.calibration_fraction),
            "validation_require_improvement": bool(config.validation_require_improvement),
            "validation_max_sharpe_drop": float(config.validation_max_sharpe_drop),
            "validation_max_drawdown_drop": float(config.validation_max_drawdown_drop),
            "validation_guard_fraction": float(config.validation_guard_fraction),
            "validation_guard_min_rows": int(config.validation_guard_min_rows),
        },
        "horizon": config.horizon,
        "artifact_ttl_days": config.artifact_ttl_days,
    }
    _save_artifact(ticker=ticker, root=artifact_root, payload=payload, metadata=metadata)

    def _strip_frame(scenario: Dict[str, object]) -> Dict[str, object]:
        return {k: v for k, v in scenario.items() if k != "frame"}

    return {
        "selected_thresholds": selected_thresholds,
        "selective_scenarios": {
            "none": _strip_frame(scenario_none),
            "conservative": _strip_frame(scenario_conservative),
            "aggressive": _strip_frame(scenario_aggressive),
        },
        "coverage_pred": coverage_pred,
        "coverage_trade": coverage_trade,
        "regime_metrics": regime_metrics,
        "lift_curve": lift_curve,
        "regime_distribution": regime_distribution,
        "mode_status": mode_status,
        "diagnostics": diagnostics,
        "data_signature": data_signature,
    }


def run_selective_evaluation(
    ticker: str,
    config: Optional[SelectiveConfig] = None,
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
) -> Optional[Dict[str, object]]:
    config = config or SelectiveConfig()
    df = prepare_data_for_ml(ticker, min_days=max(320, config.min_history + config.lookback + 40))
    if df is not None and len(df) < 800:
        try:
            longer = fetch_from_yfinance(ticker, period="5y")
            longer = validate_and_clean_data(longer) if longer is not None else None
            if longer is not None and len(longer) > len(df):
                df = longer
        except Exception:
            pass
    if df is None or df.empty:
        return None
    return run_selective_evaluation_from_df(
        ticker=ticker,
        df_raw=df,
        config=config,
        artifact_root=artifact_root,
    )


_LIVE_MONITOR: Dict[str, List[Dict[str, float]]] = {}


def infer_selective_decision(
    ticker: str,
    requested_mode: str = "none",
    raw_signal: float = 0.0,
    ensemble_disagreement: float = 0.0,
    config: Optional[SelectiveConfig] = None,
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
    logger=None,
) -> Dict[str, object]:
    config = config or SelectiveConfig()
    mode_requested = str(requested_mode or "none").lower()
    if mode_requested not in SELECTIVE_MODES:
        mode_requested = "none"

    df = prepare_data_for_ml(ticker, min_days=max(320, config.min_history + config.lookback + 20))
    if df is None or len(df) < config.min_history:
        return {
            "abstain": False,
            "selector_prob": None,
            "selector_threshold": None,
            "selector_mode_requested": mode_requested,
            "selector_mode_effective": "none",
            "selector_status": "insufficient_history",
            "abstain_reason": None,
            "regime_bucket": "unknown",
        }

    feature_frame, base_feature_cols = build_fixed_features(df, lookback=config.lookback)
    latest_idx = feature_frame.index[-1]
    latest_row = feature_frame.loc[latest_idx]
    latest_settled = latest_available_settled_date(feature_frame, horizon=config.horizon)
    regime_er_series = compute_efficiency_ratio(feature_frame["Close"], window=config.er_window)
    regime_bucket = bucketize_regime(
        regime_er_series,
        chop_threshold=config.er_chop_threshold,
        trend_threshold=config.er_trend_threshold,
    ).iloc[-1]
    regime_er = float(regime_er_series.iloc[-1]) if pd.notna(regime_er_series.iloc[-1]) else 0.0

    expected_signature = _build_data_signature(base_feature_cols, config)
    payload, metadata = _load_artifact(ticker=ticker, root=artifact_root)
    if payload is None or metadata is None:
        return {
            "abstain": False,
            "selector_prob": None,
            "selector_threshold": None,
            "selector_mode_requested": mode_requested,
            "selector_mode_effective": "none",
            "selector_status": "model_unavailable",
            "abstain_reason": None,
            "regime_bucket": str(regime_bucket),
        }

    is_valid, status = _validate_artifact(
        metadata=metadata,
        expected_signature=expected_signature,
        latest_settled_date=latest_settled,
        config=config,
    )
    if not is_valid:
        return {
            "abstain": False,
            "selector_prob": None,
            "selector_threshold": None,
            "selector_mode_requested": mode_requested,
            "selector_mode_effective": "none",
            "selector_status": status,
            "abstain_reason": None,
            "regime_bucket": str(regime_bucket),
        }

    selector_feature_cols = payload["selector_feature_columns"]
    feature_values = {col: float(latest_row.get(col, 0.0)) for col in payload["base_feature_columns"]}
    y_hist = compute_open_to_open_target(feature_frame, horizon=config.horizon)
    rolling_vol = (
        y_hist.rolling(window=config.vol_window, min_periods=config.vol_window).std().shift(1).iloc[-1]
    )
    rolling_vol = float(rolling_vol) if pd.notna(rolling_vol) else 0.0

    selector_row = {
        **feature_values,
        "raw_signal": float(raw_signal),
        "raw_signal_abs": float(abs(raw_signal)),
        "ensemble_disagreement": float(abs(ensemble_disagreement)),
        "rolling_vol_y": rolling_vol,
        "regime_er": regime_er,
        "regime_is_chop": 1 if regime_bucket == "chop" else 0,
        "regime_is_neutral": 1 if regime_bucket == "neutral" else 0,
        "regime_is_trend": 1 if regime_bucket == "trend" else 0,
    }
    selector_input = pd.DataFrame([selector_row])
    for col in selector_feature_cols:
        if col not in selector_input.columns:
            selector_input[col] = 0.0
    selector_input = selector_input[selector_feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)

    selector_model = payload["selector_model"]
    calibrator = payload.get("calibrator")
    selector_prob = float(_predict_selector_prob(selector_model, calibrator, selector_input.values)[0])

    mode_effective = mode_requested
    status_out = "ok"
    taus = metadata.get("taus", {})
    mode_status = metadata.get("mode_status", {})
    if mode_effective != "none":
        this_mode_status = mode_status.get(mode_effective)
        if this_mode_status != "ok":
            status_out = f"disabled_{mode_effective}"
            mode_effective = "none"

    threshold = None
    abstain = False
    reason = None
    if status_out == "ok" and mode_effective != "none":
        threshold = taus.get(mode_effective)
        if threshold is None:
            status_out = f"disabled_{mode_effective}"
            mode_effective = "none"
        else:
            threshold = float(threshold)
            abstain = selector_prob < threshold
            if abstain:
                reason = "selector_prob_below_threshold"

    if status_out != "ok":
        selector_prob_out = None
        threshold_out = None
        abstain = False
    else:
        selector_prob_out = selector_prob
        threshold_out = threshold

    key = ticker.upper()
    _LIVE_MONITOR.setdefault(key, [])
    _LIVE_MONITOR[key].append(
        {
            "abstain": 1.0 if abstain else 0.0,
            "mode_non_none": 0.0 if mode_effective == "none" else 1.0,
        }
    )
    _LIVE_MONITOR[key] = _LIVE_MONITOR[key][-20:]
    if logger and status_out == "ok" and len(_LIVE_MONITOR[key]) >= 20:
        baseline = metadata.get("training_baseline", {})
        if mode_effective == "conservative":
            baseline_cov = baseline.get("coverage_pred_conservative")
        elif mode_effective == "aggressive":
            baseline_cov = baseline.get("coverage_pred_aggressive")
        else:
            baseline_cov = None
        if baseline_cov is not None and mode_effective != "none":
            rolling_coverage = float(np.mean([1.0 - x["abstain"] for x in _LIVE_MONITOR[key]]))
            if abs(rolling_coverage - float(baseline_cov)) > 0.10:
                logger.warning(
                    "Selector drift guardrail: ticker=%s mode=%s rolling_coverage=%.3f baseline=%.3f",
                    key,
                    mode_effective,
                    rolling_coverage,
                    float(baseline_cov),
                )

    return {
        "abstain": bool(abstain),
        "selector_prob": selector_prob_out,
        "selector_threshold": threshold_out,
        "selector_mode_requested": mode_requested,
        "selector_mode_effective": mode_effective,
        "selector_status": status_out,
        "abstain_reason": reason,
        "regime_bucket": str(regime_bucket),
    }
