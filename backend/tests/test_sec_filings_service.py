import os
import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import sec_filings_service


class FakeFilingsCollection(list):
    def latest(self, count):
        return list(self)[:count]


class FakeFiling:
    def __init__(
        self,
        *,
        form,
        filing_date,
        accession_number,
        description,
        url,
        filing_obj=None,
    ):
        self.form = form
        self.filing_date = filing_date
        self.accession_number = accession_number
        self.description = description
        self.url = url
        self._filing_obj = filing_obj

    def obj(self):
        return self._filing_obj


class FakeCompany:
    def __init__(self, filings_by_ticker, ticker):
        if ticker not in filings_by_ticker:
            raise RuntimeError("unknown ticker")
        self._filings = filings_by_ticker[ticker]

    def get_filings(self, form=None):
        if not form:
            return FakeFilingsCollection(self._filings)
        if isinstance(form, str):
            requested = {form}
        else:
            requested = {str(value) for value in form}
        filtered = [filing for filing in self._filings if filing.form in requested]
        return FakeFilingsCollection(filtered)


class FakeEdgarModule:
    def __init__(self, filings_by_ticker):
        self._filings_by_ticker = filings_by_ticker
        self.identity_calls = []

    def set_identity(self, identity):
        self.identity_calls.append(identity)

    def Company(self, ticker):
        return FakeCompany(self._filings_by_ticker, ticker)


class FilingObj:
    def __init__(self, *, business=None, risk_factors=None, management_discussion=None):
        self.business = business
        self.risk_factors = risk_factors
        self.management_discussion = management_discussion


class OwnershipSummary:
    def __init__(self, *, primary_activity=None, net_change=None, net_value=None, remaining_shares=None, transactions=None):
        self.primary_activity = primary_activity
        self.net_change = net_change
        self.net_value = net_value
        self.remaining_shares = remaining_shares
        self.transactions = transactions or []


class InsiderTransaction:
    def __init__(self, *, transaction_type=None, shares=None, price_per_share=None, action=None):
        self.transaction_type = transaction_type
        self.shares = shares
        self.price_per_share = price_per_share
        self.action = action


class InsiderFilingObj:
    def __init__(self):
        self.insider_name = "Tim Cook"
        self.position = "Chief Executive Officer"
        self.is_officer = True
        self.is_director = True
        self.is_ten_pct_owner = False
        self._summary = OwnershipSummary(
            primary_activity="Purchase",
            net_change=125000,
            net_value=25100000.0,
            remaining_shares=3280000,
            transactions=[
                InsiderTransaction(transaction_type="Common Stock", shares=125000, price_per_share=200.8, action="A")
            ],
        )

    def get_ownership_summary(self):
        return self._summary


class ReportingPerson:
    def __init__(self, name, percent_of_class, aggregate_amount):
        self.name = name
        self.percent_of_class = percent_of_class
        self.aggregate_amount = aggregate_amount


class OwnershipItems:
    def __init__(self, *, purpose=None):
        self.item4_purpose_of_transaction = purpose


class BeneficialOwnershipObj:
    def __init__(self):
        self.reporting_persons = [
            ReportingPerson("Berkshire Hathaway Inc.", 6.8, 915000000),
            ReportingPerson("National Indemnity Company", 6.8, 915000000),
        ]
        self.total_percent = 6.8
        self.total_shares = 915000000
        self.is_passive_investor = False
        self.items = OwnershipItems(
            purpose="The reporting persons may review strategic alternatives and capital allocation options."
        )


class EmptyOwnershipObj:
    def __init__(self):
        self.reporting_persons = [ReportingPerson("The Vanguard Group", 0.0, 0)]
        self.total_percent = 0.0
        self.total_shares = 0
        self.is_passive_investor = True
        self.items = OwnershipItems(purpose=None)


