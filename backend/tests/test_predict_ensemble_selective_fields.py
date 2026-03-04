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


class PredictEnsembleSelectiveFieldsTests(unittest.TestCase):
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
                {
                    "linear_regression": np.array([121.0, 122.0, 123.0, 124.0, 125.0, 126.0]),
                    "random_forest": np.array([120.5, 121.5, 122.5, 123.5, 124.5, 125.5]),
                },
            )
        )
        backend_api.infer_selective_decision = lambda **kwargs: {
            "abstain": False,
            "selector_prob": 0.77,
            "selector_threshold": 0.61,
            "selector_mode_requested": kwargs.get("requested_mode", "none"),
            "selector_mode_effective": kwargs.get("requested_mode", "none"),
            "selector_status": "ok",
            "selector_source_requested": kwargs.get("selector_source_requested", "auto"),
            "selector_source": "ticker",
            "abstain_reason": None,
            "regime_bucket": "trend",
        }
        backend_api.yf.Ticker = _DummyTicker

    def tearDown(self):
        backend_api.create_dataset = self.original["create_dataset"]
        backend_api.ensemble_predict = self.original["ensemble_predict"]
        backend_api.infer_selective_decision = self.original["infer_selective_decision"]
        backend_api.yf.Ticker = self.original["ticker_cls"]

    def test_predict_ensemble_includes_selective_fields(self):
        resp = self.client.get("/predict/ensemble/AAPL?abstain_mode=conservative")
        self.assertEqual(resp.status_code, 200)
        payload = resp.get_json()

        expected_fields = [
            "abstain",
            "selector_prob",
            "selector_threshold",
            "selector_mode_requested",
            "selector_mode_effective",
            "selector_status",
            "selector_source_requested",
            "selector_source",
            "abstain_reason",
            "regime_bucket",
        ]
        for field in expected_fields:
            self.assertIn(field, payload)
        self.assertEqual(payload["selector_status"], "ok")
        self.assertEqual(payload["selector_source_requested"], "auto")

    def test_predict_ensemble_echoes_selector_source_requested(self):
        resp = self.client.get("/predict/ensemble/AAPL?abstain_mode=conservative&selector_source=global")
        self.assertEqual(resp.status_code, 200)
        payload = resp.get_json()
        self.assertEqual(payload["selector_source_requested"], "global")


if __name__ == "__main__":
    unittest.main()
