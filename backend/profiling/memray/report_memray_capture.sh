#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PYTHON_BIN="${BACKEND_DIR}/.venv/bin/python"

if [ ! -x "${PYTHON_BIN}" ]; then
  echo "Missing backend virtualenv at ${PYTHON_BIN}" >&2
  exit 1
fi

if ! "${PYTHON_BIN}" -c "import memray" >/dev/null 2>&1; then
  echo "Memray is not installed in backend/.venv." >&2
  echo "Install it with: backend/.venv/bin/pip install -r backend/requirements-dev.txt" >&2
  exit 1
fi

if [ "${#}" -lt 1 ]; then
  echo "Usage: $0 <capture.bin>" >&2
  exit 1
fi

CAPTURE_PATH="$1"
if [ ! -f "${CAPTURE_PATH}" ]; then
  echo "Capture file not found: ${CAPTURE_PATH}" >&2
  exit 1
fi

CAPTURE_DIR="$(cd "$(dirname "${CAPTURE_PATH}")" && pwd)"
CAPTURE_FILE="$(basename "${CAPTURE_PATH}")"
CAPTURE_STEM="${CAPTURE_FILE%.*}"

SUMMARY_PATH="${CAPTURE_DIR}/${CAPTURE_STEM}_summary.txt"
STATS_PATH="${CAPTURE_DIR}/${CAPTURE_STEM}_stats.txt"
FLAMEGRAPH_PATH="${CAPTURE_DIR}/${CAPTURE_STEM}_flamegraph.html"

"${PYTHON_BIN}" -m memray summary "${CAPTURE_PATH}" > "${SUMMARY_PATH}"
"${PYTHON_BIN}" -m memray stats "${CAPTURE_PATH}" > "${STATS_PATH}"
"${PYTHON_BIN}" -m memray flamegraph --no-web -f -o "${FLAMEGRAPH_PATH}" "${CAPTURE_PATH}"

echo "Wrote:"
echo "  ${SUMMARY_PATH}"
echo "  ${STATS_PATH}"
echo "  ${FLAMEGRAPH_PATH}"
