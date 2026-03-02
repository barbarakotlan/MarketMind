import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import has_window_intersection


class TestSelectiveWindowIntersectionLeakage(unittest.TestCase):
    def test_detects_overlap(self):
        lookback = 30
        horizon = 1
        test_i = 100
        # This sample's label window overlaps test feature window.
        train_i = 71
        self.assertTrue(has_window_intersection(train_i, test_i, lookback, horizon))

    def test_detects_safe_non_overlap(self):
        lookback = 30
        horizon = 1
        test_i = 100
        train_i = 60
        self.assertFalse(has_window_intersection(train_i, test_i, lookback, horizon))


if __name__ == "__main__":
    unittest.main()
