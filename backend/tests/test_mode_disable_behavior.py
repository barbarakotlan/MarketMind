import os
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import optimize_threshold_for_mode


class TestModeDisableBehavior(unittest.TestCase):
    def test_mode_disabled_when_constraints_unmet(self):
        n = 120
        idx = pd.date_range("2025-01-01", periods=n, freq="D")
        frame = pd.DataFrame(
            {
                "selector_prob": np.full(n, 0.95),
                "raw_signal": np.zeros(n),  # no entries possible
                "target_return": np.full(n, 0.001),
                "regime_bucket": ["trend"] * n,
            },
            index=idx,
        )

        result = optimize_threshold_for_mode(
            validation_df=frame,
            mode="aggressive",
            min_coverage=0.55,
            min_trades=40,
            pred_deadband=0.0,
            one_way_cost_bps=10.0,
        )

        self.assertEqual(result["status"], "disabled_aggressive")
        self.assertIsNone(result["tau"])


if __name__ == "__main__":
    unittest.main()
