import os
import sys
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import selective_prediction as sp


class _NoWarnLogger:
    def __init__(self):
        self.warning_calls = 0

    def warning(self, *args, **kwargs):
        self.warning_calls += 1

    def debug(self, *args, **kwargs):
        pass


class DriftMonitorNoopTests(unittest.TestCase):
    def _sample_df(self, rows: int = 240) -> pd.DataFrame:
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

    def test_drift_monitor_noop_when_mode_none(self):
        logger = _NoWarnLogger()
        out = sp.infer_selective_decision(
            ticker="AAPL",
            requested_mode="none",
            selector_source_requested="auto",
            logger=logger,
        )
        self.assertEqual(out["selector_status"], "disabled")
        self.assertEqual(out["selector_source"], "none")
        self.assertEqual(logger.warning_calls, 0)

    def test_drift_monitor_noop_when_status_not_ok(self):
        logger = _NoWarnLogger()
        df = self._sample_df()
        with patch.object(sp, "prepare_data_for_ml", return_value=df), patch.object(
            sp, "_load_artifact", return_value=(None, None)
        ):
            out = sp.infer_selective_decision(
                ticker="AAPL",
                requested_mode="conservative",
                selector_source_requested="ticker",
                raw_signal=0.01,
                ensemble_disagreement=0.01,
                logger=logger,
            )
        self.assertEqual(out["selector_status"], "model_unavailable")
        self.assertEqual(out["selector_source"], "none")
        self.assertEqual(logger.warning_calls, 0)


if __name__ == "__main__":
    unittest.main()
