import os
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api


class _DummyTicker:
    def __init__(self, ticker):
        self.info = {"symbol": ticker, "longName": "Test Inc"}


class SelectorUnavailableNeverAbstainsTests(unittest.TestCase):
    def setUp(self):
        self.original = {
            "create_dataset": backend_api.create_dataset,
            "ensemble_predict": backend_api.ensemble_predict,
            "infer_selective_decision": backend_api.infer_selective_decision,
            "ticker_cls": backend_api.yf.Ticker,
        }
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

        idx = pd.date_range("2025-01-01", periods=120, freq="D")
        self.df = pd.DataFrame({"Close": np.linspace(100, 120, len(idx))}, index=idx)

        backend_api.create_dataset = lambda ticker, period="1y": self.df.copy()
        backend_api.ensemble_predict = (
            lambda df, days_ahead=6: (
                np.array([121.0, 122.0, 123.0, 124.0, 125.0, 126.0]),
                {"linear_regression": np.array([121.0, 122.0, 123.0, 124.0, 125.0, 126.0])},
            )
        )
        backend_api.infer_selective_decision = lambda **kwargs: {
            "abstain": False,
            "selector_prob": None,
            "selector_threshold": None,
            "selector_mode_requested": kwargs.get("requested_mode", "none"),
            "selector_mode_effective": "none",
            "selector_status": "model_unavailable",
            "abstain_reason": None,
            "regime_bucket": "unknown",
        }
        backend_api.yf.Ticker = _DummyTicker

    def tearDown(self):
        backend_api.create_dataset = self.original["create_dataset"]
        backend_api.ensemble_predict = self.original["ensemble_predict"]
        backend_api.infer_selective_decision = self.original["infer_selective_decision"]
        backend_api.yf.Ticker = self.original["ticker_cls"]

    def test_model_unavailable_never_abstains(self):
        resp = self.client.get("/predict/ensemble/AAPL?abstain_mode=aggressive")
        self.assertEqual(resp.status_code, 200)
        payload = resp.get_json()
        self.assertEqual(payload["selector_status"], "model_unavailable")
        self.assertFalse(payload["abstain"])
        self.assertIsNone(payload["selector_prob"])


if __name__ == "__main__":
    unittest.main()
