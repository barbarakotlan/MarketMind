from __future__ import annotations

FREE_PLAN = "free"
PRO_PLAN = "pro"

PLAN_LIMITS = {
    FREE_PLAN: {
        "prediction_requests_per_day": 5,
        "watchlist_items": 10,
        "active_alerts": 2,
        "paper_trades_per_month": 20,
        "prediction_market_trades_per_month": 0,
    },
    PRO_PLAN: {
        "prediction_requests_per_day": 100,
        "watchlist_items": None,
        "active_alerts": 50,
        "paper_trades_per_month": None,
        "prediction_market_trades_per_month": None,
    },
}


def normalize_plan(plan: str | None) -> str:
    return PRO_PLAN if str(plan or "").strip().lower() == PRO_PLAN else FREE_PLAN


def limits_for_plan(plan: str | None) -> dict:
    return dict(PLAN_LIMITS[normalize_plan(plan)])


def limit_for_plan(plan: str | None, key: str):
    return limits_for_plan(plan).get(key)
