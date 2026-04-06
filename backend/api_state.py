from __future__ import annotations

import json
import os
import re


def normalize_persistence_mode(mode, *, logger):
    normalized = str(mode or "json").strip().lower()
    if normalized not in {"json", "dual", "postgres"}:
        logger.warning("Unknown PERSISTENCE_MODE '%s'; defaulting to json", normalized)
        return "json"
    return normalized


def current_persistence_mode(mode, *, logger):
    return normalize_persistence_mode(mode, logger=logger)


def sql_persistence_enabled(mode, *, logger):
    return current_persistence_mode(mode, logger=logger) in {"dual", "postgres"}


def json_mirror_enabled(mode, *, logger):
    return current_persistence_mode(mode, logger=logger) == "dual"


def ensure_user_state_storage_ready(*, sql_enabled, ensure_database_ready_fn, database_url):
    if sql_enabled:
        ensure_database_ready_fn(database_url)


def init_history_db(*, get_db_fn, logger):
    conn = None
    try:
        conn = get_db_fn()
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS portfolio_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                portfolio_value REAL NOT NULL,
                user_id TEXT
            );
            """
        )
        cursor.execute("PRAGMA table_info(portfolio_history)")
        columns = [row[1] for row in cursor.fetchall()]
        if "user_id" not in columns:
            cursor.execute("ALTER TABLE portfolio_history ADD COLUMN user_id TEXT")
        conn.commit()
        logger.info("Database initialized.")
    except Exception as exc:
        logger.error("An error occurred during DB initialization: %s", exc)
    finally:
        if conn:
            conn.close()


def safe_user_id(user_id):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", str(user_id))


def get_user_file_path(user_id, filename, *, user_data_dir):
    user_dir = os.path.join(user_data_dir, safe_user_id(user_id))
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, filename)


def iter_user_ids(
    *,
    user_data_dir,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    list_app_user_ids_db_fn,
    logger,
):
    user_ids = set()
    if os.path.isdir(user_data_dir):
        user_ids.update(
            entry
            for entry in os.listdir(user_data_dir)
            if os.path.isdir(os.path.join(user_data_dir, entry))
        )

    if sql_enabled:
        try:
            ensure_user_state_storage_ready_fn()
            with session_scope(database_url) as session:
                user_ids.update(list_app_user_ids_db_fn(session))
        except Exception as exc:
            logger.error("Failed to enumerate SQL-backed users: %s", exc)

    return sorted(user_ids)


def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r") as handle:
                return json.load(handle)
        except json.JSONDecodeError:
            pass
    return default


def save_json(path, payload):
    with open(path, "w") as handle:
        json.dump(payload, handle, indent=4)


def portfolio_file(user_id=None, *, default_file, get_user_file_path_fn=None):
    if user_id and get_user_file_path_fn:
        return get_user_file_path_fn(user_id, "paper_portfolio.json")
    return default_file


def prediction_portfolio_file(user_id=None, *, default_file, get_user_file_path_fn=None):
    if user_id and get_user_file_path_fn:
        return get_user_file_path_fn(user_id, "prediction_portfolio.json")
    return default_file


def notifications_file(user_id=None, *, default_file, get_user_file_path_fn=None):
    if user_id and get_user_file_path_fn:
        return get_user_file_path_fn(user_id, "notifications.json")
    return default_file


def watchlist_file(user_id=None, *, base_dir, get_user_file_path_fn=None):
    if user_id and get_user_file_path_fn:
        return get_user_file_path_fn(user_id, "watchlist.json")
    return os.path.join(base_dir, "watchlist.json")


def should_seed_from_legacy(allow_legacy_seed, user_path, legacy_path):
    return allow_legacy_seed and not os.path.exists(user_path) and os.path.exists(legacy_path)


def load_prediction_portfolio_json(
    user_id=None,
    *,
    default_file,
    get_prediction_portfolio_file_fn,
    allow_legacy_seed,
    load_json_fn,
):
    user_path = get_prediction_portfolio_file_fn(user_id) if user_id else default_file
    source_path = user_path
    if user_id and should_seed_from_legacy(allow_legacy_seed, user_path, default_file):
        source_path = default_file
    data = load_json_fn(source_path, {})
    data.setdefault("cash", 10000.0)
    data.setdefault("starting_cash", 10000.0)
    data.setdefault("positions", {})
    data.setdefault("trade_history", [])
    return data


def save_prediction_portfolio_json(portfolio, user_id=None, *, get_prediction_portfolio_file_fn, save_json_fn):
    save_json_fn(get_prediction_portfolio_file_fn(user_id), portfolio)


def load_prediction_portfolio(
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    load_prediction_portfolio_db_fn,
    load_prediction_portfolio_json_fn,
):
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            return load_prediction_portfolio_db_fn(session, user_id)
    return load_prediction_portfolio_json_fn(user_id)


def save_prediction_portfolio(
    portfolio,
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    save_prediction_portfolio_db_fn,
    json_mirror_enabled,
    save_prediction_portfolio_json_fn,
):
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            save_prediction_portfolio_db_fn(session, user_id, portfolio)
        if json_mirror_enabled:
            save_prediction_portfolio_json_fn(portfolio, user_id)
        return
    save_prediction_portfolio_json_fn(portfolio, user_id)


def load_portfolio_json(
    user_id=None,
    *,
    default_file,
    get_portfolio_file_fn,
    allow_legacy_seed,
    load_json_fn,
):
    user_path = get_portfolio_file_fn(user_id) if user_id else default_file
    source_path = user_path
    if user_id and should_seed_from_legacy(allow_legacy_seed, user_path, default_file):
        source_path = default_file
    data = load_json_fn(source_path, {})
    data.setdefault("cash", 100000.0)
    data.setdefault("starting_cash", 100000.0)
    data.setdefault("positions", {})
    data.setdefault("options_positions", {})
    data.setdefault("transactions", [])
    data.setdefault("trade_history", [])
    return data


def save_portfolio_json(portfolio, user_id=None, *, get_portfolio_file_fn, save_json_fn):
    save_json_fn(get_portfolio_file_fn(user_id), portfolio)


def load_portfolio(
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    load_portfolio_db_fn,
    load_portfolio_json_fn,
):
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            return load_portfolio_db_fn(session, user_id)
    return load_portfolio_json_fn(user_id)


def save_portfolio(
    portfolio,
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    save_portfolio_db_fn,
    json_mirror_enabled,
    save_portfolio_json_fn,
):
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            save_portfolio_db_fn(session, user_id, portfolio)
        if json_mirror_enabled:
            save_portfolio_json_fn(portfolio, user_id)
        return
    save_portfolio_json_fn(portfolio, user_id)


def load_notifications_json(
    user_id=None,
    *,
    default_file,
    get_notifications_file_fn,
    allow_legacy_seed,
    load_json_fn,
):
    user_path = get_notifications_file_fn(user_id) if user_id else default_file
    source_path = user_path
    if user_id and should_seed_from_legacy(allow_legacy_seed, user_path, default_file):
        source_path = default_file
    data = load_json_fn(source_path, {})
    data.setdefault("active", [])
    data.setdefault("triggered", [])
    return data


def save_notifications_json(notifications, user_id=None, *, get_notifications_file_fn, save_json_fn):
    save_json_fn(get_notifications_file_fn(user_id), notifications)


def load_notifications(
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    load_notifications_db_fn,
    load_notifications_json_fn,
):
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            return load_notifications_db_fn(session, user_id)
    return load_notifications_json_fn(user_id)


def save_notifications(
    notifications,
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    save_notifications_db_fn,
    json_mirror_enabled,
    save_notifications_json_fn,
):
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            save_notifications_db_fn(session, user_id, notifications)
        if json_mirror_enabled:
            save_notifications_json_fn(notifications, user_id)
        return
    save_notifications_json_fn(notifications, user_id)


def load_watchlist_json(
    user_id=None,
    *,
    base_dir,
    get_watchlist_file_fn,
    allow_legacy_seed,
    load_json_fn,
):
    legacy_watchlist_file = os.path.join(base_dir, "watchlist.json")
    user_path = get_watchlist_file_fn(user_id) if user_id else legacy_watchlist_file
    source_path = user_path
    if user_id and should_seed_from_legacy(allow_legacy_seed, user_path, legacy_watchlist_file):
        source_path = legacy_watchlist_file
    data = load_json_fn(source_path, [])
    if not isinstance(data, list):
        return []
    return sorted(list({str(t).upper() for t in data if str(t).strip()}))


def save_watchlist_json(tickers, user_id=None, *, get_watchlist_file_fn, save_json_fn):
    normalized = sorted(list({str(t).upper() for t in tickers if str(t).strip()}))
    save_json_fn(get_watchlist_file_fn(user_id), normalized)


def load_watchlist(
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    load_watchlist_db_fn,
    load_watchlist_json_fn,
):
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            return load_watchlist_db_fn(session, user_id)
    return load_watchlist_json_fn(user_id)


def save_watchlist(
    tickers,
    user_id=None,
    *,
    sql_enabled,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url,
    save_watchlist_db_fn,
    json_mirror_enabled,
    save_watchlist_json_fn,
):
    normalized = sorted(list({str(t).upper() for t in tickers if str(t).strip()}))
    if user_id and sql_enabled:
        ensure_user_state_storage_ready_fn()
        with session_scope(database_url) as session:
            save_watchlist_db_fn(session, user_id, normalized)
        if json_mirror_enabled:
            save_watchlist_json_fn(normalized, user_id)
        return
    save_watchlist_json_fn(normalized, user_id)


def record_portfolio_snapshot_legacy(portfolio_data, user_id, *, get_db_fn, logger, datetime_cls):
    total_value = portfolio_data["cash"]
    for _, pos in portfolio_data.get("positions", {}).items():
        total_value += pos["shares"] * pos["avg_cost"]
    for _, pos in portfolio_data.get("options_positions", {}).items():
        total_value += pos["quantity"] * pos["avg_cost"] * 100
    conn = None
    try:
        conn = get_db_fn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO portfolio_history (timestamp, portfolio_value, user_id) VALUES (?, ?, ?)",
            (datetime_cls.now(), total_value, user_id),
        )
        conn.commit()
    except Exception as exc:
        logger.error("Failed to record portfolio snapshot: %s", exc)
    finally:
        if conn:
            conn.close()
