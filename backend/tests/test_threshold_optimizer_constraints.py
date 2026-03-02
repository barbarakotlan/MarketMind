import os
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import optimize_threshold_for_mode


class TestThresholdOptimizerConstraints(unittest.TestCase):
    def test_optimizer_respects_coverage_and_min_trades(self):
        n = 240
        idx = pd.date_range("2025-01-01", periods=n, freq="D")
        selector_prob = np.linspace(0.0, 1.0, n)
        raw_signal = np.where(np.arange(n) % 2 == 0, 0.01, 0.0)  # creates frequent entries
        target_return = np.where(np.arange(n) % 2 == 0, 0.01, 0.0)
        frame = pd.DataFrame(
            {
                "selector_prob": selector_prob,
                "raw_signal": raw_signal,
                "target_return": target_return,
                "regime_bucket": ["neutral"] * n,
            },
            index=idx,
        )

        result = optimize_threshold_for_mode(
            validation_df=frame,
            mode="conservative",
            min_coverage=0.85,
            min_trades=40,
            pred_deadband=0.0,
            one_way_cost_bps=10.0,
        )

        self.assertEqual(result["status"], "ok")
        self.assertGreaterEqual(result["coverage_pred"], 0.85)
        self.assertGreaterEqual(result["executed_trades"], 40)


if __name__ == "__main__":
    unittest.main()
