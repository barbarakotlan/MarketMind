"""
Prediction markets data fetcher using dr-manhattan library.
Provides unified access to Polymarket, Kalshi, and other prediction market exchanges.
"""
import time
import threading
from typing import Optional, Dict, List, Any

import dr_manhattan

# --- In-memory cache ---
_cache: Dict[str, Dict] = {}
_cache_lock = threading.Lock()
CACHE_TTL_SECONDS = 120  # 2-minute TTL

# Map exchange names to their dr-manhattan classes
EXCHANGE_CLASSES = {
    'polymarket': dr_manhattan.Polymarket,
    'limitless': dr_manhattan.Limitless,
}
SUPPORTED_EXCHANGES = list(EXCHANGE_CLASSES.keys())
DEFAULT_EXCHANGE = 'polymarket'
DEFAULT_LIMIT = 50


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
