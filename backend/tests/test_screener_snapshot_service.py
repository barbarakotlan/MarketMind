import os
import sys
import tempfile
import unittest
from unittest.mock import patch

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import screener_snapshot_service
import screener_universe_service


def _build_download_payload(tickers):
    index = pd.date_range("2025-01-01", periods=180, freq="D")
    frames = {}
    for idx, ticker in enumerate(tickers):
        base = 100.0 + (idx * 15.0)
        closes = [base + day * (0.4 + idx * 0.02) for day in range(len(index))]
        frames[("Open", ticker)] = [value - 0.6 for value in closes]
        frames[("High", ticker)] = [value + 0.8 for value in closes]
        frames[("Low", ticker)] = [value - 1.0 for value in closes]
        frames[("Close", ticker)] = closes
        frames[("Volume", ticker)] = [1_000_000 + idx * 10_000 + day * 1_000 for day in range(len(index))]
    return pd.DataFrame(frames, index=index)


class _FakeTicker:
    def __init__(self, symbol):
        self.info = {
            "longName": f"{symbol} Corporation",
            "sector": "Technology" if symbol != "JPM" else "Financials",
            "marketCap": 1_000_000_000_000,
            "forwardPE": 22.4,
            "targetMeanPrice": 250.0,
            "trailingEps": 6.1,
            "currency": "USD",
            "exchange": "XNYS",
        }


class ScreenerSnapshotServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.base_dir = self.tmpdir.name
        screener_universe_service.clear_universe_cache()
        screener_snapshot_service.clear_runtime_cache(base_dir=self.base_dir)

    def tearDown(self):
        screener_snapshot_service.clear_runtime_cache(base_dir=self.base_dir)
        self.tmpdir.cleanup()

    def test_ensure_snapshot_builds_factorized_parquet_snapshot(self):
        fake_yf = type(
            "FakeYF",
            (),
            {
                "download": staticmethod(lambda tickers, **kwargs: _build_download_payload(tickers if isinstance(tickers, list) else [tickers])),
                "Ticker": staticmethod(lambda symbol: _FakeTicker(symbol)),
            },
        )

        payload = screener_snapshot_service.ensure_snapshot(
            base_dir=self.base_dir,
            yf_module=fake_yf,
            logger=type("Logger", (), {"warning": lambda *args, **kwargs: None})(),
        )

        self.assertEqual(payload["snapshotStatus"], "fresh")
        self.assertGreater(payload["rowCount"], 0)
        self.assertTrue(os.path.exists(screener_snapshot_service.snapshot_path(base_dir=self.base_dir)))

        frame = screener_snapshot_service.load_snapshot_frame(base_dir=self.base_dir)
        self.assertIn("symbol", frame.columns)
        self.assertIn("momentum_3m", frame.columns)
        self.assertIn("avg_dollar_volume_30d", frame.columns)
        self.assertIn("distance_from_52w_high_pct", frame.columns)

        first_row = frame.sort("symbol").row(0, named=True)
        self.assertIsNotNone(first_row["price"])
        self.assertIsNotNone(first_row["market_cap"])

    def test_serves_last_good_snapshot_when_refresh_fails(self):
        fake_logger = type("Logger", (), {"warning": lambda *args, **kwargs: None})()
        fake_yf = type(
            "FakeYF",
            (),
            {
                "download": staticmethod(lambda tickers, **kwargs: _build_download_payload(tickers if isinstance(tickers, list) else [tickers])),
                "Ticker": staticmethod(lambda symbol: _FakeTicker(symbol)),
            },
        )

        screener_snapshot_service.ensure_snapshot(
            base_dir=self.base_dir,
            yf_module=fake_yf,
            logger=fake_logger,
        )

        failing_yf = type(
            "FailingYF",
            (),
            {
                "download": staticmethod(lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("upstream unavailable"))),
                "Ticker": staticmethod(lambda symbol: _FakeTicker(symbol)),
            },
        )

        payload = screener_snapshot_service.ensure_snapshot(
            base_dir=self.base_dir,
            yf_module=failing_yf,
            logger=fake_logger,
            force_refresh=True,
        )

        self.assertEqual(payload["snapshotStatus"], "stale")
        self.assertTrue(payload["warnings"])


if __name__ == "__main__":
    unittest.main()
