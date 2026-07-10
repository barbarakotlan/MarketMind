from __future__ import annotations

from typing import Any, Tuple


DEFAULT_CONNECT_TIMEOUT_SECONDS = 3.05
DEFAULT_READ_TIMEOUT_SECONDS = 15
DEFAULT_HTTP_TIMEOUT: Tuple[float, int] = (
    DEFAULT_CONNECT_TIMEOUT_SECONDS,
    DEFAULT_READ_TIMEOUT_SECONDS,
)


def timeout(read_seconds: int = DEFAULT_READ_TIMEOUT_SECONDS) -> Tuple[float, int]:
    return DEFAULT_CONNECT_TIMEOUT_SECONDS, read_seconds


def ensure_success(response: Any) -> Any:
    raise_for_status = getattr(response, "raise_for_status", None)
    if callable(raise_for_status):
        raise_for_status()
        return response

    status_code = int(getattr(response, "status_code", 200) or 200)
    if status_code >= 400:
        raise RuntimeError(f"Upstream HTTP request failed with status {status_code}")
    return response
