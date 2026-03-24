"""add deliverables tables

Revision ID: 20260321_000002
Revises: 20260312_000001
Create Date: 2026-03-21 00:00:02
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260321_000002"
down_revision = "20260312_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deliverables",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("template_key", sa.Text(), nullable=False, server_default="investment_thesis_memo"),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("thesis_statement", sa.Text(), nullable=True),
        sa.Column("time_horizon", sa.Text(), nullable=True),
        sa.Column("bull_case", sa.Text(), nullable=True),
        sa.Column("bear_case", sa.Text(), nullable=True),
        sa.Column("invalidation_conditions", sa.Text(), nullable=True),
        sa.Column("catalysts", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="draft"),
        sa.Column("confidence", sa.Text(), nullable=True),
        sa.Column("memo_audience", sa.Text(), nullable=False, server_default="personal investment review"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deliverables_clerk_user_id", "deliverables", ["clerk_user_id"], unique=False)

    op.create_table(
        "deliverable_assumptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deliverable_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Text(), nullable=True),
        sa.Column("source_type", sa.Text(), nullable=False, server_default="user"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deliverable_assumptions_deliverable_id", "deliverable_assumptions", ["deliverable_id"], unique=False)

    op.create_table(
        "deliverable_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deliverable_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("review_type", sa.Text(), nullable=False, server_default="checkpoint"),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("what_changed", sa.Text(), nullable=True),
        sa.Column("outcome_rating", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deliverable_reviews_deliverable_id", "deliverable_reviews", ["deliverable_id"], unique=False)

    op.create_table(
        "deliverable_preflights",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deliverable_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("input_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("required_questions_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("assumptions_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("sources_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("blocking_reasons_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deliverable_preflights_deliverable_id", "deliverable_preflights", ["deliverable_id"], unique=False)

    op.create_table(
        "deliverable_memos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deliverable_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("model_slug", sa.Text(), nullable=False),
        sa.Column("generation_status", sa.Text(), nullable=False),
        sa.Column("prompt_snapshot_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("context_snapshot_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("structured_content_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("docx_blob", sa.LargeBinary(), nullable=True),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deliverable_memos_deliverable_id", "deliverable_memos", ["deliverable_id"], unique=False)

    op.create_table(
        "deliverable_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deliverable_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("link_type", sa.Text(), nullable=False),
        sa.Column("link_ref", sa.Text(), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deliverable_links_deliverable_id", "deliverable_links", ["deliverable_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_deliverable_links_deliverable_id", table_name="deliverable_links")
    op.drop_table("deliverable_links")
    op.drop_index("ix_deliverable_memos_deliverable_id", table_name="deliverable_memos")
    op.drop_table("deliverable_memos")
    op.drop_index("ix_deliverable_preflights_deliverable_id", table_name="deliverable_preflights")
    op.drop_table("deliverable_preflights")
    op.drop_index("ix_deliverable_reviews_deliverable_id", table_name="deliverable_reviews")
    op.drop_table("deliverable_reviews")
    op.drop_index("ix_deliverable_assumptions_deliverable_id", table_name="deliverable_assumptions")
    op.drop_table("deliverable_assumptions")
    op.drop_index("ix_deliverables_clerk_user_id", table_name="deliverables")
    op.drop_table("deliverables")
