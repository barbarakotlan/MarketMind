#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

export CI="${CI:-true}"
export REACT_APP_CLERK_PUBLISHABLE_KEY="${REACT_APP_CLERK_PUBLISHABLE_KEY:-pk_test_dummy}"

npm test -- --watchAll=false
npm run build
