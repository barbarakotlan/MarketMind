import os
import sys
import unittest
from datetime import datetime, timezone


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import exchange_session_service


class ExchangeSessionServiceTests(unittest.TestCase):
    def test_market_mapping_uses_expected_calendar_codes(self):
        self.assertEqual(exchange_session_service.get_market_session("us")["calendarCode"], "XNYS")
        self.assertEqual(exchange_session_service.get_market_session("hk")["calendarCode"], "XHKG")
        self.assertEqual(exchange_session_service.get_market_session("cn")["calendarCode"], "XSHG")

    def test_hong_kong_lunch_break_is_reported_as_break(self):
        payload = exchange_session_service.get_market_session(
            "hk",
            now=datetime(2026, 4, 2, 4, 20, tzinfo=timezone.utc),
        )
        self.assertEqual(payload["status"], "break")
        self.assertEqual(payload["reason"], "lunch_break")
        self.assertEqual(payload["calendarCode"], "XHKG")
        self.assertIsNotNone(payload["breakStart"])
        self.assertIsNotNone(payload["breakEnd"])
        self.assertIsNotNone(payload["nextOpen"])

    def test_mainland_china_lunch_break_is_reported_as_break(self):
        payload = exchange_session_service.get_market_session(
            "cn",
            now=datetime(2026, 4, 2, 4, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(payload["status"], "break")
        self.assertEqual(payload["reason"], "lunch_break")
        self.assertEqual(payload["calendarCode"], "XSHG")

    def test_us_weekend_returns_closed_with_next_open(self):
        payload = exchange_session_service.get_market_session(
            "us",
            now=datetime(2026, 4, 4, 15, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(payload["status"], "closed")
        self.assertEqual(payload["reason"], "weekend")
        self.assertFalse(payload["isTradingDay"])
        self.assertIsNotNone(payload["nextOpen"])
        self.assertIsNotNone(payload["nextClose"])

    def test_market_sessions_calendar_returns_upcoming_schedule(self):
        payload = exchange_session_service.get_market_sessions_calendar(
            "us",
            days=3,
            now=datetime(2026, 4, 2, 15, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(payload["calendarCode"], "XNYS")
        self.assertEqual(payload["today"]["market"], "US")
        self.assertEqual(len(payload["sessions"]), 3)
        self.assertIn("opensAt", payload["sessions"][0])
        self.assertIn("closesAt", payload["sessions"][0])


if __name__ == "__main__":
    unittest.main()
