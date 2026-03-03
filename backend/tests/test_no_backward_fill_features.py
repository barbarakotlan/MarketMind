import os
import sys
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import build_fixed_features


class TestNoBackwardFillFeatures(unittest.TestCase):
    def _sample_ohlcv(self) -> pd.DataFrame:
        idx = pd.date_range("2025-01-01", periods=8, freq="D")
        return pd.DataFrame(
            {
                "Open": np.linspace(100, 107, len(idx)),
                "High": np.linspace(101, 108, len(idx)),
                "Low": np.linspace(99, 106, len(idx)),
                "Close": np.linspace(100, 107, len(idx)),
                "Volume": np.linspace(1_000_000, 1_200_000, len(idx)),
            },
            index=idx,
        )

    def test_build_fixed_features_does_not_call_bfill(self):
        df = self._sample_ohlcv()
        with patch.object(pd.DataFrame, "bfill", side_effect=AssertionError("bfill should not be called")):
            frame, _ = build_fixed_features(df, lookback=3)
        self.assertIsInstance(frame, pd.DataFrame)

    def test_early_lag_rows_are_zero_not_future_backfilled(self):
        df = self._sample_ohlcv()
        frame, _ = build_fixed_features(df, lookback=3)

        # If backward fill were used, these would inherit future lag values.
        self.assertEqual(float(frame["lag_1"].iloc[0]), 0.0)
        self.assertEqual(float(frame["lag_2"].iloc[0]), 0.0)
        self.assertEqual(float(frame["lag_2"].iloc[1]), 0.0)
        self.assertEqual(float(frame["lag_3"].iloc[2]), 0.0)


if __name__ == "__main__":
    unittest.main()
