#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
export DATABASE_URL="${DATABASE_URL:-}"
export PERSISTENCE_MODE="${PERSISTENCE_MODE:-json}"
export PYTHONPYCACHEPREFIX="${PYTHONPYCACHEPREFIX:-/tmp/marketmind_pycache}"

"$PYTHON_BIN" -m py_compile \
  backend/api.py \
  backend/user_journey_state.py \
  backend/user_journey_harness.py \
  backend/tests/test_chart_prediction_append.py \
  backend/tests/test_user_journey_state.py \
  backend/tests/test_user_journey_harness.py

"$PYTHON_BIN" -m unittest \
  backend.tests.test_auth_isolation \
  backend.tests.test_chart_prediction_append \
  backend.tests.test_user_journey_state \
  backend.tests.test_user_journey_harness \
  backend.tests.test_user_state_persistence_modes \
  backend.tests.test_backfill_postgres
