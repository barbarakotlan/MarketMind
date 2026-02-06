# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarketMind is a stock market intelligence platform with AI-powered price predictions, paper trading, and multi-asset analysis. It uses a Flask backend with ML models (Random Forest, XGBoost, Linear Regression) and a React frontend.

## Build & Run Commands

### Backend (Flask API)
```bash
cd backend
source venv/bin/activate        # Activate virtual environment
python api.py                   # Run on localhost:5001

# Alternative with XGBoost support on Mac ARM64:
./start_backend.sh
```

### Frontend (React)
```bash
cd frontend
npm install                     # Install dependencies
npm start                       # Run on localhost:3000
npm test                        # Run tests
npm run build                   # Production build
```

### Database Operations
```bash
cd backend
python migrate.py init          # Initialize database
python migrate.py seed          # Seed sample data
python migrate.py reset         # Clear all data
python migrate.py backup        # Create backup
python migrate.py restore <file> # Restore from backup
python migrate.py info          # View database info
```

### Running Tests
```bash
# Backend security tests
cd backend && python -m pytest tests/test_security.py

# Autocomplete endpoint test
python test_autocomplete.py

# Frontend tests
cd frontend && npm test
```

## Architecture

### Backend Structure (`backend/`)
- **api.py** - Main Flask app with all REST endpoints, rate limiting, and request validation
- **database.py** - SQLAlchemy ORM models (User, Watchlist, Portfolio, Position, Trade, Alert)
- **ensemble_model.py** - ML predictions using Random Forest, XGBoost, and ensemble methods
- **professional_evaluation.py** - Rolling window backtesting with 40+ performance metrics
- **model.py** - Linear regression baseline predictor
- **data_fetcher.py** - Stock data pipeline (yfinance + Alpha Vantage)
- **forex_fetcher.py**, **crypto_fetcher.py**, **commodities_fetcher.py** - Market data fetchers
- **security.py** - Rate limiting and input validation utilities
- **migrate.py** - Database migrations and seeding

### Frontend Structure (`frontend/src/`)
- **App.js** - Main component with page routing via `activePage` state
- **components/** - Page components (SearchPage, PaperTradingPage, PredictionsPage, etc.)
- **components/charts/** - Chart components using Chart.js
- **context/DarkModeContext.js** - Dark mode state management via React Context

### Key Patterns
- Backend uses Flask-Limiter for rate limiting with LIGHT/STANDARD/HEAVY/WRITE tiers
- Frontend pages are switched via `activePage` state in App.js (no router)
- Dark mode is managed through DarkModeContext provider
- Paper trading data persists to `paper_portfolio.json` and SQLite database
- ML models use 42 engineered features (lagged prices, moving averages, volatility, momentum)

## Environment Variables

Required in `.env` at project root:
```
ALPHA_VANTAGE_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
```

## API Endpoints Reference

Key endpoints (backend runs on port 5001):
- `GET /stock/<ticker>` - Stock info and price
- `GET /predict/ensemble/<ticker>` - 7-day ensemble ML prediction
- `GET /evaluate/<ticker>?test_days=60` - Professional backtesting
- `POST /paper/buy` - Paper trade buy (body: `{ticker, shares}`)
- `POST /paper/sell` - Paper trade sell
- `GET /paper/portfolio` - Portfolio summary
- `GET /forex/convert?from=USD&to=EUR` - Currency exchange
- `GET /crypto/convert?from=BTC&to=USD` - Crypto conversion
