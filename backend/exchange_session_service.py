from __future__ import annotations

from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Any, Dict, Optional

import pandas as pd

import exchange_calendars as exchange_calendars_module

from asset_identity import market_exchange, normalize_market


MARKET_SESSION_CONFIG = {
    "US": {
        "calendarCode": "XNYS",
        "timezone": "America/New_York",
        "defaultExchange": "US",
        "marketLabel": "United States",
    },
    "HK": {
        "calendarCode": "XHKG",
        "timezone": "Asia/Hong_Kong",
        "defaultExchange": "HKEX",
        "marketLabel": "Hong Kong",
    },
    "CN": {
        "calendarCode": "XSHG",
        "timezone": "Asia/Shanghai",
        "defaultExchange": "SSE",
        "marketLabel": "China A-Shares",
    },
}

DEFAULT_SESSION_LOOKAHEAD_DAYS = 14
MAX_SESSION_LOOKAHEAD_DAYS = 30


class ExchangeSessionError(Exception):
    pass


def get_market_session(
    market: Optional[str],
    *,
    exchange: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    config = _get_market_config(market)
    calendar = _get_calendar(config["calendarCode"])
    calendar_timezone = config["timezone"]
    current_minute = _coerce_current_minute(now)
    local_now = current_minute.tz_convert(calendar_timezone)
    local_date = local_now.date()
    exchange_name = exchange or market_exchange(config["market"])

    session_label, session_row = _session_for_local_date(calendar, local_date)
    if session_label is not None and session_row is not None:
        return _build_today_session_payload(
            calendar=calendar,
            market=config["market"],
            exchange=exchange_name,
            calendar_code=config["calendarCode"],
            session_label=session_label,
            session_row=session_row,
            current_minute=current_minute,
            local_date=local_date,
        )

    next_open = _safe_calendar_call(calendar.next_open, current_minute)
    next_close = _safe_calendar_call(calendar.next_close, current_minute)
    weekend = local_now.weekday() >= 5
    return {
        "calendarCode": config["calendarCode"],
        "market": config["market"],
        "exchange": exchange_name,
        "timezone": calendar_timezone,
        "status": "closed" if weekend else "holiday",
        "isTradingDay": False,
        "sessionDate": local_date.isoformat(),
        "opensAt": None,
        "closesAt": None,
        "breakStart": None,
        "breakEnd": None,
        "nextOpen": _serialize_timestamp(next_open, timezone=calendar_timezone),
        "nextClose": _serialize_timestamp(next_close, timezone=calendar_timezone),
        "reason": "weekend" if weekend else "holiday",
    }


def get_market_sessions_calendar(
    market: Optional[str],
    *,
    days: int = DEFAULT_SESSION_LOOKAHEAD_DAYS,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    config = _get_market_config(market)
    calendar = _get_calendar(config["calendarCode"])
    calendar_timezone = config["timezone"]
    current_minute = _coerce_current_minute(now)
    today_summary = get_market_session(config["market"], exchange=config["defaultExchange"], now=current_minute)

    session_count = max(1, min(int(days or DEFAULT_SESSION_LOOKAHEAD_DAYS), MAX_SESSION_LOOKAHEAD_DAYS))
    first_session_label = _resolve_first_session_label(calendar, current_minute)
    schedule_slice = _slice_schedule(calendar, first_session_label, session_count)

    sessions = [
        _build_schedule_entry(
            calendar=calendar,
            market=config["market"],
            exchange=config["defaultExchange"],
            calendar_code=config["calendarCode"],
            session_label=session_label,
            session_row=session_row,
        )
        for session_label, session_row in schedule_slice.iterrows()
    ]

    lookahead_end = current_minute.tz_convert(calendar_timezone).date() + timedelta(days=max(session_count * 4, 30))
    upcoming_holidays = _collect_upcoming_holidays(calendar, current_minute.tz_convert(calendar_timezone).date(), lookahead_end)
    special_sessions = [
        {
            "sessionDate": session["sessionDate"],
            "type": "early_close",
            "closesAt": session["closesAt"],
            "exchange": session["exchange"],
        }
        for session in sessions
        if session.get("isEarlyClose")
    ]

    return {
        "market": config["market"],
        "marketLabel": config["marketLabel"],
        "exchange": config["defaultExchange"],
        "calendarCode": config["calendarCode"],
        "timezone": calendar_timezone,
        "today": today_summary,
        "sessions": sessions,
        "upcomingHolidays": upcoming_holidays,
        "specialSessions": special_sessions,
    }


def get_next_session_dates(
    market: Optional[str],
    *,
    after_date,
    count: int,
) -> list[pd.Timestamp]:
    config = _get_market_config(market)
    calendar = _get_calendar(config["calendarCode"])
    session_count = max(1, int(count or 1))
    current_date = pd.Timestamp(after_date).date()

    try:
        current_session = calendar.date_to_session(current_date, direction="previous")
    except Exception as exc:
        raise ExchangeSessionError(f"Unable to resolve session for {current_date.isoformat()}") from exc

    schedule = calendar.schedule
    session_index = schedule.index.get_loc(current_session)
    next_schedule = schedule.iloc[session_index + 1 : session_index + 1 + session_count]
    return [pd.Timestamp(label).tz_localize(None) for label in next_schedule.index]


def _build_today_session_payload(
    *,
    calendar,
    market: str,
    exchange: str,
    calendar_code: str,
    session_label,
    session_row,
    current_minute: pd.Timestamp,
    local_date: date,
) -> Dict[str, Any]:
    open_minute = _to_timestamp(session_row["open"])
    close_minute = _to_timestamp(session_row["close"])
    break_start = _to_optional_timestamp(session_row.get("break_start"))
    break_end = _to_optional_timestamp(session_row.get("break_end"))
    timezone = str(calendar.tz)

    if break_start is not None and break_end is not None and break_start <= current_minute < break_end:
        status = "break"
        reason = "lunch_break"
        next_open = break_end
        next_close = close_minute
    elif open_minute <= current_minute < close_minute:
        status = "open"
        reason = "regular_hours"
        next_open = _safe_calendar_call(calendar.next_open, current_minute)
        next_close = close_minute
    else:
        status = "closed"
        reason = "outside_hours"
        next_open = open_minute if current_minute < open_minute else _safe_calendar_call(calendar.next_open, current_minute)
        next_close = close_minute if current_minute <= close_minute else _safe_calendar_call(calendar.next_close, current_minute)

    return {
        "calendarCode": calendar_code,
        "market": market,
        "exchange": exchange,
        "timezone": timezone,
        "status": status,
        "isTradingDay": True,
        "sessionDate": session_label.date().isoformat() if hasattr(session_label, "date") else local_date.isoformat(),
        "opensAt": _serialize_timestamp(open_minute, timezone=timezone),
        "closesAt": _serialize_timestamp(close_minute, timezone=timezone),
        "breakStart": _serialize_timestamp(break_start, timezone=timezone),
        "breakEnd": _serialize_timestamp(break_end, timezone=timezone),
        "nextOpen": _serialize_timestamp(next_open, timezone=timezone),
        "nextClose": _serialize_timestamp(next_close, timezone=timezone),
        "reason": reason,
    }


def _build_schedule_entry(
    *,
    calendar,
    market: str,
    exchange: str,
    calendar_code: str,
    session_label,
    session_row,
) -> Dict[str, Any]:
    timezone = str(calendar.tz)
    open_minute = _to_timestamp(session_row["open"])
    close_minute = _to_timestamp(session_row["close"])
    break_start = _to_optional_timestamp(session_row.get("break_start"))
    break_end = _to_optional_timestamp(session_row.get("break_end"))
    return {
        "calendarCode": calendar_code,
        "market": market,
        "exchange": exchange,
        "timezone": timezone,
        "sessionDate": session_label.date().isoformat() if hasattr(session_label, "date") else str(session_label)[:10],
        "opensAt": _serialize_timestamp(open_minute, timezone=timezone),
        "closesAt": _serialize_timestamp(close_minute, timezone=timezone),
        "breakStart": _serialize_timestamp(break_start, timezone=timezone),
        "breakEnd": _serialize_timestamp(break_end, timezone=timezone),
        "hasBreak": break_start is not None and break_end is not None,
        "isEarlyClose": _is_early_close(calendar, session_label, close_minute),
    }


def _collect_upcoming_holidays(calendar, start_date: date, end_date: date) -> list[Dict[str, Any]]:
    closures: list[Dict[str, Any]] = []
    for day in pd.date_range(start_date, end_date, freq="D"):
        current_date = day.date()
        if current_date.weekday() >= 5:
            continue
        session_label, _ = _session_for_local_date(calendar, current_date)
        if session_label is not None:
            continue
        closures.append(
            {
                "date": current_date.isoformat(),
                "label": "Market holiday",
                "reason": "holiday",
            }
        )
        if len(closures) >= 6:
            break
    return closures


def _resolve_first_session_label(calendar, current_minute: pd.Timestamp):
    local_date = current_minute.tz_convert(calendar.tz).date()
    session_label, session_row = _session_for_local_date(calendar, local_date)
    if session_label is not None and session_row is not None:
        return session_label
    next_open = calendar.next_open(current_minute)
    return calendar.minute_to_session(next_open, direction="next")


def _slice_schedule(calendar, first_session_label, session_count: int):
    schedule = calendar.schedule
    first_index = schedule.index.get_loc(first_session_label)
    return schedule.iloc[first_index : first_index + session_count]


def _session_for_local_date(calendar, local_date: date):
    try:
        session_label = calendar.date_to_session(local_date, direction="none")
    except Exception:
        return None, None
    try:
        session_row = calendar.schedule.loc[session_label]
    except KeyError:
        return None, None
    return session_label, session_row


def _is_early_close(calendar, session_label, close_minute: pd.Timestamp) -> bool:
    regular_close_time = _effective_time_for_session(calendar.close_times, session_label.date())
    if regular_close_time is None:
        return False
    local_close_time = close_minute.tz_convert(calendar.tz).time()
    return local_close_time != regular_close_time


def _effective_time_for_session(time_rules, session_date: date):
    if not time_rules:
        return None
    session_marker = pd.Timestamp(session_date)
    selected = None
    for effective_date, time_value in time_rules:
        if effective_date is None:
            selected = time_value
            continue
        if pd.Timestamp(effective_date) <= session_marker:
            selected = time_value
            continue
        break
    return selected


def _get_market_config(market: Optional[str]) -> Dict[str, Any]:
    normalized_market = normalize_market(market, default="US")
    if normalized_market not in MARKET_SESSION_CONFIG:
        raise ExchangeSessionError(f"Unsupported market '{market}'.")
    return {
        "market": normalized_market,
        **MARKET_SESSION_CONFIG[normalized_market],
    }


@lru_cache(maxsize=len(MARKET_SESSION_CONFIG))
def _get_calendar(calendar_code: str):
    return exchange_calendars_module.get_calendar(calendar_code)


def _coerce_current_minute(now: Optional[datetime]) -> pd.Timestamp:
    if now is None:
        current = pd.Timestamp.utcnow()
    else:
        current = pd.Timestamp(now)
    if current.tzinfo is None:
        current = current.tz_localize("UTC")
    return current.tz_convert("UTC").floor("min")


def _to_timestamp(value) -> pd.Timestamp:
    return pd.Timestamp(value)


def _to_optional_timestamp(value) -> Optional[pd.Timestamp]:
    if value is None or pd.isna(value):
        return None
    return pd.Timestamp(value)


def _serialize_timestamp(value, *, timezone: Optional[str] = None) -> Optional[str]:
    if value is None:
        return None
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize("UTC")
    if timezone:
        timestamp = timestamp.tz_convert(timezone)
    return timestamp.isoformat()


def _safe_calendar_call(fn, current_minute: pd.Timestamp):
    try:
        return fn(current_minute)
    except Exception:
        return None
