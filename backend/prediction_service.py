from __future__ import annotations

import copy
import math
import time
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import shap
from mlforecast import MLForecast
from mlforecast.lag_transforms import RollingMean, RollingStd
from sklearn.ensemble import RandomForestRegressor
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)
from statsforecast import StatsForecast
from statsforecast.models import AutoARIMA, Naive, SeasonalNaive

import exchange_session_service
from data_fetcher import fetch_from_yfinance, get_stock_data_with_fallback, prepare_data_for_ml

try:
    import xgboost as xgb

    XGBOOST_AVAILABLE = True
except Exception:
    xgb = None
    XGBOOST_AVAILABLE = False


FEATURE_SPEC_VERSION = "prediction-stack-v2"
PREDICTION_HORIZON = 7
PREDICTION_PREVIEW_HORIZON = 3
SEASON_LENGTH = 5
TRADING_DAYS_PER_YEAR = 252
MIN_HISTORY_ROWS = 40
MIN_PRODUCTION_HISTORY_ROWS = 120
CACHE_TTL_SECONDS = 300

PERIOD_SESSION_COUNTS = {
    "15d": 15,
    "1mo": 21,
    "6mo": 126,
    "1y": 252,
    "2y": 504,
}

PRODUCTION_ENSEMBLE_MODELS = (
    "auto_arima",
    "linear_regression",
    "random_forest",
    "xgboost",
    "lstm",
    "transformer",
    "gradient_boosting",
)

BENCHMARK_MODELS = ("naive", "seasonal_naive_5", "auto_arima")
ML_MODELS = ("linear_regression", "random_forest", "xgboost", "lstm", "transformer", "gradient_boosting")

_CACHE: Dict[Tuple[Any, ...], Dict[str, Any]] = {}


def _cache_get(key: Tuple[Any, ...]) -> Any:
    entry = _CACHE.get(key)
    if not entry:
        return None
    if time.time() - entry["ts"] > CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None
    return copy.deepcopy(entry["value"])


def _cache_set(key: Tuple[Any, ...], value: Any) -> Any:
    _CACHE[key] = {"ts": time.time(), "value": copy.deepcopy(value)}
    return value


def _clean_float(value: Any, digits: Optional[int] = None) -> Optional[float]:
    if value is None:
        return None
    try:
        numeric = float(value)
    except Exception:
        return None
    if not math.isfinite(numeric):
        return None
    if digits is None:
        return numeric
    return round(numeric, digits)


def _normalize_ticker(ticker: str) -> str:
    return str(ticker or "").split(":", 1)[0].strip().upper()


def _standardize_ohlcv(df: Optional[pd.DataFrame]) -> pd.DataFrame:
    if df is None or getattr(df, "empty", True):
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
    standardized = df.copy()
    if isinstance(standardized.columns, pd.MultiIndex):
        standardized.columns = [col[0] for col in standardized.columns]
    if "Close" not in standardized.columns:
        if len(standardized.columns) == 1:
            standardized.columns = ["Close"]
        else:
            return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
    for column in ("Open", "High", "Low"):
        if column not in standardized.columns:
            standardized[column] = standardized["Close"]
    if "Volume" not in standardized.columns:
        standardized["Volume"] = 1.0
    standardized = standardized[["Open", "High", "Low", "Close", "Volume"]].copy()
    standardized.index = pd.to_datetime(standardized.index)
    standardized = standardized.sort_index()
    for column in standardized.columns:
        standardized[column] = pd.to_numeric(standardized[column], errors="coerce")
    standardized["Close"] = standardized["Close"].ffill().bfill()
    standardized["Open"] = standardized["Open"].ffill().bfill().fillna(standardized["Close"])
    standardized["High"] = standardized["High"].ffill().bfill().fillna(standardized["Close"])
    standardized["Low"] = standardized["Low"].ffill().bfill().fillna(standardized["Close"])
    standardized["Volume"] = standardized["Volume"].ffill().bfill().fillna(1.0)
    standardized = standardized.dropna(subset=["Close"])
    return standardized


