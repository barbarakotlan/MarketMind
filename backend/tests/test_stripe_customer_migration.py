import importlib.util
import os
import sys
import unittest
from datetime import datetime, timezone

import sqlalchemy as sa


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


MODULE_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "alembic",
        "versions",
        "20260331_000005_secure_stripe_customer_ownership.py",
    )
)

spec = importlib.util.spec_from_file_location("secure_stripe_customer_ownership", MODULE_PATH)
secure_stripe_customer_ownership = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(secure_stripe_customer_ownership)


class StripeCustomerMigrationTests(unittest.TestCase):
    def setUp(self):
        self.engine = sa.create_engine("sqlite+pysqlite:///:memory:", future=True)
        self.metadata = sa.MetaData()
        self.app_users = sa.Table(
            "app_users",
            self.metadata,
            sa.Column("clerk_user_id", sa.Text(), primary_key=True),
            sa.Column("plan", sa.Text(), nullable=False),
            sa.Column("subscription_status", sa.Text(), nullable=True),
            sa.Column("stripe_customer_id", sa.Text(), nullable=True),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        )
        self.metadata.create_all(self.engine)

    def _rows(self):
        with self.engine.begin() as conn:
            return conn.execute(
                sa.select(
                    self.app_users.c.clerk_user_id,
                    self.app_users.c.plan,
                    self.app_users.c.subscription_status,
                    self.app_users.c.stripe_customer_id,
                ).order_by(self.app_users.c.clerk_user_id.asc())
            ).mappings().all()

    def test_deduplicate_prefers_single_paid_owner(self):
        with self.engine.begin() as conn:
            conn.execute(
                self.app_users.insert(),
                [
                    {
                        "clerk_user_id": "user_a",
                        "plan": "free",
                        "subscription_status": None,
                        "stripe_customer_id": "cus_shared",
                        "last_seen_at": datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
                    },
                    {
                        "clerk_user_id": "user_b",
                        "plan": "pro",
                        "subscription_status": "active",
                        "stripe_customer_id": "cus_shared",
                        "last_seen_at": datetime(2026, 3, 29, 12, 0, tzinfo=timezone.utc),
                    },
                ],
            )
            secure_stripe_customer_ownership.deduplicate_stripe_customer_owners(conn)

        rows = self._rows()
        self.assertEqual(rows[0]["stripe_customer_id"], None)
        self.assertEqual(rows[0]["plan"], "free")
        self.assertEqual(rows[0]["subscription_status"], None)
        self.assertEqual(rows[1]["stripe_customer_id"], "cus_shared")
        self.assertEqual(rows[1]["plan"], "pro")
        self.assertEqual(rows[1]["subscription_status"], "active")

    def test_deduplicate_prefers_most_recent_when_paid_ownership_is_ambiguous(self):
        with self.engine.begin() as conn:
            conn.execute(
                self.app_users.insert(),
                [
                    {
                        "clerk_user_id": "user_a",
                        "plan": "free",
                        "subscription_status": None,
                        "stripe_customer_id": "cus_shared",
                        "last_seen_at": datetime(2026, 3, 29, 12, 0, tzinfo=timezone.utc),
                    },
                    {
                        "clerk_user_id": "user_b",
                        "plan": "free",
                        "subscription_status": None,
                        "stripe_customer_id": "cus_shared",
                        "last_seen_at": datetime(2026, 3, 31, 12, 0, tzinfo=timezone.utc),
                    },
                ],
            )
            secure_stripe_customer_ownership.deduplicate_stripe_customer_owners(conn)

        rows = self._rows()
        self.assertEqual(rows[0]["stripe_customer_id"], None)
        self.assertEqual(rows[0]["plan"], "free")
        self.assertEqual(rows[1]["stripe_customer_id"], "cus_shared")


if __name__ == "__main__":
    unittest.main()
