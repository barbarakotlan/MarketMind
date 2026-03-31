import contextlib
import os
import sys
import tempfile
import unittest
from types import SimpleNamespace


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api as backend_api
import checkout_endpoint
from user_state_store import AppUser, reset_runtime_state, session_scope, utcnow


class CheckoutSecurityTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_url = f"sqlite:///{os.path.join(self.tmpdir.name, 'checkout_security.db')}"

        self.original_state = {
            "DATABASE_URL": backend_api.DATABASE_URL,
            "PERSISTENCE_MODE": backend_api.PERSISTENCE_MODE,
            "verify_clerk_token": backend_api.verify_clerk_token,
            "checkout_get_database_url": checkout_endpoint._get_database_url,
            "checkout_configure_stripe": checkout_endpoint._configure_stripe,
            "checkout_get_price_ids": checkout_endpoint._get_price_ids,
            "stripe_customer_create": checkout_endpoint.stripe.Customer.create,
            "stripe_customer_retrieve": checkout_endpoint.stripe.Customer.retrieve,
            "stripe_subscription_create": checkout_endpoint.stripe.Subscription.create,
            "stripe_subscription_retrieve": checkout_endpoint.stripe.Subscription.retrieve,
            "stripe_subscription_modify": checkout_endpoint.stripe.Subscription.modify,
            "stripe_invoice_retrieve": checkout_endpoint.stripe.Invoice.retrieve,
            "session_scope": checkout_endpoint.session_scope,
        }

        reset_runtime_state()
        backend_api.DATABASE_URL = self.db_url
        backend_api.PERSISTENCE_MODE = "postgres"
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()

        backend_api.verify_clerk_token = lambda token: {
            "sub": token,
            "email": f"{token}@example.com",
        }
        checkout_endpoint._get_database_url = lambda: self.db_url
        checkout_endpoint._configure_stripe = lambda: None
        checkout_endpoint._get_price_ids = lambda: {
            "pro_monthly": "price_monthly",
            "pro_annual": "price_annual",
        }

        checkout_endpoint.stripe.Customer.create = lambda **kwargs: SimpleNamespace(id="cus_created", **kwargs)
        checkout_endpoint.stripe.Customer.retrieve = lambda customer_id: SimpleNamespace(id=customer_id)
        checkout_endpoint.stripe.Subscription.create = lambda **kwargs: SimpleNamespace(
            id="sub_created",
            latest_invoice=SimpleNamespace(id="in_created"),
            **kwargs,
        )
        checkout_endpoint.stripe.Subscription.retrieve = lambda subscription_id: SimpleNamespace(
            id=subscription_id,
            customer="cus_created",
        )
        checkout_endpoint.stripe.Subscription.modify = lambda subscription_id, **kwargs: SimpleNamespace(
            id=subscription_id,
            status="active",
            cancel_at_period_end=kwargs.get("cancel_at_period_end", False),
            current_period_end=1234567890,
        )
        checkout_endpoint.stripe.Invoice.retrieve = lambda invoice_id, expand=None: SimpleNamespace(
            id=invoice_id,
            confirmation_secret=SimpleNamespace(client_secret="cs_test"),
        )

        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

    def tearDown(self):
        backend_api.DATABASE_URL = self.original_state["DATABASE_URL"]
        backend_api.PERSISTENCE_MODE = self.original_state["PERSISTENCE_MODE"]
        backend_api.verify_clerk_token = self.original_state["verify_clerk_token"]
        checkout_endpoint._get_database_url = self.original_state["checkout_get_database_url"]
        checkout_endpoint._configure_stripe = self.original_state["checkout_configure_stripe"]
        checkout_endpoint._get_price_ids = self.original_state["checkout_get_price_ids"]
        checkout_endpoint.stripe.Customer.create = self.original_state["stripe_customer_create"]
        checkout_endpoint.stripe.Customer.retrieve = self.original_state["stripe_customer_retrieve"]
        checkout_endpoint.stripe.Subscription.create = self.original_state["stripe_subscription_create"]
        checkout_endpoint.stripe.Subscription.retrieve = self.original_state["stripe_subscription_retrieve"]
        checkout_endpoint.stripe.Subscription.modify = self.original_state["stripe_subscription_modify"]
        checkout_endpoint.stripe.Invoice.retrieve = self.original_state["stripe_invoice_retrieve"]
        checkout_endpoint.session_scope = self.original_state["session_scope"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _auth_headers(self, user_id="user_a"):
        return {"Authorization": f"Bearer {user_id}"}

    def _seed_user(self, clerk_user_id, *, email=None, stripe_customer_id=None, plan="free", subscription_status=None):
        with session_scope(self.db_url) as session:
            session.add(
                AppUser(
                    clerk_user_id=clerk_user_id,
                    email=email,
                    stripe_customer_id=stripe_customer_id,
                    plan=plan,
                    subscription_status=subscription_status,
                    created_at=utcnow(),
                    last_seen_at=utcnow(),
                )
            )

    def test_create_subscription_ignores_client_email_and_uses_verified_auth_email(self):
        created = {}
        checkout_endpoint.stripe.Customer.create = lambda **kwargs: created.update(kwargs) or SimpleNamespace(
            id="cus_auth",
            **kwargs,
        )

        response = self.client.post(
            "/checkout/create-subscription",
            headers=self._auth_headers("user_a"),
            json={"email": "attacker@example.com", "billing": "monthly"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(created["email"], "user_a@example.com")
        self.assertEqual(created["metadata"]["clerk_user_id"], "user_a")

        with session_scope(self.db_url) as session:
            self.assertEqual(session.get(AppUser, "user_a").stripe_customer_id, "cus_auth")

    def test_create_subscription_falls_back_to_stored_email_when_auth_payload_lacks_one(self):
        self._seed_user("user_b", email="stored@example.com")
        backend_api.verify_clerk_token = lambda token: {"sub": token}
        created = {}
        checkout_endpoint.stripe.Customer.create = lambda **kwargs: created.update(kwargs) or SimpleNamespace(
            id="cus_stored",
            **kwargs,
        )

        response = self.client.post(
            "/checkout/create-subscription",
            headers=self._auth_headers("user_b"),
            json={"email": "attacker@example.com", "billing": "monthly"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(created["email"], "stored@example.com")

    def test_create_subscription_replaces_stale_stored_customer_ids(self):
        self._seed_user("user_c", email="stored@example.com", stripe_customer_id="cus_stale")
        checkout_endpoint.stripe.Customer.retrieve = lambda _customer_id: (_ for _ in ()).throw(
            checkout_endpoint.stripe.error.InvalidRequestError("No such customer", "id")
        )
        created = {}
        checkout_endpoint.stripe.Customer.create = lambda **kwargs: created.update(kwargs) or SimpleNamespace(
            id="cus_fresh",
            **kwargs,
        )

        response = self.client.post(
            "/checkout/create-subscription",
            headers=self._auth_headers("user_c"),
            json={"billing": "annual"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(created["email"], "user_c@example.com")
        with session_scope(self.db_url) as session:
            self.assertEqual(session.get(AppUser, "user_c").stripe_customer_id, "cus_fresh")

    def test_cancel_subscription_rejects_foreign_subscription_customer(self):
        self._seed_user("user_d", email="user_d@example.com", stripe_customer_id="cus_owner")
        checkout_endpoint.stripe.Subscription.retrieve = lambda _subscription_id: SimpleNamespace(
            id="sub_foreign",
            customer="cus_other",
        )
        checkout_endpoint.stripe.Subscription.modify = lambda *_args, **_kwargs: self.fail(
            "Subscription.modify should not be called for foreign subscriptions"
        )

        response = self.client.post(
            "/checkout/cancel-subscription",
            headers=self._auth_headers("user_d"),
            json={"subscriptionId": "sub_foreign"},
        )

        self.assertEqual(response.status_code, 403)

    def test_cancel_subscription_requires_linked_customer(self):
        response = self.client.post(
            "/checkout/cancel-subscription",
            headers=self._auth_headers("user_e"),
            json={"subscriptionId": "sub_any"},
        )

        self.assertEqual(response.status_code, 409)

    def test_webhook_plan_updates_no_op_when_customer_ownership_is_ambiguous(self):
        users = [
            SimpleNamespace(plan="free", subscription_status=None),
            SimpleNamespace(plan="free", subscription_status=None),
        ]

        class _FakeScalarResult:
            def all(self):
                return users

        class _FakeSession:
            def scalars(self, _query):
                return _FakeScalarResult()

        @contextlib.contextmanager
        def fake_session_scope(_database_url):
            yield _FakeSession()

        checkout_endpoint.session_scope = fake_session_scope

        checkout_endpoint._set_user_plan("cus_dup", "pro", "active")

        self.assertEqual([user.plan for user in users], ["free", "free"])
        self.assertEqual([user.subscription_status for user in users], [None, None])


if __name__ == "__main__":
    unittest.main()
