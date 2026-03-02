import os
import sys
import unittest

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import compute_open_to_open_target


class TestSelectorLabelAlignmentOpenOpen(unittest.TestCase):
    def test_open_to_open_alignment_h1(self):
        idx = pd.date_range("2025-01-01", periods=5, freq="D")
        df = pd.DataFrame(
            {
                "Open": [100.0, 102.0, 104.0, 108.0, 110.0],
                "High": [101, 103, 105, 109, 111],
                "Low": [99, 101, 103, 107, 109],
                "Close": [100, 102, 104, 108, 110],
                "Volume": [10, 10, 10, 10, 10],
            },
            index=idx,
        )
        y = compute_open_to_open_target(df, horizon=1)

        self.assertAlmostEqual(y.iloc[0], (104.0 / 102.0) - 1.0, places=10)
        self.assertAlmostEqual(y.iloc[1], (108.0 / 104.0) - 1.0, places=10)
        self.assertTrue(pd.isna(y.iloc[-1]))


if __name__ == "__main__":
    unittest.main()
