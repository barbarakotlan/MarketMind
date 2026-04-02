from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from importlib import import_module
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

import prediction_service

TRADING_DAYS_PER_YEAR = 252
SUPPORTED_METHODS = {"black_litterman", "max_sharpe", "min_vol", "hrp"}
DEFAULT_METHOD = "black_litterman"
DEFAULT_LOOKBACK_DAYS = 252
DEFAULT_MAX_WEIGHT = 0.35
MIN_HISTORY_ROWS = 126
MIN_ELIGIBLE_HOLDINGS = 2
MIN_PREDICTION_CONFIDENCE = 60.0
DEFAULT_RISK_FREE_RATE = float(os.getenv("PORTFOLIO_OPTIMIZATION_RISK_FREE_RATE", "0.02"))
DEFAULT_RISK_AVERSION = float(os.getenv("PORTFOLIO_OPTIMIZATION_RISK_AVERSION", "2.5"))

_PYPFOPT_RUNTIME: Optional[Dict[str, Any]] = None


class PortfolioOptimizationError(Exception):
    def __init__(self, message: str, *, status_code: int = 400, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


class PortfolioOptimizationUnavailableError(PortfolioOptimizationError):
    def __init__(self, message: str):
        super().__init__(message, status_code=503, payload={"code": "optimization_unavailable"})


class PortfolioOptimizationDataError(PortfolioOptimizationError):
    def __init__(self, message: str, *, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=422, payload={"code": "insufficient_data", **(payload or {})})


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return float(default)
    if not math.isfinite(parsed):
        return float(default)
    return float(parsed)


def _normalize_method(method: Optional[str]) -> str:
    normalized = str(method or DEFAULT_METHOD).strip().lower()
    if normalized not in SUPPORTED_METHODS:
        raise PortfolioOptimizationError(
            f"Unsupported optimization method '{method}'.",
            payload={"supportedMethods": sorted(SUPPORTED_METHODS)},
        )
    return normalized


def _normalize_lookback_days(lookback_days: Any) -> int:
    if lookback_days in (None, ""):
        return DEFAULT_LOOKBACK_DAYS
    try:
        value = int(lookback_days)
    except (TypeError, ValueError) as exc:
        raise PortfolioOptimizationError("lookback_days must be an integer.") from exc
    return max(90, min(value, 756))


def _normalize_max_weight(max_weight: Any) -> float:
    if max_weight in (None, ""):
        return DEFAULT_MAX_WEIGHT
    try:
        value = float(max_weight)
    except (TypeError, ValueError) as exc:
        raise PortfolioOptimizationError("max_weight must be a decimal between 0 and 1.") from exc
    if value <= 0 or value > 1:
        raise PortfolioOptimizationError("max_weight must be greater than 0 and less than or equal to 1.")
    return float(value)


def _normalize_use_predictions(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


def _load_pyportfolioopt() -> Dict[str, Any]:
    global _PYPFOPT_RUNTIME
    if _PYPFOPT_RUNTIME is not None:
        return _PYPFOPT_RUNTIME
    try:
        module = import_module("pypfopt")
        _PYPFOPT_RUNTIME = {
            "black_litterman": import_module("pypfopt.black_litterman"),
            "expected_returns": import_module("pypfopt.expected_returns"),
            "risk_models": import_module("pypfopt.risk_models"),
            "EfficientFrontier": getattr(module, "EfficientFrontier"),
            "HRPOpt": getattr(module, "HRPOpt"),
        }
        return _PYPFOPT_RUNTIME
    except Exception as exc:  # pragma: no cover - exercised through unavailable error path
        raise PortfolioOptimizationUnavailableError(
            "Portfolio optimization dependencies are unavailable. Install PyPortfolioOpt to enable this feature."
        ) from exc


def _extract_investable_universe(portfolio: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, float]], List[Dict[str, Any]]]:
    positions = portfolio.get("positions") or {}
    option_positions = portfolio.get("options_positions") or {}
    eligible: Dict[str, Dict[str, float]] = {}
    excluded: List[Dict[str, Any]] = []

    for ticker, payload in positions.items():
        normalized = str(ticker or "").upper().strip()
        shares = _safe_float((payload or {}).get("shares"))
        avg_cost = _safe_float((payload or {}).get("avg_cost"))
        if shares <= 0:
            continue
        current_value = round(shares * avg_cost, 2)
        if ":" in normalized:
            excluded.append(
                {
                    "symbol": normalized,
                    "assetClass": "equity",
                    "reason": "Portfolio optimization v1 supports U.S. equities only.",
                    "currentValue": current_value,
                }
            )
            continue
        eligible[normalized] = {"shares": shares, "avg_cost": avg_cost}

    for contract_symbol, payload in option_positions.items():
        quantity = _safe_float((payload or {}).get("quantity"))
        avg_cost = _safe_float((payload or {}).get("avg_cost"))
        excluded.append(
            {
                "symbol": str(contract_symbol or ""),
                "assetClass": "option",
                "reason": "Option positions are excluded from portfolio optimization v1.",
                "currentValue": round(quantity * avg_cost * 100.0, 2),
            }
        )

    if len(eligible) < MIN_ELIGIBLE_HOLDINGS:
        raise PortfolioOptimizationDataError(
            "Add at least two U.S. stock holdings to generate a rebalance plan.",
            payload={"eligibleHoldings": len(eligible)},
        )

    return eligible, excluded


