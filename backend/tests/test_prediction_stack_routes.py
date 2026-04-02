import os
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api


class _DummyTicker:
    def __init__(self, ticker):
        self.info = {"symbol": ticker, "longName": "Prediction Route Inc"}


class PredictionStackRouteTests(unittest.TestCase):
    def setUp(self):
        self.original = {
            "ticker_cls": backend_api.yf.Ticker,
            "create_dataset": backend_api.create_dataset,
            "linear_regression_predict": backend_api.linear_regression_predict,
            "ensemble_predict": backend_api.ensemble_predict,
            "rolling_window_backtest": backend_api.rolling_window_backtest,
            "future_prediction_dates": backend_api.prediction_service.get_future_prediction_dates,
        }
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

        index = pd.bdate_range("2025-01-02", periods=180)
        self.df = pd.DataFrame({"Close": np.linspace(100.0, 140.0, len(index))}, index=index)
        self.future_dates = [
            pd.Timestamp("2026-04-03"),
            pd.Timestamp("2026-04-06"),
            pd.Timestamp("2026-04-07"),
            pd.Timestamp("2026-04-08"),
            pd.Timestamp("2026-04-09"),
            pd.Timestamp("2026-04-10"),
            pd.Timestamp("2026-04-13"),
        ]

        backend_api.yf.Ticker = _DummyTicker
        backend_api.create_dataset = lambda ticker, period="1y": self.df.copy()
        backend_api.linear_regression_predict = lambda df, days_ahead=7: np.array(
            [141.0, 141.6, 142.1, 142.7, 143.2, 143.9, 144.4][:days_ahead]
        )
        backend_api.ensemble_predict = lambda df, days_ahead=7: (
            np.array([141.2, 141.9, 142.5, 143.0, 143.4, 143.8, 144.2][:days_ahead]),
            {
                "auto_arima": np.array([141.1, 141.8, 142.4, 142.9, 143.2, 143.7, 144.0][:days_ahead]),
                "linear_regression": np.array([141.0, 141.6, 142.1, 142.7, 143.2, 143.9, 144.4][:days_ahead]),
                "random_forest": np.array([141.3, 142.0, 142.6, 143.1, 143.5, 143.8, 144.3][:days_ahead]),
            },
        )
        backend_api.prediction_service.get_future_prediction_dates = lambda df, horizon: self.future_dates[:horizon]

    def tearDown(self):
        backend_api.yf.Ticker = self.original["ticker_cls"]
        backend_api.create_dataset = self.original["create_dataset"]
        backend_api.linear_regression_predict = self.original["linear_regression_predict"]
        backend_api.ensemble_predict = self.original["ensemble_predict"]
        backend_api.rolling_window_backtest = self.original["rolling_window_backtest"]
        backend_api.prediction_service.get_future_prediction_dates = self.original["future_prediction_dates"]

    def test_single_model_prediction_route_uses_trading_session_dates(self):
        response = self.client.get("/predict/LinReg/AAPL")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["predictions"][0]["date"], "2026-04-03")
        self.assertEqual(len(payload["predictions"]), 7)

    def test_ensemble_prediction_route_keeps_contract_with_new_models(self):
        response = self.client.get("/predict/ensemble/AAPL")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["symbol"], "AAPL")
        self.assertIn("auto_arima", payload["modelsUsed"])
        self.assertIn("confidence", payload)
        self.assertEqual(payload["predictions"][-1]["date"], "2026-04-13")

    def test_evaluate_route_forwards_include_explanations(self):
        captured = {}

        def _fake_backtest(ticker, **kwargs):
            captured["ticker"] = ticker
            captured.update(kwargs)
            return {
                "ticker": ticker,
                "featureSpecVersion": "prediction-stack-v2",
                "test_period": {"start_date": "2026-01-01", "end_date": "2026-01-10", "days": 6},
                "dates": ["2026-01-01", "2026-01-02"],
                "actuals": [100.0, 101.0],
                "models": {
                    "ensemble": {
                        "predictions": [100.5, 101.2],
                        "metrics": {
                            "mae": 1.0,
                            "rmse": 1.2,
                            "mape": 1.1,
                            "r_squared": 0.8,
                            "directional_accuracy": 50.0,
                        },
                    }
                },
                "evaluationOptions": {"includeExplanations": kwargs.get("include_explanations")},
                "returns": {
                    "initial_capital": 10000.0,
                    "final_value": 10100.0,
                    "total_return": 1.0,
                    "buy_hold_return": 0.8,
                    "outperformance": 0.2,
                    "sharpe_ratio": 1.0,
                    "max_drawdown": -1.0,
                    "num_trades": 1,
                    "portfolio_values": [10000.0, 10100.0],
                },
                "best_model": "ensemble",
            }

        backend_api.rolling_window_backtest = _fake_backtest

        response = self.client.get("/evaluate/AAPL?fast_mode=false&include_explanations=true&test_days=30")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["ticker"], "AAPL")
        self.assertEqual(captured["test_days"], 30)
        self.assertEqual(captured["fast_mode"], False)
        self.assertEqual(captured["include_explanations"], True)
        self.assertEqual(response.get_json()["featureSpecVersion"], "prediction-stack-v2")


if __name__ == "__main__":
    unittest.main()
