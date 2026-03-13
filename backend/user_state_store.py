from __future__ import annotations

import json
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, Iterator, List, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    create_engine,
    delete,
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

    clerk_user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


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


def ensure_database_ready(database_url: str) -> None:
    url = _normalize_database_url(database_url)
    if not url:
        raise ValueError("DATABASE_URL is required for SQL persistence modes")

    if url in _SESSION_FACTORIES:
        return

    engine = create_engine(url, future=True)
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
