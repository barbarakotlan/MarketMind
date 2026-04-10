# To run this file, you need to install all dependencies:
# pip install Flask Flask-CORS yfinance pandas scikit-learn numpy requests python-dotenv statsmodels finnhub-python vaderSentiment xgboost schedule statsforecast mlforecast shap pyportfolioopt

import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import yfinance as yf
import pandas as pd
import numpy as np
import requests
from flask import Flask, jsonify, request, g, send_file
from flask_cors import CORS
from datetime import datetime, timedelta, date, timezone
import json
import sqlite3
import schedule
import time
import threading
import uuid  # For unique notification IDs
import re  # Added for Smart Alert parsing
import math
from io import BytesIO
from functools import wraps

# --- DOTENV MUST BE FIRST ---
from dotenv import load_dotenv

CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT_DIR = os.path.dirname(CURRENT_FILE_DIR)
load_dotenv(os.path.join(PROJECT_ROOT_DIR, '.env'))
load_dotenv(os.path.join(CURRENT_FILE_DIR, '.env'), override=True)
# --- END FIX ---

# --- OpenBB (optional, used for financials/filings/screener/macro) ---
try:
    from openbb import obb
    OPENBB_AVAILABLE = True
except ImportError:
    OPENBB_AVAILABLE = False

# --- Imports ---
from news_fetcher import get_general_news
from models import create_dataset, ensemble_predict, linear_regression_predict, random_forest_predict, xgboost_predict, gradient_boosting_predict, lstm_train, lstm_predict, transformer_train, transformer_predict
from professional_evaluation import rolling_window_backtest
try:
    from selective_prediction import (
        infer_selective_decision,
        SELECTIVE_MODES,
        SELECTIVE_DISABLED_STATUSES,
        SELECTOR_SOURCE_REQUESTABLE,
    )
except ImportError:
    SELECTIVE_MODES = {"none", "conservative", "aggressive", "risk_conservative", "risk_aggressive"}
    SELECTIVE_DISABLED_STATUSES = set()
    SELECTOR_SOURCE_REQUESTABLE = {"auto"}

    def infer_selective_decision(
        ticker,
        requested_mode="none",
        selector_source_requested="auto",
        raw_signal=0.0,
        ensemble_disagreement=0.0,
        config=None,
        artifact_root=None,
        logger=None,
    ):
        return {
            "ticker": str(ticker or "").upper(),
            "mode_requested": str(requested_mode or "none").lower(),
            "abstain": False,
            "abstain_reason": None,
            "selector_prob": None,
            "selector_threshold": None,
            "selector_status": "unavailable",
            "selector_source_requested": str(selector_source_requested or "auto").lower(),
            "selector_source": "none",
            "raw_signal": float(raw_signal or 0.0),
            "ensemble_disagreement": float(ensemble_disagreement or 0.0),
        }
from forex_fetcher import get_exchange_rate, get_currency_list
from crypto_fetcher import get_crypto_exchange_rate, get_crypto_list, get_target_currencies
from commodities_fetcher import get_commodity_price, get_commodity_list, get_commodities_by_category
from prediction_markets_fetcher import (
    fetch_markets as pm_fetch_markets,
    search_markets as pm_search_markets,
    get_market_by_id as pm_get_market,
    get_exchange_list as pm_get_exchanges,
    get_current_prices as pm_get_prices,
)
from prediction_market_analysis import (
    PredictionMarketAnalysisError,
    analyze_prediction_market as pm_analyze_market,
)
import akshare_service
import exchange_session_service
import portfolio_optimization_service
import screener_query_service
import sec_filings_service
import prediction_service
from asset_identity import parse_asset_reference
from logger_config import setup_logger, log_api_error
from deliverables import (
    DOCX_MIME_TYPE,
    DeliverableError,
    add_deliverable_review,
    build_deliverable_context,
    create_deliverable,
    create_deliverable_preflight,
    generate_deliverable_memo,
    get_deliverable_detail,
    get_deliverable_memo_artifact,
    list_deliverable_memos,
    list_deliverables,
    replace_deliverable_assumptions,
    update_deliverable,
)
from marketmind_ai import (
    MarketMindAIError,
    build_marketmind_ai_context,
    create_artifact_preflight,
    delete_marketmind_ai_chat,
    generate_marketmind_ai_artifact,
    generate_marketmind_ai_reply,
    get_bootstrap_payload as get_marketmind_ai_bootstrap_payload,
    get_marketmind_ai_artifact_detail,
    get_marketmind_ai_artifact_download,
    get_marketmind_ai_chat_detail,
    get_marketmind_ai_retrieval_status,
    list_marketmind_ai_artifacts,
    list_marketmind_ai_chats,
)
from user_state_store import (
    AppUser,
    create_public_api_client as create_public_api_client_db,
    create_public_api_key as create_public_api_key_db,
    ensure_database_ready as ensure_user_state_database_ready,
    get_public_api_client as get_public_api_client_db,
    get_public_api_daily_request_total as get_public_api_daily_request_total_db,
    get_public_api_key_by_prefix as get_public_api_key_by_prefix_db,
    increment_public_api_daily_usage as increment_public_api_daily_usage_db,
    list_app_user_ids as list_app_user_ids_db,
    list_public_api_clients as list_public_api_clients_db,
    list_public_api_daily_usage as list_public_api_daily_usage_db,
    list_public_api_keys as list_public_api_keys_db,
    load_notifications as load_notifications_db,
    load_portfolio as load_portfolio_db,
    load_prediction_portfolio as load_prediction_portfolio_db,
    load_watchlist as load_watchlist_db,
    record_portfolio_snapshot as record_portfolio_snapshot_db,
    save_notifications as save_notifications_db,
    save_portfolio as save_portfolio_db,
    save_prediction_portfolio as save_prediction_portfolio_db,
    save_watchlist as save_watchlist_db,
    session_scope as user_state_session_scope,
    set_public_api_key_status as set_public_api_key_status_db,
    touch_public_api_key_last_used as touch_public_api_key_last_used_db,
    touch_app_user as touch_app_user_db,
)
from subscription_limits import FREE_PLAN, PRO_PLAN, limit_for_plan, normalize_plan

#Emoji Fix
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# --- New Imports for Options Suggester ---
from options_suggester import generate_suggestion
from checkout_endpoint import checkout_bp
import api_auth as api_auth_helpers
import api_handlers_deliverables as deliverables_handlers
import api_handlers_market_data as market_data_handlers
import api_handlers_marketmind_ai as marketmind_ai_handlers
import api_handlers_notifications as notification_handlers
import api_handlers_public as public_handlers
import api_handlers_paper as paper_handlers
import api_handlers_prediction_markets as prediction_markets_handlers
import api_handlers_reference_data as reference_data_handlers
import api_market_utils as api_market_utils_helpers
import api_public as api_public_helpers
import api_prediction_runtime as api_prediction_runtime_helpers
import api_scheduler as api_scheduler_helpers
import api_state as api_state_helpers

# Initialize logger
import logging

logger = logging.getLogger("marketmind_api")
logger.setLevel(logging.INFO)

handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
handler.setStream(sys.stdout)
logger.addHandler(handler)

logger.info("🚀 MarketMind API Starting...")

# Initialize the Flask application
app = Flask(__name__)

# --- Security Configuration ---
# Set Flask secret key for session management
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', os.urandom(32))
app.register_blueprint(checkout_bp)
FLASK_ENV = os.getenv('FLASK_ENV', 'development').strip().lower()
IS_PRODUCTION = FLASK_ENV == 'production'

DEFAULT_DEV_CORS_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000'
CORS_ORIGINS_RAW = os.getenv('CORS_ORIGINS', DEFAULT_DEV_CORS_ORIGINS if not IS_PRODUCTION else '')
allowed_origins = [origin.strip().rstrip('/') for origin in CORS_ORIGINS_RAW.split(',') if origin.strip()]

if IS_PRODUCTION and not allowed_origins:
    raise ValueError("CORS_ORIGINS must be set in production (comma-separated origins).")

if not allowed_origins:
    allowed_origins = [origin.strip() for origin in DEFAULT_DEV_CORS_ORIGINS.split(',')]

