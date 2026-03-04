import os
import sys
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import selective_prediction as sp


class _DummySelectorModel:
    def predict_proba(self, X):
        n = len(X)
        # Always emits high positive class probability; disabled-path should still return None.
        return np.tile(np.array([[0.05, 0.95]]), (n, 1))


class InferSelectiveDecisionDisabledModeTests(unittest.TestCase):
    def _sample_ohlcv(self, rows: int = 220) -> pd.DataFrame:
        idx = pd.date_range("2025-01-01", periods=rows, freq="D")
        return pd.DataFrame(
            {
                "Open": np.linspace(100.0, 140.0, rows),
                "High": np.linspace(101.0, 141.0, rows),
                "Low": np.linspace(99.0, 139.0, rows),
                "Close": np.linspace(100.0, 140.0, rows),
                "Volume": np.linspace(1_000_000, 1_500_000, rows),
            },
            index=idx,
        )

    def test_disabled_mode_status_forces_non_abstain(self):
        df = self._sample_ohlcv()
        payload = {
            "selector_model": _DummySelectorModel(),
            "calibrator": None,
            "selector_feature_columns": ["raw_signal"],
            "base_feature_columns": [],
        }
        metadata = {
            "mode_status": {"conservative": "disabled_mode"},
            "taus": {"conservative": 0.7},
            "training_baseline": {},
        }

        with patch.object(sp, "prepare_data_for_ml", return_value=df), patch.object(
            sp, "_load_artifact", return_value=(payload, metadata)
        ), patch.object(sp, "_validate_artifact", return_value=(True, "ok")):
            out = sp.infer_selective_decision(
                ticker="AAPL",
                requested_mode="conservative",
                raw_signal=0.25,
                ensemble_disagreement=0.1,
            )

        self.assertEqual(out["selector_status"], "disabled_mode")
        self.assertEqual(out["selector_source"], "none")
        self.assertEqual(out["selector_mode_effective"], "none")
        self.assertFalse(out["abstain"])
        self.assertIsNone(out["selector_prob"])
        self.assertIsNone(out["selector_threshold"])

    def test_none_threshold_forces_non_abstain_even_when_mode_ok(self):
        df = self._sample_ohlcv()
        payload = {
            "selector_model": _DummySelectorModel(),
            "calibrator": None,
            "selector_feature_columns": ["raw_signal"],
            "base_feature_columns": [],
        }
        metadata = {
            "mode_status": {"conservative": "ok"},
            "taus": {"conservative": None},
            "training_baseline": {},
        }

        with patch.object(sp, "prepare_data_for_ml", return_value=df), patch.object(
            sp, "_load_artifact", return_value=(payload, metadata)
        ), patch.object(sp, "_validate_artifact", return_value=(True, "ok")):
            out = sp.infer_selective_decision(
                ticker="AAPL",
                requested_mode="conservative",
                raw_signal=0.25,
                ensemble_disagreement=0.1,
            )

        self.assertEqual(out["selector_status"], "disabled_mode")
        self.assertEqual(out["selector_source"], "none")
        self.assertEqual(out["selector_mode_effective"], "none")
        self.assertFalse(out["abstain"])
        self.assertIsNone(out["selector_prob"])
        self.assertIsNone(out["selector_threshold"])


if __name__ == "__main__":
    unittest.main()
