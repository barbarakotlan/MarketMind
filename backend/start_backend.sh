#!/bin/bash

# Startup script for MarketMind backend with XGBoost support
# Sets the library path for libomp (required for XGBoost on Mac ARM64)

export DYLD_LIBRARY_PATH="/opt/homebrew/opt/libomp/lib:$DYLD_LIBRARY_PATH"

echo "Starting MarketMind Backend with Ensemble ML Models..."
echo "Ensemble includes: Linear Regression, Random Forest, XGBoost"
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start the Flask API
python3 api.py
