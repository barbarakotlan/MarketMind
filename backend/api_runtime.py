from __future__ import annotations

import json
import os
import re
import uuid
from typing import Any, Callable, Dict

try:
    import redis as redis_module
except ImportError:  # pragma: no cover - installed in the production graph
    redis_module = None


REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9._:-]{1,128}")
ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    413: "request_too_large",
    429: "rate_limited",
    503: "service_unavailable",
}


def begin_request(request_obj: Any, g_obj: Any, begin_public_request_fn: Callable[[], None]) -> str:
    supplied = request_obj.headers.get("X-Request-ID", "").strip()
    request_id = supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else uuid.uuid4().hex
    g_obj.request_id = request_id
    begin_public_request_fn()
    return request_id


def _normalize_error_payload(response: Any, request_id: str) -> None:
    payload = response.get_json(silent=True) if response.is_json else None
    if not isinstance(payload, dict):
        return
    raw_error = payload.get("error")
    if isinstance(raw_error, dict):
        message = str(raw_error.get("message") or "Request failed.")
        code = str(raw_error.get("code") or payload.get("code") or "request_failed")
    else:
        message = str(raw_error or payload.get("message") or "Request failed.")
        code = str(payload.get("code") or ERROR_CODES.get(response.status_code, "internal_error"))
    payload.update(error=message, code=code, request_id=request_id)
    response.set_data(json.dumps(payload, separators=(",", ":")))
    response.content_type = "application/json"


def prepare_response(
    response: Any,
    *,
    request_id: str | None,
    is_public_api: bool,
    is_production: bool,
    content_security_policy: str,
) -> Any:
    if request_id:
        response.headers["X-Request-ID"] = request_id
    if response.status_code >= 400 and not is_public_api:
        _normalize_error_payload(response, request_id or uuid.uuid4().hex)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = content_security_policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-site" if is_production else "cross-origin"
    return response


def probe_redis(url: str) -> None:
    if redis_module is None:
        raise RuntimeError("redis package is not installed")
    client = redis_module.from_url(url, socket_connect_timeout=1, socket_timeout=1)
    try:
        if not client.ping():
            raise RuntimeError("Redis ping failed")
    finally:
        client.close()


def _probe_storage(
    *,
    sql_enabled: bool,
    ensure_storage_ready_fn: Callable[[], None],
    session_scope_fn: Callable[[str], Any],
    database_url: str,
    sql_text_fn: Callable[[str], Any],
    user_data_dir: str,
) -> None:
    if sql_enabled:
        ensure_storage_ready_fn()
        with session_scope_fn(database_url) as session:
            session.execute(sql_text_fn("SELECT 1"))
        return
    os.makedirs(user_data_dir, exist_ok=True)
    if not os.access(user_data_dir, os.R_OK | os.W_OK):
        raise PermissionError("User data directory is not writable")


def build_readiness_checks(
    *,
    sql_enabled: bool,
    ensure_storage_ready_fn: Callable[[], None],
    session_scope_fn: Callable[[str], Any],
    database_url: str,
    sql_text_fn: Callable[[str], Any],
    user_data_dir: str,
    rate_limit_storage_url: str,
    public_api_cache_url: str,
    probe_redis_fn: Callable[[str], None],
    logger: Any,
) -> tuple[bool, Dict[str, Dict[str, str]]]:
    checks: Dict[str, Dict[str, str]] = {}
    try:
        _probe_storage(
            sql_enabled=sql_enabled,
            ensure_storage_ready_fn=ensure_storage_ready_fn,
            session_scope_fn=session_scope_fn,
            database_url=database_url,
            sql_text_fn=sql_text_fn,
            user_data_dir=user_data_dir,
        )
        checks["storage"] = {"status": "ok"}
    except Exception as exc:
        logger.error("Readiness storage probe failed: %s", exc)
        checks["storage"] = {"status": "error", "type": type(exc).__name__}

    redis_urls = {
        "rate_limit_store": rate_limit_storage_url,
        "public_api_cache": public_api_cache_url,
    }
    probed_urls: Dict[str, Dict[str, str]] = {}
    for name, url in redis_urls.items():
        normalized_url = str(url or "").strip()
        if not normalized_url:
            checks[name] = {"status": "not_configured"}
            continue
        if normalized_url not in probed_urls:
            try:
                probe_redis_fn(normalized_url)
                probed_urls[normalized_url] = {"status": "ok"}
            except Exception as exc:
                logger.error("Readiness %s probe failed: %s", name, exc)
                probed_urls[normalized_url] = {"status": "error", "type": type(exc).__name__}
        checks[name] = dict(probed_urls[normalized_url])

    is_ready = all(check["status"] in {"ok", "not_configured"} for check in checks.values())
    return is_ready, checks
