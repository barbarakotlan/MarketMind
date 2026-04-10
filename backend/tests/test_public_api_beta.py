import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from api_public import build_api_key_hash, generate_marketmind_developer_api_key
from user_state_store import reset_runtime_state


class PublicApiBetaTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmpdir.name, "public_api.sqlite")
        self.database_url = f"sqlite:///{self.db_path}"

        self.original = {
            "DATABASE_URL": backend_api.DATABASE_URL,
            "PERSISTENCE_MODE": backend_api.PERSISTENCE_MODE,
            "PUBLIC_API_ENABLED": backend_api.PUBLIC_API_ENABLED,
            "PUBLIC_API_DOCS_ENABLED": backend_api.PUBLIC_API_DOCS_ENABLED,
            "PUBLIC_API_KEY_HASH_PEPPER": backend_api.PUBLIC_API_KEY_HASH_PEPPER,
            "PUBLIC_API_RATE_LIMIT_STORAGE_URL": backend_api.PUBLIC_API_RATE_LIMIT_STORAGE_URL,
            "PUBLIC_API_CACHE_URL": backend_api.PUBLIC_API_CACHE_URL,
            "PUBLIC_API_DEFAULT_DAILY_QUOTA": backend_api.PUBLIC_API_DEFAULT_DAILY_QUOTA,
            "verify_clerk_token": backend_api.verify_clerk_token,
            "stock_handler": backend_api.market_data_handlers.get_stock_data_handler,
            "chart_handler": backend_api.market_data_handlers.get_chart_data_handler,
            "news_handler": backend_api.market_data_handlers.get_query_news_handler,
            "search_handler": backend_api.market_data_handlers.search_symbols_handler,
            "ensemble_handler": backend_api.market_data_handlers.predict_ensemble_handler,
            "fundamentals_handler": backend_api.reference_data_handlers.get_fundamentals_handler,
            "macro_handler": backend_api.reference_data_handlers.get_macro_overview_handler,
            "get_general_news": backend_api.get_general_news,
            "get_symbol_suggestions": backend_api.get_symbol_suggestions,
        }

        reset_runtime_state()
        backend_api.DATABASE_URL = self.database_url
        backend_api.PERSISTENCE_MODE = "postgres"
        backend_api.PUBLIC_API_ENABLED = "true"
        backend_api.PUBLIC_API_DOCS_ENABLED = "true"
        backend_api.PUBLIC_API_KEY_HASH_PEPPER = "test-pepper"
        backend_api.PUBLIC_API_RATE_LIMIT_STORAGE_URL = "memory://"
        backend_api.PUBLIC_API_CACHE_URL = ""
        backend_api.PUBLIC_API_DEFAULT_DAILY_QUOTA = 2
        backend_api.verify_clerk_token = lambda token: {"sub": token}
        backend_api.app.testing = True
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND = None
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND_KEY = None

        backend_api.market_data_handlers.get_stock_data_handler = lambda *args, **kwargs: kwargs["jsonify_fn"](
            {
                "symbol": "AAPL",
                "companyName": "Apple Inc.",
                "price": 213.45,
                "change": 1.23,
                "changePercent": 0.58,
                "marketCap": "3.10T",
                "sparkline": [210.0, 211.0, 213.45],
                "fundamentals": {"peRatio": 31.2},
                "financials": {"revenue": 100},
            }
        )
        backend_api.market_data_handlers.get_chart_data_handler = lambda *args, **kwargs: kwargs["jsonify_fn"](
            [{"date": "2026-03-28 00:00:00", "open": 1, "high": 2, "low": 0.5, "close": 1.5, "volume": 10}]
        )
        backend_api.market_data_handlers.get_query_news_handler = lambda *args, **kwargs: kwargs["jsonify_fn"](
            [{
                "title": "Apple rally",
                "publisher": "News Wire",
                "link": "https://example.com/apple",
                "publishTime": "2026-03-30T12:00:00Z",
                "sentiment": {"status": "scored", "label": "positive"},
            }]
        )
        backend_api.market_data_handlers.search_symbols_handler = lambda *args, **kwargs: kwargs["jsonify_fn"](
            [{"symbol": "AAPL", "name": "Apple Inc."}]
        )
        backend_api.market_data_handlers.predict_ensemble_handler = lambda *args, **kwargs: kwargs["jsonify_fn"](
            {
                "symbol": "AAPL",
                "companyName": "Apple Inc.",
                "recentDate": "2026-03-30",
                "recentClose": 213.44,
                "recentPredicted": 214.12,
                "predictions": [{"date": "2026-03-31", "predictedClose": 214.12}],
                "modelsUsed": ["linear_regression", "random_forest"],
                "ensembleMethod": "weighted_average",
                "confidence": 87.2,
            }
        )
        backend_api.reference_data_handlers.get_fundamentals_handler = lambda *args, **kwargs: kwargs["jsonify_fn"](
            {
                "symbol": "AAPL",
                "name": "Apple Inc.",
                "market_cap": "3100000000000",
                "marketSession": {"status": "open"},
                "sentimentSummary": {"status": "scored", "label": "neutral"},
                "announcements": [
                    {
                        "title": "Announcement",
                        "sentiment": {"status": "scored", "label": "negative"},
                    }
                ],
            }
        )
        backend_api.reference_data_handlers.get_macro_overview_handler = lambda *args, **kwargs: kwargs["jsonify_fn"](
            [{"symbol": "URATE", "name": "Unemployment Rate", "unit": "%", "value": 4.1, "prev": 4.0, "date": "2026-02-01", "sparkline": []}]
        )
        backend_api.get_general_news = lambda: [
            {
                "headline": "Macro update",
                "source": "Finnhub",
                "url": "https://example.com/macro",
                "datetime": "2026-03-30T12:00:00Z",
                "sentiment": {"status": "scored", "label": "negative"},
            }
        ]
        backend_api.get_symbol_suggestions = lambda query: [{"symbol": query.upper(), "name": f"{query.title()} Inc."}]

        backend_api._ensure_user_state_storage_ready()
        prefix, plaintext_key = generate_marketmind_developer_api_key()
        self.public_key = plaintext_key
        with backend_api.user_state_session_scope(self.database_url) as session:
            client = backend_api.create_public_api_client_db(
                session,
                name="Beta Client",
                contact_email="beta@example.com",
            )
            backend_api.create_public_api_key_db(
                session,
                client_id=client.id,
                key_prefix=prefix,
                key_hash=build_api_key_hash(plaintext_key, backend_api.PUBLIC_API_KEY_HASH_PEPPER),
                label="beta-key",
            )

        self.client = backend_api.app.test_client()

    def tearDown(self):
        backend_api.DATABASE_URL = self.original["DATABASE_URL"]
        backend_api.PERSISTENCE_MODE = self.original["PERSISTENCE_MODE"]
        backend_api.PUBLIC_API_ENABLED = self.original["PUBLIC_API_ENABLED"]
        backend_api.PUBLIC_API_DOCS_ENABLED = self.original["PUBLIC_API_DOCS_ENABLED"]
        backend_api.PUBLIC_API_KEY_HASH_PEPPER = self.original["PUBLIC_API_KEY_HASH_PEPPER"]
        backend_api.PUBLIC_API_RATE_LIMIT_STORAGE_URL = self.original["PUBLIC_API_RATE_LIMIT_STORAGE_URL"]
        backend_api.PUBLIC_API_CACHE_URL = self.original["PUBLIC_API_CACHE_URL"]
        backend_api.PUBLIC_API_DEFAULT_DAILY_QUOTA = self.original["PUBLIC_API_DEFAULT_DAILY_QUOTA"]
        backend_api.verify_clerk_token = self.original["verify_clerk_token"]
        backend_api.market_data_handlers.get_stock_data_handler = self.original["stock_handler"]
        backend_api.market_data_handlers.get_chart_data_handler = self.original["chart_handler"]
        backend_api.market_data_handlers.get_query_news_handler = self.original["news_handler"]
        backend_api.market_data_handlers.search_symbols_handler = self.original["search_handler"]
        backend_api.market_data_handlers.predict_ensemble_handler = self.original["ensemble_handler"]
        backend_api.reference_data_handlers.get_fundamentals_handler = self.original["fundamentals_handler"]
        backend_api.reference_data_handlers.get_macro_overview_handler = self.original["macro_handler"]
        backend_api.get_general_news = self.original["get_general_news"]
        backend_api.get_symbol_suggestions = self.original["get_symbol_suggestions"]
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND = None
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND_KEY = None
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _public_headers(self):
        return {"Authorization": f"Bearer {self.public_key}"}

    def test_public_route_requires_marketmind_developer_key(self):
        response = self.client.get("/api/public/v1/health")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["error"]["code"], "invalid_api_key")

    def test_clerk_token_does_not_authorize_public_route(self):
        response = self.client.get(
            "/api/public/v1/health",
            headers={"Authorization": "Bearer clerk-session-token"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["error"]["code"], "invalid_api_key")

    def test_public_key_does_not_authorize_internal_clerk_route(self):
        response = self.client.get("/auth/me", headers=self._public_headers())
        self.assertEqual(response.status_code, 401)

    def test_public_stock_contract_omits_internal_only_fields(self):
        response = self.client.get("/api/public/v1/stock/AAPL", headers=self._public_headers())
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["symbol"], "AAPL")
        self.assertIn("company_name", payload)
        self.assertNotIn("fundamentals", payload)
        self.assertNotIn("financials", payload)
        self.assertEqual(response.headers["X-Cache"], "MISS")

    def test_public_ensemble_contract_returns_prediction_summary(self):
        response = self.client.get("/api/public/v1/predictions/ensemble/AAPL", headers=self._public_headers())
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["symbol"], "AAPL")
        self.assertIn("confidence", payload)

    def test_public_contracts_strip_internal_sentiment_fields(self):
        news_response = self.client.get("/api/public/v1/news", headers=self._public_headers())
        fundamentals_response = self.client.get("/api/public/v1/fundamentals/AAPL", headers=self._public_headers())

        self.assertEqual(news_response.status_code, 200)
        news_payload = news_response.get_json()
        self.assertNotIn("sentiment", news_payload["articles"][0])

        self.assertEqual(fundamentals_response.status_code, 200)
        fundamentals_payload = fundamentals_response.get_json()
        self.assertNotIn("sentimentSummary", fundamentals_payload)
        self.assertNotIn("marketSession", fundamentals_payload)
        self.assertNotIn("sentiment", fundamentals_payload["announcements"][0])

    def test_public_docs_and_spec_available_when_enabled(self):
        docs_response = self.client.get("/api/public/docs")
        spec_response = self.client.get("/api/public/openapi/v1.yaml")
        self.assertEqual(docs_response.status_code, 200)
        docs_body = docs_response.get_data(as_text=True)
        self.assertIn("MarketMind Public API", docs_body)
        self.assertIn("OpenAPI v1", docs_body)
        self.assertEqual(spec_response.status_code, 200)
        self.assertIn("openapi: 3.1.0", spec_response.get_data(as_text=True))

    def test_daily_quota_is_enforced(self):
        first = self.client.get("/api/public/v1/health", headers=self._public_headers())
        second = self.client.get("/api/public/v1/health", headers=self._public_headers())
        third = self.client.get("/api/public/v1/health", headers=self._public_headers())
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(third.status_code, 429)
        self.assertEqual(third.get_json()["error"]["code"], "quota_exceeded")

    def test_cache_hit_still_updates_usage_accounting(self):
        first = self.client.get("/api/public/v1/stock/AAPL", headers=self._public_headers())
        second = self.client.get("/api/public/v1/stock/AAPL", headers=self._public_headers())
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.headers["X-Cache"], "MISS")
        self.assertEqual(second.headers["X-Cache"], "HIT")

        with backend_api.user_state_session_scope(self.database_url) as session:
            rows = backend_api.list_public_api_daily_usage_db(session)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].request_count, 2)
        self.assertEqual(rows[0].cached_request_count, 1)


if __name__ == "__main__":
    unittest.main()
