import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from user_state_store import reset_runtime_state


class PortfolioOptimizationRouteTests(unittest.TestCase):
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
            "limiter_enabled": backend_api.limiter.enabled,
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
        backend_api.verify_clerk_token = lambda token: {"sub": token}
        backend_api.limiter.enabled = False

        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

        backend_api.save_portfolio_with_snapshot(
            {
                "cash": 15000.0,
                "starting_cash": 100000.0,
                "positions": {
                    "AAPL": {"shares": 10, "avg_cost": 180.0},
                    "MSFT": {"shares": 6, "avg_cost": 320.0},
                },
                "options_positions": {},
                "transactions": [],
                "trade_history": [],
            },
            "user_a",
        )

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
        backend_api.limiter.enabled = self.original_state["limiter_enabled"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _auth_headers(self, user_id="user_a"):
        return {"Authorization": f"Bearer {user_id}"}

    def test_route_returns_optimizer_payload(self):
        captured = {}

        def _fake_optimize(portfolio, **kwargs):
            captured["portfolio"] = portfolio
            captured["kwargs"] = kwargs
            return {
                "asOf": "2026-04-02T00:00:00+00:00",
                "method": kwargs["method"],
                "universe": {"tickers": ["AAPL", "MSFT"], "eligibleHoldings": 2, "market": "US", "assetType": "equity", "currency": "USD"},
                "investableValue": 18720.0,
                "cashPosition": {"currentValue": 15000.0, "currentWeight": 0.8, "targetValue": 0.0, "targetWeight": 0.0, "deltaValue": -15000.0},
                "excludedHoldings": [],
                "currentAllocations": [],
                "recommendedAllocations": [],
                "rebalanceActions": [],
                "portfolioMetrics": {"expectedAnnualReturn": 0.1, "annualVolatility": 0.2, "sharpeRatio": 0.4},
                "assumptions": {"maxWeight": 0.35},
                "warnings": [],
            }

        with patch.object(backend_api.portfolio_optimization_service, "optimize_paper_portfolio", side_effect=_fake_optimize):
            response = self.client.post(
                "/paper/portfolio/optimize",
                headers=self._auth_headers(),
                json={"method": "hrp", "use_predictions": False, "lookback_days": 180, "max_weight": 0.4},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["method"], "hrp")
        self.assertEqual(captured["kwargs"]["method"], "hrp")
        self.assertEqual(captured["kwargs"]["lookback_days"], 180)
        self.assertEqual(captured["kwargs"]["max_weight"], 0.4)
        self.assertFalse(captured["kwargs"]["use_predictions"])
        self.assertIn("AAPL", captured["portfolio"]["positions"])

    def test_route_surfaces_optimization_errors(self):
        with patch.object(
            backend_api.portfolio_optimization_service,
            "optimize_paper_portfolio",
            side_effect=backend_api.portfolio_optimization_service.PortfolioOptimizationDataError("Need more holdings."),
        ):
            response = self.client.post(
                "/paper/portfolio/optimize",
                headers=self._auth_headers(),
                json={"method": "black_litterman"},
            )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["error"], "Need more holdings.")
        self.assertEqual(response.get_json()["code"], "insufficient_data")


if __name__ == "__main__":
    unittest.main()
