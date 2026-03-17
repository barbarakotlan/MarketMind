import argparse
import json
import os
from typing import Any, Dict

from user_state_store import (
    ensure_database_ready,
    import_portfolio_snapshots_from_legacy_sqlite,
    save_notifications,
    save_portfolio,
    save_prediction_portfolio,
    save_watchlist,
    session_scope,
)


def _load_json(path: str, default: Any) -> Any:
    if not path or not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _user_state_from_dir(user_dir: str) -> Dict[str, Any]:
    return {
        "watchlist": _load_json(os.path.join(user_dir, "watchlist.json"), []),
        "notifications": _load_json(os.path.join(user_dir, "notifications.json"), {"active": [], "triggered": []}),
        "portfolio": _load_json(
            os.path.join(user_dir, "paper_portfolio.json"),
            {
                "cash": 100000.0,
                "starting_cash": 100000.0,
                "positions": {},
                "options_positions": {},
                "transactions": [],
                "trade_history": [],
            },
        ),
        "prediction_portfolio": _load_json(
            os.path.join(user_dir, "prediction_portfolio.json"),
            {"cash": 10000.0, "starting_cash": 10000.0, "positions": {}, "trade_history": []},
        ),
    }


def _legacy_state_from_base(base_dir: str) -> Dict[str, Any]:
    return {
        "watchlist": _load_json(os.path.join(base_dir, "watchlist.json"), []),
        "notifications": _load_json(os.path.join(base_dir, "notifications.json"), {"active": [], "triggered": []}),
        "portfolio": _load_json(
            os.path.join(base_dir, "paper_portfolio.json"),
            {
                "cash": 100000.0,
                "starting_cash": 100000.0,
                "positions": {},
                "options_positions": {},
                "transactions": [],
                "trade_history": [],
            },
        ),
        "prediction_portfolio": _load_json(
            os.path.join(base_dir, "prediction_portfolio.json"),
            {"cash": 10000.0, "starting_cash": 10000.0, "positions": {}, "trade_history": []},
        ),
    }


def _backfill_user(database_url: str, clerk_user_id: str, state: Dict[str, Any], legacy_sqlite_path: str) -> Dict[str, Any]:
    with session_scope(database_url) as session:
        save_watchlist(session, clerk_user_id, state["watchlist"])
        save_notifications(session, clerk_user_id, state["notifications"])
        save_portfolio(session, clerk_user_id, state["portfolio"])
        save_prediction_portfolio(session, clerk_user_id, state["prediction_portfolio"])
        snapshot_count = import_portfolio_snapshots_from_legacy_sqlite(session, clerk_user_id, legacy_sqlite_path)

    return {
        "user_id": clerk_user_id,
        "watchlist_count": len(state["watchlist"]),
        "active_alert_count": len(state["notifications"].get("active", [])),
        "triggered_alert_count": len(state["notifications"].get("triggered", [])),
        "paper_trade_count": len(state["portfolio"].get("trade_history", [])),
        "prediction_trade_count": len(state["prediction_portfolio"].get("trade_history", [])),
        "snapshot_count": snapshot_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill MarketMind user-state JSON into Postgres storage.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", "").strip(), help="Target Postgres database URL")
    parser.add_argument("--base-dir", default=os.path.dirname(os.path.abspath(__file__)), help="Backend base directory")
    parser.add_argument("--user-data-dir", default=None, help="Directory containing backend/user_data/<clerk_user_id>")
    parser.add_argument(
        "--legacy-user-id",
        default=None,
        help="Optional Clerk user ID to receive legacy root-level JSON files explicitly",
    )
    parser.add_argument(
        "--legacy-sqlite-path",
        default=None,
        help="Optional path to the legacy SQLite portfolio_history database",
    )
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL or --database-url is required")

    base_dir = os.path.abspath(args.base_dir)
    user_data_dir = os.path.abspath(args.user_data_dir or os.path.join(base_dir, "user_data"))
    legacy_sqlite_path = os.path.abspath(args.legacy_sqlite_path or os.path.join(base_dir, "marketmind.db"))

    ensure_database_ready(args.database_url)

    results = []
    if os.path.isdir(user_data_dir):
        for entry in sorted(os.listdir(user_data_dir)):
            user_dir = os.path.join(user_data_dir, entry)
            if not os.path.isdir(user_dir):
                continue
            state = _user_state_from_dir(user_dir)
            results.append(_backfill_user(args.database_url, entry, state, legacy_sqlite_path))

    if args.legacy_user_id:
        legacy_state = _legacy_state_from_base(base_dir)
        results.append(_backfill_user(args.database_url, args.legacy_user_id, legacy_state, legacy_sqlite_path))

    print(json.dumps({"users": results}, indent=2))


if __name__ == "__main__":
    main()
