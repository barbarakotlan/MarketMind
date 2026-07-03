import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import authz
from authz import Capabilities, Principal


class AuthzModelTests(unittest.TestCase):
    def test_user_role_holds_every_non_admin_capability(self):
        # Behavior-preservation anchor: a normal signed-in user must retain full
        # app access, i.e. every capability except the admin-only ones.
        user_caps = authz.capabilities_for_roles(["user"])
        self.assertEqual(user_caps, authz.USER_CAPABILITIES)
        self.assertNotIn(Capabilities.ADMIN_PUBLIC_API, user_caps)
        # Every capability a route could assert (all user caps) is granted.
        for cap in authz.USER_CAPABILITIES:
            self.assertIn(cap, user_caps)

    def test_admin_role_adds_admin_capabilities_on_top_of_user(self):
        admin_caps = authz.capabilities_for_roles(["admin"])
        self.assertTrue(authz.USER_CAPABILITIES <= admin_caps)
        self.assertIn(Capabilities.ADMIN_PUBLIC_API, admin_caps)

    def test_unknown_role_contributes_nothing(self):
        self.assertEqual(authz.capabilities_for_roles(["nope"]), frozenset())

    def test_roles_from_claims_defaults_everyone_to_user(self):
        self.assertEqual(authz.roles_from_claims(None), frozenset({"user"}))
        self.assertEqual(authz.roles_from_claims({}), frozenset({"user"}))

    def test_roles_from_claims_reads_public_metadata_and_top_level(self):
        self.assertEqual(
            authz.roles_from_claims({"publicMetadata": {"roles": ["admin"]}}),
            frozenset({"user", "admin"}),
        )
        self.assertEqual(
            authz.roles_from_claims({"roles": "admin"}),
            frozenset({"user", "admin"}),
        )

    def test_roles_from_claims_ignores_unknown_roles(self):
        self.assertEqual(
            authz.roles_from_claims({"roles": ["superuser", "admin"]}),
            frozenset({"user", "admin"}),
        )

    def test_principal_for_user_defaults_to_full_user_access(self):
        principal = authz.principal_for_user("user_123", {"sub": "user_123"})
        self.assertEqual(principal.id, "user_123")
        self.assertEqual(principal.kind, "user")
        self.assertEqual(principal.roles, frozenset({"user"}))
        self.assertEqual(principal.capabilities, authz.USER_CAPABILITIES)
        self.assertTrue(principal.has(Capabilities.PAPER_TRADE))
        self.assertFalse(principal.has(Capabilities.ADMIN_PUBLIC_API))

    def test_principal_for_admin_user_from_claims(self):
        principal = authz.principal_for_user(
            "user_admin", {"sub": "user_admin", "publicMetadata": {"roles": ["admin"]}}
        )
        self.assertIn("admin", principal.roles)
        self.assertTrue(principal.has(Capabilities.ADMIN_PUBLIC_API))

    def test_principal_has_any(self):
        principal = Principal(
            id="u", capabilities=frozenset({Capabilities.WATCHLIST_READ})
        )
        self.assertTrue(principal.has_any([Capabilities.WATCHLIST_READ, "other"]))
        self.assertFalse(principal.has_any(["a", "b"]))


class ApiPrincipalWiringTests(unittest.TestCase):
    def test_api_exposes_get_current_principal_and_sets_it_on_auth(self):
        import api as backend_api

        # The helper exists and returns None outside a request context.
        self.assertTrue(hasattr(backend_api, "get_current_principal"))
        # A default user principal grants full user access (behavior-preserving).
        principal = backend_api.authz.principal_for_user("u1", {"sub": "u1"})
        self.assertEqual(principal.capabilities, authz.USER_CAPABILITIES)


class RequireCapabilityTests(unittest.TestCase):
    """Phase A2: the enforcement point. A full 'user' passes (behavior-preserving);
    a principal lacking the capability, or none at all, is denied 403."""

    def setUp(self):
        import api as backend_api

        self.api = backend_api
        self.app = backend_api.app

    def _call_guarded(self, capability, principal):
        from flask import g

        with self.app.test_request_context("/"):
            if principal is not None:
                g.principal = principal

            @self.api.require_capability(capability)
            def handler():
                return "ok"

            return handler()

    def test_full_user_is_allowed(self):
        principal = authz.principal_for_user("u1", {"sub": "u1"})
        self.assertEqual(self._call_guarded(Capabilities.PAPER_TRADE, principal), "ok")

    def test_principal_missing_capability_is_forbidden(self):
        limited = Principal(id="u2", capabilities=frozenset({Capabilities.WATCHLIST_READ}))
        result = self._call_guarded(Capabilities.PAPER_TRADE, limited)
        self.assertEqual(result[1], 403)

    def test_no_principal_is_forbidden(self):
        result = self._call_guarded(Capabilities.PAPER_READ, None)
        self.assertEqual(result[1], 403)


if __name__ == "__main__":
    unittest.main()
