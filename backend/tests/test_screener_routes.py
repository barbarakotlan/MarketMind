import os
import sys
import tempfile
import unittest
from unittest.mock import patch

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from user_state_store import reset_runtime_state


def _build_download_payload(tickers):
    index = pd.date_range("2025-01-01", periods=180, freq="D")
    frames = {}
    tickers = tickers if isinstance(tickers, list) else [tickers]
    for idx, ticker in enumerate(tickers):
        base = 110.0 + (idx * 12.0)
        closes = [base + day * (0.35 + idx * 0.03) for day in range(len(index))]
        frames[("Open", ticker)] = [value - 0.5 for value in closes]
        frames[("High", ticker)] = [value + 0.9 for value in closes]
        frames[("Low", ticker)] = [value - 1.1 for value in closes]
        frames[("Close", ticker)] = closes
        frames[("Volume", ticker)] = [2_000_000 + idx * 100_000 + day * 1_500 for day in range(len(index))]
    return pd.DataFrame(frames, index=index)


class _FakeTicker:
    def __init__(self, symbol):
        sector = "Financials" if symbol in {"JPM", "BAC", "GS"} else "Technology"
        self.info = {
            "longName": f"{symbol} Incorporated",
            "sector": sector,
            "marketCap": 2_500_000_000_000,
            "forwardPE": 21.2,
            "targetMeanPrice": 260.0,
            "trailingEps": 7.5,
            "currency": "USD",
            "exchange": "XNYS",
        }


class ScreenerRouteTests(unittest.TestCase):
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
            "OPENBB_AVAILABLE": backend_api.OPENBB_AVAILABLE,
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
        backend_api.OPENBB_AVAILABLE = False

        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()
        backend_api.screener_query_service.screener_snapshot_service.clear_runtime_cache(base_dir=self.tmp_root)

        self.download_patch = patch.object(backend_api.yf, "download", side_effect=lambda tickers, **kwargs: _build_download_payload(tickers))
        self.ticker_patch = patch.object(backend_api.yf, "Ticker", side_effect=lambda symbol: _FakeTicker(symbol))
        self.download_patch.start()
        self.ticker_patch.start()

    def tearDown(self):
        self.download_patch.stop()
        self.ticker_patch.stop()
        backend_api.screener_query_service.screener_snapshot_service.clear_runtime_cache(base_dir=self.tmp_root)
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
        backend_api.OPENBB_AVAILABLE = self.original_state["OPENBB_AVAILABLE"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def test_screener_compatibility_route_returns_movers_without_openbb(self):
        response = self.client.get("/screener")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("gainers", payload)
        self.assertIn("losers", payload)
        self.assertIn("active", payload)
        self.assertIn("meta", payload)
        self.assertGreater(len(payload["gainers"]), 0)

    def test_screener_presets_returns_catalog_and_sector_filters(self):
        response = self.client.get("/screener/presets")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        preset_keys = {preset["key"] for preset in payload["presets"]}
        self.assertIn("gainers", preset_keys)
        self.assertIn("momentum_leaders", preset_keys)
        self.assertIn("Technology", payload["sectors"])

    def test_screener_scan_applies_filters_sorting_and_pagination(self):
        response = self.client.get(
            "/screener/scan?preset=momentum_leaders&sector=Technology&market_cap_min=1000000000&sort=momentum_3m&dir=desc&limit=5&offset=0"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["filters"]["preset"], "momentum_leaders")
        self.assertEqual(payload["meta"]["limit"], 5)
        self.assertEqual(payload["meta"]["dir"], "desc")
        self.assertLessEqual(len(payload["rows"]), 5)
        if payload["rows"]:
            self.assertEqual(payload["rows"][0]["sector"], "Technology")


if __name__ == "__main__":
    unittest.main()
