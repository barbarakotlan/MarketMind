# MarketMind

MarketMind is a market intelligence and paper-trading platform that combines live market data, ML-assisted analysis, and a web-based research workflow for equities and related asset classes.

## Overview

MarketMind brings together market data, forecasting, evaluation, and portfolio simulation in a single codebase. The application includes a React frontend for interactive workflows and a Flask backend that handles market data retrieval, analytics, model execution, evaluation, and authenticated user state.

## Core Capabilities

- Search equities and review price charts, quote data, and recent market context.
- Generate stock predictions and evaluate model behavior through rolling backtests.
- Review company fundamentals, filings, and screener-style market views.
- Manage paper-trading portfolios, watchlists, and alert workflows.
- Explore macro indicators, forex, cryptocurrency, and commodities data.
- Browse and simulate positions in supported prediction markets.

## Plans And Billing

MarketMind currently exposes two application plans in the pricing and checkout flow:

| Plan | Price | Included limits |
| --- | --- | --- |
| Free | `$0` | Basic stock search, `5` AI predictions per day, watchlist up to `10` tickers, `2` active alerts, `20` paper trades per month, and `0` prediction-market paper trades |
| Pro | `$14.97/month` or annual billing at `20%` off | `100` AI predictions per day, unlimited watchlist size, up to `50` active alerts, unlimited paper trading, unlimited prediction-market paper trades, and full premium access |

The source of truth for the pricing UI lives in [`frontend/src/components/PlanPage.js`](./frontend/src/components/PlanPage.js), and the Stripe checkout experience lives in [`frontend/src/components/CheckoutPage.js`](./frontend/src/components/CheckoutPage.js).

### Stripe Integration

- The frontend starts checkout with `POST /checkout/create-subscription`.
- [`backend/checkout_endpoint.py`](./backend/checkout_endpoint.py) resolves the authenticated Clerk user, reuses or creates a Stripe customer, and creates a subscription against the configured monthly or annual Stripe Price ID.
- Stripe Elements confirms payment client-side with the publishable key.
- Stripe webhooks update the persisted app-user plan and subscription status.
- The frontend reads `GET /checkout/plan-status` so components such as [`frontend/src/components/Sidebar.js`](./frontend/src/components/Sidebar.js) can show Free vs Pro state.

### Backend-Enforced Free Limits

The backend now enforces the concrete Free-plan limits that were previously only described in the frontend:

- Watchlist additions are capped at `10` unique tickers.
- Alert creation is capped at `2` active alerts.
- Prediction requests are capped at `5` per day.
- Paper-trading orders are capped at `20` per calendar month.
- Prediction-market paper trades are blocked for Free users.

These checks are centralized in [`backend/subscription_limits.py`](./backend/subscription_limits.py) and applied in [`backend/api.py`](./backend/api.py).

## Architecture

MarketMind is structured as a browser-based frontend backed by a single Flask service. The frontend lives in [`frontend/`](./frontend/) and is organized around page-level React components for dashboard, search, predictions, evaluation, fundamentals, paper trading, news, macro data, and related workflows. [`frontend/src/App.js`](./frontend/src/App.js) acts as the page switchboard, while [`frontend/src/config/api.js`](./frontend/src/config/api.js) centralizes backend endpoint construction so the UI uses a single API boundary.

Authentication is handled with Clerk on the frontend and verified on the backend. The frontend installs a fetch interceptor through [`frontend/src/config/authFetch.js`](./frontend/src/config/authFetch.js) and [`frontend/src/components/AuthFetchBridge.js`](./frontend/src/components/AuthFetchBridge.js). That layer normalizes backend URLs, adds bearer tokens for authenticated requests, and retries once on `401` responses with a refreshed token. On the backend, [`backend/api.py`](./backend/api.py) validates Clerk tokens, attaches the current user ID to the request context, and gates user-specific routes such as watchlists, paper trading, notifications, and prediction-market portfolios.

