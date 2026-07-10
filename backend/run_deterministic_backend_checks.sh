#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
export DATABASE_URL="${DATABASE_URL:-}"
export PERSISTENCE_MODE="${PERSISTENCE_MODE:-json}"
export AUTH_MODE="clerk"
export PYTHONPYCACHEPREFIX="${PYTHONPYCACHEPREFIX:-/tmp/marketmind_pycache}"

# Raise the flask-limiter route limits so business-logic tests that legitimately
# hit the same endpoint several times aren't throttled (e.g. deliverables memo
# generation). The public API's separate daily-quota mechanism is unaffected, so
# its rate-limit test still exercises a real 429.
export RATE_LIMIT_LIGHT="${RATE_LIMIT_LIGHT:-100000/minute}"
export RATE_LIMIT_STANDARD="${RATE_LIMIT_STANDARD:-100000/minute}"
export RATE_LIMIT_HEAVY="${RATE_LIMIT_HEAVY:-100000/minute}"
export RATE_LIMIT_WRITE="${RATE_LIMIT_WRITE:-100000/minute}"

# Lint the backend (pyflakes rules via ruff; config in pyproject.toml).
if command -v ruff >/dev/null 2>&1; then
  ruff check backend/
else
  "$PYTHON_BIN" -m ruff check backend/
fi

"$PYTHON_BIN" backend/check_complexity.py

"$PYTHON_BIN" -m py_compile \
  backend/api.py \
  backend/user_journey_state.py \
  backend/user_journey_harness.py \
  backend/tests/test_chart_prediction_append.py \
  backend/tests/test_user_journey_state.py \
  backend/tests/test_user_journey_harness.py

# Run the full backend test suite (backend/tests is a namespace package, so the
# modules are listed explicitly rather than discovered). This became reliable
# once B3 made `import api` ML-free and the numpy-ABI-sensitive deps
# (duckdb/numexpr) match the pinned versions; earlier this gated only a curated
# subset.
"$PYTHON_BIN" -m coverage run --branch --source=backend --omit='backend/tests/*' -m unittest \
  backend.tests.test_akshare_service \
  backend.tests.test_alert_worker \
  backend.tests.test_api_auth_security \
  backend.tests.test_api_contracts \
  backend.tests.test_api_state_json \
  backend.tests.test_app_factory \
  backend.tests.test_asset_identity \
  backend.tests.test_auth_isolation \
  backend.tests.test_authz \
  backend.tests.test_backfill_postgres \
  backend.tests.test_chart_prediction_append \
  backend.tests.test_complexity_guard \
  backend.tests.test_deliverables_api \
  backend.tests.test_exchange_session_routes \
  backend.tests.test_exchange_session_service \
  backend.tests.test_http_policy \
  backend.tests.test_import_is_ml_free \
  backend.tests.test_macro_overview_handler \
  backend.tests.test_marketmind_ai_api \
  backend.tests.test_maintainability_units \
  backend.tests.test_paper_trading_security \
  backend.tests.test_paper_trade_transactions \
  backend.tests.test_portfolio_optimization_route \
  backend.tests.test_portfolio_optimization_service \
  backend.tests.test_prediction_market_analysis \
  backend.tests.test_prediction_market_analysis_api \
  backend.tests.test_prediction_service \
  backend.tests.test_prediction_stack_routes \
  backend.tests.test_public_api_admin \
  backend.tests.test_public_api_beta \
  backend.tests.test_public_api_v2 \
  backend.tests.test_research_document_builder \
  backend.tests.test_research_retrieval_service \
  backend.tests.test_route_registration_smoke \
  backend.tests.test_screener_routes \
  backend.tests.test_screener_snapshot_service \
  backend.tests.test_sec_filings_handler \
  backend.tests.test_sec_filings_service \
  backend.tests.test_security \
  backend.tests.test_sentiment_service \
  backend.tests.test_user_journey_harness \
  backend.tests.test_user_journey_state \
  backend.tests.test_user_state_persistence_modes

"$PYTHON_BIN" -m coverage report --skip-covered --fail-under=60