def _history_period_for_lookback(lookback_days: int) -> str:
    calendar_days = max(int(math.ceil(lookback_days * 1.7)), lookback_days + 45, 180)
    return f"{calendar_days}d"


def _load_market_inputs(
    tickers: List[str],
    lookback_days: int,
) -> Tuple[pd.DataFrame, Dict[str, Dict[str, Any]], List[str]]:
    price_series: Dict[str, pd.Series] = {}
    metadata: Dict[str, Dict[str, Any]] = {}
    warnings: List[str] = []
    period = _history_period_for_lookback(lookback_days)

    for ticker in tickers:
        ticker_client = yf.Ticker(ticker)
        history = ticker_client.history(period=period, interval="1d", auto_adjust=True)
        closes = pd.Series(dtype=float)
        if isinstance(history, pd.DataFrame) and not history.empty and "Close" in history:
            closes = history["Close"].dropna()
        if closes.empty or len(closes) < MIN_HISTORY_ROWS:
            warnings.append(f"{ticker}: insufficient daily close history for optimization.")
            continue

        info = getattr(ticker_client, "info", {}) or {}
        price_series[ticker] = closes.tail(lookback_days)
        metadata[ticker] = {
            "companyName": info.get("longName") or ticker,
            "marketCap": _safe_float(info.get("marketCap"), default=float("nan")),
            "currency": info.get("currency") or "USD",
            "exchange": info.get("exchange") or "XNYS",
        }

    if len(price_series) < MIN_ELIGIBLE_HOLDINGS:
        raise PortfolioOptimizationDataError(
            "Not enough holdings have sufficient price history to run optimization.",
            payload={"eligibleHoldings": len(price_series), "warnings": warnings},
        )

    prices = pd.concat(price_series, axis=1).dropna(how="any")
    if prices.shape[0] < MIN_HISTORY_ROWS:
        raise PortfolioOptimizationDataError(
            "Aligned price history is too sparse to compute stable portfolio recommendations.",
            payload={"historyRows": int(prices.shape[0]), "warnings": warnings},
        )

    latest_prices = prices.iloc[-1]
    for ticker in list(metadata.keys()):
        metadata[ticker]["latestPrice"] = round(_safe_float(latest_prices.get(ticker)), 4)

    return prices.tail(lookback_days), metadata, warnings


def _build_prediction_views(
    tickers: List[str],
    *,
    use_predictions: bool,
) -> Tuple[Dict[str, float], List[float], List[Dict[str, Any]], List[str]]:
    if not use_predictions:
        return {}, [], [], []

    views: Dict[str, float] = {}
    confidences: List[float] = []
    used_views: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for ticker in tickers:
        snapshot = prediction_service.get_prediction_snapshot(ticker)
        if not snapshot:
            warnings.append(f"{ticker}: no MarketMind prediction view was available.")
            continue
        recent_close = _safe_float(snapshot.get("recentClose"))
        recent_predicted = _safe_float(snapshot.get("recentPredicted"))
        confidence = _safe_float(snapshot.get("confidence"))
        if recent_close <= 0 or recent_predicted <= 0:
            warnings.append(f"{ticker}: prediction snapshot was incomplete and was skipped.")
            continue
        if confidence < MIN_PREDICTION_CONFIDENCE:
            warnings.append(f"{ticker}: prediction confidence was below the view threshold and was skipped.")
            continue
        preview_horizon = max(len(snapshot.get("predictions") or []), 1)
        projected_return = (recent_predicted - recent_close) / recent_close
        annualized_return = max(-0.75, min(0.75, projected_return * (TRADING_DAYS_PER_YEAR / preview_horizon)))
        if abs(annualized_return) < 0.005:
            warnings.append(f"{ticker}: prediction view was too small to materially affect the optimizer.")
            continue
        view_confidence = max(0.05, min(0.95, (confidence - 55.0) / 40.0))
        views[ticker] = annualized_return
        confidences.append(view_confidence)
        used_views.append(
            {
                "ticker": ticker,
                "projectedReturn": round(annualized_return, 4),
                "confidence": round(view_confidence, 4),
            }
        )

    return views, confidences, used_views, warnings


