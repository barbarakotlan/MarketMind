from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from user_state_store import (
    export_user_state,
    get_session_factory,
    restore_user_state,
    session_scope,
    summarize_user_state,
)


SNAPSHOT_FILENAME = "state.json"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_user_id(user_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", str(user_id))


def _user_dir(base_dir: str, user_id: str) -> str:
    return os.path.join(os.path.abspath(base_dir), "user_data", _safe_user_id(user_id))


def _snapshot_path(snapshot_dir: str) -> str:
    return os.path.join(os.path.abspath(snapshot_dir), SNAPSHOT_FILENAME)


def _load_snapshot(snapshot_dir: str) -> Dict[str, Any]:
    snapshot_path = _snapshot_path(snapshot_dir)
    with open(snapshot_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _capture_json_mirror(base_dir: str, user_id: str) -> Dict[str, Any]:
    user_dir = _user_dir(base_dir, user_id)
    payload = {
        "user_dir_exists": os.path.isdir(user_dir),
        "files": [],
    }
    if not payload["user_dir_exists"]:
        return payload

    for root, _, filenames in os.walk(user_dir):
        for filename in sorted(filenames):
            path = os.path.join(root, filename)
            rel_path = os.path.relpath(path, user_dir)
            with open(path, "rb") as handle:
                raw = handle.read()

            try:
                decoded = raw.decode("utf-8")
            except UnicodeDecodeError:
                decoded = None

            if rel_path.endswith(".json") and decoded is not None:
                try:
                    content = json.loads(decoded)
                    payload["files"].append(
                        {
                            "path": rel_path,
                            "encoding": "json",
                            "content": content,
                        }
                    )
                    continue
                except json.JSONDecodeError:
                    pass

            payload["files"].append(
                {
                    "path": rel_path,
                    "encoding": "base64",
                    "content": base64.b64encode(raw).decode("ascii"),
                }
            )

    payload["files"].sort(key=lambda item: item["path"])
    return payload


def _restore_json_mirror(base_dir: str, user_id: str, state: Dict[str, Any]) -> None:
    user_dir = _user_dir(base_dir, user_id)
    if os.path.isdir(user_dir):
        shutil.rmtree(user_dir)

    if not state.get("user_dir_exists"):
        return

    os.makedirs(user_dir, exist_ok=True)
    for entry in state.get("files", []) or []:
        path = os.path.join(user_dir, entry["path"])
        os.makedirs(os.path.dirname(path), exist_ok=True)

        if entry.get("encoding") == "json":
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(entry.get("content"), handle, indent=2, sort_keys=True)
                handle.write("\n")
            continue

        raw = base64.b64decode(entry.get("content", ""))
        with open(path, "wb") as handle:
            handle.write(raw)


def _json_file_content(json_state: Dict[str, Any], rel_path: str, default: Any) -> Any:
    for entry in json_state.get("files", []) or []:
        if entry.get("path") == rel_path and entry.get("encoding") == "json":
            return entry.get("content")
    return default


def summarize_json_mirror(json_state: Dict[str, Any]) -> Dict[str, Any]:
    watchlist = _json_file_content(json_state, "watchlist.json", [])
    notifications = _json_file_content(json_state, "notifications.json", {"active": [], "triggered": []})
    portfolio = _json_file_content(json_state, "paper_portfolio.json", {})
    prediction_portfolio = _json_file_content(json_state, "prediction_portfolio.json", {})

    return {
        "user_dir_exists": bool(json_state.get("user_dir_exists")),
        "file_count": len(json_state.get("files", []) or []),
        "watchlist_count": len(watchlist or []),
        "active_alert_count": len((notifications or {}).get("active", []) or []),
        "triggered_alert_count": len((notifications or {}).get("triggered", []) or []),
        "paper_position_count": len((portfolio or {}).get("positions", {}) or {}),
        "paper_option_position_count": len((portfolio or {}).get("options_positions", {}) or {}),
        "paper_trade_count": len((portfolio or {}).get("trade_history", []) or []),
        "paper_cash": (portfolio or {}).get("cash"),
        "prediction_position_count": len((prediction_portfolio or {}).get("positions", {}) or {}),
        "prediction_trade_count": len((prediction_portfolio or {}).get("trade_history", []) or []),
        "prediction_cash": (prediction_portfolio or {}).get("cash"),
    }


def _capture_sql_state(database_url: str, user_id: str) -> Dict[str, Any]:
    session = get_session_factory(database_url)()
    try:
        return export_user_state(session, user_id)
    finally:
        session.close()


def _collect_state(base_dir: str, user_id: str, database_url: Optional[str]) -> Dict[str, Any]:
    json_state = _capture_json_mirror(base_dir, user_id)
    sql_state = _capture_sql_state(database_url, user_id) if database_url else None
    return {
        "schema_version": 1,
        "user_id": user_id,
        "captured_at": utcnow_iso(),
        "base_dir": os.path.abspath(base_dir),
        "database_url_present": bool(database_url),
        "json_state": json_state,
        "sql_state": sql_state,
        "summary": {
            "json": summarize_json_mirror(json_state),
            "sql": summarize_user_state(sql_state) if sql_state is not None else None,
        },
    }


def _write_snapshot(snapshot_dir: str, payload: Dict[str, Any]) -> str:
    os.makedirs(snapshot_dir, exist_ok=True)
    snapshot_path = _snapshot_path(snapshot_dir)
    with open(snapshot_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return snapshot_path


def _compare_snapshot(current: Dict[str, Any], expected: Dict[str, Any]) -> Dict[str, Any]:
    json_matches = current.get("json_state") == expected.get("json_state")
    sql_matches = current.get("sql_state") == expected.get("sql_state")
    return {
        "matches_snapshot": json_matches and sql_matches,
        "json_matches_snapshot": json_matches,
        "sql_matches_snapshot": sql_matches,
    }


def cmd_snapshot(args: argparse.Namespace) -> int:
    snapshot = _collect_state(args.base_dir, args.user_id, args.database_url)
    snapshot_path = _write_snapshot(args.snapshot_dir, snapshot)
    print(
        json.dumps(
            {
                "action": "snapshot",
                "snapshot_path": snapshot_path,
                "user_id": args.user_id,
                "summary": snapshot["summary"],
            },
            indent=2,
        )
    )
    return 0


def cmd_restore(args: argparse.Namespace) -> int:
    snapshot = _load_snapshot(args.snapshot_dir)
    if snapshot.get("user_id") != args.user_id:
        raise SystemExit(
            f"Snapshot user_id {snapshot.get('user_id')} does not match requested user_id {args.user_id}"
        )

    if snapshot.get("sql_state") is not None:
        if not args.database_url:
            raise SystemExit("DATABASE_URL or --database-url is required to restore SQL-backed state")
        with session_scope(args.database_url) as session:
            restore_user_state(session, args.user_id, snapshot["sql_state"])

    _restore_json_mirror(args.base_dir, args.user_id, snapshot.get("json_state", {}))

    current = _collect_state(args.base_dir, args.user_id, args.database_url)
    comparison = _compare_snapshot(current, snapshot)
    print(
        json.dumps(
            {
                "action": "restore",
                "user_id": args.user_id,
                "summary": current["summary"],
                **comparison,
            },
            indent=2,
        )
    )
    return 0 if comparison["matches_snapshot"] else 1


def cmd_verify(args: argparse.Namespace) -> int:
    current = _collect_state(args.base_dir, args.user_id, args.database_url)
    output = {
        "action": "verify",
        "user_id": args.user_id,
        "summary": current["summary"],
    }

    if args.snapshot_dir:
        snapshot = _load_snapshot(args.snapshot_dir)
        if snapshot.get("user_id") != args.user_id:
            raise SystemExit(
                f"Snapshot user_id {snapshot.get('user_id')} does not match requested user_id {args.user_id}"
            )
        output.update(_compare_snapshot(current, snapshot))
        print(json.dumps(output, indent=2))
        return 0 if output["matches_snapshot"] else 1

    print(json.dumps(output, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Snapshot, restore, and verify user state for month-long MarketMind journey simulations."
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", "").strip(),
        help="Optional SQL database URL for dual/postgres mode verification",
    )
    parser.add_argument(
        "--base-dir",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="Backend base directory containing user_data/",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser("snapshot", help="Capture the current JSON and SQL state for one user")
    snapshot_parser.add_argument("--user-id", required=True, help="Clerk user ID to snapshot")
    snapshot_parser.add_argument("--snapshot-dir", required=True, help="Directory where the snapshot should be written")
    snapshot_parser.set_defaults(func=cmd_snapshot)

    restore_parser = subparsers.add_parser("restore", help="Restore JSON and SQL state for one user from a snapshot")
    restore_parser.add_argument("--user-id", required=True, help="Clerk user ID to restore")
    restore_parser.add_argument("--snapshot-dir", required=True, help="Directory containing state.json")
    restore_parser.set_defaults(func=cmd_restore)

    verify_parser = subparsers.add_parser("verify", help="Summarize current state and optionally compare it to a snapshot")
    verify_parser.add_argument("--user-id", required=True, help="Clerk user ID to verify")
    verify_parser.add_argument("--snapshot-dir", default=None, help="Optional directory containing state.json")
    verify_parser.set_defaults(func=cmd_verify)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
