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
            "stock_handler": backend_api.market_data_handlers.get_stock_data_handler,
            "chart_handler": backend_api.market_data_handlers.get_chart_data_handler,
            "search_handler": backend_api.market_data_handlers.search_symbols_handler,
            "fundamentals_handler": backend_api.reference_data_handlers.get_fundamentals_handler,
            "macro_handler": backend_api.reference_data_handlers.get_macro_overview_handler,
            "get_symbol_suggestions": backend_api.get_symbol_suggestions,
            "akshare_search": backend_api.akshare_service.search_equities,
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

        backend_api.market_data_handlers.get_stock_data_handler = self._stub_stock_handler
        backend_api.market_data_handlers.get_chart_data_handler = self._stub_chart_handler
        backend_api.market_data_handlers.search_symbols_handler = self._stub_search_handler
        backend_api.reference_data_handlers.get_fundamentals_handler = self._stub_fundamentals_handler
        backend_api.reference_data_handlers.get_macro_overview_handler = self._stub_macro_handler
        backend_api.get_symbol_suggestions = lambda query: [
            {
                "symbol": "AAPL",
                "name": "Apple Inc.",
                "displayName": "Apple Inc.",
                "market": "US",
                "exchange": "United States",
                "assetId": "US:AAPL",
            }
        ] if query.lower().startswith("a") or query.lower().startswith("t") else []
        backend_api.akshare_service.search_equities = lambda query, market="all": [
            {
                "symbol": "00700",
                "name": "Tencent Holdings Ltd.",
                "displayName": "Tencent Holdings Ltd.",
                "market": "HK",
                "exchange": "HKEX",
                "assetId": "HK:00700",
            },
            {
                "symbol": "600519",
                "name": "Kweichow Moutai",
                "displayName": "Kweichow Moutai",
                "market": "CN",
                "exchange": "SSE",
                "assetId": "CN:600519",
            },
        ] if market in {"hk", "cn", "all"} else []

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
        backend_api.market_data_handlers.get_stock_data_handler = self.original["stock_handler"]
        backend_api.market_data_handlers.get_chart_data_handler = self.original["chart_handler"]
        backend_api.market_data_handlers.search_symbols_handler = self.original["search_handler"]
        backend_api.reference_data_handlers.get_fundamentals_handler = self.original["fundamentals_handler"]
        backend_api.reference_data_handlers.get_macro_overview_handler = self.original["macro_handler"]
        backend_api.get_symbol_suggestions = self.original["get_symbol_suggestions"]
        backend_api.akshare_service.search_equities = self.original["akshare_search"]
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

    def _stub_stock_handler(self, ticker, **kwargs):
        market = str(kwargs["request_obj"].args.get("market", "us")).lower()
        if market == "hk":
            return kwargs["jsonify_fn"](
                {
                    "symbol": "00700",
                    "assetId": "HK:00700",
                    "market": "HK",
                    "exchange": "HKEX",
                    "currency": "HKD",
                    "companyName": "Tencent Holdings Ltd.",
                    "price": 320.5,
                    "change": 4.8,
                    "changePercent": 1.52,
                    "marketCap": "N/A",
                    "sparkline": [312.0, 316.4, 320.5],
                    "readOnlyResearchOnly": True,
                }
            )
        if market == "cn":
            return kwargs["jsonify_fn"](
                {
                    "symbol": "600519",
                    "assetId": "CN:600519",
                    "market": "CN",
                    "exchange": "SSE",
                    "currency": "CNY",
                    "companyName": "Kweichow Moutai",
                    "price": 1688.0,
                    "change": -12.0,
                    "changePercent": -0.71,
                    "marketCap": "2.11T",
                    "sparkline": [1715.0, 1701.0, 1688.0],
                    "readOnlyResearchOnly": True,
                }
            )
        return kwargs["jsonify_fn"](
            {
                "symbol": "AAPL",
                "assetId": "US:AAPL",
                "market": "US",
                "exchange": "NASDAQ",
                "currency": "USD",
                "companyName": "Apple Inc.",
                "price": 213.45,
                "change": 1.23,
                "changePercent": 0.58,
                "marketCap": "3.10T",
                "sparkline": [210.0, 211.0, 213.45],
            }
        )

    def _stub_chart_handler(self, ticker, **kwargs):
        market = str(kwargs["request_obj"].args.get("market", "us")).lower()
        base = "00700" if market == "hk" else "600519" if market == "cn" else "AAPL"
        return kwargs["jsonify_fn"](
            [
                {"date": "2026-03-28 00:00:00", "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 10},
                {"date": "2026-03-29 00:00:00", "open": 1.5, "high": 2.1, "low": 1.0, "close": 1.8, "volume": 12},
                {"date": f"2026-03-30 00:00:00", "open": 1.8, "high": 2.4, "low": 1.6, "close": 2.2 if base == 'AAPL' else 2.0, "volume": 15},
            ]
        )

    def _stub_search_handler(self, **kwargs):
        market = str(kwargs["request_obj"].args.get("market", "us")).lower()
        matches = []
        if market in {"us", "all"}:
            matches.append(
                {
                    "symbol": "AAPL",
                    "name": "Apple Inc.",
                    "displayName": "Apple Inc.",
                    "market": "US",
                    "exchange": "United States",
                    "assetId": "US:AAPL",
                }
            )
        if market in {"hk", "all"}:
            matches.append(
                {
                    "symbol": "00700",
                    "name": "Tencent Holdings Ltd.",
                    "displayName": "Tencent Holdings Ltd.",
                    "market": "HK",
                    "exchange": "HKEX",
                    "assetId": "HK:00700",
                }
            )
        if market in {"cn", "all"}:
            matches.append(
                {
                    "symbol": "600519",
                    "name": "Kweichow Moutai",
                    "displayName": "Kweichow Moutai",
                    "market": "CN",
                    "exchange": "SSE",
                    "assetId": "CN:600519",
                }
            )
        return kwargs["jsonify_fn"](matches)

    def _stub_fundamentals_handler(self, ticker, **kwargs):
        market = str(kwargs["request_obj"].args.get("market", "us")).lower()
        if market == "hk":
            return kwargs["jsonify_fn"](
                {
                    "symbol": "00700",
                    "assetId": "HK:00700",
                    "market": "HK",
                    "exchange": "HKEX",
                    "currency": "HKD",
                    "name": "Tencent Holdings Ltd.",
                    "description": "Company profile data is available from Eastmoney via Akshare.",
                    "sector": "Communication Services",
                    "industry": "Internet Content & Information",
                    "researchProfile": [{"label": "Company", "value": "Tencent Holdings Ltd."}],
                    "announcements": [
                        {
                            "title": "Tencent announces annual results",
                            "publisher": "CNInfo",
                            "date": "2026-03-20",
                            "link": "https://example.com/tencent-results",
                        }
                    ],
                }
            )
        if market == "cn":
            return kwargs["jsonify_fn"](
                {
                    "symbol": "600519",
                    "assetId": "CN:600519",
                    "market": "CN",
                    "exchange": "SSE",
                    "currency": "CNY",
                    "name": "Kweichow Moutai",
                    "description": "Company overview data is available from CNInfo via Akshare.",
                    "sector": "Consumer Staples",
                    "industry": "Beverages",
                    "researchProfile": [{"label": "Company", "value": "Kweichow Moutai Co., Ltd."}],
                    "announcements": [
                        {
                            "title": "Annual report published",
                            "publisher": "CNInfo",
                            "date": "2026-03-18",
                            "link": "https://example.com/moutai-report",
                        }
                    ],
                }
            )
        return kwargs["jsonify_fn"](
            {
                "symbol": "AAPL",
                "assetId": "US:AAPL",
                "market": "US",
                "exchange": "NASDAQ",
                "currency": "USD",
                "name": "Apple Inc.",
                "market_cap": "3100000000000",
            }
        )

    def _stub_macro_handler(self, **kwargs):
        region = str(kwargs.get("request_obj").args.get("region", "us")).lower() if kwargs.get("request_obj") else "us"
        if region == "asia":
            return kwargs["jsonify_fn"](
                {
                    "region": "asia",
                    "source": "akshare",
                    "sourceNote": "Data via Akshare aggregating Jin10 and Eastmoney sources.",
                    "indicators": [
                        {
                            "symbol": "CN_CPI",
                            "name": "China CPI YoY",
                            "market": "CN",
                            "unit": "%",
                            "value": 0.7,
                            "prev": 0.5,
                            "date": "2026-02-01",
                            "description": "Mainland China consumer inflation on a year-over-year basis.",
                            "sparkline": [{"date": "2026-01-01", "value": 0.5}, {"date": "2026-02-01", "value": 0.7}],
                        }
                    ],
                    "marketSignals": [
                        {
                            "symbol": "USDCNH",
                            "name": "USD/CNH",
                            "category": "FX",
                            "value": 7.2145,
                            "change": 0.0158,
                            "changePercent": 0.22,
                            "date": "2026-04-02",
                        }
                    ],
                }
            )
        return kwargs["jsonify_fn"](
            [
                {
                    "symbol": "URATE",
                    "name": "Unemployment Rate",
                    "unit": "%",
                    "value": 4.1,
                    "prev": 4.0,
                    "date": "2026-02-01",
                    "sparkline": [],
                }
            ]
        )

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
        self.assertIn("/api/public/v2/stock/00700?market=hk", docs_body)

        self.assertEqual(spec_response.status_code, 200)
        spec_body = spec_response.get_data(as_text=True)
        self.assertIn("openapi: 3.1.0", spec_body)
        self.assertIn("/api/public/v2/options/chain/{ticker}", spec_body)
        self.assertIn("/api/public/v2/search-symbols", spec_body)
        self.assertIn("/api/public/v2/stock/{ticker}", spec_body)
        self.assertIn("/api/public/v2/chart/{ticker}", spec_body)
        self.assertIn("/api/public/v2/fundamentals/{ticker}", spec_body)
        self.assertIn("/api/public/v2/macro/overview", spec_body)

    def test_public_v2_market_aware_search_contract(self):
        response = self.client.get(
            "/api/public/v2/search-symbols?q=tencent&market=all",
            headers=self._public_headers(),
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["query"], "tencent")
        self.assertEqual(payload["market"], "all")
        self.assertEqual(
            [item["assetId"] for item in payload["matches"]],
            ["US:AAPL", "HK:00700", "CN:600519"],
        )

    def test_public_v2_market_aware_equity_contracts(self):
        stock_response = self.client.get(
            "/api/public/v2/stock/00700?market=hk",
            headers=self._public_headers(),
        )
        chart_response = self.client.get(
            "/api/public/v2/chart/00700?market=hk&period=6mo",
            headers=self._public_headers(),
        )
        fundamentals_response = self.client.get(
            "/api/public/v2/fundamentals/00700?market=hk",
            headers=self._public_headers(),
        )

        self.assertEqual(stock_response.status_code, 200)
        stock_payload = stock_response.get_json()
        self.assertEqual(stock_payload["assetId"], "HK:00700")
        self.assertEqual(stock_payload["market"], "HK")
        self.assertEqual(stock_payload["exchange"], "HKEX")
        self.assertEqual(stock_payload["currency"], "HKD")
        self.assertTrue(stock_payload["readOnlyResearchOnly"])

        self.assertEqual(chart_response.status_code, 200)
        chart_payload = chart_response.get_json()
        self.assertEqual(chart_payload["assetId"], "HK:00700")
        self.assertEqual(chart_payload["market"], "HK")
        self.assertEqual(chart_payload["period"], "6mo")
        self.assertEqual(len(chart_payload["candles"]), 3)

        self.assertEqual(fundamentals_response.status_code, 200)
        fundamentals_payload = fundamentals_response.get_json()
        self.assertEqual(fundamentals_payload["assetId"], "HK:00700")
        self.assertIn("researchProfile", fundamentals_payload)
        self.assertIn("announcements", fundamentals_payload)

    def test_public_v2_market_aware_macro_contract(self):
        response = self.client.get(
            "/api/public/v2/macro/overview?region=asia",
            headers=self._public_headers(),
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["region"], "asia")
        self.assertEqual(payload["source"], "akshare")
        self.assertEqual(payload["indicators"][0]["symbol"], "CN_CPI")
        self.assertEqual(payload["marketSignals"][0]["symbol"], "USDCNH")

    def test_public_v2_international_provider_unavailable_maps_to_upstream_error(self):
        backend_api.market_data_handlers.get_stock_data_handler = (
            lambda *args, **kwargs: ({"error": "Akshare disabled"}, 503)
        )
        backend_api.market_data_handlers.get_chart_data_handler = (
            lambda *args, **kwargs: ({"error": "Akshare disabled"}, 503)
        )
        backend_api.reference_data_handlers.get_fundamentals_handler = (
            lambda *args, **kwargs: ({"error": "Akshare disabled"}, 503)
        )
        backend_api.reference_data_handlers.get_macro_overview_handler = (
            lambda *args, **kwargs: ({"error": "Akshare disabled"}, 503)
        )
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND = None
        backend_api.api_public_helpers._PUBLIC_CACHE_BACKEND_KEY = None

        stock_response = self.client.get("/api/public/v2/stock/00700?market=hk", headers=self._public_headers())
        chart_response = self.client.get("/api/public/v2/chart/00700?market=hk", headers=self._public_headers())
        fundamentals_response = self.client.get("/api/public/v2/fundamentals/00700?market=hk", headers=self._public_headers())
        macro_response = self.client.get("/api/public/v2/macro/overview?region=asia", headers=self._public_headers())

        for response in [stock_response, chart_response, fundamentals_response, macro_response]:
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.get_json()["error"]["code"], "upstream_unavailable")

    def test_public_v2_cache_keys_vary_by_query_params(self):
        us_response = self.client.get(
            "/api/public/v2/macro/overview",
            headers=self._public_headers(),
        )
        asia_first = self.client.get(
            "/api/public/v2/macro/overview?region=asia",
            headers=self._public_headers(),
        )
        asia_second = self.client.get(
            "/api/public/v2/macro/overview?region=asia",
            headers=self._public_headers(),
        )

        self.assertEqual(us_response.status_code, 200)
        self.assertEqual(asia_first.status_code, 200)
        self.assertEqual(asia_second.status_code, 200)
        self.assertEqual(us_response.headers["X-Cache"], "MISS")
        self.assertEqual(asia_first.headers["X-Cache"], "MISS")
        self.assertEqual(asia_second.headers["X-Cache"], "HIT")

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
