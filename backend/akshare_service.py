from __future__ import annotations

import importlib
import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from asset_identity import market_exchange, market_label, parse_asset_reference


SEARCH_CACHE_TTL_SECONDS = 60 * 60
SPOT_CACHE_TTL_SECONDS = 10 * 60
PROFILE_CACHE_TTL_SECONDS = 6 * 60 * 60
HISTORY_CACHE_TTL_SECONDS = 30 * 60
ANNOUNCEMENTS_CACHE_TTL_SECONDS = 15 * 60
ASIA_MACRO_CACHE_TTL_SECONDS = 15 * 60

TRUE_VALUES = {"1", "true", "yes", "on"}
_SEARCH_CACHE: Dict[Any, tuple[float, Any]] = {}
_SPOT_CACHE: Dict[Any, tuple[float, Any]] = {}
_PROFILE_CACHE: Dict[Any, tuple[float, Any]] = {}
_HISTORY_CACHE: Dict[Any, tuple[float, Any]] = {}
_ANNOUNCEMENTS_CACHE: Dict[Any, tuple[float, Any]] = {}
_ASIA_MACRO_CACHE: Dict[Any, tuple[float, Any]] = {}

ASIA_MACRO_INDICATORS = [
    {
        "symbol": "CN_CPI",
        "name": "China CPI YoY",
        "market": "CN",
        "unit": "%",
        "loader": "macro_china_cpi_yearly",
        "value_col": "今值",
        "prev_col": "前值",
        "date_col": "日期",
        "description": "Mainland China consumer inflation on a year-over-year basis.",
        "invert": False,
    },
    {
        "symbol": "CN_GDP",
        "name": "China GDP YoY",
        "market": "CN",
        "unit": "%",
        "loader": "macro_china_gdp_yearly",
        "value_col": "今值",
        "prev_col": "前值",
        "date_col": "日期",
        "description": "Mainland China annual GDP growth rate.",
        "invert": False,
    },
    {
        "symbol": "CN_PMI",
        "name": "China Manufacturing PMI",
        "market": "CN",
        "unit": "Index",
        "loader": "macro_china_pmi_yearly",
        "value_col": "今值",
        "prev_col": "前值",
        "date_col": "日期",
        "description": "Official manufacturing PMI. Readings above 50 imply expansion.",
        "invert": False,
    },
    {
        "symbol": "HK_CPI",
        "name": "Hong Kong CPI YoY",
        "market": "HK",
        "unit": "%",
        "loader": "macro_china_hk_cpi_ratio",
        "value_col": "现值",
        "prev_col": "前值",
        "date_col": "发布日期",
        "description": "Hong Kong annual inflation rate.",
        "invert": False,
    },
    {
        "symbol": "HK_URATE",
        "name": "Hong Kong Unemployment Rate",
        "market": "HK",
        "unit": "%",
        "loader": "macro_china_hk_rate_of_unemployment",
        "value_col": "现值",
        "prev_col": "前值",
        "date_col": "发布日期",
        "description": "Hong Kong labor-market slack. Lower is healthier.",
        "invert": True,
    },
]

ASIA_MARKET_SIGNAL_CONFIGS = [
    {
        "symbol": "USDCNH",
        "name": "USD/CNH",
        "category": "FX",
        "loader": "forex_spot_em",
        "aliases": ["USDCNH", "美元兑离岸人民币", "美元/离岸人民币"],
    },
    {
        "symbol": "USDHKD",
        "name": "USD/HKD",
        "category": "FX",
        "loader": "forex_spot_em",
        "aliases": ["USDHKD", "美元兑港元", "美元/港元"],
    },
    {
        "symbol": "BRENT",
        "name": "Brent Crude",
        "category": "Commodity",
        "loader": "futures_global_spot_em",
        "aliases": ["布伦特原油", "伦敦布伦特原油", "英国布伦特原油"],
    },
    {
        "symbol": "COPPER",
        "name": "Copper",
        "category": "Commodity",
        "loader": "futures_global_spot_em",
        "aliases": ["LME铜", "COMEX铜", "铜3个月", "期铜"],
    },
]


