"""
Prediction markets data fetcher using dr-manhattan library.
Provides unified access to Polymarket, Kalshi, and other prediction market exchanges.
"""
import json
import time
import threading
from typing import Optional, Dict, List, Any
from urllib.parse import urlparse

import requests

try:
    import dr_manhattan
    DR_MANHATTAN_AVAILABLE = True
except ImportError:
    dr_manhattan = None
    DR_MANHATTAN_AVAILABLE = False

# --- In-memory cache ---
_cache: Dict[str, Dict] = {}
_cache_lock = threading.Lock()
CACHE_TTL_SECONDS = 120  # 2-minute TTL
POLYMARKET_GAMMA_BASE_URL = "https://gamma-api.polymarket.com"
POLYMARKET_HTTP_TIMEOUT_SECONDS = 15

# Map exchange names to their dr-manhattan classes
EXCHANGE_CLASSES = {}
if DR_MANHATTAN_AVAILABLE:
    EXCHANGE_CLASSES = {
        'polymarket': dr_manhattan.Polymarket,
        'limitless': dr_manhattan.Limitless,
    }
SUPPORTED_EXCHANGES = list(EXCHANGE_CLASSES.keys())
DEFAULT_EXCHANGE = 'polymarket'
DEFAULT_LIMIT = 50