The backend is centered on [`backend/api.py`](./backend/api.py), which combines route registration, auth enforcement, rate limiting, CORS, and security headers with orchestration of domain modules. Feature-specific logic is delegated to supporting modules such as [`backend/data_fetcher.py`](./backend/data_fetcher.py) for market data preparation, [`backend/ensemble_model.py`](./backend/ensemble_model.py) and [`backend/model.py`](./backend/model.py) for forecasting, [`backend/professional_evaluation.py`](./backend/professional_evaluation.py) for rolling backtests, and [`backend/prediction_markets_fetcher.py`](./backend/prediction_markets_fetcher.py) for prediction-market data.

At runtime, the Flask service sits between the frontend and several external providers. Market and historical pricing data primarily come from yfinance, with Alpha Vantage used for selected data workflows and fallback behavior. News retrieval uses Finnhub, and some fundamentals, filings, screener, and macro functionality can use optional OpenBB integrations where available. This makes the backend the single integration layer for third-party services, rather than having the frontend call providers directly.

Persistence is intentionally mixed. SQLite is used for selected local history and snapshot data, while most authenticated user state is stored as JSON files under `backend/user_data/`, including portfolios, watchlists, notifications, and prediction-market positions. This keeps the application easy to run locally while still supporting per-user state isolation and authenticated workflows.

The high-level request path looks like this:

```text
+--------------------+       HTTPS / fetch       +-------------------------+
| React frontend     | -----------------------> | Flask API               |
| frontend/src/*     |                          | backend/api.py          |
+--------------------+                          +-------------------------+
          |                                                |
          | Clerk auth UI                                  | Route handlers
          v                                                v
+--------------------+                          +-------------------------+
| Clerk session      |                          | Domain modules          |
| token retrieval    |                          | data_fetcher.py         |
+--------------------+                          | ensemble_model.py       |
          |                                     | professional_evaluation |
          | Bearer token via                    | prediction_markets_*    |
          | authFetch interceptor               | prediction_markets_*    |
          v                                     +-------------------------+
+--------------------+                                      |
| Authenticated API  |                                      |
| requests           |                                      v
+--------------------+                          +-------------------------+
                                                  | External providers     |
                                                  | yfinance               |
                                                  | Finnhub               |
                                                  | Alpha Vantage         |
                                                  | OpenBB (optional)     |
                                                  +-------------------------+
                                                              |
                                                              v
                                                  +-------------------------+
                                                  | Local persistence       |
                                                  | SQLite                  |
                                                  | backend/user_data/*.json|
                                                  +-------------------------+
```

In practice, this means the frontend is primarily responsible for navigation, presentation, and authenticated request initiation, while the backend owns business logic, data-provider integration, model execution, portfolio state transitions, and persistence.

## Repository Structure

```text
MarketMind/
|-- backend/
|   |-- api.py
|   |-- data_fetcher.py
|   |-- professional_evaluation.py
|   |-- prediction_markets_fetcher.py
|   |-- requirements.txt
|   `-- tests/
|-- docs/
|   |-- README.md
|   |-- backend/
|   |-- operations/
|   `-- product/
|-- frontend/
|   |-- package.json
|   |-- src/
|   |   |-- App.js
|   |   |-- components/
|   |   |-- config/api.js
|   |   `-- config/authFetch.js
|   `-- public/
|-- .env.example
`-- README.md
```

## Local Development

MarketMind is developed as two local processes: the Flask backend on port `5001` and the React frontend on port `3000`.

1. Copy the example environment files and fill in the required values.

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

2. Set up and start the backend.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 api.py
```

On macOS, XGBoost may require `libomp`:

```bash
brew install libomp
```

You can also start the backend with the helper script:

```bash
cd backend
./start_backend.sh
```

3. Set up and start the frontend.

```bash
cd frontend
npm install
npm start
```

When both processes are running, the frontend is available at `http://localhost:3000` and the backend API is available at `http://localhost:5001`.

## For Developers

If you are new to the repository, the fastest way to get oriented is to follow one feature from the UI to the backend. A good starting point is the search or predictions flow.

