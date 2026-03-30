from __future__ import annotations

from typing import Any, Dict

from flask import g

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
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_stock_data_handler_fn,
    alpha_vantage_api_key,
    yf_module,
    requests_module,
    logger,
    clean_value_fn,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_stock_data_handler_fn(
                ticker,
                alpha_vantage_api_key=alpha_vantage_api_key,
                yf_module=yf_module,
                requests_module=requests_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
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


def ensemble_prediction_handler(
    ticker,
    *,
    request_obj,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    predict_ensemble_handler_fn,
    selective_modes,
    selector_source_requestable,
    yf_module,
    live_ensemble_signal_components_fn,
    infer_selective_decision_fn,
    logger,
    pd_module,
    np_module,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            predict_ensemble_handler_fn(
                ticker,
                request_obj=request_obj,
                selective_modes=selective_modes,
                selector_source_requestable=selector_source_requestable,
                yf_module=yf_module,
                live_ensemble_signal_components_fn=live_ensemble_signal_components_fn,
                infer_selective_decision_fn=infer_selective_decision_fn,
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


def fundamentals_handler(
    ticker,
    *,
    cache_backend,
    cache_key: str,
    cache_ttl_seconds: int,
    get_fundamentals_handler_fn,
    alpha_vantage_api_key,
    requests_module,
    logger,
    clean_value_fn,
    fundamentals_from_yfinance_fn,
):
    def producer():
        raw_payload, status_code = unwrap_handler_result(
            get_fundamentals_handler_fn(
                ticker,
                alpha_vantage_api_key=alpha_vantage_api_key,
                requests_module=requests_module,
                jsonify_fn=lambda payload: payload,
                logger=logger,
                clean_value_fn=clean_value_fn,
                fundamentals_from_yfinance_fn=fundamentals_from_yfinance_fn,
            )
        )
        if status_code == 404:
            raise PublicApiError(404, "invalid_ticker", f"Ticker '{ticker}' is invalid or unavailable.")
        if status_code >= 500:
            raise PublicApiError(503, "upstream_unavailable", "Fundamental data is temporarily unavailable.")
        return (dict(raw_payload or {}), 200)

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
