#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

export CI="${CI:-true}"
export REACT_APP_CLERK_PUBLISHABLE_KEY="${REACT_APP_CLERK_PUBLISHABLE_KEY:-pk_test_dummy}"

npm run lint
# Cap jest workers so the heavy jsdom page suites don't contend for CPU on
# many-core machines (a source of spurious async-timeout flakiness). 50% keeps
# CI (few cores) effectively serial while still parallelising locally.
npm test -- --watchAll=false --maxWorkers=50%
npm run build
