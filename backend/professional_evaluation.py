"""
Compatibility wrappers for the upgraded prediction stack.

The legacy /evaluate route and a few docs/tests still import from this module, so
the implementation now delegates to prediction_service.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from prediction_service import (
    FEATURE_SPEC_VERSION,
    calculate_trading_returns,
    rolling_window_backtest,
)

__all__ = [
    "FEATURE_SPEC_VERSION",
    "calculate_trading_returns",
    "rolling_window_backtest",
]


def describe_feature_spec() -> Dict[str, Any]:
    return {
        "version": FEATURE_SPEC_VERSION,
        "families": [
            "lag features",
            "rolling trend features",
            "rolling volatility features",
            "momentum features",
            "volume-derived features",
            "session calendar features",
        ],
    }


if __name__ == "__main__":
    result: Optional[Dict[str, Any]] = rolling_window_backtest("AAPL", test_days=60, retrain_frequency=5)
    if result:
        print(result["ticker"], result["best_model"], result.get("featureSpecVersion"))
