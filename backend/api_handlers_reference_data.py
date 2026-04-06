from __future__ import annotations

import csv
from io import StringIO


_OPENBB_MACRO_SUPPORT_CACHE = {}


def news_api_handler(*, get_general_news_fn, jsonify_fn):
    try:
        return jsonify_fn(get_general_news_fn())
    except Exception as exc:
        return jsonify_fn({"error": f"Failed to fetch news: {str(exc)}"}), 500


def forex_convert_handler(*, request_obj, get_exchange_rate_fn, jsonify_fn, logger):
    try:
        from_currency = request_obj.args.get("from", "USD").upper()
        to_currency = request_obj.args.get("to", "EUR").upper()
        rate_data = get_exchange_rate_fn(from_currency, to_currency)
        if rate_data is None:
            return jsonify_fn({"error": "Could not fetch exchange rate"}), 404
        return jsonify_fn(rate_data)
    except Exception as exc:
        logger.error(f"Forex convert error: {exc}")
        return jsonify_fn({"error": f"Conversion failed: {str(exc)}"}), 500


def forex_currencies_handler(*, get_currency_list_fn, jsonify_fn, logger):
    try:
        return jsonify_fn(get_currency_list_fn())
    except Exception as exc:
        logger.error(f"Forex currencies error: {exc}")
        return jsonify_fn({"error": f"Failed to fetch currencies: {str(exc)}"}), 500


def crypto_convert_handler(*, request_obj, get_crypto_exchange_rate_fn, jsonify_fn, logger):
    try:
        from_crypto = request_obj.args.get("from", "BTC").upper()
        to_currency = request_obj.args.get("to", "USD").upper()
        rate_data = get_crypto_exchange_rate_fn(from_crypto, to_currency)
        if rate_data is None:
            return jsonify_fn({"error": "Could not fetch crypto exchange rate"}), 404
        return jsonify_fn(rate_data)
    except Exception as exc:
        logger.error(f"Crypto convert error: {exc}")
        return jsonify_fn({"error": f"Conversion failed: {str(exc)}"}), 500


def crypto_list_handler(*, get_crypto_list_fn, jsonify_fn, logger):
    try:
        return jsonify_fn(get_crypto_list_fn())
    except Exception as exc:
        logger.error(f"Crypto list error: {exc}")
        return jsonify_fn({"error": f"Failed to fetch crypto list: {str(exc)}"}), 500


def crypto_target_currencies_handler(*, get_target_currencies_fn, jsonify_fn, logger):
    try:
        return jsonify_fn(get_target_currencies_fn())
    except Exception as exc:
        logger.error(f"Crypto currencies error: {exc}")
        return jsonify_fn({"error": f"Failed to fetch currencies: {str(exc)}"}), 500


def commodity_price_handler(commodity, *, request_obj, get_commodity_price_fn, jsonify_fn, logger):
    try:
        period = request_obj.args.get("period", "5d")
        data = get_commodity_price_fn(commodity, period)
        if data is None:
            return jsonify_fn({"error": "Could not fetch commodity price"}), 404
        return jsonify_fn(data)
    except Exception as exc:
        logger.error(f"Commodity price error: {exc}")
        return jsonify_fn({"error": f"Failed to fetch commodity: {str(exc)}"}), 500


def commodities_list_handler(*, get_commodity_list_fn, jsonify_fn, logger):
    try:
        return jsonify_fn(get_commodity_list_fn())
    except Exception as exc:
        logger.error(f"Commodities list error: {exc}")
        return jsonify_fn({"error": f"Failed to fetch commodities: {str(exc)}"}), 500


def commodities_all_handler(*, get_commodities_by_category_fn, jsonify_fn, logger):
    try:
        return jsonify_fn(get_commodities_by_category_fn())
    except Exception as exc:
        logger.error(f"Commodities all error: {exc}")
        return jsonify_fn({"error": f"Failed to fetch all commodities: {str(exc)}"}), 500