class AkshareError(Exception):
    pass


class AkshareUnavailableError(AkshareError):
    pass


class AkshareAssetNotFoundError(AkshareError):
    pass


def is_available() -> bool:
    try:
        _load_akshare_module()
    except AkshareUnavailableError:
        return False
    return True


def search_equities(query: str, *, market: str = "all", limit: int = 8) -> List[Dict[str, Any]]:
    normalized_query = str(query or "").strip()
    if not normalized_query:
        return []

    normalized_market = str(market or "all").strip().lower()
    if normalized_market not in {"hk", "cn", "all"}:
        raise AkshareUnavailableError("Akshare search is only available for HK and CN markets.")

    candidates: List[Dict[str, Any]] = []
    if normalized_market in {"hk", "all"}:
        candidates.extend(_search_hk_equities(normalized_query))
    if normalized_market in {"cn", "all"}:
        candidates.extend(_search_cn_equities(normalized_query))

    seen = set()
    ranked: List[Dict[str, Any]] = []
    for item in sorted(candidates, key=lambda row: row.get("_rank", 9999)):
        asset_id = item["assetId"]
        if asset_id in seen:
            continue
        seen.add(asset_id)
        ranked.append({key: value for key, value in item.items() if key != "_rank"})
        if len(ranked) >= max(int(limit), 1):
            break
    return ranked


def get_equity_snapshot(ticker: str, *, market: Optional[str] = None) -> Dict[str, Any]:
    asset = parse_asset_reference(ticker, market)
    if asset["market"] == "HK":
        return _build_hk_snapshot(asset)
    if asset["market"] == "CN":
        return _build_cn_snapshot(asset)
    raise AkshareUnavailableError("Akshare snapshot is only available for HK and CN markets.")


def get_equity_chart(ticker: str, *, market: Optional[str] = None, period: str = "6mo") -> List[Dict[str, Any]]:
    asset = parse_asset_reference(ticker, market)
    history_df = _load_history(asset, period=period)
    if history_df is None or history_df.empty:
        raise AkshareAssetNotFoundError(f"No historical data found for {asset['assetId']}.")

    rows: List[Dict[str, Any]] = []
    for _, row in history_df.iterrows():
        rows.append(
            {
                "date": f"{row['日期']} 00:00:00",
                "open": _safe_float(row.get("开盘")),
                "high": _safe_float(row.get("最高")),
                "low": _safe_float(row.get("最低")),
                "close": _safe_float(row.get("收盘")),
                "volume": _safe_float(row.get("成交量")),
            }
        )
    return rows


def get_equity_fundamentals(ticker: str, *, market: Optional[str] = None) -> Dict[str, Any]:
    asset = parse_asset_reference(ticker, market)
    if asset["market"] == "HK":
        return _build_hk_fundamentals(asset)
    if asset["market"] == "CN":
        return _build_cn_fundamentals(asset)
    raise AkshareUnavailableError("Akshare fundamentals are only available for HK and CN markets.")


def get_equity_ai_context(ticker: str, *, market: Optional[str] = None) -> Dict[str, Any]:
    asset = parse_asset_reference(ticker, market)
    fundamentals = get_equity_fundamentals(asset["assetId"])
    snapshot = get_equity_snapshot(asset["assetId"])
    announcements = fundamentals.get("announcements") or []
    return {
        "assetId": asset["assetId"],
        "market": asset["market"],
        "exchange": asset["exchange"],
        "assetName": fundamentals.get("name") or snapshot.get("companyName"),
        "fundamentalsSummary": {
            "companyName": fundamentals.get("name"),
            "sector": fundamentals.get("sector") or fundamentals.get("industry"),
            "industry": fundamentals.get("industry"),
            "exchange": fundamentals.get("exchange"),
            "currency": fundamentals.get("currency"),
            "marketCap": fundamentals.get("market_cap"),
            "description": fundamentals.get("description"),
        },
        "recentNews": [
            {
                "title": item.get("title"),
                "publisher": item.get("publisher", "CNInfo"),
                "link": item.get("link"),
                "publishTime": item.get("publishTime"),
            }
            for item in announcements[:5]
        ],
        "quoteSummary": {
            "price": snapshot.get("price"),
            "change": snapshot.get("change"),
            "changePercent": snapshot.get("changePercent"),
        },
        "companyResearch": {
            "profile": fundamentals.get("researchProfile") or [],
            "announcements": announcements[:5],
        },
    }


