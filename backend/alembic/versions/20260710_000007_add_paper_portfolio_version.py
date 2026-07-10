"""add optimistic versioning to paper portfolios

Revision ID: 20260710_000007
Revises: 20260702_000006
Create Date: 2026-07-10 00:00:07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260710_000007"
down_revision = "20260702_000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "paper_portfolios",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("paper_portfolios", "version")
