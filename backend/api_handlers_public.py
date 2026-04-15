from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Dict

from flask import g
from werkzeug.datastructures import MultiDict

from api_public import (
    PublicApiError,
    get_cached_public_response,
    set_cached_public_response,
    unwrap_handler_result,
)


def _normalize_news_articles(raw_articles):
    normalized = []
    for item in raw_articles or []:
        normalized.append(
            {
                "title": item.get("title") or item.get("headline"),
                "publisher": item.get("publisher") or item.get("source") or "N/A",
                "url": item.get("link") or item.get("url"),
                "published_at": item.get("publishTime") or item.get("publishedAt") or item.get("datetime"),
                "thumbnail_url": item.get("thumbnail_url") or item.get("urlToImage") or item.get("image"),
                "summary": item.get("summary"),
            }
        )
    return normalized


def _strip_internal_sentiment_fields(value):
    blocked_keys = {
        "sentiment",
        "sentimentSummary",
        "announcementsSentimentSummary",
        "filingSentimentSummary",
        "currentSentiment",
        "previousSentiment",
    }
    if isinstance(value, dict):
        return {
            key: _strip_internal_sentiment_fields(item)
            for key, item in value.items()
            if key not in blocked_keys
        }
    if isinstance(value, list):
        return [_strip_internal_sentiment_fields(item) for item in value]
    return value


def _normalize_public_market(value: Any, *, default: str = "US") -> str:
    candidate = str(value or "").strip().upper()
    return candidate if candidate in {"US", "HK", "CN"} else default


def _normalize_public_search_match(item):
    raw_item = dict(item or {})
    market = _normalize_public_market(raw_item.get("market"))
    symbol = str(raw_item.get("symbol") or "").strip().upper()
    if not symbol:
        symbol = str(raw_item.get("assetId") or "").split(":", 1)[-1].strip().upper()
    exchange = raw_item.get("exchange") or ("HKEX" if market == "HK" else "CN" if market == "CN" else "US")
    display_name = raw_item.get("displayName") or raw_item.get("name") or symbol
    asset_id = raw_item.get("assetId") or f"{market}:{symbol}"
    return {
        "symbol": symbol,
        "displayName": display_name,
        "market": market,
        "exchange": exchange,
        "assetId": asset_id,
    }


def _public_asset_identity(*, ticker: str, request_obj, resolve_asset_fn):
    market = request_obj.args.get("market")
    return resolve_asset_fn(ticker, market)


def _cached_json_payload(*, cache_backend, cache_key: str, cache_ttl_seconds: int, producer_fn):
    cached = get_cached_public_response(cache_backend, cache_key)
    if cached is not None:
        g.public_api_cache_status = "HIT"
        return cached["payload"], int(cached["status_code"])

    payload, status_code = producer_fn()
    g.public_api_cache_status = "MISS"
    if int(status_code) == 200:
        set_cached_public_response(cache_backend, cache_key, payload, status_code, cache_ttl_seconds)
    return payload, int(status_code)


def health_handler(*, version: str = "v1"):
    g.public_api_cache_status = "BYPASS"
    return {
        "status": "ok",
        "api": "marketmind-public",
        "version": version,
        "beta": True,
    }, 200


