from __future__ import annotations

import base64
import json
import os
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, Iterator, List, Optional

from sqlalchemy import (
    Date,
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    create_engine,
    delete,
    event,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


JSON_VARIANT = JSON().with_variant(JSONB(), "postgresql")
SNAPSHOT_ID_TYPE = BigInteger().with_variant(Integer(), "sqlite")


class Base(DeclarativeBase):
    pass


class AppUser(Base):
    __tablename__ = "app_users"
    __table_args__ = (
        UniqueConstraint("stripe_customer_id", name="uq_app_users_stripe_customer_id"),
    )

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Subscription fields
    plan: Mapped[str] = mapped_column(Text, nullable=False, default="free", server_default="free")
    subscription_status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    condition: Mapped[str] = mapped_column(Text, nullable=False)
    target_price: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    alert_type: Mapped[str] = mapped_column(Text, nullable=False, default="price")
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class TriggeredAlert(Base):
    __tablename__ = "triggered_alerts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    alert_rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    seen: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON_VARIANT, nullable=False, default=dict)


class PaperPortfolio(Base):
    __tablename__ = "paper_portfolios"

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    cash: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    starting_cash: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PaperEquityPosition(Base):
    __tablename__ = "paper_equity_positions"

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, primary_key=True)
    shares: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    avg_cost: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PaperOptionPosition(Base):
    __tablename__ = "paper_option_positions"

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    contract_symbol: Mapped[str] = mapped_column(Text, primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_cost: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PaperTradeEvent(Base):
    __tablename__ = "paper_trade_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    asset_class: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    profit: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON_VARIANT, nullable=False, default=dict)


class PaperPortfolioSnapshot(Base):
    __tablename__ = "paper_portfolio_snapshots"

    id: Mapped[int] = mapped_column(SNAPSHOT_ID_TYPE, primary_key=True, autoincrement=True)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    portfolio_value: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PredictionPortfolio(Base):
    __tablename__ = "prediction_portfolios"

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    cash: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    starting_cash: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PredictionMarketPosition(Base):
    __tablename__ = "prediction_market_positions"

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    market_id: Mapped[str] = mapped_column(Text, primary_key=True)
    outcome: Mapped[str] = mapped_column(Text, primary_key=True)
    exchange: Mapped[str] = mapped_column(Text, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    contracts: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    avg_cost: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PredictionMarketTrade(Base):
    __tablename__ = "prediction_market_trades"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    market_id: Mapped[str] = mapped_column(Text, nullable=False)
    outcome: Mapped[str] = mapped_column(Text, nullable=False)
    exchange: Mapped[str] = mapped_column(Text, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    contracts: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    profit: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Deliverable(Base):
    __tablename__ = "deliverables"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    template_key: Mapped[str] = mapped_column(Text, nullable=False, default="investment_thesis_memo")
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    thesis_statement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    time_horizon: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bull_case: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bear_case: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    invalidation_conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    catalysts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    confidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    memo_audience: Mapped[str] = mapped_column(Text, nullable=False, default="personal investment review")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class DeliverableAssumption(Base):
    __tablename__ = "deliverable_assumptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    deliverable_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(Text, nullable=False, default="user")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DeliverableReview(Base):
    __tablename__ = "deliverable_reviews"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    deliverable_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    review_type: Mapped[str] = mapped_column(Text, nullable=False, default="checkpoint")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    what_changed: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    outcome_rating: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DeliverablePreflight(Base):
    __tablename__ = "deliverable_preflights"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    deliverable_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    input_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    required_questions_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSON_VARIANT, nullable=False, default=list)
    assumptions_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSON_VARIANT, nullable=False, default=list)
    sources_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSON_VARIANT, nullable=False, default=list)
    blocking_reasons_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSON_VARIANT, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DeliverableMemo(Base):
    __tablename__ = "deliverable_memos"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    deliverable_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    model_slug: Mapped[str] = mapped_column(Text, nullable=False)
    generation_status: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_snapshot_json: Mapped[Dict[str, Any]] = mapped_column(JSON_VARIANT, nullable=False, default=dict)
    context_snapshot_json: Mapped[Dict[str, Any]] = mapped_column(JSON_VARIANT, nullable=False, default=dict)
    structured_content_json: Mapped[Dict[str, Any]] = mapped_column(JSON_VARIANT, nullable=False, default=dict)
    docx_blob: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class DeliverableLink(Base):
    __tablename__ = "deliverable_links"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    deliverable_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    link_type: Mapped[str] = mapped_column(Text, nullable=False)
    link_ref: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON_VARIANT, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class MarketMindAiChat(Base):
    __tablename__ = "marketmind_ai_chats"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    attached_ticker: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_message_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latest_artifact_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class MarketMindAiChatMessage(Base):
    __tablename__ = "marketmind_ai_chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    clerk_user_id: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PublicApiClient(Base):
    __tablename__ = "public_api_clients"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PublicApiKey(Base):
    __tablename__ = "public_api_keys"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("public_api_clients.id"), index=True, nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    label: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class PublicApiDailyUsage(Base):
    __tablename__ = "public_api_daily_usage"
    __table_args__ = (
        UniqueConstraint("api_key_id", "day", "route_group", name="uq_public_api_daily_usage_key_day_route"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("public_api_clients.id"), index=True, nullable=False)
    api_key_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("public_api_keys.id"), index=True, nullable=False)
    day: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    route_group: Mapped[str] = mapped_column(Text, nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cached_request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


_ENGINES: Dict[str, Any] = {}
_SESSION_FACTORIES: Dict[str, sessionmaker[Session]] = {}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_database_url(database_url: str) -> str:
    return str(database_url or "").strip()


def _should_auto_create_schema(database_url: str) -> bool:
    if database_url.startswith("sqlite"):
        return True
    return os.getenv("MARKETMIND_AUTO_CREATE_SCHEMA", "false").strip().lower() == "true"


def _is_sqlite_url(database_url: str) -> bool:
    return _normalize_database_url(database_url).startswith("sqlite")


def _configure_sqlite_connection(dbapi_connection: Any) -> None:
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA journal_mode=WAL")
    finally:
        cursor.close()


def ensure_database_ready(database_url: str) -> None:
    url = _normalize_database_url(database_url)
    if not url:
        raise ValueError("DATABASE_URL is required for SQL persistence modes")

    if url in _SESSION_FACTORIES:
        return

    engine_kwargs: Dict[str, Any] = {"future": True}
    if _is_sqlite_url(url):
        engine_kwargs["connect_args"] = {
            "check_same_thread": False,
            "timeout": 30,
        }

    engine = create_engine(url, **engine_kwargs)
    if _is_sqlite_url(url):
        event.listen(
            engine,
            "connect",
            lambda dbapi_connection, _connection_record: _configure_sqlite_connection(dbapi_connection),
        )

    if _should_auto_create_schema(url):
        Base.metadata.create_all(engine)

    _ENGINES[url] = engine
    _SESSION_FACTORIES[url] = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def reset_runtime_state() -> None:
    for engine in _ENGINES.values():
        engine.dispose()
    _ENGINES.clear()
    _SESSION_FACTORIES.clear()


def get_session_factory(database_url: str) -> sessionmaker[Session]:
    ensure_database_ready(database_url)
    return _SESSION_FACTORIES[_normalize_database_url(database_url)]


@contextmanager
def session_scope(database_url: str) -> Iterator[Session]:
    session = get_session_factory(database_url)()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _coerce_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return utcnow()


def _coerce_uuid(value: Any) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return uuid.uuid5(uuid.NAMESPACE_URL, f"marketmind:{value}")


def _coerce_scoped_uuid(scope: str, value: Any) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return uuid.uuid5(uuid.NAMESPACE_URL, f"marketmind:{scope}:{value}")


def _as_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    return float(value)


def _dedupe_upper(values: Iterable[Any]) -> List[str]:
    return sorted({str(v).upper() for v in values if str(v).strip()})


def touch_app_user(
    session: Session,
    clerk_user_id: str,
    *,
    email: Optional[str] = None,
    username: Optional[str] = None,
    created_at: Optional[datetime] = None,
) -> AppUser:
    user = session.get(AppUser, clerk_user_id)
    now = utcnow()
    if user is None:
        user = AppUser(
            clerk_user_id=clerk_user_id,
            email=email,
            username=username,
            created_at=created_at or now,
            last_seen_at=now,
        )
        session.add(user)
    else:
        if email:
            user.email = email
        if username:
            user.username = username
        user.last_seen_at = now
    return user


def list_app_user_ids(session: Session) -> List[str]:
    return list(
        session.scalars(
            select(AppUser.clerk_user_id).order_by(AppUser.clerk_user_id.asc())
        ).all()
    )


def load_watchlist(session: Session, clerk_user_id: str) -> List[str]:
    items = session.scalars(
        select(WatchlistItem.ticker)
        .where(WatchlistItem.clerk_user_id == clerk_user_id)
        .order_by(WatchlistItem.ticker.asc())
    ).all()
    return list(items)


def save_watchlist(session: Session, clerk_user_id: str, tickers: Iterable[Any]) -> List[str]:
    normalized = _dedupe_upper(tickers)
    touch_app_user(session, clerk_user_id)
    session.execute(delete(WatchlistItem).where(WatchlistItem.clerk_user_id == clerk_user_id))
    session.flush()
    now = utcnow()
    for ticker in normalized:
        session.add(WatchlistItem(clerk_user_id=clerk_user_id, ticker=ticker, created_at=now))
    return normalized


def load_notifications(session: Session, clerk_user_id: str) -> Dict[str, List[Dict[str, Any]]]:
    touch_app_user(session, clerk_user_id)
    active_rows = session.scalars(
        select(AlertRule)
        .where(AlertRule.clerk_user_id == clerk_user_id)
        .order_by(AlertRule.created_at.asc())
    ).all()
    triggered_rows = session.scalars(
        select(TriggeredAlert)
        .where(TriggeredAlert.clerk_user_id == clerk_user_id)
        .order_by(TriggeredAlert.triggered_at.asc())
    ).all()

    active = []
    for row in active_rows:
        payload = {
            "id": str(row.id),
            "ticker": row.ticker,
            "condition": row.condition,
            "target_price": _as_float(row.target_price),
            "created_at": row.created_at.isoformat(),
        }
        if row.alert_type:
            payload["type"] = row.alert_type
        if row.prompt:
            payload["prompt"] = row.prompt
        if row.is_active is not None:
            payload["active"] = row.is_active
        active.append(payload)

    triggered = []
    for row in triggered_rows:
        payload = dict(row.payload or {})
        payload["id"] = str(row.id)
        payload["message"] = row.message
        payload["seen"] = row.seen
        payload["timestamp"] = row.triggered_at.isoformat()
        if row.alert_rule_id:
            payload["alert_rule_id"] = str(row.alert_rule_id)
        triggered.append(payload)

    return {"active": active, "triggered": triggered}


def save_notifications(
    session: Session,
    clerk_user_id: str,
    notifications: Dict[str, Any],
) -> Dict[str, List[Dict[str, Any]]]:
    touch_app_user(session, clerk_user_id)
    session.execute(delete(AlertRule).where(AlertRule.clerk_user_id == clerk_user_id))
    session.execute(delete(TriggeredAlert).where(TriggeredAlert.clerk_user_id == clerk_user_id))
    session.flush()

    active = notifications.get("active", []) or []
    triggered = notifications.get("triggered", []) or []

    for alert in active:
        alert_id = _coerce_scoped_uuid(f"alert_rule:{clerk_user_id}", alert.get("id") or uuid.uuid4())
        session.add(
            AlertRule(
                id=alert_id,
                clerk_user_id=clerk_user_id,
                ticker=str(alert.get("ticker", "")).upper(),
                condition=str(alert.get("condition", "")),
                target_price=alert.get("target_price"),
                alert_type=str(alert.get("type") or alert.get("alert_type") or "price"),
                prompt=alert.get("prompt"),
                is_active=bool(alert.get("active", True)),
                created_at=_coerce_datetime(alert.get("created_at")),
            )
        )

    for alert in triggered:
        alert_id = _coerce_scoped_uuid(
            f"triggered_alert:{clerk_user_id}",
            alert.get("id") or uuid.uuid4(),
        )
        alert_rule_id = alert.get("alert_rule_id")
        payload = dict(alert)
        session.add(
            TriggeredAlert(
                id=alert_id,
                clerk_user_id=clerk_user_id,
                alert_rule_id=(
                    _coerce_scoped_uuid(f"alert_rule:{clerk_user_id}", alert_rule_id)
                    if alert_rule_id
                    else None
                ),
                message=str(alert.get("message", "")),
                seen=bool(alert.get("seen", False)),
                triggered_at=_coerce_datetime(alert.get("timestamp") or alert.get("triggered_at")),
                payload=payload,
            )
        )

    return load_notifications(session, clerk_user_id)


def _trade_event_to_dict(row: PaperTradeEvent) -> Dict[str, Any]:
    raw = dict((row.metadata_json or {}).get("raw") or {})
    if raw:
        raw.setdefault("timestamp", row.occurred_at.isoformat())
        return raw

    payload = {
        "type": row.action,
        "ticker": row.symbol,
        "shares": _as_float(row.quantity),
        "price": _as_float(row.price),
        "total": _as_float(row.total),
        "timestamp": row.occurred_at.isoformat(),
    }
    if row.profit is not None:
        payload["profit"] = _as_float(row.profit)
    return payload


def load_portfolio(session: Session, clerk_user_id: str) -> Dict[str, Any]:
    touch_app_user(session, clerk_user_id)
    portfolio = session.get(PaperPortfolio, clerk_user_id)
    positions = session.scalars(
        select(PaperEquityPosition)
        .where(PaperEquityPosition.clerk_user_id == clerk_user_id)
        .order_by(PaperEquityPosition.ticker.asc())
    ).all()
    option_positions = session.scalars(
        select(PaperOptionPosition)
        .where(PaperOptionPosition.clerk_user_id == clerk_user_id)
        .order_by(PaperOptionPosition.contract_symbol.asc())
    ).all()
    trade_rows = session.scalars(
        select(PaperTradeEvent)
        .where(PaperTradeEvent.clerk_user_id == clerk_user_id)
        .order_by(PaperTradeEvent.occurred_at.asc())
    ).all()

    trade_history = [_trade_event_to_dict(row) for row in trade_rows]
    transactions = []
    for row in trade_rows:
        if row.asset_class != "equity" or row.action not in {"BUY", "SELL"}:
            continue
        transactions.append(
            {
                "date": row.occurred_at.strftime("%Y-%m-%d"),
                "type": row.action,
                "ticker": row.symbol,
                "shares": _as_float(row.quantity),
                "price": _as_float(row.price),
                "total": _as_float(row.total),
            }
        )

    return {
        "cash": _as_float(portfolio.cash) if portfolio else 100000.0,
        "starting_cash": _as_float(portfolio.starting_cash) if portfolio else 100000.0,
        "positions": {
            row.ticker: {"shares": _as_float(row.shares), "avg_cost": _as_float(row.avg_cost)}
            for row in positions
        },
        "options_positions": {
            row.contract_symbol: {"quantity": row.quantity, "avg_cost": _as_float(row.avg_cost)}
            for row in option_positions
        },
        "transactions": transactions,
        "trade_history": trade_history,
    }


def save_portfolio(session: Session, clerk_user_id: str, portfolio: Dict[str, Any]) -> Dict[str, Any]:
    touch_app_user(session, clerk_user_id)
    row = session.get(PaperPortfolio, clerk_user_id)
    now = utcnow()
    if row is None:
        row = PaperPortfolio(
            clerk_user_id=clerk_user_id,
            cash=portfolio.get("cash", 100000.0),
            starting_cash=portfolio.get("starting_cash", 100000.0),
            updated_at=now,
        )
        session.add(row)
    else:
        row.cash = portfolio.get("cash", 100000.0)
        row.starting_cash = portfolio.get("starting_cash", 100000.0)
        row.updated_at = now

    session.execute(delete(PaperEquityPosition).where(PaperEquityPosition.clerk_user_id == clerk_user_id))
    session.execute(delete(PaperOptionPosition).where(PaperOptionPosition.clerk_user_id == clerk_user_id))
    session.execute(delete(PaperTradeEvent).where(PaperTradeEvent.clerk_user_id == clerk_user_id))
    session.flush()

    for ticker, pos in (portfolio.get("positions", {}) or {}).items():
        session.add(
            PaperEquityPosition(
                clerk_user_id=clerk_user_id,
                ticker=str(ticker).upper(),
                shares=pos.get("shares", 0),
                avg_cost=pos.get("avg_cost", 0),
                updated_at=now,
            )
        )

    for contract_symbol, pos in (portfolio.get("options_positions", {}) or {}).items():
        session.add(
            PaperOptionPosition(
                clerk_user_id=clerk_user_id,
                contract_symbol=str(contract_symbol),
                quantity=int(pos.get("quantity", 0)),
                avg_cost=pos.get("avg_cost", 0),
                updated_at=now,
            )
        )

    for event in (portfolio.get("trade_history", []) or []):
        action = str(event.get("type", ""))
        asset_class = "option" if "OPTION" in action else "equity"
        session.add(
            PaperTradeEvent(
                id=_coerce_scoped_uuid(f"paper_trade:{clerk_user_id}", event.get("id") or uuid.uuid4()),
                clerk_user_id=clerk_user_id,
                asset_class=asset_class,
                action=action,
                symbol=str(event.get("ticker", "")),
                quantity=event.get("shares", 0),
                price=event.get("price", 0),
                total=event.get("total", 0),
                profit=event.get("profit"),
                occurred_at=_coerce_datetime(event.get("timestamp")),
                metadata_json={"raw": dict(event)},
            )
        )

    return load_portfolio(session, clerk_user_id)


def record_portfolio_snapshot(
    session: Session,
    clerk_user_id: str,
    portfolio_data: Dict[str, Any],
    *,
    recorded_at: Optional[datetime] = None,
) -> None:
    total_value = float(portfolio_data.get("cash", 0))
    for pos in (portfolio_data.get("positions", {}) or {}).values():
        total_value += float(pos.get("shares", 0)) * float(pos.get("avg_cost", 0))
    for pos in (portfolio_data.get("options_positions", {}) or {}).values():
        total_value += float(pos.get("quantity", 0)) * float(pos.get("avg_cost", 0)) * 100

    session.add(
        PaperPortfolioSnapshot(
            clerk_user_id=clerk_user_id,
            portfolio_value=total_value,
            recorded_at=_coerce_datetime(recorded_at) if recorded_at else utcnow(),
        )
    )


def load_prediction_portfolio(session: Session, clerk_user_id: str) -> Dict[str, Any]:
    touch_app_user(session, clerk_user_id)
    portfolio = session.get(PredictionPortfolio, clerk_user_id)
    positions = session.scalars(
        select(PredictionMarketPosition)
        .where(PredictionMarketPosition.clerk_user_id == clerk_user_id)
        .order_by(PredictionMarketPosition.market_id.asc(), PredictionMarketPosition.outcome.asc())
    ).all()
    trades = session.scalars(
        select(PredictionMarketTrade)
        .where(PredictionMarketTrade.clerk_user_id == clerk_user_id)
        .order_by(PredictionMarketTrade.occurred_at.asc())
    ).all()

    return {
        "cash": _as_float(portfolio.cash) if portfolio else 10000.0,
        "starting_cash": _as_float(portfolio.starting_cash) if portfolio else 10000.0,
        "positions": {
            f"{row.market_id}::{row.outcome}": {
                "market_id": row.market_id,
                "outcome": row.outcome,
                "exchange": row.exchange,
                "question": row.question,
                "contracts": _as_float(row.contracts),
                "avg_cost": _as_float(row.avg_cost),
            }
            for row in positions
        },
        "trade_history": [
            {
                "id": str(row.id),
                "type": row.action,
                "market_id": row.market_id,
                "question": row.question,
                "outcome": row.outcome,
                "contracts": _as_float(row.contracts),
                "price": _as_float(row.price),
                "total": _as_float(row.total),
                "timestamp": row.occurred_at.isoformat(),
                **({"profit": _as_float(row.profit)} if row.profit is not None else {}),
            }
            for row in trades
        ],
    }


def save_prediction_portfolio(
    session: Session,
    clerk_user_id: str,
    portfolio: Dict[str, Any],
) -> Dict[str, Any]:
    touch_app_user(session, clerk_user_id)
    row = session.get(PredictionPortfolio, clerk_user_id)
    now = utcnow()
    if row is None:
        row = PredictionPortfolio(
            clerk_user_id=clerk_user_id,
            cash=portfolio.get("cash", 10000.0),
            starting_cash=portfolio.get("starting_cash", 10000.0),
            updated_at=now,
        )
        session.add(row)
    else:
        row.cash = portfolio.get("cash", 10000.0)
        row.starting_cash = portfolio.get("starting_cash", 10000.0)
        row.updated_at = now

    session.execute(
        delete(PredictionMarketPosition).where(PredictionMarketPosition.clerk_user_id == clerk_user_id)
    )
    session.execute(
        delete(PredictionMarketTrade).where(PredictionMarketTrade.clerk_user_id == clerk_user_id)
    )
    session.flush()

    for pos in (portfolio.get("positions", {}) or {}).values():
        session.add(
            PredictionMarketPosition(
                clerk_user_id=clerk_user_id,
                market_id=str(pos.get("market_id", "")),
                outcome=str(pos.get("outcome", "")),
                exchange=str(pos.get("exchange", "polymarket")),
                question=str(pos.get("question", "Unknown Market")),
                contracts=pos.get("contracts", 0),
                avg_cost=pos.get("avg_cost", 0),
                updated_at=now,
            )
        )

    for trade in (portfolio.get("trade_history", []) or []):
        session.add(
            PredictionMarketTrade(
                id=_coerce_scoped_uuid(
                    f"prediction_trade:{clerk_user_id}",
                    trade.get("id") or uuid.uuid4(),
                ),
                clerk_user_id=clerk_user_id,
                market_id=str(trade.get("market_id", "")),
                outcome=str(trade.get("outcome", "")),
                exchange=str(trade.get("exchange", "polymarket")),
                question=str(trade.get("question", "")),
                action=str(trade.get("type", "")),
                contracts=trade.get("contracts", 0),
                price=trade.get("price", 0),
                total=trade.get("total", 0),
                profit=trade.get("profit"),
                occurred_at=_coerce_datetime(trade.get("timestamp")),
            )
        )

    return load_prediction_portfolio(session, clerk_user_id)


def import_portfolio_snapshots_from_legacy_sqlite(
    session: Session,
    clerk_user_id: str,
    legacy_sqlite_path: str,
) -> int:
    if not legacy_sqlite_path or not os.path.exists(legacy_sqlite_path):
        return 0

    import sqlite3

    conn = sqlite3.connect(legacy_sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.execute(
            "SELECT timestamp, portfolio_value FROM portfolio_history WHERE user_id = ? ORDER BY timestamp ASC",
            (clerk_user_id,),
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    session.execute(
        delete(PaperPortfolioSnapshot).where(PaperPortfolioSnapshot.clerk_user_id == clerk_user_id)
    )
    for row in rows:
        session.add(
            PaperPortfolioSnapshot(
                clerk_user_id=clerk_user_id,
                portfolio_value=row["portfolio_value"],
                recorded_at=_coerce_datetime(row["timestamp"]),
            )
        )
    return len(rows)


def _serialize_datetime(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return _coerce_datetime(value).isoformat()


def _serialize_binary(value: Optional[bytes]) -> Optional[str]:
    if value is None:
        return None
    return base64.b64encode(value).decode("ascii")


def _deserialize_binary(value: Any) -> Optional[bytes]:
    if not value:
        return None
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    try:
        return base64.b64decode(str(value))
    except Exception:
        return None


def export_user_state(session: Session, clerk_user_id: str) -> Dict[str, Any]:
    app_user = session.get(AppUser, clerk_user_id)
    watchlist_items = session.scalars(
        select(WatchlistItem)
        .where(WatchlistItem.clerk_user_id == clerk_user_id)
        .order_by(WatchlistItem.ticker.asc())
    ).all()
    alert_rules = session.scalars(
        select(AlertRule)
        .where(AlertRule.clerk_user_id == clerk_user_id)
        .order_by(AlertRule.created_at.asc(), AlertRule.id.asc())
    ).all()
    triggered_alerts = session.scalars(
        select(TriggeredAlert)
        .where(TriggeredAlert.clerk_user_id == clerk_user_id)
        .order_by(TriggeredAlert.triggered_at.asc(), TriggeredAlert.id.asc())
    ).all()
    paper_portfolio = session.get(PaperPortfolio, clerk_user_id)
    paper_equity_positions = session.scalars(
        select(PaperEquityPosition)
        .where(PaperEquityPosition.clerk_user_id == clerk_user_id)
        .order_by(PaperEquityPosition.ticker.asc())
    ).all()
    paper_option_positions = session.scalars(
        select(PaperOptionPosition)
        .where(PaperOptionPosition.clerk_user_id == clerk_user_id)
        .order_by(PaperOptionPosition.contract_symbol.asc())
    ).all()
    paper_trade_events = session.scalars(
        select(PaperTradeEvent)
        .where(PaperTradeEvent.clerk_user_id == clerk_user_id)
        .order_by(PaperTradeEvent.occurred_at.asc(), PaperTradeEvent.id.asc())
    ).all()
    paper_snapshots = session.scalars(
        select(PaperPortfolioSnapshot)
        .where(PaperPortfolioSnapshot.clerk_user_id == clerk_user_id)
        .order_by(PaperPortfolioSnapshot.recorded_at.asc(), PaperPortfolioSnapshot.id.asc())
    ).all()
    prediction_portfolio = session.get(PredictionPortfolio, clerk_user_id)
    prediction_positions = session.scalars(
        select(PredictionMarketPosition)
        .where(PredictionMarketPosition.clerk_user_id == clerk_user_id)
        .order_by(PredictionMarketPosition.market_id.asc(), PredictionMarketPosition.outcome.asc())
    ).all()
    prediction_trades = session.scalars(
        select(PredictionMarketTrade)
        .where(PredictionMarketTrade.clerk_user_id == clerk_user_id)
        .order_by(PredictionMarketTrade.occurred_at.asc(), PredictionMarketTrade.id.asc())
    ).all()
    deliverables = session.scalars(
        select(Deliverable)
        .where(Deliverable.clerk_user_id == clerk_user_id)
        .order_by(Deliverable.created_at.asc(), Deliverable.id.asc())
    ).all()
    deliverable_ids = [row.id for row in deliverables]
    deliverable_assumptions = session.scalars(
        select(DeliverableAssumption)
        .where(DeliverableAssumption.deliverable_id.in_(deliverable_ids) if deliverable_ids else False)
        .order_by(DeliverableAssumption.deliverable_id.asc(), DeliverableAssumption.sort_order.asc(), DeliverableAssumption.id.asc())
    ).all()
    deliverable_reviews = session.scalars(
        select(DeliverableReview)
        .where(DeliverableReview.deliverable_id.in_(deliverable_ids) if deliverable_ids else False)
        .order_by(DeliverableReview.deliverable_id.asc(), DeliverableReview.created_at.asc(), DeliverableReview.id.asc())
    ).all()
    deliverable_preflights = session.scalars(
        select(DeliverablePreflight)
        .where(DeliverablePreflight.deliverable_id.in_(deliverable_ids) if deliverable_ids else False)
        .order_by(DeliverablePreflight.deliverable_id.asc(), DeliverablePreflight.created_at.asc(), DeliverablePreflight.id.asc())
    ).all()
    deliverable_memos = session.scalars(
        select(DeliverableMemo)
        .where(DeliverableMemo.deliverable_id.in_(deliverable_ids) if deliverable_ids else False)
        .order_by(DeliverableMemo.deliverable_id.asc(), DeliverableMemo.version.asc(), DeliverableMemo.id.asc())
    ).all()
    deliverable_links = session.scalars(
        select(DeliverableLink)
        .where(DeliverableLink.deliverable_id.in_(deliverable_ids) if deliverable_ids else False)
        .order_by(DeliverableLink.deliverable_id.asc(), DeliverableLink.created_at.asc(), DeliverableLink.id.asc())
    ).all()

    return {
        "app_user": (
            {
                "clerk_user_id": app_user.clerk_user_id,
                "email": app_user.email,
                "username": app_user.username,
                "created_at": _serialize_datetime(app_user.created_at),
                "last_seen_at": _serialize_datetime(app_user.last_seen_at),
            }
            if app_user
            else None
        ),
        "watchlist_items": [
            {
                "ticker": row.ticker,
                "created_at": _serialize_datetime(row.created_at),
            }
            for row in watchlist_items
        ],
        "alert_rules": [
            {
                "id": str(row.id),
                "ticker": row.ticker,
                "condition": row.condition,
                "target_price": _as_float(row.target_price),
                "alert_type": row.alert_type,
                "prompt": row.prompt,
                "is_active": row.is_active,
                "created_at": _serialize_datetime(row.created_at),
            }
            for row in alert_rules
        ],
        "triggered_alerts": [
            {
                "id": str(row.id),
                "alert_rule_id": str(row.alert_rule_id) if row.alert_rule_id else None,
                "message": row.message,
                "seen": row.seen,
                "triggered_at": _serialize_datetime(row.triggered_at),
                "payload": dict(row.payload or {}),
            }
            for row in triggered_alerts
        ],
        "paper_portfolio": (
            {
                "cash": _as_float(paper_portfolio.cash),
                "starting_cash": _as_float(paper_portfolio.starting_cash),
                "updated_at": _serialize_datetime(paper_portfolio.updated_at),
            }
            if paper_portfolio
            else None
        ),
        "paper_equity_positions": [
            {
                "ticker": row.ticker,
                "shares": _as_float(row.shares),
                "avg_cost": _as_float(row.avg_cost),
                "updated_at": _serialize_datetime(row.updated_at),
            }
            for row in paper_equity_positions
        ],
        "paper_option_positions": [
            {
                "contract_symbol": row.contract_symbol,
                "quantity": row.quantity,
                "avg_cost": _as_float(row.avg_cost),
                "updated_at": _serialize_datetime(row.updated_at),
            }
            for row in paper_option_positions
        ],
        "paper_trade_events": [
            {
                "id": str(row.id),
                "asset_class": row.asset_class,
                "action": row.action,
                "symbol": row.symbol,
                "quantity": _as_float(row.quantity),
                "price": _as_float(row.price),
                "total": _as_float(row.total),
                "profit": _as_float(row.profit),
                "occurred_at": _serialize_datetime(row.occurred_at),
                "metadata": dict(row.metadata_json or {}),
            }
            for row in paper_trade_events
        ],
        "paper_portfolio_snapshots": [
            {
                "portfolio_value": _as_float(row.portfolio_value),
                "recorded_at": _serialize_datetime(row.recorded_at),
            }
            for row in paper_snapshots
        ],
        "prediction_portfolio": (
            {
                "cash": _as_float(prediction_portfolio.cash),
                "starting_cash": _as_float(prediction_portfolio.starting_cash),
                "updated_at": _serialize_datetime(prediction_portfolio.updated_at),
            }
            if prediction_portfolio
            else None
        ),
        "prediction_market_positions": [
            {
                "market_id": row.market_id,
                "outcome": row.outcome,
                "exchange": row.exchange,
                "question": row.question,
                "contracts": _as_float(row.contracts),
                "avg_cost": _as_float(row.avg_cost),
                "updated_at": _serialize_datetime(row.updated_at),
            }
            for row in prediction_positions
        ],
        "prediction_market_trades": [
            {
                "id": str(row.id),
                "market_id": row.market_id,
                "outcome": row.outcome,
                "exchange": row.exchange,
                "question": row.question,
                "action": row.action,
                "contracts": _as_float(row.contracts),
                "price": _as_float(row.price),
                "total": _as_float(row.total),
                "profit": _as_float(row.profit),
                "occurred_at": _serialize_datetime(row.occurred_at),
            }
            for row in prediction_trades
        ],
        "deliverables": [
            {
                "id": str(row.id),
                "template_key": row.template_key,
                "ticker": row.ticker,
                "title": row.title,
                "thesis_statement": row.thesis_statement,
                "time_horizon": row.time_horizon,
                "bull_case": row.bull_case,
                "bear_case": row.bear_case,
                "invalidation_conditions": row.invalidation_conditions,
                "catalysts": row.catalysts,
                "status": row.status,
                "confidence": row.confidence,
                "memo_audience": row.memo_audience,
                "created_at": _serialize_datetime(row.created_at),
                "updated_at": _serialize_datetime(row.updated_at),
                "closed_at": _serialize_datetime(row.closed_at),
            }
            for row in deliverables
        ],
        "deliverable_assumptions": [
            {
                "id": str(row.id),
                "deliverable_id": str(row.deliverable_id),
                "label": row.label,
                "value": row.value,
                "reason": row.reason,
                "confidence": row.confidence,
                "source_type": row.source_type,
                "sort_order": row.sort_order,
                "created_at": _serialize_datetime(row.created_at),
                "updated_at": _serialize_datetime(row.updated_at),
            }
            for row in deliverable_assumptions
        ],
        "deliverable_reviews": [
            {
                "id": str(row.id),
                "deliverable_id": str(row.deliverable_id),
                "review_type": row.review_type,
                "summary": row.summary,
                "what_changed": row.what_changed,
                "outcome_rating": row.outcome_rating,
                "created_at": _serialize_datetime(row.created_at),
            }
            for row in deliverable_reviews
        ],
        "deliverable_preflights": [
            {
                "id": str(row.id),
                "deliverable_id": str(row.deliverable_id),
                "input_version": row.input_version,
                "status": row.status,
                "required_questions_json": list(row.required_questions_json or []),
                "assumptions_json": list(row.assumptions_json or []),
                "sources_json": list(row.sources_json or []),
                "blocking_reasons_json": list(row.blocking_reasons_json or []),
                "created_at": _serialize_datetime(row.created_at),
            }
            for row in deliverable_preflights
        ],
        "deliverable_memos": [
            {
                "id": str(row.id),
                "deliverable_id": str(row.deliverable_id),
                "version": row.version,
                "model_slug": row.model_slug,
                "generation_status": row.generation_status,
                "prompt_snapshot_json": dict(row.prompt_snapshot_json or {}),
                "context_snapshot_json": dict(row.context_snapshot_json or {}),
                "structured_content_json": dict(row.structured_content_json or {}),
                "docx_blob": _serialize_binary(row.docx_blob),
                "mime_type": row.mime_type,
                "created_at": _serialize_datetime(row.created_at),
                "error_message": row.error_message,
            }
            for row in deliverable_memos
        ],
        "deliverable_links": [
            {
                "id": str(row.id),
                "deliverable_id": str(row.deliverable_id),
                "link_type": row.link_type,
                "link_ref": row.link_ref,
                "metadata_json": dict(row.metadata_json or {}),
                "created_at": _serialize_datetime(row.created_at),
            }
            for row in deliverable_links
        ],
    }


def restore_user_state(session: Session, clerk_user_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
    state = dict(state or {})

    deliverable_ids = [
        _coerce_uuid(row.get("id"))
        for row in (state.get("deliverables", []) or [])
        if row.get("id")
    ]

    if deliverable_ids:
        session.execute(delete(DeliverableLink).where(DeliverableLink.deliverable_id.in_(deliverable_ids)))
        session.execute(delete(DeliverableMemo).where(DeliverableMemo.deliverable_id.in_(deliverable_ids)))
        session.execute(delete(DeliverablePreflight).where(DeliverablePreflight.deliverable_id.in_(deliverable_ids)))
        session.execute(delete(DeliverableReview).where(DeliverableReview.deliverable_id.in_(deliverable_ids)))
        session.execute(delete(DeliverableAssumption).where(DeliverableAssumption.deliverable_id.in_(deliverable_ids)))
        session.execute(delete(Deliverable).where(Deliverable.id.in_(deliverable_ids)))

    existing_deliverable_ids = session.scalars(
        select(Deliverable.id).where(Deliverable.clerk_user_id == clerk_user_id)
    ).all()
    if existing_deliverable_ids:
        session.execute(delete(DeliverableLink).where(DeliverableLink.deliverable_id.in_(existing_deliverable_ids)))
        session.execute(delete(DeliverableMemo).where(DeliverableMemo.deliverable_id.in_(existing_deliverable_ids)))
        session.execute(delete(DeliverablePreflight).where(DeliverablePreflight.deliverable_id.in_(existing_deliverable_ids)))
        session.execute(delete(DeliverableReview).where(DeliverableReview.deliverable_id.in_(existing_deliverable_ids)))
        session.execute(delete(DeliverableAssumption).where(DeliverableAssumption.deliverable_id.in_(existing_deliverable_ids)))
        session.execute(delete(Deliverable).where(Deliverable.id.in_(existing_deliverable_ids)))

    session.execute(
        delete(PredictionMarketTrade).where(PredictionMarketTrade.clerk_user_id == clerk_user_id)
    )
    session.execute(
        delete(PredictionMarketPosition).where(PredictionMarketPosition.clerk_user_id == clerk_user_id)
    )
    session.execute(
        delete(PredictionPortfolio).where(PredictionPortfolio.clerk_user_id == clerk_user_id)
    )
    session.execute(
        delete(PaperPortfolioSnapshot).where(PaperPortfolioSnapshot.clerk_user_id == clerk_user_id)
    )
    session.execute(delete(PaperTradeEvent).where(PaperTradeEvent.clerk_user_id == clerk_user_id))
    session.execute(delete(PaperOptionPosition).where(PaperOptionPosition.clerk_user_id == clerk_user_id))
    session.execute(delete(PaperEquityPosition).where(PaperEquityPosition.clerk_user_id == clerk_user_id))
    session.execute(delete(PaperPortfolio).where(PaperPortfolio.clerk_user_id == clerk_user_id))
    session.execute(delete(TriggeredAlert).where(TriggeredAlert.clerk_user_id == clerk_user_id))
    session.execute(delete(AlertRule).where(AlertRule.clerk_user_id == clerk_user_id))
    session.execute(delete(WatchlistItem).where(WatchlistItem.clerk_user_id == clerk_user_id))
    session.execute(delete(AppUser).where(AppUser.clerk_user_id == clerk_user_id))
    session.flush()

    app_user = state.get("app_user")
    if app_user:
        session.add(
            AppUser(
                clerk_user_id=clerk_user_id,
                email=app_user.get("email"),
                username=app_user.get("username"),
                created_at=_coerce_datetime(app_user.get("created_at")),
                last_seen_at=_coerce_datetime(app_user.get("last_seen_at")),
            )
        )

    for row in state.get("watchlist_items", []) or []:
        session.add(
            WatchlistItem(
                clerk_user_id=clerk_user_id,
                ticker=str(row.get("ticker", "")).upper(),
                created_at=_coerce_datetime(row.get("created_at")),
            )
        )

    for row in state.get("alert_rules", []) or []:
        session.add(
            AlertRule(
                id=_coerce_uuid(row.get("id")),
                clerk_user_id=clerk_user_id,
                ticker=str(row.get("ticker", "")).upper(),
                condition=str(row.get("condition", "")),
                target_price=row.get("target_price"),
                alert_type=str(row.get("alert_type") or row.get("type") or "price"),
                prompt=row.get("prompt"),
                is_active=bool(row.get("is_active", True)),
                created_at=_coerce_datetime(row.get("created_at")),
            )
        )

    for row in state.get("triggered_alerts", []) or []:
        alert_rule_id = row.get("alert_rule_id")
        session.add(
            TriggeredAlert(
                id=_coerce_uuid(row.get("id")),
                clerk_user_id=clerk_user_id,
                alert_rule_id=_coerce_uuid(alert_rule_id) if alert_rule_id else None,
                message=str(row.get("message", "")),
                seen=bool(row.get("seen", False)),
                triggered_at=_coerce_datetime(row.get("triggered_at")),
                payload=dict(row.get("payload", {}) or {}),
            )
        )

    paper_portfolio = state.get("paper_portfolio")
    if paper_portfolio:
        session.add(
            PaperPortfolio(
                clerk_user_id=clerk_user_id,
                cash=paper_portfolio.get("cash", 100000.0),
                starting_cash=paper_portfolio.get("starting_cash", 100000.0),
                updated_at=_coerce_datetime(paper_portfolio.get("updated_at")),
            )
        )

    for row in state.get("paper_equity_positions", []) or []:
        session.add(
            PaperEquityPosition(
                clerk_user_id=clerk_user_id,
                ticker=str(row.get("ticker", "")).upper(),
                shares=row.get("shares", 0),
                avg_cost=row.get("avg_cost", 0),
                updated_at=_coerce_datetime(row.get("updated_at")),
            )
        )

    for row in state.get("paper_option_positions", []) or []:
        session.add(
            PaperOptionPosition(
                clerk_user_id=clerk_user_id,
                contract_symbol=str(row.get("contract_symbol", "")),
                quantity=int(row.get("quantity", 0)),
                avg_cost=row.get("avg_cost", 0),
                updated_at=_coerce_datetime(row.get("updated_at")),
            )
        )

    for row in state.get("paper_trade_events", []) or []:
        session.add(
            PaperTradeEvent(
                id=_coerce_uuid(row.get("id")),
                clerk_user_id=clerk_user_id,
                asset_class=str(row.get("asset_class", "equity")),
                action=str(row.get("action", "")),
                symbol=str(row.get("symbol", "")),
                quantity=row.get("quantity", 0),
                price=row.get("price", 0),
                total=row.get("total", 0),
                profit=row.get("profit"),
                occurred_at=_coerce_datetime(row.get("occurred_at")),
                metadata_json=dict(row.get("metadata", {}) or {}),
            )
        )

    for row in state.get("paper_portfolio_snapshots", []) or []:
        session.add(
            PaperPortfolioSnapshot(
                clerk_user_id=clerk_user_id,
                portfolio_value=row.get("portfolio_value", 0),
                recorded_at=_coerce_datetime(row.get("recorded_at")),
            )
        )

    prediction_portfolio = state.get("prediction_portfolio")
    if prediction_portfolio:
        session.add(
            PredictionPortfolio(
                clerk_user_id=clerk_user_id,
                cash=prediction_portfolio.get("cash", 10000.0),
                starting_cash=prediction_portfolio.get("starting_cash", 10000.0),
                updated_at=_coerce_datetime(prediction_portfolio.get("updated_at")),
            )
        )

    for row in state.get("prediction_market_positions", []) or []:
        session.add(
            PredictionMarketPosition(
                clerk_user_id=clerk_user_id,
                market_id=str(row.get("market_id", "")),
                outcome=str(row.get("outcome", "")),
                exchange=str(row.get("exchange", "polymarket")),
                question=str(row.get("question", "")),
                contracts=row.get("contracts", 0),
                avg_cost=row.get("avg_cost", 0),
                updated_at=_coerce_datetime(row.get("updated_at")),
            )
        )

    for row in state.get("prediction_market_trades", []) or []:
        session.add(
            PredictionMarketTrade(
                id=_coerce_uuid(row.get("id")),
                clerk_user_id=clerk_user_id,
                market_id=str(row.get("market_id", "")),
                outcome=str(row.get("outcome", "")),
                exchange=str(row.get("exchange", "polymarket")),
                question=str(row.get("question", "")),
                action=str(row.get("action", "")),
                contracts=row.get("contracts", 0),
                price=row.get("price", 0),
                total=row.get("total", 0),
                profit=row.get("profit"),
                occurred_at=_coerce_datetime(row.get("occurred_at")),
            )
        )

    for row in state.get("deliverables", []) or []:
        session.add(
            Deliverable(
                id=_coerce_uuid(row.get("id")),
                clerk_user_id=clerk_user_id,
                template_key=str(row.get("template_key") or "investment_thesis_memo"),
                ticker=str(row.get("ticker", "")).upper(),
                title=str(row.get("title", "")),
                thesis_statement=row.get("thesis_statement"),
                time_horizon=row.get("time_horizon"),
                bull_case=row.get("bull_case"),
                bear_case=row.get("bear_case"),
                invalidation_conditions=row.get("invalidation_conditions"),
                catalysts=row.get("catalysts"),
                status=str(row.get("status") or "draft"),
                confidence=row.get("confidence"),
                memo_audience=str(row.get("memo_audience") or "personal investment review"),
                created_at=_coerce_datetime(row.get("created_at")),
                updated_at=_coerce_datetime(row.get("updated_at")),
                closed_at=_coerce_datetime(row.get("closed_at")) if row.get("closed_at") else None,
            )
        )

    for row in state.get("deliverable_assumptions", []) or []:
        session.add(
            DeliverableAssumption(
                id=_coerce_uuid(row.get("id")),
                deliverable_id=_coerce_uuid(row.get("deliverable_id")),
                label=str(row.get("label", "")),
                value=str(row.get("value", "")),
                reason=row.get("reason"),
                confidence=row.get("confidence"),
                source_type=str(row.get("source_type") or "user"),
                sort_order=int(row.get("sort_order", 0)),
                created_at=_coerce_datetime(row.get("created_at")),
                updated_at=_coerce_datetime(row.get("updated_at")),
            )
        )

    for row in state.get("deliverable_reviews", []) or []:
        session.add(
            DeliverableReview(
                id=_coerce_uuid(row.get("id")),
                deliverable_id=_coerce_uuid(row.get("deliverable_id")),
                review_type=str(row.get("review_type") or "checkpoint"),
                summary=str(row.get("summary", "")),
                what_changed=row.get("what_changed"),
                outcome_rating=row.get("outcome_rating"),
                created_at=_coerce_datetime(row.get("created_at")),
            )
        )

    for row in state.get("deliverable_preflights", []) or []:
        session.add(
            DeliverablePreflight(
                id=_coerce_uuid(row.get("id")),
                deliverable_id=_coerce_uuid(row.get("deliverable_id")),
                input_version=int(row.get("input_version", 1)),
                status=str(row.get("status") or "red"),
                required_questions_json=list(row.get("required_questions_json", []) or []),
                assumptions_json=list(row.get("assumptions_json", []) or []),
                sources_json=list(row.get("sources_json", []) or []),
                blocking_reasons_json=list(row.get("blocking_reasons_json", []) or []),
                created_at=_coerce_datetime(row.get("created_at")),
            )
        )

    for row in state.get("deliverable_memos", []) or []:
        session.add(
            DeliverableMemo(
                id=_coerce_uuid(row.get("id")),
                deliverable_id=_coerce_uuid(row.get("deliverable_id")),
                version=int(row.get("version", 1)),
                model_slug=str(row.get("model_slug") or ""),
                generation_status=str(row.get("generation_status") or "completed"),
                prompt_snapshot_json=dict(row.get("prompt_snapshot_json", {}) or {}),
                context_snapshot_json=dict(row.get("context_snapshot_json", {}) or {}),
                structured_content_json=dict(row.get("structured_content_json", {}) or {}),
                docx_blob=_deserialize_binary(row.get("docx_blob")),
                mime_type=row.get("mime_type"),
                created_at=_coerce_datetime(row.get("created_at")),
                error_message=row.get("error_message"),
            )
        )

    for row in state.get("deliverable_links", []) or []:
        session.add(
            DeliverableLink(
                id=_coerce_uuid(row.get("id")),
                deliverable_id=_coerce_uuid(row.get("deliverable_id")),
                link_type=str(row.get("link_type") or ""),
                link_ref=str(row.get("link_ref") or ""),
                metadata_json=dict(row.get("metadata_json", {}) or {}),
                created_at=_coerce_datetime(row.get("created_at")),
            )
        )

    session.flush()
    return export_user_state(session, clerk_user_id)


def summarize_user_state(state: Dict[str, Any]) -> Dict[str, Any]:
    state = dict(state or {})
    paper_portfolio = state.get("paper_portfolio") or {}
    prediction_portfolio = state.get("prediction_portfolio") or {}

    return {
        "app_user_exists": bool(state.get("app_user")),
        "watchlist_count": len(state.get("watchlist_items", []) or []),
        "active_alert_count": len(state.get("alert_rules", []) or []),
        "triggered_alert_count": len(state.get("triggered_alerts", []) or []),
        "paper_position_count": len(state.get("paper_equity_positions", []) or []),
        "paper_option_position_count": len(state.get("paper_option_positions", []) or []),
        "paper_trade_count": len(state.get("paper_trade_events", []) or []),
        "paper_snapshot_count": len(state.get("paper_portfolio_snapshots", []) or []),
        "paper_cash": paper_portfolio.get("cash"),
        "prediction_position_count": len(state.get("prediction_market_positions", []) or []),
        "prediction_trade_count": len(state.get("prediction_market_trades", []) or []),
        "prediction_cash": prediction_portfolio.get("cash"),
        "deliverable_count": len(state.get("deliverables", []) or []),
        "deliverable_memo_count": len(state.get("deliverable_memos", []) or []),
    }


def create_public_api_client(
    session: Session,
    *,
    name: str,
    contact_email: Optional[str] = None,
    notes: Optional[str] = None,
    status: str = "active",
) -> PublicApiClient:
    client = PublicApiClient(
        name=str(name).strip(),
        contact_email=(str(contact_email).strip() if contact_email else None),
        notes=notes,
        status=str(status or "active").strip().lower(),
        created_at=utcnow(),
    )
    session.add(client)
    session.flush()
    return client


def get_public_api_client(session: Session, client_id: Any) -> Optional[PublicApiClient]:
    return session.get(PublicApiClient, _coerce_uuid(client_id))


def list_public_api_clients(session: Session) -> List[PublicApiClient]:
    return list(session.scalars(select(PublicApiClient).order_by(PublicApiClient.created_at.asc())).all())


def create_public_api_key(
    session: Session,
    *,
    client_id: Any,
    key_prefix: str,
    key_hash: str,
    label: Optional[str] = None,
    status: str = "active",
    expires_at: Optional[datetime] = None,
) -> PublicApiKey:
    key = PublicApiKey(
        client_id=_coerce_uuid(client_id),
        key_prefix=str(key_prefix).strip(),
        key_hash=str(key_hash).strip(),
        label=(str(label).strip() if label else None),
        status=str(status or "active").strip().lower(),
        created_at=utcnow(),
        expires_at=expires_at,
    )
    session.add(key)
    session.flush()
    return key


def get_public_api_key(session: Session, key_id: Any) -> Optional[PublicApiKey]:
    return session.get(PublicApiKey, _coerce_uuid(key_id))


def get_public_api_key_by_prefix(session: Session, key_prefix: str) -> Optional[PublicApiKey]:
    if not str(key_prefix or "").strip():
        return None
    return session.scalar(
        select(PublicApiKey).where(PublicApiKey.key_prefix == str(key_prefix).strip())
    )


def list_public_api_keys(session: Session, *, client_id: Any | None = None) -> List[PublicApiKey]:
    stmt = select(PublicApiKey)
    if client_id is not None:
        stmt = stmt.where(PublicApiKey.client_id == _coerce_uuid(client_id))
    stmt = stmt.order_by(PublicApiKey.created_at.asc())
    return list(session.scalars(stmt).all())


def set_public_api_key_status(session: Session, key_id: Any, status: str) -> Optional[PublicApiKey]:
    key = get_public_api_key(session, key_id)
    if key is None:
        return None
    key.status = str(status or "").strip().lower()
    return key


def touch_public_api_key_last_used(
    session: Session,
    key_id: Any,
    *,
    seen_at: Optional[datetime] = None,
) -> Optional[PublicApiKey]:
    key = get_public_api_key(session, key_id)
    if key is None:
        return None
    key.last_used_at = seen_at or utcnow()
    return key


def increment_public_api_daily_usage(
    session: Session,
    *,
    client_id: Any,
    api_key_id: Any,
    day_value: date,
    route_group: str,
    cached: bool = False,
) -> PublicApiDailyUsage:
    normalized_day = day_value if isinstance(day_value, date) else utcnow().date()
    normalized_route_group = str(route_group or "unknown").strip().lower()
    row = session.scalar(
        select(PublicApiDailyUsage).where(
            PublicApiDailyUsage.api_key_id == _coerce_uuid(api_key_id),
            PublicApiDailyUsage.day == normalized_day,
            PublicApiDailyUsage.route_group == normalized_route_group,
        )
    )
    now = utcnow()
    if row is None:
        row = PublicApiDailyUsage(
            client_id=_coerce_uuid(client_id),
            api_key_id=_coerce_uuid(api_key_id),
            day=normalized_day,
            route_group=normalized_route_group,
            request_count=0,
            cached_request_count=0,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()

    row.request_count += 1
    if cached:
        row.cached_request_count += 1
    row.updated_at = now
    return row


def get_public_api_daily_request_total(
    session: Session,
    *,
    api_key_id: Any,
    day_value: date,
) -> int:
    normalized_day = day_value if isinstance(day_value, date) else utcnow().date()
    total = session.scalar(
        select(func.coalesce(func.sum(PublicApiDailyUsage.request_count), 0)).where(
            PublicApiDailyUsage.api_key_id == _coerce_uuid(api_key_id),
            PublicApiDailyUsage.day == normalized_day,
        )
    )
    return int(total or 0)


def list_public_api_daily_usage(
    session: Session,
    *,
    client_id: Any | None = None,
    day_value: date | None = None,
) -> List[PublicApiDailyUsage]:
    stmt = select(PublicApiDailyUsage)
    if client_id is not None:
        stmt = stmt.where(PublicApiDailyUsage.client_id == _coerce_uuid(client_id))
    if day_value is not None:
        stmt = stmt.where(PublicApiDailyUsage.day == day_value)
    stmt = stmt.order_by(
        PublicApiDailyUsage.day.desc(),
        PublicApiDailyUsage.route_group.asc(),
        PublicApiDailyUsage.created_at.asc(),
    )
    return list(session.scalars(stmt).all())
