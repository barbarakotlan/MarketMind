import os
import sys
import unittest

import numpy as np
from sklearn.ensemble import RandomForestClassifier

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import calibrate_selector_model


class TestCalibrationTemporalIsolation(unittest.TestCase):
    def setUp(self):
        rs = np.random.RandomState(42)
        self.X_train = rs.randn(300, 6)
        self.y_train = (self.X_train[:, 0] + self.X_train[:, 1] > 0).astype(int)
        self.model = RandomForestClassifier(n_estimators=25, random_state=42)
        self.model.fit(self.X_train, self.y_train)

    def test_small_calibration_uses_sigmoid(self):
        rs = np.random.RandomState(7)
        X_cal = rs.randn(120, 6)
        y_cal = (X_cal[:, 0] > 0).astype(int)

        calibrator, method = calibrate_selector_model(
            selector_model=self.model,
            X_cal=X_cal,
            y_cal=y_cal,
            min_samples_for_isotonic=1000,
            min_positives_for_isotonic=200,
        )
        self.assertIsNotNone(calibrator)
        self.assertEqual(method, "sigmoid")

    def test_large_calibration_uses_isotonic(self):
        rs = np.random.RandomState(8)
        X_cal = rs.randn(1200, 6)
        y_cal = (X_cal[:, 0] > -0.1).astype(int)

        calibrator, method = calibrate_selector_model(
            selector_model=self.model,
            X_cal=X_cal,
            y_cal=y_cal,
            min_samples_for_isotonic=1000,
            min_positives_for_isotonic=200,
        )
        self.assertIsNotNone(calibrator)
        self.assertEqual(method, "isotonic")


if __name__ == "__main__":
    unittest.main()
