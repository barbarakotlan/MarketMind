#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_DIR="${BACKEND_DIR}/profiling/memray/output"
PYTHON_BIN="${BACKEND_DIR}/.venv/bin/python"
REPORT_SCRIPT="${SCRIPT_DIR}/report_memray_capture.sh"
API_BASE_URL="${MARKETMIND_API_BASE_URL:-http://127.0.0.1:5001}"
REQUEST_TIMEOUT_SECONDS="${MARKETMIND_PROFILE_STARTUP_TIMEOUT:-30}"

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

if [ ! -x "${REPORT_SCRIPT}" ]; then
  echo "Expected report helper at ${REPORT_SCRIPT}" >&2
  exit 1
fi

REQUESTS=("$@")
if [ "${#REQUESTS[@]}" -eq 0 ]; then
  REQUESTS=("/healthz")
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
CAPTURE_PATH="${OUTPUT_DIR}/api_flow_${STAMP}.bin"
BACKEND_LOG_PATH="${OUTPUT_DIR}/api_flow_${STAMP}.log"
ATTACH_LOG_PATH="${OUTPUT_DIR}/api_flow_${STAMP}_attach.log"
BACKEND_PID=""
ATTACH_PID=""
STARTED_BACKEND=0

cleanup() {
  if [ -n "${ATTACH_PID}" ] && ps -p "${ATTACH_PID}" >/dev/null 2>&1; then
    kill -INT "${ATTACH_PID}" >/dev/null 2>&1 || true
    wait "${ATTACH_PID}" >/dev/null 2>&1 || true
  fi
  if [ "${STARTED_BACKEND}" -eq 1 ] && [ -n "${BACKEND_PID}" ] && ps -p "${BACKEND_PID}" >/dev/null 2>&1; then
    kill -INT "${BACKEND_PID}" >/dev/null 2>&1 || true
    wait "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}

wait_for_backend() {
  local attempts=0
  while [ "${attempts}" -lt "${REQUEST_TIMEOUT_SECONDS}" ]; do
    if curl -fsS "${API_BASE_URL}/healthz" >/dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

find_backend_pid() {
  ps -ax -o pid=,command= | awk '/python(3)? .*api\.py/ {print $1; exit}'
}

trap cleanup EXIT INT TERM

export DYLD_LIBRARY_PATH="/opt/homebrew/opt/libomp/lib:${DYLD_LIBRARY_PATH:-}"

cd "${BACKEND_DIR}"

BACKEND_PID="$(find_backend_pid)"
if [ -z "${BACKEND_PID}" ]; then
  echo "No running backend detected. Starting backend/api.py normally..."
  "${PYTHON_BIN}" api.py >"${BACKEND_LOG_PATH}" 2>&1 &
  BACKEND_PID=$!
  STARTED_BACKEND=1
else
  echo "Attaching to existing backend PID ${BACKEND_PID}."
fi

if ! wait_for_backend; then
  echo "Backend did not become healthy within ${REQUEST_TIMEOUT_SECONDS}s." >&2
  echo "Inspect log: ${BACKEND_LOG_PATH}" >&2
  exit 1
fi

echo "Starting Memray attach for backend PID ${BACKEND_PID}..."
echo "On macOS this may prompt for debugger permissions."
"${PYTHON_BIN}" -m memray attach --native -o "${CAPTURE_PATH}" "${BACKEND_PID}" >"${ATTACH_LOG_PATH}" 2>&1 &
ATTACH_PID=$!
sleep 2

if ! ps -p "${ATTACH_PID}" >/dev/null 2>&1; then
  echo "Memray attach exited before request profiling started." >&2
  echo "Inspect attach log: ${ATTACH_LOG_PATH}" >&2
  exit 1
fi

for request_target in "${REQUESTS[@]}"; do
  if [[ "${request_target}" == http://* || "${request_target}" == https://* ]]; then
    url="${request_target}"
  else
    url="${API_BASE_URL}${request_target}"
  fi
  echo "Requesting ${url}"
  curl -fsS "${url}" >/dev/null
done

sleep 1
if [ -n "${ATTACH_PID}" ] && ps -p "${ATTACH_PID}" >/dev/null 2>&1; then
  kill -INT "${ATTACH_PID}" >/dev/null 2>&1 || true
  wait "${ATTACH_PID}" || true
fi
ATTACH_PID=""

if [ "${STARTED_BACKEND}" -eq 1 ] && [ -n "${BACKEND_PID}" ] && ps -p "${BACKEND_PID}" >/dev/null 2>&1; then
  kill -INT "${BACKEND_PID}" >/dev/null 2>&1 || true
  wait "${BACKEND_PID}" || true
fi
BACKEND_PID=""
trap - EXIT INT TERM

"${REPORT_SCRIPT}" "${CAPTURE_PATH}"
if [ -f "${BACKEND_LOG_PATH}" ]; then
  echo "Backend log:"
  echo "  ${BACKEND_LOG_PATH}"
fi
echo "Attach log:"
echo "  ${ATTACH_LOG_PATH}"
