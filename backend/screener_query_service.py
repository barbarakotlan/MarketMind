from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import duckdb

import screener_snapshot_service


PRESETS: Dict[str, Dict[str, Any]] = {
    "gainers": {
        "label": "Top Gainers",
        "description": "Liquid U.S. names with the strongest daily moves.",
        "default_sort": "percent_change",
        "default_dir": "desc",
        "preset_filters": {
            "price_min": 5.0,
            "avg_dollar_volume_min": 20_000_000.0,
        },
    },
    "losers": {
        "label": "Top Losers",
        "description": "Liquid U.S. names with the sharpest daily declines.",
        "default_sort": "percent_change",
        "default_dir": "asc",
        "preset_filters": {
            "price_min": 5.0,
            "avg_dollar_volume_min": 20_000_000.0,
        },
    },
    "active": {
        "label": "Most Active",
        "description": "Liquid names with the strongest relative volume surges.",
        "default_sort": "relative_volume_20d",
        "default_dir": "desc",
        "preset_filters": {
            "avg_dollar_volume_min": 20_000_000.0,
        },
    },
    "momentum_leaders": {
        "label": "Momentum Leaders",
        "description": "Names with positive 1M and 3M trends trading near 52-week highs.",
        "default_sort": "momentum_3m",
        "default_dir": "desc",
        "preset_filters": {
            "momentum_3m_min": 0.0,
            "momentum_1m_min": 0.0,
            "distance_from_52w_high_pct_max": 15.0,
            "avg_dollar_volume_min": 20_000_000.0,
        },
    },
    "near_highs": {
        "label": "Near Highs",
        "description": "Names trading within 10% of their 52-week highs.",
        "default_sort": "distance_from_52w_high_pct",
        "default_dir": "asc",
        "preset_filters": {
            "distance_from_52w_high_pct_max": 10.0,
            "avg_dollar_volume_min": 20_000_000.0,
        },
    },
    "oversold_rebounds": {
        "label": "Oversold Rebounds",
        "description": "Names rebounding off 52-week lows with a positive daily move.",
        "default_sort": "percent_change",
        "default_dir": "desc",
        "preset_filters": {
            "distance_from_52w_low_pct_max": 15.0,
            "day_change_pct_min": 0.0,
            "avg_dollar_volume_min": 20_000_000.0,
        },
    },
}

SUPPORTED_SORTS = {
    "symbol",
    "name",
    "sector",
    "price",
    "change",
    "percent_change",
    "market_cap",
    "volume",
    "avg_dollar_volume_30d",
    "relative_volume_20d",
    "momentum_1m",
    "momentum_3m",
    "momentum_6m",
    "distance_from_52w_high_pct",
    "distance_from_52w_low_pct",
    "volatility_30d",
    "pe_forward",
    "year_high",
    "year_low",
    "target_upside_pct",
}


def _coerce_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def list_presets(*, sectors: List[str]) -> Dict[str, Any]:
    return {
        "presets": [
            {
                "key": key,
                "label": preset["label"],
                "description": preset["description"],
                "defaultSort": preset["default_sort"],
                "defaultDir": preset["default_dir"],
                "supportedFilters": ["query", "price_min", "price_max", "market_cap_min", "avg_dollar_volume_min", "sector"],
            }
            for key, preset in PRESETS.items()
        ],
        "sectors": sectors,
    }


def _normalize_sort(preset_key: str, sort_key: Optional[str], direction: Optional[str]) -> Tuple[str, str]:
    preset = PRESETS.get(preset_key, PRESETS["gainers"])
    normalized_sort = str(sort_key or preset["default_sort"]).strip()
    if normalized_sort not in SUPPORTED_SORTS:
        normalized_sort = preset["default_sort"]
    normalized_dir = str(direction or preset["default_dir"]).strip().lower()
    if normalized_dir not in {"asc", "desc"}:
        normalized_dir = preset["default_dir"]
    return normalized_sort, normalized_dir


