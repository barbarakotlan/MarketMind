#!/bin/bash

# Startup script for MarketMind backend with XGBoost support
# Sets the library path for libomp (required for XGBoost on Mac ARM64)

export DYLD_LIBRARY_PATH="/opt/homebrew/opt/libomp/lib:$DYLD_LIBRARY_PATH"

echo "Starting MarketMind Backend with Ensemble ML Models..."
echo "Ensemble includes: Linear Regression, Random Forest, XGBoost"
echo ""

# Activate virtual environment if it exists (.venv preferred)
PYTHON_BIN="${PYTHON_BIN:-}"
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
    PYTHON_BIN="${PYTHON_BIN:-python3}"
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    PYTHON_BIN="${PYTHON_BIN:-python3}"
else
    echo "No virtual environment found at .venv or venv."
    if [ -z "$PYTHON_BIN" ] && command -v python3.10 >/dev/null 2>&1; then
        PYTHON_BIN="python3.10"
    else
        PYTHON_BIN="${PYTHON_BIN:-python3}"
    fi
fi

# This helper is for local development. Production startup rejects local auth.
export AUTH_MODE="${AUTH_MODE:-local}"

# Start the Flask API
"$PYTHON_BIN" api.py
