import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import user_journey_harness
from user_state_store import export_user_state, reset_runtime_state, restore_user_state, session_scope


class UserJourneyHarnessTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.base_dir = self.tmpdir.name
        self.database_url = f"sqlite:///{os.path.join(self.base_dir, 'user_state.db')}"
        self.user_id = "journey_user"

        os.makedirs(os.path.join(self.base_dir, "user_data", self.user_id), exist_ok=True)
        reset_runtime_state()

        self.baseline_sql_state = {
            "app_user": {
                "clerk_user_id": self.user_id,
                "email": "journey@example.com",
                "username": "journey-user",
                "created_at": "2026-03-01T10:00:00+00:00",
                "last_seen_at": "2026-03-12T18:30:00+00:00",
            },
            "watchlist_items": [{"ticker": "AAPL", "created_at": "2026-03-01T10:05:00+00:00"}],
            "alert_rules": [],
            "triggered_alerts": [],
            "paper_portfolio": {
                "cash": 100000.0,
                "starting_cash": 100000.0,
                "updated_at": "2026-03-05T14:00:00+00:00",
            },
            "paper_equity_positions": [],
            "paper_option_positions": [],
            "paper_trade_events": [],
            "paper_portfolio_snapshots": [],
            "prediction_portfolio": {
                "cash": 10000.0,
                "starting_cash": 10000.0,
                "updated_at": "2026-03-07T09:00:00+00:00",
            },
            "prediction_market_positions": [],
            "prediction_market_trades": [],
            "deliverables": [],
            "deliverable_assumptions": [],
            "deliverable_reviews": [],
            "deliverable_preflights": [],
            "deliverable_memos": [],
            "deliverable_links": [],
        }

        with session_scope(self.database_url) as session:
            restore_user_state(session, self.user_id, self.baseline_sql_state)

        self._write_json("watchlist.json", ["AAPL"])
        self._write_json("notifications.json", {"active": [], "triggered": []})
        self._write_json(
            "paper_portfolio.json",
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
            "prediction_portfolio.json",
            {
                "cash": 10000.0,
                "starting_cash": 10000.0,
                "positions": {},
                "trade_history": [],
            },
        )

    def tearDown(self):
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _user_dir(self):
        return os.path.join(self.base_dir, "user_data", self.user_id)

    def _write_json(self, filename, payload):
        with open(os.path.join(self._user_dir(), filename), "w", encoding="utf-8") as handle:
            json.dump(payload, handle)

    def test_deterministic_harness_runs_and_restores_baseline(self):
        report = user_journey_harness.run_harness(
            user_id=self.user_id,
            base_dir=self.base_dir,
            database_url=self.database_url,
            persistence_mode="postgres",
            snapshot_dir=os.path.join(self.base_dir, "snapshot"),
            mode="deterministic",
            preserve_snapshot=True,
        )

        self.assertTrue(report["summary"]["ok"])
        self.assertEqual(report["summary"]["product_failures"], 0)
        self.assertTrue(report["restore"]["matches_snapshot"])
        self.assertTrue(report["verify"]["matches_snapshot"])
        self.assertGreater(report["summary"]["passed_steps"], 0)

        with session_scope(self.database_url) as session:
            self.assertEqual(export_user_state(session, self.user_id), self.baseline_sql_state)

        with open(os.path.join(self._user_dir(), "watchlist.json"), "r", encoding="utf-8") as handle:
            self.assertEqual(json.load(handle), ["AAPL"])


if __name__ == "__main__":
    unittest.main()
