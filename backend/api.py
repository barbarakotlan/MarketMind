# To run this file, you need to install all dependencies:
# pip install Flask Flask-CORS yfinance pandas scikit-learn numpy requests python-dotenv statsmodels finnhub-python vaderSentiment xgboost schedule statsforecast mlforecast shap pyportfolioopt

import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import yfinance as yf
import pandas as pd
import numpy as np
import requests
from flask import Flask, Blueprint, jsonify, request, g, send_file
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

# Load environment variables (project-root .env then backend/.env override).
# Importing config performs the dotenv load once for the whole backend, so this
# must come before any later import/read of environment-derived values.
import config

# --- OpenBB (optional, used for financials/filings/screener/macro) ---
try:
    from openbb import obb
    OPENBB_AVAILABLE = True
except ImportError:
    OPENBB_AVAILABLE = False

# --- Imports ---
from news_fetcher import get_general_news
# Base ML predictors come from prediction_service (single source of truth);
# the deep-learning models (LSTM/Transformer) and the extended ensemble live in
# models.py, layered on top of prediction_service.
from prediction_service import (
    create_dataset,
    linear_regression_predict,
    random_forest_predict,
    xgboost_predict,
    gradient_boosting_predict,
    lightgbm_predict,
    catboost_predict,
)
from models import ensemble_predict, lstm_train, lstm_predict, transformer_train, transformer_predict
from professional_evaluation import rolling_window_backtest
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
    PaperTradeExecutionError,
    PublicApiQuotaExceeded,
    create_public_api_client as create_public_api_client_db,
    create_public_api_key as create_public_api_key_db,
    ensure_database_ready as ensure_user_state_database_ready,
    execute_paper_trade_transaction as execute_paper_trade_transaction_db,
    get_public_api_client as get_public_api_client_db,
    get_public_api_key_by_prefix as get_public_api_key_by_prefix_db,
    list_app_user_ids as list_app_user_ids_db,
    list_public_api_clients as list_public_api_clients_db,
    list_public_api_daily_usage as list_public_api_daily_usage_db,
    list_public_api_keys as list_public_api_keys_db,
    load_notifications as load_notifications_db,
    load_portfolio as load_portfolio_db,
    load_prediction_portfolio as load_prediction_portfolio_db,
    load_watchlist as load_watchlist_db,
    mark_public_api_usage_cached as mark_public_api_usage_cached_db,
    record_portfolio_snapshot as record_portfolio_snapshot_db,
    reserve_public_api_daily_usage_transaction as reserve_public_api_daily_usage_transaction_db,
    save_notifications as save_notifications_db,
    save_portfolio as save_portfolio_db,
    save_prediction_portfolio as save_prediction_portfolio_db,
    save_watchlist as save_watchlist_db,
    session_scope as user_state_session_scope,
    set_public_api_key_status as set_public_api_key_status_db,
    touch_app_user as touch_app_user_db,
)

#Emoji Fix
import sys
import io

# Force UTF-8 stdout/stderr so emoji log lines don't blow up under servers
# whose default streams aren't UTF-8. Guarded because test runners (and other
# harnesses) replace sys.stdout with a capture object that has no .buffer;
# rewrapping it would break output capture, so we skip the rewrap there.
try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
except (AttributeError, ValueError):
    pass

# --- New Imports for Options Suggester ---
from options_suggester import generate_suggestion
import api_auth as api_auth_helpers
import authz
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

# --- Flask app configuration (consumed by create_app) ---
FLASK_ENV = os.getenv('FLASK_ENV', 'development').strip().lower()
IS_PRODUCTION = FLASK_ENV == 'production'

DEFAULT_DEV_CORS_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000'
CORS_ORIGINS_RAW = os.getenv('CORS_ORIGINS', DEFAULT_DEV_CORS_ORIGINS if not IS_PRODUCTION else '')
allowed_origins = [origin.strip().rstrip('/') for origin in CORS_ORIGINS_RAW.split(',') if origin.strip()]

if IS_PRODUCTION and not allowed_origins:
    raise ValueError("CORS_ORIGINS must be set in production (comma-separated origins).")

if not allowed_origins:
    allowed_origins = [origin.strip() for origin in DEFAULT_DEV_CORS_ORIGINS.split(',')]

# --- Rate limiting (limiter + RateLimits live in extensions.py so they can be
# imported by the @limiter.limit route decorators below without an app; the app
# is bound in create_app via limiter.init_app). ---
from flask_limiter.errors import RateLimitExceeded
from flask_limiter.util import get_remote_address
from extensions import limiter, RateLimits

# Every route and app-wide hook is registered on this single module-scope
# blueprint at import time. create_app() then builds the Flask app and registers
# the blueprint. This keeps all 120 route functions in place (with full access to
# this module's helpers) while making the application constructible on demand
# (e.g. an isolated app per test) instead of at import.
api_bp = Blueprint('api', __name__)


# --- Security Headers Middleware ---
@api_bp.before_app_request
def begin_public_api_request():
    api_public_helpers.begin_public_request()


@api_bp.after_app_request
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
        mark_public_api_usage_cached_fn=mark_public_api_usage_cached_db,
    )

@api_bp.app_errorhandler(RateLimitExceeded)
def handle_rate_limit_exceeded(_exc):
    if api_public_helpers.is_public_api_request(request.path):
        return _public_api_error_response(429, "rate_limited", "Rate limit exceeded for this API key.")
    return jsonify({"error": "Rate limit exceeded"}), 429