def _build_prior_returns(
    cov_matrix: pd.DataFrame,
    tickers: List[str],
    metadata: Dict[str, Dict[str, Any]],
    *,
    risk_aversion: float,
) -> Tuple[pd.Series, str]:
    black_litterman = _load_pyportfolioopt()["black_litterman"]
    market_caps = pd.Series(
        {ticker: _safe_float((metadata.get(ticker) or {}).get("marketCap"), default=float("nan")) for ticker in tickers},
        index=tickers,
        dtype=float,
    )
    if market_caps.notna().all() and (market_caps > 0).all():
        prior = black_litterman.market_implied_prior_returns(market_caps, risk_aversion, cov_matrix)
        return prior.reindex(tickers).fillna(0.0), "market_cap_implied"

    equal_weights = pd.Series(1.0 / len(tickers), index=tickers)
    prior = risk_aversion * cov_matrix.dot(equal_weights)
    prior = pd.Series(prior, index=tickers, dtype=float)
    return prior.fillna(0.0), "equal_weight_fallback"


def _build_black_litterman_returns(
    cov_matrix: pd.DataFrame,
    tickers: List[str],
    metadata: Dict[str, Dict[str, Any]],
    *,
    use_predictions: bool,
    risk_aversion: float,
) -> Tuple[pd.Series, Dict[str, Any]]:
    black_litterman = _load_pyportfolioopt()["black_litterman"]
    prior_returns, prior_source = _build_prior_returns(cov_matrix, tickers, metadata, risk_aversion=risk_aversion)
    views, confidences, used_views, view_warnings = _build_prediction_views(tickers, use_predictions=use_predictions)
    if not views:
        return prior_returns, {
            "priorSource": prior_source,
            "predictionViewsUsed": [],
            "warnings": view_warnings,
            "returnModel": "market_implied_prior",
        }

    model = black_litterman.BlackLittermanModel(
        cov_matrix,
        pi=prior_returns,
        absolute_views=views,
        omega="idzorek",
        view_confidences=confidences,
    )
    posterior = pd.Series(model.bl_returns(), index=tickers, dtype=float).reindex(tickers).fillna(0.0)
    return posterior, {
        "priorSource": prior_source,
        "predictionViewsUsed": used_views,
        "warnings": view_warnings,
        "returnModel": "market_implied_prior_with_optional_prediction_views",
    }


def _build_historical_returns(
    prices: pd.DataFrame,
    tickers: List[str],
    *,
    use_predictions: bool,
) -> Tuple[pd.Series, Dict[str, Any]]:
    expected_returns = _load_pyportfolioopt()["expected_returns"]
    base = pd.Series(
        expected_returns.mean_historical_return(prices, frequency=TRADING_DAYS_PER_YEAR),
        index=tickers,
        dtype=float,
    ).reindex(tickers).fillna(0.0)
    views, confidences, used_views, warnings = _build_prediction_views(tickers, use_predictions=use_predictions)
    if not views:
        return base, {
            "predictionViewsUsed": [],
            "warnings": warnings,
            "returnModel": "historical_mean",
        }

    adjusted = base.copy()
    for idx, ticker in enumerate(views.keys()):
        confidence = confidences[idx]
        adjusted.loc[ticker] = (1.0 - confidence) * adjusted.loc[ticker] + (confidence * views[ticker])
    return adjusted, {
        "predictionViewsUsed": used_views,
        "warnings": warnings,
        "returnModel": "historical_mean_with_prediction_tilt",
    }


def _optimize_weights(
    method: str,
    prices: pd.DataFrame,
    covariance_matrix: pd.DataFrame,
    expected_returns_series: pd.Series,
    *,
    risk_free_rate: float,
) -> Dict[str, float]:
    runtime = _load_pyportfolioopt()
    tickers = list(prices.columns)
    if method == "hrp":
        returns = prices.pct_change().dropna(how="any")
        optimizer = runtime["HRPOpt"](returns=returns)
        optimized = optimizer.optimize()
        return {ticker: _safe_float(optimized.get(ticker)) for ticker in tickers}

    frontier = runtime["EfficientFrontier"](
        expected_returns_series.reindex(tickers).fillna(0.0),
        covariance_matrix.reindex(index=tickers, columns=tickers).fillna(0.0),
        weight_bounds=(0.0, 1.0),
    )
    if method == "min_vol":
        frontier.min_volatility()
    else:
        frontier.max_sharpe(risk_free_rate=risk_free_rate)
    cleaned = frontier.clean_weights(cutoff=1e-5, rounding=8)
    return {ticker: _safe_float(cleaned.get(ticker)) for ticker in tickers}


