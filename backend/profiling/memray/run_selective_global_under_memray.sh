#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPO_ROOT="$(cd "${BACKEND_DIR}/.." && pwd)"
OUTPUT_DIR="${BACKEND_DIR}/profiling/memray/output"
PYTHON_BIN="${BACKEND_DIR}/.venv/bin/python"

mkdir -p "${OUTPUT_DIR}"

if [ ! -x "${PYTHON_BIN}" ]; then
  echo "Missing backend virtualenv at ${PYTHON_BIN}" >&2
  exit 1
fi

if ! "${PYTHON_BIN}" -c "import memray" >/dev/null 2>&1; then
  echo "Memray is not installed in backend/.venv." >&2
  echo "Install it with: backend/.venv/bin/pip install -r backend/requirements-dev.txt" >&2
  exit 1
fi

has_arg() {
  local needle="$1"
  shift
  for arg in "$@"; do
    if [ "${arg}" = "${needle}" ]; then
      return 0
    fi
  done
  return 1
}

MEMRAY_ARGS=()
MODULE_ARGS=()
IN_MODULE_ARGS=0

for arg in "$@"; do
  if [ "${arg}" = "--" ]; then
    IN_MODULE_ARGS=1
    continue
  fi
  if [ "${IN_MODULE_ARGS}" -eq 1 ]; then
    MODULE_ARGS+=("${arg}")
  else
    MEMRAY_ARGS+=("${arg}")
  fi
done

if [ "${#MODULE_ARGS[@]}" -eq 0 ]; then
  MODULE_ARGS=("${@}")
fi

if [ "${#MODULE_ARGS[@]}" -eq 0 ]; then
  echo "Usage: $0 [memray run args] -- <selective_prediction_global args>" >&2
  echo "Example: $0 -- benchmark-label-strategies --tickers AAPL,MSFT --correct-signal-global-root ... --correctness-global-root ..." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
SUBCOMMAND="$(printf '%s' "${MODULE_ARGS[0]}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '_')"
DEFAULT_OUTPUT="${OUTPUT_DIR}/selective_${SUBCOMMAND}_${STAMP}.bin"

if [ "${#MEMRAY_ARGS[@]}" -eq 0 ]; then
  MEMRAY_ARGS=(--native)
elif ! has_arg "--native" "${MEMRAY_ARGS[@]}"; then
  MEMRAY_ARGS=(--native "${MEMRAY_ARGS[@]}")
fi

if ! has_arg "-o" "${MEMRAY_ARGS[@]}" && \
   ! has_arg "--output" "${MEMRAY_ARGS[@]}" && \
   ! has_arg "--live" "${MEMRAY_ARGS[@]}" && \
   ! has_arg "--live-remote" "${MEMRAY_ARGS[@]}"; then
  MEMRAY_ARGS=(-o "${DEFAULT_OUTPUT}" "${MEMRAY_ARGS[@]}")
fi

cd "${REPO_ROOT}"
echo "Profiling backend.selective_prediction_global ${MODULE_ARGS[0]} with Memray..."
"${PYTHON_BIN}" -m memray run "${MEMRAY_ARGS[@]}" -m backend.selective_prediction_global "${MODULE_ARGS[@]}"
