import os
import sys
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api


class RouteRegistrationSmokeTests(unittest.TestCase):
    def test_expected_routes_still_exist(self):
        rules = {}
        for rule in backend_api.app.url_map.iter_rules():
            rules.setdefault(rule.rule, set()).update(rule.methods)

        expected = {
            "/auth/me": {"GET"},
            "/marketmind-ai/bootstrap": {"GET"},
            "/marketmind-ai/chats": {"GET"},
            "/marketmind-ai/chats/<string:chat_id>": {"GET", "DELETE"},
            "/marketmind-ai/context": {"GET"},
            "/marketmind-ai/chat": {"POST"},
            "/marketmind-ai/artifacts/preflight": {"POST"},
            "/marketmind-ai/artifacts": {"GET", "POST"},
            "/marketmind-ai/artifacts/<string:artifact_id>": {"GET"},
            "/marketmind-ai/artifacts/<string:artifact_id>/versions/<string:version_id>/download": {"GET"},
            "/deliverables": {"GET", "POST"},
            "/deliverables/<string:deliverable_id>": {"GET", "PATCH"},
            "/deliverables/<string:deliverable_id>/preflight": {"POST"},
            "/deliverables/<string:deliverable_id>/memos/generate": {"POST"},
            "/watchlist": {"GET"},
            "/watchlist/<string:ticker>": {"POST", "DELETE"},
            "/stock/<string:ticker>": {"GET"},
            "/chart/<string:ticker>": {"GET"},
            "/news": {"GET"},
            "/predict/<string:model>/<string:ticker>": {"GET"},
            "/predict/ensemble/<string:ticker>": {"GET"},
            "/evaluate/<string:ticker>": {"GET"},
            "/paper/portfolio": {"GET"},
            "/paper/buy": {"POST"},
            "/paper/options/buy": {"POST"},
            "/notifications": {"GET", "POST"},
            "/prediction-markets": {"GET"},
            "/prediction-markets/analyze": {"POST"},
            "/prediction-markets/buy": {"POST"},
            "/checkout/create-subscription": {"POST"},
            "/checkout/cancel-subscription": {"POST"},
            "/checkout/plan-status": {"GET"},
            "/fundamentals/<string:ticker>": {"GET"},
            "/fundamentals/filings/<string:ticker>": {"GET"},
            "/fundamentals/sec-intelligence/<string:ticker>": {"GET"},
            "/fundamentals/filings/<string:ticker>/<string:accession_number>": {"GET"},
            "/search-symbols": {"GET"},
            "/calendar/economic": {"GET"},
            "/macro/overview": {"GET"},
            "/healthz": {"GET"},
            "/api/public/docs": {"GET"},
            "/api/public/openapi/v1.yaml": {"GET"},
            "/api/public/v1/health": {"GET"},
            "/api/public/v1/stock/<string:ticker>": {"GET"},
            "/api/public/v1/chart/<string:ticker>": {"GET"},
            "/api/public/v1/news": {"GET"},
            "/api/public/v1/search-symbols": {"GET"},
            "/api/public/v1/predictions/ensemble/<string:ticker>": {"GET"},
            "/api/public/v1/fundamentals/<string:ticker>": {"GET"},
            "/api/public/v1/macro/overview": {"GET"},
            "/api/public/openapi/v2.yaml": {"GET"},
            "/api/public/v2/health": {"GET"},
            "/api/public/v2/options/stock-price/<string:ticker>": {"GET"},
            "/api/public/v2/options/expirations/<string:ticker>": {"GET"},
            "/api/public/v2/options/chain/<string:ticker>": {"GET"},
            "/api/public/v2/options/suggest/<string:ticker>": {"GET"},
            "/api/public/v2/forex/convert": {"GET"},
            "/api/public/v2/forex/currencies": {"GET"},
            "/api/public/v2/crypto/convert": {"GET"},
            "/api/public/v2/crypto/list": {"GET"},
            "/api/public/v2/crypto/currencies": {"GET"},
            "/api/public/v2/commodities/price/<string:commodity>": {"GET"},
            "/api/public/v2/commodities/list": {"GET"},
            "/api/public/v2/commodities/all": {"GET"},
            "/api/public/v2/prediction-markets": {"GET"},
            "/api/public/v2/prediction-markets/exchanges": {"GET"},
            "/api/public/v2/prediction-markets/<path:market_id>": {"GET"},
            "/api/public/v2/calendar/economic": {"GET"},
        }

        for rule, methods in expected.items():
            self.assertIn(rule, rules)
            self.assertTrue(methods.issubset(rules[rule]))


if __name__ == "__main__":
    unittest.main()
