from __future__ import annotations

import csv
import os
from functools import lru_cache
from typing import Dict, List


UNIVERSE_FILENAME = "screener_universe.csv"
MODULE_DIR = os.path.dirname(os.path.abspath(__file__))


def universe_manifest_path() -> str:
    return os.path.join(MODULE_DIR, UNIVERSE_FILENAME)


@lru_cache(maxsize=16)
def _load_cached(manifest_path: str) -> tuple[Dict[str, object], ...]:
    records: List[Dict[str, object]] = []
    seen = set()

    with open(manifest_path, "r", encoding="utf-8") as handle:
        for raw_row in csv.DictReader(handle):
            symbol = str(raw_row.get("symbol") or "").strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            memberships = [
                token.strip().upper()
                for token in str(raw_row.get("index_membership") or "").split("|")
                if token.strip()
            ]
            records.append(
                {
                    "symbol": symbol,
                    "name": str(raw_row.get("name") or symbol).strip(),
                    "sector": str(raw_row.get("sector") or "Unknown").strip(),
                    "index_membership": memberships,
                }
            )

    return tuple(records)


def load_universe() -> List[Dict[str, object]]:
    manifest_path = universe_manifest_path()
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Screener universe manifest not found at {manifest_path}")
    return [dict(record) for record in _load_cached(manifest_path)]


def clear_universe_cache() -> None:
    _load_cached.cache_clear()
