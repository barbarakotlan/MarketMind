import json
import os
import sys
import tempfile
import unittest

# Ensure backend/ is importable when tests are run from project root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from user_state_store import reset_runtime_state


class AuthIsolationTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp_root = self.tmpdir.name

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
            "pm_get_prices": backend_api.pm_get_prices,
        }

        reset_runtime_state()
        backend_api.BASE_DIR = self.tmp_root
        backend_api.DATABASE = os.path.join(self.tmp_root, "marketmind_test.db")
        backend_api.DATABASE_URL = ""
        backend_api.PERSISTENCE_MODE = "json"
        backend_api.USER_DATA_DIR = os.path.join(self.tmp_root, "user_data")
        backend_api.PORTFOLIO_FILE = os.path.join(self.tmp_root, "paper_portfolio.json")
        backend_api.NOTIFICATIONS_FILE = os.path.join(self.tmp_root, "notifications.json")
        backend_api.PREDICTION_PORTFOLIO_FILE = os.path.join(self.tmp_root, "prediction_portfolio.json")
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = False

        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()
        backend_api.pm_get_prices = lambda _market_id, _exchange=None: {}

        def fake_verify(token):
            return {"sub": token}

        backend_api.verify_clerk_token = fake_verify
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
        backend_api.pm_get_prices = self.original_state["pm_get_prices"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _auth_headers(self, user_id):
        return {"Authorization": f"Bearer {user_id}"}

    def test_protected_routes_require_auth(self):
        protected_requests = [
            ("get", "/auth/me", None),
            ("get", "/marketmind-ai/bootstrap", None),
            ("get", "/marketmind-ai/chats", None),
            ("get", "/marketmind-ai/chats/some-id", None),
            ("get", "/marketmind-ai/context?ticker=AAPL", None),
            ("post", "/marketmind-ai/chat", {"messages": [{"role": "user", "content": "hello world from user"}]}),
            ("post", "/marketmind-ai/artifacts/preflight", {"templateKey": "investment_thesis_memo", "messages": []}),
            ("get", "/marketmind-ai/artifacts", None),
            ("post", "/marketmind-ai/artifacts", {"templateKey": "investment_thesis_memo", "messages": [], "attachedTicker": "AAPL"}),
            ("get", "/marketmind-ai/artifacts/some-id", None),
            ("get", "/marketmind-ai/artifacts/some-id/versions/some-version/download", None),
            ("get", "/deliverables", None),
            ("post", "/deliverables", {"ticker": "AAPL"}),
            ("get", "/deliverables/some-id", None),
            ("patch", "/deliverables/some-id", {"title": "Memo"}),
            ("put", "/deliverables/some-id/assumptions", {"assumptions": []}),
            ("post", "/deliverables/some-id/reviews", {"summary": "checkpoint"}),
            ("post", "/deliverables/some-id/preflight", None),
            ("get", "/deliverables/some-id/context", None),
            ("get", "/deliverables/some-id/memos", None),
            ("post", "/deliverables/some-id/memos/generate", None),
            ("get", "/deliverables/some-id/memos/some-memo/download", None),
            ("get", "/watchlist", None),
            ("post", "/watchlist/AAPL", None),
            ("delete", "/watchlist/AAPL", None),
            ("get", "/paper/portfolio", None),
            ("get", "/paper/history", None),
            ("get", "/paper/transactions", None),
            ("post", "/paper/reset", None),
            ("post", "/paper/options/buy", {"contractSymbol": "OPT1", "quantity": 1, "price": 1.0}),
            ("post", "/paper/options/sell", {"contractSymbol": "OPT1", "quantity": 1, "price": 1.0}),
            ("get", "/notifications", None),
            ("post", "/notifications", {"ticker": "AAPL", "condition": "above", "target_price": 999}),
            ("get", "/notifications/triggered", None),
            ("delete", "/notifications/triggered", None),
            ("delete", "/notifications/triggered/some-id", None),
            ("delete", "/notifications/some-id", None),
            ("get", "/prediction-markets/portfolio", None),
            ("get", "/prediction-markets/history", None),
            ("post", "/prediction-markets/reset", None),
            ("post", "/prediction-markets/analyze", {"market_id": "m1"}),
            ("post", "/prediction-markets/buy", {"market_id": "m1", "outcome": "Yes", "contracts": 1}),
            ("post", "/prediction-markets/sell", {"market_id": "m1", "outcome": "Yes", "contracts": 1}),
            ("post", "/checkout/create-subscription", {"billing": "monthly"}),
            ("post", "/checkout/cancel-subscription", {"subscriptionId": "sub_123"}),
            ("get", "/checkout/plan-status", None),
        ]

        for method, route, payload in protected_requests:
            response = getattr(self.client, method)(route, json=payload)
            self.assertEqual(
                response.status_code,
                401,
                msg=f"{method.upper()} {route} should require auth",
            )

    def test_auth_me_returns_user_identity(self):
        response = self.client.get("/auth/me", headers=self._auth_headers("user_a"))
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["user_id"], "user_a")

    def test_watchlist_isolated_between_users(self):
        add_resp = self.client.post("/watchlist/AAPL", headers=self._auth_headers("user_a"))
        self.assertEqual(add_resp.status_code, 201)

        a_watchlist = self.client.get("/watchlist", headers=self._auth_headers("user_a")).get_json()
        b_watchlist = self.client.get("/watchlist", headers=self._auth_headers("user_b")).get_json()

        self.assertEqual(a_watchlist, ["AAPL"])
        self.assertEqual(b_watchlist, [])

    def test_legacy_shared_files_do_not_seed_new_users_by_default(self):
        with open(os.path.join(self.tmp_root, "watchlist.json"), "w", encoding="utf-8") as f:
            json.dump(["LEAK"], f)
        with open(backend_api.PORTFOLIO_FILE, "w", encoding="utf-8") as f:
            json.dump({"cash": 12345.0, "starting_cash": 12345.0, "positions": {}, "options_positions": {}}, f)
        with open(backend_api.NOTIFICATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump({"active": [{"id": "legacy"}], "triggered": []}, f)
        with open(backend_api.PREDICTION_PORTFOLIO_FILE, "w", encoding="utf-8") as f:
            json.dump({"cash": 7777.0, "starting_cash": 7777.0, "positions": {}}, f)

        user_headers = self._auth_headers("new_user")

        watchlist = self.client.get("/watchlist", headers=user_headers).get_json()
        portfolio = self.client.get("/paper/portfolio", headers=user_headers).get_json()
        notifications = self.client.get("/notifications", headers=user_headers).get_json()
        prediction_portfolio = self.client.get("/prediction-markets/portfolio", headers=user_headers).get_json()

        self.assertEqual(watchlist, [])
        self.assertEqual(notifications, [])
        self.assertEqual(portfolio["cash"], 100000.0)
        self.assertEqual(prediction_portfolio["cash"], 10000.0)

    def test_paper_trades_persist_per_user(self):
        buy_response = self.client.post(
            "/paper/options/buy",
            headers=self._auth_headers("user_a"),
            json={"contractSymbol": "TEST_OPT", "quantity": 1, "price": 2.5},
        )
        self.assertEqual(buy_response.status_code, 200)

        history_a = self.client.get("/paper/transactions", headers=self._auth_headers("user_a")).get_json()
        history_b = self.client.get("/paper/transactions", headers=self._auth_headers("user_b")).get_json()

        self.assertEqual(len(history_a), 1)
        self.assertEqual(history_a[0]["type"], "BUY_OPTION")
        self.assertEqual(history_b, [])

    def test_notifications_isolated_between_users(self):
        backend_api.save_notifications(
            {
                "active": [{"id": "n1", "ticker": "AAPL", "condition": "above", "target_price": 200}],
                "triggered": [],
            },
            "user_a",
        )
        backend_api.save_notifications({"active": [], "triggered": []}, "user_b")

        user_a_alerts = self.client.get("/notifications", headers=self._auth_headers("user_a")).get_json()
        user_b_alerts = self.client.get("/notifications", headers=self._auth_headers("user_b")).get_json()

        self.assertEqual(len(user_a_alerts), 1)
        self.assertEqual(user_a_alerts[0]["ticker"], "AAPL")
        self.assertEqual(user_b_alerts, [])

    def test_prediction_portfolio_isolated_between_users(self):
        backend_api.save_prediction_portfolio(
            {
                "cash": 9000.0,
                "starting_cash": 10000.0,
                "positions": {
                    "market_1::Yes": {
                        "market_id": "market_1",
                        "outcome": "Yes",
                        "exchange": "polymarket",
                        "question": "Will test pass?",
                        "contracts": 10,
                        "avg_cost": 0.5,
                    }
                },
                "trade_history": [],
            },
            "user_a",
        )
        backend_api.save_prediction_portfolio(
            {"cash": 10000.0, "starting_cash": 10000.0, "positions": {}, "trade_history": []},
            "user_b",
        )

        user_a_portfolio = self.client.get(
            "/prediction-markets/portfolio", headers=self._auth_headers("user_a")
        ).get_json()
        user_b_portfolio = self.client.get(
            "/prediction-markets/portfolio", headers=self._auth_headers("user_b")
        ).get_json()

        self.assertGreaterEqual(len(user_a_portfolio.get("positions", [])), 1)
        self.assertEqual(user_b_portfolio.get("positions", []), [])


if __name__ == "__main__":
    unittest.main()
