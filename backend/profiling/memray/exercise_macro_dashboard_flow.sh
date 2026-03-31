#!/bin/bash

set -euo pipefail

API_BASE_URL="${MARKETMIND_API_BASE_URL:-http://127.0.0.1:5001}"
ITERATIONS="${MARKETMIND_MACRO_FLOW_ITERATIONS:-3}"
SLEEP_SECONDS="${MARKETMIND_MACRO_FLOW_SLEEP_SECONDS:-1}"

if ! [[ "${ITERATIONS}" =~ ^[0-9]+$ ]] || [ "${ITERATIONS}" -lt 1 ]; then
  echo "ITERATIONS must be a positive integer. Received: ${ITERATIONS}" >&2
  exit 1
fi

if ! [[ "${SLEEP_SECONDS}" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "SLEEP_SECONDS must be numeric. Received: ${SLEEP_SECONDS}" >&2
  exit 1
fi

request_path() {
  local path="$1"
  local url="${API_BASE_URL}${path}"
  echo "GET ${url}"
  curl -fsS -o /dev/null -w "  status=%{http_code} time=%{time_total}s bytes=%{size_download}\n" "${url}"
}

echo "Exercising Macro Dashboard flow against ${API_BASE_URL}"
request_path "/healthz"

for iteration in $(seq 1 "${ITERATIONS}"); do
  echo ""
  echo "Iteration ${iteration}/${ITERATIONS}"
  echo "  Initial page load"
  request_path "/macro/overview"
  request_path "/calendar/economic"

  echo "  Simulated manual refresh"
  request_path "/macro/overview"
  request_path "/calendar/economic"

  if [ "${iteration}" -lt "${ITERATIONS}" ]; then
    sleep "${SLEEP_SECONDS}"
  fi
done

echo ""
echo "Macro Dashboard exercise completed."

