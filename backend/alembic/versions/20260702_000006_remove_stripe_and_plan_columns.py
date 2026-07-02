"""remove stripe and plan columns from app_users

Drops the Stripe/subscription tier columns (plan, subscription_status,
stripe_customer_id) and their unique constraint. Stripe billing and the
Free/Pro tier system were removed from the application.

Revision ID: 20260702_000006
Revises: 20260331_000005
Create Date: 2026-07-02 00:00:06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260702_000006"
down_revision = "20260331_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("app_users")}
    existing_constraints = {
        constraint["name"] for constraint in inspector.get_unique_constraints("app_users")
    }

    with op.batch_alter_table("app_users") as batch_op:
        if "uq_app_users_stripe_customer_id" in existing_constraints:
            batch_op.drop_constraint(
                "uq_app_users_stripe_customer_id", type_="unique"
            )
        if "stripe_customer_id" in existing_columns:
            batch_op.drop_column("stripe_customer_id")
        if "subscription_status" in existing_columns:
            batch_op.drop_column("subscription_status")
        if "plan" in existing_columns:
            batch_op.drop_column("plan")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("app_users")}

    if "plan" not in existing_columns:
        op.add_column(
            "app_users",
            sa.Column("plan", sa.Text(), nullable=False, server_default="free"),
        )
    if "subscription_status" not in existing_columns:
        op.add_column(
            "app_users",
            sa.Column("subscription_status", sa.Text(), nullable=True),
        )
    if "stripe_customer_id" not in existing_columns:
        op.add_column(
            "app_users",
            sa.Column("stripe_customer_id", sa.Text(), nullable=True),
        )

    with op.batch_alter_table("app_users") as batch_op:
        batch_op.create_unique_constraint(
            "uq_app_users_stripe_customer_id",
            ["stripe_customer_id"],
        )