def get_fundamentals_handler(
    ticker,
    *,
    request_obj,
    alpha_vantage_api_key,
    requests_module,
    jsonify_fn,
    logger,
    clean_value_fn,
    fundamentals_from_yfinance_fn,
    resolve_asset_fn,
    akshare_service_module,
    exchange_session_service_module,
):
    try:
        market = request_obj.args.get("market")
        asset = resolve_asset_fn(ticker, market)
        if asset["market"] in {"HK", "CN"}:
            try:
                payload = dict(akshare_service_module.get_equity_fundamentals(asset["assetId"]))
                payload["marketSession"] = exchange_session_service_module.get_market_session(
                    asset["market"],
                    exchange=payload.get("exchange") or asset["exchange"],
                )
                return jsonify_fn(payload)
            except akshare_service_module.AkshareUnavailableError as exc:
                return jsonify_fn({"error": str(exc)}), 503
            except akshare_service_module.AkshareAssetNotFoundError as exc:
                return jsonify_fn({"error": str(exc)}), 404

        sanitized_ticker = asset["symbol"]

        av_data = None
        if alpha_vantage_api_key:
            try:
                url = (
                    "https://www.alphavantage.co/query"
                    f"?function=OVERVIEW&symbol={sanitized_ticker}&apikey={alpha_vantage_api_key}"
                )
                av_resp = requests_module.get(url, timeout=10)
                av_json = av_resp.json()
                if av_json and "Symbol" in av_json:
                    av_data = av_json
            except Exception as exc:
                logger.warning(f"Alpha Vantage fundamentals failed for {sanitized_ticker}: {exc}")

        if av_data:
            data = av_data
        else:
            yf_data = fundamentals_from_yfinance_fn(sanitized_ticker)
            if yf_data:
                yf_data = dict(yf_data)
                yf_data.setdefault("assetId", asset["assetId"])
                yf_data.setdefault("market", asset["market"])
                yf_data["marketSession"] = exchange_session_service_module.get_market_session(
                    asset["market"],
                    exchange=yf_data.get("exchange") or asset.get("exchange"),
                )
                return jsonify_fn(yf_data)
            return jsonify_fn({"error": f"No fundamental data found for {ticker}"}), 404

        formatted_data = {
            "symbol": sanitized_ticker,
            "assetId": asset["assetId"],
            "market": asset["market"],
            "name": data.get("Name"),
            "description": data.get("Description"),
            "exchange": data.get("Exchange") or asset.get("exchange"),
            "currency": data.get("Currency"),
            "sector": data.get("Sector"),
            "industry": data.get("Industry"),
            "country": data.get("Country"),
            "market_cap": clean_value_fn(data.get("MarketCapitalization")),
            "pe_ratio": clean_value_fn(data.get("PERatio")),
            "forward_pe": clean_value_fn(data.get("ForwardPE")),
            "trailing_pe": clean_value_fn(data.get("TrailingPE")),
            "peg_ratio": clean_value_fn(data.get("PEGRatio")),
            "eps": clean_value_fn(data.get("EPS")),
            "beta": clean_value_fn(data.get("Beta")),
            "book_value": clean_value_fn(data.get("BookValue")),
            "dividend_per_share": clean_value_fn(data.get("DividendPerShare")),
            "dividend_yield": clean_value_fn(data.get("DividendYield")),
            "dividend_date": data.get("DividendDate"),
            "ex_dividend_date": data.get("ExDividendDate"),
            "profit_margin": clean_value_fn(data.get("ProfitMargin")),
            "operating_margin_ttm": clean_value_fn(data.get("OperatingMarginTTM")),
            "return_on_assets_ttm": clean_value_fn(data.get("ReturnOnAssetsTTM")),
            "return_on_equity_ttm": clean_value_fn(data.get("ReturnOnEquityTTM")),
            "revenue_ttm": clean_value_fn(data.get("RevenueTTM")),
            "gross_profit_ttm": clean_value_fn(data.get("GrossProfitTTM")),
            "diluted_eps_ttm": clean_value_fn(data.get("DilutedEPSTTM")),
            "revenue_per_share_ttm": clean_value_fn(data.get("RevenuePerShareTTM")),
            "quarterly_earnings_growth_yoy": clean_value_fn(data.get("QuarterlyEarningsGrowthYOY")),
            "quarterly_revenue_growth_yoy": clean_value_fn(data.get("QuarterlyRevenueGrowthYOY")),
            "analyst_target_price": clean_value_fn(data.get("AnalystTargetPrice")),
            "price_to_sales_ratio_ttm": clean_value_fn(data.get("PriceToSalesRatioTTM")),
            "price_to_book_ratio": clean_value_fn(data.get("PriceToBookRatio")),
            "ev_to_revenue": clean_value_fn(data.get("EVToRevenue")),
            "ev_to_ebitda": clean_value_fn(data.get("EVToEBITDA")),
            "week_52_high": clean_value_fn(data.get("52WeekHigh")),
            "week_52_low": clean_value_fn(data.get("52WeekLow")),
            "day_50_moving_average": clean_value_fn(data.get("50DayMovingAverage")),
            "day_200_moving_average": clean_value_fn(data.get("200DayMovingAverage")),
            "shares_outstanding": clean_value_fn(data.get("SharesOutstanding")),
        }
        formatted_data["marketSession"] = exchange_session_service_module.get_market_session(
            asset["market"],
            exchange=formatted_data.get("exchange") or asset.get("exchange"),
        )
        return jsonify_fn(formatted_data)
    except Exception as exc:
        logger.error(f"Fundamentals error for {ticker}: {exc}")
        return jsonify_fn({"error": f"Failed to fetch fundamentals: {str(exc)}"}), 500


