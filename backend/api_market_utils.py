from __future__ import annotations


def clean_value(val, *, pd_module, np_module):
    if val is None or pd_module.isna(val):
        return None
    if isinstance(val, (np_module.int64, np_module.int32, np_module.int16, np_module.int8)):
        return int(val)
    if isinstance(val, (np_module.float64, np_module.float32, np_module.float16)):
        return float(val)
    return val


def get_symbol_suggestions(query, *, alpha_vantage_api_key, requests_get, logger):
    if not alpha_vantage_api_key:
        logger.warning("Alpha Vantage key not configured. Cannot get suggestions.")
        return []
    try:
        url = (
            "https://www.alphavantage.co/query"
            f"?function=SYMBOL_SEARCH&keywords={query}&apikey={alpha_vantage_api_key}"
        )
        response = requests_get(url)
        data = response.json()
        matches = data.get("bestMatches", [])
        formatted_matches = []
        for match in matches:
            if "." not in match.get("1. symbol") and match.get("4. region") == "United States":
                formatted_matches.append(
                    {"symbol": match.get("1. symbol"), "name": match.get("2. name")}
                )
        return formatted_matches
    except Exception as exc:
        logger.error("Error in get_symbol_suggestions: %s", exc)
        return []


def obb_to_float(val):
    if val is None:
        return None
    try:
        result = float(val)
        return None if (result != result) else round(result, 4)
    except (TypeError, ValueError):
        return None


def fundamentals_from_yfinance(sym, *, yf_module, logger):
    try:
        info = yf_module.Ticker(sym).info
        if not info or info.get("quoteType") not in ("EQUITY", "ETF", "MUTUALFUND"):
            return None

        def stringify(key):
            value = info.get(key)
            return str(value) if value is not None else "N/A"

        return {
            "symbol": info.get("symbol", sym),
            "name": info.get("longName") or info.get("shortName") or "N/A",
            "description": info.get("longBusinessSummary", "N/A"),
            "exchange": info.get("exchange", "N/A"),
            "currency": info.get("currency", "N/A"),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "country": info.get("country", "N/A"),
            "market_cap": stringify("marketCap"),
            "pe_ratio": stringify("trailingPE"),
            "forward_pe": stringify("forwardPE"),
            "trailing_pe": stringify("trailingPE"),
            "peg_ratio": stringify("pegRatio"),
            "eps": stringify("trailingEps"),
            "beta": stringify("beta"),
            "book_value": stringify("bookValue"),
            "dividend_per_share": stringify("dividendRate"),
            "dividend_yield": stringify("dividendYield"),
            "dividend_date": "N/A",
            "ex_dividend_date": "N/A",
            "profit_margin": stringify("profitMargins"),
            "operating_margin_ttm": stringify("operatingMargins"),
            "return_on_assets_ttm": stringify("returnOnAssets"),
            "return_on_equity_ttm": stringify("returnOnEquity"),
            "revenue_ttm": stringify("totalRevenue"),
            "gross_profit_ttm": stringify("grossProfits"),
            "diluted_eps_ttm": stringify("trailingEps"),
            "revenue_per_share_ttm": stringify("revenuePerShare"),
            "quarterly_earnings_growth_yoy": stringify("earningsQuarterlyGrowth"),
            "quarterly_revenue_growth_yoy": stringify("revenueGrowth"),
            "analyst_target_price": stringify("targetMeanPrice"),
            "price_to_sales_ratio_ttm": stringify("priceToSalesTrailing12Months"),
            "price_to_book_ratio": stringify("priceToBook"),
            "ev_to_revenue": stringify("enterpriseToRevenue"),
            "ev_to_ebitda": stringify("enterpriseToEbitda"),
            "week_52_high": stringify("fiftyTwoWeekHigh"),
            "week_52_low": stringify("fiftyTwoWeekLow"),
            "day_50_moving_average": stringify("fiftyDayAverage"),
            "day_200_moving_average": stringify("twoHundredDayAverage"),
            "shares_outstanding": stringify("sharesOutstanding"),
        }
    except Exception as exc:
        logger.warning("yfinance fundamentals fallback failed for %s: %s", sym, exc)
        return None
