import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import research_document_builder as builder


class ResearchDocumentBuilderTests(unittest.TestCase):
    def test_chunk_text_respects_target_and_overlap(self):
        long_text = "\n\n".join(
            f"Paragraph {index} " + ("alpha beta gamma " * 40)
            for index in range(1, 6)
        )
        chunks = builder._chunk_text(long_text)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk) <= builder.MAX_CHUNK_CHARS for chunk in chunks))
        self.assertTrue(any(chunks[index][-40:] in chunks[index + 1] for index in range(len(chunks) - 1)))

    def test_build_global_documents_for_us_context_includes_sec_and_news(self):
        context = {
            "ticker": "AAPL",
            "assetId": "AAPL",
            "market": "US",
            "assetType": "equity",
            "recentNews": [
                {
                    "title": "Apple news headline",
                    "publisher": "ExampleWire",
                    "link": "https://example.com/aapl-news",
                    "publishedAt": "2026-04-02",
                }
            ],
            "secFilingsSummary": {
                "accessionNumber": "0000320193-26-000123",
                "type": "10-K",
                "date": "2026-01-31",
                "url": "https://sec.gov/aapl-10k",
                "sections": [
                    {
                        "key": "riskFactors",
                        "title": "Risk Factors",
                        "text": "Supply chain disruption remains a material risk.",
                    }
                ],
            },
            "filingChangeSummary": {
                "comparisonForm": "10-K",
                "currentFiling": {"accessionNumber": "0000320193-26-000123", "date": "2026-01-31", "url": "https://sec.gov/aapl-10k"},
                "sectionChanges": [
                    {
                        "key": "managementDiscussion",
                        "title": "Management Discussion",
                        "status": "material",
                        "currentExcerpt": "Demand is improving.",
                        "previousExcerpt": "Demand was mixed.",
                    }
                ],
            },
            "insiderActivitySummary": [{"insiderName": "Tim Cook", "type": "4", "activity": "Purchase", "date": "2026-03-01"}],
            "beneficialOwnershipSummary": [{"owners": ["Berkshire Hathaway"], "type": "SC 13D", "ownershipPercent": 6.8, "date": "2026-03-15"}],
        }

        documents = builder.build_global_documents(context)
        doc_types = {doc["payload"]["docType"] for doc in documents}
        self.assertIn("sec_section", doc_types)
        self.assertIn("filing_change", doc_types)
        self.assertIn("insider_activity", doc_types)
        self.assertIn("beneficial_ownership", doc_types)
        self.assertIn("news", doc_types)
        first_payload = documents[0]["payload"]
        self.assertEqual(first_payload["assetId"], "AAPL")
        self.assertIn("chunkIndex", first_payload)
        self.assertIn("chunkCount", first_payload)

    def test_build_global_documents_for_hk_context_includes_announcements_and_macro(self):
        context = {
            "ticker": "HK:00700",
            "assetId": "HK:00700",
            "market": "HK",
            "assetType": "equity",
            "assetName": "Tencent Holdings",
            "recentNews": [{"title": "Tencent headline", "publisher": "CNInfo", "publishTime": "2026-03-20"}],
            "companyResearchSummary": {
                "profile": [{"label": "Company", "value": "Tencent Holdings Limited"}],
                "announcements": [{"title": "Tencent annual results", "summary": "Results summary", "link": "https://example.com/tencent"}],
            },
        }
        with patch.object(
            builder.akshare_service,
            "get_asia_macro_overview",
            return_value={
                "indicators": [{"name": "China CPI YoY", "value": 0.7, "unit": "%", "date": "2026-03"}],
                "marketSignals": [{"name": "USD/CNH", "value": 7.21}],
            },
        ):
            documents = builder.build_global_documents(context)

        doc_types = {doc["payload"]["docType"] for doc in documents}
        self.assertIn("company_research", doc_types)
        self.assertIn("announcement", doc_types)
        self.assertIn("macro_brief", doc_types)

    def test_build_user_memo_documents_includes_sections_and_context(self):
        memo_row = SimpleNamespace(
            id="memo-1",
            version=2,
            structured_content_json={
                "executive_summary": "Apple remains durable.",
                "supporting_evidence": ["Services remain sticky.", "Cash generation is strong."],
            },
            context_snapshot_json={
                "fundamentalsSummary": {"companyName": "Apple Inc.", "sector": "Technology"},
                "predictionSnapshot": {"recentPredicted": 190.0, "recentClose": 180.0},
                "retrievedEvidence": [{"title": "Risk Factors", "snippet": "Supply chain risk remains material."}],
            },
        )
        documents = builder.build_user_memo_documents(
            clerk_user_id="user_a",
            ticker="AAPL",
            asset_id="AAPL",
            market="US",
            asset_type="equity",
            memo_rows=[memo_row],
        )
        doc_types = {doc["payload"]["docType"] for doc in documents}
        self.assertIn("memo_section", doc_types)
        self.assertIn("memo_context", doc_types)
        self.assertTrue(any(doc["payload"]["clerkUserId"] == "user_a" for doc in documents))


if __name__ == "__main__":
    unittest.main()
