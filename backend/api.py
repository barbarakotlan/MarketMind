# To run this file, you need to install all dependencies:
# pip install Flask Flask-CORS yfinance pandas scikit-learn numpy requests python-dotenv statsmodels finnhub-python vaderSentiment xgboost schedule

import os
import yfinance as yf
import pandas as pd
import numpy as np
import requests
from flask import Flask, jsonify, request, g, send_file
from flask_cors import CORS
from datetime import datetime, timedelta, date
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

# --- Tazeem's Imports ---
from model import create_dataset, estimate_week, try_today, estimate_new, good_model
from news_fetcher import get_general_news
from ensemble_model import ensemble_predict, calculate_metrics, linear_regression_predict, random_forest_predict, xgboost_predict
from professional_evaluation import rolling_window_backtest
from selective_prediction import (
    infer_selective_decision,
    SELECTIVE_MODES,
    SELECTIVE_DISABLED_STATUSES,
    SELECTOR_SOURCE_REQUESTABLE,
)
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
    list_marketmind_ai_artifacts,
    list_marketmind_ai_chats,
)
from user_state_store import (
    ensure_database_ready as ensure_user_state_database_ready,
    list_app_user_ids as list_app_user_ids_db,
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
    touch_app_user as touch_app_user_db,
)

#Emoji Fix
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# --- New Imports for Options Suggester ---
from options_suggester import generate_suggestion
import api_auth as api_auth_helpers
import api_handlers_deliverables as deliverables_handlers
import api_handlers_market_data as market_data_handlers
import api_handlers_marketmind_ai as marketmind_ai_handlers
import api_handlers_notifications as notification_handlers
import api_handlers_paper as paper_handlers
import api_handlers_prediction_markets as prediction_markets_handlers
import api_handlers_reference_data as reference_data_handlers
import api_market_utils as api_market_utils_helpers
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
    return response

# --- Rate Limiting Setup ---
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    app=app
)

# Define rate limits
class RateLimits:
    LIGHT = os.getenv('RATE_LIMIT_LIGHT', '10/minute')
    STANDARD = os.getenv('RATE_LIMIT_STANDARD', '20/minute')
    HEAVY = os.getenv('RATE_LIMIT_HEAVY', '2/minute')
    WRITE = os.getenv('RATE_LIMIT_WRITE', '5/minute')

# --- CONFIGURATION ---
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')

# Validate required environment variables in production
if IS_PRODUCTION:
    if not NEWS_API_KEY:
        logger.warning("⚠️ NEWS_API_KEY not set in production environment")
    if not ALPHA_VANTAGE_API_KEY:
        logger.warning("⚠️ ALPHA_VANTAGE_API_KEY not set in production environment")
    if not os.getenv('FLASK_SECRET_KEY'):
        logger.error("❌ FLASK_SECRET_KEY must be set in production environment")
        raise ValueError("FLASK_SECRET_KEY environment variable is required in production")

# --- Paths & Auth Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'marketmind.db')
DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
PERSISTENCE_MODE = os.getenv('PERSISTENCE_MODE', 'json').strip().lower()

PORTFOLIO_FILE = os.path.join(BASE_DIR, 'paper_portfolio.json')
NOTIFICATIONS_FILE = os.path.join(BASE_DIR, 'notifications.json')
PREDICTION_PORTFOLIO_FILE = os.path.join(BASE_DIR, 'prediction_portfolio.json')
USER_DATA_DIR = os.path.join(BASE_DIR, 'user_data')
ALLOW_LEGACY_USER_DATA_SEED = os.getenv('ALLOW_LEGACY_USER_DATA_SEED', 'false').strip().lower() == 'true'

CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', '').strip()
CLERK_AUDIENCE = os.getenv('CLERK_AUDIENCE', '').strip()
CLERK_JWKS_CACHE_TTL_SECONDS = int(os.getenv('CLERK_JWKS_CACHE_TTL_SECONDS', '3600'))
_JWKS_CACHE = {}


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