def _load_canonical_ohlcv(ticker: str) -> pd.DataFrame:
    normalized_ticker = _normalize_ticker(ticker)
    cache_key = ("ohlcv", normalized_ticker)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    df = prepare_data_for_ml(normalized_ticker, min_days=280)
    if df is None or df.empty:
        df = get_stock_data_with_fallback(normalized_ticker, min_days=120)
    if df is None or df.empty:
        df = fetch_from_yfinance(normalized_ticker, period="2y")
    standardized = _standardize_ohlcv(df)
    return _cache_set(cache_key, standardized)


def create_dataset(ticker: str, period: str = "1y") -> pd.DataFrame:
    ohlcv = _load_canonical_ohlcv(ticker)
    if ohlcv.empty:
        return pd.DataFrame(columns=["Close"])
    session_count = PERIOD_SESSION_COUNTS.get(str(period or "1y").lower(), len(ohlcv))
    close_df = ohlcv.tail(session_count)[["Close"]].copy()
    close_df.attrs["canonical_ohlcv"] = ohlcv.copy()
    close_df.attrs["ticker"] = _normalize_ticker(ticker)
    close_df.attrs["market"] = "US"
    return close_df


def _coerce_ohlcv_from_input(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df, pd.DataFrame) and isinstance(df.attrs.get("canonical_ohlcv"), pd.DataFrame):
        return _standardize_ohlcv(df.attrs["canonical_ohlcv"])
    standardized = _standardize_ohlcv(df)
    return standardized


def _build_long_frame(ohlcv: pd.DataFrame, ticker: str) -> pd.DataFrame:
    dates = pd.to_datetime(ohlcv.index).tz_localize(None)
    volume = pd.to_numeric(ohlcv["Volume"], errors="coerce").replace(0, np.nan)
    frame = pd.DataFrame(
        {
            "unique_id": _normalize_ticker(ticker),
            "ds": np.arange(1, len(ohlcv) + 1, dtype=int),
            "y": pd.to_numeric(ohlcv["Close"], errors="coerce").astype(float),
            "volume_ratio_5": (
                volume / volume.rolling(window=5, min_periods=1).mean()
            ).replace([np.inf, -np.inf], 1.0),
            "volume_ratio_20": (
                volume / volume.rolling(window=20, min_periods=1).mean()
            ).replace([np.inf, -np.inf], 1.0),
            "session_weekday": dates.weekday.astype(int),
            "session_month": dates.month.astype(int),
            "session_quarter": dates.quarter.astype(int),
        },
        index=dates,
    )
    frame["volume_ratio_5"] = frame["volume_ratio_5"].fillna(1.0)
    frame["volume_ratio_20"] = frame["volume_ratio_20"].fillna(1.0)
    return frame


def _future_session_dates(last_date: pd.Timestamp, horizon: int) -> List[pd.Timestamp]:
    return exchange_session_service.get_next_session_dates(
        "US",
        after_date=last_date,
        count=horizon,
    )


