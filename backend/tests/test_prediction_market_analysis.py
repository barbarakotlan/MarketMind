import os
import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import prediction_market_analysis as analysis_module
import prediction_markets_fetcher as fetcher


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise fetcher.requests.HTTPError(f"HTTP {self.status_code}")


class PredictionMarketAnalysisUnitTests(unittest.TestCase):
    def test_resolve_market_for_analysis_falls_back_from_market_slug_to_event_slug(self):
        responses = [
            FakeResponse(404, {"error": "not found"}),
            FakeResponse(
                200,
                {
                    "title": "2028 Election Winner",
                    "markets": [
                        {
                            "slug": "candidate-a-2028",
                            "question": "Will Candidate A win the 2028 election?",
                            "description": "Resolves based on the certified 2028 election result.",
                            "outcomes": ["Yes", "No"],
                            "outcomePrices": ["0.61", "0.39"],
                            "endDate": "2028-11-05T05:00:00Z",
                            "volume": 12345,
                            "liquidity": 45678,
                            "active": True,
                        }
                    ],
                },
            ),
        ]

        with patch.object(fetcher.requests, "get", side_effect=responses):
            market = fetcher.resolve_market_for_analysis(
                market_url="https://polymarket.com/event/2028-election-winner",
                exchange="polymarket",
            )

        self.assertEqual(market["id"], "candidate-a-2028")
        self.assertEqual(market["event_title"], "2028 Election Winner")
        self.assertEqual(market["question"], "Will Candidate A win the 2028 election?")
        self.assertAlmostEqual(market["current_probability"], 0.61)
        self.assertEqual(market["source_url"], "https://polymarket.com/event/candidate-a-2028")

    def test_resolve_market_for_analysis_rejects_non_polymarket_urls(self):
        with self.assertRaises(fetcher.PredictionMarketLookupError) as ctx:
            fetcher.resolve_market_for_analysis(
                market_url="https://example.com/not-a-market",
                exchange="polymarket",
            )

        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("Invalid Polymarket URL format", str(ctx.exception))

    def test_analyze_prediction_market_returns_fallback_contract_without_openrouter(self):
        sample_market = {
            "id": "fed-cut-2026",
            "exchange": "polymarket",
            "question": "Will the Fed cut rates by June 2026?",
            "event_title": "Fed Path 2026",
            "description": "Resolves YES if the Fed has cut the target range by the June 2026 meeting.",
            "outcomes": ["Yes", "No"],
            "prices": {"Yes": 0.58, "No": 0.42},
            "close_time": "2026-06-18T18:00:00Z",
            "volume": 18000,
            "liquidity": 9000,
            "is_binary": True,
            "is_open": True,
            "source_url": "https://polymarket.com/event/fed-cut-2026",
            "current_probability": 0.58,
        }

        with patch.dict(os.environ, {"OPENROUTER_API_KEY": ""}, clear=False), patch.object(
            analysis_module,
            "resolve_market_for_analysis",
            return_value=sample_market,
        ):
            payload = analysis_module.analyze_prediction_market(market_id="fed-cut-2026")

        self.assertEqual(payload["market"]["id"], "fed-cut-2026")
        self.assertEqual(payload["market"]["event_title"], "Fed Path 2026")
        self.assertGreaterEqual(len(payload["claims"]), 3)
        self.assertIn(payload["analysis"]["stance"], {"aligned", "lean_yes", "lean_no", "uncertain"})
        self.assertGreaterEqual(len(payload["analysis"]["risk_notes"]), 2)

    def test_analyze_prediction_market_uses_ai_only_when_explicitly_enabled(self):
        sample_market = {
            "id": "fed-cut-2026",
            "exchange": "polymarket",
            "question": "Will the Fed cut rates by June 2026?",
            "event_title": None,
            "description": "Resolution criteria text.",
            "outcomes": ["Yes", "No"],
            "prices": {"Yes": 0.58, "No": 0.42},
            "close_time": "2026-06-18T18:00:00Z",
            "volume": 18000,
            "liquidity": 9000,
            "is_binary": True,
            "is_open": True,
            "source_url": "https://polymarket.com/event/fed-cut-2026",
            "current_probability": 0.58,
        }

        with patch.dict(
            os.environ,
            {
                "OPENROUTER_API_KEY": "test-key",
                "PREDICTION_MARKET_ANALYSIS_USE_AI": "true",
            },
            clear=False,
        ), patch.object(
            analysis_module,
            "resolve_market_for_analysis",
            return_value=sample_market,
        ), patch.object(
            analysis_module,
            "create_structured_completion",
            return_value={
                "model": "test-model",
                "structured_content": {
                    "model_probability": 0.54,
                    "brief": "A compact AI-generated brief.",
                    "claims": [
                        {"claim": "Claim 1", "rationale": "Why claim 1 matters."},
                        {"claim": "Claim 2", "rationale": "Why claim 2 matters."},
                        {"claim": "Claim 3", "rationale": "Why claim 3 matters."},
                    ],
                    "risk_notes": [
                        "Risk note 1",
                        "Risk note 2",
                    ],
                },
            },
        ):
            payload = analysis_module.analyze_prediction_market(market_id="fed-cut-2026")

        self.assertEqual(payload["analysis"]["model"], "test-model")
        self.assertEqual(payload["analysis"]["brief"], "A compact AI-generated brief.")

    def test_analyze_prediction_market_falls_back_when_ai_generation_fails(self):
        sample_market = {
            "id": "fed-cut-2026",
            "exchange": "polymarket",
            "question": "Will the Fed cut rates by June 2026?",
            "event_title": None,
            "description": "Resolution criteria text.",
            "outcomes": ["Yes", "No"],
            "prices": {"Yes": 0.58, "No": 0.42},
            "close_time": "2026-06-18T18:00:00Z",
            "volume": 18000,
            "liquidity": 9000,
            "is_binary": True,
            "is_open": True,
            "source_url": "https://polymarket.com/event/fed-cut-2026",
            "current_probability": 0.58,
        }

        with patch.dict(
            os.environ,
            {
                "OPENROUTER_API_KEY": "test-key",
                "PREDICTION_MARKET_ANALYSIS_USE_AI": "true",
            },
            clear=False,
        ), patch.object(
            analysis_module,
            "resolve_market_for_analysis",
            return_value=sample_market,
        ), patch.object(
            analysis_module,
            "create_structured_completion",
            side_effect=RuntimeError("upstream failure"),
        ):
            payload = analysis_module.analyze_prediction_market(market_id="fed-cut-2026")

        self.assertEqual(payload["market"]["id"], "fed-cut-2026")
        self.assertEqual(payload["analysis"]["model"], "fallback-heuristic")
        self.assertGreaterEqual(len(payload["claims"]), 3)


if __name__ == "__main__":
    unittest.main()
