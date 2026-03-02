import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import purged_train_indices


class TestSelectiveCutoffEquivalence(unittest.TestCase):
    def test_fast_cutoff_matches_formula(self):
        lookback = 30
        horizon = 1
        candidates = list(range(0, 200))

        for test_start in range(40, 180):
            expected_cutoff = test_start - (lookback + horizon + 1)
            expected = [idx for idx in candidates if idx <= expected_cutoff]
            actual = purged_train_indices(
                candidate_indices=candidates,
                test_start=test_start,
                lookback=lookback,
                horizon=horizon,
            )
            self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