def get_asia_macro_overview() -> Dict[str, Any]:
    cache_key = "asia_macro_overview"
    cached = _cache_get(_ASIA_MACRO_CACHE, cache_key)
    if cached is not None:
        return cached

    ak = _load_akshare_module()
    indicators: List[Dict[str, Any]] = []
    for config in ASIA_MACRO_INDICATORS:
        dataframe = getattr(ak, config["loader"])()
        indicator_payload = _normalize_macro_indicator(dataframe, config)
        if indicator_payload is not None:
            indicators.append(indicator_payload)

    market_signals = _build_asia_market_signals(ak)
    if not indicators and not market_signals:
        raise AkshareAssetNotFoundError("Asia macro data is temporarily unavailable.")

    payload = {
        "region": "asia",
        "title": "Asia Macro Dashboard",
        "description": "China and Hong Kong macro indicators with selected FX and commodity signals.",
        "source": "akshare",
        "sourceNote": "Data via Akshare aggregating Jin10 and Eastmoney sources.",
        "readOnlyResearchOnly": True,
        "indicators": indicators,
        "marketSignals": market_signals,
    }
    return _cache_set(_ASIA_MACRO_CACHE, cache_key, payload, ASIA_MACRO_CACHE_TTL_SECONDS)


def _load_akshare_module():
    if str(os.getenv("AKSHARE_ENABLED", "false")).strip().lower() not in TRUE_VALUES:
        raise AkshareUnavailableError("Akshare international research is not enabled on this server.")
    try:
        return importlib.import_module("akshare")
    except ImportError as exc:
        raise AkshareUnavailableError("Akshare is not installed on this server.") from exc


