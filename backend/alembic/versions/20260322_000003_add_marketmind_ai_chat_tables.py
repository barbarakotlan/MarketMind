"""add marketmind ai chat tables

Revision ID: 20260322_000003
Revises: 20260321_000002
Create Date: 2026-03-22 00:00:03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260322_000003"
down_revision = "20260321_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marketmind_ai_chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("attached_ticker", sa.Text(), nullable=True),
        sa.Column("last_message_preview", sa.Text(), nullable=True),
        sa.Column("latest_artifact_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_marketmind_ai_chats_clerk_user_id", "marketmind_ai_chats", ["clerk_user_id"], unique=False)

    op.create_table(
        "marketmind_ai_chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_marketmind_ai_chat_messages_chat_id", "marketmind_ai_chat_messages", ["chat_id"], unique=False)
    op.create_index("ix_marketmind_ai_chat_messages_clerk_user_id", "marketmind_ai_chat_messages", ["clerk_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_marketmind_ai_chat_messages_clerk_user_id", table_name="marketmind_ai_chat_messages")
    op.drop_index("ix_marketmind_ai_chat_messages_chat_id", table_name="marketmind_ai_chat_messages")
    op.drop_table("marketmind_ai_chat_messages")
    op.drop_index("ix_marketmind_ai_chats_clerk_user_id", table_name="marketmind_ai_chats")
    op.drop_table("marketmind_ai_chats")
