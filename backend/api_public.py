from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from threading import RLock
from typing import Any, Callable, Dict, Optional

from flask import g, request

try:
    import redis as redis_module  # type: ignore
except ImportError:  # pragma: no cover - optional dependency at runtime
    redis_module = None


class PublicApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = int(status_code)
        self.code = str(code)
        self.message = str(message)


@dataclass(frozen=True)
class PublicApiReadiness:
    ok: bool
    status_code: int
    code: str
    message: str


class InMemoryPublicApiCache:
    def __init__(self) -> None:
        self._store: Dict[str, tuple[float, Any]] = {}
        self._lock = RLock()

    def get(self, key: str) -> Any | None:
        now = time.time()
        with self._lock:
            item = self._store.get(key)
            if item is None:
                return None
            expires_at, value = item
            if expires_at <= now:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        expires_at = time.time() + max(int(ttl_seconds), 1)
        with self._lock:
            self._store[key] = (expires_at, value)


class RedisPublicApiCache:
    def __init__(self, cache_url: str):
        if redis_module is None:
            raise RuntimeError("redis package is not installed")
        self._client = redis_module.from_url(cache_url, decode_responses=True)

    def get(self, key: str) -> Any | None:
        raw = self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._client.setex(key, max(int(ttl_seconds), 1), json.dumps(value))


_PUBLIC_CACHE_BACKEND: Any | None = None
_PUBLIC_CACHE_BACKEND_KEY: str | None = None


def is_public_api_request(path: str | None) -> bool:
    return str(path or "").startswith("/api/public/")