def create_app(config=None):
    """Application factory: build the Flask app, wire extensions, register routes.

    All routes/hooks are already registered on the module-scope ``api_bp`` by
    import time, so this just constructs the app, applies config, binds the
    rate limiter, and registers the blueprint. Pass ``config`` (a dict) to
    override ``app.config`` values in tests.
    """
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', os.urandom(32))
    if config:
        app.config.update(config)
    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        supports_credentials=False,
        allow_headers=["Content-Type", "Authorization", "Accept"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )
    limiter.init_app(app)
    app.register_blueprint(api_bp)
    return app

# --- CONFIGURATION ---
NEWS_API_KEY = config.NEWS_API_KEY
ALPHA_VANTAGE_API_KEY = config.ALPHA_VANTAGE_API_KEY

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
RATE_LIMIT_STORAGE_URL = (
    os.getenv('RATE_LIMIT_STORAGE_URL', '').strip()
    or PUBLIC_API_RATE_LIMIT_STORAGE_URL
)
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
AUTH_MODE = api_auth_helpers.validate_auth_mode(
    os.getenv('AUTH_MODE', 'clerk'),
    is_production=IS_PRODUCTION,
)
LOCAL_AUTH_TOKEN = os.getenv('LOCAL_AUTH_TOKEN', 'marketmind-local-development')
LOCAL_AUTH_USER_ID = os.getenv('LOCAL_AUTH_USER_ID', 'local_development_user').strip()


