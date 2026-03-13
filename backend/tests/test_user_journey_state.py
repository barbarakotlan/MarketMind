import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import user_journey_state
from user_state_store import export_user_state, reset_runtime_state, restore_user_state, session_scope


class UserJourneyStateToolTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.base_dir = self.tmpdir.name
        self.user_data_dir = os.path.join(self.base_dir, "user_data")
        self.snapshot_dir = os.path.join(self.base_dir, "snapshot")
        self.database_url = f"sqlite:///{os.path.join(self.base_dir, 'user_state.db')}"
        self.user_id = "user_monthly_sim"

        os.makedirs(self.user_data_dir, exist_ok=True)
        reset_runtime_state()

        self.baseline_sql_state = {
            "app_user": {
                "clerk_user_id": self.user_id,
                "email": "sim@example.com",
                "username": "sim-user",
                "created_at": "2026-03-01T10:00:00+00:00",
                "last_seen_at": "2026-03-12T18:30:00+00:00",
            },
            "watchlist_items": [
                {"ticker": "AAPL", "created_at": "2026-03-01T10:05:00+00:00"},
                {"ticker": "MSFT", "created_at": "2026-03-02T11:15:00+00:00"},
            ],
            "alert_rules": [
                {
                    "id": "8bd03d71-b137-4f57-8d94-91201da1cdf9",
                    "ticker": "MSFT",
                    "condition": "below",
                    "target_price": 250.0,
                    "alert_type": "price",
                    "prompt": None,
                    "is_active": True,
                    "created_at": "2026-03-03T12:00:00+00:00",
                }
            ],
            "triggered_alerts": [
                {
                    "id": "42a0bbac-45f1-49e4-83b9-a9bc7f34789e",
                    "alert_rule_id": "8bd03d71-b137-4f57-8d94-91201da1cdf9",
                    "message": "MSFT dipped below 250",
                    "seen": False,
                    "triggered_at": "2026-03-04T13:00:00+00:00",
                    "payload": {"ticker": "MSFT", "price": 249.5},
                }
            ],
            "paper_portfolio": {
                "cash": 99800.0,
                "starting_cash": 100000.0,
                "updated_at": "2026-03-05T14:00:00+00:00",
            },
            "paper_equity_positions": [
                {
                    "ticker": "AAPL",
                    "shares": 2.0,
                    "avg_cost": 100.0,
                    "updated_at": "2026-03-05T14:00:00+00:00",
                }
            ],
            "paper_option_positions": [
                {
                    "contract_symbol": "AAPL260619C00100000",
                    "quantity": 1,
                    "avg_cost": 1.25,
                    "updated_at": "2026-03-05T14:00:00+00:00",
                }
            ],
            "paper_trade_events": [
                {
                    "id": "dd286f49-8616-4d59-8591-c3f65c098398",
                    "asset_class": "equity",
                    "action": "BUY",
                    "symbol": "AAPL",
                    "quantity": 2.0,
                    "price": 100.0,
                    "total": 200.0,
                    "profit": None,
                    "occurred_at": "2026-03-05T14:00:00+00:00",
                    "metadata": {
                        "raw": {
                            "id": "dd286f49-8616-4d59-8591-c3f65c098398",
                            "type": "BUY",
                            "ticker": "AAPL",
                            "shares": 2.0,
                            "price": 100.0,
                            "total": 200.0,
                            "timestamp": "2026-03-05T14:00:00+00:00",
                        }
                    },
                }
            ],
            "paper_portfolio_snapshots": [
                {"portfolio_value": 100000.0, "recorded_at": "2026-03-05T16:00:00+00:00"},
                {"portfolio_value": 100120.0, "recorded_at": "2026-03-06T16:00:00+00:00"},
            ],
            "prediction_portfolio": {
                "cash": 9995.0,
                "starting_cash": 10000.0,
                "updated_at": "2026-03-07T09:00:00+00:00",
            },
            "prediction_market_positions": [
                {
                    "market_id": "market_1",
                    "outcome": "Yes",
                    "exchange": "polymarket",
                    "question": "Will launch happen?",
                    "contracts": 10.0,
                    "avg_cost": 0.5,
                    "updated_at": "2026-03-07T09:00:00+00:00",
                }
            ],
            "prediction_market_trades": [
                {
                    "id": "81806e03-fdcb-48e0-a3d6-ab988fe8dbbe",
                    "market_id": "market_1",
                    "outcome": "Yes",
                    "exchange": "polymarket",
                    "question": "Will launch happen?",
                    "action": "BUY",
                    "contracts": 10.0,
                    "price": 0.5,
                    "total": 5.0,
                    "profit": None,
                    "occurred_at": "2026-03-07T09:00:00+00:00",
                }
            ],
        }
        self.mutated_sql_state = {
            "app_user": {
                "clerk_user_id": self.user_id,
                "email": "mutated@example.com",
                "username": "mutated-user",
                "created_at": "2026-03-10T10:00:00+00:00",
                "last_seen_at": "2026-03-13T10:00:00+00:00",
            },
            "watchlist_items": [{"ticker": "TSLA", "created_at": "2026-03-10T10:10:00+00:00"}],
            "alert_rules": [],
            "triggered_alerts": [],
            "paper_portfolio": {
                "cash": 100000.0,
                "starting_cash": 100000.0,
                "updated_at": "2026-03-10T10:10:00+00:00",
            },
            "paper_equity_positions": [],
            "paper_option_positions": [],
            "paper_trade_events": [],
            "paper_portfolio_snapshots": [],
            "prediction_portfolio": {
                "cash": 10000.0,
                "starting_cash": 10000.0,
                "updated_at": "2026-03-10T10:10:00+00:00",
            },
            "prediction_market_positions": [],
            "prediction_market_trades": [],
        }

        with session_scope(self.database_url) as session:
            restore_user_state(session, self.user_id, self.baseline_sql_state)

        self._write_user_file("watchlist.json", ["AAPL", "MSFT"])
        self._write_user_file(
            "notifications.json",
            {
                "active": [
                    {
                        "id": "8bd03d71-b137-4f57-8d94-91201da1cdf9",
                        "ticker": "MSFT",
                        "condition": "below",
                        "target_price": 250.0,
                    }
                ],
                "triggered": [
                    {
                        "id": "42a0bbac-45f1-49e4-83b9-a9bc7f34789e",
                        "message": "MSFT dipped below 250",
                        "seen": False,
                        "timestamp": "2026-03-04T13:00:00+00:00",
                    }
                ],
            },
        )
        self._write_user_file(
            "paper_portfolio.json",
            {
                "cash": 99800.0,
                "starting_cash": 100000.0,
                "positions": {"AAPL": {"shares": 2.0, "avg_cost": 100.0}},
                "options_positions": {"AAPL260619C00100000": {"quantity": 1, "avg_cost": 1.25}},
                "transactions": [],
                "trade_history": [
                    {
                        "id": "dd286f49-8616-4d59-8591-c3f65c098398",
                        "type": "BUY",
                        "ticker": "AAPL",
                        "shares": 2.0,
                        "price": 100.0,
                        "total": 200.0,
                        "timestamp": "2026-03-05T14:00:00+00:00",
                    }
                ],
            },
        )
        self._write_user_file(
            "prediction_portfolio.json",
            {
                "cash": 9995.0,
                "starting_cash": 10000.0,
                "positions": {
                    "market_1::Yes": {
                        "market_id": "market_1",
                        "outcome": "Yes",
                        "exchange": "polymarket",
                        "question": "Will launch happen?",
                        "contracts": 10.0,
                        "avg_cost": 0.5,
                    }
                },
                "trade_history": [
                    {
                        "id": "81806e03-fdcb-48e0-a3d6-ab988fe8dbbe",
                        "type": "BUY",
                        "market_id": "market_1",
                        "question": "Will launch happen?",
                        "outcome": "Yes",
                        "contracts": 10.0,
                        "price": 0.5,
                        "total": 5.0,
                        "timestamp": "2026-03-07T09:00:00+00:00",
                    }
                ],
            },
        )
        self._write_raw_user_file("notes.txt", b"Monthly sim note\n")

    def tearDown(self):
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _user_dir(self):
        return os.path.join(self.user_data_dir, self.user_id)

    def _write_user_file(self, name, payload):
        os.makedirs(self._user_dir(), exist_ok=True)
        with open(os.path.join(self._user_dir(), name), "w", encoding="utf-8") as handle:
            json.dump(payload, handle)

    def _write_raw_user_file(self, name, payload):
        os.makedirs(self._user_dir(), exist_ok=True)
        with open(os.path.join(self._user_dir(), name), "wb") as handle:
            handle.write(payload)

    def _run_tool(self, *args):
        buffer = io.StringIO()
        old_argv = sys.argv
        try:
            sys.argv = ["user_journey_state.py", *args]
            with contextlib.redirect_stdout(buffer):
                exit_code = user_journey_state.main()
        finally:
            sys.argv = old_argv
        return exit_code, buffer.getvalue()

    def test_snapshot_restore_verify_round_trip_restores_sql_and_json_state(self):
        exit_code, snapshot_output = self._run_tool(
            "--database-url",
            self.database_url,
            "--base-dir",
            self.base_dir,
            "snapshot",
            "--user-id",
            self.user_id,
            "--snapshot-dir",
            self.snapshot_dir,
        )
        self.assertEqual(exit_code, 0)

        with open(os.path.join(self.snapshot_dir, "state.json"), "r", encoding="utf-8") as handle:
            snapshot_payload = json.load(handle)
        snapshot_summary = json.loads(snapshot_output)["summary"]
        self.assertEqual(snapshot_summary["sql"]["watchlist_count"], 2)
        self.assertEqual(snapshot_summary["json"]["file_count"], 5)

        with session_scope(self.database_url) as session:
            self.assertEqual(export_user_state(session, self.user_id), snapshot_payload["sql_state"])

        with session_scope(self.database_url) as session:
            restore_user_state(session, self.user_id, self.mutated_sql_state)

        shutil_target = self._user_dir()
        with open(os.path.join(shutil_target, "watchlist.json"), "w", encoding="utf-8") as handle:
            json.dump(["TSLA"], handle)
        os.remove(os.path.join(shutil_target, "notes.txt"))

        verify_exit_code, verify_output = self._run_tool(
            "--database-url",
            self.database_url,
            "--base-dir",
            self.base_dir,
            "verify",
            "--user-id",
            self.user_id,
            "--snapshot-dir",
            self.snapshot_dir,
        )
        self.assertEqual(verify_exit_code, 1)
        self.assertFalse(json.loads(verify_output)["matches_snapshot"])

        restore_exit_code, restore_output = self._run_tool(
            "--database-url",
            self.database_url,
            "--base-dir",
            self.base_dir,
            "restore",
            "--user-id",
            self.user_id,
            "--snapshot-dir",
            self.snapshot_dir,
        )
        self.assertEqual(restore_exit_code, 0)
        self.assertTrue(json.loads(restore_output)["matches_snapshot"])

        verify_exit_code, verify_output = self._run_tool(
            "--database-url",
            self.database_url,
            "--base-dir",
            self.base_dir,
            "verify",
            "--user-id",
            self.user_id,
            "--snapshot-dir",
            self.snapshot_dir,
        )
        self.assertEqual(verify_exit_code, 0)
        self.assertTrue(json.loads(verify_output)["matches_snapshot"])

        with session_scope(self.database_url) as session:
            self.assertEqual(export_user_state(session, self.user_id), snapshot_payload["sql_state"])

        with open(os.path.join(self._user_dir(), "notes.txt"), "rb") as handle:
            self.assertEqual(handle.read(), b"Monthly sim note\n")
        with open(os.path.join(self._user_dir(), "watchlist.json"), "r", encoding="utf-8") as handle:
            self.assertEqual(json.load(handle), ["AAPL", "MSFT"])


if __name__ == "__main__":
    unittest.main()
