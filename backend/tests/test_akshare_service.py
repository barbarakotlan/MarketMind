import os
import sys
import unittest
from unittest.mock import patch

import pandas as pd


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import akshare_service


class AkshareServiceTests(unittest.TestCase):
    def setUp(self):
        akshare_service._ASIA_MACRO_CACHE.clear()

    def test_service_reports_unavailable_when_disabled(self):
        with patch.dict(os.environ, {"AKSHARE_ENABLED": "false"}, clear=False):
            self.assertFalse(akshare_service.is_available())
            with self.assertRaises(akshare_service.AkshareUnavailableError):
                akshare_service.search_equities("700", market="hk")

    def test_search_equities_merges_and_deduplicates_by_asset_id(self):
        with patch.object(
            akshare_service,
            "_search_hk_equities",
            return_value=[
                {"symbol": "00700", "name": "Tencent", "market": "HK", "exchange": "HKEX", "assetId": "HK:00700", "_rank": 1},
                {"symbol": "00700", "name": "Tencent Holdings", "market": "HK", "exchange": "HKEX", "assetId": "HK:00700", "_rank": 2},
            ],
        ), patch.object(
            akshare_service,
            "_search_cn_equities",
            return_value=[
                {"symbol": "600519", "name": "Kweichow Moutai", "market": "CN", "exchange": "SSE", "assetId": "CN:600519", "_rank": 3},
            ],
        ):
            results = akshare_service.search_equities("70", market="all", limit=5)

        self.assertEqual([row["assetId"] for row in results], ["HK:00700", "CN:600519"])
        self.assertEqual(results[0]["name"], "Tencent")

    def test_ai_context_normalizes_announcements_and_quote_summary(self):
        with patch.object(
            akshare_service,
            "get_equity_fundamentals",
            return_value={
                "assetId": "HK:00700",
                "market": "HK",
                "exchange": "HKEX",
                "name": "Tencent Holdings",
                "sector": "Communication Services",
                "industry": "Internet Content & Information",
                "currency": "HKD",
                "market_cap": None,
                "description": "Tencent overview",
                "researchProfile": [{"label": "Company", "value": "Tencent Holdings Limited"}],
                "announcements": [
                    {
                        "title": "Tencent announces annual results",
                        "link": "https://example.com/tencent-results",
                        "publishTime": "2026-03-20",
                    }
                ],
            },
        ), patch.object(
            akshare_service,
            "get_equity_snapshot",
            return_value={
                "price": 320.5,
                "change": 4.8,
                "changePercent": 1.52,
            },
        ):
            payload = akshare_service.get_equity_ai_context("HK:00700")

        self.assertEqual(payload["assetId"], "HK:00700")
        self.assertEqual(payload["assetName"], "Tencent Holdings")
        self.assertEqual(payload["quoteSummary"]["price"], 320.5)
        self.assertEqual(payload["recentNews"][0]["title"], "Tencent announces annual results")
        self.assertEqual(payload["companyResearch"]["profile"][0]["label"], "Company")

    def test_asia_macro_overview_normalizes_macro_indicators_and_signals(self):
        class FakeAkshare:
            @staticmethod
            def macro_china_cpi_yearly():
                return pd.DataFrame(
                    [
                        {"日期": "2026-01-01", "今值": 0.5, "前值": 0.2},
                        {"日期": "2026-02-01", "今值": 0.7, "前值": 0.5},
                    ]
                )

            @staticmethod
            def macro_china_gdp_yearly():
                return pd.DataFrame(
                    [
                        {"日期": "2025-10-18", "今值": 4.6, "前值": 4.7},
                        {"日期": "2026-01-18", "今值": 4.8, "前值": 4.6},
                    ]
                )

            @staticmethod
            def macro_china_pmi_yearly():
                return pd.DataFrame(
                    [
                        {"日期": "2026-01-31", "今值": 49.4, "前值": 49.2},
                        {"日期": "2026-02-28", "今值": 50.3, "前值": 49.4},
                    ]
                )

            @staticmethod
            def macro_china_hk_cpi_ratio():
                return pd.DataFrame(
                    [
                        {"发布日期": "2026-01-20", "现值": 1.6, "前值": 1.5},
                        {"发布日期": "2026-02-20", "现值": 1.7, "前值": 1.6},
                    ]
                )

            @staticmethod
            def macro_china_hk_rate_of_unemployment():
                return pd.DataFrame(
                    [
                        {"发布日期": "2026-01-18", "现值": 3.2, "前值": 3.3},
                        {"发布日期": "2026-02-18", "现值": 3.1, "前值": 3.2},
                    ]
                )

            @staticmethod
            def forex_spot_em():
                return pd.DataFrame(
                    [
                        {"代码": "USDCNH", "名称": "美元兑离岸人民币", "最新价": 7.2145, "涨跌额": 0.0158, "涨跌幅": 0.22, "更新时间": "2026-04-02"},
                        {"代码": "USDHKD", "名称": "美元兑港元", "最新价": 7.8051, "涨跌额": 0.0011, "涨跌幅": 0.01, "更新时间": "2026-04-02"},
                    ]
                )

            @staticmethod
            def futures_global_spot_em():
                return pd.DataFrame(
                    [
                        {"名称": "布伦特原油", "最新价": 84.12, "涨跌额": 0.8, "涨跌幅": 0.96, "最新行情时间": "2026-04-02"},
                        {"名称": "COMEX铜", "最新价": 4.58, "涨跌额": -0.04, "涨跌幅": -0.84, "最新行情时间": "2026-04-02"},
                    ]
                )

        with patch.object(akshare_service, "_load_akshare_module", return_value=FakeAkshare()):
            payload = akshare_service.get_asia_macro_overview()

        self.assertEqual(payload["region"], "asia")
        self.assertEqual(payload["title"], "Asia Macro Dashboard")
        self.assertEqual([item["symbol"] for item in payload["indicators"][:2]], ["CN_CPI", "CN_GDP"])
        self.assertEqual(payload["indicators"][-1]["symbol"], "HK_URATE")
        self.assertEqual(payload["indicators"][-1]["prev"], 3.2)
        self.assertEqual([item["symbol"] for item in payload["marketSignals"]], ["USDCNH", "USDHKD", "BRENT", "COPPER"])


if __name__ == "__main__":
    unittest.main()
