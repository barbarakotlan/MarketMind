import os
import sys
import unittest
from contextlib import contextmanager

import sqlalchemy as sa

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
import api_auth as api_auth_helpers


class _FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class _FakeJWTModule:
    class algorithms:
        class RSAAlgorithm:
            @staticmethod
            def from_jwk(_value):
                return "signing-key"

    def __init__(self, *, unverified_payload, verified_payload):
        self.unverified_payload = unverified_payload
        self.verified_payload = verified_payload
        self.decode_calls = []

    def decode(self, _token, **kwargs):
        self.decode_calls.append(kwargs)
        if kwargs.get("options", {}).get("verify_signature") is False:
            return dict(self.unverified_payload)
        return dict(self.verified_payload)

    def get_unverified_header(self, _token):
        return {"kid": "kid-1"}


class ApiAuthSecurityTests(unittest.TestCase):
    def test_validate_production_runtime_security_requires_pinned_clerk_and_seed_disabled(self):
        with self.assertRaises(ValueError) as exc:
            backend_api.validate_production_runtime_security(
                flask_secret_key="",
                clerk_jwks_url="",
                clerk_issuer="",
                allow_legacy_user_data_seed=True,
            )

        message = str(exc.exception)
        self.assertIn("FLASK_SECRET_KEY", message)
        self.assertIn("CLERK_JWKS_URL", message)
        self.assertIn("CLERK_ISSUER", message)
        self.assertIn("ALLOW_LEGACY_USER_DATA_SEED", message)

    def test_verify_clerk_token_uses_only_pinned_values_in_production(self):
        jwt_module = _FakeJWTModule(
            unverified_payload={"iss": "https://attacker.example.com"},
            verified_payload={"sub": "user_123", "iss": "https://clerk.marketmind.com"},
        )
        requested_urls = []

        payload = api_auth_helpers.verify_clerk_token(
            "token",
            clerk_jwks_url="https://clerk.marketmind.com/.well-known/jwks.json",
            clerk_issuer="https://clerk.marketmind.com",
            clerk_audience="marketmind-api",
            jwks_cache_ttl_seconds=3600,
            jwks_cache={},
            is_production=True,
            requests_get=lambda url, timeout=5: requested_urls.append((url, timeout)) or _FakeResponse(
                {"keys": [{"kid": "kid-1"}]}
            ),
            jwt_module=jwt_module,
        )

        self.assertEqual(payload["sub"], "user_123")
        self.assertEqual(len(jwt_module.decode_calls), 1)
        self.assertEqual(
            requested_urls,
            [("https://clerk.marketmind.com/.well-known/jwks.json", 5)],
        )
        verified_decode = jwt_module.decode_calls[0]
        self.assertEqual(verified_decode["issuer"], "https://clerk.marketmind.com")
        self.assertEqual(verified_decode["audience"], "marketmind-api")

    def test_verify_clerk_token_allows_only_trusted_clerk_dev_fallback(self):
        jwt_module = _FakeJWTModule(
            unverified_payload={"iss": "https://demo-account.clerk.accounts.dev"},
            verified_payload={"sub": "user_dev", "iss": "https://demo-account.clerk.accounts.dev"},
        )
        requested_urls = []

        payload = api_auth_helpers.verify_clerk_token(
            "token",
            clerk_jwks_url="",
            clerk_issuer="",
            clerk_audience="",
            jwks_cache_ttl_seconds=3600,
            jwks_cache={},
            is_production=False,
            requests_get=lambda url, timeout=5: requested_urls.append((url, timeout)) or _FakeResponse(
                {"keys": [{"kid": "kid-1"}]}
            ),
            jwt_module=jwt_module,
        )

        self.assertEqual(payload["sub"], "user_dev")
        self.assertEqual(len(jwt_module.decode_calls), 2)
        self.assertEqual(
            requested_urls,
            [("https://demo-account.clerk.accounts.dev/.well-known/jwks.json", 5)],
        )
        verified_decode = jwt_module.decode_calls[1]
        self.assertEqual(verified_decode["issuer"], "https://demo-account.clerk.accounts.dev")
        self.assertEqual(verified_decode["options"], {"verify_aud": False})

    def test_verify_clerk_token_rejects_non_clerk_dev_fallback(self):
        jwt_module = _FakeJWTModule(
            unverified_payload={"iss": "https://evil.example.com"},
            verified_payload={"sub": "user_dev", "iss": "https://evil.example.com"},
        )

        with self.assertRaises(ValueError) as exc:
            api_auth_helpers.verify_clerk_token(
                "token",
                clerk_jwks_url="",
                clerk_issuer="",
                clerk_audience="",
                jwks_cache_ttl_seconds=3600,
                jwks_cache={},
                is_production=False,
                requests_get=lambda url, timeout=5: _FakeResponse({"keys": [{"kid": "kid-1"}]}),
                jwt_module=jwt_module,
            )

        self.assertIn("trusted https Clerk dev issuers", str(exc.exception))

    def test_sync_authenticated_user_ignores_transient_sqlite_lock(self):
        touched_users = []

        @contextmanager
        def locked_session_scope(_database_url):
            yield object()
            raise sa.exc.OperationalError(
                "UPDATE app_users SET last_seen_at=? WHERE app_users.clerk_user_id = ?",
                {"clerk_user_id": "user_locked"},
                Exception("database is locked"),
            )

        api_auth_helpers.sync_authenticated_user(
            {"sub": "user_locked", "email": "locked@example.com", "username": "locked"},
            sql_persistence_enabled=True,
            ensure_user_state_storage_ready_fn=lambda: None,
            session_scope=locked_session_scope,
            database_url="sqlite:////tmp/test.sqlite",
            touch_app_user_fn=lambda session, clerk_user_id, **kwargs: touched_users.append((session, clerk_user_id, kwargs)),
        )

        self.assertEqual(len(touched_users), 1)
        self.assertEqual(touched_users[0][1], "user_locked")

    def test_sync_authenticated_user_reraises_non_lock_operational_errors(self):
        @contextmanager
        def broken_session_scope(_database_url):
            yield object()
            raise sa.exc.OperationalError(
                "UPDATE app_users SET last_seen_at=? WHERE app_users.clerk_user_id = ?",
                {"clerk_user_id": "user_broken"},
                Exception("disk I/O error"),
            )

        with self.assertRaises(sa.exc.OperationalError):
            api_auth_helpers.sync_authenticated_user(
                {"sub": "user_broken"},
                sql_persistence_enabled=True,
                ensure_user_state_storage_ready_fn=lambda: None,
                session_scope=broken_session_scope,
                database_url="sqlite:////tmp/test.sqlite",
                touch_app_user_fn=lambda session, clerk_user_id, **kwargs: None,
            )


if __name__ == "__main__":
    unittest.main()
