# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MarketMind is a market-intelligence and paper-trading platform: a React frontend (Create React App) backed by a single Flask service. The backend is the sole integration layer for third-party data providers (yfinance, Alpha Vantage, Finnhub, optional OpenBB) — the frontend never calls providers directly, only the Flask API.

## Commands

### Backend (Python 3.10, run from repo root)
```bash
pip install -r backend/requirements.txt        # runtime deps (heavy: xgboost, lightgbm, catboost, torch, openbb)
cd backend && python api.py                     # dev server on http://localhost:5001 (debug, no reloader)
gunicorn api:app                                # production entrypoint (see backend/Procfile), run from backend/

# CI-equivalent deterministic checks (py_compile + a curated unittest subset):
bash backend/run_deterministic_backend_checks.sh

# Run a single backend test (tests are a package under backend/tests, run from repo root):
python -m unittest backend.tests.test_route_registration_smoke
python -m unittest backend.tests.test_auth_isolation.TestClass.test_method
```
Note: `run_deterministic_backend_checks.sh` runs only a hand-picked subset of `backend/tests/` (the auth/journey/persistence-critical ones), not the whole suite. The full suite lives in `backend/tests/`.

### Frontend (Node 20, from `frontend/`)
```bash
npm install
npm start                                       # dev server, proxies to REACT_APP_API_URL (default http://localhost:5001)
npm run build
npm test -- --watchAll=false                    # single run; bare `npm test` is watch mode
CI=true bash frontend/run_frontend_checks.sh     # CI-equivalent: test + build (sets a dummy Clerk key)
```

### Typed API client (`packages/client/`)
```bash
cd packages/client && npm run build             # regenerates TS types from backend/public_api_openapi_v2.yaml, then bundles
npm test                                         # builds then runs node --test
```

## Configuration

All config is environment-driven; see `.env.example` for the full list. The backend loads `.env` from repo root then `backend/.env` (override). Frontend reads `REACT_APP_*` vars at build time.

Key vars: `REACT_APP_API_URL` and `REACT_APP_CLERK_PUBLISHABLE_KEY` (frontend); `PERSISTENCE_MODE`, `CORS_ORIGINS`, `FLASK_SECRET_KEY`, provider API keys (`ALPHA_VANTAGE_API_KEY`, `FINNHUB_API_KEY`, `NEWS_API_KEY`), and rate-limit / public-API vars (backend).

## Architecture

### Backend request path
`backend/api.py` is the composition root — a large module that registers routes and wires together auth, rate limiting, CORS, security headers, the background scheduler, and domain modules. It is intentionally the hub; feature logic lives in separate modules it imports.

- **Route handlers** are grouped in `api_handlers_*.py` (market_data, marketmind_ai, notifications, paper, prediction_markets, public, reference_data). `api.py` registers them.
- **Domain services** are standalone modules: `data_fetcher.py` (market data prep), `models.py` + `ensemble_model.py` + `model.py` (forecasting stack — linear/RF/XGB/GBM/LightGBM/CatBoost/LSTM/transformer), `professional_evaluation.py` (rolling-window backtests), `*_fetcher.py` (forex/crypto/commodities/news/prediction_markets), `portfolio_optimization_service.py`, `sec_filings_service.py`, `screener_query_service.py`, `research_*` (RAG: document builder, embeddings, vector store, retrieval).
- **Public API** (`api_public.py`, `public_api_admin.py`) is a separate versioned surface documented by `backend/public_api_openapi_v{1,2}.yaml`; it requires `PERSISTENCE_MODE=postgres`.

### Auth
Clerk on the frontend, verified on the backend. Frontend requests go through a fetch interceptor (`frontend/src/config/authFetch.js` + `frontend/src/components/AuthFetchBridge.js`) that normalizes URLs, attaches the Clerk bearer token, and retries once on `401` with a refreshed token. Backend `api_auth.py` validates the Clerk JWT against JWKS and attaches the user ID to the Flask request context (`g`); user-scoped routes (watchlist, paper trading, notifications, prediction-market portfolios) gate on it. Auth-isolation is safety-critical and covered by `test_auth_isolation.py` — keep it green.

### Persistence — mixed, mode-controlled
`PERSISTENCE_MODE` (`json` | `dual` | `postgres`, default `json`) governs where authenticated user state goes, via helpers in `api_state.py`:
- `json` — user state as JSON files under `backend/user_data/` (portfolios, watchlists, notifications, PM positions). Easiest for local dev.
- `postgres` — SQLAlchemy models in `models.py`/`database.py`, Alembic migrations in `backend/alembic/`. Required for the public API.
- `dual` — writes Postgres and mirrors to JSON.

SQLite (`marketmind.db`, `instance/`) is used separately for local history/snapshot data. `backend/migrate.py` initializes the SQLAlchemy DB and seed data; `backfill_postgres.py` migrates JSON → Postgres.

> Note: Stripe billing and the Free/Pro tier system were removed. There is no payment, checkout, or per-plan rate limiting; all authenticated users have full access. A refactor of access control is planned.

### Frontend structure
`frontend/src/App.js` is a page switchboard over ~45 page-level components in `frontend/src/components/`. `frontend/src/config/api.js` centralizes all endpoint URL construction (`buildApiUrl`, market-suffix helpers) so the UI has a single API boundary — add new endpoints there rather than hardcoding URLs in components.

## Conventions

- New backend endpoints: add the handler to the relevant `api_handlers_*.py`, register in `api.py`, and add a test under `backend/tests/`. If it touches user state, respect `PERSISTENCE_MODE` via the `api_state.py` helpers rather than reading/writing files directly.
- New frontend API calls: route them through `frontend/src/config/api.js` and use `authFetch` so tokens/retry are handled.
- When changing the public API schema, regenerate the typed client (`packages/client` `npm run build`) so `openapi.ts` stays in sync with `public_api_openapi_v2.yaml`.
- CI gates: backend changes run `run_deterministic_backend_checks.sh`; frontend changes run test+build. Match these locally before pushing.
