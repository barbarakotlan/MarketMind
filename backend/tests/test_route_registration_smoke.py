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
            "/prediction-markets/buy": {"POST"},
            "/fundamentals/<string:ticker>": {"GET"},
            "/search-symbols": {"GET"},
            "/calendar/economic": {"GET"},
            "/macro/overview": {"GET"},
        }

        for rule, methods in expected.items():
            self.assertIn(rule, rules)
            self.assertTrue(methods.issubset(rules[rule]))


if __name__ == "__main__":
    unittest.main()
