import os
import sys
import tempfile
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import selective_prediction
from selective_prediction import SelectiveConfig, run_selective_evaluation_from_df


class TestLiftCurveTestOnly(unittest.TestCase):
    def test_lift_curve_counts_match_test_slice(self):
        rs = np.random.RandomState(42)
        n = 260
        idx = pd.date_range("2024-01-01", periods=n, freq="D")
        base = 100 + np.cumsum(rs.normal(0, 1.0, n))
        open_prices = base + rs.normal(0, 0.2, n)
        close_prices = base + rs.normal(0, 0.2, n)
        high_prices = np.maximum(open_prices, close_prices) + 0.3
        low_prices = np.minimum(open_prices, close_prices) - 0.3
        volume = rs.randint(1000, 3000, size=n)

        df = pd.DataFrame(
            {
                "Open": open_prices,
                "High": high_prices,
                "Low": low_prices,
                "Close": close_prices,
                "Volume": volume,
            },
            index=idx,
        )

        with tempfile.TemporaryDirectory() as tmp_artifacts:
            original_xgb_flag = selective_prediction.XGBOOST_AVAILABLE
            selective_prediction.XGBOOST_AVAILABLE = False
            try:
                result = run_selective_evaluation_from_df(
                    ticker="AAPL",
                    df_raw=df,
                    config=SelectiveConfig(
                        lookback=5,
                        min_history=20,
                        retrain_frequency=30,
                        vol_window=5,
                        min_trades=2,
                        conservative_min_coverage=0.20,
                        aggressive_min_coverage=0.10,
                    ),
                    artifact_root=tmp_artifacts,
                )
            finally:
                selective_prediction.XGBOOST_AVAILABLE = original_xgb_flag

        self.assertIsNotNone(result)
        lift_total = sum(row["count"] for row in result["lift_curve"])
        regime_total = sum(v["count"] for v in result["regime_metrics"]["none"].values())
        self.assertEqual(lift_total, regime_total)


if __name__ == "__main__":
    unittest.main()
