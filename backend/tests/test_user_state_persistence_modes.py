import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from user_state_store import (
    PaperPortfolioSnapshot,
    load_portfolio as load_portfolio_db,
    reset_runtime_state,
    session_scope,
)


class UserStatePersistenceModeTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp_root = self.tmpdir.name
        self.state_db_path = os.path.join(self.tmp_root, "user_state.db")
        self.original_state = {
            "BASE_DIR": backend_api.BASE_DIR,
            "DATABASE": backend_api.DATABASE,
            "DATABASE_URL": backend_api.DATABASE_URL,
            "PERSISTENCE_MODE": backend_api.PERSISTENCE_MODE,
            "USER_DATA_DIR": backend_api.USER_DATA_DIR,
            "PORTFOLIO_FILE": backend_api.PORTFOLIO_FILE,
            "NOTIFICATIONS_FILE": backend_api.NOTIFICATIONS_FILE,
            "PREDICTION_PORTFOLIO_FILE": backend_api.PREDICTION_PORTFOLIO_FILE,
            "ALLOW_LEGACY_USER_DATA_SEED": backend_api.ALLOW_LEGACY_USER_DATA_SEED,
            "verify_clerk_token": backend_api.verify_clerk_token,
        }

        reset_runtime_state()
        backend_api.BASE_DIR = self.tmp_root
        backend_api.DATABASE = os.path.join(self.tmp_root, "marketmind_test.db")
        backend_api.DATABASE_URL = f"sqlite:///{self.state_db_path}"
        backend_api.PERSISTENCE_MODE = "json"
        backend_api.USER_DATA_DIR = os.path.join(self.tmp_root, "user_data")
        backend_api.PORTFOLIO_FILE = os.path.join(self.tmp_root, "paper_portfolio.json")
        backend_api.NOTIFICATIONS_FILE = os.path.join(self.tmp_root, "notifications.json")
        backend_api.PREDICTION_PORTFOLIO_FILE = os.path.join(self.tmp_root, "prediction_portfolio.json")
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = False
        backend_api.verify_clerk_token = lambda token: {
            "sub": token,
            "email": f"{token}@example.com",
            "username": token,
        }

        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

    def tearDown(self):
        backend_api.BASE_DIR = self.original_state["BASE_DIR"]
        backend_api.DATABASE = self.original_state["DATABASE"]
        backend_api.DATABASE_URL = self.original_state["DATABASE_URL"]
        backend_api.PERSISTENCE_MODE = self.original_state["PERSISTENCE_MODE"]
        backend_api.USER_DATA_DIR = self.original_state["USER_DATA_DIR"]
        backend_api.PORTFOLIO_FILE = self.original_state["PORTFOLIO_FILE"]
        backend_api.NOTIFICATIONS_FILE = self.original_state["NOTIFICATIONS_FILE"]
        backend_api.PREDICTION_PORTFOLIO_FILE = self.original_state["PREDICTION_PORTFOLIO_FILE"]
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = self.original_state["ALLOW_LEGACY_USER_DATA_SEED"]
        backend_api.verify_clerk_token = self.original_state["verify_clerk_token"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _set_mode(self, mode):
        reset_runtime_state()
        backend_api.PERSISTENCE_MODE = mode

    def _auth_headers(self, user_id="user_a"):
        return {"Authorization": f"Bearer {user_id}"}

    def _user_file(self, user_id, filename):
        return os.path.join(backend_api.USER_DATA_DIR, user_id, filename)

    def test_postgres_mode_routes_use_sql_storage_without_json_writes(self):
        self._set_mode("postgres")

        backend_api.save_notifications(
            {
                "active": [
                    {
                        "id": "legacy-alert",
                        "ticker": "AAPL",
                        "condition": "above",
                        "target_price": 200,
                    }
                ],
                "triggered": [
                    {
                        "id": "legacy-trigger",
                        "message": "AAPL crossed the threshold",
                        "seen": False,
                        "timestamp": "2026-03-10T15:00:00+00:00",
                    }
                ],
            },
            "user_a",
        )

        add_resp = self.client.post("/watchlist/AAPL", headers=self._auth_headers("user_a"))
        self.assertEqual(add_resp.status_code, 201)
        self.assertEqual(
            self.client.get("/watchlist", headers=self._auth_headers("user_a")).get_json(),
            ["AAPL"],
        )
        self.assertEqual(
            self.client.get("/watchlist", headers=self._auth_headers("user_b")).get_json(),
            [],
        )

        notifications = self.client.get("/notifications", headers=self._auth_headers("user_a")).get_json()
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0]["ticker"], "AAPL")

        triggered_before = self.client.get(
            "/notifications/triggered?all=true",
            headers=self._auth_headers("user_a"),
        ).get_json()
        self.assertEqual(len(triggered_before), 1)
        self.assertFalse(triggered_before[0]["seen"])

        unseen = self.client.get(
            "/notifications/triggered",
            headers=self._auth_headers("user_a"),
        ).get_json()
        self.assertEqual(len(unseen), 1)

        triggered_after = self.client.get(
            "/notifications/triggered?all=true",
            headers=self._auth_headers("user_a"),
        ).get_json()
        self.assertTrue(triggered_after[0]["seen"])

        self.assertFalse(os.path.exists(self._user_file("user_a", "watchlist.json")))
        self.assertFalse(os.path.exists(self._user_file("user_a", "notifications.json")))
        self.assertEqual(backend_api._iter_user_ids(), ["user_a", "user_b"])

    def test_dual_mode_mirrors_watchlist_and_portfolio_to_json(self):
        self._set_mode("dual")

        backend_api.save_watchlist(["msft", "AAPL", "MSFT"], "user_a")
        self.assertEqual(backend_api.load_watchlist("user_a"), ["AAPL", "MSFT"])

        watchlist_path = self._user_file("user_a", "watchlist.json")
        self.assertTrue(os.path.exists(watchlist_path))
        with open(watchlist_path, "r", encoding="utf-8") as handle:
            self.assertEqual(json.load(handle), ["AAPL", "MSFT"])

        portfolio = {
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
        }

        backend_api.save_portfolio_with_snapshot(portfolio, "user_a")

        portfolio_path = self._user_file("user_a", "paper_portfolio.json")
        self.assertTrue(os.path.exists(portfolio_path))
        with open(portfolio_path, "r", encoding="utf-8") as handle:
            mirrored = json.load(handle)
        self.assertEqual(mirrored["cash"], 99500.0)
        self.assertIn("AAPL", mirrored["positions"])

        with session_scope(backend_api.DATABASE_URL) as session:
            loaded = load_portfolio_db(session, "user_a")
            snapshot_count = (
                session.query(PaperPortfolioSnapshot)
                .filter_by(clerk_user_id="user_a")
                .count()
            )

        self.assertEqual(loaded["cash"], 99500.0)
        self.assertEqual(loaded["positions"]["AAPL"]["shares"], 5.0)
        self.assertEqual(len(loaded["trade_history"]), 1)
        self.assertEqual(snapshot_count, 1)

    def test_postgres_mode_can_resave_triggered_notifications_with_same_id(self):
        self._set_mode("postgres")

        payload = {
            "active": [],
            "triggered": [
                {
                    "id": "smoke-trigger-static-id",
                    "message": "Smoke triggered alert",
                    "seen": False,
                    "timestamp": "2026-03-13T05:00:00+00:00",
                }
            ],
        }

        backend_api.save_notifications(payload, "user_a")
        backend_api.save_notifications(payload, "user_a")

        alerts = self.client.get(
            "/notifications/triggered?all=true",
            headers=self._auth_headers("user_a"),
        ).get_json()

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["message"], "Smoke triggered alert")
        self.assertFalse(alerts[0]["seen"])

    def test_postgres_mode_scopes_legacy_triggered_ids_per_user(self):
        self._set_mode("postgres")

        payload = {
            "active": [],
            "triggered": [
                {
                    "id": "shared-legacy-id",
                    "message": "Scoped alert",
                    "seen": False,
                    "timestamp": "2026-03-13T05:00:00+00:00",
                }
            ],
        }

        backend_api.save_notifications(payload, "user_a")
        backend_api.save_notifications(payload, "user_b")

        alerts_a = self.client.get(
            "/notifications/triggered?all=true",
            headers=self._auth_headers("user_a"),
        ).get_json()
        alerts_b = self.client.get(
            "/notifications/triggered?all=true",
            headers=self._auth_headers("user_b"),
        ).get_json()

        self.assertEqual(len(alerts_a), 1)
        self.assertEqual(len(alerts_b), 1)
        self.assertEqual(alerts_a[0]["message"], "Scoped alert")
        self.assertEqual(alerts_b[0]["message"], "Scoped alert")


if __name__ == "__main__":
    unittest.main()