CORS(
    app,
    resources={r"/*": {"origins": allowed_origins}},
    supports_credentials=False,
    allow_headers=["Content-Type", "Authorization", "Accept"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

# --- Security Headers Middleware ---
@app.before_request
def begin_public_api_request():
    api_public_helpers.begin_public_request()


@app.after_request
def add_security_headers(response):
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    # XSS Protection (legacy fallback for older browsers)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Force HTTPS in production
    if IS_PRODUCTION:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    # API-focused CSP (JSON API does not serve active web content)
    response.headers['Content-Security-Policy'] = os.getenv(
        'API_CONTENT_SECURITY_POLICY',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';"
    )
    # Referrer Policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # Permissions Policy
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    # Cross-origin hardening for API responses
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Resource-Policy'] = 'same-site' if IS_PRODUCTION else 'cross-origin'
    return api_public_helpers.finalize_public_response(
        response,
        session_scope_fn=user_state_session_scope,
        database_url=DATABASE_URL,
        increment_public_api_daily_usage_fn=increment_public_api_daily_usage_db,
        touch_public_api_key_last_used_fn=touch_public_api_key_last_used_db,
        logger=logger,
    )

# --- Rate Limiting Setup ---
from flask_limiter import Limiter
from flask_limiter.errors import RateLimitExceeded
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    app=app,
    headers_enabled=True,
    storage_uri=os.getenv('PUBLIC_API_RATE_LIMIT_STORAGE_URL', '').strip() or None,
)

# Define rate limits
class RateLimits:
    LIGHT = os.getenv('RATE_LIMIT_LIGHT', '10/minute')
    STANDARD = os.getenv('RATE_LIMIT_STANDARD', '20/minute')
    HEAVY = os.getenv('RATE_LIMIT_HEAVY', '2/minute')
    WRITE = os.getenv('RATE_LIMIT_WRITE', '5/minute')


@app.errorhandler(RateLimitExceeded)
def handle_rate_limit_exceeded(_exc):
    if api_public_helpers.is_public_api_request(request.path):
        return _public_api_error_response(429, "rate_limited", "Rate limit exceeded for this API key.")
    return jsonify({"error": "Rate limit exceeded"}), 429

# --- CONFIGURATION ---
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')

# Validate required environment variables in production
if IS_PRODUCTION:
    if not NEWS_API_KEY:
        logger.warning("⚠️ NEWS_API_KEY not set in production environment")
    if not ALPHA_VANTAGE_API_KEY:
        logger.warning("⚠️ ALPHA_VANTAGE_API_KEY not set in production environment")

# --- Paths & Auth Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'marketmind.db')
DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
PERSISTENCE_MODE = os.getenv('PERSISTENCE_MODE', 'json').strip().lower()
PUBLIC_API_ENABLED = os.getenv('PUBLIC_API_ENABLED', 'false').strip()
PUBLIC_API_DOCS_ENABLED = os.getenv('PUBLIC_API_DOCS_ENABLED', 'false').strip()
PUBLIC_API_KEY_HASH_PEPPER = os.getenv('PUBLIC_API_KEY_HASH_PEPPER', '').strip()
PUBLIC_API_RATE_LIMIT_STORAGE_URL = os.getenv('PUBLIC_API_RATE_LIMIT_STORAGE_URL', '').strip()
PUBLIC_API_CACHE_URL = os.getenv('PUBLIC_API_CACHE_URL', '').strip()
PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT = os.getenv('PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT', '30/minute').strip()
PUBLIC_API_DEFAULT_PER_HOUR_LIMIT = os.getenv('PUBLIC_API_DEFAULT_PER_HOUR_LIMIT', '500/hour').strip()
PUBLIC_API_DEFAULT_DAILY_QUOTA = int(os.getenv('PUBLIC_API_DEFAULT_DAILY_QUOTA', '2500'))
PUBLIC_API_GLOBAL_EMERGENCY_LIMIT = os.getenv('PUBLIC_API_GLOBAL_EMERGENCY_LIMIT', '5000/hour').strip()
PUBLIC_API_FALLBACK_IP_LIMIT = os.getenv('PUBLIC_API_FALLBACK_IP_LIMIT', '120/hour').strip()

PORTFOLIO_FILE = os.path.join(BASE_DIR, 'paper_portfolio.json')
NOTIFICATIONS_FILE = os.path.join(BASE_DIR, 'notifications.json')
PREDICTION_PORTFOLIO_FILE = os.path.join(BASE_DIR, 'prediction_portfolio.json')
USER_DATA_DIR = os.path.join(BASE_DIR, 'user_data')
PUBLIC_API_OPENAPI_PATH = os.path.join(BASE_DIR, 'public_api_openapi_v1.yaml')
PUBLIC_API_OPENAPI_V2_PATH = os.path.join(BASE_DIR, 'public_api_openapi_v2.yaml')
PUBLIC_API_DOCS_PATH = os.path.join(BASE_DIR, 'public_api_docs.html')
ALLOW_LEGACY_USER_DATA_SEED = os.getenv('ALLOW_LEGACY_USER_DATA_SEED', 'false').strip().lower() == 'true'

CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', '').strip()
CLERK_ISSUER = os.getenv('CLERK_ISSUER', '').strip()
CLERK_AUDIENCE = os.getenv('CLERK_AUDIENCE', '').strip()
CLERK_JWKS_CACHE_TTL_SECONDS = int(os.getenv('CLERK_JWKS_CACHE_TTL_SECONDS', '3600'))
_JWKS_CACHE = {}


def validate_production_runtime_security(
    *,
    flask_secret_key: str,
    clerk_jwks_url: str,
    clerk_issuer: str,
    allow_legacy_user_data_seed: bool,
):
    errors = []

    if not str(flask_secret_key or '').strip():
        errors.append("FLASK_SECRET_KEY environment variable is required in production")
    if not str(clerk_jwks_url or '').strip():
        errors.append("CLERK_JWKS_URL environment variable is required in production")
    if not str(clerk_issuer or '').strip():
        errors.append("CLERK_ISSUER environment variable is required in production")
    if allow_legacy_user_data_seed:
        errors.append("ALLOW_LEGACY_USER_DATA_SEED must be false in production")

    if errors:
        raise ValueError("; ".join(errors))


if IS_PRODUCTION:
    validate_production_runtime_security(
        flask_secret_key=os.getenv('FLASK_SECRET_KEY', ''),
        clerk_jwks_url=CLERK_JWKS_URL,
        clerk_issuer=CLERK_ISSUER,
        allow_legacy_user_data_seed=ALLOW_LEGACY_USER_DATA_SEED,
    )


def _normalize_persistence_mode(mode):
    return api_state_helpers.normalize_persistence_mode(mode, logger=logger)


def _current_persistence_mode():
    return api_state_helpers.current_persistence_mode(PERSISTENCE_MODE, logger=logger)


def _sql_persistence_enabled():
    return api_state_helpers.sql_persistence_enabled(PERSISTENCE_MODE, logger=logger)


def _json_mirror_enabled():
    return api_state_helpers.json_mirror_enabled(PERSISTENCE_MODE, logger=logger)


def _ensure_user_state_storage_ready():
    return api_state_helpers.ensure_user_state_storage_ready(
        sql_enabled=_sql_persistence_enabled(),
        ensure_database_ready_fn=ensure_user_state_database_ready,
        database_url=DATABASE_URL,
    )


def _deliverables_ready():
    return _sql_persistence_enabled() and bool(DATABASE_URL)


def _current_auth_identity():
    return api_auth_helpers.current_auth_identity(getattr(g, 'auth_payload', {}) or {})


def _sync_authenticated_user(payload):
    return api_auth_helpers.sync_authenticated_user(
        payload,
        sql_persistence_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        touch_app_user_fn=touch_app_user_db,
    )


def _get_current_plan(user_id=None):
    resolved_user_id = user_id or get_current_user_id()
    if not resolved_user_id or not _sql_persistence_enabled() or not DATABASE_URL:
        return FREE_PLAN

    _ensure_user_state_storage_ready()
    with user_state_session_scope(DATABASE_URL) as session:
        user = session.get(AppUser, resolved_user_id)
        if user is None:
            touch_app_user_db(session, resolved_user_id)
            return FREE_PLAN
        return normalize_plan(getattr(user, 'plan', FREE_PLAN))


def _subscription_limit(limit_key, user_id=None):
    return limit_for_plan(_get_current_plan(user_id), limit_key)


def _subscription_limit_response(message, *, limit_key=None, plan=None, status_code=403):
    payload = {
        "error": message,
        "code": "subscription_limit_reached",
        "plan": plan or _get_current_plan(),
    }
    if limit_key:
        payload["limitKey"] = limit_key
        payload["limit"] = _subscription_limit(limit_key)
    return jsonify(payload), status_code


def _usage_bucket_file(identity_key, filename):
    return _get_user_file_path(identity_key, filename)


def _load_usage_bucket(identity_key, filename):
    path = _usage_bucket_file(identity_key, filename)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            data = json.load(handle)
            return data if isinstance(data, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def _save_usage_bucket(identity_key, filename, payload):
    path = _usage_bucket_file(identity_key, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def _prediction_usage_identity():
    user_id = get_current_user_id()
    if user_id:
        return user_id
    remote_addr = request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or request.remote_addr or 'anonymous'
    return f"anon:{remote_addr}"


def _today_key():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def _prediction_usage_count(identity_key=None):
    usage = _load_usage_bucket(identity_key or _prediction_usage_identity(), 'prediction_usage.json')
    return int(usage.get(_today_key(), 0) or 0)


def _record_prediction_usage(identity_key=None):
    resolved_identity = identity_key or _prediction_usage_identity()
    usage = _load_usage_bucket(resolved_identity, 'prediction_usage.json')
    today_key = _today_key()
    usage = {today_key: int(usage.get(today_key, 0) or 0) + 1}
    _save_usage_bucket(resolved_identity, 'prediction_usage.json', usage)


def _paper_trade_count_this_month(user_id=None):
    portfolio = load_portfolio(user_id or get_current_user_id())
    current_month = datetime.now(timezone.utc).strftime('%Y-%m')
    total = 0
    for trade in portfolio.get('trade_history', []) or []:
        timestamp = str(trade.get('timestamp') or trade.get('date') or '')
        if timestamp.startswith(current_month):
            total += 1
    return total


def _prediction_market_trade_count_this_month(user_id=None):
    portfolio = load_prediction_portfolio(user_id or get_current_user_id())
    current_month = datetime.now(timezone.utc).strftime('%Y-%m')
    total = 0
    for trade in portfolio.get('trade_history', []) or []:
        timestamp = str(trade.get('timestamp') or '')
        if timestamp.startswith(current_month):
            total += 1
    return total


def _response_status_code(response):
    if isinstance(response, tuple):
        return int(response[1])
    return int(getattr(response, 'status_code', 200))


def _try_authenticate_optional_request():
    token = _get_clerk_bearer_token()
    if not token:
        return
    try:
        payload = verify_clerk_token(token)
    except Exception:
        return
    setattr(g, 'current_user_id', payload['sub'])
    setattr(g, 'auth_payload', payload)
    _sync_authenticated_user(payload)


def get_db():
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    return conn


def init_db():
    return api_state_helpers.init_history_db(get_db_fn=get_db, logger=logger)


def _safe_user_id(user_id):
    return api_state_helpers.safe_user_id(user_id)


def _get_user_file_path(user_id, filename):
    return api_state_helpers.get_user_file_path(user_id, filename, user_data_dir=USER_DATA_DIR)


def _iter_user_ids():
    return api_state_helpers.iter_user_ids(
        user_data_dir=USER_DATA_DIR,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        list_app_user_ids_db_fn=list_app_user_ids_db,
        logger=logger,
    )


def _get_bearer_token():
    return api_auth_helpers.get_bearer_token(request.headers.get('Authorization', ''))


def _get_clerk_bearer_token():
    token = _get_bearer_token()
    if api_public_helpers.extract_public_api_key_prefix(token):
        return None
    return token


def _resolve_clerk_jwks_url(issuer):
    return api_auth_helpers.resolve_clerk_jwks_url(
        CLERK_JWKS_URL,
        issuer,
        allow_unverified_issuer_fallback=not IS_PRODUCTION,
    )


def _fetch_jwks(jwks_url):
    return api_auth_helpers.fetch_jwks(
        jwks_url,
        cache=_JWKS_CACHE,
        cache_ttl_seconds=CLERK_JWKS_CACHE_TTL_SECONDS,
        requests_get=requests.get,
        time_fn=time.time,
    )


def _get_signing_key(token, jwks_url):
    return api_auth_helpers.get_signing_key(
        token,
        jwks_url,
        fetch_jwks_fn=_fetch_jwks,
    )


def verify_clerk_token(token):
    return api_auth_helpers.verify_clerk_token(
        token,
        clerk_jwks_url=CLERK_JWKS_URL,
        clerk_issuer=CLERK_ISSUER,
        clerk_audience=CLERK_AUDIENCE,
        jwks_cache_ttl_seconds=CLERK_JWKS_CACHE_TTL_SECONDS,
        jwks_cache=_JWKS_CACHE,
        is_production=IS_PRODUCTION,
        requests_get=requests.get,
        time_fn=time.time,
    )


def get_current_user_id():
    return getattr(g, 'current_user_id', None)


def require_auth(f):
    return api_auth_helpers.build_require_auth(
        f,
        token_getter=lambda: _get_clerk_bearer_token(),
        verify_token_fn=lambda token: verify_clerk_token(token),
        sync_authenticated_user_fn=lambda payload: _sync_authenticated_user(payload),
        logger=logger,
        unauthorized_response_fn=lambda message, status: (jsonify({"error": message}), status),
        set_request_identity_fn=lambda payload: (
            setattr(g, 'current_user_id', payload['sub']),
            setattr(g, 'auth_payload', payload),
        ),
    )


def _public_api_enabled():
    return api_public_helpers.normalize_enabled(PUBLIC_API_ENABLED)


def _public_api_docs_enabled():
    return _public_api_enabled() and api_public_helpers.normalize_enabled(PUBLIC_API_DOCS_ENABLED)


def _public_api_readiness():
    return api_public_helpers.build_public_api_readiness(
        enabled=PUBLIC_API_ENABLED,
        persistence_mode=PERSISTENCE_MODE,
        database_url=DATABASE_URL,
        key_hash_pepper=PUBLIC_API_KEY_HASH_PEPPER,
        rate_limit_storage_url=PUBLIC_API_RATE_LIMIT_STORAGE_URL,
    )


def _public_api_error_response(status_code, code, message):
    return api_public_helpers.public_error_response(jsonify, status_code, code, message)


def _public_api_authenticate(token):
    return api_public_helpers.authenticate_public_api_key(
        token,
        session_scope_fn=user_state_session_scope,
        database_url=DATABASE_URL,
        key_hash_pepper=PUBLIC_API_KEY_HASH_PEPPER,
        get_public_api_key_by_prefix_fn=get_public_api_key_by_prefix_db,
        get_public_api_client_fn=get_public_api_client_db,
    )


def _public_api_daily_quota(_identity):
    return PUBLIC_API_DEFAULT_DAILY_QUOTA


def _public_api_daily_usage_total(identity, day_value):
    _ensure_user_state_storage_ready()
    with user_state_session_scope(DATABASE_URL) as session:
        return get_public_api_daily_request_total_db(
            session,
            api_key_id=identity["api_key_id"],
            day_value=day_value,
        )


def require_public_api_auth(route_group):
    def decorator(view_fn):
        return api_public_helpers.build_require_public_api_auth(
            view_fn,
            route_group=route_group,
            enabled_fn=_public_api_enabled,
            readiness_fn=_public_api_readiness,
            token_getter=_get_bearer_token,
            authenticate_key_fn=_public_api_authenticate,
            get_daily_quota_fn=_public_api_daily_quota,
            get_daily_usage_total_fn=_public_api_daily_usage_total,
            logger=logger,
            error_response_fn=_public_api_error_response,
        )

    return decorator


def _public_cache():
    return api_public_helpers.get_public_cache(PUBLIC_API_CACHE_URL, logger=logger)


def _public_cache_key(route_group, **path_params):
    return api_public_helpers.build_public_cache_key(
        route_group,
        path_params=path_params,
        query_params=request.args.to_dict(flat=True),
    )


def _public_api_rate_limit_key():
    return api_public_helpers.public_rate_limit_key(get_remote_address())


def _public_api_global_limit_key():
    return api_public_helpers.public_global_rate_limit_key()


def _public_dispatch(handler_fn, *args, **kwargs):
    try:
        payload, status_code = handler_fn(*args, **kwargs)
        return jsonify(payload), status_code
    except api_public_helpers.PublicApiError as exc:
        return _public_api_error_response(exc.status_code, exc.code, exc.message)

def validate_request_json(required_fields):
    """
    Decorator to ensure that the incoming JSON request contains
    all required fields. Returns 400 with missing fields if not.
    
    Usage:
        @app.route('/buy', methods=['POST'])
        @validate_request_json(['ticker', 'shares'])
        def buy_stock():
            data = request.get_json()
            ...
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Ensure request is JSON
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400
            
            data = request.get_json()
            # Check for missing fields
            missing = [field for field in required_fields if field not in data]
            if missing:
                return jsonify({"error": f"Missing required fields: {missing}"}), 400
            
            # Everything is fine, call the route function
            return f(*args, **kwargs)
        return wrapper
    return decorator

def _load_json(path, default):
    return api_state_helpers.load_json(path, default)


def _save_json(path, payload):
    return api_state_helpers.save_json(path, payload)


def _portfolio_file(user_id=None):
    return api_state_helpers.portfolio_file(
        user_id,
        default_file=PORTFOLIO_FILE,
        get_user_file_path_fn=_get_user_file_path,
    )


def _prediction_portfolio_file(user_id=None):
    return api_state_helpers.prediction_portfolio_file(
        user_id,
        default_file=PREDICTION_PORTFOLIO_FILE,
        get_user_file_path_fn=_get_user_file_path,
    )


def _notifications_file(user_id=None):
    return api_state_helpers.notifications_file(
        user_id,
        default_file=NOTIFICATIONS_FILE,
        get_user_file_path_fn=_get_user_file_path,
    )


def _watchlist_file(user_id=None):
    return api_state_helpers.watchlist_file(
        user_id,
        base_dir=BASE_DIR,
        get_user_file_path_fn=_get_user_file_path,
    )


def _should_seed_from_legacy(user_path, legacy_path):
    return api_state_helpers.should_seed_from_legacy(ALLOW_LEGACY_USER_DATA_SEED, user_path, legacy_path)


def _load_prediction_portfolio_json(user_id=None):
    return api_state_helpers.load_prediction_portfolio_json(
        user_id,
        default_file=PREDICTION_PORTFOLIO_FILE,
        get_prediction_portfolio_file_fn=_prediction_portfolio_file,
        allow_legacy_seed=ALLOW_LEGACY_USER_DATA_SEED,
        load_json_fn=_load_json,
    )


def _save_prediction_portfolio_json(portfolio, user_id=None):
    return api_state_helpers.save_prediction_portfolio_json(
        portfolio,
        user_id,
        get_prediction_portfolio_file_fn=_prediction_portfolio_file,
        save_json_fn=_save_json,
    )


def load_prediction_portfolio(user_id=None):
    return api_state_helpers.load_prediction_portfolio(
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        load_prediction_portfolio_db_fn=load_prediction_portfolio_db,
        load_prediction_portfolio_json_fn=_load_prediction_portfolio_json,
    )


def save_prediction_portfolio(portfolio, user_id=None):
    return api_state_helpers.save_prediction_portfolio(
        portfolio,
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        save_prediction_portfolio_db_fn=save_prediction_portfolio_db,
        json_mirror_enabled=_json_mirror_enabled(),
        save_prediction_portfolio_json_fn=_save_prediction_portfolio_json,
    )


def _load_portfolio_json(user_id=None):
    return api_state_helpers.load_portfolio_json(
        user_id,
        default_file=PORTFOLIO_FILE,
        get_portfolio_file_fn=_portfolio_file,
        allow_legacy_seed=ALLOW_LEGACY_USER_DATA_SEED,
        load_json_fn=_load_json,
    )


def load_portfolio(user_id=None):
    return api_state_helpers.load_portfolio(
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        load_portfolio_db_fn=load_portfolio_db,
        load_portfolio_json_fn=_load_portfolio_json,
    )


def _save_portfolio_json(portfolio, user_id=None):
    return api_state_helpers.save_portfolio_json(
        portfolio,
        user_id,
        get_portfolio_file_fn=_portfolio_file,
        save_json_fn=_save_json,
    )


def save_portfolio(portfolio, user_id=None):
    return api_state_helpers.save_portfolio(
        portfolio,
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        save_portfolio_db_fn=save_portfolio_db,
        json_mirror_enabled=_json_mirror_enabled(),
        save_portfolio_json_fn=_save_portfolio_json,
    )


def save_portfolio_with_snapshot(portfolio, user_id=None, *, reset_snapshots=False):
    if user_id and _sql_persistence_enabled():
        from user_state_store import PaperPortfolioSnapshot

        _ensure_user_state_storage_ready()
        with user_state_session_scope(DATABASE_URL) as session:
            save_portfolio_db(session, user_id, portfolio)
            if reset_snapshots:
                session.query(PaperPortfolioSnapshot).filter_by(clerk_user_id=user_id).delete()
            record_portfolio_snapshot_db(session, user_id, portfolio)
        if _json_mirror_enabled():
            _save_portfolio_json(portfolio, user_id)
        return

    _save_portfolio_json(portfolio, user_id)
    record_portfolio_snapshot(portfolio, user_id)


def _load_notifications_json(user_id=None):
    return api_state_helpers.load_notifications_json(
        user_id,
        default_file=NOTIFICATIONS_FILE,
        get_notifications_file_fn=_notifications_file,
        allow_legacy_seed=ALLOW_LEGACY_USER_DATA_SEED,
        load_json_fn=_load_json,
    )


def load_notifications(user_id=None):
    return api_state_helpers.load_notifications(
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        load_notifications_db_fn=load_notifications_db,
        load_notifications_json_fn=_load_notifications_json,
    )


def _save_notifications_json(notifications, user_id=None):
    return api_state_helpers.save_notifications_json(
        notifications,
        user_id,
        get_notifications_file_fn=_notifications_file,
        save_json_fn=_save_json,
    )


def save_notifications(notifications, user_id=None):
    return api_state_helpers.save_notifications(
        notifications,
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        save_notifications_db_fn=save_notifications_db,
        json_mirror_enabled=_json_mirror_enabled(),
        save_notifications_json_fn=_save_notifications_json,
    )


def _load_watchlist_json(user_id=None):
    return api_state_helpers.load_watchlist_json(
        user_id,
        base_dir=BASE_DIR,
        get_watchlist_file_fn=_watchlist_file,
        allow_legacy_seed=ALLOW_LEGACY_USER_DATA_SEED,
        load_json_fn=_load_json,
    )


def load_watchlist(user_id=None):
    return api_state_helpers.load_watchlist(
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        load_watchlist_db_fn=load_watchlist_db,
        load_watchlist_json_fn=_load_watchlist_json,
    )


def _save_watchlist_json(tickers, user_id=None):
    return api_state_helpers.save_watchlist_json(
        tickers,
        user_id,
        get_watchlist_file_fn=_watchlist_file,
        save_json_fn=_save_json,
    )


def save_watchlist(tickers, user_id=None):
    return api_state_helpers.save_watchlist(
        tickers,
        user_id,
        sql_enabled=_sql_persistence_enabled(),
        ensure_user_state_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        save_watchlist_db_fn=save_watchlist_db,
        json_mirror_enabled=_json_mirror_enabled(),
        save_watchlist_json_fn=_save_watchlist_json,
    )


@app.route('/auth/me', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def auth_me():
    payload = getattr(g, 'auth_payload', {})
    return jsonify({
        "user_id": get_current_user_id(),
        "email": payload.get('email'),
        "username": payload.get('username'),
    })


def _deliverables_not_configured_response():
    return jsonify({"error": "Deliverables require SQL-backed persistence and DATABASE_URL configuration"}), 503


def _marketmind_ai_not_configured_response():
    return jsonify({"error": "MarketMindAI requires SQL-backed persistence and DATABASE_URL configuration"}), 503


@app.route('/deliverables', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_deliverables():
    return deliverables_handlers.list_deliverables_handler(
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        list_deliverables_fn=list_deliverables,
        get_current_user_id_fn=get_current_user_id,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def post_deliverable():
    payload = request.get_json(silent=True) or {}
    return deliverables_handlers.create_deliverable_handler(
        payload=payload,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        create_deliverable_fn=create_deliverable,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_deliverable(deliverable_id):
    return deliverables_handlers.get_deliverable_handler(
        deliverable_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        get_deliverable_detail_fn=get_deliverable_detail,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>', methods=['PATCH'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def patch_deliverable(deliverable_id):
    payload = request.get_json(silent=True) or {}
    return deliverables_handlers.patch_deliverable_handler(
        deliverable_id,
        payload=payload,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        update_deliverable_fn=update_deliverable,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>/assumptions', methods=['PUT'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def put_deliverable_assumptions(deliverable_id):
    payload = request.get_json(silent=True) or {}
    return deliverables_handlers.put_deliverable_assumptions_handler(
        deliverable_id,
        payload=payload,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        replace_deliverable_assumptions_fn=replace_deliverable_assumptions,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>/reviews', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def post_deliverable_review(deliverable_id):
    payload = request.get_json(silent=True) or {}
    return deliverables_handlers.post_deliverable_review_handler(
        deliverable_id,
        payload=payload,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        add_deliverable_review_fn=add_deliverable_review,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>/preflight', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def post_deliverable_preflight(deliverable_id):
    return deliverables_handlers.post_deliverable_preflight_handler(
        deliverable_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        create_deliverable_preflight_fn=create_deliverable_preflight,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>/context', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_deliverable_context(deliverable_id):
    return deliverables_handlers.get_deliverable_context_handler(
        deliverable_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        build_deliverable_context_fn=build_deliverable_context,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>/memos', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_deliverable_memos(deliverable_id):
    return deliverables_handlers.get_deliverable_memos_handler(
        deliverable_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        list_deliverable_memos_fn=list_deliverable_memos,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>/memos/generate', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.HEAVY)
def post_deliverable_generate(deliverable_id):
    return deliverables_handlers.post_deliverable_generate_handler(
        deliverable_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        generate_deliverable_memo_fn=generate_deliverable_memo,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
    )


@app.route('/deliverables/<string:deliverable_id>/memos/<string:memo_id>/download', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def download_deliverable_memo(deliverable_id, memo_id):
    return deliverables_handlers.download_deliverable_memo_handler(
        deliverable_id,
        memo_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_deliverables_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        get_deliverable_memo_artifact_fn=get_deliverable_memo_artifact,
        get_current_user_id_fn=get_current_user_id,
        deliverable_error_cls=DeliverableError,
        jsonify_fn=jsonify,
        bytes_io_cls=BytesIO,
        send_file_fn=send_file,
        docx_mime_type=DOCX_MIME_TYPE,
    )


@app.route('/marketmind-ai/bootstrap', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_bootstrap():
    return marketmind_ai_handlers.get_bootstrap_handler(
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        get_bootstrap_payload_fn=get_marketmind_ai_bootstrap_payload,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/chats', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_chats():
    return marketmind_ai_handlers.list_chats_handler(
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        list_chats_fn=list_marketmind_ai_chats,
        get_current_user_id_fn=get_current_user_id,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/chats/<string:chat_id>', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_chat(chat_id):
    return marketmind_ai_handlers.get_chat_handler(
        chat_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        get_chat_detail_fn=get_marketmind_ai_chat_detail,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/chats/<string:chat_id>', methods=['DELETE'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def delete_marketmind_ai_chat_route(chat_id):
    return marketmind_ai_handlers.delete_chat_handler(
        chat_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        delete_chat_fn=delete_marketmind_ai_chat,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/context', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_context():
    ticker = request.args.get('ticker', '').strip().upper()
    market = request.args.get('market', '').strip()
    return marketmind_ai_handlers.get_context_handler(
        ticker=ticker,
        market=market,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        build_context_fn=build_marketmind_ai_context,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/retrieval-status', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_retrieval_status_route():
    ticker = request.args.get('ticker', '').strip().upper()
    market = request.args.get('market', '').strip()
    return marketmind_ai_handlers.get_retrieval_status_handler(
        ticker=ticker,
        market=market,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        get_retrieval_status_fn=get_marketmind_ai_retrieval_status,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/chat', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.HEAVY)
def post_marketmind_ai_chat():
    payload = request.get_json(silent=True) or {}
    return marketmind_ai_handlers.post_chat_handler(
        payload=payload,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        generate_reply_fn=generate_marketmind_ai_reply,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/artifacts/preflight', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def post_marketmind_ai_artifact_preflight():
    payload = request.get_json(silent=True) or {}
    return marketmind_ai_handlers.post_artifact_preflight_handler(
        payload=payload,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        create_artifact_preflight_fn=create_artifact_preflight,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/artifacts', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_artifacts():
    return marketmind_ai_handlers.list_artifacts_handler(
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        list_artifacts_fn=list_marketmind_ai_artifacts,
        get_current_user_id_fn=get_current_user_id,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/artifacts', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.HEAVY)
def post_marketmind_ai_artifact_generate():
    payload = request.get_json(silent=True) or {}
    return marketmind_ai_handlers.generate_artifact_handler(
        payload=payload,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        generate_artifact_fn=generate_marketmind_ai_artifact,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/artifacts/<string:artifact_id>', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_artifact(artifact_id):
    return marketmind_ai_handlers.get_artifact_handler(
        artifact_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        get_artifact_detail_fn=get_marketmind_ai_artifact_detail,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
    )


@app.route('/marketmind-ai/artifacts/<string:artifact_id>/versions/<string:version_id>/download', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def download_marketmind_ai_artifact(artifact_id, version_id):
    return marketmind_ai_handlers.download_artifact_handler(
        artifact_id,
        version_id,
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        ensure_storage_ready_fn=_ensure_user_state_storage_ready,
        session_scope=user_state_session_scope,
        database_url=DATABASE_URL,
        get_artifact_download_fn=get_marketmind_ai_artifact_download,
        get_current_user_id_fn=get_current_user_id,
        error_cls=MarketMindAIError,
        jsonify_fn=jsonify,
        bytes_io_cls=BytesIO,
        send_file_fn=send_file,
        docx_mime_type=DOCX_MIME_TYPE,
    )

# --- Helper function ---
def clean_value(val):
    return api_market_utils_helpers.clean_value(val, pd_module=pd, np_module=np)


# --- Helper Function ---
def get_symbol_suggestions(query):
    return api_market_utils_helpers.get_symbol_suggestions(
        query,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        requests_get=requests.get,
        logger=logger,
    )


# --- Watchlist Endpoints ---
@app.route('/watchlist', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_watchlist():
    return market_data_handlers.get_watchlist_handler(
        get_current_user_id_fn=get_current_user_id,
        load_watchlist_fn=load_watchlist,
        jsonify_fn=jsonify,
    )


@app.route('/watchlist/<string:ticker>', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def add_to_watchlist(ticker):
    current_watchlist = load_watchlist(get_current_user_id())
    watchlist_limit = _subscription_limit('watchlist_items')
    normalized_ticker = str(ticker or '').strip().upper()
    if (
        watchlist_limit is not None
        and len(current_watchlist) >= int(watchlist_limit)
        and normalized_ticker not in current_watchlist
    ):
        return _subscription_limit_response(
            f"Free users can track up to {watchlist_limit} tickers in the watchlist. Upgrade to Pro to add more.",
            limit_key='watchlist_items',
        )
    return market_data_handlers.add_to_watchlist_handler(
        ticker,
        get_current_user_id_fn=get_current_user_id,
        load_watchlist_fn=load_watchlist,
        save_watchlist_fn=save_watchlist,
        jsonify_fn=jsonify,
    )


@app.route('/watchlist/<string:ticker>', methods=['DELETE'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def remove_from_watchlist(ticker):
    return market_data_handlers.remove_from_watchlist_handler(
        ticker,
        get_current_user_id_fn=get_current_user_id,
        load_watchlist_fn=load_watchlist,
        save_watchlist_fn=save_watchlist,
        jsonify_fn=jsonify,
    )


# --- Stock Data Endpoint ---
@app.route('/stock/<string:ticker>')
@limiter.limit(RateLimits.STANDARD)
def get_stock_data(ticker):
    return market_data_handlers.get_stock_data_handler(
        ticker,
        request_obj=request,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        yf_module=yf,
        requests_module=requests,
        jsonify_fn=jsonify,
        logger=logger,
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


# --- Chart Endpoint ---
@app.route('/chart/<string:ticker>')
def get_chart_data(ticker):
    return market_data_handlers.get_chart_data_handler(
        ticker,
        request_obj=request,
        yf_module=yf,
        jsonify_fn=jsonify,
        logger=logger,
        clean_value_fn=clean_value,
        chart_prediction_points_fn=_chart_prediction_points,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
    )


# --- News Endpoint ---
@app.route('/news')
def get_query_news():
    return market_data_handlers.get_query_news_handler(
        request_obj=request,
        news_api_key=NEWS_API_KEY,
        requests_module=requests,
        jsonify_fn=jsonify,
    )


# --- Options Endpoints ---
@app.route('/options/stock_price/<string:ticker>')
def get_options_stock_price(ticker):
    return market_data_handlers.get_options_stock_price_handler(
        ticker,
        yf_module=yf,
        jsonify_fn=jsonify,
        clean_value_fn=clean_value,
    )


@app.route('/options/<string:ticker>', methods=['GET'])
def get_option_expirations(ticker):
    return market_data_handlers.get_option_expirations_handler(
        ticker,
        yf_module=yf,
        jsonify_fn=jsonify,
    )


@app.route('/options/chain/<ticker>', methods=['GET'])
def get_option_chain(ticker):
    return market_data_handlers.get_option_chain_handler(
        ticker,
        request_obj=request,
        yf_module=yf,
        jsonify_fn=jsonify,
        math_module=math,
        logger=logger,
    )

# --- Options Suggestion Endpoint ---
@app.route('/options/suggest/<string:ticker>', methods=['GET'])
def get_option_suggestion(ticker):
    return market_data_handlers.get_option_suggestion_handler(
        ticker,
        generate_suggestion_fn=generate_suggestion,
        jsonify_fn=jsonify,
        logger=logger,
    )


# --- ML Endpoints ---
@app.route('/predict/<string:model>/<string:ticker>')
@limiter.limit(RateLimits.STANDARD)
def predict_stock(model, ticker):
    _try_authenticate_optional_request()
    prediction_limit = _subscription_limit('prediction_requests_per_day')
    prediction_usage = _prediction_usage_count()
    # if prediction_limit is not None and prediction_usage >= int(prediction_limit):
    #     return _subscription_limit_response(
    #         f"{_get_current_plan().capitalize()} users can run up to {prediction_limit} AI predictions per day.",
    #         limit_key='prediction_requests_per_day',
    #     )

    response = market_data_handlers.predict_stock_handler(
        model,
        ticker,
        create_dataset_fn=create_dataset,
        future_prediction_dates_fn=prediction_service.get_future_prediction_dates,
        linear_regression_predict_fn=linear_regression_predict,
        random_forest_predict_fn=random_forest_predict,
        xgboost_predict_fn=xgboost_predict,
        gradient_boosting_predict_fn=gradient_boosting_predict,
        lstm_train_fn=lstm_train,
        lstm_predict_fn=lstm_predict,
        transformer_train_fn=transformer_train,
        transformer_predict_fn=transformer_predict,
        yf_module=yf,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
        pd_module=pd,
    )
    if _response_status_code(response) < 400:
        _record_prediction_usage()
    return response

def _to_bool(value):
    return api_prediction_runtime_helpers.to_bool(value)


def _live_ensemble_signal_components(sanitized_ticker):
    return api_prediction_runtime_helpers.live_ensemble_signal_components(
        sanitized_ticker,
        create_dataset_fn=create_dataset,
        ensemble_predict_fn=ensemble_predict,
        np_module=np,
    )


def _chart_prediction_points(sanitized_ticker):
    return api_prediction_runtime_helpers.chart_prediction_points(
        sanitized_ticker,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
        pd_module=pd,
    )


def _resolve_selector_gate_for_ticker(sanitized_ticker, requested_mode, selector_source_requested="auto"):
    return api_prediction_runtime_helpers.resolve_selector_gate_for_ticker(
        sanitized_ticker,
        requested_mode,
        selector_source_requested,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
        infer_selective_decision_fn=infer_selective_decision,
        logger=logger,
    )


@app.route('/predict/ensemble/<string:ticker>')
@limiter.limit(RateLimits.STANDARD)
def predict_ensemble(ticker):
    _try_authenticate_optional_request()
    prediction_limit = _subscription_limit('prediction_requests_per_day')
    prediction_usage = _prediction_usage_count()
    # if prediction_limit is not None and prediction_usage >= int(prediction_limit):
    #     return _subscription_limit_response(
    #         f"{_get_current_plan().capitalize()} users can run up to {prediction_limit} AI predictions per day.",
    #         limit_key='prediction_requests_per_day',
    #     )

    response = market_data_handlers.predict_ensemble_handler(
        ticker,
        request_obj=request,
        selective_modes=SELECTIVE_MODES,
        selector_source_requestable=SELECTOR_SOURCE_REQUESTABLE,
        future_prediction_dates_fn=prediction_service.get_future_prediction_dates,
        yf_module=yf,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
        infer_selective_decision_fn=infer_selective_decision,
        jsonify_fn=jsonify,
        logger=logger,
        pd_module=pd,
        np_module=np,
    )
    if _response_status_code(response) < 400:
        _record_prediction_usage()
    return response


# --- Paper Trading Endpoints (Using JSON persistence) ---

def _record_portfolio_snapshot_legacy(portfolio_data, user_id):
    return api_state_helpers.record_portfolio_snapshot_legacy(
        portfolio_data,
        user_id,
        get_db_fn=get_db,
        logger=logger,
        datetime_cls=datetime,
    )


def record_portfolio_snapshot(portfolio_data, user_id):
    if user_id and _sql_persistence_enabled():
        _ensure_user_state_storage_ready()
        with user_state_session_scope(DATABASE_URL) as session:
            record_portfolio_snapshot_db(session, user_id, portfolio_data)
        return
    _record_portfolio_snapshot_legacy(portfolio_data, user_id)


@app.route('/paper/portfolio', methods=['GET'])
@require_auth
def get_paper_portfolio():
    return paper_handlers.get_paper_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        jsonify_fn=jsonify,
        yf_module=yf,
        pd_module=pd,
        logger=logger,
    )


@app.route('/paper/portfolio/optimize', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.STANDARD)
def optimize_paper_portfolio():
    return paper_handlers.optimize_paper_portfolio_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        optimize_portfolio_fn=portfolio_optimization_service.optimize_paper_portfolio,
        error_cls=portfolio_optimization_service.PortfolioOptimizationError,
        jsonify_fn=jsonify,
    )


@app.route('/paper/buy', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['ticker', 'shares'])
def buy_stock():
    paper_trade_limit = _subscription_limit('paper_trades_per_month')
    if paper_trade_limit is not None and _paper_trade_count_this_month() >= int(paper_trade_limit):
        return _subscription_limit_response(
            f"Free users can place up to {paper_trade_limit} paper trades per month. Upgrade to Pro for unlimited paper trading.",
            limit_key='paper_trades_per_month',
        )
    return paper_handlers.buy_stock_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        selector_gate_fn=_resolve_selector_gate_for_ticker,
        jsonify_fn=jsonify,
        yf_module=yf,
        to_bool_fn=_to_bool,
        selective_modes=SELECTIVE_MODES,
        selector_source_requestable=SELECTOR_SOURCE_REQUESTABLE,
        selective_disabled_statuses=SELECTIVE_DISABLED_STATUSES,
        log_api_error_fn=log_api_error,
        logger=logger,
        datetime_cls=datetime,
    )


@app.route('/paper/sell', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['ticker', 'shares'])
def sell_stock():
    paper_trade_limit = _subscription_limit('paper_trades_per_month')
    if paper_trade_limit is not None and _paper_trade_count_this_month() >= int(paper_trade_limit):
        return _subscription_limit_response(
            f"Free users can place up to {paper_trade_limit} paper trades per month. Upgrade to Pro for unlimited paper trading.",
            limit_key='paper_trades_per_month',
        )
    return paper_handlers.sell_stock_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        selector_gate_fn=_resolve_selector_gate_for_ticker,
        jsonify_fn=jsonify,
        yf_module=yf,
        to_bool_fn=_to_bool,
        selective_modes=SELECTIVE_MODES,
        selector_source_requestable=SELECTOR_SOURCE_REQUESTABLE,
        selective_disabled_statuses=SELECTIVE_DISABLED_STATUSES,
        log_api_error_fn=log_api_error,
        logger=logger,
        datetime_cls=datetime,
    )


@app.route('/paper/options/buy', methods=['POST'])
@require_auth
def buy_option():
    paper_trade_limit = _subscription_limit('paper_trades_per_month')
    if paper_trade_limit is not None and _paper_trade_count_this_month() >= int(paper_trade_limit):
        return _subscription_limit_response(
            f"Free users can place up to {paper_trade_limit} paper trades per month. Upgrade to Pro for unlimited paper trading.",
            limit_key='paper_trades_per_month',
        )
    return paper_handlers.buy_option_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        jsonify_fn=jsonify,
        datetime_cls=datetime,
    )


@app.route('/paper/options/sell', methods=['POST'])
@require_auth
def sell_option():
    paper_trade_limit = _subscription_limit('paper_trades_per_month')
    if paper_trade_limit is not None and _paper_trade_count_this_month() >= int(paper_trade_limit):
        return _subscription_limit_response(
            f"Free users can place up to {paper_trade_limit} paper trades per month. Upgrade to Pro for unlimited paper trading.",
            limit_key='paper_trades_per_month',
        )
    return paper_handlers.sell_option_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        jsonify_fn=jsonify,
        datetime_cls=datetime,
    )


# --- This is YOUR corrected portfolio history endpoint ---
@app.route('/paper/history', methods=['GET'])
@require_auth
def get_paper_history():
    return paper_handlers.get_paper_history_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        jsonify_fn=jsonify,
        yf_module=yf,
        pd_module=pd,
        np_module=np,
        logger=logger,
        datetime_cls=datetime,
        date_cls=date,
        timedelta_cls=timedelta,
    )


@app.route('/paper/transactions', methods=['GET'])
@require_auth
def get_trade_history():
    return paper_handlers.get_trade_history_handler(
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        jsonify_fn=jsonify,
    )


@app.route('/paper/reset', methods=['POST'])
@require_auth
def reset_portfolio():
    return paper_handlers.reset_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        jsonify_fn=jsonify,
    )


# --- NEW: Notification Endpoints ---
@app.route('/notifications', methods=['GET', 'POST'])
@require_auth
def handle_notifications():
    if request.method == 'POST':
        notifications = load_notifications(get_current_user_id())
        active_alert_limit = _subscription_limit('active_alerts')
        if active_alert_limit is not None and len(notifications.get('active', [])) >= int(active_alert_limit):
            return _subscription_limit_response(
                f"Free users can keep up to {active_alert_limit} active alerts. Upgrade to Pro for more alert capacity.",
                limit_key='active_alerts',
            )
    return notification_handlers.handle_notifications_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        jsonify_fn=jsonify,
        yf_module=yf,
        uuid_module=uuid,
        datetime_cls=datetime,
    )


@app.route('/notifications/smart', methods=['POST'])
@require_auth
def create_smart_alert():
    notifications = load_notifications(get_current_user_id())
    active_alert_limit = _subscription_limit('active_alerts')
    if active_alert_limit is not None and len(notifications.get('active', [])) >= int(active_alert_limit):
        return _subscription_limit_response(
            f"Free users can keep up to {active_alert_limit} active alerts. Upgrade to Pro for more alert capacity.",
            limit_key='active_alerts',
        )
    return notification_handlers.create_smart_alert_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        jsonify_fn=jsonify,
        yf_module=yf,
        uuid_module=uuid,
        datetime_cls=datetime,
        logger=logger,
        re_module=re,
    )


@app.route('/notifications/<string:alert_id>', methods=['DELETE'])
@require_auth
def delete_notification(alert_id):
    return notification_handlers.delete_notification_handler(
        alert_id,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        jsonify_fn=jsonify,
    )


@app.route('/notifications/triggered', methods=['GET', 'DELETE'])
@require_auth
def get_triggered_notifications():
    return notification_handlers.get_triggered_notifications_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        jsonify_fn=jsonify,
    )


@app.route('/notifications/triggered/<string:alert_id>', methods=['DELETE'])
@require_auth
def delete_triggered_notification(alert_id):
    return notification_handlers.delete_triggered_notification_handler(
        alert_id,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        jsonify_fn=jsonify,
    )


# --- END NEW NOTIFICATION ENDPOINTS ---


# --- NEW: Background Price Checker ---
def _check_alerts_for_user(user_id):
    return api_scheduler_helpers.check_alerts_for_user(
        user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        yf_module=yf,
        logger=logger,
        uuid_module=uuid,
        datetime_cls=datetime,
    )


def check_alerts():
    return api_scheduler_helpers.check_alerts(
        iter_user_ids_fn=_iter_user_ids,
        check_alerts_for_user_fn=_check_alerts_for_user,
        logger=logger,
    )


def run_scheduler():
    return api_scheduler_helpers.run_scheduler(
        schedule_module=schedule,
        check_alerts_fn=check_alerts,
        time_module=time,
    )


# --- END BACKGROUND CHECKER ---


# --- All of Tazeem's other endpoints (Forex, Crypto, etc.) ---
@app.route('/api/news', methods=['GET'])
def news_api():
    return reference_data_handlers.news_api_handler(
        get_general_news_fn=get_general_news,
        jsonify_fn=jsonify,
    )


@app.route('/evaluate/<string:ticker>')
@limiter.limit(RateLimits.HEAVY)
def evaluate_models(ticker):
    return market_data_handlers.evaluate_models_handler(
        ticker,
        request_obj=request,
        rolling_window_backtest_fn=rolling_window_backtest,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/forex/convert')
def forex_convert():
    return reference_data_handlers.forex_convert_handler(
        request_obj=request,
        get_exchange_rate_fn=get_exchange_rate,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/forex/currencies')
def forex_currencies():
    return reference_data_handlers.forex_currencies_handler(
        get_currency_list_fn=get_currency_list,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/crypto/convert')
def crypto_convert():
    return reference_data_handlers.crypto_convert_handler(
        request_obj=request,
        get_crypto_exchange_rate_fn=get_crypto_exchange_rate,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/crypto/list')
def crypto_list():
    return reference_data_handlers.crypto_list_handler(
        get_crypto_list_fn=get_crypto_list,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/crypto/currencies')
def crypto_target_currencies():
    return reference_data_handlers.crypto_target_currencies_handler(
        get_target_currencies_fn=get_target_currencies,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/commodities/price/<string:commodity>')
def commodity_price(commodity):
    return reference_data_handlers.commodity_price_handler(
        commodity,
        request_obj=request,
        get_commodity_price_fn=get_commodity_price,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/commodities/list')
def commodities_list():
    return reference_data_handlers.commodities_list_handler(
        get_commodity_list_fn=get_commodity_list,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/commodities/all')
def commodities_all():
    return reference_data_handlers.commodities_all_handler(
        get_commodities_by_category_fn=get_commodities_by_category,
        jsonify_fn=jsonify,
        logger=logger,
    )


# ============================================================
# PREDICTION MARKETS ENDPOINTS (Standalone Feature)
# ============================================================

@app.route('/prediction-markets', methods=['GET'])
@limiter.limit(RateLimits.STANDARD)
def list_prediction_markets():
    return prediction_markets_handlers.list_prediction_markets_handler(
        request_obj=request,
        pm_search_markets_fn=pm_search_markets,
        pm_fetch_markets_fn=pm_fetch_markets,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
    )


@app.route('/prediction-markets/exchanges', methods=['GET'])
@limiter.limit(RateLimits.LIGHT)
def list_prediction_exchanges():
    return prediction_markets_handlers.list_prediction_exchanges_handler(
        pm_get_exchanges_fn=pm_get_exchanges,
        jsonify_fn=jsonify,
    )


@app.route('/prediction-markets/analyze', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def analyze_prediction_market():
    return prediction_markets_handlers.analyze_prediction_market_handler(
        request_obj=request,
        analyze_prediction_market_fn=pm_analyze_market,
        error_cls=PredictionMarketAnalysisError,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
    )


@app.route('/prediction-markets/<path:market_id>', methods=['GET'])
@limiter.limit(RateLimits.STANDARD)
def get_prediction_market(market_id):
    return prediction_markets_handlers.get_prediction_market_handler(
        market_id,
        request_obj=request,
        pm_get_market_fn=pm_get_market,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
    )


@app.route('/prediction-markets/portfolio', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_prediction_portfolio():
    return prediction_markets_handlers.get_prediction_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
        pm_get_prices_fn=pm_get_prices,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
    )


@app.route('/prediction-markets/buy', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['market_id', 'outcome', 'contracts'])
def buy_prediction_contract():
    prediction_market_trade_limit = _subscription_limit('prediction_market_trades_per_month')
    if prediction_market_trade_limit is not None and _prediction_market_trade_count_this_month() >= int(prediction_market_trade_limit):
        if int(prediction_market_trade_limit) == 0:
            return _subscription_limit_response(
                "Prediction Markets paper trading is available on Pro only. Upgrade to Pro to place simulated prediction-market trades.",
                limit_key='prediction_market_trades_per_month',
            )
        return _subscription_limit_response(
            f"You have reached your monthly prediction-market paper trade limit of {prediction_market_trade_limit}.",
            limit_key='prediction_market_trades_per_month',
        )
    return prediction_markets_handlers.buy_prediction_contract_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
        pm_get_market_fn=pm_get_market,
        save_prediction_portfolio_fn=save_prediction_portfolio,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
        datetime_cls=datetime,
    )


@app.route('/prediction-markets/sell', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['market_id', 'outcome', 'contracts'])
def sell_prediction_contract():
    prediction_market_trade_limit = _subscription_limit('prediction_market_trades_per_month')
    if prediction_market_trade_limit is not None and _prediction_market_trade_count_this_month() >= int(prediction_market_trade_limit):
        if int(prediction_market_trade_limit) == 0:
            return _subscription_limit_response(
                "Prediction Markets paper trading is available on Pro only. Upgrade to Pro to place simulated prediction-market trades.",
                limit_key='prediction_market_trades_per_month',
            )
        return _subscription_limit_response(
            f"You have reached your monthly prediction-market paper trade limit of {prediction_market_trade_limit}.",
            limit_key='prediction_market_trades_per_month',
        )
    return prediction_markets_handlers.sell_prediction_contract_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
        pm_get_market_fn=pm_get_market,
        save_prediction_portfolio_fn=save_prediction_portfolio,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
        datetime_cls=datetime,
    )


@app.route('/prediction-markets/history', methods=['GET'])
@require_auth
@limiter.limit(RateLimits.LIGHT)
def get_prediction_trade_history():
    return prediction_markets_handlers.get_prediction_trade_history_handler(
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
        jsonify_fn=jsonify,
    )


@app.route('/prediction-markets/reset', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
def reset_prediction_portfolio():
    return prediction_markets_handlers.reset_prediction_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        save_prediction_portfolio_fn=save_prediction_portfolio,
        jsonify_fn=jsonify,
    )


def _fundamentals_from_yfinance(sym):
    return api_market_utils_helpers.fundamentals_from_yfinance(sym, yf_module=yf, logger=logger)


def _resolve_market_asset(ticker, market=None):
    return parse_asset_reference(ticker, market)


@app.route('/fundamentals/<string:ticker>')
def get_fundamentals(ticker):
    return reference_data_handlers.get_fundamentals_handler(
        ticker,
        request_obj=request,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        requests_module=requests,
        jsonify_fn=jsonify,
        logger=logger,
        clean_value_fn=clean_value,
        fundamentals_from_yfinance_fn=_fundamentals_from_yfinance,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )
# --- NEW: Autocomplete Symbol Search (from Jimmy's branch) ---
@app.route('/search-symbols')
def search_symbols():
    return market_data_handlers.search_symbols_handler(
        request_obj=request,
        get_symbol_suggestions_fn=get_symbol_suggestions,
        search_international_symbols_fn=akshare_service.search_equities,
        jsonify_fn=jsonify,
        logger=logger,
    )



# Create a "memory" cache so we don't spam the API
CALENDAR_CACHE = {
    "data": None,
    "last_fetched": 0
}


@app.route('/calendar/economic', methods=['GET'])
def get_economic_calendar():
    return reference_data_handlers.get_economic_calendar_handler(
        calendar_cache=CALENDAR_CACHE,
        requests_module=requests,
        jsonify_fn=jsonify,
        time_module=time,
        datetime_cls=datetime,
    )


@app.route('/calendar/market-sessions', methods=['GET'])
def get_market_sessions_calendar():
    return reference_data_handlers.get_market_sessions_handler(
        request_obj=request,
        jsonify_fn=jsonify,
        logger=logger,
        exchange_session_service_module=exchange_session_service,
    )

# ─────────────────────────────────────────────────────────────────────────────
# OpenBB-powered endpoints
# ─────────────────────────────────────────────────────────────────────────────

def _obb_to_float(val):
    return api_market_utils_helpers.obb_to_float(val)


@app.route('/fundamentals/financials/<string:ticker>')
def get_financial_statements(ticker):
    return reference_data_handlers.get_financial_statements_handler(
        ticker,
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        jsonify_fn=jsonify,
        logger=logger,
        obb_to_float_fn=_obb_to_float,
    )


@app.route('/fundamentals/filings/<string:ticker>')
def get_sec_filings(ticker):
    return reference_data_handlers.get_sec_filings_handler(
        ticker,
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        sec_filings_service_module=sec_filings_service,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/fundamentals/sec-intelligence/<string:ticker>')
def get_sec_intelligence(ticker):
    return reference_data_handlers.get_sec_intelligence_handler(
        ticker,
        sec_filings_service_module=sec_filings_service,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/fundamentals/filings/<string:ticker>/<string:accession_number>')
def get_sec_filing_detail(ticker, accession_number):
    return reference_data_handlers.get_sec_filing_detail_handler(
        ticker,
        accession_number,
        sec_filings_service_module=sec_filings_service,
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/screener')
def get_screener():
    return reference_data_handlers.get_screener_handler(
        base_dir=BASE_DIR,
        yf_module=yf,
        jsonify_fn=jsonify,
        logger=logger,
        screener_query_service_module=screener_query_service,
    )


@app.route('/screener/presets')
def get_screener_presets():
    return reference_data_handlers.get_screener_presets_handler(
        base_dir=BASE_DIR,
        yf_module=yf,
        jsonify_fn=jsonify,
        logger=logger,
        screener_query_service_module=screener_query_service,
    )


@app.route('/screener/scan')
def get_screener_scan():
    return reference_data_handlers.get_screener_scan_handler(
        base_dir=BASE_DIR,
        yf_module=yf,
        request_obj=request,
        jsonify_fn=jsonify,
        logger=logger,
        screener_query_service_module=screener_query_service,
    )


MACRO_INDICATORS = [
    {"symbol": "URATE", "name": "Unemployment Rate",     "unit": "%",    "multiplier": 1, "openbb_multiplier": 100, "fred_multiplier": 1, "series_id": "UNRATE"},
    {"symbol": "CPI",   "name": "Consumer Price Index",  "unit": "Index","multiplier": 1, "series_id": "CPIAUCSL"},
    {"symbol": "IP",    "name": "Industrial Production", "unit": "Index","multiplier": 1, "series_id": "INDPRO"},
]

@app.route('/macro/overview')
def get_macro_overview():
    return reference_data_handlers.get_macro_overview_handler(
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        jsonify_fn=jsonify,
        logger=logger,
        yf_module=yf,
        macro_indicators=MACRO_INDICATORS,
        requests_module=requests,
        request_obj=request,
        akshare_service_module=akshare_service,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MarketMind Public API v1 (Private Beta)
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/public/docs', methods=['GET'])
def public_api_docs():
    if not _public_api_docs_enabled():
        return _public_api_error_response(404, "not_found", "MarketMind Public API docs are not enabled.")
    with open(PUBLIC_API_DOCS_PATH, 'r', encoding='utf-8') as f:
        return app.response_class(f.read(), mimetype='text/html')


@app.route('/api/public/openapi/v1.yaml', methods=['GET'])
def public_api_openapi_spec():
    if not _public_api_docs_enabled():
        return _public_api_error_response(404, "not_found", "MarketMind Public API docs are not enabled.")
    with open(PUBLIC_API_OPENAPI_PATH, 'r', encoding='utf-8') as f:
        return app.response_class(f.read(), mimetype='application/yaml')


@app.route('/api/public/openapi/v2.yaml', methods=['GET'])
def public_api_openapi_spec_v2():
    if not _public_api_docs_enabled():
        return _public_api_error_response(404, "not_found", "MarketMind Public API docs are not enabled.")
    with open(PUBLIC_API_OPENAPI_V2_PATH, 'r', encoding='utf-8') as f:
        return app.response_class(f.read(), mimetype='application/yaml')


@app.route('/api/public/v1/health', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('health')
def public_api_health():
    return _public_dispatch(public_handlers.health_handler, version='v1')


@app.route('/api/public/v1/stock/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('stock')
def public_api_stock(ticker):
    return _public_dispatch(
        public_handlers.stock_handler,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('stock', ticker=ticker.upper()),
        cache_ttl_seconds=30,
        get_stock_data_handler_fn=market_data_handlers.get_stock_data_handler,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        yf_module=yf,
        requests_module=requests,
        logger=logger,
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@app.route('/api/public/v1/chart/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('chart')
def public_api_chart(ticker):
    return _public_dispatch(
        public_handlers.chart_handler,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('chart', ticker=ticker.upper()),
        cache_ttl_seconds=60,
        get_chart_data_handler_fn=market_data_handlers.get_chart_data_handler,
        yf_module=yf,
        logger=logger,
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
    )


@app.route('/api/public/v1/news', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('news')
def public_api_news():
    return _public_dispatch(
        public_handlers.news_handler,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('news'),
        cache_ttl_seconds=300,
        get_query_news_handler_fn=market_data_handlers.get_query_news_handler,
        get_general_news_fn=get_general_news,
        news_api_key=NEWS_API_KEY,
        requests_module=requests,
    )


@app.route('/api/public/v1/search-symbols', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('search-symbols')
def public_api_search_symbols():
    return _public_dispatch(
        public_handlers.search_symbols_handler,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('search-symbols'),
        cache_ttl_seconds=3600,
        search_symbols_handler_fn=market_data_handlers.search_symbols_handler,
        get_symbol_suggestions_fn=get_symbol_suggestions,
        search_international_symbols_fn=lambda _query, market='us': [] if market != 'all' else [],
        logger=logger,
    )


@app.route('/api/public/v1/predictions/ensemble/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('predictions/ensemble')
def public_api_ensemble_prediction(ticker):
    return _public_dispatch(
        public_handlers.ensemble_prediction_handler,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('predictions/ensemble', ticker=ticker.upper()),
        cache_ttl_seconds=900,
        predict_ensemble_handler_fn=market_data_handlers.predict_ensemble_handler,
        selective_modes=SELECTIVE_MODES,
        selector_source_requestable=SELECTOR_SOURCE_REQUESTABLE,
        yf_module=yf,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
        infer_selective_decision_fn=infer_selective_decision,
        logger=logger,
        pd_module=pd,
        np_module=np,
    )


@app.route('/api/public/v1/fundamentals/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('fundamentals')
def public_api_fundamentals(ticker):
    return _public_dispatch(
        public_handlers.fundamentals_handler,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('fundamentals', ticker=ticker.upper()),
        cache_ttl_seconds=3600,
        get_fundamentals_handler_fn=reference_data_handlers.get_fundamentals_handler,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        requests_module=requests,
        logger=logger,
        clean_value_fn=clean_value,
        fundamentals_from_yfinance_fn=_fundamentals_from_yfinance,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@app.route('/api/public/v1/macro/overview', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('macro/overview')
def public_api_macro_overview():
    return _public_dispatch(
        public_handlers.macro_overview_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('macro/overview'),
        cache_ttl_seconds=900,
        get_macro_overview_handler_fn=reference_data_handlers.get_macro_overview_handler,
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        logger=logger,
        yf_module=yf,
        macro_indicators=MACRO_INDICATORS,
        requests_module=requests,
    )


@app.route('/api/public/v2/health', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/health')
def public_api_v2_health():
    return _public_dispatch(public_handlers.health_handler, version='v2')


@app.route('/api/public/v2/search-symbols', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/search-symbols')
def public_api_v2_search_symbols():
    return _public_dispatch(
        public_handlers.search_symbols_handler_v2,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/search-symbols'),
        cache_ttl_seconds=3600,
        search_symbols_handler_fn=market_data_handlers.search_symbols_handler,
        get_symbol_suggestions_fn=get_symbol_suggestions,
        search_international_symbols_fn=akshare_service.search_equities,
        logger=logger,
    )


@app.route('/api/public/v2/stock/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/stock')
def public_api_v2_stock(ticker):
    return _public_dispatch(
        public_handlers.stock_handler_v2,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/stock', ticker=ticker.upper()),
        cache_ttl_seconds=30,
        get_stock_data_handler_fn=market_data_handlers.get_stock_data_handler,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        yf_module=yf,
        requests_module=requests,
        logger=logger,
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@app.route('/api/public/v2/chart/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/chart')
def public_api_v2_chart(ticker):
    return _public_dispatch(
        public_handlers.chart_handler_v2,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/chart', ticker=ticker.upper()),
        cache_ttl_seconds=60,
        get_chart_data_handler_fn=market_data_handlers.get_chart_data_handler,
        yf_module=yf,
        logger=logger,
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
    )


@app.route('/api/public/v2/fundamentals/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/fundamentals')
def public_api_v2_fundamentals(ticker):
    return _public_dispatch(
        public_handlers.fundamentals_handler_v2,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/fundamentals', ticker=ticker.upper()),
        cache_ttl_seconds=3600,
        get_fundamentals_handler_fn=reference_data_handlers.get_fundamentals_handler,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        requests_module=requests,
        logger=logger,
        clean_value_fn=clean_value,
        fundamentals_from_yfinance_fn=_fundamentals_from_yfinance,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@app.route('/api/public/v2/macro/overview', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/macro/overview')
def public_api_v2_macro_overview():
    return _public_dispatch(
        public_handlers.macro_overview_handler_v2,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/macro/overview'),
        cache_ttl_seconds=900,
        get_macro_overview_handler_fn=reference_data_handlers.get_macro_overview_handler,
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        logger=logger,
        yf_module=yf,
        macro_indicators=MACRO_INDICATORS,
        requests_module=requests,
        akshare_service_module=akshare_service,
    )


@app.route('/api/public/v2/options/stock-price/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/options/stock-price')
def public_api_v2_options_stock_price(ticker):
    return _public_dispatch(
        public_handlers.options_stock_price_handler,
        ticker,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/options/stock-price', ticker=ticker.upper()),
        cache_ttl_seconds=30,
        get_options_stock_price_handler_fn=market_data_handlers.get_options_stock_price_handler,
        yf_module=yf,
        clean_value_fn=clean_value,
    )


@app.route('/api/public/v2/options/expirations/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/options/expirations')
def public_api_v2_option_expirations(ticker):
    return _public_dispatch(
        public_handlers.option_expirations_handler,
        ticker,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/options/expirations', ticker=ticker.upper()),
        cache_ttl_seconds=3600,
        get_option_expirations_handler_fn=market_data_handlers.get_option_expirations_handler,
        yf_module=yf,
    )


@app.route('/api/public/v2/options/chain/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/options/chain')
def public_api_v2_option_chain(ticker):
    return _public_dispatch(
        public_handlers.option_chain_handler,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/options/chain', ticker=ticker.upper()),
        cache_ttl_seconds=60,
        get_option_chain_handler_fn=market_data_handlers.get_option_chain_handler,
        yf_module=yf,
        math_module=math,
        logger=logger,
    )


@app.route('/api/public/v2/options/suggest/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/options/suggest')
def public_api_v2_option_suggestion(ticker):
    return _public_dispatch(
        public_handlers.option_suggestion_handler,
        ticker,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/options/suggest', ticker=ticker.upper()),
        cache_ttl_seconds=900,
        get_option_suggestion_handler_fn=market_data_handlers.get_option_suggestion_handler,
        generate_suggestion_fn=generate_suggestion,
        logger=logger,
    )


@app.route('/api/public/v2/forex/convert', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/forex/convert')
def public_api_v2_forex_convert():
    return _public_dispatch(
        public_handlers.forex_convert_public_handler,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/forex/convert'),
        cache_ttl_seconds=300,
        forex_convert_handler_fn=reference_data_handlers.forex_convert_handler,
        get_exchange_rate_fn=get_exchange_rate,
        logger=logger,
    )


@app.route('/api/public/v2/forex/currencies', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/forex/currencies')
def public_api_v2_forex_currencies():
    return _public_dispatch(
        public_handlers.forex_currencies_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/forex/currencies'),
        cache_ttl_seconds=86400,
        forex_currencies_handler_fn=reference_data_handlers.forex_currencies_handler,
        get_currency_list_fn=get_currency_list,
        logger=logger,
    )


@app.route('/api/public/v2/crypto/convert', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/crypto/convert')
def public_api_v2_crypto_convert():
    return _public_dispatch(
        public_handlers.crypto_convert_public_handler,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/crypto/convert'),
        cache_ttl_seconds=300,
        crypto_convert_handler_fn=reference_data_handlers.crypto_convert_handler,
        get_crypto_exchange_rate_fn=get_crypto_exchange_rate,
        logger=logger,
    )


@app.route('/api/public/v2/crypto/list', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/crypto/list')
def public_api_v2_crypto_list():
    return _public_dispatch(
        public_handlers.crypto_list_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/crypto/list'),
        cache_ttl_seconds=86400,
        crypto_list_handler_fn=reference_data_handlers.crypto_list_handler,
        get_crypto_list_fn=get_crypto_list,
        logger=logger,
    )


@app.route('/api/public/v2/crypto/currencies', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/crypto/currencies')
def public_api_v2_crypto_currencies():
    return _public_dispatch(
        public_handlers.crypto_currencies_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/crypto/currencies'),
        cache_ttl_seconds=86400,
        crypto_target_currencies_handler_fn=reference_data_handlers.crypto_target_currencies_handler,
        get_target_currencies_fn=get_target_currencies,
        logger=logger,
    )


@app.route('/api/public/v2/commodities/price/<string:commodity>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/commodities/price')
def public_api_v2_commodity_price(commodity):
    return _public_dispatch(
        public_handlers.commodity_price_public_handler,
        commodity,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/commodities/price', commodity=commodity.lower()),
        cache_ttl_seconds=300,
        commodity_price_handler_fn=reference_data_handlers.commodity_price_handler,
        get_commodity_price_fn=get_commodity_price,
        logger=logger,
    )


@app.route('/api/public/v2/commodities/list', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/commodities/list')
def public_api_v2_commodities_list():
    return _public_dispatch(
        public_handlers.commodities_list_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/commodities/list'),
        cache_ttl_seconds=86400,
        commodities_list_handler_fn=reference_data_handlers.commodities_list_handler,
        get_commodity_list_fn=get_commodity_list,
        logger=logger,
    )


@app.route('/api/public/v2/commodities/all', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/commodities/all')
def public_api_v2_commodities_all():
    return _public_dispatch(
        public_handlers.commodities_all_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/commodities/all'),
        cache_ttl_seconds=86400,
        commodities_all_handler_fn=reference_data_handlers.commodities_all_handler,
        get_commodities_by_category_fn=get_commodities_by_category,
        logger=logger,
    )


@app.route('/api/public/v2/prediction-markets', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/prediction-markets')
def public_api_v2_prediction_markets():
    return _public_dispatch(
        public_handlers.prediction_markets_list_public_handler,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/prediction-markets'),
        cache_ttl_seconds=60,
        list_prediction_markets_handler_fn=prediction_markets_handlers.list_prediction_markets_handler,
        pm_search_markets_fn=pm_search_markets,
        pm_fetch_markets_fn=pm_fetch_markets,
        log_api_error_fn=log_api_error,
        logger=logger,
    )


@app.route('/api/public/v2/prediction-markets/exchanges', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/prediction-markets/exchanges')
def public_api_v2_prediction_market_exchanges():
    return _public_dispatch(
        public_handlers.prediction_markets_exchanges_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/prediction-markets/exchanges'),
        cache_ttl_seconds=86400,
        list_prediction_exchanges_handler_fn=prediction_markets_handlers.list_prediction_exchanges_handler,
        pm_get_exchanges_fn=pm_get_exchanges,
    )


@app.route('/api/public/v2/prediction-markets/<path:market_id>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/prediction-markets/detail')
def public_api_v2_prediction_market_detail(market_id):
    return _public_dispatch(
        public_handlers.prediction_market_detail_public_handler,
        market_id,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/prediction-markets/detail', market_id=market_id),
        cache_ttl_seconds=60,
        get_prediction_market_handler_fn=prediction_markets_handlers.get_prediction_market_handler,
        pm_get_market_fn=pm_get_market,
        log_api_error_fn=log_api_error,
        logger=logger,
    )


@app.route('/api/public/v2/calendar/economic', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/calendar/economic')
def public_api_v2_calendar_economic():
    return _public_dispatch(
        public_handlers.economic_calendar_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/calendar/economic'),
        cache_ttl_seconds=900,
        get_economic_calendar_handler_fn=reference_data_handlers.get_economic_calendar_handler,
        calendar_cache=CALENDAR_CACHE,
        requests_module=requests,
        time_module=time,
        datetime_cls=datetime,
    )


@app.route('/healthz', methods=['GET'])
def healthz():
    return jsonify(
        {
            "status": "ok",
            "service": "marketmind-backend",
            "environment": FLASK_ENV,
            "persistence_mode": PERSISTENCE_MODE,
            "public_api_enabled": _public_api_enabled(),
        }
    ), 200


# --- Main execution ---
if __name__ == '__main__':
    init_db()  # Initialize the SQLite history table
    if _sql_persistence_enabled():
        logger.info("Initializing SQL user-state storage...")
        _ensure_user_state_storage_ready()

    # --- NEW: Start the background thread ---
    logger.info("Starting background alert checker...")
    checker_thread = threading.Thread(target=run_scheduler, daemon=True)
    checker_thread.start()
  
    app.run(debug=True, port=5001, use_reloader=False)