def get_economic_calendar_handler(
    *,
    calendar_cache,
    requests_module,
    jsonify_fn,
    time_module,
    datetime_cls,
):
    current_time = time_module.time()
    if calendar_cache["data"] is not None and (current_time - calendar_cache["last_fetched"]) < 900:
        return jsonify_fn(calendar_cache["data"])

    try:
        url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
        }
        response = requests_module.get(url, headers=headers)

        if response.status_code != 200:
            if calendar_cache["data"] is not None:
                return jsonify_fn(calendar_cache["data"])
            return jsonify_fn({"error": f"Failed to fetch calendar (Status {response.status_code})"}), 500

        data = response.json()
        formatted_events = []
        for index, item in enumerate(data):
            if item.get("country") != "USD":
                continue
            raw_date = item.get("date", "")
            try:
                dt = datetime_cls.strptime(raw_date[:19], "%Y-%m-%dT%H:%M:%S")
                date_str = dt.strftime("%Y-%m-%d")
                time_str = dt.strftime("%I:%M %p").lstrip("0")
            except Exception:
                date_str = raw_date
                time_str = "TBD"

            title = item.get("title", "Unknown Event")
            event_type = "speaker" if "Speaks" in title or "Testifies" in title else "report"

            def clean_val(value):
                return value if value and str(value).strip() != "" else "-"

            formatted_events.append(
                {
                    "id": index,
                    "date": date_str,
                    "time": time_str,
                    "type": event_type,
                    "event": title,
                    "impact": item.get("impact", "Low"),
                    "actual": clean_val(item.get("actual")),
                    "forecast": clean_val(item.get("forecast")),
                    "previous": clean_val(item.get("previous")),
                }
            )

        calendar_cache["data"] = formatted_events
        calendar_cache["last_fetched"] = current_time
        return jsonify_fn(formatted_events)
    except Exception as exc:
        if calendar_cache["data"] is not None:
            return jsonify_fn(calendar_cache["data"])
        return jsonify_fn({"error": str(exc)}), 500


def get_market_sessions_handler(
    *,
    request_obj,
    jsonify_fn,
    logger,
    exchange_session_service_module,
):
    market = str(request_obj.args.get("market", "us")).strip()
    days = request_obj.args.get("days", default=14, type=int)
    try:
        payload = exchange_session_service_module.get_market_sessions_calendar(market, days=days)
        return jsonify_fn(payload)
    except exchange_session_service_module.ExchangeSessionError as exc:
        return jsonify_fn({"error": str(exc)}), 400
    except Exception as exc:
        logger.error(f"Market sessions calendar error for {market}: {exc}")
        return jsonify_fn({"error": "Failed to load market sessions."}), 500


