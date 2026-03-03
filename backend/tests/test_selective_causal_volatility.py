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


class TestSelectiveCausalVolatility(unittest.TestCase):
    def test_compute_causal_volatility_ignores_future_row(self):
        idx = pd.date_range("2025-01-01", periods=6, freq="D")
        base = pd.Series([0.01, 0.02, -0.01, 0.03, 0.01, 0.02], index=idx)
        altered = base.copy()
        altered.iloc[-1] = 9.99  # extreme future value

        vol_a = compute_causal_rolling_volatility(base, window=3)
        vol_b = compute_causal_rolling_volatility(altered, window=3)

        # At t, shifted rolling vol should not depend on return at t.
        self.assertAlmostEqual(float(vol_a.iloc[-1]), float(vol_b.iloc[-1]), places=12)

    def test_selector_feature_frame_uses_causal_return_volatility(self):
        idx = pd.date_range("2025-01-01", periods=10, freq="D")
        frame = pd.DataFrame(
            {
                "raw_signal": np.linspace(-0.1, 0.1, len(idx)),
                "ret_1": np.linspace(0.001, 0.01, len(idx)),
                "target_return": np.linspace(0.002, 0.02, len(idx)),
                "regime_bucket": ["neutral"] * len(idx),
                "regime_er": np.linspace(0.2, 0.6, len(idx)),
            },
            index=idx,
        )
        cfg = SelectiveConfig(vol_window=3)
        feat_a, _ = _build_selector_feature_frame(frame.copy(), base_features=["ret_1"], config=cfg)

        perturbed = frame.copy()
        perturbed["target_return"] = np.linspace(10.0, 20.0, len(idx))
        feat_b, _ = _build_selector_feature_frame(perturbed, base_features=["ret_1"], config=cfg)

        np.testing.assert_allclose(
            feat_a["rolling_vol_y"].values,
            feat_b["rolling_vol_y"].values,
            rtol=0.0,
            atol=1e-12,
        )


if __name__ == "__main__":
    unittest.main()
