import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import selective_prediction as sp


class _DummySelectorModel:
    def predict_proba(self, X):
        n = len(X)
        return np.tile(np.array([[0.2, 0.8]]), (n, 1))


def _iso_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat().replace("+00:00", "Z")


class GlobalSelectorArtifactValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="mm_selective_global_")
        self.config = sp.SelectiveConfig(global_artifact_root=self.tmpdir)
        self.frame, self.base_features, self.latest_row = self._build_feature_context()

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _build_feature_context(self):
        idx = pd.date_range("2024-01-01", periods=260, freq="D")
        raw = pd.DataFrame(
            {
                "Open": np.linspace(100.0, 180.0, len(idx)),
                "High": np.linspace(101.0, 181.0, len(idx)),
                "Low": np.linspace(99.0, 179.0, len(idx)),
                "Close": np.linspace(100.0, 180.0, len(idx)),
                "Volume": np.linspace(1_000_000, 2_000_000, len(idx)),
            },
            index=idx,
        )
        frame, base_features = sp.build_fixed_features(raw, lookback=self.config.lookback)
        return frame, base_features, frame.iloc[-1]

    def _write_global_model_artifact(self, created_days_ago: int = 0):
        os.makedirs(self.tmpdir, exist_ok=True)
        signature = sp._build_global_data_signature(self.base_features, self.config)
        payload = {
            "selector_model": _DummySelectorModel(),
            "calibrator": None,
            "selector_feature_columns": ["raw_signal", "ticker_hash_bucket"],
            "base_feature_columns": [],
        }
        metadata = {
            "schema_version": sp.GLOBAL_SELECTOR_SCHEMA_VERSION,
            "data_signature": signature,
            "created_at": _iso_days_ago(created_days_ago),
            "trained_on_end_date_global": str(self.frame.index[-3].date()),
            "latest_available_settled_date_global": str(self.frame.index[-2].date()),
        }
        model_path, meta_path = sp._global_model_paths(self.tmpdir)
        joblib.dump(payload, model_path)
        with open(meta_path, "w", encoding="utf-8") as f:
            import json

            json.dump(metadata, f)
        return metadata

    def _write_tau_file(
        self,
        model_metadata,
        created_days_ago: int = 0,
        signature_override: str = None,
        mode_status: str = "ok",
        tau_value: float = 0.6,
    ):
        tau_dir = os.path.join(self.tmpdir, "taus")
        os.makedirs(tau_dir, exist_ok=True)
        tau_payload = {
            "schema_version": sp.GLOBAL_TAU_SCHEMA_VERSION,
            "global_model_schema_version": model_metadata["schema_version"],
            "global_model_signature": signature_override or model_metadata["data_signature"],
            "created_at": _iso_days_ago(created_days_ago),
            "mode_status": {"conservative": mode_status},
            "taus": {"conservative": tau_value},
            "training_baseline": {"coverage_pred_conservative": 0.9},
        }
        tau_path = sp._global_tau_path(self.tmpdir, "AAPL")
        with open(tau_path, "w", encoding="utf-8") as f:
            import json

            json.dump(tau_payload, f)

    def _attempt_global(self):
        return sp._attempt_global_selector(
            ticker="AAPL",
            mode_requested="conservative",
            base_feature_cols=self.base_features,
            feature_frame=self.frame,
            latest_row=self.latest_row,
            regime_er=0.42,
            regime_bucket="neutral",
            raw_signal=0.02,
            ensemble_disagreement=0.01,
            config=self.config,
        )

    def test_global_model_ok_missing_tau_maps_to_disabled_mode(self):
        self._write_global_model_artifact(created_days_ago=0)
        out = self._attempt_global()
        self.assertEqual(out.status, "disabled_mode")
        self.assertEqual(out.reason, "tau_file_missing")

    def test_global_tau_signature_mismatch_disables_mode(self):
        model_metadata = self._write_global_model_artifact(created_days_ago=0)
        self._write_tau_file(model_metadata, created_days_ago=0, signature_override="bad-signature")
        out = self._attempt_global()
        self.assertEqual(out.status, "stale_artifact")

    def test_global_ttl_checked_separately_model_vs_tau(self):
        # model stale, tau fresh -> stale_artifact
        model_metadata = self._write_global_model_artifact(created_days_ago=30)
        self._write_tau_file(model_metadata, created_days_ago=0)
        out_model_stale = self._attempt_global()
        self.assertEqual(out_model_stale.status, "stale_artifact")

        # model fresh, tau stale -> stale_artifact
        shutil.rmtree(self.tmpdir, ignore_errors=True)
        os.makedirs(self.tmpdir, exist_ok=True)
        model_metadata = self._write_global_model_artifact(created_days_ago=0)
        self._write_tau_file(model_metadata, created_days_ago=30)
        out_tau_stale = self._attempt_global()
        self.assertEqual(out_tau_stale.status, "stale_artifact")


if __name__ == "__main__":
    unittest.main()
