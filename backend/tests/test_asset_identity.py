import os
import sys
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from asset_identity import parse_asset_reference


class AssetIdentityTests(unittest.TestCase):
    def test_us_asset_defaults_to_us_market(self):
        asset = parse_asset_reference("aapl")
        self.assertEqual(asset["assetId"], "US:AAPL")
        self.assertEqual(asset["market"], "US")
        self.assertEqual(asset["symbol"], "AAPL")
        self.assertFalse(asset["isInternational"])

    def test_hk_asset_normalizes_prefix_and_padding(self):
        asset = parse_asset_reference("hk:700")
        self.assertEqual(asset["assetId"], "HK:00700")
        self.assertEqual(asset["market"], "HK")
        self.assertEqual(asset["symbol"], "00700")
        self.assertEqual(asset["exchange"], "HKEX")
        self.assertTrue(asset["isInternational"])

    def test_cn_asset_recognizes_exchange_suffix(self):
        asset = parse_asset_reference("600519.SH")
        self.assertEqual(asset["assetId"], "CN:600519")
        self.assertEqual(asset["market"], "CN")
        self.assertEqual(asset["exchange"], "SSE")
        self.assertTrue(asset["isInternational"])


if __name__ == "__main__":
    unittest.main()