def _apply_weight_cap(
    raw_weights: Dict[str, float],
    *,
    max_weight: float,
) -> Tuple[pd.Series, float, bool]:
    weights = pd.Series(raw_weights, dtype=float).fillna(0.0).clip(lower=0.0)
    total = float(weights.sum())
    if total <= 0:
        raise PortfolioOptimizationDataError("Optimizer returned empty weights for the current portfolio.")
    weights = weights / total

    capped = weights.clip(upper=max_weight)
    remaining_capacity = (max_weight - capped).clip(lower=0.0)
    excess = float(1.0 - capped.sum())
    if excess > 1e-8 and remaining_capacity.sum() > 1e-8:
        redistribution = (remaining_capacity / remaining_capacity.sum()) * min(excess, float(remaining_capacity.sum()))
        capped = capped.add(redistribution, fill_value=0.0)

    residual_cash_weight = max(0.0, 1.0 - float(capped.sum()))
    return capped.round(6), round(residual_cash_weight, 6), bool((weights > max_weight + 1e-8).any())


def _portfolio_metrics(
    weights: pd.Series,
    expected_returns_series: pd.Series,
    covariance_matrix: pd.DataFrame,
    *,
    cash_weight: float,
    risk_free_rate: float,
) -> Dict[str, float]:
    aligned_weights = weights.reindex(expected_returns_series.index).fillna(0.0)
    expected_return = float(np.dot(aligned_weights.values, expected_returns_series.values)) + (cash_weight * risk_free_rate)
    variance = float(aligned_weights.values @ covariance_matrix.values @ aligned_weights.values.T)
    volatility = math.sqrt(max(variance, 0.0))
    sharpe = ((expected_return - risk_free_rate) / volatility) if volatility > 0 else 0.0
    return {
        "expectedAnnualReturn": round(expected_return, 4),
        "annualVolatility": round(volatility, 4),
        "sharpeRatio": round(sharpe, 4),
    }


def _rebalance_action(delta_value: float, latest_price: float, investable_value: float) -> str:
    threshold = max(25.0, latest_price * 0.5, investable_value * 0.0025)
    if delta_value > threshold:
        return "buy"
    if delta_value < -threshold:
        return "trim"
    return "hold"


