import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
from api_public import build_api_key_hash, generate_marketmind_developer_api_key
from user_state_store import reset_runtime_state


class PublicApiV2Tests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmpdir.name, "public_api_v2.sqlite")
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
            "options_stock_price_handler": backend_api.market_data_handlers.get_options_stock_price_handler,
            "option_expirations_handler": backend_api.market_data_handlers.get_option_expirations_handler,
            "option_chain_handler": backend_api.market_data_handlers.get_option_chain_handler,
            "option_suggestion_handler": backend_api.market_data_handlers.get_option_suggestion_handler,
            "get_exchange_rate": backend_api.get_exchange_rate,
            "get_currency_list": backend_api.get_currency_list,
            "get_crypto_exchange_rate": backend_api.get_crypto_exchange_rate,
            "get_crypto_list": backend_api.get_crypto_list,
            "get_target_currencies": backend_api.get_target_currencies,
            "get_commodity_price": backend_api.get_commodity_price,
            "get_commodity_list": backend_api.get_commodity_list,
            "get_commodities_by_category": backend_api.get_commodities_by_category,
            "get_economic_calendar_handler": backend_api.reference_data_handlers.get_economic_calendar_handler,
            "pm_search_markets": backend_api.pm_search_markets,
            "pm_fetch_markets": backend_api.pm_fetch_markets,
            "pm_get_exchanges": backend_api.pm_get_exchanges,
            "pm_get_market": backend_api.pm_get_market,
        }

        reset_runtime_state()
        backend_api.DATABASE_URL = self.database_url
        backend_api.PERSISTENCE_MODE = "postgres"
        backend_api.PUBLIC_API_ENABLED = "true"
        backend_api.PUBLIC_API_DOCS_ENABLED = "true"
        backend_api.PUBLIC_API_KEY_HASH_PEPPER = "test-pepper"
        backend_api.PUBLIC_API_RATE_LIMIT_STORAGE_URL = "memory://"
        backend_api.PUBLIC_API_CACHE_URL = ""
        backend_api.PUBLIC_API_DEFAULT_DAILY_QUOTA = 8
        backend_api.verify_clerk_token = lambda token: {"sub": token}
        backend_api.app.testing = True
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND = None
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND_KEY = None

        backend_api.market_data_handlers.get_options_stock_price_handler = (
            lambda ticker, **kwargs: kwargs["jsonify_fn"](
                {"ticker": ticker.split(":")[0].upper(), "price": 213.45}
            )
        )
        backend_api.market_data_handlers.get_option_expirations_handler = (
            lambda ticker, **kwargs: kwargs["jsonify_fn"](["2026-04-17", "2026-05-15"])
        )
        backend_api.market_data_handlers.get_option_chain_handler = (
            lambda ticker, **kwargs: kwargs["jsonify_fn"](
                {
                    "stock_price": 213.45,
                    "calls": [{"strike": 215, "bid": 2.1, "ask": 2.25}],
                    "puts": [{"strike": 210, "bid": 1.8, "ask": 1.95}],
                }
            )
        )
        backend_api.market_data_handlers.get_option_suggestion_handler = (
            lambda ticker, **kwargs: kwargs["jsonify_fn"](
                {"ticker": ticker.split(":")[0].upper(), "strategy": "bull call spread"}
            )
        )

        backend_api.get_exchange_rate = lambda from_currency, to_currency: {
            "from": from_currency,
            "to": to_currency,
            "rate": 0.92,
        }
        backend_api.get_currency_list = lambda: [
            {"code": "USD", "name": "US Dollar"},
            {"code": "EUR", "name": "Euro"},
        ]
        backend_api.get_crypto_exchange_rate = lambda from_crypto, to_currency: {
            "from": from_crypto,
            "to": to_currency,
            "rate": 70250.11,
        }
        backend_api.get_crypto_list = lambda: [
            {"symbol": "BTC", "name": "Bitcoin"},
            {"symbol": "ETH", "name": "Ethereum"},
        ]
        backend_api.get_target_currencies = lambda: [
            {"code": "USD", "name": "US Dollar"},
            {"code": "EUR", "name": "Euro"},
        ]
        backend_api.get_commodity_price = lambda commodity, period: {
            "commodity": commodity,
            "period": period,
            "points": [{"date": "2026-03-30", "close": 82.1}],
        }
        backend_api.get_commodity_list = lambda: [
            {"symbol": "oil", "name": "Crude Oil"},
            {"symbol": "gold", "name": "Gold"},
        ]
        backend_api.get_commodities_by_category = lambda: {
            "energy": [{"symbol": "oil", "name": "Crude Oil"}],
            "metals": [{"symbol": "gold", "name": "Gold"}],
        }
        backend_api.reference_data_handlers.get_economic_calendar_handler = (
            lambda **kwargs: kwargs["jsonify_fn"](
                [
                    {
                        "id": 1,
                        "date": "2026-03-31",
                        "time": "08:30 AM",
                        "type": "report",
                        "event": "CPI",
                        "impact": "High",
                    }
                ]
            )
        )

        backend_api.pm_search_markets = lambda search, exchange, limit: [
            {
                "id": "fed-cut-2026",
                "question": f"Search result for {search}",
                "exchange": exchange,
            }
        ][:limit]
        backend_api.pm_fetch_markets = lambda exchange, limit: [
            {
                "id": "fed-cut-2026",
                "question": "Will the Fed cut rates in 2026?",
                "exchange": exchange,
            }
        ][:limit]
        backend_api.pm_get_exchanges = lambda: [
            {"id": "polymarket", "name": "Polymarket"},
            {"id": "kalshi", "name": "Kalshi"},
        ]
        backend_api.pm_get_market = lambda market_id, exchange: {
            "id": market_id,
            "exchange": exchange,
            "question": "Will the Fed cut rates in 2026?",
            "is_open": True,
            "prices": {"Yes": 0.57, "No": 0.43},
        }

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
        backend_api.market_data_handlers.get_options_stock_price_handler = self.original["options_stock_price_handler"]
        backend_api.market_data_handlers.get_option_expirations_handler = self.original["option_expirations_handler"]
        backend_api.market_data_handlers.get_option_chain_handler = self.original["option_chain_handler"]
        backend_api.market_data_handlers.get_option_suggestion_handler = self.original["option_suggestion_handler"]
        backend_api.get_exchange_rate = self.original["get_exchange_rate"]
        backend_api.get_currency_list = self.original["get_currency_list"]
        backend_api.get_crypto_exchange_rate = self.original["get_crypto_exchange_rate"]
        backend_api.get_crypto_list = self.original["get_crypto_list"]
        backend_api.get_target_currencies = self.original["get_target_currencies"]
        backend_api.get_commodity_price = self.original["get_commodity_price"]
        backend_api.get_commodity_list = self.original["get_commodity_list"]
        backend_api.get_commodities_by_category = self.original["get_commodities_by_category"]
        backend_api.reference_data_handlers.get_economic_calendar_handler = self.original["get_economic_calendar_handler"]
        backend_api.pm_search_markets = self.original["pm_search_markets"]
        backend_api.pm_fetch_markets = self.original["pm_fetch_markets"]
        backend_api.pm_get_exchanges = self.original["pm_get_exchanges"]
        backend_api.pm_get_market = self.original["pm_get_market"]
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND = None
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND_KEY = None
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _public_headers(self):
        return {"Authorization": f"Bearer {self.public_key}"}

    def test_public_v2_requires_marketmind_developer_key(self):
        response = self.client.get("/api/public/v2/health")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["error"]["code"], "invalid_api_key")

    def test_public_v2_docs_and_spec_available_when_enabled(self):
        docs_response = self.client.get("/api/public/docs")
        spec_response = self.client.get("/api/public/openapi/v2.yaml")

        self.assertEqual(docs_response.status_code, 200)
        docs_body = docs_response.get_data(as_text=True)
        self.assertIn("OpenAPI v2", docs_body)
        self.assertIn("/api/public/v2/options/chain/AAPL", docs_body)

        self.assertEqual(spec_response.status_code, 200)
        spec_body = spec_response.get_data(as_text=True)
        self.assertIn("openapi: 3.1.0", spec_body)
        self.assertIn("/api/public/v2/options/chain/{ticker}", spec_body)

    def test_public_v2_options_chain_contract(self):
        response = self.client.get(
            "/api/public/v2/options/chain/AAPL?date=2026-04-17",
            headers=self._public_headers(),
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["ticker"], "AAPL")
        self.assertEqual(payload["expiration"], "2026-04-17")
        self.assertEqual(payload["stock_price"], 213.45)
        self.assertEqual(len(payload["calls"]), 1)
        self.assertEqual(len(payload["puts"]), 1)
        self.assertEqual(response.headers["X-Cache"], "MISS")

    def test_public_v2_reference_data_contracts(self):
        forex_response = self.client.get(
            "/api/public/v2/forex/convert?from=usd&to=eur",
            headers=self._public_headers(),
        )
        crypto_list_response = self.client.get(
            "/api/public/v2/crypto/list",
            headers=self._public_headers(),
        )
        commodity_response = self.client.get(
            "/api/public/v2/commodities/price/oil?period=1mo",
            headers=self._public_headers(),
        )

        self.assertEqual(forex_response.status_code, 200)
        self.assertEqual(forex_response.get_json()["from"], "USD")
        self.assertEqual(forex_response.get_json()["to"], "EUR")

        self.assertEqual(crypto_list_response.status_code, 200)
        self.assertEqual(crypto_list_response.get_json()["assets"][0]["symbol"], "BTC")

        self.assertEqual(commodity_response.status_code, 200)
        self.assertEqual(commodity_response.get_json()["commodity"], "oil")
        self.assertEqual(commodity_response.get_json()["period"], "1mo")

    def test_public_v2_prediction_markets_contracts(self):
        markets_response = self.client.get(
            "/api/public/v2/prediction-markets?exchange=polymarket&limit=25",
            headers=self._public_headers(),
        )
        exchanges_response = self.client.get(
            "/api/public/v2/prediction-markets/exchanges",
            headers=self._public_headers(),
        )
        detail_response = self.client.get(
            "/api/public/v2/prediction-markets/fed-cut-2026?exchange=polymarket",
            headers=self._public_headers(),
        )

        self.assertEqual(markets_response.status_code, 200)
        markets_payload = markets_response.get_json()
        self.assertEqual(markets_payload["exchange"], "polymarket")
        self.assertEqual(markets_payload["count"], 1)
        self.assertEqual(markets_payload["markets"][0]["id"], "fed-cut-2026")

        self.assertEqual(exchanges_response.status_code, 200)
        self.assertEqual(exchanges_response.get_json()["exchanges"][0]["id"], "polymarket")

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.get_json()["id"], "fed-cut-2026")

    def test_public_v2_invalid_prediction_market_query_uses_public_error_contract(self):
        response = self.client.get(
            "/api/public/v2/prediction-markets?limit=999",
            headers=self._public_headers(),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"]["code"], "invalid_query")

    def test_public_v2_economic_calendar_contract(self):
        response = self.client.get(
            "/api/public/v2/calendar/economic",
            headers=self._public_headers(),
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["events"][0]["event"], "CPI")
        self.assertEqual(payload["events"][0]["impact"], "High")

    def test_public_v2_cache_hit_still_updates_usage_accounting(self):
        first = self.client.get(
            "/api/public/v2/options/stock-price/AAPL",
            headers=self._public_headers(),
        )
        second = self.client.get(
            "/api/public/v2/options/stock-price/AAPL",
            headers=self._public_headers(),
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.headers["X-Cache"], "MISS")
        self.assertEqual(second.headers["X-Cache"], "HIT")

        with backend_api.user_state_session_scope(self.database_url) as session:
            rows = backend_api.list_public_api_daily_usage_db(session)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].route_group, "v2/options/stock-price")
        self.assertEqual(rows[0].request_count, 2)
        self.assertEqual(rows[0].cached_request_count, 1)


if __name__ == "__main__":
    unittest.main()
