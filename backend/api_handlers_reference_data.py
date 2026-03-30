from __future__ import annotations


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
    alpha_vantage_api_key,
    requests_module,
    jsonify_fn,
    logger,
    clean_value_fn,
    fundamentals_from_yfinance_fn,
):
    try:
        sanitized_ticker = ticker.split(":")[0].upper()

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
                return jsonify_fn(yf_data)
            return jsonify_fn({"error": f"No fundamental data found for {ticker}"}), 404

        formatted_data = {
            "symbol": data.get("Symbol"),
            "name": data.get("Name"),
            "description": data.get("Description"),
            "exchange": data.get("Exchange"),
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
    jsonify_fn,
    logger,
):
    if not openbb_available:
        return jsonify_fn({"error": "OpenBB not installed on this server."}), 503
    sym = ticker.upper().split(":")[0]
    relevant = {"10-K", "10-Q", "8-K", "10-K/A", "10-Q/A", "DEF 14A", "S-1", "20-F", "6-K"}
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


def get_macro_overview_handler(
    *,
    openbb_available,
    obb_module,
    jsonify_fn,
    logger,
    yf_module,
    macro_indicators,
):
    if not openbb_available:
        return jsonify_fn({"error": "OpenBB not installed on this server."}), 503
    result = []
    try:
        for indicator in macro_indicators:
            try:
                df = obb_module.economy.indicators(
                    symbol=indicator["symbol"],
                    country="US",
                    provider="econdb",
                ).to_dataframe().reset_index()
                df = df.sort_values("date")
                last = df.iloc[-1]
                prev = df.iloc[-2] if len(df) > 1 else last
                val = float(last["value"]) * indicator["multiplier"]
                prev_val = float(prev["value"]) * indicator["multiplier"]
                sparkline = [
                    {"date": str(row["date"]), "value": round(float(row["value"]) * indicator["multiplier"], 4)}
                    for _, row in df.tail(24).iterrows()
                ]
                result.append(
                    {
                        "symbol": indicator["symbol"],
                        "name": indicator["name"],
                        "unit": indicator["unit"],
                        "value": round(val, 3),
                        "prev": round(prev_val, 3),
                        "date": str(last["date"]),
                        "sparkline": sparkline,
                    }
                )
            except Exception as exc:
                logger.warning(f"Macro indicator {indicator['symbol']} failed: {exc}")

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

        return jsonify_fn(result)
    except Exception as exc:
        logger.error(f"Macro overview error: {exc}")
        return jsonify_fn({"error": str(exc)}), 500
