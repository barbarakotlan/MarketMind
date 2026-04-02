import os
import sys
import unittest

import pandas as pd


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api_handlers_reference_data as reference_data_handlers


class StubLogger:
    def __init__(self):
        self.infos = []
        self.warnings = []
        self.errors = []

    def info(self, message):
        self.infos.append(str(message))

    def warning(self, message):
        self.warnings.append(str(message))

    def error(self, message):
        self.errors.append(str(message))


class FakeOpenBBFilingsResponse:
    def __init__(self, dataframe):
        self._dataframe = dataframe

    def to_dataframe(self):
        return self._dataframe


class FakeOpenBB:
    class Equity:
        class Fundamental:
            def __init__(self, dataframe):
                self._dataframe = dataframe

            def filings(self, sym, provider, limit):
                del sym, provider, limit
                return FakeOpenBBFilingsResponse(self._dataframe)

        def __init__(self, dataframe):
            self.fundamental = FakeOpenBB.Equity.Fundamental(dataframe)

    def __init__(self, dataframe):
        self.equity = FakeOpenBB.Equity(dataframe)


class FakeSecServiceUnavailable:
    class SecFilingsUnavailableError(Exception):
        pass

    class SecFilingNotFoundError(Exception):
        pass

    @staticmethod
    def list_company_filings(ticker, limit=30):
        del ticker, limit
        raise FakeSecServiceUnavailable.SecFilingsUnavailableError("missing edgar")

    @staticmethod
    def get_filing_detail(ticker, accession_number, section_char_limit=8000):
        del ticker, accession_number, section_char_limit
        raise FakeSecServiceUnavailable.SecFilingsUnavailableError("missing edgar")


class FakeSecServiceNotFound(FakeSecServiceUnavailable):
    @staticmethod
    def get_filing_detail(ticker, accession_number, section_char_limit=8000):
        del ticker, accession_number, section_char_limit
        raise FakeSecServiceNotFound.SecFilingNotFoundError("not found")


class FakeSecServiceSuccess(FakeSecServiceUnavailable):
    @staticmethod
    def list_company_filings(ticker, limit=30):
        del ticker, limit
        return [
            {
                "date": "2026-01-31",
                "type": "10-K",
                "description": "Annual report",
                "url": "https://sec.gov/example",
                "accessionNumber": "0000320193-26-000123",
                "hasKeySections": True,
                "isAnnualOrQuarterly": True,
            }
        ]

    @staticmethod
    def get_filing_detail(ticker, accession_number, section_char_limit=8000):
        del ticker, accession_number, section_char_limit
        return {
            "date": "2026-01-31",
            "type": "10-K",
            "description": "Annual report",
            "url": "https://sec.gov/example",
            "accessionNumber": "0000320193-26-000123",
            "hasKeySections": True,
            "sections": [
                {
                    "key": "riskFactors",
                    "title": "Risk Factors",
                    "text": "Risk excerpt",
                    "truncated": False,
                }
            ],
        }

    @staticmethod
    def get_company_sec_intelligence(ticker):
        del ticker
        return {
            "ticker": "AAPL",
            "latestAnnualOrQuarterly": {
                "type": "10-K",
                "date": "2026-01-31",
                "url": "https://sec.gov/example",
                "sections": [{"key": "riskFactors", "title": "Risk Factors", "text": "Risk excerpt", "truncated": False}],
            },
            "filingChangeSummary": {
                "comparisonForm": "10-K",
                "sectionChanges": [{"key": "riskFactors", "title": "Risk Factors", "status": "material"}],
            },
            "insiderActivity": [{"insiderName": "Tim Cook", "type": "4", "activity": "Purchase"}],
            "beneficialOwnership": [{"owners": ["Berkshire Hathaway Inc."], "type": "SC 13D", "ownershipPercent": 6.8}],
        }


class SecFilingsHandlerTests(unittest.TestCase):
    def test_get_sec_filings_handler_falls_back_to_openbb_when_edgar_is_unavailable(self):
        logger = StubLogger()
        dataframe = pd.DataFrame(
            [
                {
                    "report_type": "10-K",
                    "date": "2026-01-31",
                    "description": "Annual report",
                    "url": "https://sec.gov/openbb-10k",
                },
                {
                    "report_type": "4",
                    "date": "2026-01-30",
                    "description": "Ignore insider form",
                    "url": "https://sec.gov/openbb-4",
                },
            ]
        )

        payload = reference_data_handlers.get_sec_filings_handler(
            "AAPL",
            openbb_available=True,
            obb_module=FakeOpenBB(dataframe),
            sec_filings_service_module=FakeSecServiceUnavailable,
            jsonify_fn=lambda data: data,
            logger=logger,
        )

        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["type"], "10-K")
        self.assertEqual(payload[0]["url"], "https://sec.gov/openbb-10k")
        self.assertIn("EdgarTools unavailable", logger.infos[0])

    def test_get_sec_filings_handler_uses_edgar_when_available(self):
        logger = StubLogger()

        payload = reference_data_handlers.get_sec_filings_handler(
            "AAPL",
            openbb_available=True,
            obb_module=FakeOpenBB(pd.DataFrame([])),
            sec_filings_service_module=FakeSecServiceSuccess,
            jsonify_fn=lambda data: data,
            logger=logger,
        )

        self.assertEqual(payload[0]["accessionNumber"], "0000320193-26-000123")
        self.assertEqual(logger.infos, [])

    def test_get_sec_filings_handler_returns_503_when_no_provider_is_available(self):
        logger = StubLogger()

        payload, status_code = reference_data_handlers.get_sec_filings_handler(
            "AAPL",
            openbb_available=False,
            obb_module=None,
            sec_filings_service_module=FakeSecServiceUnavailable,
            jsonify_fn=lambda data: data,
            logger=logger,
        )

        self.assertEqual(status_code, 503)
        self.assertEqual(payload["error"], "SEC filings are temporarily unavailable.")

    def test_get_sec_filing_detail_handler_returns_503_when_edgar_is_unavailable(self):
        logger = StubLogger()

        payload, status_code = reference_data_handlers.get_sec_filing_detail_handler(
            "AAPL",
            "0000320193-26-000123",
            sec_filings_service_module=FakeSecServiceUnavailable,
            jsonify_fn=lambda data: data,
            logger=logger,
        )

        self.assertEqual(status_code, 503)
        self.assertIn("missing edgar", payload["error"])

    def test_get_sec_filing_detail_handler_returns_404_when_accession_is_unknown(self):
        logger = StubLogger()

        payload, status_code = reference_data_handlers.get_sec_filing_detail_handler(
            "AAPL",
            "missing-accession",
            sec_filings_service_module=FakeSecServiceNotFound,
            jsonify_fn=lambda data: data,
            logger=logger,
        )

        self.assertEqual(status_code, 404)
        self.assertEqual(payload["error"], "not found")

    def test_get_sec_intelligence_handler_returns_combined_sec_payload(self):
        logger = StubLogger()

        payload = reference_data_handlers.get_sec_intelligence_handler(
            "AAPL",
            sec_filings_service_module=FakeSecServiceSuccess,
            jsonify_fn=lambda data: data,
            logger=logger,
        )

        self.assertEqual(payload["ticker"], "AAPL")
        self.assertEqual(payload["filingChangeSummary"]["comparisonForm"], "10-K")
        self.assertEqual(payload["insiderActivity"][0]["insiderName"], "Tim Cook")
        self.assertEqual(payload["beneficialOwnership"][0]["ownershipPercent"], 6.8)


if __name__ == "__main__":
    unittest.main()