def _resolve_clerk_jwks_url(issuer):
    return api_auth_helpers.resolve_clerk_jwks_url(CLERK_JWKS_URL, issuer)


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
        clerk_audience=CLERK_AUDIENCE,
        jwks_cache_ttl_seconds=CLERK_JWKS_CACHE_TTL_SECONDS,
        jwks_cache=_JWKS_CACHE,
        requests_get=requests.get,
        time_fn=time.time,
    )


def get_current_user_id():
    return getattr(g, 'current_user_id', None)


def require_auth(f):
    return api_auth_helpers.build_require_auth(
        f,
        token_getter=lambda: _get_bearer_token(),
        verify_token_fn=lambda token: verify_clerk_token(token),
        sync_authenticated_user_fn=lambda payload: _sync_authenticated_user(payload),
        logger=logger,
        unauthorized_response_fn=lambda message, status: (jsonify({"error": message}), status),
        set_request_identity_fn=lambda payload: (
            setattr(g, 'current_user_id', payload['sub']),
            setattr(g, 'auth_payload', payload),
        ),
    )

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
    return marketmind_ai_handlers.get_context_handler(
        ticker=ticker,
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
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        yf_module=yf,
        requests_module=requests,
        jsonify_fn=jsonify,
        logger=logger,
        clean_value_fn=clean_value,
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
    return market_data_handlers.predict_stock_handler(
        model,
        ticker,
        create_dataset_fn=create_dataset,
        linear_regression_predict_fn=linear_regression_predict,
        random_forest_predict_fn=random_forest_predict,
        xgboost_predict_fn=xgboost_predict,
        yf_module=yf,
        jsonify_fn=jsonify,
        log_api_error_fn=log_api_error,
        logger=logger,
        pd_module=pd,
    )

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
    return market_data_handlers.predict_ensemble_handler(
        ticker,
        request_obj=request,
        selective_modes=SELECTIVE_MODES,
        selector_source_requestable=SELECTOR_SOURCE_REQUESTABLE,
        yf_module=yf,
        live_ensemble_signal_components_fn=_live_ensemble_signal_components,
        infer_selective_decision_fn=infer_selective_decision,
        jsonify_fn=jsonify,
        logger=logger,
        pd_module=pd,
        np_module=np,
    )


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


@app.route('/paper/buy', methods=['POST'])
@require_auth
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['ticker', 'shares'])
def buy_stock():
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


@app.route('/fundamentals/<string:ticker>')
def get_fundamentals(ticker):
    return reference_data_handlers.get_fundamentals_handler(
        ticker,
        alpha_vantage_api_key=ALPHA_VANTAGE_API_KEY,
        requests_module=requests,
        jsonify_fn=jsonify,
        logger=logger,
        clean_value_fn=clean_value,
        fundamentals_from_yfinance_fn=_fundamentals_from_yfinance,
    )
# --- NEW: Autocomplete Symbol Search (from Jimmy's branch) ---
@app.route('/search-symbols')
def search_symbols():
    return market_data_handlers.search_symbols_handler(
        request_obj=request,
        get_symbol_suggestions_fn=get_symbol_suggestions,
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
        jsonify_fn=jsonify,
        logger=logger,
    )


@app.route('/screener')
def get_screener():
    return reference_data_handlers.get_screener_handler(
        openbb_available=OPENBB_AVAILABLE,
        obb_module=obb if OPENBB_AVAILABLE else None,
        jsonify_fn=jsonify,
        logger=logger,
        obb_to_float_fn=_obb_to_float,
    )


MACRO_INDICATORS = [
    {"symbol": "URATE", "name": "Unemployment Rate",     "unit": "%",    "multiplier": 100},
    {"symbol": "CPI",   "name": "Consumer Price Index",  "unit": "Index","multiplier": 1},
    {"symbol": "IP",    "name": "Industrial Production", "unit": "Index","multiplier": 1},
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
    )


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
