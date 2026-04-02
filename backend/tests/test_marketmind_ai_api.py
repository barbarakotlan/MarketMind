import os
import sys
import tempfile
import unittest
import uuid
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
import marketmind_ai as marketmind_ai_module
import openrouter_client
from user_state_store import (
    Deliverable,
    MarketMindAiChat,
    MarketMindAiChatMessage,
    reset_runtime_state,
    utcnow,
)


class MarketMindAiApiTests(unittest.TestCase):
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
            "verify_clerk_token": backend_api.verify_clerk_token,
            "limiter_enabled": backend_api.limiter.enabled,
        }

        reset_runtime_state()
        backend_api.BASE_DIR = self.tmp_root
        backend_api.DATABASE = os.path.join(self.tmp_root, "marketmind_test.db")
        backend_api.DATABASE_URL = f"sqlite:///{self.state_db_path}"
        backend_api.PERSISTENCE_MODE = "postgres"
        backend_api.USER_DATA_DIR = os.path.join(self.tmp_root, "user_data")
        backend_api.PORTFOLIO_FILE = os.path.join(self.tmp_root, "paper_portfolio.json")
        backend_api.NOTIFICATIONS_FILE = os.path.join(self.tmp_root, "notifications.json")
        backend_api.PREDICTION_PORTFOLIO_FILE = os.path.join(self.tmp_root, "prediction_portfolio.json")
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = False
        backend_api.verify_clerk_token = lambda token: {"sub": token}
        backend_api.limiter.enabled = False

        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

        self.prediction_patch = patch.object(
            marketmind_ai_module,
            "_prediction_snapshot",
            return_value={
                "recentClose": 180.0,
                "recentPredicted": 186.5,
                "confidence": 82.0,
                "modelsUsed": ["LinReg", "RandomForest", "XGBoost"],
                "predictions": [
                    {"day": 1, "predictedClose": 186.5},
                    {"day": 2, "predictedClose": 187.2},
                ],
            },
        )
        self.news_patch = patch.object(
            marketmind_ai_module,
            "_recent_news",
            return_value=[
                {"title": "Apple launches a new hardware cycle", "publisher": "ExampleWire", "link": "https://example.com/apple-1"},
                {"title": "Services revenue remains strong", "publisher": "ExampleWire", "link": "https://example.com/apple-2"},
            ],
        )
        self.fundamentals_patch = patch.object(
            marketmind_ai_module,
            "_fundamentals_summary",
            return_value={
                "companyName": "Apple Inc.",
                "sector": "Technology",
                "industry": "Consumer Electronics",
                "targetMeanPrice": 205.0,
            },
        )
        self.sec_filings_patch = patch.object(
            marketmind_ai_module.sec_filings_service,
            "get_company_sec_intelligence",
            return_value={
                "latestAnnualOrQuarterly": {
                    "accessionNumber": "0000320193-26-000123",
                    "type": "10-K",
                    "date": "2026-01-31",
                    "url": "https://www.sec.gov/example-10k",
                    "sections": [
                        {
                            "key": "riskFactors",
                            "title": "Risk Factors",
                            "text": "Supply chain disruption remains a material risk.",
                            "truncated": False,
                        }
                    ],
                },
                "filingChangeSummary": {
                    "comparisonForm": "10-K",
                    "sectionChanges": [
                        {
                            "key": "managementDiscussion",
                            "title": "Management's Discussion",
                            "status": "material",
                        }
                    ],
                },
                "insiderActivity": [
                    {
                        "insiderName": "Tim Cook",
                        "type": "4",
                        "activity": "Purchase",
                    }
                ],
                "beneficialOwnership": [
                    {
                        "owners": ["Berkshire Hathaway Inc."],
                        "type": "SC 13D",
                        "ownershipPercent": 6.8,
                    }
                ],
            },
        )
        self.prediction_patch.start()
        self.news_patch.start()
        self.fundamentals_patch.start()
        self.sec_filings_patch.start()

        os.environ["OPENROUTER_API_KEY"] = "test-openrouter-key"

    def tearDown(self):
        self.prediction_patch.stop()
        self.news_patch.stop()
        self.fundamentals_patch.stop()
        self.sec_filings_patch.stop()

        backend_api.BASE_DIR = self.original_state["BASE_DIR"]
        backend_api.DATABASE = self.original_state["DATABASE"]
        backend_api.DATABASE_URL = self.original_state["DATABASE_URL"]
        backend_api.PERSISTENCE_MODE = self.original_state["PERSISTENCE_MODE"]
        backend_api.USER_DATA_DIR = self.original_state["USER_DATA_DIR"]
        backend_api.PORTFOLIO_FILE = self.original_state["PORTFOLIO_FILE"]
        backend_api.NOTIFICATIONS_FILE = self.original_state["NOTIFICATIONS_FILE"]
        backend_api.PREDICTION_PORTFOLIO_FILE = self.original_state["PREDICTION_PORTFOLIO_FILE"]
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = self.original_state["ALLOW_LEGACY_USER_DATA_SEED"]
        backend_api.verify_clerk_token = self.original_state["verify_clerk_token"]
        backend_api.limiter.enabled = self.original_state["limiter_enabled"]
        os.environ.pop("OPENROUTER_API_KEY", None)
        os.environ.pop("OPENROUTER_SITE_URL", None)
        os.environ.pop("OPENROUTER_APP_NAME", None)
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _auth_headers(self, user_id="user_a"):
        return {"Authorization": f"Bearer {user_id}"}

    def _seed_marketmind_context(self, user_id="user_a"):
        backend_api.save_watchlist(["AAPL"], user_id)
        backend_api.save_notifications(
            {
                "active": [
                    {
                        "id": "alert-1",
                        "ticker": "AAPL",
                        "condition": "above",
                        "target_price": 200.0,
                        "created_at": "2026-03-20T10:00:00+00:00",
                    }
                ],
                "triggered": [],
            },
            user_id,
        )
        backend_api.save_portfolio_with_snapshot(
            {
                "cash": 99500.0,
                "starting_cash": 100000.0,
                "positions": {"AAPL": {"shares": 5, "avg_cost": 100.0}},
                "options_positions": {},
                "transactions": [],
                "trade_history": [
                    {
                        "type": "BUY",
                        "ticker": "AAPL",
                        "shares": 5,
                        "price": 100.0,
                        "total": 500.0,
                        "timestamp": "2026-03-20T10:00:00+00:00",
                    }
                ],
            },
            user_id,
        )

    def test_marketmind_ai_context_supports_hk_research_and_blocks_artifact_preflight(self):
        with patch.object(
            marketmind_ai_module.akshare_service,
            "get_equity_ai_context",
            return_value={
                "assetId": "HK:00700",
                "market": "HK",
                "exchange": "HKEX",
                "assetName": "Tencent Holdings",
                "fundamentalsSummary": {
                    "companyName": "Tencent Holdings",
                    "sector": "Communication Services",
                    "industry": "Internet Content & Information",
                    "exchange": "HKEX",
                    "currency": "HKD",
                },
                "recentNews": [
                    {
                        "title": "Tencent announces annual results",
                        "publisher": "CNInfo",
                        "link": "https://example.com/tencent-results",
                        "publishTime": "2026-03-20",
                    }
                ],
                "quoteSummary": {
                    "price": 320.5,
                    "change": 4.8,
                    "changePercent": 1.52,
                },
                "companyResearch": {
                    "profile": [{"label": "Company", "value": "Tencent Holdings Limited"}],
                    "announcements": [{"title": "Tencent announces annual results"}],
                },
            },
        ):
            context_response = self.client.get(
                "/marketmind-ai/context?ticker=00700&market=hk",
                headers=self._auth_headers(),
            )
            self.assertEqual(context_response.status_code, 200)
            context_payload = context_response.get_json()
            self.assertEqual(context_payload["assetId"], "HK:00700")
            self.assertEqual(context_payload["market"], "HK")
            self.assertEqual(context_payload["fundamentalsSummary"]["companyName"], "Tencent Holdings")
            self.assertEqual(context_payload["recentNews"][0]["title"], "Tencent announces annual results")
            self.assertEqual(context_payload["marketSession"]["calendarCode"], "XHKG")
            self.assertEqual(context_payload["marketSession"]["market"], "HK")
            self.assertNotIn("secFilingsSummary", context_payload)

            preflight_response = self.client.post(
                "/marketmind-ai/artifacts/preflight",
                headers=self._auth_headers(),
                json={
                    "templateKey": "investment_thesis_memo",
                    "attachedTicker": "HK:00700",
                    "messages": [{"role": "user", "content": "Write me a memo on HK:00700."}],
                },
            )
            self.assertEqual(preflight_response.status_code, 200)
            preflight_payload = preflight_response.get_json()
            self.assertEqual(preflight_payload["status"], "blocked")
            self.assertTrue(
                any(
                    "read-only AI research" in item["message"]
                    for item in preflight_payload["requiredItems"]
                )
            )

    def test_marketmind_ai_chat_context_artifact_generation_and_download(self):
        self._seed_marketmind_context()

        bootstrap_response = self.client.get("/marketmind-ai/bootstrap", headers=self._auth_headers())
        self.assertEqual(bootstrap_response.status_code, 200)
        self.assertTrue(bootstrap_response.get_json()["starterPrompts"])

        context_response = self.client.get("/marketmind-ai/context?ticker=AAPL", headers=self._auth_headers())
        self.assertEqual(context_response.status_code, 200)
        context_payload = context_response.get_json()
        self.assertTrue(context_payload["watchlistMembership"])
        self.assertEqual(context_payload["fundamentalsSummary"]["companyName"], "Apple Inc.")
        self.assertEqual(context_payload["marketSession"]["calendarCode"], "XNYS")
        self.assertEqual(context_payload["marketSession"]["market"], "US")
        self.assertEqual(context_payload["secFilingsSummary"]["type"], "10-K")
        self.assertEqual(context_payload["secFilingsSummary"]["sections"][0]["key"], "riskFactors")
        self.assertEqual(context_payload["filingChangeSummary"]["comparisonForm"], "10-K")
        self.assertEqual(context_payload["insiderActivitySummary"][0]["insiderName"], "Tim Cook")
        self.assertEqual(context_payload["beneficialOwnershipSummary"][0]["ownershipPercent"], 6.8)

        with patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "Apple looks constructive, but watch demand risk."},
        ):
            chat_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "What are the biggest risks for Apple right now?"}],
                    "attachedTicker": "AAPL",
                },
            )
        self.assertEqual(chat_response.status_code, 200)
        chat_payload = chat_response.get_json()
        self.assertIn("Apple looks constructive", chat_payload["assistantMessage"]["content"])
        chat_id = chat_payload["chat"]["id"]
        self.assertEqual(chat_payload["tickerResolution"]["resolvedTicker"], "AAPL")
        self.assertEqual(chat_payload["tickerResolution"]["status"], "kept")

        chat_list_response = self.client.get("/marketmind-ai/chats", headers=self._auth_headers())
        self.assertEqual(chat_list_response.status_code, 200)
        self.assertEqual(len(chat_list_response.get_json()), 1)
        self.assertEqual(chat_list_response.get_json()[0]["id"], chat_id)

        chat_detail_response = self.client.get(f"/marketmind-ai/chats/{chat_id}", headers=self._auth_headers())
        self.assertEqual(chat_detail_response.status_code, 200)
        self.assertEqual(len(chat_detail_response.get_json()["messages"]), 2)
        self.assertEqual(chat_detail_response.get_json()["messages"][0]["role"], "user")

        blocked_preflight = self.client.post(
            "/marketmind-ai/artifacts/preflight",
            headers=self._auth_headers(),
            json={"templateKey": "investment_thesis_memo", "messages": [{"role": "user", "content": "help"}]},
        )
        self.assertEqual(blocked_preflight.status_code, 200)
        self.assertEqual(blocked_preflight.get_json()["status"], "blocked")

        ready_preflight = self.client.post(
            "/marketmind-ai/artifacts/preflight",
            headers=self._auth_headers(),
            json={
                "templateKey": "investment_thesis_memo",
                "messages": [{"role": "user", "content": "Write a balanced memo for Apple using the current MarketMind context."}],
                "attachedTicker": "AAPL",
            },
        )
        self.assertEqual(ready_preflight.status_code, 200)
        self.assertEqual(ready_preflight.get_json()["status"], "ready")

        structured_content_v1 = {
            "executive_summary": "Apple remains a high-quality compounder with near-term catalyst support.",
            "investment_thesis": "The thesis rests on resilient demand and services strength.",
            "supporting_evidence": ["Services revenue is durable.", "The installed base supports recurring monetization."],
            "key_assumptions": ["Upgrade cycle remains healthy."],
            "risks": ["Consumer demand weakens."],
            "invalidation_conditions": ["Two weak iPhone cycles in a row."],
            "catalysts": ["WWDC", "Quarterly earnings"],
            "signals_and_market_context": ["Prediction snapshot remains constructive."],
            "linked_positioning": "Current paper portfolio already holds 5 shares.",
            "what_would_change_my_mind": "Unexpected revenue deterioration and weak guidance.",
            "conclusion": "The stock merits ongoing monitoring with a bullish bias.",
        }

        with patch.object(
            marketmind_ai_module,
            "create_structured_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "structured_content": structured_content_v1},
        ), patch.object(
            marketmind_ai_module,
            "_render_docx",
            return_value=b"docx-version-1",
        ):
            artifact_response = self.client.post(
                "/marketmind-ai/artifacts",
                headers=self._auth_headers(),
                json={
                    "templateKey": "investment_thesis_memo",
                    "messages": [{"role": "user", "content": "Write a balanced memo for Apple using the current MarketMind context."}],
                    "attachedTicker": "AAPL",
                    "chatId": chat_id,
                },
            )
        self.assertEqual(artifact_response.status_code, 201)
        artifact_payload = artifact_response.get_json()
        artifact_id = artifact_payload["artifact"]["id"]
        version_id = artifact_payload["version"]["id"]
        self.assertEqual(artifact_payload["version"]["version"], 1)

        with patch.object(
            marketmind_ai_module,
            "create_structured_completion",
            return_value={
                "model": "nvidia/nemotron-3-super-120b-a12b:free",
                "structured_content": {**structured_content_v1, "executive_summary": "Updated memo version"},
            },
        ), patch.object(
            marketmind_ai_module,
            "_render_docx",
            return_value=b"docx-version-2",
        ):
            second_artifact_response = self.client.post(
                "/marketmind-ai/artifacts",
                headers=self._auth_headers(),
                json={
                    "templateKey": "investment_thesis_memo",
                    "messages": [{"role": "user", "content": "Revise the memo with a slightly stronger catalyst view."}],
                    "attachedTicker": "AAPL",
                    "chatId": chat_id,
                    "artifactId": artifact_id,
                },
            )
        self.assertEqual(second_artifact_response.status_code, 201)
        self.assertEqual(second_artifact_response.get_json()["version"]["version"], 2)

        artifact_detail_response = self.client.get(
            f"/marketmind-ai/artifacts/{artifact_id}",
            headers=self._auth_headers(),
        )
        self.assertEqual(artifact_detail_response.status_code, 200)
        versions = artifact_detail_response.get_json()["versions"]
        self.assertEqual([item["version"] for item in versions], [2, 1])

        updated_chat_detail_response = self.client.get(
            f"/marketmind-ai/chats/{chat_id}",
            headers=self._auth_headers(),
        )
        self.assertEqual(updated_chat_detail_response.status_code, 200)
        self.assertEqual(updated_chat_detail_response.get_json()["chat"]["latestArtifactId"], artifact_id)

        download_response = self.client.get(
            f"/marketmind-ai/artifacts/{artifact_id}/versions/{version_id}/download",
            headers=self._auth_headers(),
        )
        self.assertEqual(download_response.status_code, 200)
        self.assertEqual(download_response.data, b"docx-version-1")

        self.assertEqual(
            self.client.get(f"/marketmind-ai/artifacts/{artifact_id}", headers=self._auth_headers("user_b")).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                f"/marketmind-ai/artifacts/{artifact_id}/versions/{version_id}/download",
                headers=self._auth_headers("user_b"),
            ).status_code,
            404,
        )

    def test_marketmind_ai_surfaces_retrieved_evidence_and_retrieval_status(self):
        self._seed_marketmind_context()
        retrieved_evidence = [
            {
                "docType": "sec_section",
                "title": "10-K · Risk Factors",
                "snippet": "Supply chain disruption remains a material risk.",
                "source": "sec",
                "sourceUrl": "https://www.sec.gov/example-10k",
                "assetId": "AAPL",
                "ticker": "AAPL",
                "score": 0.91,
                "rank": 1,
            }
        ]
        retrieval_status = {
            "enabled": True,
            "available": True,
            "used": True,
            "candidateCount": 3,
            "rerankUsed": True,
        }

        with patch.object(
            marketmind_ai_module.research_retrieval_service,
            "retrieve_for_context",
            return_value={
                "retrievedEvidence": retrieved_evidence,
                "retrievalStatus": retrieval_status,
            },
        ), patch.object(
            marketmind_ai_module.research_retrieval_service,
            "index_memo_version",
            return_value={"enabled": True, "available": True, "used": True},
        ), patch.object(
            marketmind_ai_module.research_retrieval_service,
            "get_status_for_context",
            return_value={
                "enabled": True,
                "available": True,
                "assetId": "AAPL",
                "ticker": "AAPL",
                "globalSync": {"docCount": 4},
                "userSync": {"docCount": 1},
            },
        ), patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "Here is the grounded answer with evidence."},
        ), patch.object(
            marketmind_ai_module,
            "create_structured_completion",
            return_value={
                "model": "nvidia/nemotron-3-super-120b-a12b:free",
                "structured_content": {
                    "executive_summary": "Generated memo preview",
                    "investment_thesis": "The thesis is grounded in retrieved evidence.",
                    "supporting_evidence": ["Supply chain disruption remains a material risk."],
                    "key_assumptions": [],
                    "risks": [],
                    "invalidation_conditions": [],
                    "catalysts": [],
                    "signals_and_market_context": [],
                    "linked_positioning": "Current paper portfolio already holds 5 shares.",
                    "what_would_change_my_mind": "A sharp demand reset.",
                    "conclusion": "Monitor closely.",
                },
            },
        ), patch.object(
            marketmind_ai_module,
            "_render_docx",
            return_value=b"docx-bytes",
        ):
            retrieval_status_response = self.client.get(
                "/marketmind-ai/retrieval-status?ticker=AAPL",
                headers=self._auth_headers(),
            )
            self.assertEqual(retrieval_status_response.status_code, 200)
            self.assertEqual(retrieval_status_response.get_json()["assetId"], "AAPL")

            chat_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "What is the strongest evidence for Apple right now?"}],
                    "attachedTicker": "AAPL",
                },
            )
            self.assertEqual(chat_response.status_code, 200)
            chat_payload = chat_response.get_json()
            self.assertEqual(chat_payload["retrievedEvidence"][0]["docType"], "sec_section")
            self.assertTrue(chat_payload["retrievalStatus"]["rerankUsed"])

            artifact_response = self.client.post(
                "/marketmind-ai/artifacts",
                headers=self._auth_headers(),
                json={
                    "templateKey": "investment_thesis_memo",
                    "messages": [{"role": "user", "content": "Write a balanced memo for Apple using the current MarketMind context."}],
                    "attachedTicker": "AAPL",
                },
            )
            self.assertEqual(artifact_response.status_code, 201)
            artifact_payload = artifact_response.get_json()
            self.assertEqual(artifact_payload["version"]["retrievedEvidence"][0]["title"], "10-K · Risk Factors")
            self.assertTrue(artifact_payload["version"]["retrievalStatus"]["used"])

            artifact_detail_response = self.client.get(
                f"/marketmind-ai/artifacts/{artifact_payload['artifact']['id']}",
                headers=self._auth_headers(),
            )
            self.assertEqual(artifact_detail_response.status_code, 200)
            detail_payload = artifact_detail_response.get_json()
            self.assertEqual(detail_payload["versions"][0]["retrievedEvidence"][0]["source"], "sec")

    def test_marketmind_ai_recognizes_bitcoin_and_builds_crypto_context(self):
        crypto_quote = {
            "from_crypto": {"code": "BTC", "name": "Bitcoin"},
            "to_currency": {"code": "USD", "name": "United States Dollar"},
            "exchange_rate": 84250.12,
            "bid_price": 84200.0,
            "ask_price": 84275.0,
            "last_refreshed": "2026-03-22T15:30:00Z",
            "timezone": "UTC",
        }

        with patch.object(
            marketmind_ai_module,
            "_prediction_snapshot",
            return_value={
                "recentClose": 83880.0,
                "recentPredicted": 84610.0,
                "confidence": 74.2,
                "modelsUsed": ["LinReg", "RandomForest", "XGBoost"],
                "predictions": [{"day": 1, "predictedClose": 84610.0}],
            },
        ), patch.object(
            marketmind_ai_module,
            "_recent_news",
            return_value=[
                {"title": "Bitcoin ETF flows stay positive", "publisher": "ExampleWire", "link": "https://example.com/btc-1"}
            ],
        ), patch.object(
            marketmind_ai_module,
            "_fundamentals_summary",
            return_value={},
        ), patch.object(
            marketmind_ai_module,
            "get_crypto_exchange_rate",
            return_value=crypto_quote,
        ):
            context_response = self.client.get("/marketmind-ai/context?ticker=bitcoin", headers=self._auth_headers())

        self.assertEqual(context_response.status_code, 200)
        context_payload = context_response.get_json()
        self.assertEqual(context_payload["ticker"], "BTC-USD")
        self.assertEqual(context_payload["assetType"], "crypto")
        self.assertEqual(context_payload["fundamentalsSummary"]["companyName"], "Bitcoin")
        self.assertEqual(context_payload["fundamentalsSummary"]["sector"], "Cryptocurrency")
        self.assertEqual(context_payload["cryptoQuote"]["fromCrypto"]["code"], "BTC")
        self.assertNotIn("secFilingsSummary", context_payload)

        with patch.object(
            marketmind_ai_module,
            "_prediction_snapshot",
            return_value={
                "recentClose": 83880.0,
                "recentPredicted": 84610.0,
                "confidence": 74.2,
                "modelsUsed": ["LinReg", "RandomForest", "XGBoost"],
                "predictions": [{"day": 1, "predictedClose": 84610.0}],
            },
        ), patch.object(
            marketmind_ai_module,
            "_recent_news",
            return_value=[
                {"title": "Bitcoin ETF flows stay positive", "publisher": "ExampleWire", "link": "https://example.com/btc-1"}
            ],
        ), patch.object(
            marketmind_ai_module,
            "_fundamentals_summary",
            return_value={},
        ), patch.object(
            marketmind_ai_module,
            "get_crypto_exchange_rate",
            return_value=crypto_quote,
        ), patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "Bitcoin looks constructive but still high-volatility."},
        ):
            chat_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "Tell me about bitcoin and if it's a buy/sell/hold"}],
                },
            )

        self.assertEqual(chat_response.status_code, 200)
        chat_payload = chat_response.get_json()
        self.assertEqual(chat_payload["tickerResolution"]["resolvedTicker"], "BTC-USD")
        self.assertEqual(chat_payload["chat"]["attachedTicker"], "BTC-USD")
        self.assertEqual(chat_payload["contextSummary"]["ticker"], "BTC-USD")
        self.assertEqual(chat_payload["contextSummary"]["assetType"], "crypto")
        self.assertEqual(chat_payload["contextSummary"]["companyName"], "Bitcoin")
        self.assertIn("Bitcoin looks constructive", chat_payload["assistantMessage"]["content"])

    def test_marketmind_ai_replaces_solana_context_denial_with_grounded_fallback(self):
        with patch.object(
            marketmind_ai_module,
            "_prediction_snapshot",
            return_value={},
        ), patch.object(
            marketmind_ai_module,
            "_recent_news",
            return_value=[
                {"title": "Solana ecosystem activity stays elevated", "publisher": "ExampleWire", "link": "https://example.com/sol-1"}
            ],
        ), patch.object(
            marketmind_ai_module,
            "_fundamentals_summary",
            return_value={},
        ), patch.object(
            marketmind_ai_module,
            "get_crypto_exchange_rate",
            return_value={
                "from_crypto": {"code": "SOL", "name": "Solana"},
                "to_currency": {"code": "USD", "name": "United States Dollar"},
                "exchange_rate": 182.45,
                "bid_price": 182.3,
                "ask_price": 182.6,
                "last_refreshed": "2026-03-22T15:30:00Z",
                "timezone": "UTC",
            },
        ), patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            side_effect=[
                {
                    "model": "nvidia/nemotron-3-super-120b-a12b:free",
                    "assistant_text": "I don't have access to any specific ticker context for SOL (Solana) in your current MarketMind session, as no ticker is attached to this conversation.",
                },
                {
                    "model": "nvidia/nemotron-3-super-120b-a12b:free",
                    "assistant_text": "I still do not have ticker context for SOL.",
                },
            ],
        ):
            chat_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "Tell me about solana and if it's a buy/sell/hold"}],
                },
            )

        self.assertEqual(chat_response.status_code, 200)
        chat_payload = chat_response.get_json()
        self.assertEqual(chat_payload["chat"]["attachedTicker"], "SOL-USD")
        self.assertEqual(chat_payload["contextSummary"]["ticker"], "SOL-USD")
        self.assertIn("I do have MarketMind context attached for **SOL-USD**", chat_payload["assistantMessage"]["content"])
        self.assertNotIn("no ticker is attached", chat_payload["assistantMessage"]["content"].lower())

    def test_marketmind_ai_chat_switches_to_new_explicit_ticker_and_clears_stale_artifact(self):
        with patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "Grounded on the latest ticker."},
        ):
            first_chat_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "What do you think about GOOD right now?"}],
                    "attachedTicker": "GOOD",
                },
            )
        self.assertEqual(first_chat_response.status_code, 200)
        first_payload = first_chat_response.get_json()
        chat_id = first_payload["chat"]["id"]
        self.assertEqual(first_payload["chat"]["attachedTicker"], "GOOD")

        backend_api._ensure_user_state_storage_ready()
        with backend_api.user_state_session_scope(backend_api.DATABASE_URL) as session:
            artifact = Deliverable(
                clerk_user_id="user_a",
                template_key="investment_thesis_memo",
                ticker="GOOD",
                title="GOOD Investment Thesis Memo",
                status="draft",
                memo_audience="personal investment review",
                created_at=utcnow(),
                updated_at=utcnow(),
            )
            session.add(artifact)
            session.flush()
            chat_row = session.get(MarketMindAiChat, uuid.UUID(first_payload["chat"]["id"]))
            chat_row.latest_artifact_id = artifact.id

        with patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "Now grounded on Microsoft."},
        ):
            switched_chat_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "chatId": chat_id,
                    "messages": [
                        {"role": "user", "content": "What do you think about GOOD right now?"},
                        {"role": "assistant", "content": "Grounded on GOOD."},
                        {"role": "user", "content": "What would make a bullish thesis on MSFT break down?"},
                    ],
                    "attachedTicker": "GOOD",
                },
            )
        self.assertEqual(switched_chat_response.status_code, 200)
        switched_payload = switched_chat_response.get_json()
        self.assertEqual(switched_payload["tickerResolution"]["status"], "switched")
        self.assertEqual(switched_payload["tickerResolution"]["previousTicker"], "GOOD")
        self.assertEqual(switched_payload["tickerResolution"]["resolvedTicker"], "MSFT")
        self.assertEqual(switched_payload["chat"]["attachedTicker"], "MSFT")
        self.assertEqual(switched_payload["contextSummary"]["ticker"], "MSFT")

        chat_detail_response = self.client.get(f"/marketmind-ai/chats/{chat_id}", headers=self._auth_headers())
        self.assertEqual(chat_detail_response.status_code, 200)
        self.assertEqual(chat_detail_response.get_json()["chat"]["attachedTicker"], "MSFT")
        self.assertIsNone(chat_detail_response.get_json()["chat"]["latestArtifactId"])

    def test_marketmind_ai_compare_prompt_uses_two_asset_context(self):
        with patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "MSFT looks stronger on predictions, while GOOGL has the cleaner valuation setup."},
        ):
            response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "Compare MSFT vs GOOGL using predictions, news, and fundamentals."}],
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["tickerResolution"]["status"], "compare")
        self.assertEqual(payload["comparePair"], ["MSFT", "GOOGL"])
        self.assertIsNone(payload["chat"]["attachedTicker"])
        self.assertIn("MSFT looks stronger", payload["assistantMessage"]["content"])

    def test_marketmind_ai_chat_marks_multi_ticker_requests_ambiguous_and_self_heals_bad_saved_chat(self):
        backend_api._ensure_user_state_storage_ready()
        now = utcnow()
        with backend_api.user_state_session_scope(backend_api.DATABASE_URL) as session:
            artifact = Deliverable(
                clerk_user_id="user_a",
                template_key="investment_thesis_memo",
                ticker="GOOD",
                title="GOOD Investment Thesis Memo",
                status="draft",
                memo_audience="personal investment review",
                created_at=now,
                updated_at=now,
            )
            session.add(artifact)
            session.flush()

            chat = MarketMindAiChat(
                clerk_user_id="user_a",
                title="Broken chat",
                attached_ticker="GOOD",
                last_message_preview="Old preview",
                latest_artifact_id=artifact.id,
                created_at=now,
                updated_at=now,
            )
            session.add(chat)
            session.flush()
            session.add(
                MarketMindAiChatMessage(
                    chat_id=chat.id,
                    clerk_user_id="user_a",
                    sort_order=0,
                    role="user",
                    content="Summarize the current setup for MSFT using predictions, news, and fundamentals.",
                    created_at=now,
                )
            )
            broken_chat_id = str(chat.id)

        chat_list_response = self.client.get("/marketmind-ai/chats", headers=self._auth_headers())
        self.assertEqual(chat_list_response.status_code, 200)
        self.assertEqual(chat_list_response.get_json()[0]["attachedTicker"], "MSFT")
        self.assertIsNone(chat_list_response.get_json()[0]["latestArtifactId"])

        chat_detail_response = self.client.get(f"/marketmind-ai/chats/{broken_chat_id}", headers=self._auth_headers())
        self.assertEqual(chat_detail_response.status_code, 200)
        self.assertEqual(chat_detail_response.get_json()["chat"]["attachedTicker"], "MSFT")
        self.assertIsNone(chat_detail_response.get_json()["chat"]["latestArtifactId"])

        with patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "Please pick one ticker so I can ground the analysis."},
        ):
            ambiguous_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "Compare AAPL and MSFT for me."}],
                },
            )
        self.assertEqual(ambiguous_response.status_code, 200)
        ambiguous_payload = ambiguous_response.get_json()
        self.assertEqual(ambiguous_payload["tickerResolution"]["status"], "ambiguous")
        self.assertIsNone(ambiguous_payload["tickerResolution"]["resolvedTicker"])
        self.assertIsNone(ambiguous_payload["chat"]["attachedTicker"])
        self.assertIsNone(ambiguous_payload["contextSummary"])

    def test_openrouter_client_sends_chat_request(self):
        os.environ["OPENROUTER_API_KEY"] = "test-key"
        os.environ["OPENROUTER_SITE_URL"] = "https://marketmind.app"
        os.environ["OPENROUTER_APP_NAME"] = "MarketMind"

        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {
                    "model": "nvidia/nemotron-3-super-120b-a12b:free",
                    "choices": [
                        {
                            "message": {
                                "content": "Grounded assistant reply",
                            }
                        }
                    ],
                }

        with patch.object(openrouter_client.requests, "post", return_value=FakeResponse()) as mock_post:
            result = openrouter_client.create_chat_completion(
                messages=[{"role": "user", "content": "hello"}],
            )

        self.assertEqual(result["assistant_text"], "Grounded assistant reply")
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["headers"]["HTTP-Referer"], "https://marketmind.app")
        self.assertEqual(kwargs["headers"]["X-Title"], "MarketMind")
        self.assertEqual(kwargs["json"]["model"], "nvidia/nemotron-3-super-120b-a12b:free")

    def test_marketmind_ai_chat_can_be_deleted(self):
        with patch.object(
            marketmind_ai_module,
            "create_chat_completion",
            return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "assistant_text": "Here is a reply."},
        ):
            chat_response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={
                    "messages": [{"role": "user", "content": "What do you think about AAPL right now?"}],
                    "attachedTicker": "AAPL",
                },
            )
        self.assertEqual(chat_response.status_code, 200)
        chat_id = chat_response.get_json()["chat"]["id"]

        delete_response = self.client.delete(f"/marketmind-ai/chats/{chat_id}", headers=self._auth_headers())
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.get_json()["deleted"])

        list_response = self.client.get("/marketmind-ai/chats", headers=self._auth_headers())
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json(), [])

        detail_response = self.client.get(f"/marketmind-ai/chats/{chat_id}", headers=self._auth_headers())
        self.assertEqual(detail_response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