def _normalize_macro_indicator(dataframe, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if dataframe is None or dataframe.empty:
        return None

    points: List[Dict[str, Any]] = []
    for _, row in dataframe.iterrows():
        value = _safe_float(row.get(config["value_col"]))
        date_value = _normalize_series_date(row.get(config["date_col"]))
        if value is None or not date_value:
            continue
        points.append({"date": date_value, "value": value})

    if not points:
        return None

    latest = points[-1]
    previous = points[-2]["value"] if len(points) > 1 else _safe_float(dataframe.iloc[-1].get(config["prev_col"]))
    return {
        "symbol": config["symbol"],
        "name": config["name"],
        "market": config["market"],
        "unit": config["unit"],
        "value": latest["value"],
        "prev": previous,
        "date": latest["date"],
        "sparkline": points[-18:],
        "description": config.get("description"),
        "invert": bool(config.get("invert")),
        "provider": "akshare",
    }


def _build_asia_market_signals(ak) -> List[Dict[str, Any]]:
    datasets: Dict[str, Any] = {}
    signals: List[Dict[str, Any]] = []

    for config in ASIA_MARKET_SIGNAL_CONFIGS:
        dataframe = datasets.get(config["loader"])
        if dataframe is None:
            try:
                dataframe = getattr(ak, config["loader"])()
            except Exception:
                dataframe = None
            datasets[config["loader"]] = dataframe

        signal = _extract_market_signal(dataframe, config)
        if signal is not None:
            signals.append(signal)

    return signals


def _extract_market_signal(dataframe, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if dataframe is None or dataframe.empty:
        return None

    matched_row = None
    aliases = [str(alias).strip().lower() for alias in config.get("aliases", []) if str(alias).strip()]
    for _, row in dataframe.iterrows():
        code = str(row.get("代码") or row.get("symbol") or row.get("代码编号") or "").strip()
        name = str(row.get("名称") or row.get("name") or row.get("商品名称") or "").strip()
        haystack = f"{code} {name}".lower()
        if any(alias in haystack for alias in aliases):
            matched_row = row
            break

    if matched_row is None:
        return None

    return {
        "symbol": config["symbol"],
        "name": config["name"],
        "category": config["category"],
        "value": _safe_float(
            matched_row.get("最新价")
            or matched_row.get("最新")
            or matched_row.get("最新值")
            or matched_row.get("收盘价")
        ),
        "change": _safe_float(
            matched_row.get("涨跌额")
            or matched_row.get("涨跌")
            or matched_row.get("变化值")
        ),
        "changePercent": _safe_float(
            matched_row.get("涨跌幅")
            or matched_row.get("涨跌幅%")
            or matched_row.get("变化幅度")
        ),
        "date": _normalize_series_date(
            matched_row.get("最新行情时间")
            or matched_row.get("更新时间")
            or matched_row.get("日期")
            or matched_row.get("时间")
        ),
        "provider": "akshare",
    }


def _search_hk_equities(query: str) -> List[Dict[str, Any]]:
    universe = _load_hk_universe()
    lowered = query.lower()
    rows: List[Dict[str, Any]] = []
    for _, row in universe.iterrows():
        code = str(row.get("代码", "")).strip().zfill(5)
        name = str(row.get("名称", "")).strip()
        rank = _match_rank(query, code, name)
        if rank is None:
            continue
        rows.append(
            {
                "symbol": code,
                "name": name,
                "displayName": name or code,
                "market": "HK",
                "exchange": "HKEX",
                "assetId": f"HK:{code}",
                "_rank": rank,
            }
        )
    return rows


def _search_cn_equities(query: str) -> List[Dict[str, Any]]:
    universe = _load_cn_universe()
    rows: List[Dict[str, Any]] = []
    for _, row in universe.iterrows():
        code = str(row.get("code", "")).strip().zfill(6)
        name = str(row.get("name", "")).strip()
        rank = _match_rank(query, code, name)
        if rank is None:
            continue
        rows.append(
            {
                "symbol": code,
                "name": name,
                "displayName": name or code,
                "market": "CN",
                "exchange": market_exchange("CN", code),
                "assetId": f"CN:{code}",
                "_rank": rank,
            }
        )
    return rows


def _build_hk_snapshot(asset: Dict[str, Any]) -> Dict[str, Any]:
    quote_row = _load_hk_spot_row(asset["symbol"])
    history_df = _load_history(asset, period="1y")
    profile = _load_hk_profile(asset["symbol"])
    announcements = _load_announcements(asset, limit=5)

    company_name = _clean_string(profile.get("公司名称")) or _clean_string(quote_row.get("名称")) or asset["symbol"]
    overview = _clean_string(profile.get("公司介绍"))
    week_high, week_low, day50, day200 = _compute_history_levels(history_df)

    return {
        "symbol": asset["symbol"],
        "assetId": asset["assetId"],
        "displaySymbol": asset["displaySymbol"],
        "market": asset["market"],
        "marketLabel": market_label(asset["market"]),
        "exchange": asset["exchange"],
        "currency": "HKD",
        "companyName": company_name,
        "price": _safe_float(quote_row.get("最新价")),
        "change": _safe_float(quote_row.get("涨跌额")),
        "changePercent": _safe_float(quote_row.get("涨跌幅")),
        "marketCap": "N/A",
        "fundamentals": {
            "overview": overview or "Hong Kong company profile available in the Fundamentals page.",
            "industry": _clean_string(profile.get("所属行业")),
            "exchange": asset["exchange"],
            "market": asset["market"],
            "week52High": week_high,
            "week52Low": week_low,
            "day50MovingAverage": day50,
            "day200MovingAverage": day200,
        },
        "financials": {},
        "relatedNews": announcements,
        "readOnlyResearchOnly": True,
    }


def _build_cn_snapshot(asset: Dict[str, Any]) -> Dict[str, Any]:
    quote_row = _load_cn_spot_row(asset["symbol"])
    profile = _load_cn_profile(asset["symbol"])
    info_map = _load_cn_info(asset["symbol"])
    history_df = _load_history(asset, period="1y")
    announcements = _load_announcements(asset, limit=5)
    week_high, week_low, day50, day200 = _compute_history_levels(history_df)

    company_name = _clean_string(profile.get("公司名称")) or _clean_string(info_map.get("股票简称")) or _clean_string(quote_row.get("名称")) or asset["symbol"]
    overview = _clean_string(profile.get("机构简介")) or _clean_string(profile.get("主营业务"))

    return {
        "symbol": asset["symbol"],
        "assetId": asset["assetId"],
        "displaySymbol": asset["displaySymbol"],
        "market": asset["market"],
        "marketLabel": market_label(asset["market"]),
        "exchange": asset["exchange"],
        "currency": "CNY",
        "companyName": company_name,
        "price": _safe_float(quote_row.get("最新价")),
        "change": _safe_float(quote_row.get("涨跌额")),
        "changePercent": _safe_float(quote_row.get("涨跌幅")),
        "marketCap": _format_market_cap(_safe_float(quote_row.get("总市值"))),
        "fundamentals": {
            "overview": overview or "China A-share company profile available in the Fundamentals page.",
            "industry": _clean_string(profile.get("所属行业")) or _clean_string(info_map.get("行业")),
            "exchange": asset["exchange"],
            "market": asset["market"],
            "peRatio": _safe_float(quote_row.get("市盈率-动态")),
            "priceToBook": _safe_float(quote_row.get("市净率")),
            "week52High": week_high,
            "week52Low": week_low,
            "day50MovingAverage": day50,
            "day200MovingAverage": day200,
        },
        "financials": {},
        "relatedNews": announcements,
        "readOnlyResearchOnly": True,
    }


def _build_hk_fundamentals(asset: Dict[str, Any]) -> Dict[str, Any]:
    quote_row = _load_hk_spot_row(asset["symbol"])
    profile = _load_hk_profile(asset["symbol"])
    history_df = _load_history(asset, period="1y")
    announcements = _load_announcements(asset, limit=8)
    week_high, week_low, day50, day200 = _compute_history_levels(history_df)

    description = _clean_string(profile.get("公司介绍"))
    research_profile = _profile_rows(
        [
            ("Company", profile.get("公司名称")),
            ("Industry", profile.get("所属行业")),
            ("Chairman", profile.get("董事长")),
            ("Secretary", profile.get("公司秘书")),
            ("Founded", profile.get("公司成立日期")),
            ("Website", profile.get("公司网址")),
            ("Employees", profile.get("员工人数")),
            ("Registered In", profile.get("注册地")),
        ]
    )

    return {
        "symbol": asset["symbol"],
        "assetId": asset["assetId"],
        "market": asset["market"],
        "exchange": asset["exchange"],
        "currency": "HKD",
        "name": _clean_string(profile.get("公司名称")) or _clean_string(quote_row.get("名称")) or asset["symbol"],
        "description": description or "Company profile data is available from Eastmoney via Akshare.",
        "sector": _clean_string(profile.get("所属行业")),
        "industry": _clean_string(profile.get("所属行业")),
        "market_cap": None,
        "pe_ratio": None,
        "forward_pe": None,
        "trailing_pe": None,
        "peg_ratio": None,
        "eps": None,
        "beta": None,
        "book_value": None,
        "dividend_per_share": None,
        "dividend_yield": None,
        "dividend_date": None,
        "ex_dividend_date": None,
        "profit_margin": None,
        "operating_margin_ttm": None,
        "return_on_assets_ttm": None,
        "return_on_equity_ttm": None,
        "revenue_ttm": None,
        "gross_profit_ttm": None,
        "diluted_eps_ttm": None,
        "revenue_per_share_ttm": None,
        "quarterly_earnings_growth_yoy": None,
        "quarterly_revenue_growth_yoy": None,
        "analyst_target_price": None,
        "price_to_sales_ratio_ttm": None,
        "price_to_book_ratio": None,
        "ev_to_revenue": None,
        "ev_to_ebitda": None,
        "week_52_high": week_high,
        "week_52_low": week_low,
        "day_50_moving_average": day50,
        "day_200_moving_average": day200,
        "shares_outstanding": None,
        "researchProfile": research_profile,
        "announcements": announcements,
        "provider": "akshare",
    }


def _build_cn_fundamentals(asset: Dict[str, Any]) -> Dict[str, Any]:
    quote_row = _load_cn_spot_row(asset["symbol"])
    profile = _load_cn_profile(asset["symbol"])
    info_map = _load_cn_info(asset["symbol"])
    history_df = _load_history(asset, period="1y")
    announcements = _load_announcements(asset, limit=8)
    week_high, week_low, day50, day200 = _compute_history_levels(history_df)

    research_profile = _profile_rows(
        [
            ("Company", profile.get("公司名称")),
            ("Industry", profile.get("所属行业") or info_map.get("行业")),
            ("Business", profile.get("主营业务")),
            ("Representative", profile.get("法人代表")),
            ("Listed", profile.get("上市日期") or info_map.get("上市时间")),
            ("Website", profile.get("官方网站")),
            ("Email", profile.get("电子邮箱")),
            ("Office", profile.get("办公地址")),
        ]
    )

    return {
        "symbol": asset["symbol"],
        "assetId": asset["assetId"],
        "market": asset["market"],
        "exchange": asset["exchange"],
        "currency": "CNY",
        "name": _clean_string(profile.get("公司名称")) or _clean_string(info_map.get("股票简称")) or _clean_string(quote_row.get("名称")) or asset["symbol"],
        "description": _clean_string(profile.get("机构简介")) or _clean_string(profile.get("主营业务")) or "Company overview data is available from CNInfo via Akshare.",
        "sector": _clean_string(profile.get("所属行业")) or _clean_string(info_map.get("行业")),
        "industry": _clean_string(profile.get("所属行业")) or _clean_string(info_map.get("行业")),
        "market_cap": _safe_float(quote_row.get("总市值")) or _safe_float(info_map.get("总市值")),
        "pe_ratio": _safe_float(quote_row.get("市盈率-动态")),
        "forward_pe": None,
        "trailing_pe": _safe_float(quote_row.get("市盈率-动态")),
        "peg_ratio": None,
        "eps": None,
        "beta": None,
        "book_value": None,
        "dividend_per_share": None,
        "dividend_yield": None,
        "dividend_date": None,
        "ex_dividend_date": None,
        "profit_margin": None,
        "operating_margin_ttm": None,
        "return_on_assets_ttm": None,
        "return_on_equity_ttm": None,
        "revenue_ttm": None,
        "gross_profit_ttm": None,
        "diluted_eps_ttm": None,
        "revenue_per_share_ttm": None,
        "quarterly_earnings_growth_yoy": None,
        "quarterly_revenue_growth_yoy": None,
        "analyst_target_price": None,
        "price_to_sales_ratio_ttm": None,
        "price_to_book_ratio": _safe_float(quote_row.get("市净率")),
        "ev_to_revenue": None,
        "ev_to_ebitda": None,
        "week_52_high": week_high,
        "week_52_low": week_low,
        "day_50_moving_average": day50,
        "day_200_moving_average": day200,
        "shares_outstanding": _safe_float(info_map.get("总股本")),
        "researchProfile": research_profile,
        "announcements": announcements,
        "provider": "akshare",
    }


def _load_hk_universe():
    cache_key = "hk"
    cached = _cache_get(_SEARCH_CACHE, cache_key)
    if cached is not None:
        return cached
    ak = _load_akshare_module()
    return _cache_set(_SEARCH_CACHE, cache_key, ak.stock_hk_spot_em(), SEARCH_CACHE_TTL_SECONDS)


def _load_cn_universe():
    cache_key = "cn"
    cached = _cache_get(_SEARCH_CACHE, cache_key)
    if cached is not None:
        return cached
    ak = _load_akshare_module()
    return _cache_set(_SEARCH_CACHE, cache_key, ak.stock_info_a_code_name(), SEARCH_CACHE_TTL_SECONDS)


def _load_hk_spot_row(symbol: str) -> Dict[str, Any]:
    cache_key = ("hk", symbol)
    cached = _cache_get(_SPOT_CACHE, cache_key)
    if cached is not None:
        return cached
    universe = _load_hk_universe()
    filtered = universe[universe["代码"].astype(str).str.zfill(5) == str(symbol).zfill(5)]
    if filtered.empty:
        raise AkshareAssetNotFoundError(f"No Hong Kong equity data found for {symbol}.")
    row = filtered.iloc[0].to_dict()
    return _cache_set(_SPOT_CACHE, cache_key, row, SPOT_CACHE_TTL_SECONDS)


def _load_cn_spot_row(symbol: str) -> Dict[str, Any]:
    cache_key = ("cn", symbol)
    cached = _cache_get(_SPOT_CACHE, cache_key)
    if cached is not None:
        return cached
    ak = _load_akshare_module()
    spot_df = ak.stock_zh_a_spot_em()
    filtered = spot_df[spot_df["代码"].astype(str).str.zfill(6) == str(symbol).zfill(6)]
    if filtered.empty:
        raise AkshareAssetNotFoundError(f"No China A-share data found for {symbol}.")
    row = filtered.iloc[0].to_dict()
    return _cache_set(_SPOT_CACHE, cache_key, row, SPOT_CACHE_TTL_SECONDS)


def _load_hk_profile(symbol: str) -> Dict[str, Any]:
    cache_key = ("hk", symbol)
    cached = _cache_get(_PROFILE_CACHE, cache_key)
    if cached is not None:
        return cached
    ak = _load_akshare_module()
    profile_df = ak.stock_hk_company_profile_em(symbol=symbol)
    row = profile_df.iloc[0].to_dict() if not profile_df.empty else {}
    return _cache_set(_PROFILE_CACHE, cache_key, row, PROFILE_CACHE_TTL_SECONDS)


def _load_cn_profile(symbol: str) -> Dict[str, Any]:
    cache_key = ("cn_profile", symbol)
    cached = _cache_get(_PROFILE_CACHE, cache_key)
    if cached is not None:
        return cached
    ak = _load_akshare_module()
    profile_df = ak.stock_profile_cninfo(symbol=symbol)
    row = profile_df.iloc[0].to_dict() if not profile_df.empty else {}
    return _cache_set(_PROFILE_CACHE, cache_key, row, PROFILE_CACHE_TTL_SECONDS)


def _load_cn_info(symbol: str) -> Dict[str, Any]:
    cache_key = ("cn_info", symbol)
    cached = _cache_get(_PROFILE_CACHE, cache_key)
    if cached is not None:
        return cached
    ak = _load_akshare_module()
    info_df = ak.stock_individual_info_em(symbol=symbol)
    row = {str(item.get("item")): item.get("value") for item in info_df.to_dict("records")} if not info_df.empty else {}
    return _cache_set(_PROFILE_CACHE, cache_key, row, PROFILE_CACHE_TTL_SECONDS)


def _load_history(asset: Dict[str, Any], *, period: str = "6mo"):
    cache_key = (asset["assetId"], period)
    cached = _cache_get(_HISTORY_CACHE, cache_key)
    if cached is not None:
        return cached

    ak = _load_akshare_module()
    start_date = _period_start_date(period)
    end_date = datetime.utcnow().strftime("%Y%m%d")
    if asset["market"] == "HK":
        history_df = ak.stock_hk_hist(
            symbol=asset["symbol"],
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust="qfq",
        )
    elif asset["market"] == "CN":
        history_df = ak.stock_zh_a_hist(
            symbol=asset["symbol"],
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust="qfq",
        )
    else:
        raise AkshareUnavailableError("Akshare history is only available for HK and CN markets.")
    return _cache_set(_HISTORY_CACHE, cache_key, history_df, HISTORY_CACHE_TTL_SECONDS)


def _load_announcements(asset: Dict[str, Any], *, limit: int = 8) -> List[Dict[str, Any]]:
    cache_key = (asset["assetId"], limit)
    cached = _cache_get(_ANNOUNCEMENTS_CACHE, cache_key)
    if cached is not None:
        return cached

    ak = _load_akshare_module()
    end_date = datetime.utcnow().strftime("%Y%m%d")
    start_date = (datetime.utcnow() - timedelta(days=180)).strftime("%Y%m%d")
    disclosure_market = "港股" if asset["market"] == "HK" else "沪深京"
    try:
        disclosure_df = ak.stock_zh_a_disclosure_report_cninfo(
            symbol=asset["symbol"],
            market=disclosure_market,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception:
        disclosure_df = None

    rows: List[Dict[str, Any]] = []
    if disclosure_df is not None and not disclosure_df.empty:
        for _, row in disclosure_df.head(limit).iterrows():
            rows.append(
                {
                    "title": _clean_string(row.get("公告标题")) or "Company announcement",
                    "description": _clean_string(row.get("公告标题")) or "Company announcement",
                    "publisher": "CNInfo",
                    "publishTime": _clean_string(row.get("公告时间")),
                    "link": _clean_string(row.get("公告链接")),
                    "type": "Announcement",
                    "date": _clean_date(row.get("公告时间")),
                }
            )
    return _cache_set(_ANNOUNCEMENTS_CACHE, cache_key, rows, ANNOUNCEMENTS_CACHE_TTL_SECONDS)


def _period_start_date(period: str) -> str:
    now = datetime.utcnow()
    days = {
        "1d": 7,
        "5d": 14,
        "14d": 30,
        "1mo": 45,
        "6mo": 210,
        "1y": 400,
    }.get(str(period or "6mo"), 210)
    return (now - timedelta(days=days)).strftime("%Y%m%d")


def _profile_rows(items: List[tuple[str, Any]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for label, value in items:
        cleaned = _clean_string(value)
        if cleaned:
            rows.append({"label": label, "value": cleaned})
    return rows


def _compute_history_levels(history_df) -> tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    if history_df is None or history_df.empty:
        return None, None, None, None
    high = _safe_float(history_df["最高"].max()) if "最高" in history_df.columns else None
    low = _safe_float(history_df["最低"].min()) if "最低" in history_df.columns else None
    close_series = history_df["收盘"] if "收盘" in history_df.columns else None
    if close_series is None or close_series.empty:
        return high, low, None, None
    day50 = _safe_float(close_series.tail(50).mean())
    day200 = _safe_float(close_series.tail(200).mean())
    return high, low, day50, day200


def _match_rank(query: str, code: str, name: str) -> Optional[int]:
    normalized_query = str(query or "").strip().lower()
    if not normalized_query:
        return None
    normalized_code = str(code or "").strip().lower()
    normalized_name = str(name or "").strip().lower()
    if normalized_code == normalized_query:
        return 0
    if normalized_code.startswith(normalized_query):
        return 1
    if normalized_name == normalized_query:
        return 2
    if normalized_name.startswith(normalized_query):
        return 3
    if normalized_query in normalized_name:
        return 4
    return None


def _format_market_cap(value: Optional[float]) -> str:
    if value is None:
        return "N/A"
    abs_value = abs(value)
    if abs_value >= 1e12:
        return f"{value / 1e12:.2f}T"
    if abs_value >= 1e9:
        return f"{value / 1e9:.2f}B"
    if abs_value >= 1e6:
        return f"{value / 1e6:.2f}M"
    return f"{value:,.0f}"


def _clean_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _clean_date(value: Any) -> Optional[str]:
    text = _clean_string(value)
    if not text:
        return None
    return text[:10]


def _normalize_series_date(value: Any) -> Optional[str]:
    text = _clean_string(value)
    if not text:
        return None
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return text


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value in (None, "", "nan"):
            return None
        return round(float(value), 4)
    except (TypeError, ValueError):
        return None


def _cache_get(cache: Dict[Any, tuple[float, Any]], key: Any):
    cached = cache.get(key)
    if cached is None:
        return None
    expires_at, value = cached
    if expires_at < time.time():
        cache.pop(key, None)
        return None
    return value


def _cache_set(cache: Dict[Any, tuple[float, Any]], key: Any, value: Any, ttl_seconds: int):
    cache[key] = (time.time() + ttl_seconds, value)
    return value
