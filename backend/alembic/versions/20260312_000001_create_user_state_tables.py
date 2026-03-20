"""create user state tables

Revision ID: 20260312_000001
Revises:
Create Date: 2026-03-12 00:00:01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260312_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("username", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id"),
    )

    op.create_table(
        "watchlist_items",
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id", "ticker"),
    )

    op.create_table(
        "alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("condition", sa.Text(), nullable=False),
        sa.Column("target_price", sa.Numeric(), nullable=True),
        sa.Column("alert_type", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_rules_clerk_user_id", "alert_rules", ["clerk_user_id"], unique=False)

    op.create_table(
        "triggered_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("alert_rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("seen", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_triggered_alerts_clerk_user_id", "triggered_alerts", ["clerk_user_id"], unique=False)

    op.create_table(
        "paper_portfolios",
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("cash", sa.Numeric(), nullable=False),
        sa.Column("starting_cash", sa.Numeric(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id"),
    )

    op.create_table(
        "paper_equity_positions",
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("ticker", sa.Text(), nullable=False),
        sa.Column("shares", sa.Numeric(), nullable=False),
        sa.Column("avg_cost", sa.Numeric(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id", "ticker"),
    )

    op.create_table(
        "paper_option_positions",
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("contract_symbol", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("avg_cost", sa.Numeric(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id", "contract_symbol"),
    )

    op.create_table(
        "paper_trade_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("asset_class", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(), nullable=False),
        sa.Column("price", sa.Numeric(), nullable=False),
        sa.Column("total", sa.Numeric(), nullable=False),
        sa.Column("profit", sa.Numeric(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_paper_trade_events_clerk_user_id", "paper_trade_events", ["clerk_user_id"], unique=False)

    op.create_table(
        "paper_portfolio_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("portfolio_value", sa.Numeric(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_paper_portfolio_snapshots_clerk_user_id",
        "paper_portfolio_snapshots",
        ["clerk_user_id"],
        unique=False,
    )

    op.create_table(
        "prediction_portfolios",
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("cash", sa.Numeric(), nullable=False),
        sa.Column("starting_cash", sa.Numeric(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id"),
    )

    op.create_table(
        "prediction_market_positions",
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("market_id", sa.Text(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("contracts", sa.Numeric(), nullable=False),
        sa.Column("avg_cost", sa.Numeric(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id", "market_id", "outcome"),
    )

    op.create_table(
        "prediction_market_trades",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.Text(), nullable=False),
        sa.Column("market_id", sa.Text(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("exchange", sa.Text(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("contracts", sa.Numeric(), nullable=False),
        sa.Column("price", sa.Numeric(), nullable=False),
        sa.Column("total", sa.Numeric(), nullable=False),
        sa.Column("profit", sa.Numeric(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_prediction_market_trades_clerk_user_id",
        "prediction_market_trades",
        ["clerk_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_prediction_market_trades_clerk_user_id", table_name="prediction_market_trades")
    op.drop_table("prediction_market_trades")
    op.drop_table("prediction_market_positions")
    op.drop_table("prediction_portfolios")
    op.drop_index("ix_paper_portfolio_snapshots_clerk_user_id", table_name="paper_portfolio_snapshots")
    op.drop_table("paper_portfolio_snapshots")
    op.drop_index("ix_paper_trade_events_clerk_user_id", table_name="paper_trade_events")
    op.drop_table("paper_trade_events")
    op.drop_table("paper_option_positions")
    op.drop_table("paper_equity_positions")
    op.drop_table("paper_portfolios")
    op.drop_index("ix_triggered_alerts_clerk_user_id", table_name="triggered_alerts")
    op.drop_table("triggered_alerts")
    op.drop_index("ix_alert_rules_clerk_user_id", table_name="alert_rules")
    op.drop_table("alert_rules")
    op.drop_table("watchlist_items")
    op.drop_table("app_users")