class PredictionMarketLookupError(Exception):
    def __init__(self, message: str, *, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number > 1:
        number = number / 100.0
    return max(0.0, min(1.0, number))


def _coerce_metric(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_list_payload(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def _normalize_outcomes(value: Any) -> List[str]:
    parsed = _parse_list_payload(value)
    outcomes = [str(item).strip() for item in parsed if str(item).strip()]
    return outcomes


def _normalize_prices_for_outcomes(outcomes: List[str], value: Any) -> Dict[str, float]:
    parsed = _parse_list_payload(value)
    if not outcomes or not parsed:
        return {}
    prices: Dict[str, float] = {}
    for outcome, raw_price in zip(outcomes, parsed):
        prices[str(outcome)] = _coerce_float(raw_price)
    return prices


def _first_non_empty(*values: Any) -> Optional[Any]:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _extract_market_probability(prices: Dict[str, float], outcomes: List[str], fallback_value: Any = None) -> float:
    if fallback_value is not None:
        return _coerce_float(fallback_value)

    normalized_prices = {str(key).strip().lower(): _coerce_float(value) for key, value in (prices or {}).items()}
    if 'yes' in normalized_prices:
        return normalized_prices['yes']

    if outcomes:
        first_outcome = str(outcomes[0]).strip().lower()
        if first_outcome in normalized_prices:
            return normalized_prices[first_outcome]

    if prices:
        first_price = next(iter(prices.values()))
        return _coerce_float(first_price)

    return 0.5


def _build_source_url(exchange: str, market_id: Optional[str]) -> Optional[str]:
    market_slug = str(market_id or '').strip().strip('/')
    if not market_slug:
        return None
    if exchange == 'polymarket':
        return f"https://polymarket.com/event/{market_slug}"
    return None


def _normalize_market_for_analysis(market: Dict[str, Any], exchange: str = DEFAULT_EXCHANGE) -> Dict[str, Any]:
    outcomes = [str(item).strip() for item in (market.get("outcomes") or []) if str(item).strip()]
    prices = {
        str(key): _coerce_float(value)
        for key, value in dict(market.get("prices") or {}).items()
    }
    market_id = str(market.get("id") or "").strip()
    return {
        "id": market_id,
        "exchange": exchange,
        "question": str(market.get("question") or "").strip(),
        "event_title": str(market.get("event_title") or "").strip() or None,
        "description": str(market.get("description") or "").strip(),
        "outcomes": outcomes,
        "prices": prices,
        "close_time": _first_non_empty(market.get("close_time"), market.get("end_date")),
        "volume": _coerce_metric(market.get("volume")),
        "liquidity": _coerce_metric(market.get("liquidity")),
        "is_binary": bool(market.get("is_binary", len(outcomes) == 2)),
        "is_open": bool(market.get("is_open", True)),
        "spread": market.get("spread"),
        "source_url": str(market.get("source_url") or _build_source_url(exchange, market_id) or "").strip() or None,
        "current_probability": _extract_market_probability(
            prices,
            outcomes,
            market.get("current_probability"),
        ),
    }


def _parse_polymarket_reference(reference: str) -> str:
    raw_reference = str(reference or "").strip()
    if not raw_reference:
        raise PredictionMarketLookupError("A Polymarket market reference is required", status_code=400)

    parsed = urlparse(raw_reference)
    if parsed.scheme and parsed.netloc:
        hostname = (parsed.hostname or "").lower()
        if hostname not in {"polymarket.com", "www.polymarket.com"}:
            raise PredictionMarketLookupError("Invalid Polymarket URL format", status_code=422)
        path = parsed.path.strip("/")
        segments = [segment for segment in path.split("/") if segment]
        if not segments:
            raise PredictionMarketLookupError("Invalid Polymarket URL format", status_code=422)
        return segments[-1]

    return raw_reference.strip("/").split("/")[-1]


def _normalize_polymarket_payload(payload: Dict[str, Any], fallback_slug: str) -> Dict[str, Any]:
    outcomes = _normalize_outcomes(payload.get("outcomes"))
    prices = _normalize_prices_for_outcomes(outcomes, payload.get("outcomePrices"))
    if not prices and outcomes:
        yes_price = _first_non_empty(payload.get("yes_price"), payload.get("yesPrice"))
        no_price = _first_non_empty(payload.get("no_price"), payload.get("noPrice"))
        if yes_price is not None and no_price is not None and len(outcomes) >= 2:
            prices = {
                outcomes[0]: _coerce_float(yes_price),
                outcomes[1]: _coerce_float(no_price),
            }

    question = str(_first_non_empty(payload.get("question"), payload.get("title")) or "").strip()
    market_id = str(_first_non_empty(payload.get("slug"), payload.get("market_slug"), payload.get("id"), fallback_slug) or "").strip()
    event_title = str(
        _first_non_empty(payload.get("event_title"), payload.get("_event_title"), payload.get("eventTitle")) or ""
    ).strip() or None
    description = str(
        _first_non_empty(
            payload.get("resolution_criteria"),
            payload.get("resolutionCriteria"),
            payload.get("rules"),
            payload.get("description"),
        ) or ""
    ).strip()

    is_open = True
    if payload.get("closed") is True or payload.get("active") is False:
        is_open = False

    return {
        "id": market_id,
        "exchange": "polymarket",
        "question": question,
        "event_title": event_title,
        "description": description,
        "outcomes": outcomes,
        "prices": prices,
        "close_time": _first_non_empty(
            payload.get("close_time"),
            payload.get("closeTime"),
            payload.get("end_date"),
            payload.get("endDate"),
            payload.get("end_date_iso"),
            payload.get("endDateIso"),
        ),
        "volume": _coerce_metric(
            _first_non_empty(payload.get("volume"), payload.get("volumeNum"), payload.get("volumeUsd"))
        ),
        "liquidity": _coerce_metric(
            _first_non_empty(payload.get("liquidity"), payload.get("liquidityClob"))
        ),
        "is_binary": bool(payload.get("is_binary", len(outcomes) == 2)),
        "is_open": is_open,
        "spread": payload.get("spread"),
        "source_url": _build_source_url("polymarket", market_id),
        "current_probability": _extract_market_probability(
            prices,
            outcomes,
            _first_non_empty(payload.get("current_probability"), payload.get("probability")),
        ),
    }


def _fetch_polymarket_market(reference: str) -> Dict[str, Any]:
    slug = _parse_polymarket_reference(reference)
    headers = {"Accept": "application/json"}
    market_url = f"{POLYMARKET_GAMMA_BASE_URL}/markets/slug/{slug}"
    event_url = f"{POLYMARKET_GAMMA_BASE_URL}/events/slug/{slug}"

    try:
        market_response = requests.get(market_url, headers=headers, timeout=POLYMARKET_HTTP_TIMEOUT_SECONDS)
        if market_response.status_code == 200:
            payload = market_response.json()
            if not isinstance(payload, dict):
                raise PredictionMarketLookupError("Unexpected Polymarket response format", status_code=502)
            return _normalize_polymarket_payload(payload, slug)
        if market_response.status_code not in {404}:
            market_response.raise_for_status()

        event_response = requests.get(event_url, headers=headers, timeout=POLYMARKET_HTTP_TIMEOUT_SECONDS)
        if event_response.status_code == 404:
            raise PredictionMarketLookupError("Prediction market not found", status_code=404)
        event_response.raise_for_status()

        event_payload = event_response.json()
        if not isinstance(event_payload, dict):
            raise PredictionMarketLookupError("Unexpected Polymarket event response format", status_code=502)

        markets = event_payload.get("markets")
        if not isinstance(markets, list) or not markets:
            raise PredictionMarketLookupError("Polymarket event response did not include any markets", status_code=502)

        first_market = markets[0]
        if not isinstance(first_market, dict):
            raise PredictionMarketLookupError("Unexpected market payload inside Polymarket event response", status_code=502)

        enriched_market = dict(first_market)
        enriched_market["event_title"] = _first_non_empty(event_payload.get("title"), event_payload.get("question"))
        return _normalize_polymarket_payload(enriched_market, slug)
    except PredictionMarketLookupError:
        raise
    except requests.RequestException as exc:
        raise PredictionMarketLookupError(
            f"Failed to fetch market data from Polymarket: {str(exc)}",
            status_code=502,
        ) from exc


def _get_cache_key(exchange: str, limit: int) -> str:
    return f"{exchange}:{limit}"


def _is_cache_valid(key: str) -> bool:
    if key not in _cache:
        return False
    return (time.time() - _cache[key]["timestamp"]) < CACHE_TTL_SECONDS


def _serialize_market(market) -> dict:
    """Convert a dr-manhattan Market dataclass into a JSON-serializable dict."""
    return {
        "id": market.id,
        "question": market.question,
        "outcomes": market.outcomes,
        "close_time": market.close_time.isoformat() if market.close_time else None,
        "volume": market.volume,
        "liquidity": market.liquidity,
        "prices": market.prices,
        "description": getattr(market, 'description', ''),
        "is_binary": market.is_binary,
        "is_open": market.is_open,
        "spread": market.spread,
    }


def get_exchange_list() -> List[str]:
    """Return list of supported exchange names."""
    return SUPPORTED_EXCHANGES


def fetch_markets(exchange: str = DEFAULT_EXCHANGE, limit: int = DEFAULT_LIMIT) -> List[dict]:
    """
    Fetch markets from a prediction market exchange.
    Results are cached for CACHE_TTL_SECONDS.
    """
    if not DR_MANHATTAN_AVAILABLE:
        return []

    exchange = exchange.lower()
    if exchange not in SUPPORTED_EXCHANGES:
        return []

    cache_key = _get_cache_key(exchange, limit)

    with _cache_lock:
        if _is_cache_valid(cache_key):
            return _cache[cache_key]["data"]

    try:
        exchange_cls = EXCHANGE_CLASSES[exchange]
        ex = exchange_cls({'timeout': 30})
        raw_markets = ex.fetch_markets({"limit": limit})
        serialized = [_serialize_market(m) for m in raw_markets if m.is_open]

        with _cache_lock:
            _cache[cache_key] = {
                "data": serialized,
                "timestamp": time.time()
            }

        return serialized
    except Exception as e:
        print(f"Error fetching markets from {exchange}: {e}")
        with _cache_lock:
            if cache_key in _cache:
                return _cache[cache_key]["data"]
        return []


def search_markets(query: str, exchange: str = DEFAULT_EXCHANGE, limit: int = DEFAULT_LIMIT) -> List[dict]:
    """Search/filter markets by keyword in question text."""
    all_markets = fetch_markets(exchange, limit)
    if not query:
        return all_markets
    query_lower = query.lower()
    return [m for m in all_markets if query_lower in m["question"].lower()]


def get_market_by_id(market_id: str, exchange: str = DEFAULT_EXCHANGE, limit: int = DEFAULT_LIMIT) -> Optional[dict]:
    """Find a single market by its ID from the cached/fetched list."""
    all_markets = fetch_markets(exchange, limit)
    for m in all_markets:
        if m["id"] == market_id:
            return m
    return None


def get_current_prices(market_id: str, exchange: str = DEFAULT_EXCHANGE) -> Optional[Dict[str, float]]:
    """Get current prices for a specific market."""
    market = get_market_by_id(market_id, exchange)
    if market:
        return market["prices"]
    return None


def resolve_market_for_analysis(
    *,
    market_id: Optional[str] = None,
    market_url: Optional[str] = None,
    exchange: str = DEFAULT_EXCHANGE,
    limit: int = DEFAULT_LIMIT,
) -> Dict[str, Any]:
    """Resolve a market by list ID or direct URL/slug into a stable analysis payload."""
    exchange = str(exchange or DEFAULT_EXCHANGE).strip().lower() or DEFAULT_EXCHANGE
    if exchange not in SUPPORTED_EXCHANGES:
        raise PredictionMarketLookupError(f"Unsupported exchange '{exchange}'", status_code=400)

    if bool(market_id) == bool(market_url):
        raise PredictionMarketLookupError("Exactly one of market_id or market_url is required", status_code=400)

    if market_url:
        if exchange != 'polymarket':
            raise PredictionMarketLookupError("Market URL import is currently only supported for Polymarket", status_code=422)
        return _fetch_polymarket_market(market_url)

    market = get_market_by_id(str(market_id), exchange, limit)
    if market:
        return _normalize_market_for_analysis(market, exchange)

    if exchange == 'polymarket':
        return _fetch_polymarket_market(str(market_id))

    raise PredictionMarketLookupError("Prediction market not found", status_code=404)
