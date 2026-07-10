from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Callable, Iterator

from sqlalchemy import create_engine, text


logger = logging.getLogger("marketmind_alert_worker")
SCHEDULER_ADVISORY_LOCK_ID = 4_607_307_258


def _normalized_database_url(database_url: str) -> str:
    value = str(database_url or "").strip()
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value[len("postgres://") :]
    if value.startswith("postgresql://") and "+psycopg" not in value:
        return "postgresql+psycopg://" + value[len("postgresql://") :]
    return value


@contextmanager
def scheduler_leader_lock(
    database_url: str,
    *,
    lock_path: str,
    blocking: bool = True,
) -> Iterator[bool]:
    normalized_url = _normalized_database_url(database_url)
    if normalized_url.startswith("postgresql"):
        engine = create_engine(normalized_url, future=True)
        connection = engine.connect()
        try:
            if blocking:
                connection.execute(
                    text("SELECT pg_advisory_lock(:lock_id)"),
                    {"lock_id": SCHEDULER_ADVISORY_LOCK_ID},
                )
                acquired = True
            else:
                acquired = bool(
                    connection.scalar(
                        text("SELECT pg_try_advisory_lock(:lock_id)"),
                        {"lock_id": SCHEDULER_ADVISORY_LOCK_ID},
                    )
                )
            yield acquired
            if acquired:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"),
                    {"lock_id": SCHEDULER_ADVISORY_LOCK_ID},
                )
        finally:
            connection.close()
            engine.dispose()
        return

    import fcntl

    os.makedirs(os.path.dirname(os.path.abspath(lock_path)), exist_ok=True)
    with open(lock_path, "a+", encoding="utf-8") as lock_file:
        flags = fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB)
        try:
            fcntl.flock(lock_file.fileno(), flags)
        except BlockingIOError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def run_alert_worker(
    *,
    database_url: str,
    lock_path: str,
    initialize_fn: Callable[[], None],
    run_scheduler_fn: Callable[[], None],
    blocking_lock: bool = True,
) -> int:
    logger.info("Waiting for the alert-worker leader lock")
    with scheduler_leader_lock(
        database_url,
        lock_path=lock_path,
        blocking=blocking_lock,
    ) as acquired:
        if not acquired:
            logger.info("Another alert worker owns the leader lock; exiting")
            return 0
        logger.info("Alert-worker leader lock acquired")
        initialize_fn()
        run_scheduler_fn()
    return 0


def main() -> int:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s | %(levelname)s | %(message)s",
    )
    from api import (
        BASE_DIR,
        DATABASE_URL,
        _ensure_user_state_storage_ready,
        _sql_persistence_enabled,
        init_db,
        run_scheduler,
    )

    def initialize() -> None:
        init_db()
        if _sql_persistence_enabled():
            _ensure_user_state_storage_ready()

    return run_alert_worker(
        database_url=DATABASE_URL,
        lock_path=os.getenv(
            "ALERT_WORKER_LOCK_PATH",
            os.path.join(BASE_DIR, ".alert-worker.lock"),
        ),
        initialize_fn=initialize,
        run_scheduler_fn=run_scheduler,
    )


if __name__ == "__main__":
    raise SystemExit(main())
