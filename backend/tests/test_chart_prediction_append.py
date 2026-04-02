import os
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api


class _DummyTicker:
    def __init__(self, ticker):
        self.info = {"symbol": ticker, "longName": "Chart Test Inc"}

    def history(self, period="1mo", interval="1d"):
        index = pd.date_range("2026-03-01", periods=3, freq="D")
        return pd.DataFrame(
            {
                "Open": [100.0, 101.0, 102.0],
                "High": [101.0, 102.0, 103.0],
                "Low": [99.0, 100.0, 101.0],
                "Close": [100.5, 101.5, 102.5],
                "Volume": [1000, 1100, 1200],
            },
            index=index,
        )


class ChartPredictionAppendTests(unittest.TestCase):
    def setUp(self):
        self.original = {
            "ticker_cls": backend_api.yf.Ticker,
            "create_dataset": backend_api.create_dataset,
            "ensemble_predict": backend_api.ensemble_predict,
            "future_prediction_dates": backend_api.prediction_service.get_future_prediction_dates,
        }
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

        idx = pd.date_range("2025-01-01", periods=120, freq="D")
        self.df = pd.DataFrame({"Close": np.linspace(100, 120, len(idx))}, index=idx)

        backend_api.yf.Ticker = _DummyTicker
        backend_api.create_dataset = lambda ticker, period="1y": self.df.copy()
        backend_api.ensemble_predict = (
            lambda df, days_ahead=6: (
                np.array([121.0, 122.0, 123.0, 124.0, 125.0, 126.0]),
                {"linear_regression": np.array([121.0, 122.0, 123.0, 124.0, 125.0, 126.0])},
            )
        )
        backend_api.prediction_service.get_future_prediction_dates = (
            lambda df, horizon: list(pd.to_datetime([
                "2025-05-01",
                "2025-05-02",
                "2025-05-05",
                "2025-05-06",
                "2025-05-07",
                "2025-05-08",
            ]))[:horizon]
        )

    def tearDown(self):
        backend_api.yf.Ticker = self.original["ticker_cls"]
        backend_api.create_dataset = self.original["create_dataset"]
        backend_api.ensemble_predict = self.original["ensemble_predict"]
        backend_api.prediction_service.get_future_prediction_dates = self.original["future_prediction_dates"]

    def test_chart_endpoint_appends_prediction_rows(self):
        resp = self.client.get("/chart/AAPL?period=1mo")
        self.assertEqual(resp.status_code, 200)

        payload = resp.get_json()
        self.assertEqual(len(payload), 9)
        self.assertEqual(payload[-1]["date"], "2025-05-08 00:00:00")
        self.assertEqual(payload[-1]["close"], 126.0)
        self.assertIsNone(payload[-1]["open"])
        self.assertIsNone(payload[-1]["volume"])


if __name__ == "__main__":
    unittest.main()
