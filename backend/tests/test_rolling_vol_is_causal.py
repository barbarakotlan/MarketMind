import os
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import (
    SelectiveConfig,
    _build_selector_feature_frame,
    compute_causal_rolling_volatility,
)


class TestRollingVolIsCausal(unittest.TestCase):
    def test_compute_causal_vol_does_not_use_current_or_future_value(self):
        idx = pd.date_range("2025-01-01", periods=10, freq="D")
        base = pd.Series([0.01, 0.015, -0.01, 0.02, 0.005, -0.002, 0.03, 0.01, -0.004, 0.008], index=idx)
        altered = base.copy()
        altered.iloc[-1] = 9.0

        vol_a = compute_causal_rolling_volatility(base, window=4)
        vol_b = compute_causal_rolling_volatility(altered, window=4)

        # Shift(1) means volatility at t is based on returns strictly before t.
        self.assertAlmostEqual(float(vol_a.iloc[-1]), float(vol_b.iloc[-1]), places=12)

    def test_selector_rolling_vol_independent_of_target_return(self):
        idx = pd.date_range("2025-01-01", periods=20, freq="D")
        frame = pd.DataFrame(
            {
                "Close": np.linspace(100, 120, len(idx)),
                "ret_1": np.linspace(-0.01, 0.015, len(idx)),
                "raw_signal": np.linspace(-0.2, 0.2, len(idx)),
                "target_return": np.linspace(0.001, 0.02, len(idx)),
                "regime_bucket": ["neutral"] * len(idx),
                "regime_er": np.linspace(0.1, 0.7, len(idx)),
            },
            index=idx,
        )
        cfg = SelectiveConfig(vol_window=5)
        out_a, _ = _build_selector_feature_frame(frame.copy(), base_features=["ret_1"], config=cfg)

        frame_alt = frame.copy()
        frame_alt["target_return"] = np.linspace(5.0, 10.0, len(idx))
        out_b, _ = _build_selector_feature_frame(frame_alt, base_features=["ret_1"], config=cfg)

        np.testing.assert_allclose(
            out_a["rolling_vol_y"].values,
            out_b["rolling_vol_y"].values,
            rtol=0.0,
            atol=1e-12,
        )


if __name__ == "__main__":
    unittest.main()
