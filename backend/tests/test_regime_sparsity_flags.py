import os
import sys
import unittest

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selective_prediction import apply_regime_sparsity


class TestRegimeSparsityFlags(unittest.TestCase):
    def test_sparse_bucket_is_flagged_and_mapped_to_unknown(self):
        regimes = pd.Series(["chop"] * 50 + ["neutral"] * 40 + ["trend"] * 5 + ["unknown"] * 5)
        mapped, distribution = apply_regime_sparsity(regimes, sparse_min_fraction=0.10)

        self.assertTrue(distribution["trend"]["is_sparse"])
        self.assertEqual((mapped == "trend").sum(), 0)
        self.assertGreater((mapped == "unknown").sum(), (regimes == "unknown").sum())


if __name__ == "__main__":
    unittest.main()
