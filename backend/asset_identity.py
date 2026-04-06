from __future__ import annotations

import re
from typing import Any, Dict, Optional


SUPPORTED_MARKETS = {"US", "HK", "CN"}
MARKET_ALIASES = {
    "US": "US",
    "USA": "US",
    "NASDAQ": "US",
    "NYSE": "US",
    "HK": "HK",
    "HKG": "HK",
    "HKEX": "HK",
    "CN": "CN",
    "CHN": "CN",
    "A": "CN",
    "ASHARE": "CN",
    "A-SHARE": "CN",
    "SH": "CN",
    "SS": "CN",
    "SZ": "CN",
}
HK_SUFFIXES = (".HK",)
CN_SSE_SUFFIXES = (".SS", ".SH")
CN_SZSE_SUFFIXES = (".SZ",)
TRUE_VALUES = {"1", "true", "yes", "on"}


def normalize_market(value: Optional[str], *, default: Optional[str] = None) -> Optional[str]:
    raw_value = str(value or "").strip().upper()
    if not raw_value:
        return default
    return MARKET_ALIASES.get(raw_value, default)


def market_label(market: Optional[str]) -> str:
    normalized_market = normalize_market(market, default="US")
    return {
        "US": "United States",
        "HK": "Hong Kong",
        "CN": "China A-Shares",
    }.get(normalized_market, "Unknown")


def market_exchange(market: Optional[str], symbol: Optional[str] = None) -> str:
    normalized_market = normalize_market(market, default="US")
    if normalized_market == "US":
        return "US"
    if normalized_market == "HK":
        return "HKEX"
    if normalized_market == "CN":
        raw_symbol = str(symbol or "").strip()
        if raw_symbol.startswith(("6", "9")):
            return "SSE"
        if raw_symbol.startswith(("0", "2", "3")):
            return "SZSE"
        if raw_symbol.startswith(("4", "8")):
            return "BSE"
        return "CN"
    return "Unknown"


def asset_id_for(symbol: str, market: Optional[str]) -> str:
    normalized_market = normalize_market(market, default="US")
    normalized_symbol = normalize_symbol(symbol, normalized_market)
    if normalized_market == "US":
        return f"US:{normalized_symbol}"
    return f"{normalized_market}:{normalized_symbol}"


def parse_asset_reference(ticker: Optional[str], market: Optional[str] = None) -> Dict[str, Any]:
    raw_value = str(ticker or "").strip()
    if not raw_value:
        raise ValueError("Ticker is required.")

    explicit_market = None
    symbol = raw_value

    if ":" in raw_value:
        prefix, remainder = raw_value.split(":", 1)
        normalized_prefix = normalize_market(prefix)
        if normalized_prefix and remainder.strip():
            explicit_market = normalized_prefix
            symbol = remainder.strip()

    suffix_market = _market_from_suffix(symbol)
    if suffix_market:
        explicit_market = suffix_market
        symbol = _strip_known_suffix(symbol)

    normalized_market = explicit_market or normalize_market(market, default="US")
    normalized_symbol = normalize_symbol(symbol, normalized_market)
    asset_id = asset_id_for(normalized_symbol, normalized_market)

    return {
        "assetId": asset_id,
        "symbol": normalized_symbol,
        "displaySymbol": normalized_symbol,
        "market": normalized_market,
        "marketLabel": market_label(normalized_market),
        "exchange": market_exchange(normalized_market, normalized_symbol),
        "providerSymbol": normalized_symbol,
        "isInternational": normalized_market in {"HK", "CN"},
    }


def normalize_symbol(symbol: Optional[str], market: Optional[str] = None) -> str:
    normalized_market = normalize_market(market, default="US")
    raw_symbol = _strip_known_suffix(str(symbol or "").strip())
    if not raw_symbol:
        raise ValueError("Ticker is required.")

    if normalized_market == "US":
        return raw_symbol.upper()

    digits = re.sub(r"\D", "", raw_symbol)
    if normalized_market == "HK":
        if not digits:
            raise ValueError("Hong Kong symbols must contain numeric codes.")
        return digits.zfill(5)
    if normalized_market == "CN":
        if not digits:
            raise ValueError("China A-share symbols must contain numeric codes.")
        return digits.zfill(6)

    return raw_symbol.upper()


def is_market_enabled(env_value: Optional[str]) -> bool:
    return str(env_value or "").strip().lower() in TRUE_VALUES


def _market_from_suffix(symbol: str) -> Optional[str]:
    upper_symbol = str(symbol or "").strip().upper()
    if upper_symbol.endswith(HK_SUFFIXES):
        return "HK"
    if upper_symbol.endswith(CN_SSE_SUFFIXES) or upper_symbol.endswith(CN_SZSE_SUFFIXES):
        return "CN"
    return None


def _strip_known_suffix(symbol: str) -> str:
    upper_symbol = str(symbol or "").strip().upper()
    for suffix in HK_SUFFIXES + CN_SSE_SUFFIXES + CN_SZSE_SUFFIXES:
        if upper_symbol.endswith(suffix):
            return upper_symbol[: -len(suffix)]
    return upper_symbol