def _build_future_exogenous(long_df: pd.DataFrame, future_dates: List[pd.Timestamp]) -> pd.DataFrame:
    last_row = long_df.iloc[-1]
    ds_start = int(long_df["ds"].iloc[-1]) + 1
    rows = []
    for offset, session_date in enumerate(future_dates):
        rows.append(
            {
                "unique_id": str(long_df["unique_id"].iloc[-1]),
                "ds": ds_start + offset,
                "volume_ratio_5": float(last_row["volume_ratio_5"]),
                "volume_ratio_20": float(last_row["volume_ratio_20"]),
                "session_weekday": int(session_date.weekday()),
                "session_month": int(session_date.month),
                "session_quarter": int(((session_date.month - 1) // 3) + 1),
            }
        )
    return pd.DataFrame(rows)


def _build_mlforecast(models: Dict[str, Any]) -> MLForecast:
    return MLForecast(
        models=models,
        freq=1,
        lags=[1, 2, 3, 5, 10, 20],
        lag_transforms={
            1: [RollingMean(3), RollingMean(5), RollingMean(10), RollingStd(3), RollingStd(5), RollingStd(10)],
            5: [RollingMean(3)],
        },
        num_threads=1,
    )


def _build_ml_models() -> Dict[str, Any]:
    models: Dict[str, Any] = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(
            n_estimators=200,
            max_depth=12,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingRegressor(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            random_state=42
        )
    }
    if XGBOOST_AVAILABLE:
        models["xgboost"] = xgb.XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=42,
            n_jobs=1,
        )
    return models


def _build_statsforecast() -> StatsForecast:
    return StatsForecast(
        models=[
            Naive(alias="naive"),
            SeasonalNaive(season_length=SEASON_LENGTH, alias="seasonal_naive_5"),
            AutoARIMA(season_length=SEASON_LENGTH, alias="auto_arima"),
        ],
        freq=1,
        n_jobs=1,
    )


def _forecast_ml_models(
    ohlcv: pd.DataFrame,
    *,
    model_names: Optional[Iterable[str]] = None,
    horizon: int = PREDICTION_HORIZON,
    ticker: str = "AAPL",
) -> Dict[str, Any]:
    requested = tuple(name for name in (model_names or ML_MODELS) if name in _build_ml_models())
    cache_key = ("ml_forecast", _normalize_ticker(ticker), tuple(sorted(requested)), len(ohlcv), horizon)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    long_df = _build_long_frame(ohlcv, ticker)
    future_dates = _future_session_dates(ohlcv.index[-1], horizon)
    future_x = _build_future_exogenous(long_df, future_dates)
    models = {name: estimator for name, estimator in _build_ml_models().items() if name in requested}
    fcst = _build_mlforecast(models)
    fcst.fit(long_df.reset_index(drop=True), static_features=[])
    predictions = fcst.predict(h=horizon, X_df=future_x)
    processed_X, processed_y = fcst.preprocess(long_df.reset_index(drop=True), static_features=[], return_X_y=True)
    result = {
        "predictions": {
            model_name: predictions[model_name].to_numpy(dtype=float)
            for model_name in models
            if model_name in predictions.columns
        },
        "future_dates": future_dates,
        "feature_frame": processed_X.reset_index(drop=True),
        "target": np.asarray(processed_y, dtype=float),
        "models": fcst.models_,
    }
    return _cache_set(cache_key, result)


def _forecast_statistical_models(
    ohlcv: pd.DataFrame,
    *,
    horizon: int = PREDICTION_HORIZON,
    ticker: str = "AAPL",
) -> Dict[str, Any]:
    cache_key = ("stats_forecast", _normalize_ticker(ticker), len(ohlcv), horizon)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    long_df = _build_long_frame(ohlcv, ticker)[["unique_id", "ds", "y"]].reset_index(drop=True)
    sf = _build_statsforecast()
    forecast = sf.forecast(h=horizon, df=long_df)
    result = {
        "predictions": {
            model_name: forecast[model_name].to_numpy(dtype=float)
            for model_name in BENCHMARK_MODELS
            if model_name in forecast.columns
        },
    }
    return _cache_set(cache_key, result)


def _compute_weighted_ensemble(model_predictions: Dict[str, np.ndarray], weights: Dict[str, float]) -> np.ndarray:
    available = [name for name in PRODUCTION_ENSEMBLE_MODELS if name in model_predictions]
    if not available:
        return np.array([], dtype=float)
    normalized_weights = {name: max(float(weights.get(name, 0.0)), 0.0) for name in available}
    total = sum(normalized_weights.values())
    if total <= 0:
        normalized_weights = {name: 1.0 / len(available) for name in available}
    else:
        normalized_weights = {name: value / total for name, value in normalized_weights.items()}
    stacked = np.stack([model_predictions[name] * normalized_weights[name] for name in available], axis=0)
    return stacked.sum(axis=0)


def _default_live_weight_windows(series_length: int) -> int:
    return max(3, min(8, max(1, series_length // 30)))


def _ensemble_weights_from_recent_cv(ohlcv: pd.DataFrame, ticker: str) -> Dict[str, float]:
    cache_key = ("ensemble_weights", _normalize_ticker(ticker), len(ohlcv))
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        long_df = _build_long_frame(ohlcv, ticker)
        n_windows = _default_live_weight_windows(len(long_df))
        input_size = min(max(len(long_df) - n_windows, 60), 180)

        ml_models = _build_ml_models()
        ml_fcst = _build_mlforecast(ml_models)
        ml_cv = ml_fcst.cross_validation(
            df=long_df.reset_index(drop=True),
            n_windows=n_windows,
            h=1,
            step_size=1,
            refit=1,
            static_features=[],
            input_size=input_size,
        )

        sf = _build_statsforecast()
        sf_cv = sf.cross_validation(
            h=1,
            df=long_df[["unique_id", "ds", "y"]].reset_index(drop=True),
            n_windows=n_windows,
            step_size=1,
            refit=1,
            input_size=input_size,
        )

        errors: Dict[str, float] = {}
        for model_name in ("linear_regression", "random_forest", "xgboost"):
            if model_name in ml_cv.columns:
                errors[model_name] = float(mean_absolute_error(ml_cv["y"], ml_cv[model_name]))
        if "auto_arima" in sf_cv.columns:
            errors["auto_arima"] = float(mean_absolute_error(sf_cv["y"], sf_cv["auto_arima"]))

        valid = {name: err for name, err in errors.items() if math.isfinite(err) and err > 0}
        if not valid:
            raise ValueError("No valid validation errors were produced.")

        inverse = {name: 1.0 / err for name, err in valid.items()}
        total = sum(inverse.values())
        weights = {name: value / total for name, value in inverse.items()}
    except Exception:
        available = [name for name in PRODUCTION_ENSEMBLE_MODELS if name != "xgboost" or XGBOOST_AVAILABLE]
        weights = {name: 1.0 / len(available) for name in available}

    return _cache_set(cache_key, weights)


def _predict_production_components(
    ohlcv: pd.DataFrame,
    *,
    horizon: int = PREDICTION_HORIZON,
    ticker: str = "AAPL",
) -> Tuple[np.ndarray, Dict[str, np.ndarray], List[pd.Timestamp], Dict[str, float]]:
    ml_result = _forecast_ml_models(ohlcv, model_names=ML_MODELS, horizon=horizon, ticker=ticker)
    stats_result = _forecast_statistical_models(ohlcv, horizon=horizon, ticker=ticker)
    predictions = dict(ml_result["predictions"])
    if "auto_arima" in stats_result["predictions"]:
        predictions["auto_arima"] = stats_result["predictions"]["auto_arima"]
    weights = _ensemble_weights_from_recent_cv(ohlcv, ticker)
    ensemble = _compute_weighted_ensemble(predictions, weights)
    return ensemble, predictions, ml_result["future_dates"], weights


def _confidence_from_model_breakdown(model_predictions: Dict[str, np.ndarray], recent_close: float) -> float:
    first_day = [float(preds[0]) for preds in model_predictions.values() if preds is not None and len(preds)]
    if len(first_day) <= 1 or recent_close == 0:
        return 85.0
    mean_prediction = sum(first_day) / len(first_day)
    dispersion = sum(abs(pred - mean_prediction) for pred in first_day) / len(first_day)
    confidence = 95.0 - ((dispersion / recent_close) * 100)
    return round(max(55.0, min(95.0, confidence)), 1)


def linear_regression_predict(df: pd.DataFrame, days_ahead: int = PREDICTION_HORIZON) -> Optional[np.ndarray]:
    ohlcv = _coerce_ohlcv_from_input(df)
    if ohlcv.empty or len(ohlcv) < MIN_HISTORY_ROWS:
        return None
    result = _forecast_ml_models(
        ohlcv,
        model_names=("linear_regression",),
        horizon=days_ahead,
        ticker=str(df.attrs.get("ticker") or "AAPL"),
    )
    return result["predictions"].get("linear_regression")


def random_forest_predict(df: pd.DataFrame, days_ahead: int = PREDICTION_HORIZON, lookback: int = 14) -> Optional[np.ndarray]:
    _ = lookback
    ohlcv = _coerce_ohlcv_from_input(df)
    if ohlcv.empty or len(ohlcv) < MIN_HISTORY_ROWS:
        return None
    result = _forecast_ml_models(
        ohlcv,
        model_names=("random_forest",),
        horizon=days_ahead,
        ticker=str(df.attrs.get("ticker") or "AAPL"),
    )
    return result["predictions"].get("random_forest")


def xgboost_predict(df: pd.DataFrame, days_ahead: int = PREDICTION_HORIZON, lookback: int = 14) -> Optional[np.ndarray]:
    _ = lookback
    if not XGBOOST_AVAILABLE:
        return None
    ohlcv = _coerce_ohlcv_from_input(df)
    if ohlcv.empty or len(ohlcv) < MIN_HISTORY_ROWS:
        return None
    result = _forecast_ml_models(
        ohlcv,
        model_names=("xgboost",),
        horizon=days_ahead,
        ticker=str(df.attrs.get("ticker") or "AAPL"),
    )
    return result["predictions"].get("xgboost")

def gradient_boosting_predict(df: pd.DataFrame, days_ahead: int = PREDICTION_HORIZON, lookback: int = 14) -> Optional[np.ndarray]:
    _ = lookback
    ohlcv = _coerce_ohlcv_from_input(df)
    if ohlcv.empty or len(ohlcv) < MIN_HISTORY_ROWS:
        return None
    result = _forecast_ml_models(
        ohlcv,
        model_names=("gradient_boosting",),
        horizon=days_ahead,
        ticker=str(df.attrs.get("ticker") or "AAPL"),
    )
    return result["predictions"].get("gradient_boosting")

def ensemble_predict(df: pd.DataFrame, days_ahead: int = PREDICTION_HORIZON) -> Tuple[Optional[np.ndarray], Dict[str, np.ndarray]]:
    ohlcv = _coerce_ohlcv_from_input(df)
    ticker = str(df.attrs.get("ticker") or "AAPL")
    if ohlcv.empty or len(ohlcv) < MIN_PRODUCTION_HISTORY_ROWS:
        return None, {}
    ensemble, breakdown, _, _ = _predict_production_components(ohlcv, horizon=days_ahead, ticker=ticker)
    return ensemble, breakdown


def calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
    mae = mean_absolute_error(actual, predicted)
    rmse = math.sqrt(mean_squared_error(actual, predicted))
    mape = mean_absolute_percentage_error(actual, predicted) * 100
    return {
        "mae": round(float(mae), 2),
        "rmse": round(float(rmse), 2),
        "mape": round(float(mape), 2),
    }


def _evaluation_metrics(actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
    mae = mean_absolute_error(actual, predicted)
    rmse = math.sqrt(mean_squared_error(actual, predicted))
    mape = mean_absolute_percentage_error(actual, predicted) * 100
    r_squared = r2_score(actual, predicted)
    if len(predicted) > 1:
        pred_direction = np.diff(predicted) > 0
        actual_direction = np.diff(actual) > 0
        directional_accuracy = float(np.mean(pred_direction == actual_direction) * 100)
    else:
        directional_accuracy = 0.0
    return {
        "mae": round(float(mae), 2),
        "rmse": round(float(rmse), 2),
        "mape": round(float(mape), 2),
        "r_squared": round(float(r_squared), 4),
        "directional_accuracy": round(directional_accuracy, 2),
    }


def calculate_trading_returns(predictions: np.ndarray, actuals: np.ndarray, initial_capital: float = 10000) -> Optional[Dict[str, Any]]:
    if len(predictions) < 2:
        return None

    capital = float(initial_capital)
    shares = 0.0
    portfolio_values = [float(initial_capital)]
    num_trades = 0

    for index in range(len(predictions) - 1):
        pred_return = 0.0 if predictions[index] == 0 else (predictions[index + 1] - predictions[index]) / predictions[index]
        actual_price = float(actuals[index])
        next_price = float(actuals[index + 1])

        if pred_return > 0.005 and shares == 0 and capital > 0:
            shares = capital / actual_price
            capital = 0.0
            num_trades += 1
        elif pred_return < -0.005 and shares > 0:
            capital = shares * actual_price
            shares = 0.0
            num_trades += 1

        portfolio_values.append(capital + (shares * next_price))

    if shares > 0:
        capital = shares * float(actuals[-1])

    total_return = ((capital - initial_capital) / initial_capital) * 100
    buy_hold_final = (initial_capital / float(actuals[0])) * float(actuals[-1])
    buy_hold_return = ((buy_hold_final - initial_capital) / initial_capital) * 100
    returns_series = np.diff(portfolio_values) / np.maximum(np.array(portfolio_values[:-1]), 1e-9)
    sharpe_ratio = (np.mean(returns_series) / np.std(returns_series)) * math.sqrt(TRADING_DAYS_PER_YEAR) if np.std(returns_series) > 0 else 0.0
    portfolio_array = np.array(portfolio_values)
    running_max = np.maximum.accumulate(portfolio_array)
    drawdown = (portfolio_array - running_max) / np.maximum(running_max, 1e-9) * 100
    max_drawdown = float(np.min(drawdown))

    return {
        "initial_capital": round(float(initial_capital), 2),
        "final_value": round(float(capital), 2),
        "total_return": round(float(total_return), 2),
        "buy_hold_return": round(float(buy_hold_return), 2),
        "outperformance": round(float(total_return - buy_hold_return), 2),
        "sharpe_ratio": round(float(sharpe_ratio), 2),
        "max_drawdown": round(max_drawdown, 2),
        "num_trades": int(num_trades),
        "portfolio_values": [round(float(value), 2) for value in portfolio_values],
    }


def get_prediction_snapshot(ticker: str) -> Optional[Dict[str, Any]]:
    normalized_ticker = _normalize_ticker(ticker)
    cache_key = ("prediction_snapshot", normalized_ticker)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    ohlcv = _load_canonical_ohlcv(normalized_ticker)
    if ohlcv.empty or len(ohlcv) < MIN_PRODUCTION_HISTORY_ROWS:
        return None
    ensemble_preds, model_breakdown, future_dates, _weights = _predict_production_components(
        ohlcv,
        horizon=PREDICTION_PREVIEW_HORIZON,
        ticker=normalized_ticker,
    )
    if ensemble_preds is None or len(ensemble_preds) == 0:
        return None
    recent_close = float(ohlcv["Close"].iloc[-1])
    snapshot = {
        "recentClose": round(recent_close, 2),
        "recentPredicted": round(float(ensemble_preds[0]), 2),
        "confidence": _confidence_from_model_breakdown(model_breakdown, recent_close),
        "modelsUsed": list(model_breakdown.keys()),
        "predictions": [
            {"day": index + 1, "predictedClose": round(float(pred), 2), "date": future_dates[index].strftime("%Y-%m-%d")}
            for index, pred in enumerate(ensemble_preds[:PREDICTION_PREVIEW_HORIZON])
        ],
    }
    return _cache_set(cache_key, snapshot)


def get_future_prediction_dates(df: pd.DataFrame, horizon: int) -> List[pd.Timestamp]:
    ohlcv = _coerce_ohlcv_from_input(df)
    if ohlcv.empty:
        return []
    return _future_session_dates(ohlcv.index[-1], horizon)


def _serialize_feature_importance(feature_name: str, value: Any, impact: Any) -> Dict[str, Any]:
    return {
        "feature": str(feature_name),
        "value": _clean_float(value, 4),
        "impact": _clean_float(impact, 4),
    }


def _summarize_shap_explainability(
    model_name: str,
    model: Any,
    feature_frame: pd.DataFrame,
    latest_features: pd.DataFrame,
) -> Optional[Dict[str, Any]]:
    if feature_frame is None or feature_frame.empty or latest_features is None or latest_features.empty:
        return None
    try:
        background = feature_frame.tail(min(len(feature_frame), 200))
        if model_name == "linear_regression":
            explainer = shap.LinearExplainer(model, background)
        else:
            explainer = shap.TreeExplainer(model, data=background)

        background_values = np.asarray(explainer.shap_values(background))
        latest_values = np.asarray(explainer.shap_values(latest_features))
        if background_values.ndim == 1:
            background_values = background_values.reshape(1, -1)
        if latest_values.ndim == 1:
            latest_values = latest_values.reshape(1, -1)

        mean_abs = np.abs(background_values).mean(axis=0)
        top_indices = np.argsort(mean_abs)[::-1][:5]
        latest_row = latest_features.iloc[0]
        latest_impacts = latest_values[0]
        latest_indices = np.argsort(np.abs(latest_impacts))[::-1][:5]

        return {
            "global_top_features": [
                {
                    "feature": str(feature_frame.columns[idx]),
                    "meanAbsImpact": _clean_float(mean_abs[idx], 4),
                }
                for idx in top_indices
            ],
            "latest_prediction_contributors": [
                _serialize_feature_importance(
                    feature_frame.columns[idx],
                    latest_row.iloc[idx],
                    latest_impacts[idx],
                )
                for idx in latest_indices
            ],
        }
    except Exception:
        return None


def _build_evaluation_explainability(
    ohlcv: pd.DataFrame,
    ticker: str,
    evaluation_ds: int,
) -> Dict[str, Dict[str, Any]]:
    long_df = _build_long_frame(ohlcv, ticker).reset_index(drop=True)
    ml_result = _forecast_ml_models(ohlcv, model_names=ML_MODELS, horizon=PREDICTION_HORIZON, ticker=ticker)
    feature_frame = ml_result["feature_frame"]
    explanations: Dict[str, Dict[str, Any]] = {}
    if feature_frame.empty:
        return explanations

    latest_index = max(0, min(len(feature_frame) - 1, int(evaluation_ds) - 2))
    latest_features = feature_frame.iloc[[latest_index]].copy()

    for model_name, model in ml_result["models"].items():
        explainability = _summarize_shap_explainability(model_name, model, feature_frame, latest_features)
        if explainability:
            explanations[model_name] = explainability
    return explanations


def _merge_cv_frames(
    stat_cv: pd.DataFrame,
    ml_cv: pd.DataFrame,
) -> pd.DataFrame:
    merged = stat_cv[["unique_id", "ds", "cutoff", "y"]].copy()
    for frame in (stat_cv, ml_cv):
        for column in frame.columns:
            if column in {"unique_id", "ds", "cutoff", "y"}:
                continue
            merged[column] = frame[column]
    return merged.sort_values("ds").reset_index(drop=True)


def _prepare_cv_frames(
    ticker: str,
    *,
    ohlcv: pd.DataFrame,
    test_days: int,
    retrain_frequency: int,
    max_train_rows: Optional[int],
) -> pd.DataFrame:
    long_df = _build_long_frame(ohlcv, ticker)
    if len(long_df) <= max(test_days + 30, 60):
        raise ValueError("Insufficient data for evaluation.")

    n_windows = min(test_days, len(long_df) - 30)
    if n_windows < 5:
        raise ValueError("Insufficient backtest windows.")

    input_size = min(max_train_rows, len(long_df) - 1) if max_train_rows else None

    stats_cv = _build_statsforecast().cross_validation(
        h=1,
        df=long_df[["unique_id", "ds", "y"]].reset_index(drop=True),
        n_windows=n_windows,
        step_size=1,
        refit=max(1, retrain_frequency),
        input_size=input_size,
    )

    ml_models = _build_ml_models()
    ml_fcst = _build_mlforecast(ml_models)
    ml_cv = ml_fcst.cross_validation(
        df=long_df.reset_index(drop=True),
        n_windows=n_windows,
        h=1,
        step_size=1,
        refit=max(1, retrain_frequency),
        static_features=[],
        input_size=input_size,
    )
    return _merge_cv_frames(stats_cv, ml_cv)


def rolling_window_backtest(
    ticker: str,
    test_days: int = 60,
    retrain_frequency: int = 5,
    include_selective: bool = False,
    include_selector_variants: bool = False,
    fast_mode: bool = True,
    max_train_rows: Optional[int] = None,
    include_explanations: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    normalized_ticker = _normalize_ticker(ticker)
    if include_explanations is None:
        include_explanations = not fast_mode

    cache_key = (
        "rolling_backtest",
        normalized_ticker,
        int(test_days),
        int(retrain_frequency),
        bool(include_selective),
        bool(include_selector_variants),
        bool(fast_mode),
        int(max_train_rows) if max_train_rows else None,
        bool(include_explanations),
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    ohlcv = _load_canonical_ohlcv(normalized_ticker)
    if ohlcv.empty or len(ohlcv) < 120:
        return None

    merged_cv = _prepare_cv_frames(
        normalized_ticker,
        ohlcv=ohlcv,
        test_days=test_days,
        retrain_frequency=retrain_frequency,
        max_train_rows=max_train_rows,
    )

    actuals = merged_cv["y"].to_numpy(dtype=float)
    date_lookup = {
        index + 1: pd.to_datetime(session_date)
        for index, session_date in enumerate(pd.to_datetime(ohlcv.index).tz_localize(None))
    }
    dates = [date_lookup[int(ds)].strftime("%Y-%m-%d") for ds in merged_cv["ds"]]

    model_predictions = {
        model_name: merged_cv[model_name].to_numpy(dtype=float)
        for model_name in BENCHMARK_MODELS + ML_MODELS
        if model_name in merged_cv.columns
    }
    ensemble_weights = _ensemble_weights_from_recent_cv(ohlcv, normalized_ticker)
    model_predictions["ensemble"] = _compute_weighted_ensemble(model_predictions, ensemble_weights)

    results = {
        "ticker": normalized_ticker,
        "featureSpecVersion": FEATURE_SPEC_VERSION,
        "test_period": {
            "start_date": dates[0],
            "end_date": dates[-1],
            "days": len(dates),
        },
        "dates": dates,
        "actuals": [round(float(value), 2) for value in actuals],
        "models": {},
        "evaluationOptions": {
            "fastMode": bool(fast_mode),
            "includeSelective": bool(include_selective),
            "includeSelectorVariants": bool(include_selector_variants),
            "retrainFrequency": int(retrain_frequency),
            "maxTrainRows": int(max_train_rows) if max_train_rows else None,
            "includeExplanations": bool(include_explanations),
        },
    }

    explainability = (
        _build_evaluation_explainability(ohlcv, normalized_ticker, int(merged_cv["ds"].iloc[-1]))
        if include_explanations
        else {}
    )

    for model_name, predictions in model_predictions.items():
        if predictions is None or len(predictions) == 0:
            continue
        payload = {
            "predictions": [round(float(prediction), 2) for prediction in predictions],
            "metrics": _evaluation_metrics(actuals, predictions),
        }
        if model_name in explainability:
            payload["explainability"] = explainability[model_name]
        results["models"][model_name] = payload

    results["returns"] = calculate_trading_returns(
        np.asarray(results["models"]["ensemble"]["predictions"], dtype=float),
        actuals,
    )
    results["best_model"] = min(
        results["models"].items(),
        key=lambda item: item[1]["metrics"]["mape"],
    )[0]
    return _cache_set(cache_key, results)