def validate_production_runtime_security(
    *,
    flask_secret_key: str,
    clerk_jwks_url: str,
    clerk_issuer: str,
    allow_legacy_user_data_seed: bool,
    persistence_mode: str,
    database_url: str,
    rate_limit_storage_url: str,
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
    if str(persistence_mode or '').strip().lower() != 'postgres':
        errors.append("PERSISTENCE_MODE must be postgres in production")
    normalized_database_url = str(database_url or '').strip().lower()
    if not normalized_database_url.startswith(
        ('postgresql://', 'postgresql+psycopg://', 'postgres://')
    ):
        errors.append("DATABASE_URL must be a PostgreSQL connection string in production")
    normalized_rate_limit_url = str(rate_limit_storage_url or '').strip().lower()
    if not normalized_rate_limit_url.startswith(('redis://', 'rediss://')):
        errors.append("RATE_LIMIT_STORAGE_URL must use Redis in production")

    if errors:
        raise ValueError("; ".join(errors))


if IS_PRODUCTION:
    validate_production_runtime_security(
        flask_secret_key=os.getenv('FLASK_SECRET_KEY', ''),
        clerk_jwks_url=CLERK_JWKS_URL,
        clerk_issuer=CLERK_ISSUER,
        allow_legacy_user_data_seed=ALLOW_LEGACY_USER_DATA_SEED,
        persistence_mode=PERSISTENCE_MODE,
        database_url=DATABASE_URL,
        rate_limit_storage_url=RATE_LIMIT_STORAGE_URL,
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


def _response_status_code(response):
    if isinstance(response, tuple):
        return int(response[1])
    return int(getattr(response, 'status_code', 200))


def _try_authenticate_optional_request():
    token = _get_clerk_bearer_token()
    if not token:
        return
    try:
        payload = _verify_auth_token(token)
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


def _verify_auth_token(token):
    return api_auth_helpers.verify_auth_token(
        token,
        auth_mode=AUTH_MODE,
        is_production=IS_PRODUCTION,
        local_auth_token=LOCAL_AUTH_TOKEN,
        local_user_id=LOCAL_AUTH_USER_ID,
        verify_clerk_token_fn=verify_clerk_token,
    )


def get_current_user_id():
    return getattr(g, 'current_user_id', None)


def get_current_principal():
    """The authorization Principal for the current request (None if unauthenticated)."""
    return getattr(g, 'principal', None)


def require_capability(capability):
    """Guard a route on a single capability (phase A2).

    Assumes ``@require_auth`` runs first (outer decorator), which populates
    ``g.principal``. Every signed-in user currently holds the base ``user`` role,
    which grants every non-admin capability, so this is behavior-preserving for
    those routes — but the enforcement point now exists.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            principal = get_current_principal()
            if principal is None or not principal.has(capability):
                return jsonify({"error": "You do not have access to this action."}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


def require_auth(f):
    return api_auth_helpers.build_require_auth(
        f,
        token_getter=lambda: _get_clerk_bearer_token(),
        verify_token_fn=lambda token: _verify_auth_token(token),
        sync_authenticated_user_fn=lambda payload: _sync_authenticated_user(payload),
        unauthorized_response_fn=lambda message, status: (jsonify({"error": message}), status),
        set_request_identity_fn=lambda payload: (
            setattr(g, 'current_user_id', payload['sub']),
            setattr(g, 'auth_payload', payload),
            # Authorization Principal (phase A1): informational for now — routes
            # begin asserting capabilities in a later phase. Every user gets the
            # base ``user`` role, so this is behavior-preserving.
            setattr(g, 'principal', authz.principal_for_user(payload['sub'], payload)),
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


def _public_api_reserve_daily_usage(identity, day_value, route_group, daily_quota):
    _ensure_user_state_storage_ready()
    try:
        reservation = reserve_public_api_daily_usage_transaction_db(
            DATABASE_URL,
            client_id=identity["client_id"],
            api_key_id=identity["api_key_id"],
            day_value=day_value,
            route_group=route_group,
            daily_quota=daily_quota,
        )
        return {"allowed": True, **reservation}
    except PublicApiQuotaExceeded as exc:
        return {
            "allowed": False,
            "used_before": exc.used,
            "used_after": exc.used,
            "quota": exc.quota,
        }
    except Exception as exc:
        logger.error("Public API quota reservation failed: %s", exc)
        raise api_public_helpers.PublicApiError(
            503,
            "quota_unavailable",
            "Public API quota enforcement is temporarily unavailable.",
        ) from exc


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
            reserve_daily_usage_fn=_public_api_reserve_daily_usage,
            error_response_fn=_public_api_error_response,
            set_principal_fn=lambda identity: setattr(
                g, 'principal', authz.principal_for_api_key(identity)
            ),
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
        @api_bp.route('/buy', methods=['POST'])
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
            save_portfolio_db(
                session,
                user_id,
                portfolio,
                clear_trade_history=reset_snapshots,
            )
            if reset_snapshots:
                session.query(PaperPortfolioSnapshot).filter_by(clerk_user_id=user_id).delete()
            record_portfolio_snapshot_db(session, user_id, portfolio)
        if _json_mirror_enabled():
            _save_portfolio_json(portfolio, user_id)
        return

    _save_portfolio_json(portfolio, user_id)
    record_portfolio_snapshot(portfolio, user_id)


def execute_paper_trade_atomic(user_id, *, action, symbol, quantity, price, occurred_at=None):
    if not user_id or not _sql_persistence_enabled():
        return None
    _ensure_user_state_storage_ready()
    result = execute_paper_trade_transaction_db(
        DATABASE_URL,
        user_id,
        action=action,
        symbol=symbol,
        quantity=quantity,
        price=price,
        occurred_at=occurred_at,
    )
    if _json_mirror_enabled():
        _save_portfolio_json(result["portfolio"], user_id)
    return result


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


@api_bp.route('/auth/me', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.ACCOUNT_READ)
@limiter.limit(RateLimits.LIGHT)
def auth_me():
    payload = getattr(g, 'auth_payload', {})
    return jsonify({
        "user_id": get_current_user_id(),
        "email": payload.get('email'),
        "username": payload.get('username'),
        "auth_mode": payload.get('auth_mode', 'clerk'),
    })


def _deliverables_not_configured_response():
    return jsonify({"error": "Deliverables require SQL-backed persistence and DATABASE_URL configuration"}), 503


def _marketmind_ai_not_configured_response():
    return jsonify({"error": "MarketMindAI requires SQL-backed persistence and DATABASE_URL configuration"}), 503


@api_bp.route('/deliverables', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_READ)
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
    )


@api_bp.route('/deliverables', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_WRITE)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_READ)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>', methods=['PATCH'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_WRITE)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>/assumptions', methods=['PUT'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_WRITE)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>/reviews', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_WRITE)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>/preflight', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_WRITE)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>/context', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_READ)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>/memos', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_READ)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>/memos/generate', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_WRITE)
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
    )


@api_bp.route('/deliverables/<string:deliverable_id>/memos/<string:memo_id>/download', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.DELIVERABLES_READ)
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
        bytes_io_cls=BytesIO,
        send_file_fn=send_file,
        docx_mime_type=DOCX_MIME_TYPE,
    )


@api_bp.route('/marketmind-ai/bootstrap', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
@limiter.limit(RateLimits.LIGHT)
def get_marketmind_ai_bootstrap():
    return marketmind_ai_handlers.get_bootstrap_handler(
        deliverables_ready_fn=_deliverables_ready,
        not_configured_response_fn=_marketmind_ai_not_configured_response,
        get_bootstrap_payload_fn=get_marketmind_ai_bootstrap_payload,
    )


@api_bp.route('/marketmind-ai/chats', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
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
    )


@api_bp.route('/marketmind-ai/chats/<string:chat_id>', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
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
    )


@api_bp.route('/marketmind-ai/chats/<string:chat_id>', methods=['DELETE'])
@require_auth
@require_capability(authz.Capabilities.AI_WRITE)
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
    )


@api_bp.route('/marketmind-ai/context', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
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
    )


@api_bp.route('/marketmind-ai/retrieval-status', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
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
    )


@api_bp.route('/marketmind-ai/chat', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.AI_WRITE)
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
    )


@api_bp.route('/marketmind-ai/artifacts/preflight', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.AI_WRITE)
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
    )


@api_bp.route('/marketmind-ai/artifacts', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
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
    )


@api_bp.route('/marketmind-ai/artifacts', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.AI_WRITE)
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
    )


@api_bp.route('/marketmind-ai/artifacts/<string:artifact_id>', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
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
    )


@api_bp.route('/marketmind-ai/artifacts/<string:artifact_id>/versions/<string:version_id>/download', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.AI_READ)
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
    )


# --- Watchlist Endpoints ---
@api_bp.route('/watchlist', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.WATCHLIST_READ)
@limiter.limit(RateLimits.LIGHT)
def get_watchlist():
    return market_data_handlers.get_watchlist_handler(
        get_current_user_id_fn=get_current_user_id,
        load_watchlist_fn=load_watchlist,
    )


@api_bp.route('/watchlist/<string:ticker>', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.WATCHLIST_WRITE)
@limiter.limit(RateLimits.WRITE)
def add_to_watchlist(ticker):
    return market_data_handlers.add_to_watchlist_handler(
        ticker,
        get_current_user_id_fn=get_current_user_id,
        load_watchlist_fn=load_watchlist,
        save_watchlist_fn=save_watchlist,
    )


@api_bp.route('/watchlist/<string:ticker>', methods=['DELETE'])
@require_auth
@require_capability(authz.Capabilities.WATCHLIST_WRITE)
@limiter.limit(RateLimits.WRITE)
def remove_from_watchlist(ticker):
    return market_data_handlers.remove_from_watchlist_handler(
        ticker,
        get_current_user_id_fn=get_current_user_id,
        load_watchlist_fn=load_watchlist,
        save_watchlist_fn=save_watchlist,
    )


# --- Stock Data Endpoint ---
@api_bp.route('/stock/<string:ticker>')
@limiter.limit(RateLimits.STANDARD)
def get_stock_data(ticker):
    return market_data_handlers.get_stock_data_handler(
        ticker,
        request_obj=request,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        yf_module=yf,
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


# --- Chart Endpoint ---
@api_bp.route('/chart/<string:ticker>')
def get_chart_data(ticker):
    return market_data_handlers.get_chart_data_handler(
        ticker,
        request_obj=request,
        yf_module=yf,
        clean_value_fn=clean_value,
        chart_prediction_points_fn=lambda _ticker: [],
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
    )


# --- News Endpoint ---
@api_bp.route('/news')
def get_query_news():
    return market_data_handlers.get_query_news_handler(
        request_obj=request,
        news_api_key=NEWS_API_KEY,
    )


# --- Options Endpoints ---
@api_bp.route('/options/stock_price/<string:ticker>')
def get_options_stock_price(ticker):
    return market_data_handlers.get_options_stock_price_handler(
        ticker,
        yf_module=yf,
        clean_value_fn=clean_value,
    )


@api_bp.route('/options/<string:ticker>', methods=['GET'])
def get_option_expirations(ticker):
    return market_data_handlers.get_option_expirations_handler(
        ticker,
        yf_module=yf,
    )


@api_bp.route('/options/chain/<ticker>', methods=['GET'])
def get_option_chain(ticker):
    return market_data_handlers.get_option_chain_handler(
        ticker,
        request_obj=request,
        yf_module=yf,
    )

# --- Options Suggestion Endpoint ---
@api_bp.route('/options/suggest/<string:ticker>', methods=['GET'])
def get_option_suggestion(ticker):
    return market_data_handlers.get_option_suggestion_handler(
        ticker,
        generate_suggestion_fn=generate_suggestion,
    )


# --- ML Endpoints ---
@api_bp.route('/predict/<string:model>/<string:ticker>')
@require_auth
@require_capability(authz.Capabilities.PREDICTIONS_RUN)
@limiter.limit(RateLimits.HEAVY)
def predict_stock(model, ticker):
    response = market_data_handlers.predict_stock_handler(
        model,
        ticker,
        create_dataset_fn=create_dataset,
        future_prediction_dates_fn=prediction_service.get_future_prediction_dates,
        linear_regression_predict_fn=linear_regression_predict,
        random_forest_predict_fn=random_forest_predict,
        xgboost_predict_fn=xgboost_predict,
        gradient_boosting_predict_fn=gradient_boosting_predict,
        lightgbm_predict_fn=lightgbm_predict,
        catboost_predict_fn=catboost_predict,
        lstm_train_fn=lstm_train,
        lstm_predict_fn=lstm_predict,
        transformer_train_fn=transformer_train,
        transformer_predict_fn=transformer_predict,
        yf_module=yf,
        log_api_error_fn=log_api_error,
    )
    return response

def _to_bool(value):
    return api_prediction_runtime_helpers.to_bool(value)


def _live_ensemble_signal_components(sanitized_ticker):
    return api_prediction_runtime_helpers.live_ensemble_signal_components(
        sanitized_ticker,
        create_dataset_fn=create_dataset,
        ensemble_predict_fn=ensemble_predict,
    )


def _chart_prediction_points(sanitized_ticker):
    return api_prediction_runtime_helpers.chart_prediction_points(
        sanitized_ticker,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
    )


@api_bp.route('/predict/ensemble/<string:ticker>')
@require_auth
@require_capability(authz.Capabilities.PREDICTIONS_RUN)
@limiter.limit(RateLimits.HEAVY)
def predict_ensemble(ticker):
    response = market_data_handlers.predict_ensemble_handler(
        ticker,
        request_obj=request,
        future_prediction_dates_fn=prediction_service.get_future_prediction_dates,
        yf_module=yf,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
    )
    return response


# --- Paper Trading Endpoints (Using JSON persistence) ---

def _record_portfolio_snapshot_legacy(portfolio_data, user_id):
    return api_state_helpers.record_portfolio_snapshot_legacy(
        portfolio_data,
        user_id,
        get_db_fn=get_db,
    )


def record_portfolio_snapshot(portfolio_data, user_id):
    if user_id and _sql_persistence_enabled():
        _ensure_user_state_storage_ready()
        with user_state_session_scope(DATABASE_URL) as session:
            record_portfolio_snapshot_db(session, user_id, portfolio_data)
        return
    _record_portfolio_snapshot_legacy(portfolio_data, user_id)


@api_bp.route('/paper/portfolio', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.PAPER_READ)
def get_paper_portfolio():
    return paper_handlers.get_paper_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        yf_module=yf,
    )


@api_bp.route('/paper/portfolio/optimize', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PAPER_TRADE)
@limiter.limit(RateLimits.STANDARD)
def optimize_paper_portfolio():
    return paper_handlers.optimize_paper_portfolio_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        optimize_portfolio_fn=portfolio_optimization_service.optimize_paper_portfolio,
        error_cls=portfolio_optimization_service.PortfolioOptimizationError,
    )


@api_bp.route('/paper/buy', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PAPER_TRADE)
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['ticker', 'shares'])
def buy_stock():
    return paper_handlers.buy_stock_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        execute_trade_fn=execute_paper_trade_atomic,
        trade_error_cls=PaperTradeExecutionError,
        yf_module=yf,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/paper/sell', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PAPER_TRADE)
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['ticker', 'shares'])
def sell_stock():
    return paper_handlers.sell_stock_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        execute_trade_fn=execute_paper_trade_atomic,
        trade_error_cls=PaperTradeExecutionError,
        yf_module=yf,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/paper/options/buy', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PAPER_TRADE)
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['contractSymbol', 'quantity', 'price'])
def buy_option():
    return paper_handlers.buy_option_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        execute_trade_fn=execute_paper_trade_atomic,
        trade_error_cls=PaperTradeExecutionError,
        resolve_option_price_fn=lambda symbol, side: paper_handlers.resolve_option_market_price(
            symbol,
            side,
            yf_module=yf,
        ),
    )


@api_bp.route('/paper/options/sell', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PAPER_TRADE)
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['contractSymbol', 'quantity', 'price'])
def sell_option():
    return paper_handlers.sell_option_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
        execute_trade_fn=execute_paper_trade_atomic,
        trade_error_cls=PaperTradeExecutionError,
        resolve_option_price_fn=lambda symbol, side: paper_handlers.resolve_option_market_price(
            symbol,
            side,
            yf_module=yf,
        ),
    )


# --- This is YOUR corrected portfolio history endpoint ---
@api_bp.route('/paper/history', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.PAPER_READ)
def get_paper_history():
    return paper_handlers.get_paper_history_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
        yf_module=yf,
        date_cls=date,
        timedelta_cls=timedelta,
    )


@api_bp.route('/paper/transactions', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.PAPER_READ)
def get_trade_history():
    return paper_handlers.get_trade_history_handler(
        get_current_user_id_fn=get_current_user_id,
        load_portfolio_fn=load_portfolio,
    )


@api_bp.route('/paper/reset', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PAPER_TRADE)
def reset_portfolio():
    return paper_handlers.reset_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        save_portfolio_with_snapshot_fn=save_portfolio_with_snapshot,
    )


# --- NEW: Notification Endpoints ---
@api_bp.route('/notifications', methods=['GET', 'POST'])
@require_auth
@require_capability(authz.Capabilities.NOTIFICATIONS_WRITE)
def handle_notifications():
    return notification_handlers.handle_notifications_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        yf_module=yf,
    )


@api_bp.route('/notifications/smart', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.NOTIFICATIONS_WRITE)
def create_smart_alert():
    return notification_handlers.create_smart_alert_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        yf_module=yf,
    )


@api_bp.route('/notifications/<string:alert_id>', methods=['DELETE'])
@require_auth
@require_capability(authz.Capabilities.NOTIFICATIONS_WRITE)
def delete_notification(alert_id):
    return notification_handlers.delete_notification_handler(
        alert_id,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
    )


@api_bp.route('/notifications/triggered', methods=['GET', 'DELETE'])
@require_auth
@require_capability(authz.Capabilities.NOTIFICATIONS_WRITE)
def get_triggered_notifications():
    return notification_handlers.get_triggered_notifications_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
    )


@api_bp.route('/notifications/triggered/<string:alert_id>', methods=['DELETE'])
@require_auth
@require_capability(authz.Capabilities.NOTIFICATIONS_WRITE)
def delete_triggered_notification(alert_id):
    return notification_handlers.delete_triggered_notification_handler(
        alert_id,
        get_current_user_id_fn=get_current_user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
    )


# --- END NEW NOTIFICATION ENDPOINTS ---


# --- NEW: Background Price Checker ---
def _check_alerts_for_user(user_id):
    return api_scheduler_helpers.check_alerts_for_user(
        user_id,
        load_notifications_fn=load_notifications,
        save_notifications_fn=save_notifications,
        yf_module=yf,
    )


def check_alerts():
    return api_scheduler_helpers.check_alerts(
        iter_user_ids_fn=_iter_user_ids,
        check_alerts_for_user_fn=_check_alerts_for_user,
    )


def run_scheduler():
    return api_scheduler_helpers.run_scheduler(
        schedule_module=schedule,
        check_alerts_fn=check_alerts,
    )


# --- END BACKGROUND CHECKER ---


# --- All of Tazeem's other endpoints (Forex, Crypto, etc.) ---
@api_bp.route('/api/news', methods=['GET'])
def news_api():
    return reference_data_handlers.news_api_handler(
        get_general_news_fn=get_general_news,
    )


@api_bp.route('/evaluate/<string:ticker>')
@require_auth
@require_capability(authz.Capabilities.PREDICTIONS_RUN)
@limiter.limit(RateLimits.HEAVY)
def evaluate_models(ticker):
    return market_data_handlers.evaluate_models_handler(
        ticker,
        request_obj=request,
        rolling_window_backtest_fn=rolling_window_backtest,
    )


@api_bp.route('/forex/convert')
def forex_convert():
    return reference_data_handlers.forex_convert_handler(
        request_obj=request,
        get_exchange_rate_fn=get_exchange_rate,
    )


@api_bp.route('/forex/currencies')
def forex_currencies():
    return reference_data_handlers.forex_currencies_handler(
        get_currency_list_fn=get_currency_list,
    )


@api_bp.route('/crypto/convert')
def crypto_convert():
    return reference_data_handlers.crypto_convert_handler(
        request_obj=request,
        get_crypto_exchange_rate_fn=get_crypto_exchange_rate,
    )


@api_bp.route('/crypto/list')
def crypto_list():
    return reference_data_handlers.crypto_list_handler(
        get_crypto_list_fn=get_crypto_list,
    )


@api_bp.route('/crypto/currencies')
def crypto_target_currencies():
    return reference_data_handlers.crypto_target_currencies_handler(
        get_target_currencies_fn=get_target_currencies,
    )


@api_bp.route('/commodities/price/<string:commodity>')
def commodity_price(commodity):
    return reference_data_handlers.commodity_price_handler(
        commodity,
        request_obj=request,
        get_commodity_price_fn=get_commodity_price,
    )


@api_bp.route('/commodities/list')
def commodities_list():
    return reference_data_handlers.commodities_list_handler(
        get_commodity_list_fn=get_commodity_list,
    )


@api_bp.route('/commodities/all')
def commodities_all():
    return reference_data_handlers.commodities_all_handler(
        get_commodities_by_category_fn=get_commodities_by_category,
    )


# ============================================================
# PREDICTION MARKETS ENDPOINTS (Standalone Feature)
# ============================================================

@api_bp.route('/prediction-markets', methods=['GET'])
@limiter.limit(RateLimits.STANDARD)
def list_prediction_markets():
    return prediction_markets_handlers.list_prediction_markets_handler(
        request_obj=request,
        pm_search_markets_fn=pm_search_markets,
        pm_fetch_markets_fn=pm_fetch_markets,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/prediction-markets/exchanges', methods=['GET'])
@limiter.limit(RateLimits.LIGHT)
def list_prediction_exchanges():
    return prediction_markets_handlers.list_prediction_exchanges_handler(
        pm_get_exchanges_fn=pm_get_exchanges,
    )


@api_bp.route('/prediction-markets/analyze', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PREDICTION_MARKETS_TRADE)
@limiter.limit(RateLimits.WRITE)
def analyze_prediction_market():
    return prediction_markets_handlers.analyze_prediction_market_handler(
        request_obj=request,
        analyze_prediction_market_fn=pm_analyze_market,
        error_cls=PredictionMarketAnalysisError,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/prediction-markets/<path:market_id>', methods=['GET'])
@limiter.limit(RateLimits.STANDARD)
def get_prediction_market(market_id):
    return prediction_markets_handlers.get_prediction_market_handler(
        market_id,
        request_obj=request,
        pm_get_market_fn=pm_get_market,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/prediction-markets/portfolio', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.PREDICTION_MARKETS_READ)
@limiter.limit(RateLimits.LIGHT)
def get_prediction_portfolio():
    return prediction_markets_handlers.get_prediction_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
        pm_get_prices_fn=pm_get_prices,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/prediction-markets/buy', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PREDICTION_MARKETS_TRADE)
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['market_id', 'outcome', 'contracts'])
def buy_prediction_contract():
    return prediction_markets_handlers.buy_prediction_contract_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
        pm_get_market_fn=pm_get_market,
        save_prediction_portfolio_fn=save_prediction_portfolio,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/prediction-markets/sell', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PREDICTION_MARKETS_TRADE)
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['market_id', 'outcome', 'contracts'])
def sell_prediction_contract():
    return prediction_markets_handlers.sell_prediction_contract_handler(
        request_obj=request,
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
        pm_get_market_fn=pm_get_market,
        save_prediction_portfolio_fn=save_prediction_portfolio,
        log_api_error_fn=log_api_error,
    )


@api_bp.route('/prediction-markets/history', methods=['GET'])
@require_auth
@require_capability(authz.Capabilities.PREDICTION_MARKETS_READ)
@limiter.limit(RateLimits.LIGHT)
def get_prediction_trade_history():
    return prediction_markets_handlers.get_prediction_trade_history_handler(
        get_current_user_id_fn=get_current_user_id,
        load_prediction_portfolio_fn=load_prediction_portfolio,
    )


@api_bp.route('/prediction-markets/reset', methods=['POST'])
@require_auth
@require_capability(authz.Capabilities.PREDICTION_MARKETS_TRADE)
@limiter.limit(RateLimits.WRITE)
def reset_prediction_portfolio():
    return prediction_markets_handlers.reset_prediction_portfolio_handler(
        get_current_user_id_fn=get_current_user_id,
        save_prediction_portfolio_fn=save_prediction_portfolio,
    )


def _fundamentals_from_yfinance(sym):
    return api_market_utils_helpers.fundamentals_from_yfinance(sym, yf_module=yf, logger=logger)


def _resolve_market_asset(ticker, market=None):
    return parse_asset_reference(ticker, market)


@api_bp.route('/fundamentals/<string:ticker>')
def get_fundamentals(ticker):
    return reference_data_handlers.get_fundamentals_handler(
        ticker,
        request_obj=request,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        clean_value_fn=clean_value,
        fundamentals_from_yfinance_fn=_fundamentals_from_yfinance,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )
# --- NEW: Autocomplete Symbol Search (from Jimmy's branch) ---
@api_bp.route('/search-symbols')
def search_symbols():
    return market_data_handlers.search_symbols_handler(
        request_obj=request,
        get_symbol_suggestions_fn=get_symbol_suggestions,
        search_international_symbols_fn=akshare_service.search_equities,
    )



# Create a "memory" cache so we don't spam the API
CALENDAR_CACHE = {
    "data": None,
    "last_fetched": 0
}


@api_bp.route('/calendar/economic', methods=['GET'])
def get_economic_calendar():
    return reference_data_handlers.get_economic_calendar_handler(
        calendar_cache=CALENDAR_CACHE,
    )


@api_bp.route('/calendar/market-sessions', methods=['GET'])
def get_market_sessions_calendar():
    return reference_data_handlers.get_market_sessions_handler(
        request_obj=request,
        exchange_session_service_module=exchange_session_service,
    )

# ─────────────────────────────────────────────────────────────────────────────
# OpenBB-powered endpoints
# ─────────────────────────────────────────────────────────────────────────────

def _obb_to_float(val):
    return api_market_utils_helpers.obb_to_float(val)


@api_bp.route('/fundamentals/financials/<string:ticker>')
def get_financial_statements(ticker):
    return reference_data_handlers.get_financial_statements_handler(
        ticker,
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        obb_to_float_fn=_obb_to_float,
    )


@api_bp.route('/fundamentals/filings/<string:ticker>')
def get_sec_filings(ticker):
    return reference_data_handlers.get_sec_filings_handler(
        ticker,
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        sec_filings_service_module=sec_filings_service,
    )


@api_bp.route('/fundamentals/sec-intelligence/<string:ticker>')
def get_sec_intelligence(ticker):
    return reference_data_handlers.get_sec_intelligence_handler(
        ticker,
        sec_filings_service_module=sec_filings_service,
    )


@api_bp.route('/fundamentals/filings/<string:ticker>/<string:accession_number>')
def get_sec_filing_detail(ticker, accession_number):
    return reference_data_handlers.get_sec_filing_detail_handler(
        ticker,
        accession_number,
        sec_filings_service_module=sec_filings_service,
    )


@api_bp.route('/screener')
def get_screener():
    return reference_data_handlers.get_screener_handler(
        base_dir=BASE_DIR,
        yf_module=yf,
        screener_query_service_module=screener_query_service,
    )


@api_bp.route('/screener/presets')
def get_screener_presets():
    return reference_data_handlers.get_screener_presets_handler(
        base_dir=BASE_DIR,
        yf_module=yf,
        screener_query_service_module=screener_query_service,
    )


@api_bp.route('/screener/scan')
def get_screener_scan():
    return reference_data_handlers.get_screener_scan_handler(
        base_dir=BASE_DIR,
        yf_module=yf,
        request_obj=request,
        screener_query_service_module=screener_query_service,
    )


MACRO_INDICATORS = [
    {"symbol": "URATE", "name": "Unemployment Rate",     "unit": "%",    "multiplier": 1, "openbb_multiplier": 100, "fred_multiplier": 1, "series_id": "UNRATE"},
    {"symbol": "CPI",   "name": "Consumer Price Index",  "unit": "Index","multiplier": 1, "series_id": "CPIAUCSL"},
    {"symbol": "IP",    "name": "Industrial Production", "unit": "Index","multiplier": 1, "series_id": "INDPRO"},
]

@api_bp.route('/macro/overview')
def get_macro_overview():
    return reference_data_handlers.get_macro_overview_handler(
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        yf_module=yf,
        macro_indicators=MACRO_INDICATORS,
        request_obj=request,
        akshare_service_module=akshare_service,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MarketMind Public API v1 (Private Beta)
# ─────────────────────────────────────────────────────────────────────────────

@api_bp.route('/api/public/docs', methods=['GET'])
def public_api_docs():
    if not _public_api_docs_enabled():
        return _public_api_error_response(404, "not_found", "MarketMind Public API docs are not enabled.")
    with open(PUBLIC_API_DOCS_PATH, 'r', encoding='utf-8') as f:
        return app.response_class(f.read(), mimetype='text/html')


@api_bp.route('/api/public/openapi/v1.yaml', methods=['GET'])
def public_api_openapi_spec():
    if not _public_api_docs_enabled():
        return _public_api_error_response(404, "not_found", "MarketMind Public API docs are not enabled.")
    with open(PUBLIC_API_OPENAPI_PATH, 'r', encoding='utf-8') as f:
        return app.response_class(f.read(), mimetype='application/yaml')


@api_bp.route('/api/public/openapi/v2.yaml', methods=['GET'])
def public_api_openapi_spec_v2():
    if not _public_api_docs_enabled():
        return _public_api_error_response(404, "not_found", "MarketMind Public API docs are not enabled.")
    with open(PUBLIC_API_OPENAPI_V2_PATH, 'r', encoding='utf-8') as f:
        return app.response_class(f.read(), mimetype='application/yaml')


@api_bp.route('/api/public/v1/health', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('health')
def public_api_health():
    return _public_dispatch(public_handlers.health_handler, version='v1')


@api_bp.route('/api/public/v1/stock/<string:ticker>', methods=['GET'])
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
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@api_bp.route('/api/public/v1/chart/<string:ticker>', methods=['GET'])
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
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
    )


@api_bp.route('/api/public/v1/news', methods=['GET'])
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
    )


@api_bp.route('/api/public/v1/search-symbols', methods=['GET'])
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
    )


@api_bp.route('/api/public/v1/predictions/ensemble/<string:ticker>', methods=['GET'])
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
        future_prediction_dates_fn=prediction_service.get_future_prediction_dates,
        yf_module=yf,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
    )


@api_bp.route('/api/public/v1/fundamentals/<string:ticker>', methods=['GET'])
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
        clean_value_fn=clean_value,
        fundamentals_from_yfinance_fn=_fundamentals_from_yfinance,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@api_bp.route('/api/public/v1/macro/overview', methods=['GET'])
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
        yf_module=yf,
        macro_indicators=MACRO_INDICATORS,
    )


@api_bp.route('/api/public/v2/health', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/health')
def public_api_v2_health():
    return _public_dispatch(public_handlers.health_handler, version='v2')


@api_bp.route('/api/public/v2/search-symbols', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/stock/<string:ticker>', methods=['GET'])
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
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@api_bp.route('/api/public/v2/chart/<string:ticker>', methods=['GET'])
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
        clean_value_fn=clean_value,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
    )


@api_bp.route('/api/public/v2/fundamentals/<string:ticker>', methods=['GET'])
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
        clean_value_fn=clean_value,
        fundamentals_from_yfinance_fn=_fundamentals_from_yfinance,
        resolve_asset_fn=_resolve_market_asset,
        akshare_service_module=akshare_service,
        exchange_session_service_module=exchange_session_service,
    )


@api_bp.route('/api/public/v2/macro/overview', methods=['GET'])
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
        yf_module=yf,
        macro_indicators=MACRO_INDICATORS,
        akshare_service_module=akshare_service,
    )


@api_bp.route('/api/public/v2/predictions/ensemble/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/predictions/ensemble')
def public_api_v2_ensemble_prediction(ticker):
    return _public_dispatch(
        public_handlers.ensemble_prediction_handler,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/predictions/ensemble', ticker=ticker.upper()),
        cache_ttl_seconds=900,
        predict_ensemble_handler_fn=market_data_handlers.predict_ensemble_handler,
        future_prediction_dates_fn=prediction_service.get_future_prediction_dates,
        yf_module=yf,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
    )


@api_bp.route('/api/public/v2/evaluations/<string:ticker>', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/evaluations')
def public_api_v2_evaluations(ticker):
    return _public_dispatch(
        public_handlers.evaluation_summary_handler,
        ticker,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/evaluations', ticker=ticker.upper()),
        cache_ttl_seconds=900,
        evaluate_models_handler_fn=market_data_handlers.evaluate_models_handler,
        rolling_window_backtest_fn=rolling_window_backtest,
    )


@api_bp.route('/api/public/v2/screener/presets', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/screener/presets')
def public_api_v2_screener_presets():
    return _public_dispatch(
        public_handlers.screener_presets_public_handler,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/screener/presets'),
        cache_ttl_seconds=900,
        get_screener_presets_handler_fn=reference_data_handlers.get_screener_presets_handler,
        base_dir=BASE_DIR,
        yf_module=yf,
        screener_query_service_module=screener_query_service,
    )


@api_bp.route('/api/public/v2/screener/scan', methods=['GET'])
@limiter.limit(PUBLIC_API_GLOBAL_EMERGENCY_LIMIT, key_func=_public_api_global_limit_key)
@limiter.limit(PUBLIC_API_FALLBACK_IP_LIMIT, key_func=get_remote_address)
@limiter.limit(PUBLIC_API_DEFAULT_PER_HOUR_LIMIT, key_func=_public_api_rate_limit_key)
@limiter.limit(PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT, key_func=_public_api_rate_limit_key)
@require_public_api_auth('v2/screener/scan')
def public_api_v2_screener_scan():
    return _public_dispatch(
        public_handlers.screener_scan_public_handler,
        request_obj=request,
        cache_backend=_public_cache(),
        cache_key=_public_cache_key('v2/screener/scan'),
        cache_ttl_seconds=300,
        get_screener_scan_handler_fn=reference_data_handlers.get_screener_scan_handler,
        base_dir=BASE_DIR,
        yf_module=yf,
        screener_query_service_module=screener_query_service,
    )


@api_bp.route('/api/public/v2/options/stock-price/<string:ticker>', methods=['GET'])
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


@api_bp.route('/api/public/v2/options/expirations/<string:ticker>', methods=['GET'])
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


@api_bp.route('/api/public/v2/options/chain/<string:ticker>', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/options/suggest/<string:ticker>', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/forex/convert', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/forex/currencies', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/crypto/convert', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/crypto/list', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/crypto/currencies', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/commodities/price/<string:commodity>', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/commodities/list', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/commodities/all', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/prediction-markets', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/prediction-markets/exchanges', methods=['GET'])
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


@api_bp.route('/api/public/v2/prediction-markets/<path:market_id>', methods=['GET'])
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
    )


@api_bp.route('/api/public/v2/calendar/economic', methods=['GET'])
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
    )


@api_bp.route('/healthz', methods=['GET'])
def healthz():
    return jsonify(
        {
            "status": "ok",
            "service": "marketmind-backend",
            "environment": FLASK_ENV,
            "auth_mode": AUTH_MODE,
            "persistence_mode": PERSISTENCE_MODE,
            "public_api_enabled": _public_api_enabled(),
        }
    ), 200


# WSGI / module-level application instance. Built here — after every route and
# hook has registered on api_bp above — so gunicorn (`api:app`) and `app.run`
# below resolve it. Tests should call create_app() for an isolated instance.
app = create_app()


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
