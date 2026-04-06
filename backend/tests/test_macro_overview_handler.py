import os
import sys
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api_handlers_reference_data as reference_data_handlers


class StubLogger:
    def __init__(self):
        self.warnings = []
        self.errors = []

    def warning(self, message):
        self.warnings.append(str(message))

    def error(self, message):
        self.errors.append(str(message))


class FakeResponse:
    def __init__(self, *, text="", status_code=200):
        self.text = text
        self.status_code = status_code


class FakeRequests:
    def __init__(self, responses):
        self.responses = responses

    def get(self, url, timeout=10):
        response = self.responses.get(url)
        if isinstance(response, Exception):
            raise response
        if response is None:
            raise AssertionError(f"Unexpected URL requested: {url}")
        return response


class BrokenTickerModule:
    class Ticker:
        def __init__(self, symbol):
            self.symbol = symbol

        @property
        def info(self):
            raise RuntimeError("yfinance unavailable in test")


class FakeRequest:
    def __init__(self, args=None):
        self.args = args or {}


class MacroOverviewHandlerTests(unittest.TestCase):
    def setUp(self):
        reference_data_handlers._OPENBB_MACRO_SUPPORT_CACHE.clear()

    def test_macro_overview_falls_back_to_fred_when_openbb_macro_router_is_broken(self):
        logger = StubLogger()
        requests_module = FakeRequests(
            {
                "https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE": FakeResponse(
                    text="DATE,UNRATE\n2026-01-01,4.1\n2026-02-01,4.2\n"
                )
            }
        )
        broken_openbb = type("BrokenOpenBB", (), {"economy": object()})()

        payload = reference_data_handlers.get_macro_overview_handler(
            openbb_available=True,
            obb_module=broken_openbb,
            jsonify_fn=lambda data: data,
            logger=logger,
            yf_module=BrokenTickerModule,
            macro_indicators=[
                {
                    "symbol": "URATE",
                    "name": "Unemployment Rate",
                    "unit": "%",
                    "multiplier": 1,
                    "series_id": "UNRATE",
                }
            ],
            requests_module=requests_module,
        )

        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["symbol"], "URATE")
        self.assertEqual(payload[0]["value"], 4.2)
        self.assertEqual(payload[0]["prev"], 4.1)
        self.assertEqual(payload[0]["date"], "2026-02-01")
        self.assertIn("using FRED fallback", logger.warnings[0])

    def test_macro_overview_logs_openbb_fallback_only_once_for_repeated_requests(self):
        logger = StubLogger()
        requests_module = FakeRequests(
            {
                "https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE": FakeResponse(
                    text="DATE,UNRATE\n2026-01-01,4.1\n2026-02-01,4.2\n"
                )
            }
        )
        broken_openbb = type("BrokenOpenBB", (), {"economy": object()})()
        kwargs = {
            "openbb_available": True,
            "obb_module": broken_openbb,
            "jsonify_fn": lambda data: data,
            "logger": logger,
            "yf_module": BrokenTickerModule,
            "macro_indicators": [
                {
                    "symbol": "URATE",
                    "name": "Unemployment Rate",
                    "unit": "%",
                    "multiplier": 1,
                    "series_id": "UNRATE",
                }
            ],
            "requests_module": requests_module,
        }

        first_payload = reference_data_handlers.get_macro_overview_handler(**kwargs)
        fallback_warning_count_after_first = sum(
            "using FRED fallback" in warning for warning in logger.warnings
        )
        second_payload = reference_data_handlers.get_macro_overview_handler(**kwargs)
        fallback_warning_count_after_second = sum(
            "using FRED fallback" in warning for warning in logger.warnings
        )

        self.assertEqual(first_payload[0]["value"], 4.2)
        self.assertEqual(second_payload[0]["value"], 4.2)
        self.assertEqual(fallback_warning_count_after_first, 1)
        self.assertEqual(fallback_warning_count_after_second, 1)

    def test_macro_overview_returns_503_when_no_series_can_be_loaded(self):
        logger = StubLogger()
        requests_module = FakeRequests(
            {
                "https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE": FakeResponse(
                    text="DATE,UNRATE\n",
                    status_code=200,
                )
            }
        )

        payload, status_code = reference_data_handlers.get_macro_overview_handler(
            openbb_available=False,
            obb_module=None,
            jsonify_fn=lambda data: data,
            logger=logger,
            yf_module=BrokenTickerModule,
            macro_indicators=[
                {
                    "symbol": "URATE",
                    "name": "Unemployment Rate",
                    "unit": "%",
                    "multiplier": 1,
                    "series_id": "UNRATE",
                }
            ],
            requests_module=requests_module,
        )

        self.assertEqual(status_code, 503)
        self.assertEqual(payload["error"], "Macro data is temporarily unavailable.")

    def test_macro_overview_can_route_to_asia_macro_payload(self):
        logger = StubLogger()

        class FakeAkshareService:
            class AkshareUnavailableError(Exception):
                pass

            class AkshareAssetNotFoundError(Exception):
                pass

            @staticmethod
            def get_asia_macro_overview():
                return {
                    "region": "asia",
                    "title": "Asia Macro Dashboard",
                    "indicators": [{"symbol": "CN_CPI", "value": 0.7}],
                    "marketSignals": [{"symbol": "USDCNH", "value": 7.21}],
                }

        payload = reference_data_handlers.get_macro_overview_handler(
            openbb_available=False,
            obb_module=None,
            jsonify_fn=lambda data: data,
            logger=logger,
            yf_module=BrokenTickerModule,
            macro_indicators=[],
            requests_module=FakeRequests({}),
            request_obj=FakeRequest({"region": "asia"}),
            akshare_service_module=FakeAkshareService,
        )

        self.assertEqual(payload["region"], "asia")
        self.assertEqual(payload["indicators"][0]["symbol"], "CN_CPI")
        self.assertEqual(payload["marketSignals"][0]["symbol"], "USDCNH")


if __name__ == "__main__":
    unittest.main()
