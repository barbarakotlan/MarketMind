#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
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

STAMP="$(date +%Y%m%d_%H%M%S)"
DEFAULT_OUTPUT="${OUTPUT_DIR}/api_${STAMP}.bin"
MEMRAY_ARGS=("$@")

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

export DYLD_LIBRARY_PATH="/opt/homebrew/opt/libomp/lib:${DYLD_LIBRARY_PATH:-}"

cd "${BACKEND_DIR}"
echo "Profiling backend/api.py with Memray..."
if has_arg "-o" "${MEMRAY_ARGS[@]}" || has_arg "--output" "${MEMRAY_ARGS[@]}"; then
  echo "Capture will be written under ${OUTPUT_DIR} unless you overrode the output path."
fi
"${PYTHON_BIN}" -m memray run "${MEMRAY_ARGS[@]}" api.py
