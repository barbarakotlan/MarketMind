import os
import sys
import unittest

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import construct_selector_labels


class TestSelectorLabelExclusions(unittest.TestCase):
    def test_zero_prediction_and_missing_vol_are_excluded(self):
        idx = pd.date_range("2025-01-01", periods=8, freq="D")
        yhat = pd.Series([0.0, 0.01, 0.01, -0.02, 0.03, 0.02, -0.01, 0.0], index=idx)
        y = pd.Series([0.01, 0.02, -0.01, -0.01, 0.03, 0.01, -0.02, 0.02], index=idx)

        labeled, counts = construct_selector_labels(
            yhat_oof=yhat,
            y_true=y,
            vol_window=3,
            magnitude_k=0.5,
            min_history=0,
        )

        self.assertGreater(counts["invalid"], 0)
        self.assertFalse(labeled.iloc[0]["valid_label"])  # vol not available yet
        self.assertFalse(labeled.iloc[-1]["valid_label"])  # zero-sign prediction


if __name__ == "__main__":
    unittest.main()
