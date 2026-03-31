import os
import sys
import tempfile
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from user_state_store import reset_runtime_state


class PredictionMarketAnalysisApiTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp_root = self.tmpdir.name
        self.original_state = {
            "BASE_DIR": backend_api.BASE_DIR,
            "DATABASE": backend_api.DATABASE,
            "DATABASE_URL": backend_api.DATABASE_URL,
            "PERSISTENCE_MODE": backend_api.PERSISTENCE_MODE,
            "USER_DATA_DIR": backend_api.USER_DATA_DIR,
            "verify_clerk_token": backend_api.verify_clerk_token,
            "pm_analyze_market": backend_api.pm_analyze_market,
        }

        reset_runtime_state()
        backend_api.BASE_DIR = self.tmp_root
        backend_api.DATABASE = os.path.join(self.tmp_root, "marketmind_test.db")
        backend_api.DATABASE_URL = ""
        backend_api.PERSISTENCE_MODE = "json"
        backend_api.USER_DATA_DIR = os.path.join(self.tmp_root, "user_data")
        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()

        def fake_verify(token):
            return {"sub": token}

        backend_api.verify_clerk_token = fake_verify
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

    def tearDown(self):
        backend_api.BASE_DIR = self.original_state["BASE_DIR"]
        backend_api.DATABASE = self.original_state["DATABASE"]
        backend_api.DATABASE_URL = self.original_state["DATABASE_URL"]
        backend_api.PERSISTENCE_MODE = self.original_state["PERSISTENCE_MODE"]
        backend_api.USER_DATA_DIR = self.original_state["USER_DATA_DIR"]
        backend_api.verify_clerk_token = self.original_state["verify_clerk_token"]
        backend_api.pm_analyze_market = self.original_state["pm_analyze_market"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _auth_headers(self, user_id="user_a"):
        return {"Authorization": f"Bearer {user_id}"}

    def test_prediction_market_analysis_endpoint_returns_analysis_payload(self):
        calls = []

        def fake_analyze_market(**kwargs):
            calls.append(kwargs)
            return {
                "market": {
                    "id": "fed-cut-2026",
                    "exchange": "polymarket",
                    "question": "Will the Fed cut rates by June 2026?",
                    "event_title": "Fed Path 2026",
                    "current_probability": 0.58,
                    "end_date": "2026-06-18T18:00:00Z",
                    "source_url": "https://polymarket.com/event/fed-cut-2026",
                },
                "claims": [
                    {"claim": "The market already shows a directional lean.", "rationale": "58% is above a coin flip."},
                    {"claim": "Liquidity should be treated as moderate rather than definitive.", "rationale": "Depth is not especially large."},
                    {"claim": "Resolution wording still matters here.", "rationale": "Policy markets can hinge on exact wording."},
                ],
                "analysis": {
                    "model_probability": 0.55,
                    "delta": -0.03,
                    "stance": "aligned",
                    "brief": "The model is slightly more cautious than the market but broadly in the same range.",
                    "risk_notes": [
                        "Resolution wording can matter.",
                        "Late Fed communication can move pricing quickly.",
                    ],
                },
                "generated_at": "2026-03-30T14:00:00+00:00",
            }

        backend_api.pm_analyze_market = fake_analyze_market

        response = self.client.post(
            "/prediction-markets/analyze",
            headers=self._auth_headers(),
            json={"market_id": "fed-cut-2026"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["market"]["id"], "fed-cut-2026")
        self.assertEqual(payload["analysis"]["stance"], "aligned")
        self.assertEqual(len(payload["claims"]), 3)
        self.assertEqual(calls[0]["exchange"], "polymarket")
        self.assertEqual(calls[0]["market_id"], "fed-cut-2026")
        self.assertIsNone(calls[0]["market_url"])

    def test_prediction_market_analysis_endpoint_uses_analysis_error_contract(self):
        def fake_analyze_market(**_kwargs):
            raise backend_api.PredictionMarketAnalysisError(
                "Exactly one of market_id or market_url is required",
                status_code=400,
            )

        backend_api.pm_analyze_market = fake_analyze_market

        response = self.client.post(
            "/prediction-markets/analyze",
            headers=self._auth_headers(),
            json={"market_id": "fed-cut-2026", "market_url": "https://polymarket.com/event/fed-cut-2026"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "Exactly one of market_id or market_url is required",
        )


if __name__ == "__main__":
    unittest.main()
