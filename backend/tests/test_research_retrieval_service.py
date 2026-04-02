import os
import sys
import tempfile
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
import research_retrieval_service as retrieval_service
from user_state_store import reset_runtime_state


class ResearchRetrievalServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp_root = self.tmpdir.name
        self.state_db_path = os.path.join(self.tmp_root, "user_state.db")

        self.original_state = {
            "BASE_DIR": backend_api.BASE_DIR,
            "DATABASE": backend_api.DATABASE,
            "DATABASE_URL": backend_api.DATABASE_URL,
            "PERSISTENCE_MODE": backend_api.PERSISTENCE_MODE,
            "USER_DATA_DIR": backend_api.USER_DATA_DIR,
            "PORTFOLIO_FILE": backend_api.PORTFOLIO_FILE,
            "NOTIFICATIONS_FILE": backend_api.NOTIFICATIONS_FILE,
            "PREDICTION_PORTFOLIO_FILE": backend_api.PREDICTION_PORTFOLIO_FILE,
            "ALLOW_LEGACY_USER_DATA_SEED": backend_api.ALLOW_LEGACY_USER_DATA_SEED,
            "RESEARCH_RETRIEVAL_ENABLED": os.environ.get("RESEARCH_RETRIEVAL_ENABLED"),
            "QDRANT_URL": os.environ.get("QDRANT_URL"),
        }

        reset_runtime_state()
        retrieval_service.reset_runtime_state()
        backend_api.BASE_DIR = self.tmp_root
        backend_api.DATABASE = os.path.join(self.tmp_root, "marketmind_test.db")
        backend_api.DATABASE_URL = f"sqlite:///{self.state_db_path}"
        backend_api.PERSISTENCE_MODE = "postgres"
        backend_api.USER_DATA_DIR = os.path.join(self.tmp_root, "user_data")
        backend_api.PORTFOLIO_FILE = os.path.join(self.tmp_root, "paper_portfolio.json")
        backend_api.NOTIFICATIONS_FILE = os.path.join(self.tmp_root, "notifications.json")
        backend_api.PREDICTION_PORTFOLIO_FILE = os.path.join(self.tmp_root, "prediction_portfolio.json")
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = False
        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api.init_db()
        os.environ["RESEARCH_RETRIEVAL_ENABLED"] = "true"
        os.environ["QDRANT_URL"] = ":memory:"

    def tearDown(self):
        backend_api.BASE_DIR = self.original_state["BASE_DIR"]
        backend_api.DATABASE = self.original_state["DATABASE"]
        backend_api.DATABASE_URL = self.original_state["DATABASE_URL"]
        backend_api.PERSISTENCE_MODE = self.original_state["PERSISTENCE_MODE"]
        backend_api.USER_DATA_DIR = self.original_state["USER_DATA_DIR"]
        backend_api.PORTFOLIO_FILE = self.original_state["PORTFOLIO_FILE"]
        backend_api.NOTIFICATIONS_FILE = self.original_state["NOTIFICATIONS_FILE"]
        backend_api.PREDICTION_PORTFOLIO_FILE = self.original_state["PREDICTION_PORTFOLIO_FILE"]
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = self.original_state["ALLOW_LEGACY_USER_DATA_SEED"]
        if self.original_state["RESEARCH_RETRIEVAL_ENABLED"] is None:
            os.environ.pop("RESEARCH_RETRIEVAL_ENABLED", None)
        else:
            os.environ["RESEARCH_RETRIEVAL_ENABLED"] = self.original_state["RESEARCH_RETRIEVAL_ENABLED"]
        if self.original_state["QDRANT_URL"] is None:
            os.environ.pop("QDRANT_URL", None)
        else:
            os.environ["QDRANT_URL"] = self.original_state["QDRANT_URL"]
        retrieval_service.reset_runtime_state()
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _context(self, ticker="AAPL", market="US"):
        context = {
            "ticker": ticker,
            "assetId": ticker if market == "US" else f"{market}:{ticker}",
            "market": market,
            "assetType": "equity",
            "recentNews": [{"title": f"{ticker} headline", "publisher": "ExampleWire", "publishedAt": "2026-04-02"}],
            "fundamentalsSummary": {"companyName": f"{ticker} Corp", "sector": "Technology"},
        }
        if market == "US":
            context.update(
                {
                    "secFilingsSummary": {
                        "accessionNumber": "0000000000-26-000001",
                        "type": "10-K",
                        "date": "2026-01-31",
                        "url": "https://sec.gov/example",
                        "sections": [{"key": "riskFactors", "title": "Risk Factors", "text": "Demand could soften."}],
                    },
                    "filingChangeSummary": {
                        "comparisonForm": "10-K",
                        "currentFiling": {"accessionNumber": "0000000000-26-000001", "date": "2026-01-31"},
                        "sectionChanges": [{"key": "managementDiscussion", "title": "Management Discussion", "status": "material", "currentExcerpt": "Growth improved."}],
                    },
                    "insiderActivitySummary": [{"insiderName": "CEO", "type": "4", "activity": "Purchase"}],
                    "beneficialOwnershipSummary": [{"owners": ["Holder"], "type": "SC 13D", "ownershipPercent": 6.8}],
                }
            )
        else:
            context.update(
                {
                    "assetName": "Tencent Holdings",
                    "companyResearchSummary": {
                        "profile": [{"label": "Company", "value": "Tencent Holdings Limited"}],
                        "announcements": [{"title": "Tencent annual results", "summary": "Strong results", "link": "https://example.com/tencent"}],
                    },
                }
            )
        return context

    def test_retrieve_for_context_returns_dense_candidates_and_reranks_us_equities(self):
        with patch.object(retrieval_service.research_embedding_service, "get_runtime_status", return_value={"available": True}), patch.object(
            retrieval_service.research_vector_store,
            "get_runtime_status",
            return_value={"available": True},
        ), patch.object(
            retrieval_service.research_embedding_service,
            "encode_documents",
            return_value=[[0.1, 0.2], [0.2, 0.3], [0.3, 0.4]],
        ), patch.object(
            retrieval_service.research_embedding_service,
            "encode_query",
            return_value=[0.1, 0.2],
        ), patch.object(
            retrieval_service.research_vector_store,
            "upsert_documents",
            side_effect=lambda scope, documents, vector_size: len(list(documents)),
        ), patch.object(
            retrieval_service.research_vector_store,
            "count_documents",
            return_value=3,
        ), patch.object(
            retrieval_service.research_vector_store,
            "query_documents",
            side_effect=[
                [
                    {
                        "id": "global-1",
                        "score": 0.62,
                        "payload": {
                            "docType": "news",
                            "title": "AAPL headline",
                            "snippet": "Headline snippet",
                            "text": "Headline snippet",
                            "source": "news",
                            "sourceUrl": "https://example.com/news",
                            "assetId": "AAPL",
                            "ticker": "AAPL",
                            "market": "US",
                            "language": "en",
                        },
                    }
                ],
                [
                    {
                        "id": "user-1",
                        "score": 0.51,
                        "payload": {
                            "docType": "memo_section",
                            "title": "Memo v1 executive summary",
                            "snippet": "Memo snippet",
                            "text": "Memo snippet",
                            "source": "memo",
                            "assetId": "AAPL",
                            "ticker": "AAPL",
                            "market": "US",
                            "language": "en",
                        },
                    }
                ],
            ],
        ), patch.object(
            retrieval_service.research_embedding_service,
            "rerank_documents",
            side_effect=lambda query, documents, allow_rerank=True: [
                {**documents[1], "rerankScore": 0.93},
                {**documents[0], "rerankScore": 0.72},
            ],
        ):
            with backend_api.user_state_session_scope(backend_api.DATABASE_URL) as session:
                payload = retrieval_service.retrieve_for_context(
                    session,
                    "user_a",
                    query_text="What are the main risks for Apple?",
                    context=self._context(),
                )

        self.assertTrue(payload["retrievalStatus"]["used"])
        self.assertTrue(payload["retrievalStatus"]["rerankUsed"])
        self.assertEqual(len(payload["retrievedEvidence"]), 2)
        self.assertEqual(payload["retrievedEvidence"][0]["docType"], "memo_section")

    def test_retrieve_for_context_skips_rerank_for_hk_assets(self):
        with patch.object(retrieval_service.research_embedding_service, "get_runtime_status", return_value={"available": True}), patch.object(
            retrieval_service.research_vector_store,
            "get_runtime_status",
            return_value={"available": True},
        ), patch.object(
            retrieval_service.research_embedding_service,
            "encode_documents",
            return_value=[[0.1, 0.2], [0.2, 0.3]],
        ), patch.object(
            retrieval_service.research_embedding_service,
            "encode_query",
            return_value=[0.1, 0.2],
        ), patch.object(
            retrieval_service.research_vector_store,
            "upsert_documents",
            side_effect=lambda scope, documents, vector_size: len(list(documents)),
        ), patch.object(
            retrieval_service.research_vector_store,
            "count_documents",
            return_value=2,
        ), patch.object(
            retrieval_service.research_vector_store,
            "query_documents",
            side_effect=[
                [
                    {
                        "id": "global-1",
                        "score": 0.62,
                        "payload": {
                            "docType": "announcement",
                            "title": "Tencent annual results",
                            "snippet": "Results summary",
                            "text": "Results summary",
                            "source": "akshare",
                            "sourceUrl": "https://example.com/tencent",
                            "assetId": "HK:00700",
                            "ticker": "HK:00700",
                            "market": "HK",
                            "language": "zh",
                        },
                    }
                ],
                [],
            ],
        ), patch.object(
            retrieval_service.research_embedding_service,
            "rerank_documents",
            side_effect=AssertionError("HK retrieval should not rerank"),
        ):
            with backend_api.user_state_session_scope(backend_api.DATABASE_URL) as session:
                payload = retrieval_service.retrieve_for_context(
                    session,
                    "user_a",
                    query_text="What matters most for Tencent?",
                    context=self._context(ticker="00700", market="HK"),
                )

        self.assertTrue(payload["retrievalStatus"]["used"])
        self.assertFalse(payload["retrievalStatus"].get("rerankUsed"))
        self.assertEqual(payload["retrievedEvidence"][0]["docType"], "announcement")

    def test_retrieve_for_compare_groups_results_by_ticker(self):
        with patch.object(
            retrieval_service,
            "_retrieve_candidates_for_context",
            side_effect=[
                {"evidence": [{"docType": "sec_section", "ticker": "MSFT", "title": "MSFT filing", "snippet": "MSFT snippet", "source": "sec", "assetId": "MSFT", "rank": 1}], "status": {"available": True, "used": True}},
                {"evidence": [{"docType": "sec_section", "ticker": "GOOGL", "title": "GOOGL filing", "snippet": "GOOGL snippet", "source": "sec", "assetId": "GOOGL", "rank": 1}], "status": {"available": True, "used": True}},
            ],
        ):
            with backend_api.user_state_session_scope(backend_api.DATABASE_URL) as session:
                payload = retrieval_service.retrieve_for_compare(
                    session,
                    "user_a",
                    query_text="Compare Microsoft versus Google on the latest evidence.",
                    contexts=[self._context(ticker="MSFT"), self._context(ticker="GOOGL")],
                )

        self.assertEqual([item["ticker"] for item in payload["retrievedEvidence"]], ["GOOGL", "MSFT"])
        self.assertTrue(payload["retrievalStatus"]["compare"])
        self.assertEqual(len(payload["retrievalStatus"]["groups"]), 2)

    def test_retrieval_disabled_falls_back_cleanly(self):
        os.environ["RESEARCH_RETRIEVAL_ENABLED"] = "false"
        with backend_api.user_state_session_scope(backend_api.DATABASE_URL) as session:
            payload = retrieval_service.retrieve_for_context(
                session,
                "user_a",
                query_text="What are the main risks for Apple?",
                context=self._context(),
            )
        self.assertFalse(payload["retrievalStatus"]["enabled"])
        self.assertEqual(payload["retrievedEvidence"], [])


if __name__ == "__main__":
    unittest.main()
