import contextlib
import io
import json
import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import backfill_postgres
from user_state_store import (
    PaperPortfolioSnapshot,
    load_notifications,
    load_portfolio,
    load_prediction_portfolio,
    load_watchlist,
    reset_runtime_state,
    session_scope,
)


class BackfillPostgresTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.base_dir = self.tmpdir.name
        self.user_data_dir = os.path.join(self.base_dir, "user_data")
        self.database_path = os.path.join(self.base_dir, "user_state.db")
        self.database_url = f"sqlite:///{self.database_path}"
        self.legacy_sqlite_path = os.path.join(self.base_dir, "marketmind.db")
        os.makedirs(self.user_data_dir, exist_ok=True)
        reset_runtime_state()

        self._write_json(
            os.path.join(self.user_data_dir, "user_a", "watchlist.json"),
            ["msft", "AAPL"],
        )
        self._write_json(
            os.path.join(self.user_data_dir, "user_a", "notifications.json"),
            {
                "active": [
                    {
                        "id": "legacy-active",
                        "ticker": "AAPL",
                        "condition": "above",
                        "target_price": 200,
                    }
                ],
                "triggered": [
                    {
                        "id": "legacy-triggered",
                        "message": "AAPL crossed the threshold",
                        "seen": False,
                        "timestamp": "2026-03-10T15:00:00+00:00",
                    }
                ],
            },
        )
        self._write_json(
            os.path.join(self.user_data_dir, "user_a", "paper_portfolio.json"),
            {
                "cash": 99500.0,
                "starting_cash": 100000.0,
                "positions": {"AAPL": {"shares": 5, "avg_cost": 100.0}},
                "options_positions": {},
                "transactions": [
                    {
                        "date": "2026-03-10",
                        "type": "BUY",
                        "ticker": "AAPL",
                        "shares": 5,
                        "price": 100.0,
                        "total": 500.0,
                    }
                ],
                "trade_history": [
                    {
                        "type": "BUY",
                        "ticker": "AAPL",
                        "shares": 5,
                        "price": 100.0,
                        "total": 500.0,
                        "timestamp": "2026-03-10T15:00:00+00:00",
                    }
                ],
            },
        )
        self._write_json(
            os.path.join(self.user_data_dir, "user_a", "prediction_portfolio.json"),
            {
                "cash": 9500.0,
                "starting_cash": 10000.0,
                "positions": {
                    "market_1::Yes": {
                        "market_id": "market_1",
                        "outcome": "Yes",
                        "exchange": "polymarket",
                        "question": "Will this pass?",
                        "contracts": 10,
                        "avg_cost": 0.5,
                    }
                },
                "trade_history": [
                    {
                        "id": "pred-trade",
                        "type": "BUY",
                        "market_id": "market_1",
                        "question": "Will this pass?",
                        "outcome": "Yes",
                        "contracts": 10,
                        "price": 0.5,
                        "total": 5.0,
                        "timestamp": "2026-03-10T15:00:00+00:00",
                    }
                ],
            },
        )

        self._write_json(os.path.join(self.base_dir, "watchlist.json"), ["GOOG"])
        self._write_json(
            os.path.join(self.base_dir, "notifications.json"),
            {"active": [], "triggered": []},
        )
        self._write_json(
            os.path.join(self.base_dir, "paper_portfolio.json"),
            {
                "cash": 100000.0,
                "starting_cash": 100000.0,
                "positions": {},
                "options_positions": {},
                "transactions": [],
                "trade_history": [],
            },
        )
        self._write_json(
            os.path.join(self.base_dir, "prediction_portfolio.json"),
            {
                "cash": 10000.0,
                "starting_cash": 10000.0,
                "positions": {},
                "trade_history": [],
            },
        )

        self._seed_legacy_sqlite()

    def tearDown(self):
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _write_json(self, path, payload):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle)

    def _seed_legacy_sqlite(self):
        conn = sqlite3.connect(self.legacy_sqlite_path)
        try:
            conn.execute(
                """
                CREATE TABLE portfolio_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME NOT NULL,
                    portfolio_value REAL NOT NULL,
                    user_id TEXT
                )
                """
            )
            conn.executemany(
                "INSERT INTO portfolio_history (timestamp, portfolio_value, user_id) VALUES (?, ?, ?)",
                [
                    ("2026-03-10T15:00:00+00:00", 100000.0, "user_a"),
                    ("2026-03-11T15:00:00+00:00", 100500.0, "user_a"),
                ],
            )
            conn.commit()
        finally:
            conn.close()

    def _run_backfill(self, *extra_args):
        argv = [
            "backfill_postgres.py",
            "--database-url",
            self.database_url,
            "--base-dir",
            self.base_dir,
            "--legacy-sqlite-path",
            self.legacy_sqlite_path,
            *extra_args,
        ]
        old_argv = sys.argv
        try:
            sys.argv = argv
            with contextlib.redirect_stdout(io.StringIO()):
                backfill_postgres.main()
        finally:
            sys.argv = old_argv

    def test_backfill_imports_user_data_and_is_idempotent(self):
        self._run_backfill("--legacy-user-id", "legacy_seed")
        self._run_backfill("--legacy-user-id", "legacy_seed")

        with session_scope(self.database_url) as session:
            watchlist = load_watchlist(session, "user_a")
            notifications = load_notifications(session, "user_a")
            portfolio = load_portfolio(session, "user_a")
            prediction_portfolio = load_prediction_portfolio(session, "user_a")
            legacy_watchlist = load_watchlist(session, "legacy_seed")
            snapshot_count = (
                session.query(PaperPortfolioSnapshot)
                .filter_by(clerk_user_id="user_a")
                .count()
            )

        self.assertEqual(watchlist, ["AAPL", "MSFT"])
        self.assertEqual(len(notifications["active"]), 1)
        self.assertEqual(len(notifications["triggered"]), 1)
        self.assertEqual(portfolio["cash"], 99500.0)
        self.assertEqual(portfolio["positions"]["AAPL"]["shares"], 5.0)
        self.assertEqual(len(portfolio["trade_history"]), 1)
        self.assertEqual(prediction_portfolio["cash"], 9500.0)
        self.assertEqual(len(prediction_portfolio["positions"]), 1)
        self.assertEqual(len(prediction_portfolio["trade_history"]), 1)
        self.assertEqual(legacy_watchlist, ["GOOG"])
        self.assertEqual(snapshot_count, 2)


if __name__ == "__main__":
    unittest.main()