def _build_where_clauses(preset_key: str, filters: Dict[str, Any]) -> Tuple[List[str], List[Any]]:
    clauses = ["1=1"]
    params: List[Any] = []
    preset_filters = dict(PRESETS.get(preset_key, PRESETS["gainers"]).get("preset_filters", {}))

    query = str(filters.get("query") or "").strip().lower()
    if query:
        clauses.append("(lower(symbol) LIKE ? OR lower(name) LIKE ?)")
        params.extend([f"%{query}%", f"%{query}%"])

    sector = str(filters.get("sector") or "").strip()
    if sector:
        clauses.append("sector = ?")
        params.append(sector)

    price_min = _coerce_float(filters.get("price_min"))
    price_max = _coerce_float(filters.get("price_max"))
    market_cap_min = _coerce_float(filters.get("market_cap_min"))
    avg_dollar_volume_min = _coerce_float(filters.get("avg_dollar_volume_min"))

    numeric_filters = {
        "price_min": ("price >= ?", price_min),
        "price_max": ("price <= ?", price_max),
        "market_cap_min": ("market_cap >= ?", market_cap_min),
        "avg_dollar_volume_min": ("avg_dollar_volume_30d >= ?", avg_dollar_volume_min),
    }

    for key, (clause, value) in numeric_filters.items():
        applied_value = value
        if applied_value is None and key in preset_filters:
            applied_value = preset_filters[key]
        if applied_value is not None:
            clauses.append(clause)
            params.append(applied_value)

    preset_specific = {
        "momentum_3m_min": "momentum_3m >= ?",
        "momentum_1m_min": "momentum_1m >= ?",
        "distance_from_52w_high_pct_max": "distance_from_52w_high_pct <= ?",
        "distance_from_52w_low_pct_max": "distance_from_52w_low_pct <= ?",
        "day_change_pct_min": "percent_change >= ?",
    }

    for key, clause in preset_specific.items():
        value = preset_filters.get(key)
        if value is not None:
            clauses.append(clause)
            params.append(value)

    return clauses, params


def _sanitize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sanitized: List[Dict[str, Any]] = []
    for row in rows:
        formatted = {}
        for key, value in row.items():
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                formatted[key] = None
            else:
                formatted[key] = value
        sanitized.append(formatted)
    return sanitized


def scan(
    *,
    base_dir: str,
    yf_module,
    logger,
    preset: str = "gainers",
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[str] = None,
    direction: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    normalized_preset = preset if preset in PRESETS else "gainers"
    filters = dict(filters or {})
    limit = max(1, min(int(limit or 50), 200))
    offset = max(0, int(offset or 0))

    meta = screener_snapshot_service.ensure_snapshot(base_dir=base_dir, yf_module=yf_module, logger=logger)
    snapshot = screener_snapshot_service.snapshot_path(base_dir=base_dir)
    sectors = screener_snapshot_service.available_sectors(base_dir=base_dir)

    sort_key, sort_dir = _normalize_sort(normalized_preset, sort, direction)
    clauses, params = _build_where_clauses(normalized_preset, filters)

    order_sql = f"{sort_key} {sort_dir.upper()} NULLS LAST, symbol ASC"
    base_sql = f"FROM read_parquet(?) WHERE {' AND '.join(clauses)}"
    query_params = [snapshot, *params]

    connection = duckdb.connect(database=":memory:")
    try:
        total = int(connection.execute(f"SELECT COUNT(*) {base_sql}", query_params).fetchone()[0])
        rows = connection.execute(
            f"SELECT * {base_sql} ORDER BY {order_sql} LIMIT ? OFFSET ?",
            [*query_params, limit, offset],
        ).fetchdf().to_dict(orient="records")
    finally:
        connection.close()

    payload_meta = {
        "asOf": meta.get("asOf"),
        "lastRefresh": meta.get("lastRefresh"),
        "snapshotStatus": meta.get("snapshotStatus", "fresh"),
        "total": total,
        "limit": limit,
        "offset": offset,
        "universeSize": meta.get("universeSize"),
        "warnings": list(meta.get("warnings", [])),
        "sort": sort_key,
        "dir": sort_dir,
    }

    normalized_filters = {
        "preset": normalized_preset,
        "query": str(filters.get("query") or "").strip(),
        "price_min": _coerce_float(filters.get("price_min")),
        "price_max": _coerce_float(filters.get("price_max")),
        "market_cap_min": _coerce_float(filters.get("market_cap_min")),
        "avg_dollar_volume_min": _coerce_float(filters.get("avg_dollar_volume_min")),
        "sector": str(filters.get("sector") or "").strip() or None,
        "availableSectors": sectors,
    }

    return {
        "rows": _sanitize_rows(rows),
        "meta": payload_meta,
        "filters": normalized_filters,
    }


def movers_payload(*, base_dir: str, yf_module, logger, limit: int = 8) -> Dict[str, Any]:
    gainers = scan(base_dir=base_dir, yf_module=yf_module, logger=logger, preset="gainers", limit=limit, offset=0)
    losers = scan(base_dir=base_dir, yf_module=yf_module, logger=logger, preset="losers", limit=limit, offset=0)
    active = scan(base_dir=base_dir, yf_module=yf_module, logger=logger, preset="active", limit=limit, offset=0)
    return {
        "gainers": gainers["rows"],
        "losers": losers["rows"],
        "active": active["rows"],
        "meta": {
            "asOf": gainers["meta"].get("asOf"),
            "lastRefresh": gainers["meta"].get("lastRefresh"),
            "snapshotStatus": gainers["meta"].get("snapshotStatus", "fresh"),
            "universeSize": gainers["meta"].get("universeSize"),
            "warnings": gainers["meta"].get("warnings", []),
        },
    }
