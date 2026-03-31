from __future__ import annotations

import json
import time
from functools import wraps

import jwt
import requests


def get_bearer_token(auth_header: str) -> str | None:
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()


def resolve_clerk_jwks_url(clerk_jwks_url: str, issuer: str | None) -> str | None:
    if clerk_jwks_url:
        return clerk_jwks_url
    if not issuer:
        return None
    return issuer.rstrip("/") + "/.well-known/jwks.json"


def fetch_jwks(
    jwks_url: str,
    *,
    cache: dict,
    cache_ttl_seconds: int,
    requests_get=requests.get,
    time_fn=time.time,
):
    now = time_fn()
    cached = cache.get(jwks_url)
    if cached and (now - cached["fetched_at"]) < cache_ttl_seconds:
        return cached["jwks"]

    response = requests_get(jwks_url, timeout=5)
    response.raise_for_status()
    jwks = response.json()
    cache[jwks_url] = {"jwks": jwks, "fetched_at": now}
    return jwks


def get_signing_key(token: str, jwks_url: str, *, fetch_jwks_fn, jwt_module=jwt):
    header = jwt_module.get_unverified_header(token)
    kid = header.get("kid")
    if not kid:
        raise ValueError("Missing token header 'kid'")

    jwks = fetch_jwks_fn(jwks_url)
    for jwk_key in jwks.get("keys", []):
        if jwk_key.get("kid") == kid:
            return jwt_module.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk_key))

    raise ValueError("Matching signing key not found in JWKS")


def verify_clerk_token(
    token: str,
    *,
    clerk_jwks_url: str,
    clerk_audience: str,
    jwks_cache_ttl_seconds: int,
    jwks_cache: dict,
    requests_get=requests.get,
    jwt_module=jwt,
    time_fn=time.time,
):
    unverified_payload = jwt_module.decode(
        token,
        options={
            "verify_signature": False,
            "verify_aud": False,
            "verify_iss": False,
            "verify_exp": False,
        },
    )
    issuer = unverified_payload.get("iss")
    jwks_url = resolve_clerk_jwks_url(clerk_jwks_url, issuer)
    if not jwks_url:
        raise ValueError("Unable to resolve Clerk JWKS URL")

    signing_key = get_signing_key(
        token,
        jwks_url,
        fetch_jwks_fn=lambda url: fetch_jwks(
            url,
            cache=jwks_cache,
            cache_ttl_seconds=jwks_cache_ttl_seconds,
            requests_get=requests_get,
            time_fn=time_fn,
        ),
        jwt_module=jwt_module,
    )

    decode_kwargs = {
        "key": signing_key,
        "algorithms": ["RS256"],
        "options": {"verify_aud": bool(clerk_audience)},
    }
    if issuer:
        decode_kwargs["issuer"] = issuer
    if clerk_audience:
        decode_kwargs["audience"] = clerk_audience

    payload = jwt_module.decode(token, **decode_kwargs)
    if not payload.get("sub"):
        raise ValueError("Token is missing 'sub' claim")
    return payload


def current_auth_identity(payload: dict | None):
    payload = payload or {}
    return {
        "email": payload.get("email"),
        "username": payload.get("username"),
    }


def sync_authenticated_user(
    payload: dict,
    *,
    sql_persistence_enabled: bool,
    ensure_user_state_storage_ready_fn,
    session_scope,
    database_url: str,
    touch_app_user_fn,
):
    if not sql_persistence_enabled:
        return

    ensure_user_state_storage_ready_fn()
    with session_scope(database_url) as session:
        touch_app_user_fn(
            session,
            payload["sub"],
            email=payload.get("email"),
            username=payload.get("username"),
        )


def build_require_auth(
    view_fn,
    *,
    token_getter,
    verify_token_fn,
    sync_authenticated_user_fn,
    logger,
    unauthorized_response_fn,
    set_request_identity_fn,
):
    @wraps(view_fn)
    def wrapper(*args, **kwargs):
        token = token_getter()
        if not token:
            return unauthorized_response_fn("Missing Authorization Bearer token", 401)

        try:
            payload = verify_token_fn(token)
        except Exception as exc:
            logger.warning("Auth verification failed: %s", exc)
            return unauthorized_response_fn("Invalid or expired token", 401)

        set_request_identity_fn(payload)
        sync_authenticated_user_fn(payload)
        return view_fn(*args, **kwargs)

    return wrapper