def get_financial_statements_handler(
    ticker,
    *,
    openbb_available,
    obb_module,
    jsonify_fn,
    logger,
    obb_to_float_fn,
):
    if not openbb_available:
        return jsonify_fn({"error": "OpenBB not installed on this server."}), 503
    sym = ticker.upper().split(":")[0]
    try:
        income_df = obb_module.equity.fundamental.income(sym, provider="yfinance", period="annual", limit=4).to_dataframe()
        balance_df = obb_module.equity.fundamental.balance(sym, provider="yfinance", period="annual", limit=4).to_dataframe()
        cashflow_df = obb_module.equity.fundamental.cash(sym, provider="yfinance", period="annual", limit=4).to_dataframe()

        def rows(df, field_map):
            out = []
            for _, row in df.iterrows():
                record = {"period": str(row.get("date", row.get("period_of_report", "")))[:10]}
                for dest, src in field_map.items():
                    record[dest] = obb_to_float_fn(row.get(src))
                out.append(record)
            return out

        income_fields = {
            "revenue": "revenue",
            "gross_profit": "gross_profit",
            "operating_income": "operating_income",
            "net_income": "net_income",
            "ebitda": "ebitda",
            "eps": "eps_diluted",
        }
        balance_fields = {
            "total_assets": "total_assets",
            "total_liab": "total_liabilities",
            "total_equity": "total_equity",
            "cash": "cash_and_cash_equivalents",
            "total_debt": "total_debt",
            "working_capital": "net_current_assets",
        }
        cashflow_fields = {
            "operating": "net_cash_flow_from_operating_activities",
            "investing": "net_cash_flow_from_investing_activities",
            "financing": "net_cash_flow_from_financing_activities",
            "capex": "capital_expenditure",
            "free_cf": "free_cash_flow",
        }

        return jsonify_fn(
            {
                "income_statement": rows(income_df, income_fields),
                "balance_sheet": rows(balance_df, balance_fields),
                "cash_flow": rows(cashflow_df, cashflow_fields),
            }
        )
    except Exception as exc:
        logger.error(f"Financial statements error for {sym}: {exc}")
        return jsonify_fn({"error": str(exc)}), 500


def get_sec_filings_handler(
    ticker,
    *,
    openbb_available,
    obb_module,
    sec_filings_service_module,
    jsonify_fn,
    logger,
):
    sym = ticker.upper().split(":")[0]
    relevant = {"10-K", "10-Q", "8-K", "10-K/A", "10-Q/A", "DEF 14A", "S-1", "20-F", "6-K"}

    try:
        filings = sec_filings_service_module.list_company_filings(sym, limit=30)
        return jsonify_fn(filings)
    except sec_filings_service_module.SecFilingsUnavailableError as exc:
        logger.info(f"SEC filings EdgarTools unavailable for {sym}: {exc}")
    except Exception as exc:
        logger.warning(f"SEC filings EdgarTools lookup failed for {sym}: {exc}")

    if not openbb_available:
        return jsonify_fn({"error": "SEC filings are temporarily unavailable."}), 503

    try:
        df = obb_module.equity.fundamental.filings(sym, provider="sec", limit=50).to_dataframe()
        results = []
        for _, row in df.iterrows():
            report_type = str(row.get("report_type", row.get("type", ""))).upper()
            if report_type not in relevant:
                continue
            results.append(
                {
                    "date": str(row.get("date", row.get("filed", "")))[:10],
                    "type": report_type,
                    "description": str(row.get("description", row.get("form", "")))[:200],
                    "url": str(row.get("url", row.get("link", ""))) or None,
                }
            )
        return jsonify_fn(results[:30])
    except Exception as exc:
        logger.error(f"SEC filings error for {sym}: {exc}")
        return jsonify_fn({"error": str(exc)}), 500


def get_sec_filing_detail_handler(
    ticker,
    accession_number,
    *,
    sec_filings_service_module,
    jsonify_fn,
    logger,
):
    sym = ticker.upper().split(":")[0]
    try:
        return jsonify_fn(
            sec_filings_service_module.get_filing_detail(
                sym,
                accession_number,
                section_char_limit=8000,
            )
        )
    except sec_filings_service_module.SecFilingsUnavailableError as exc:
        return jsonify_fn({"error": str(exc)}), 503
    except sec_filings_service_module.SecFilingNotFoundError as exc:
        return jsonify_fn({"error": str(exc)}), 404
    except Exception as exc:
        logger.error(f"SEC filing detail error for {sym}/{accession_number}: {exc}")
        return jsonify_fn({"error": "Failed to fetch SEC filing detail."}), 500


def get_sec_intelligence_handler(
    ticker,
    *,
    sec_filings_service_module,
    jsonify_fn,
    logger,
):
    sym = ticker.upper().split(":")[0]
    try:
        return jsonify_fn(sec_filings_service_module.get_company_sec_intelligence(sym))
    except sec_filings_service_module.SecFilingsUnavailableError as exc:
        return jsonify_fn({"error": str(exc)}), 503
    except sec_filings_service_module.SecFilingNotFoundError as exc:
        return jsonify_fn({"error": str(exc)}), 404
    except Exception as exc:
        logger.error(f"SEC intelligence error for {sym}: {exc}")
        return jsonify_fn({"error": "Failed to load SEC intelligence."}), 500