def optimize_paper_portfolio(
    portfolio: Dict[str, Any],
    *,
    method: Optional[str] = None,
    use_predictions: Any = True,
    lookback_days: Any = None,
    max_weight: Any = None,
) -> Dict[str, Any]:
    normalized_method = _normalize_method(method)
    normalized_lookback = _normalize_lookback_days(lookback_days)
    normalized_max_weight = _normalize_max_weight(max_weight)
    predictions_enabled = _normalize_use_predictions(use_predictions)
    risk_free_rate = DEFAULT_RISK_FREE_RATE
    risk_aversion = DEFAULT_RISK_AVERSION

    eligible_positions, excluded_holdings = _extract_investable_universe(portfolio)
    tickers = sorted(eligible_positions.keys())
    prices, metadata, warnings = _load_market_inputs(tickers, normalized_lookback)
    tickers = list(prices.columns)
    eligible_positions = {ticker: eligible_positions[ticker] for ticker in tickers}

    runtime = _load_pyportfolioopt()
    covariance_matrix = runtime["risk_models"].CovarianceShrinkage(prices).ledoit_wolf()

    if normalized_method == "black_litterman":
        expected_returns_series, return_info = _build_black_litterman_returns(
            covariance_matrix,
            tickers,
            metadata,
            use_predictions=predictions_enabled,
            risk_aversion=risk_aversion,
        )
    else:
        expected_returns_series, return_info = _build_historical_returns(
            prices,
            tickers,
            use_predictions=predictions_enabled,
        )

    warnings.extend(return_info.get("warnings") or [])

    raw_weights = _optimize_weights(
        normalized_method,
        prices,
        covariance_matrix,
        expected_returns_series,
        risk_free_rate=risk_free_rate,
    )
    capped_weights, cash_target_weight, was_capped = _apply_weight_cap(raw_weights, max_weight=normalized_max_weight)
    if was_capped:
        warnings.append(
            f"One or more target weights were capped at {normalized_max_weight:.0%}; leftover capital remains in cash."
        )
    if cash_target_weight > 0:
        warnings.append(
            f"{cash_target_weight:.1%} of the portfolio remains in cash under the current guardrails."
        )

    current_cash = round(_safe_float(portfolio.get("cash")), 2)
    investable_value = current_cash
    current_allocations: List[Dict[str, Any]] = []
    recommended_allocations: List[Dict[str, Any]] = []
    rebalance_actions: List[Dict[str, Any]] = []

    for ticker in tickers:
        position = eligible_positions[ticker]
        latest_price = _safe_float((metadata.get(ticker) or {}).get("latestPrice"))
        current_value = round(position["shares"] * latest_price, 2)
        investable_value += current_value
        current_allocations.append(
            {
                "ticker": ticker,
                "companyName": metadata[ticker].get("companyName") or ticker,
                "shares": round(position["shares"], 4),
                "currentPrice": round(latest_price, 2),
                "currentValue": current_value,
            }
        )

    if investable_value <= 0:
        raise PortfolioOptimizationDataError("Paper portfolio value is empty. Add cash or stock holdings first.")

    for allocation in current_allocations:
        allocation["currentWeight"] = round(allocation["currentValue"] / investable_value, 4)

    for allocation in current_allocations:
        ticker = allocation["ticker"]
        target_weight = round(_safe_float(capped_weights.get(ticker)), 6)
        target_value = round(investable_value * target_weight, 2)
        delta_value = round(target_value - allocation["currentValue"], 2)
        current_price = allocation["currentPrice"] or 0.0
        shares_delta = round(delta_value / current_price, 4) if current_price > 0 else 0.0
        action = _rebalance_action(delta_value, current_price, investable_value)

        recommended = {
            "ticker": ticker,
            "companyName": allocation["companyName"],
            "currentWeight": allocation["currentWeight"],
            "targetWeight": round(target_weight, 4),
            "currentValue": allocation["currentValue"],
            "targetValue": target_value,
            "deltaValue": delta_value,
            "estimatedSharesDelta": shares_delta,
            "currentPrice": current_price,
        }
        recommended_allocations.append(recommended)
        rebalance_actions.append(
            {
                "ticker": ticker,
                "action": action,
                "currentWeight": allocation["currentWeight"],
                "targetWeight": round(target_weight, 4),
                "deltaValue": delta_value,
                "estimatedSharesDelta": shares_delta,
            }
        )

    current_allocations.sort(key=lambda item: item["currentValue"], reverse=True)
    recommended_allocations.sort(key=lambda item: item["targetWeight"], reverse=True)
    rebalance_actions.sort(key=lambda item: (item["action"] == "hold", -abs(item["deltaValue"])))

    cash_target_value = round(investable_value * cash_target_weight, 2)
    cash_position = {
        "currentValue": current_cash,
        "currentWeight": round(current_cash / investable_value, 4),
        "targetValue": cash_target_value,
        "targetWeight": round(cash_target_weight, 4),
        "deltaValue": round(cash_target_value - current_cash, 2),
    }

    metrics = _portfolio_metrics(
        capped_weights,
        expected_returns_series.reindex(tickers).fillna(0.0),
        covariance_matrix.reindex(index=tickers, columns=tickers).fillna(0.0),
        cash_weight=cash_target_weight,
        risk_free_rate=risk_free_rate,
    )

    assumptions = {
        "lookbackDays": normalized_lookback,
        "riskFreeRate": round(risk_free_rate, 4),
        "riskAversion": round(risk_aversion, 4),
        "covarianceModel": "ledoit_wolf",
        "maxWeight": round(normalized_max_weight, 4),
        "usePredictions": predictions_enabled,
        "returnModel": return_info.get("returnModel"),
        "priorSource": return_info.get("priorSource"),
        "predictionViewsUsed": return_info.get("predictionViewsUsed") or [],
    }

    return {
        "asOf": datetime.now(timezone.utc).isoformat(),
        "method": normalized_method,
        "universe": {
            "market": "US",
            "assetType": "equity",
            "tickers": tickers,
            "eligibleHoldings": len(tickers),
            "currency": "USD",
        },
        "investableValue": round(investable_value, 2),
        "cashPosition": cash_position,
        "excludedHoldings": excluded_holdings,
        "currentAllocations": current_allocations,
        "recommendedAllocations": recommended_allocations,
        "rebalanceActions": rebalance_actions,
        "portfolioMetrics": metrics,
        "assumptions": assumptions,
        "warnings": warnings,
    }
