import os
import sys
import unittest

import pandas as pd


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api


class _FakeTicker:
    def __init__(self, symbol):
        self.symbol = symbol
        self.quarterly_financials = pd.DataFrame()

    @property
    def info(self):
        return {
            "regularMarketPrice": 187.2,
            "previousClose": 185.0,
            "marketCap": 3100000000000,
            "exchange": "NASDAQ",
            "currency": "USD",
            "longName": "Apple Inc.",
            "forwardPE": 28.4,
            "pegRatio": 2.1,
            "priceToBook": 44.2,
            "beta": 1.18,
            "dividendYield": 0.0045,
            "numberOfAnalystOpinions": 37,
            "trailingPE": 30.6,
            "fiftyTwoWeekHigh": 210.0,
            "fiftyTwoWeekLow": 164.0,
            "targetMeanPrice": 215.0,
            "recommendationKey": "buy",
            "longBusinessSummary": "Apple designs consumer hardware and software products.",
        }

    def history(self, period="7d", interval="1d"):
        return pd.DataFrame(
            {
                "Open": [181.0, 183.0],
                "High": [185.0, 188.0],
                "Low": [180.0, 182.0],
                "Close": [184.0, 187.2],
                "Volume": [1000, 1200],
            },
            index=pd.to_datetime(["2026-04-01", "2026-04-02"]),
        )


class _FakeYFinanceModule:
    @staticmethod
    def Ticker(symbol):
        return _FakeTicker(symbol)


class ExchangeSessionRouteTests(unittest.TestCase):
    def setUp(self):
        self.original = {
            "yf": backend_api.yf,
            "alpha_vantage_key": backend_api.ALPHA_VANTAGE_API_KEY,
            "fundamentals_from_yfinance": backend_api.api_market_utils_helpers.fundamentals_from_yfinance,
        }
        backend_api.yf = _FakeYFinanceModule
        backend_api.ALPHA_VANTAGE_API_KEY = ""
        backend_api.api_market_utils_helpers.fundamentals_from_yfinance = lambda sym, **kwargs: {
            "symbol": sym,
            "name": "Apple Inc.",
            "description": "Apple designs consumer hardware and software products.",
            "exchange": "NASDAQ",
            "currency": "USD",
            "sector": "Technology",
            "industry": "Consumer Electronics",
        }
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

    def tearDown(self):
        backend_api.yf = self.original["yf"]
        backend_api.ALPHA_VANTAGE_API_KEY = self.original["alpha_vantage_key"]
        backend_api.api_market_utils_helpers.fundamentals_from_yfinance = self.original["fundamentals_from_yfinance"]

    def test_stock_route_includes_market_session(self):
        response = self.client.get("/stock/AAPL")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("marketSession", payload)
        self.assertEqual(payload["marketSession"]["calendarCode"], "XNYS")
        self.assertEqual(payload["marketSession"]["market"], "US")

    def test_fundamentals_route_includes_market_session(self):
        response = self.client.get("/fundamentals/AAPL")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("marketSession", payload)
        self.assertEqual(payload["marketSession"]["calendarCode"], "XNYS")
        self.assertEqual(payload["marketSession"]["market"], "US")

    def test_market_sessions_route_returns_normalized_schedule(self):
        response = self.client.get("/calendar/market-sessions?market=hk&days=3")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["calendarCode"], "XHKG")
        self.assertEqual(payload["market"], "HK")
        self.assertEqual(len(payload["sessions"]), 3)
        self.assertIn("today", payload)
        self.assertIn("upcomingHolidays", payload)


if __name__ == "__main__":
    unittest.main()