def get_screener_handler(
    *,
    openbb_available,
    obb_module,
    jsonify_fn,
    logger,
    obb_to_float_fn,
):
    if not openbb_available:
        return jsonify_fn({"error": "OpenBB not installed on this server."}), 503

    def fmt(results):
        formatted = []
        for result in results:
            formatted.append(
                {
                    "symbol": result.symbol,
                    "name": result.name or "",
                    "price": obb_to_float_fn(result.price),
                    "change": obb_to_float_fn(result.change),
                    "percent_change": obb_to_float_fn(result.percent_change),
                    "market_cap": obb_to_float_fn(result.market_cap),
                    "volume": int(result.volume) if result.volume else None,
                    "pe_forward": obb_to_float_fn(result.pe_forward),
                    "year_high": obb_to_float_fn(result.year_high),
                    "year_low": obb_to_float_fn(result.year_low),
                    "eps_ttm": obb_to_float_fn(result.eps_ttm),
                }
            )
        return formatted

    try:
        gainers = fmt(obb_module.equity.discovery.gainers(provider="yfinance").results)
        losers = fmt(obb_module.equity.discovery.losers(provider="yfinance").results)
        active = fmt(obb_module.equity.discovery.active(provider="yfinance").results)
        return jsonify_fn({"gainers": gainers, "losers": losers, "active": active})
    except Exception as exc:
        logger.error(f"Screener error: {exc}")
        return jsonify_fn({"error": str(exc)}), 500


def _coerce_float(value):
    try:
        if value in (None, "", "."):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_macro_indicator_payload(indicator, rows, *, multiplier=None):
    normalized_rows = []
    scale = indicator.get("multiplier", 1) if multiplier is None else multiplier
    for row in rows or []:
        date_value = str(row.get("date") or "").strip()
        value = _coerce_float(row.get("value"))
        if not date_value or value is None:
            continue
        normalized_rows.append(
            {
                "date": date_value,
                "value": round(value * scale, 4),
            }
        )

    normalized_rows.sort(key=lambda row: row["date"])
    if not normalized_rows:
        return None

    last = normalized_rows[-1]
    prev = normalized_rows[-2] if len(normalized_rows) > 1 else last
    return {
        "symbol": indicator["symbol"],
        "name": indicator["name"],
        "unit": indicator["unit"],
        "value": round(last["value"], 3),
        "prev": round(prev["value"], 3),
        "date": str(last["date"]),
        "sparkline": normalized_rows[-24:],
    }


def _fetch_macro_rows_from_openbb(*, indicator, obb_module):
    economy_router = getattr(obb_module, "economy", None)
    if economy_router is None or not hasattr(economy_router, "indicators"):
        raise AttributeError("OpenBB economy router does not expose indicators().")

    df = economy_router.indicators(
        symbol=indicator["symbol"],
        country="US",
        provider="econdb",
    ).to_dataframe().reset_index()
    df = df.sort_values("date")
    return [{"date": str(row["date"]), "value": row["value"]} for _, row in df.iterrows()]


def _is_openbb_macro_capability_error(exc):
    if isinstance(exc, (AttributeError, NotImplementedError)):
        return True
    message = str(exc or "").lower()
    return (
        "does not expose indicators" in message
        or "has no attribute 'indicators'" in message
    )


def _get_openbb_macro_support(obb_module):
    if obb_module is None:
        return False, "OpenBB module unavailable."

    cache_key = id(obb_module)
    cached = _OPENBB_MACRO_SUPPORT_CACHE.get(cache_key)
    if cached is not None:
        return cached

    economy_router = getattr(obb_module, "economy", None)
    if economy_router is None:
        support = (False, "OpenBB economy router is unavailable.")
    elif not hasattr(economy_router, "indicators"):
        support = (False, "OpenBB economy router does not expose indicators().")
    else:
        support = (True, None)

    _OPENBB_MACRO_SUPPORT_CACHE[cache_key] = support
    return support


def _disable_openbb_macro_support(obb_module, reason):
    if obb_module is None:
        return
    _OPENBB_MACRO_SUPPORT_CACHE[id(obb_module)] = (
        False,
        str(reason or "OpenBB macro support disabled."),
    )