def normalize_enabled(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def build_public_api_readiness(
    *,
    enabled: Any,
    persistence_mode: str,
    database_url: str,
    key_hash_pepper: str,
    rate_limit_storage_url: str,
) -> PublicApiReadiness:
    if not normalize_enabled(enabled):
        return PublicApiReadiness(False, 404, "not_found", "MarketMind Public API is not enabled.")
    normalized_mode = str(persistence_mode or "").strip().lower()
    if normalized_mode != "postgres":
        return PublicApiReadiness(
            False,
            503,
            "internal_error",
            "MarketMind Public API requires PERSISTENCE_MODE=postgres.",
        )
    if not str(database_url or "").strip():
        return PublicApiReadiness(False, 503, "internal_error", "MarketMind Public API requires DATABASE_URL.")
    if not str(key_hash_pepper or "").strip():
        return PublicApiReadiness(
            False,
            503,
            "internal_error",
            "MarketMind Public API requires PUBLIC_API_KEY_HASH_PEPPER.",
        )
    if not str(rate_limit_storage_url or "").strip():
        return PublicApiReadiness(
            False,
            503,
            "internal_error",
            "MarketMind Public API requires PUBLIC_API_RATE_LIMIT_STORAGE_URL.",
        )
    return PublicApiReadiness(True, 200, "ok", "ready")


def begin_public_request() -> None:
    if not is_public_api_request(request.path):
        return
    g.public_api_request_id = uuid.uuid4().hex
    g.public_api_started_at = time.time()
    g.public_api_cache_status = "BYPASS"
    g.public_api_account_request = False
    g.public_api_authenticated = False


def public_error_payload(code: str, message: str, *, request_id: str | None = None) -> Dict[str, Any]:
    payload = {
        "error": {
            "code": str(code),
            "message": str(message),
            "request_id": request_id or getattr(g, "public_api_request_id", None),
        }
    }
    return payload


def public_error_response(jsonify_fn, status_code: int, code: str, message: str):
    return jsonify_fn(public_error_payload(code, message)), int(status_code)


def unwrap_handler_result(result: Any) -> tuple[Any, int]:
    if isinstance(result, tuple) and len(result) == 2:
        payload, status_code = result
        return payload, int(status_code)
    return result, 200


def build_api_key_hash(api_key: str, pepper: str) -> str:
    return hashlib.sha256(f"{pepper}:{api_key}".encode("utf-8")).hexdigest()


def generate_marketmind_developer_api_key() -> tuple[str, str]:
    prefix = f"mmpk_{secrets.token_hex(4)}"
    secret = secrets.token_urlsafe(32).replace("-", "").replace("_", "")
    return prefix, f"{prefix}.{secret}"


def extract_public_api_key_prefix(api_key: str | None) -> str | None:
    candidate = str(api_key or "").strip()
    if not candidate.startswith("mmpk_") or "." not in candidate:
        return None
    prefix, _ = candidate.split(".", 1)
    return prefix or None


def public_rate_limit_key(remote_addr: str | None = None) -> str:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.split(" ", 1)[1].strip() if auth_header.startswith("Bearer ") else ""
    prefix = extract_public_api_key_prefix(token)
    if prefix:
        return f"public-key:{prefix}"
    return f"public-ip:{remote_addr or 'unknown'}"


def public_global_rate_limit_key() -> str:
    return "marketmind-public-api-global"


def build_public_cache_key(route_group: str, *, path_params: Dict[str, Any] | None = None, query_params: Dict[str, Any] | None = None) -> str:
    payload = {
        "route_group": str(route_group or "unknown").strip().lower(),
        "path_params": dict(path_params or {}),
        "query_params": dict(sorted((query_params or {}).items())),
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    return f"marketmind-public:{payload['route_group']}:{digest}"


def get_public_cache(cache_url: str | None, *, logger) -> Any:
    global _PUBLIC_CACHE_BACKEND, _PUBLIC_CACHE_BACKEND_KEY
    cache_key = str(cache_url or "").strip()
    if _PUBLIC_CACHE_BACKEND is not None and _PUBLIC_CACHE_BACKEND_KEY == cache_key:
        return _PUBLIC_CACHE_BACKEND

    if cache_key:
        try:
            _PUBLIC_CACHE_BACKEND = RedisPublicApiCache(cache_key)
            _PUBLIC_CACHE_BACKEND_KEY = cache_key
            logger.info("Public API cache backend configured: redis")
            return _PUBLIC_CACHE_BACKEND
        except Exception as exc:  # pragma: no cover - depends on optional runtime dependency
            logger.warning("Public API cache backend unavailable (%s). Falling back to in-memory cache.", exc)

    _PUBLIC_CACHE_BACKEND = InMemoryPublicApiCache()
    _PUBLIC_CACHE_BACKEND_KEY = cache_key
    return _PUBLIC_CACHE_BACKEND


def get_cached_public_response(cache_backend: Any, cache_key: str) -> Any | None:
    return cache_backend.get(cache_key)


def set_cached_public_response(cache_backend: Any, cache_key: str, payload: Any, status_code: int, ttl_seconds: int) -> None:
    cache_backend.set(
        cache_key,
        {"payload": payload, "status_code": int(status_code)},
        ttl_seconds,
    )


def authenticate_public_api_key(
    token: str | None,
    *,
    session_scope_fn,
    database_url: str,
    key_hash_pepper: str,
    get_public_api_key_by_prefix_fn,
    get_public_api_client_fn,
) -> Dict[str, Any]:
    raw_token = str(token or "").strip()
    if not raw_token:
        raise PublicApiError(401, "invalid_api_key", "Missing Authorization Bearer token.")

    key_prefix = extract_public_api_key_prefix(raw_token)
    if not key_prefix:
        raise PublicApiError(401, "invalid_api_key", "Invalid MarketMind developer API key.")

    with session_scope_fn(database_url) as session:
        api_key = get_public_api_key_by_prefix_fn(session, key_prefix)
        if api_key is None:
            raise PublicApiError(401, "invalid_api_key", "Invalid MarketMind developer API key.")

        expected_hash = build_api_key_hash(raw_token, key_hash_pepper)
        if not hmac.compare_digest(str(api_key.key_hash or ""), expected_hash):
            raise PublicApiError(401, "invalid_api_key", "Invalid MarketMind developer API key.")

        status = str(api_key.status or "active").strip().lower()
        if status == "revoked":
            raise PublicApiError(401, "api_key_revoked", "This MarketMind developer API key has been revoked.")
        if status == "disabled":
            raise PublicApiError(401, "api_key_revoked", "This MarketMind developer API key is disabled.")

        if api_key.expires_at and api_key.expires_at <= datetime.now(timezone.utc):
            raise PublicApiError(401, "api_key_expired", "This MarketMind developer API key has expired.")

        client = get_public_api_client_fn(session, api_key.client_id)
        if client is None:
            raise PublicApiError(401, "invalid_api_key", "Invalid MarketMind developer API key.")
        if str(client.status or "active").strip().lower() != "active":
            raise PublicApiError(403, "access_denied", "This API client is disabled.")

        return {
            "client_id": str(client.id),
            "client_name": client.name,
            "client_status": client.status,
            "api_key_id": str(api_key.id),
            "api_key_prefix": api_key.key_prefix,
            "api_key_label": api_key.label,
            "api_key_status": api_key.status,
        }


def build_require_public_api_auth(
    view_fn,
    *,
    route_group: str,
    enabled_fn: Callable[[], bool],
    readiness_fn: Callable[[], PublicApiReadiness],
    token_getter: Callable[[], str | None],
    authenticate_key_fn: Callable[[str | None], Dict[str, Any]],
    get_daily_quota_fn: Callable[[Dict[str, Any]], int],
    get_daily_usage_total_fn: Callable[[Dict[str, Any], date], int],
    logger,
    error_response_fn: Callable[[int, str, str], Any],
):
    def wrapper(*args, **kwargs):
        g.public_api_route_group = route_group

        if not enabled_fn():
            return error_response_fn(404, "not_found", "MarketMind Public API is not enabled.")

        readiness = readiness_fn()
        if not readiness.ok:
            return error_response_fn(readiness.status_code, readiness.code, readiness.message)

        try:
            identity = authenticate_key_fn(token_getter())
        except PublicApiError as exc:
            logger.info("public_api auth failed route=%s code=%s", route_group, exc.code)
            return error_response_fn(exc.status_code, exc.code, exc.message)

        today = datetime.now(timezone.utc).date()
        daily_quota = max(int(get_daily_quota_fn(identity)), 1)
        daily_used = int(get_daily_usage_total_fn(identity, today))
        if daily_used >= daily_quota:
            g.public_api_identity = identity
            g.public_api_authenticated = True
            g.public_api_daily_quota = daily_quota
            g.public_api_daily_used_before = daily_used
            g.public_api_account_request = False
            return error_response_fn(429, "quota_exceeded", "Daily quota exceeded for this API key.")

        g.public_api_identity = identity
        g.public_api_authenticated = True
        g.public_api_daily_quota = daily_quota
        g.public_api_daily_used_before = daily_used
        g.public_api_account_request = True
        return view_fn(*args, **kwargs)

    wrapper.__name__ = getattr(view_fn, "__name__", "public_api_wrapper")
    wrapper.__doc__ = getattr(view_fn, "__doc__", None)
    return wrapper


def finalize_public_response(
    response,
    *,
    session_scope_fn,
    database_url: str,
    increment_public_api_daily_usage_fn,
    touch_public_api_key_last_used_fn,
    logger,
):
    if not is_public_api_request(getattr(request, "path", "")):
        return response

    request_id = getattr(g, "public_api_request_id", None)
    if request_id:
        response.headers["X-Request-ID"] = request_id

    cache_status = getattr(g, "public_api_cache_status", None)
    if cache_status:
        response.headers["X-Cache"] = cache_status

    identity = getattr(g, "public_api_identity", None)
    quota = int(getattr(g, "public_api_daily_quota", 0) or 0)
    used_before = int(getattr(g, "public_api_daily_used_before", 0) or 0)
    incremented = False

    if identity and getattr(g, "public_api_account_request", False):
        try:
            with session_scope_fn(database_url) as session:
                increment_public_api_daily_usage_fn(
                    session,
                    client_id=identity["client_id"],
                    api_key_id=identity["api_key_id"],
                    day_value=datetime.now(timezone.utc).date(),
                    route_group=getattr(g, "public_api_route_group", "unknown"),
                    cached=str(cache_status or "").upper() == "HIT",
                )
                touch_public_api_key_last_used_fn(session, identity["api_key_id"])
            incremented = True
        except Exception as exc:  # pragma: no cover - defensive path
            logger.warning("public_api accounting failed request_id=%s error=%s", request_id, exc)

    if identity:
        used_after = used_before + (1 if incremented else 0)
        if quota > 0:
            response.headers["X-Public-API-Daily-Quota"] = str(quota)
            response.headers["X-Public-API-Daily-Remaining"] = str(max(quota - used_after, 0))
        response.headers["X-Public-API-Client-Id"] = str(identity.get("client_id", ""))
        response.headers["X-Public-API-Key-Prefix"] = str(identity.get("api_key_prefix", ""))

    started_at = getattr(g, "public_api_started_at", None)
    latency_ms = int((time.time() - started_at) * 1000) if started_at else None
    logger.info(
        "public_api request_id=%s client_id=%s key_prefix=%s route_group=%s status=%s latency_ms=%s cache=%s",
        request_id,
        getattr(identity, "get", lambda *_: None)("client_id") if identity else None,
        getattr(identity, "get", lambda *_: None)("api_key_prefix") if identity else None,
        getattr(g, "public_api_route_group", None),
        getattr(response, "status_code", None),
        latency_ms,
        cache_status,
    )
    return response
