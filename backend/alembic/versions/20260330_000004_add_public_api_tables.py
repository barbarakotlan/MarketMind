"""add public api tables

Revision ID: 20260330_000004
Revises: 20260322_000003
Create Date: 2026-03-30 00:00:04
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260330_000004"
down_revision = "20260322_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "public_api_clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("contact_email", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "public_api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key_prefix", sa.String(length=64), nullable=False),
        sa.Column("key_hash", sa.String(length=128), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["public_api_clients.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_prefix"),
    )
    op.create_index("ix_public_api_keys_client_id", "public_api_keys", ["client_id"], unique=False)

    op.create_table(
        "public_api_daily_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("api_key_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("route_group", sa.Text(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cached_request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["api_key_id"], ["public_api_keys.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["public_api_clients.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("api_key_id", "day", "route_group", name="uq_public_api_daily_usage_key_day_route"),
    )
    op.create_index("ix_public_api_daily_usage_api_key_id", "public_api_daily_usage", ["api_key_id"], unique=False)
    op.create_index("ix_public_api_daily_usage_client_id", "public_api_daily_usage", ["client_id"], unique=False)
    op.create_index("ix_public_api_daily_usage_day", "public_api_daily_usage", ["day"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_public_api_daily_usage_day", table_name="public_api_daily_usage")
    op.drop_index("ix_public_api_daily_usage_client_id", table_name="public_api_daily_usage")
    op.drop_index("ix_public_api_daily_usage_api_key_id", table_name="public_api_daily_usage")
    op.drop_table("public_api_daily_usage")
    op.drop_index("ix_public_api_keys_client_id", table_name="public_api_keys")
    op.drop_table("public_api_keys")
    op.drop_table("public_api_clients")