def _fetch_macro_rows_from_fred(*, indicator, requests_module):
    series_id = indicator.get("series_id") or indicator["symbol"]
    response = requests_module.get(
        f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}",
        timeout=10,
    )
    status_code = getattr(response, "status_code", 200)
    if status_code >= 400:
        raise ValueError(f"FRED returned status {status_code} for {series_id}")

    text = getattr(response, "text", "") or ""
    reader = csv.DictReader(StringIO(text))
    rows = []
    for raw_row in reader:
        date_value = raw_row.get("DATE") or raw_row.get("date") or raw_row.get("observation_date")
        value = raw_row.get(series_id) or raw_row.get("VALUE") or raw_row.get("value")
        numeric_value = _coerce_float(value)
        if not date_value or numeric_value is None:
            continue
        rows.append({"date": date_value, "value": numeric_value})

    if not rows:
        raise ValueError(f"No usable FRED data returned for {series_id}")
    return rows


def get_macro_overview_handler(
    *,
    openbb_available,
    obb_module,
    jsonify_fn,
    logger,
    yf_module,
    macro_indicators,
    requests_module,
    request_obj=None,
    akshare_service_module=None,
):
    result = []
    try:
        request_args = getattr(request_obj, "args", None)
        region = str(request_args.get("region", "us") if request_args else "us").strip().lower()
        if region == "asia":
            if akshare_service_module is None:
                return jsonify_fn({"error": "Asia macro data is temporarily unavailable."}), 503
            try:
                return jsonify_fn(akshare_service_module.get_asia_macro_overview())
            except akshare_service_module.AkshareUnavailableError as exc:
                return jsonify_fn({"error": str(exc)}), 503
            except akshare_service_module.AkshareAssetNotFoundError as exc:
                return jsonify_fn({"error": str(exc)}), 404

        openbb_macro_supported = False
        openbb_macro_reason = None
        if openbb_available and obb_module is not None:
            openbb_macro_cached = id(obb_module) in _OPENBB_MACRO_SUPPORT_CACHE
            openbb_macro_supported, openbb_macro_reason = _get_openbb_macro_support(obb_module)
            if not openbb_macro_supported and openbb_macro_reason and not openbb_macro_cached:
                logger.warning(f"Macro overview using FRED fallback because {openbb_macro_reason}")

        for indicator in macro_indicators:
            indicator_payload = None

            if openbb_macro_supported:
                try:
                    indicator_payload = _build_macro_indicator_payload(
                        indicator,
                        _fetch_macro_rows_from_openbb(indicator=indicator, obb_module=obb_module),
                        multiplier=indicator.get("openbb_multiplier", indicator.get("multiplier", 1)),
                    )
                except Exception as exc:
                    if _is_openbb_macro_capability_error(exc):
                        _disable_openbb_macro_support(obb_module, exc)
                        openbb_macro_supported = False
                        logger.warning(
                            f"Macro overview disabling OpenBB macro path after {indicator['symbol']} failed: {exc}"
                        )
                    else:
                        logger.warning(f"Macro indicator {indicator['symbol']} OpenBB fetch failed: {exc}")

            if indicator_payload is None:
                try:
                    indicator_payload = _build_macro_indicator_payload(
                        indicator,
                        _fetch_macro_rows_from_fred(
                            indicator=indicator,
                            requests_module=requests_module,
                        ),
                        multiplier=indicator.get("fred_multiplier", indicator.get("multiplier", 1)),
                    )
                except Exception as exc:
                    logger.warning(f"Macro indicator {indicator['symbol']} FRED fallback failed: {exc}")

            if indicator_payload is not None:
                result.append(indicator_payload)

        try:
            tnx = yf_module.Ticker("^TNX")
            info = tnx.info
            rate = info.get("regularMarketPrice") or info.get("previousClose")
            hist = tnx.history(period="2y", interval="1mo")
            sparkline = [
                {"date": str(date_val.date()), "value": round(float(value), 3)}
                for date_val, value in zip(hist.index, hist["Close"])
            ]
            prev_rate = float(hist["Close"].iloc[-2]) if len(hist) > 1 else rate
            result.append(
                {
                    "symbol": "TNX",
                    "name": "10-Year Treasury Yield",
                    "unit": "%",
                    "value": round(float(rate), 3) if rate else None,
                    "prev": round(prev_rate, 3),
                    "date": str(hist.index[-1].date()) if not hist.empty else "",
                    "sparkline": sparkline,
                }
            )
        except Exception as exc:
            logger.warning(f"TNX fetch failed: {exc}")

        if not result:
            return jsonify_fn({"error": "Macro data is temporarily unavailable."}), 503
        return jsonify_fn(result)
    except Exception as exc:
        logger.error(f"Macro overview error: {exc}")
        return jsonify_fn({"error": str(exc)}), 500
