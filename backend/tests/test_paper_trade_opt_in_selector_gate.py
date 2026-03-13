import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from user_state_store import reset_runtime_state


class _DummyTicker:
    def __init__(self, ticker):
        self.info = {
            "symbol": ticker,
            "longName": "Test Inc",
            "regularMarketPrice": 100.0,
            "previousClose": 99.0,
        }


class PaperTradeOptInSelectorGateTests(unittest.TestCase):
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
            "resolve_selector_gate": backend_api._resolve_selector_gate_for_ticker,
            "ticker_cls": backend_api.yf.Ticker,
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
        backend_api.init_db()

        backend_api.verify_clerk_token = lambda token: {"sub": token}
        backend_api._resolve_selector_gate_for_ticker = lambda ticker, mode, source="auto": {
            "abstain": False,
            "selector_status": "ok",
            "abstain_reason": None,
        }
        backend_api.yf.Ticker = _DummyTicker

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
        backend_api._resolve_selector_gate_for_ticker = self.original_state["resolve_selector_gate"]
        backend_api.yf.Ticker = self.original_state["ticker_cls"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _headers(self):
        return {"Authorization": "Bearer user_a"}

    def test_selector_gate_not_enforced_by_default(self):
        resp = self.client.post(
            "/paper/buy",
            headers=self._headers(),
            json={"ticker": "AAPL", "shares": 1},
        )
        self.assertEqual(resp.status_code, 200)

    def test_selector_gate_blocks_when_enforced_and_abstaining(self):
        backend_api._resolve_selector_gate_for_ticker = lambda ticker, mode, source="auto": {
            "abstain": True,
            "selector_status": "ok",
            "abstain_reason": "selector_prob_below_threshold",
        }
        resp = self.client.post(
            "/paper/buy",
            headers=self._headers(),
            json={"ticker": "AAPL", "shares": 1, "enforce_selector": True, "abstain_mode": "conservative"},
        )
        self.assertEqual(resp.status_code, 409)
        payload = resp.get_json()
        self.assertIn("selector_gate", payload)
        self.assertEqual(payload["reason"], "selector_prob_below_threshold")


if __name__ == "__main__":
    unittest.main()