def stock_handler(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_stock_data_handler_fn,
    alpha_vantage_api_key,
    yf_module,
    requests_module,
    logger,
    clean_value_fn,
    resolve_asset_fn,
    akshare_service_module,
    exchange_session_service_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_stock_data_handler_fn(
                ticker,
                request_obj=request_obj,
                alpha_vantage_api_key=alpha_vantage_api_key,
                yf_module=yf_module,
                requests_module=requests_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
                resolve_asset_fn=resolve_asset_fn,
                akshare_service_module=akshare_service_module,
                exchange_session_service_module=exchange_session_service_module,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Stock data is temporarily unavailable.")
        return (
            {
                "symbol": raw_payload.get("symbol"),
                "company_name": raw_payload.get("companyName"),
                "price": raw_payload.get("price"),
                "change": raw_payload.get("change"),
                "change_percent": raw_payload.get("changePercent"),
                "market_cap": raw_payload.get("marketCap"),
                "sparkline": raw_payload.get("sparkline") or [],
            },
            200,
        )

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def stock_handler_v2(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_stock_data_handler_fn,
    alpha_vantage_api_key,
    yf_module,
    requests_module,
    logger,
    clean_value_fn,
    resolve_asset_fn,
    akshare_service_module,
    exchange_session_service_module,
):
    def producer():
        asset = _public_asset_identity(ticker=ticker, request_obj=request_obj, resolve_asset_fn=resolve_asset_fn)
        raw_payload, status_code = unwrap_handler_result(
            get_stock_data_handler_fn(
                ticker,
                request_obj=request_obj,
                alpha_vantage_api_key=alpha_vantage_api_key,
                yf_module=yf_module,
                requests_module=requests_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
                resolve_asset_fn=resolve_asset_fn,
                akshare_service_module=akshare_service_module,
                exchange_session_service_module=exchange_session_service_module,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Stock data is temporarily unavailable.")

        payload = {
            "symbol": raw_payload.get("symbol") or asset["symbol"],
            "assetId": raw_payload.get("assetId") or asset["assetId"],
            "market": raw_payload.get("market") or asset["market"],
            "exchange": raw_payload.get("exchange") or asset["exchange"],
            "currency": raw_payload.get("currency"),
            "company_name": raw_payload.get("companyName"),
            "price": raw_payload.get("price"),
            "change": raw_payload.get("change"),
            "change_percent": raw_payload.get("changePercent"),
            "market_cap": raw_payload.get("marketCap"),
            "sparkline": raw_payload.get("sparkline") or [],
        }
        if "readOnlyResearchOnly" in (raw_payload or {}):
            payload["readOnlyResearchOnly"] = bool(raw_payload.get("readOnlyResearchOnly"))
        return payload, 200

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def chart_handler(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_chart_data_handler_fn,
    yf_module,
    logger,
    clean_value_fn,
    resolve_asset_fn,
    akshare_service_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_chart_data_handler_fn(
                ticker,
                request_obj=request_obj,
                yf_module=yf_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
                chart_prediction_points_fn=lambda _ticker: [],
                resolve_asset_fn=resolve_asset_fn,
                akshare_service_module=akshare_service_module,
            )
        )
        if status_code == 400:
            raise PublicApiError(400, "invalid_query", "Unsupported chart period.")
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Chart data is temporarily unavailable.")
        return (
            {
                "symbol": ticker.split(":")[0].upper(),
                "period": request_obj.args.get("period", "6mo"),
                "candles": list(raw_payload or []),
            },
            200,
        )

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def chart_handler_v2(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_chart_data_handler_fn,
    yf_module,
    logger,
    clean_value_fn,
    resolve_asset_fn,
    akshare_service_module,
):
    def producer():
        asset = _public_asset_identity(ticker=ticker, request_obj=request_obj, resolve_asset_fn=resolve_asset_fn)
        raw_payload, status_code = unwrap_handler_result(
            get_chart_data_handler_fn(
                ticker,
                request_obj=request_obj,
                yf_module=yf_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
                chart_prediction_points_fn=lambda _ticker: [],
                resolve_asset_fn=resolve_asset_fn,
                akshare_service_module=akshare_service_module,
            )
        )
        if status_code == 400:
            raise PublicApiError(400, "invalid_query", "Unsupported chart period.")
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Chart data is temporarily unavailable.")
        return (
            {
                "symbol": asset["symbol"],
                "assetId": asset["assetId"],
                "market": asset["market"],
                "exchange": asset["exchange"],
                "period": request_obj.args.get("period", "6mo"),
                "candles": list(raw_payload or []),
            },
            200,
        )

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def news_handler(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_query_news_handler_fn,
    get_general_news_fn,
    news_api_key,
    requests_module,
):
    def producer():
        query = str(request_obj.args.get("q", "")).strip()
        if query:
            raw_payload, status_code = unwrap_handler_result(
                get_query_news_handler_fn(
                    request_obj=request_obj,
                    news_api_key=news_api_key,
                    requests_module=requests_module,
                    jsonify_fn=lambda payload: payload,
                )
            )
            if status_code == 400:
                raise PublicApiError(400, "invalid_query", "A non-empty 'q' query is required.")
            if status_code >= 500:
                raise PublicApiError(503, "upstream_unavailable", "News data is temporarily unavailable.")
            articles = raw_payload or []
        else:
            articles = get_general_news_fn() or []
        return (
            {
                "query": query or None,
                "articles": _normalize_news_articles(articles),
            },
            200,
        )

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def search_symbols_handler(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    search_symbols_handler_fn,
    get_symbol_suggestions_fn,
    search_international_symbols_fn,
    logger,
):
    def producer():
        query = str(request_obj.args.get("q", "")).strip()
        if not query:
            raise PublicApiError(400, "invalid_query", "A non-empty 'q' query is required.")
        raw_payload, status_code = unwrap_handler_result(
            search_symbols_handler_fn(
                request_obj=request_obj,
                get_symbol_suggestions_fn=get_symbol_suggestions_fn,
                search_international_symbols_fn=search_international_symbols_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Symbol search is temporarily unavailable.")
        return ({"query": query, "matches": list(raw_payload or [])}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def search_symbols_handler_v2(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    search_symbols_handler_fn,
    get_symbol_suggestions_fn,
    search_international_symbols_fn,
    logger,
):
    def producer():
        query = str(request_obj.args.get("q", "")).strip()
        market = str(request_obj.args.get("market", "us")).strip().lower() or "us"
        if not query:
            raise PublicApiError(400, "invalid_query", "A non-empty 'q' query is required.")
        raw_payload, status_code = unwrap_handler_result(
            search_symbols_handler_fn(
                request_obj=request_obj,
                get_symbol_suggestions_fn=get_symbol_suggestions_fn,
                search_international_symbols_fn=search_international_symbols_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Symbol search is temporarily unavailable.")
        matches = [_normalize_public_search_match(item) for item in (raw_payload or [])]
        return ({"query": query, "market": market, "matches": matches}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def ensemble_prediction_handler(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    predict_ensemble_handler_fn,
    future_prediction_dates_fn,
    yf_module,
    live_ensemble_signal_components_fn,
    logger,
    pd_module,
    np_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            predict_ensemble_handler_fn(
                ticker,
                request_obj=request_obj,
                future_prediction_dates_fn=future_prediction_dates_fn,
                yf_module=yf_module,
                live_ensemble_signal_components_fn=live_ensemble_signal_components_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                pd_module=pd_module,
                np_module=np_module,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code == 400:
            raise PublicApiError(400, "invalid_query", "Prediction query parameters are invalid.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Ensemble predictions are temporarily unavailable.")
        return (
            {
                "symbol": raw_payload.get("symbol"),
                "company_name": raw_payload.get("companyName"),
                "recent_date": raw_payload.get("recentDate"),
                "recent_close": raw_payload.get("recentClose"),
                "recent_predicted": raw_payload.get("recentPredicted"),
                "predictions": raw_payload.get("predictions") or [],
                "models_used": raw_payload.get("modelsUsed") or [],
                "ensemble_method": raw_payload.get("ensembleMethod"),
                "confidence": raw_payload.get("confidence"),
            },
            200,
        )

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def _public_request_subset(request_obj, *, allowed_args):
    filtered = {}
    for key in allowed_args:
        value = request_obj.args.get(key)
        if value is not None:
            filtered[key] = value
    return SimpleNamespace(args=MultiDict(filtered))


def evaluation_summary_handler(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    evaluate_models_handler_fn,
    rolling_window_backtest_fn,
    logger,
):
    def producer():
        safe_request = _public_request_subset(request_obj, allowed_args=("test_days", "fast_mode"))
        raw_payload, status_code = unwrap_handler_result(
            evaluate_models_handler_fn(
                ticker,
                request_obj=safe_request,
                rolling_window_backtest_fn=rolling_window_backtest_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "not_found", f"Evaluation summary is unavailable for ticker '{ticker}'.")
        if status_code == 400:
            raise PublicApiError(400, "invalid_query", "Evaluation query parameters are invalid.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Evaluation summary is temporarily unavailable.")

        test_period = raw_payload.get("test_period") or {}
        models = {}
        for model_name, model_payload in (raw_payload.get("models") or {}).items():
            models[model_name] = {
                "metrics": dict((model_payload or {}).get("metrics") or {}),
            }

        fast_mode_raw = str(safe_request.args.get("fast_mode", "true")).strip().lower()
        fast_mode = fast_mode_raw in {"1", "true", "yes", "on"}
        test_days = safe_request.args.get("test_days", default=60, type=int)

        return (
            {
                "symbol": raw_payload.get("ticker") or ticker.split(":")[0].upper(),
                "featureSpecVersion": raw_payload.get("featureSpecVersion"),
                "testPeriod": {
                    "startDate": test_period.get("start_date"),
                    "endDate": test_period.get("end_date"),
                    "days": test_period.get("days"),
                },
                "bestModel": raw_payload.get("best_model"),
                "models": models,
                "returns": dict(raw_payload.get("returns") or {}),
                "evaluationOptions": {
                    "testDays": test_days,
                    "fastMode": fast_mode,
                },
            },
            200,
        )

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def screener_presets_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_screener_presets_handler_fn,
    base_dir,
    yf_module,
    logger,
    screener_query_service_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_screener_presets_handler_fn(
                base_dir=base_dir,
                yf_module=yf_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                screener_query_service_module=screener_query_service_module,
            )
        )
        if status_code == 400:
            raise PublicApiError(400, "invalid_query", "Screener preset query parameters are invalid.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Screener presets are temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def screener_scan_public_handler(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_screener_scan_handler_fn,
    base_dir,
    yf_module,
    logger,
    screener_query_service_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_screener_scan_handler_fn(
                base_dir=base_dir,
                yf_module=yf_module,
                request_obj=request_obj,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                screener_query_service_module=screener_query_service_module,
            )
        )
        if status_code == 400:
            raise PublicApiError(400, "invalid_query", "Screener scan query parameters are invalid.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Screener scan is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def fundamentals_handler(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_fundamentals_handler_fn,
    alpha_vantage_api_key,
    requests_module,
    logger,
    clean_value_fn,
    fundamentals_from_yfinance_fn,
    resolve_asset_fn,
    akshare_service_module,
    exchange_session_service_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_fundamentals_handler_fn(
                ticker,
                request_obj=request_obj,
                alpha_vantage_api_key=alpha_vantage_api_key,
                requests_module=requests_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
                fundamentals_from_yfinance_fn=fundamentals_from_yfinance_fn,
                resolve_asset_fn=resolve_asset_fn,
                akshare_service_module=akshare_service_module,
                exchange_session_service_module=exchange_session_service_module,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Fundamental data is temporarily unavailable.")
        payload = _strip_internal_sentiment_fields(dict(raw_payload or {}))
        payload.pop("marketSession", None)
        return (payload, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def fundamentals_handler_v2(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_fundamentals_handler_fn,
    alpha_vantage_api_key,
    requests_module,
    logger,
    clean_value_fn,
    fundamentals_from_yfinance_fn,
    resolve_asset_fn,
    akshare_service_module,
    exchange_session_service_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_fundamentals_handler_fn(
                ticker,
                request_obj=request_obj,
                alpha_vantage_api_key=alpha_vantage_api_key,
                requests_module=requests_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
                fundamentals_from_yfinance_fn=fundamentals_from_yfinance_fn,
                resolve_asset_fn=resolve_asset_fn,
                akshare_service_module=akshare_service_module,
                exchange_session_service_module=exchange_session_service_module,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Fundamental data is temporarily unavailable.")
        payload = _strip_internal_sentiment_fields(dict(raw_payload or {}))
        payload.pop("marketSession", None)
        return (payload, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def macro_overview_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_macro_overview_handler_fn,
    openbb_available,
    obb_module,
    logger,
    yf_module,
    macro_indicators,
    requests_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_macro_overview_handler_fn(
                openbb_available=openbb_available,
                obb_module=obb_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                yf_module=yf_module,
                macro_indicators=macro_indicators,
                requests_module=requests_module,
            )
        )
        if status_code == 503:
            raise PublicApiError(503, "upstream_unavailable", "Macro data is temporarily unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Macro data is temporarily unavailable.")
        indicators = []
        for item in raw_payload or []:
            indicators.append(
                {
                    "symbol": item.get("symbol"),
                    "name": item.get("name"),
                    "unit": item.get("unit"),
                    "value": item.get("value"),
                    "previous_value": item.get("prev"),
                    "date": item.get("date"),
                    "sparkline": item.get("sparkline") or [],
                }
            )
        return ({"indicators": indicators}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def macro_overview_handler_v2(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_macro_overview_handler_fn,
    openbb_available,
    obb_module,
    logger,
    yf_module,
    macro_indicators,
    requests_module,
    akshare_service_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_macro_overview_handler_fn(
                openbb_available=openbb_available,
                obb_module=obb_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                yf_module=yf_module,
                macro_indicators=macro_indicators,
                requests_module=requests_module,
                request_obj=request_obj,
                akshare_service_module=akshare_service_module,
            )
        )
        if status_code == 503:
            raise PublicApiError(503, "upstream_unavailable", "Macro data is temporarily unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Macro data is temporarily unavailable.")

        region = "us"
        source = None
        source_note = None
        market_signals = []
        indicator_source = raw_payload or []
        if isinstance(raw_payload, dict):
            region = str(raw_payload.get("region") or "us").strip().lower() or "us"
            source = raw_payload.get("source")
            source_note = raw_payload.get("sourceNote")
            market_signals = list(raw_payload.get("marketSignals") or [])
            indicator_source = raw_payload.get("indicators") or []

        indicators = []
        for item in indicator_source:
            normalized = {
                "symbol": item.get("symbol"),
                "name": item.get("name"),
                "unit": item.get("unit"),
                "value": item.get("value"),
                "previous_value": item.get("prev"),
                "date": item.get("date"),
                "sparkline": item.get("sparkline") or [],
            }
            if item.get("market"):
                normalized["market"] = item.get("market")
            if item.get("description"):
                normalized["description"] = item.get("description")
            indicators.append(normalized)

        payload = {"region": region, "indicators": indicators}
        if market_signals:
            payload["marketSignals"] = market_signals
        if source:
            payload["source"] = source
        if source_note:
            payload["sourceNote"] = source_note
        return payload, 200

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def options_stock_price_handler(
    ticker,
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_options_stock_price_handler_fn,
    yf_module,
    clean_value_fn,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_options_stock_price_handler_fn(
                ticker,
                yf_module=yf_module,
                jsonify_fn=lambda payload: payload,
                clean_value_fn=clean_value_fn,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Options stock price is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def option_expirations_handler(
    ticker,
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_option_expirations_handler_fn,
    yf_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_option_expirations_handler_fn(
                ticker,
                yf_module=yf_module,
                jsonify_fn=lambda payload: payload,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "not_found", f"No option expirations found for '{ticker}'.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Option expirations are temporarily unavailable.")
        return ({"ticker": ticker.split(":")[0].upper(), "expirations": list(raw_payload or [])}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def option_chain_handler(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_option_chain_handler_fn,
    yf_module,
    math_module,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_option_chain_handler_fn(
                ticker,
                request_obj=request_obj,
                yf_module=yf_module,
                jsonify_fn=lambda payload: payload,
                math_module=math_module,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Option chain data is temporarily unavailable.")
        return (
            {
                "ticker": ticker.split(":")[0].upper(),
                "expiration": request_obj.args.get("date"),
                "stock_price": raw_payload.get("stock_price"),
                "calls": raw_payload.get("calls") or [],
                "puts": raw_payload.get("puts") or [],
            },
            200,
        )

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def option_suggestion_handler(
    ticker,
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_option_suggestion_handler_fn,
    generate_suggestion_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_option_suggestion_handler_fn(
                ticker,
                generate_suggestion_fn=generate_suggestion_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "not_found", f"No option suggestion found for '{ticker}'.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Option suggestion is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def forex_convert_public_handler(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    forex_convert_handler_fn,
    get_exchange_rate_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            forex_convert_handler_fn(
                request_obj=request_obj,
                get_exchange_rate_fn=get_exchange_rate_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "not_found", "Exchange rate not found.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Forex conversion is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def forex_currencies_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    forex_currencies_handler_fn,
    get_currency_list_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            forex_currencies_handler_fn(
                get_currency_list_fn=get_currency_list_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Forex currency list is temporarily unavailable.")
        return ({"currencies": raw_payload}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def crypto_convert_public_handler(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    crypto_convert_handler_fn,
    get_crypto_exchange_rate_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            crypto_convert_handler_fn(
                request_obj=request_obj,
                get_crypto_exchange_rate_fn=get_crypto_exchange_rate_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "not_found", "Crypto exchange rate not found.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Crypto conversion is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def crypto_list_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    crypto_list_handler_fn,
    get_crypto_list_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            crypto_list_handler_fn(
                get_crypto_list_fn=get_crypto_list_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Crypto list is temporarily unavailable.")
        return ({"assets": raw_payload}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def crypto_currencies_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    crypto_target_currencies_handler_fn,
    get_target_currencies_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            crypto_target_currencies_handler_fn(
                get_target_currencies_fn=get_target_currencies_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Crypto target currencies are temporarily unavailable.")
        return ({"currencies": raw_payload}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def commodity_price_public_handler(
    commodity,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    commodity_price_handler_fn,
    get_commodity_price_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            commodity_price_handler_fn(
                commodity,
                request_obj=request_obj,
                get_commodity_price_fn=get_commodity_price_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "not_found", f"Commodity '{commodity}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Commodity price is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def commodities_list_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    commodities_list_handler_fn,
    get_commodity_list_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            commodities_list_handler_fn(
                get_commodity_list_fn=get_commodity_list_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Commodity list is temporarily unavailable.")
        return ({"commodities": raw_payload}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def commodities_all_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    commodities_all_handler_fn,
    get_commodities_by_category_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            commodities_all_handler_fn(
                get_commodities_by_category_fn=get_commodities_by_category_fn,
                jsonify_fn=lambda payload: payload,
                logger=logger,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Commodity catalog is temporarily unavailable.")
        return ({"categories": raw_payload}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def prediction_markets_list_public_handler(
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    list_prediction_markets_handler_fn,
    pm_search_markets_fn,
    pm_fetch_markets_fn,
    log_api_error_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            list_prediction_markets_handler_fn(
                request_obj=request_obj,
                pm_search_markets_fn=pm_search_markets_fn,
                pm_fetch_markets_fn=pm_fetch_markets_fn,
                jsonify_fn=lambda payload: payload,
                log_api_error_fn=log_api_error_fn,
                logger=logger,
            )
        )
        if status_code == 400:
            raise PublicApiError(400, "invalid_query", "Prediction markets query is invalid.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Prediction markets are temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def prediction_markets_exchanges_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    list_prediction_exchanges_handler_fn,
    pm_get_exchanges_fn,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            list_prediction_exchanges_handler_fn(
                pm_get_exchanges_fn=pm_get_exchanges_fn,
                jsonify_fn=lambda payload: payload,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Prediction market exchanges are temporarily unavailable.")
        return ({"exchanges": raw_payload}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def prediction_market_detail_public_handler(
    market_id,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_prediction_market_handler_fn,
    pm_get_market_fn,
    log_api_error_fn,
    logger,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_prediction_market_handler_fn(
                market_id,
                request_obj=request_obj,
                pm_get_market_fn=pm_get_market_fn,
                jsonify_fn=lambda payload: payload,
                log_api_error_fn=log_api_error_fn,
                logger=logger,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "not_found", "Prediction market not found.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Prediction market detail is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )


def economic_calendar_public_handler(
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_economic_calendar_handler_fn,
    calendar_cache,
    requests_module,
    time_module,
    datetime_cls,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_economic_calendar_handler_fn(
                calendar_cache=calendar_cache,
                requests_module=requests_module,
                jsonify_fn=lambda payload: payload,
                time_module=time_module,
                datetime_cls=datetime_cls,
            )
        )
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Economic calendar is temporarily unavailable.")
        return ({"events": raw_payload or []}, 200)

    return _cached_json_payload(
        cache_backend=cache_backend,
        cache_key=cache_key,
        cache_ttl_seconds=cache_ttl_seconds,
        producer_fn=producer,
    )
