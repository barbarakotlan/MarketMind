"""Lock in the create_app() application-factory guarantees (B6).

These assert the properties that make the app testable in isolation:
- create_app() returns fresh, independent app instances;
- config overrides apply per-instance and don't leak;
- a freshly built app registers the full route set (same as the shipped
  module-level `app`);
- building an app has no import-time side effects that hurt tests
  (no background scheduler thread is started);
- a fresh app actually serves requests.

Kept self-contained (sys.path insert + `import api`) to match the rest of
the suite, which has no shared test package.
"""
import os
import sys
import threading
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("PERSISTENCE_MODE", "json")

import api as backend_api


class AppFactoryTests(unittest.TestCase):
    def test_create_app_returns_distinct_instances(self):
        app_a = backend_api.create_app()
        app_b = backend_api.create_app()
        self.assertIsNot(app_a, app_b)

    def test_config_overrides_apply_per_instance_and_do_not_leak(self):
        app_a = backend_api.create_app({"TESTING": True, "SAMPLE_FLAG": "a"})
        app_b = backend_api.create_app({"SAMPLE_FLAG": "b"})
        self.assertTrue(app_a.config["TESTING"])
        self.assertEqual(app_a.config["SAMPLE_FLAG"], "a")
        self.assertEqual(app_b.config["SAMPLE_FLAG"], "b")
        # An app built with no overrides must not inherit the flag.
        self.assertIsNone(backend_api.create_app().config.get("SAMPLE_FLAG"))

    def test_fresh_app_registers_the_full_route_set(self):
        fresh_rules = {r.rule for r in backend_api.create_app().url_map.iter_rules()}
        module_rules = {r.rule for r in backend_api.app.url_map.iter_rules()}
        self.assertEqual(fresh_rules, module_rules)
        # Guard against an accidental empty/partial registration.
        self.assertGreater(len(fresh_rules), 100)

    def test_create_app_starts_no_background_thread(self):
        before = threading.active_count()
        backend_api.create_app()
        self.assertEqual(threading.active_count(), before)

    def test_fresh_app_serves_requests(self):
        client = backend_api.create_app({"TESTING": True}).test_client()
        response = client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")


if __name__ == "__main__":
    unittest.main()