class SecFilingsServiceTests(unittest.TestCase):
    def setUp(self):
        sec_filings_service.reset_sec_filings_runtime_state()

    def tearDown(self):
        sec_filings_service.reset_sec_filings_runtime_state()

    def test_list_company_filings_requires_edgar_identity(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("EDGAR_IDENTITY", None)
            with self.assertRaises(sec_filings_service.SecFilingsUnavailableError):
                sec_filings_service.list_company_filings("AAPL")

    def test_list_company_filings_normalizes_rows_from_edgar(self):
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="10-K",
                        filing_date="2026-01-31",
                        accession_number="0000320193-26-000123",
                        description="Apple annual report",
                        url="https://sec.gov/aapl-10k",
                    ),
                    FakeFiling(
                        form="8-K",
                        filing_date="2026-02-10",
                        accession_number="0000320193-26-000124",
                        description="Apple current report",
                        url="https://sec.gov/aapl-8k",
                    ),
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            rows = sec_filings_service.list_company_filings("AAPL")

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["type"], "10-K")
        self.assertEqual(rows[0]["accessionNumber"], "0000320193-26-000123")
        self.assertTrue(rows[0]["hasKeySections"])
        self.assertTrue(rows[0]["isAnnualOrQuarterly"])
        self.assertEqual(fake_module.identity_calls, ["analyst@example.com"])

    def test_get_filing_detail_extracts_supported_sections_and_truncates(self):
        filing_obj = FilingObj(
            business="Business section " * 40,
            risk_factors="Risk factor section " * 40,
            management_discussion="MD&A section " * 40,
        )
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="10-K",
                        filing_date="2026-01-31",
                        accession_number="0000320193-26-000123",
                        description="Apple annual report",
                        url="https://sec.gov/aapl-10k",
                        filing_obj=filing_obj,
                    )
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            detail = sec_filings_service.get_filing_detail(
                "AAPL",
                "0000320193-26-000123",
                section_char_limit=80,
            )

        self.assertEqual(detail["type"], "10-K")
        self.assertTrue(detail["hasKeySections"])
        self.assertEqual([section["key"] for section in detail["sections"]], ["business", "riskFactors", "managementDiscussion"])
        self.assertTrue(all(section["truncated"] for section in detail["sections"]))
        self.assertTrue(all(len(section["text"]) <= 80 for section in detail["sections"]))

    def test_get_filing_detail_returns_metadata_only_for_unsupported_forms(self):
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="8-K",
                        filing_date="2026-02-10",
                        accession_number="0000320193-26-000124",
                        description="Apple current report",
                        url="https://sec.gov/aapl-8k",
                        filing_obj=FilingObj(business="unused"),
                    )
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            detail = sec_filings_service.get_filing_detail("AAPL", "0000320193-26-000124")

        self.assertEqual(detail["type"], "8-K")
        self.assertFalse(detail["hasKeySections"])
        self.assertEqual(detail["sections"], [])

    def test_get_latest_sec_context_returns_latest_supported_excerpt(self):
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="8-K",
                        filing_date="2026-02-10",
                        accession_number="0000320193-26-000124",
                        description="Apple current report",
                        url="https://sec.gov/aapl-8k",
                    ),
                    FakeFiling(
                        form="10-Q",
                        filing_date="2026-02-01",
                        accession_number="0000320193-26-000123",
                        description="Apple quarterly report",
                        url="https://sec.gov/aapl-10q",
                        filing_obj=FilingObj(
                            management_discussion="Quarterly discussion " * 30,
                            risk_factors="Quarterly risk factors " * 30,
                        ),
                    ),
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            summary = sec_filings_service.get_latest_sec_context("AAPL", excerpt_char_limit=60)

        self.assertIsNotNone(summary)
        self.assertEqual(summary["type"], "10-Q")
        self.assertEqual(summary["date"], "2026-02-01")
        self.assertEqual(summary["sections"][0]["key"], "managementDiscussion")
        self.assertTrue(all(len(section["text"]) <= 60 for section in summary["sections"]))

    def test_list_insider_activity_normalizes_form4_summaries(self):
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="4",
                        filing_date="2026-03-01",
                        accession_number="0000320193-26-000222",
                        description="Insider transaction report",
                        url="https://sec.gov/aapl-form4",
                        filing_obj=InsiderFilingObj(),
                    )
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            rows = sec_filings_service.list_insider_activity("AAPL", limit=3)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["insiderName"], "Tim Cook")
        self.assertEqual(rows[0]["activity"], "Purchase")
        self.assertEqual(rows[0]["netShares"], 125000)
        self.assertEqual(rows[0]["transactions"][0]["action"], "A")

    def test_list_beneficial_ownership_normalizes_schedule_13d_rows(self):
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="SCHEDULE 13G/A",
                        filing_date="2026-03-26",
                        accession_number="0000102909-26-000630",
                        description="Amended passive beneficial ownership report",
                        url="https://sec.gov/aapl-13g-empty",
                        filing_obj=EmptyOwnershipObj(),
                    ),
                    FakeFiling(
                        form="SC 13D",
                        filing_date="2026-02-20",
                        accession_number="0001193125-26-000111",
                        description="Active beneficial ownership report",
                        url="https://sec.gov/aapl-13d",
                        filing_obj=BeneficialOwnershipObj(),
                    )
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            rows = sec_filings_service.list_beneficial_ownership("AAPL", limit=3)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["owners"][0], "Berkshire Hathaway Inc.")
        self.assertEqual(rows[0]["ownershipPercent"], 6.8)
        self.assertFalse(rows[0]["isPassive"])
        self.assertIn("strategic alternatives", rows[0]["purpose"])

    def test_get_filing_change_summary_compares_latest_and_previous_report(self):
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="10-K",
                        filing_date="2026-01-31",
                        accession_number="0000320193-26-000123",
                        description="Latest annual report",
                        url="https://sec.gov/aapl-2026-10k",
                        filing_obj=FilingObj(
                            business="Core business remains stable.",
                            risk_factors="Supply chain concentration remains elevated.",
                            management_discussion="Revenue mix shifted toward services.",
                        ),
                    ),
                    FakeFiling(
                        form="10-K",
                        filing_date="2025-10-31",
                        accession_number="0000320193-25-000079",
                        description="Prior annual report",
                        url="https://sec.gov/aapl-2025-10k",
                        filing_obj=FilingObj(
                            business="Core business remains stable.",
                            risk_factors="Supply chain concentration remains manageable.",
                            management_discussion="Revenue mix remained anchored in hardware.",
                        ),
                    ),
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            summary = sec_filings_service.get_filing_change_summary("AAPL", excerpt_char_limit=90)

        self.assertIsNotNone(summary)
        self.assertEqual(summary["comparisonForm"], "10-K")
        changed_keys = {section["key"] for section in summary["sectionChanges"]}
        self.assertIn("riskFactors", changed_keys)
        self.assertIn("managementDiscussion", changed_keys)

    def test_get_company_sec_intelligence_combines_latest_filing_changes_and_ownership_signals(self):
        fake_module = FakeEdgarModule(
            {
                "AAPL": [
                    FakeFiling(
                        form="4",
                        filing_date="2026-03-01",
                        accession_number="0000320193-26-000222",
                        description="Insider transaction report",
                        url="https://sec.gov/aapl-form4",
                        filing_obj=InsiderFilingObj(),
                    ),
                    FakeFiling(
                        form="SC 13G",
                        filing_date="2026-02-15",
                        accession_number="0001193125-26-000112",
                        description="Passive beneficial ownership report",
                        url="https://sec.gov/aapl-13g",
                        filing_obj=BeneficialOwnershipObj(),
                    ),
                    FakeFiling(
                        form="10-Q",
                        filing_date="2026-01-30",
                        accession_number="0000320193-26-000006",
                        description="Quarterly report",
                        url="https://sec.gov/aapl-10q",
                        filing_obj=FilingObj(
                            management_discussion="Quarter discussion current.",
                            risk_factors="Risk factors current.",
                        ),
                    ),
                    FakeFiling(
                        form="10-Q",
                        filing_date="2025-10-30",
                        accession_number="0000320193-25-000073",
                        description="Quarterly report",
                        url="https://sec.gov/aapl-10q-prev",
                        filing_obj=FilingObj(
                            management_discussion="Quarter discussion prior.",
                            risk_factors="Risk factors prior.",
                        ),
                    ),
                ]
            }
        )

        with patch.dict(os.environ, {"EDGAR_IDENTITY": "analyst@example.com"}, clear=False), patch.object(
            sec_filings_service.importlib,
            "import_module",
            return_value=fake_module,
        ):
            intelligence = sec_filings_service.get_company_sec_intelligence("AAPL", insight_limit=3)

        self.assertEqual(intelligence["latestAnnualOrQuarterly"]["type"], "10-Q")
        self.assertTrue(intelligence["filingChangeSummary"]["sectionChanges"])
        self.assertEqual(intelligence["insiderActivity"][0]["insiderName"], "Tim Cook")
        self.assertEqual(intelligence["beneficialOwnership"][0]["ownershipPercent"], 6.8)


if __name__ == "__main__":
    unittest.main()
