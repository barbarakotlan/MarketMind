import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
import deliverables as deliverables_module
import openrouter_client
from user_state_store import reset_runtime_state


class DeliverablesApiTests(unittest.TestCase):
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

        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

        self.prediction_patch = patch.object(
            deliverables_module,
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
            deliverables_module,
            "_recent_news",
            return_value=[
                {"title": "Apple launches a new hardware cycle", "publisher": "ExampleWire", "link": "https://example.com/apple-1"},
                {"title": "Services revenue remains strong", "publisher": "ExampleWire", "link": "https://example.com/apple-2"},
            ],
        )
        self.fundamentals_patch = patch.object(
            deliverables_module,
            "_fundamentals_summary",
            return_value={
                "companyName": "Apple Inc.",
                "sector": "Technology",
                "industry": "Consumer Electronics",
                "marketCap": 1000000,
                "trailingPE": 30.0,
                "forwardPE": 27.0,
                "targetMeanPrice": 205.0,
                "fiftyTwoWeekHigh": 210.0,
                "fiftyTwoWeekLow": 165.0,
                "summary": "Apple builds hardware, software, and services.",
            },
        )
        self.prediction_patch.start()
        self.news_patch.start()
        self.fundamentals_patch.start()

    def tearDown(self):
        self.prediction_patch.stop()
        self.news_patch.stop()
        self.fundamentals_patch.stop()

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
                "transactions": [
                    {
                        "date": "2026-03-20",
                        "type": "BUY",
                        "ticker": "AAPL",
                        "shares": 5,
                        "price": 100.0,
                        "total": 500.0,
                    }
                ],
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

    def test_deliverable_crud_context_preflight_generation_and_download(self):
        self._seed_marketmind_context()

        create_response = self.client.post(
            "/deliverables",
            headers=self._auth_headers(),
            json={"ticker": "AAPL"},
        )
        self.assertEqual(create_response.status_code, 201)
        deliverable = create_response.get_json()
        deliverable_id = deliverable["id"]

        detail_response = self.client.get(f"/deliverables/{deliverable_id}", headers=self._auth_headers())
        self.assertEqual(detail_response.status_code, 200)
        detail_payload = detail_response.get_json()
        self.assertEqual(detail_payload["deliverable"]["ticker"], "AAPL")

        context_response = self.client.get(f"/deliverables/{deliverable_id}/context", headers=self._auth_headers())
        self.assertEqual(context_response.status_code, 200)
        context_payload = context_response.get_json()
        self.assertTrue(context_payload["watchlistMembership"])
        self.assertEqual(len(context_payload["activeAlerts"]), 1)
        self.assertEqual(len(context_payload["paperTradeHistory"]), 1)
        self.assertEqual(context_payload["fundamentalsSummary"]["companyName"], "Apple Inc.")

        first_preflight = self.client.post(
            f"/deliverables/{deliverable_id}/preflight",
            headers=self._auth_headers(),
        )
        self.assertEqual(first_preflight.status_code, 200)
        self.assertEqual(first_preflight.get_json()["status"], "red")

        update_response = self.client.patch(
            f"/deliverables/{deliverable_id}",
            headers=self._auth_headers(),
            json={
                "thesisStatement": "Apple can sustain premium demand through ecosystem strength.",
                "timeHorizon": "6 months",
                "bullCase": "Services growth and upgrade cycle reinforce upside.",
                "bearCase": "Consumer weakness and regulatory pressure compress expectations.",
                "invalidationConditions": "If iPhone demand softens materially for two quarters.",
                "catalysts": "WWDC, earnings, and new product launches.",
                "status": "active",
                "confidence": "medium-high",
            },
        )
        self.assertEqual(update_response.status_code, 200)

        assumptions_response = self.client.put(
            f"/deliverables/{deliverable_id}/assumptions",
            headers=self._auth_headers(),
            json={
                "assumptions": [
                    {
                        "label": "Upgrade cycle",
                        "value": "A meaningful portion of the installed base upgrades this year",
                        "reason": "Hardware refresh cadence and feature demand",
                        "confidence": "medium",
                        "sourceType": "user",
                    }
                ]
            },
        )
        self.assertEqual(assumptions_response.status_code, 200)
        self.assertEqual(len(assumptions_response.get_json()), 1)

        second_preflight = self.client.post(
            f"/deliverables/{deliverable_id}/preflight",
            headers=self._auth_headers(),
        )
        self.assertEqual(second_preflight.status_code, 200)
        self.assertEqual(second_preflight.get_json()["status"], "green")

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

        with patch.object(deliverables_module, "create_structured_completion", return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "structured_content": structured_content_v1}), patch.object(
            deliverables_module,
            "_render_docx",
            return_value=b"docx-version-1",
        ):
            memo_response = self.client.post(
                f"/deliverables/{deliverable_id}/memos/generate",
                headers=self._auth_headers(),
            )
        self.assertEqual(memo_response.status_code, 201)
        memo_payload = memo_response.get_json()
        self.assertEqual(memo_payload["version"], 1)
        self.assertEqual(memo_payload["generationStatus"], "completed")

        with patch.object(deliverables_module, "create_structured_completion", return_value={"model": "nvidia/nemotron-3-super-120b-a12b:free", "structured_content": {**structured_content_v1, "executive_summary": "Updated memo version"}}), patch.object(
            deliverables_module,
            "_render_docx",
            return_value=b"docx-version-2",
        ):
            second_memo_response = self.client.post(
                f"/deliverables/{deliverable_id}/memos/generate",
                headers=self._auth_headers(),
            )
        self.assertEqual(second_memo_response.status_code, 201)
        self.assertEqual(second_memo_response.get_json()["version"], 2)

        memo_list_response = self.client.get(
            f"/deliverables/{deliverable_id}/memos",
            headers=self._auth_headers(),
        )
        self.assertEqual(memo_list_response.status_code, 200)
        memo_versions = memo_list_response.get_json()
        self.assertEqual([item["version"] for item in memo_versions], [2, 1])

        download_response = self.client.get(
            f"/deliverables/{deliverable_id}/memos/{memo_versions[-1]['id']}/download",
            headers=self._auth_headers(),
        )
        self.assertEqual(download_response.status_code, 200)
        self.assertEqual(download_response.data, b"docx-version-1")
        self.assertEqual(
            download_response.headers["Content-Type"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        self.assertEqual(
            self.client.get(f"/deliverables/{deliverable_id}", headers=self._auth_headers("user_b")).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                f"/deliverables/{deliverable_id}/memos/{memo_versions[-1]['id']}/download",
                headers=self._auth_headers("user_b"),
            ).status_code,
            404,
        )

    def test_red_preflight_blocks_generation_and_failed_ai_generation_persists_version(self):
        create_response = self.client.post(
            "/deliverables",
            headers=self._auth_headers(),
            json={"ticker": "AAPL"},
        )
        deliverable_id = create_response.get_json()["id"]

        blocked_response = self.client.post(
            f"/deliverables/{deliverable_id}/memos/generate",
            headers=self._auth_headers(),
        )
        self.assertEqual(blocked_response.status_code, 409)
        self.assertEqual(blocked_response.get_json()["latestPreflight"]["status"], "red")

        self.client.patch(
            f"/deliverables/{deliverable_id}",
            headers=self._auth_headers(),
            json={
                "thesisStatement": "Apple remains structurally advantaged.",
                "timeHorizon": "3 months",
                "bullCase": "Demand remains resilient.",
                "bearCase": "Demand slips.",
                "invalidationConditions": "Two weak prints.",
                "catalysts": "Earnings and launches.",
            },
        )
        self.client.put(
            f"/deliverables/{deliverable_id}/assumptions",
            headers=self._auth_headers(),
            json={"assumptions": [{"label": "Demand", "value": "Holds", "reason": "Brand strength"}]},
        )
        self.client.post(f"/deliverables/{deliverable_id}/preflight", headers=self._auth_headers())

        with patch.object(deliverables_module, "create_structured_completion", side_effect=RuntimeError("upstream failure")):
            failed_generation = self.client.post(
                f"/deliverables/{deliverable_id}/memos/generate",
                headers=self._auth_headers(),
            )

        self.assertEqual(failed_generation.status_code, 502)
        failed_payload = failed_generation.get_json()
        self.assertEqual(failed_payload["memo"]["generationStatus"], "failed")

        memo_list_response = self.client.get(
            f"/deliverables/{deliverable_id}/memos",
            headers=self._auth_headers(),
        )
        self.assertEqual(memo_list_response.status_code, 200)
        memo_versions = memo_list_response.get_json()
        self.assertEqual(len(memo_versions), 1)
        self.assertEqual(memo_versions[0]["generationStatus"], "failed")

    def test_openrouter_client_sends_structured_request(self):
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
                                "content": '{"executive_summary":"ok","investment_thesis":"ok","supporting_evidence":[],"key_assumptions":[],"risks":[],"invalidation_conditions":[],"catalysts":[],"signals_and_market_context":[],"linked_positioning":"ok","what_would_change_my_mind":"ok","conclusion":"ok"}'
                            }
                        }
                    ],
                }

        with patch.object(openrouter_client.requests, "post", return_value=FakeResponse()) as mock_post:
            result = openrouter_client.create_structured_completion(
                messages=[{"role": "user", "content": "hello"}],
                json_schema=deliverables_module.MEMO_JSON_SCHEMA,
                schema_name="investment_thesis_memo",
            )

        self.assertEqual(result["model"], "nvidia/nemotron-3-super-120b-a12b:free")
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["headers"]["HTTP-Referer"], "https://marketmind.app")
        self.assertEqual(kwargs["headers"]["X-Title"], "MarketMind")
        self.assertEqual(kwargs["json"]["model"], "nvidia/nemotron-3-super-120b-a12b:free")
        self.assertEqual(kwargs["json"]["response_format"]["type"], "json_schema")


if __name__ == "__main__":
    unittest.main()
