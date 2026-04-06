import os
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import prediction_service


def _sample_ohlcv(rows=220):
    index = pd.bdate_range("2025-01-02", periods=rows)
    close = np.linspace(100.0, 140.0, rows)
    return pd.DataFrame(
        {
            "Open": close - 0.5,
            "High": close + 1.0,
            "Low": close - 1.0,
            "Close": close,
            "Volume": np.linspace(1_000_000, 1_500_000, rows),
        },
        index=index,
    )


class PredictionServiceTests(unittest.TestCase):
    def setUp(self):
        self.original = {
            "load_canonical_ohlcv": prediction_service._load_canonical_ohlcv,
            "predict_components": prediction_service._predict_production_components,
            "prepare_cv_frames": prediction_service._prepare_cv_frames,
            "ensemble_weights": prediction_service._ensemble_weights_from_recent_cv,
            "build_explainability": prediction_service._build_evaluation_explainability,
            "build_long_frame": prediction_service._build_long_frame,
            "build_statsforecast": prediction_service._build_statsforecast,
            "build_mlforecast": prediction_service._build_mlforecast,
        }
        prediction_service._CACHE.clear()

    def tearDown(self):
        prediction_service._load_canonical_ohlcv = self.original["load_canonical_ohlcv"]
        prediction_service._predict_production_components = self.original["predict_components"]
        prediction_service._prepare_cv_frames = self.original["prepare_cv_frames"]
        prediction_service._ensemble_weights_from_recent_cv = self.original["ensemble_weights"]
        prediction_service._build_evaluation_explainability = self.original["build_explainability"]
        prediction_service._build_long_frame = self.original["build_long_frame"]
        prediction_service._build_statsforecast = self.original["build_statsforecast"]
        prediction_service._build_mlforecast = self.original["build_mlforecast"]
        prediction_service._CACHE.clear()

    def test_prediction_snapshot_preserves_contract(self):
        ohlcv = _sample_ohlcv()
        prediction_service._load_canonical_ohlcv = lambda ticker: ohlcv.copy()
        prediction_service._predict_production_components = lambda ohlcv_arg, horizon, ticker: (
            np.array([141.25, 141.8, 142.4]),
            {
                "auto_arima": np.array([141.0, 141.6, 142.1]),
                "linear_regression": np.array([141.4, 141.9, 142.5]),
                "random_forest": np.array([141.2, 141.7, 142.2]),
            },
            [pd.Timestamp("2026-04-03"), pd.Timestamp("2026-04-06"), pd.Timestamp("2026-04-07")],
            {"auto_arima": 0.3, "linear_regression": 0.35, "random_forest": 0.35},
        )

        snapshot = prediction_service.get_prediction_snapshot("AAPL")

        self.assertEqual(snapshot["recentClose"], 140.0)
        self.assertEqual(snapshot["recentPredicted"], 141.25)
        self.assertEqual(snapshot["modelsUsed"], ["auto_arima", "linear_regression", "random_forest"])
        self.assertEqual(len(snapshot["predictions"]), 3)
        self.assertEqual(snapshot["predictions"][0]["date"], "2026-04-03")
        self.assertIn("confidence", snapshot)

    def test_ensemble_weights_fallback_to_equal_weight_when_cv_fails(self):
        ohlcv = _sample_ohlcv()
        prediction_service._build_long_frame = lambda ohlcv_arg, ticker: pd.DataFrame(
            {
                "unique_id": ["AAPL"] * len(ohlcv),
                "ds": np.arange(1, len(ohlcv) + 1),
                "y": np.linspace(100.0, 140.0, len(ohlcv)),
            }
        )

        class _BrokenStatsForecast:
            def cross_validation(self, *args, **kwargs):
                raise RuntimeError("stats unavailable")

        class _BrokenMLForecast:
            def cross_validation(self, *args, **kwargs):
                raise RuntimeError("ml unavailable")

        prediction_service._build_statsforecast = lambda: _BrokenStatsForecast()
        prediction_service._build_mlforecast = lambda models: _BrokenMLForecast()

        weights = prediction_service._ensemble_weights_from_recent_cv(ohlcv, "AAPL")

        self.assertAlmostEqual(sum(weights.values()), 1.0, places=6)
        expected_models = 4 if prediction_service.XGBOOST_AVAILABLE else 3
        self.assertEqual(len(weights), expected_models)
        first_weight = next(iter(weights.values()))
        for value in weights.values():
            self.assertAlmostEqual(value, first_weight, places=6)

    def test_rolling_window_backtest_returns_feature_spec_and_explainability(self):
        ohlcv = _sample_ohlcv()
        merged_cv = pd.DataFrame(
            {
                "unique_id": ["AAPL"] * 6,
                "ds": [180, 181, 182, 183, 184, 185],
                "cutoff": [179, 180, 181, 182, 183, 184],
                "y": [131.0, 132.0, 133.0, 134.0, 135.0, 136.0],
                "naive": [130.8, 131.6, 132.7, 133.8, 134.7, 135.8],
                "seasonal_naive_5": [130.5, 131.8, 132.9, 133.6, 134.9, 136.1],
                "auto_arima": [131.2, 132.2, 133.1, 134.1, 135.2, 136.2],
                "linear_regression": [131.1, 132.1, 133.2, 134.2, 135.1, 136.3],
                "random_forest": [131.0, 132.3, 133.4, 134.4, 135.5, 136.4],
                "xgboost": [131.3, 132.4, 133.3, 134.5, 135.4, 136.5],
            }
        )

        prediction_service._load_canonical_ohlcv = lambda ticker: ohlcv.copy()
        prediction_service._prepare_cv_frames = lambda *args, **kwargs: merged_cv.copy()
        prediction_service._ensemble_weights_from_recent_cv = lambda ohlcv_arg, ticker: {
            "auto_arima": 0.25,
            "linear_regression": 0.25,
            "random_forest": 0.25,
            "xgboost": 0.25,
        }
        prediction_service._build_evaluation_explainability = lambda *args, **kwargs: {
            "linear_regression": {
                "global_top_features": [{"feature": "lag1", "meanAbsImpact": 1.2345}],
                "latest_prediction_contributors": [{"feature": "lag1", "value": 135.0, "impact": 0.5678}],
            }
        }

        result = prediction_service.rolling_window_backtest(
            "AAPL",
            test_days=6,
            retrain_frequency=2,
            fast_mode=False,
            include_explanations=True,
        )

        self.assertEqual(result["ticker"], "AAPL")
        self.assertEqual(result["featureSpecVersion"], prediction_service.FEATURE_SPEC_VERSION)
        self.assertEqual(result["evaluationOptions"]["includeExplanations"], True)
        self.assertIn("ensemble", result["models"])
        self.assertIn("linear_regression", result["models"])
        self.assertIn("explainability", result["models"]["linear_regression"])
        self.assertNotIn("explainability", result["models"]["ensemble"])
        self.assertEqual(len(result["dates"]), 6)
        self.assertEqual(result["returns"]["initial_capital"], 10000.0)
        self.assertIn(result["best_model"], result["models"])


if __name__ == "__main__":
    unittest.main()
