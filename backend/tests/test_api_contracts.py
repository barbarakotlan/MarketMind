import json
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
import authz


class ApiContractTests(unittest.TestCase):
    def setUp(self):
        self.app = backend_api.create_app({"TESTING": True})
        self.client = self.app.test_client()

    @staticmethod
    def _auth_headers(**extra):
        return {"Authorization": "Bearer test-token", **extra}

    @staticmethod
    def _verified_identity(_token):
        return {"sub": "contract_user", "email": "contract@example.com"}

    def test_request_id_is_preserved_and_errors_are_structured(self):
        request_id = "client-request-123"
        response = self.client.get("/does-not-exist", headers={"X-Request-ID": request_id})

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.headers["X-Request-ID"], request_id)
        self.assertEqual(response.get_json()["request_id"], request_id)
        self.assertEqual(response.get_json()["code"], "not_found")
        self.assertIsInstance(response.get_json()["error"], str)

    def test_invalid_request_id_is_replaced(self):
        response = self.client.get("/healthz", headers={"X-Request-ID": "not valid whitespace"})

        generated = response.headers["X-Request-ID"]
        self.assertNotEqual(generated, "not valid whitespace")
        self.assertRegex(generated, r"^[a-f0-9]{32}$")

    def test_maximum_request_body_returns_json_413(self):
        app = backend_api.create_app({"TESTING": True, "MAX_CONTENT_LENGTH": 128})
        client = app.test_client()
        body = json.dumps({"ticker": "AAPL", "shares": 1, "padding": "x" * 512})

        with patch.object(backend_api, "_verify_auth_token", side_effect=self._verified_identity):
            response = client.post(
                "/paper/buy",
                data=body,
                content_type="application/json",
                headers=self._auth_headers(),
            )

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.get_json()["code"], "request_entity_too_large")
        self.assertIn("request_id", response.get_json())

    def test_ai_payload_enforces_message_bounds(self):
        with patch.object(backend_api, "_verify_auth_token", side_effect=self._verified_identity):
            response = self.client.post(
                "/marketmind-ai/chat",
                headers=self._auth_headers(),
                json={"messages": [{"role": "user", "content": "x" * 12_001}]},
            )

        payload = response.get_json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["code"], "invalid_request")
        self.assertEqual(payload["details"][0]["field"], "messages.0.content")

    def test_trade_payload_rejects_non_positive_and_extra_values(self):
        with patch.object(backend_api, "_verify_auth_token", side_effect=self._verified_identity):
            response = self.client.post(
                "/paper/buy",
                headers=self._auth_headers(),
                json={"ticker": "AAPL", "shares": -1, "client_price": 200},
            )

        payload = response.get_json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["code"], "invalid_request")
        fields = {detail["field"] for detail in payload["details"]}
        self.assertEqual(fields, {"client_price", "shares"})

    def test_notification_capabilities_are_method_aware(self):
        guard = backend_api.require_capability_for_methods({
            "GET": authz.Capabilities.NOTIFICATIONS_READ,
            "POST": authz.Capabilities.NOTIFICATIONS_WRITE,
        })(lambda: "allowed")
        read_only = authz.Principal(
            id="reader",
            capabilities=frozenset({authz.Capabilities.NOTIFICATIONS_READ}),
        )

        with self.app.test_request_context("/notifications", method="GET"):
            backend_api.g.principal = read_only
            self.assertEqual(guard(), "allowed")

        with self.app.test_request_context("/notifications", method="POST"):
            backend_api.g.principal = read_only
            response, status = guard()
            self.assertEqual(status, 403)
            self.assertIn("access", response.get_json()["error"])

    def test_readiness_reports_dependency_failure_without_breaking_liveness(self):
        with patch.object(backend_api, "RATE_LIMIT_STORAGE_URL", "redis://unavailable/0"), patch.object(
            backend_api,
            "_probe_redis",
            side_effect=ConnectionError("offline"),
        ):
            is_ready, checks = backend_api._readiness_checks()

        self.assertFalse(is_ready)
        self.assertEqual(checks["storage"]["status"], "ok")
        self.assertEqual(checks["rate_limit_store"]["status"], "error")
        self.assertEqual(self.client.get("/healthz").status_code, 200)

        with patch.object(
            backend_api,
            "_readiness_checks",
            return_value=(False, {"storage": {"status": "error", "type": "ConnectionError"}}),
        ):
            response = self.client.get("/readyz")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["status"], "not_ready")


if __name__ == "__main__":
    unittest.main()