- Start with [`frontend/src/App.js`](./frontend/src/App.js) to see how the main pages are wired together.
- Review [`frontend/src/config/api.js`](./frontend/src/config/api.js) to understand how the frontend addresses backend routes.
- Review [`frontend/src/config/authFetch.js`](./frontend/src/config/authFetch.js) and [`frontend/src/components/AuthFetchBridge.js`](./frontend/src/components/AuthFetchBridge.js) to understand how authenticated requests are sent.
- Use [`backend/api.py`](./backend/api.py) as the backend entrypoint for most feature work, since many routes and orchestration paths are defined there.
- For prediction and evaluation logic, read [`backend/professional_evaluation.py`](./backend/professional_evaluation.py), [`backend/ensemble_model.py`](./backend/ensemble_model.py), and [`backend/model.py`](./backend/model.py).

Common development workflow:

1. Run the backend and frontend locally.
2. Pick a single page or endpoint and trace the full request path.
3. When changing a backend-powered feature, update the Flask route or supporting module first, then update the frontend API config, then update the consuming component.
4. When changing authenticated features, verify both Clerk-based auth behavior and user-specific persistence under `backend/user_data/`.

Useful local checks:

- Frontend checks: `bash frontend/run_frontend_checks.sh`
- Backend deterministic checks: `PYTHON_BIN=backend/.venv/bin/python bash backend/run_deterministic_backend_checks.sh`

Beginner-friendly tips:

- The frontend should call the Flask API, not third-party market providers directly.
- Some user-facing features will not work correctly unless Clerk is configured in both the frontend and backend environment files.
- On macOS, XGBoost-related backend issues are often caused by a missing `libomp` installation.
- If you are unsure where logic lives, search [`backend/api.py`](./backend/api.py) first and then follow imports into supporting modules.

## Configuration

The root [`.env.example`](./.env.example) and [`frontend/.env.example`](./frontend/.env.example) files define the expected local configuration. Important values include:

- `ALPHA_VANTAGE_API_KEY` for market and reference data integrations.
- `NEWS_API_KEY` for news-related backend integrations where configured.
- `FINNHUB_API_KEY` for market news retrieval.
- `FLASK_SECRET_KEY` for backend session and security configuration.
- `CORS_ORIGINS` for allowed frontend origins in production-style deployments.
- `CLERK_JWKS_URL` for backend Clerk token verification when needed.
- `CLERK_AUDIENCE` for optional Clerk audience validation.
- `STRIPE_SECRET_KEY` for backend Stripe API access.
- `STRIPE_WEBHOOK_SECRET` for validating incoming Stripe webhooks.
- `STRIPE_PRICE_PRO_MONTHLY` for the Pro monthly Stripe Price ID.
- `STRIPE_PRICE_PRO_ANNUAL` for the Pro annual Stripe Price ID.
- `REACT_APP_API_URL` for the frontend's backend base URL.
- `REACT_APP_CLERK_PUBLISHABLE_KEY` for frontend Clerk initialization.
- `REACT_APP_STRIPE_PUBLISHABLE_KEY` for loading Stripe Elements in checkout.

Keep local secrets out of version control and review provider-specific setup before deploying outside local development.

## Additional Documentation

- [Docs index](./docs/README.md)
- [API documentation](./docs/backend/API_DOCUMENTATION.md)
- [Model data specifications](./docs/backend/DATA_SPECS.md)
- [Quality gates](./docs/operations/QUALITY_GATES.md)
- [Release smoke checklist](./docs/operations/RELEASE_SMOKE_TEST_CHECKLIST.md)
- [Monthly user journey simulation](./docs/operations/MONTHLY_USER_JOURNEY_SIMULATION.md)
- [Production deployment checklist](./docs/operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- [Production roadmap](./docs/product/PRODUCTION_ROADMAP.md)
- [Monetization brainstorm](./docs/product/MONETIZATION_BRAINSTORM.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [License](./LICENSE)

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## Disclaimer

MarketMind is intended for research, education, and product development purposes. Forecasts, market signals, and simulated trading results should not be treated as investment advice or as guarantees of future performance.
