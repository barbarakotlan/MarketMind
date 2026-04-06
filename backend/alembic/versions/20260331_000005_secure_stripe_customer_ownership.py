"""secure stripe customer ownership

Revision ID: 20260331_000005
Revises: 20260330_000004
Create Date: 2026-03-31 00:00:05
"""
from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260331_000005"
down_revision = "20260330_000004"
branch_labels = None
depends_on = None

PAID_SUBSCRIPTION_STATUSES = {"active", "trialing", "past_due"}


def _is_paid_status(status: str | None) -> bool:
    return str(status or "").strip().lower() in PAID_SUBSCRIPTION_STATUSES


def _row_last_seen_at(row) -> datetime:
    value = row.get("last_seen_at")
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.min.replace(tzinfo=timezone.utc)


def choose_canonical_stripe_customer_owner(rows):
    paid_rows = [row for row in rows if _is_paid_status(row.get("subscription_status"))]
    if len(paid_rows) == 1:
        return paid_rows[0]

    return max(
        rows,
        key=lambda row: (
            _row_last_seen_at(row),
            str(row.get("clerk_user_id") or ""),
        ),
    )


def deduplicate_stripe_customer_owners(bind) -> None:
    app_users = sa.table(
        "app_users",
        sa.column("clerk_user_id", sa.Text()),
        sa.column("plan", sa.Text()),
        sa.column("subscription_status", sa.Text()),
        sa.column("stripe_customer_id", sa.Text()),
        sa.column("last_seen_at", sa.DateTime(timezone=True)),
    )

    rows = bind.execute(
        sa.select(
            app_users.c.clerk_user_id,
            app_users.c.plan,
            app_users.c.subscription_status,
            app_users.c.stripe_customer_id,
            app_users.c.last_seen_at,
        ).where(app_users.c.stripe_customer_id.is_not(None))
    ).mappings().all()

    grouped_rows = {}
    for row in rows:
        grouped_rows.setdefault(row["stripe_customer_id"], []).append(row)

    for stripe_customer_id, grouped in grouped_rows.items():
        if not stripe_customer_id or len(grouped) <= 1:
            continue

        keep = choose_canonical_stripe_customer_owner(grouped)
        for row in grouped:
            if row["clerk_user_id"] == keep["clerk_user_id"]:
                continue

            bind.execute(
                sa.update(app_users)
                .where(app_users.c.clerk_user_id == row["clerk_user_id"])
                .values(
                    stripe_customer_id=None,
                    plan="free",
                    subscription_status=None,
                )
            )


def upgrade() -> None:
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

    deduplicate_stripe_customer_owners(bind)

    with op.batch_alter_table("app_users") as batch_op:
        batch_op.create_unique_constraint(
            "uq_app_users_stripe_customer_id",
            ["stripe_customer_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("app_users") as batch_op:
        batch_op.drop_constraint("uq_app_users_stripe_customer_id", type_="unique")
