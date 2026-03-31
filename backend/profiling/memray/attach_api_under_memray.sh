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

find_backend_pid() {
  ps -ax -o pid=,command= | awk 'BEGIN { IGNORECASE = 1 } /python(3)?/ && /api\.py/ {print $1; exit}'
}

TARGET_PID="${1:-}"
if [ -n "${TARGET_PID}" ] && [[ "${TARGET_PID}" != -* ]]; then
  shift
else
  TARGET_PID="$(find_backend_pid)"
fi

if [ -z "${TARGET_PID}" ]; then
  echo "Could not find a running backend api.py process to attach to." >&2
  echo "Pass an explicit PID: $0 <pid> [memray attach args]" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
DEFAULT_OUTPUT="${OUTPUT_DIR}/api_attach_${TARGET_PID}_${STAMP}.bin"
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

echo "Attaching Memray to backend PID ${TARGET_PID}..."
echo "On macOS this may prompt for debugger permissions."
"${PYTHON_BIN}" -m memray attach "${MEMRAY_ARGS[@]}" "${TARGET_PID}"
