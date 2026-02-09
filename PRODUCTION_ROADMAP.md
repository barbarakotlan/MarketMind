# MarketMind — Production Roadmap

## 1. Authentication (Clerk)

**Current state**: No auth — API is open to anyone.

**Plan**: Use [Clerk](https://clerk.com) for authentication (OAuth with Google/GitHub, email/password, etc.).

### Frontend
- Install `@clerk/clerk-react`
- Wrap `<App />` in `<ClerkProvider publishableKey={...}>`
- Add `<SignInButton />` / `<UserButton />` to the Header
- Protect pages with `<SignedIn>` / `<SignedOut>` components
- Pass the session JWT in every API call via `useAuth().getToken()`

### Backend
- Install `clerk-backend-api` or validate JWTs manually with `PyJWT` + Clerk's JWKS endpoint
- Add a `@require_auth` decorator that:
  1. Reads `Authorization: Bearer <token>` from the request header
  2. Verifies the JWT signature against Clerk's public keys
  3. Extracts `user_id` from the token claims
  4. Passes `user_id` to the route handler
- All portfolio/watchlist/notification data becomes user-scoped

### Clerk Dashboard Config
- Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
- Enable OAuth providers (Google, GitHub)
- Copy `CLERK_PUBLISHABLE_KEY` (frontend) and `CLERK_SECRET_KEY` (backend)
- Add allowed redirect URLs for production domain

---

## 2. Database (SQLite/JSON -> PostgreSQL)

**Current state**: SQLite file + JSON files (`paper_portfolio.json`, `prediction_portfolio.json`, `notifications.json`). Single-user, no concurrency, data lost on redeploy.

**Plan**: Migrate to PostgreSQL with user-scoped tables.

### Schema

```sql
-- Users (synced from Clerk via webhook or on first request)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Stock paper trading
CREATE TABLE stock_portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    cash REAL DEFAULT 100000.0,
    starting_cash REAL DEFAULT 100000.0
);

CREATE TABLE stock_positions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES stock_portfolios(id),
    ticker TEXT NOT NULL,
    shares REAL NOT NULL,
    avg_cost REAL NOT NULL
);

CREATE TABLE stock_trades (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES stock_portfolios(id),
    type TEXT NOT NULL, -- BUY, SELL, BUY_OPTION, SELL_OPTION
    ticker TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    total REAL NOT NULL,
    profit REAL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Prediction markets paper trading
CREATE TABLE prediction_portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    cash REAL DEFAULT 10000.0,
    starting_cash REAL DEFAULT 10000.0
);

CREATE TABLE prediction_positions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES prediction_portfolios(id),
    market_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    exchange TEXT DEFAULT 'polymarket',
    question TEXT,
    contracts REAL NOT NULL,
    avg_cost REAL NOT NULL
);

CREATE TABLE prediction_trades (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES prediction_portfolios(id),
    type TEXT NOT NULL,
    market_id TEXT NOT NULL,
    question TEXT,
    outcome TEXT NOT NULL,
    contracts REAL NOT NULL,
    price REAL NOT NULL,
    total REAL NOT NULL,
    profit REAL,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE prediction_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    market_id TEXT NOT NULL,
    question TEXT,
    exchange TEXT DEFAULT 'polymarket',
    added_at TIMESTAMP DEFAULT NOW()
);

-- Portfolio history (for growth charts)
CREATE TABLE portfolio_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    portfolio_type TEXT NOT NULL, -- 'stock' or 'prediction'
    portfolio_value REAL NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Notifications / price alerts
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    ticker TEXT NOT NULL,
    condition TEXT NOT NULL, -- 'above' or 'below'
    target_price REAL NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP,
    message TEXT,
    seen BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Stock watchlist
CREATE TABLE stock_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    ticker TEXT NOT NULL,
    added_at TIMESTAMP DEFAULT NOW()
);
```

### Hosting Options (free tier)
- **Supabase** — Free Postgres, 500MB, built-in auth (but we're using Clerk)
- **Neon** — Free Postgres, serverless, 512MB
- **Railway** — Free Postgres, 1GB

### ORM
- Use **SQLAlchemy** (already installed) with `flask-sqlalchemy`
- Connection string via `DATABASE_URL` env var

---

## 3. Deployment

### Architecture

```
[Vercel]  ──HTTPS──>  [Render/Railway]  ──>  [Postgres]
 Frontend               Backend (Gunicorn)     Database
 (React build)          (Flask API)
```

### Frontend -> Vercel (free)
- Connect GitHub repo, set root directory to `frontend/`
- Build command: `npm run build`
- Output directory: `build`
- Environment variables:
  - `REACT_APP_API_URL` = `https://marketmind-api.onrender.com`
  - `REACT_APP_CLERK_PUBLISHABLE_KEY` = `pk_live_...`

### Backend -> Render (free) or Railway
- Connect GitHub repo, set root directory to `backend/`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn -w 4 -b 0.0.0.0:$PORT api:app`
- Environment variables:
  - `DATABASE_URL` = postgres connection string
  - `CLERK_SECRET_KEY` = `sk_live_...`
  - `NEWS_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FINNHUB_API_KEY`
  - `FLASK_ENV` = `production`

### Required Backend Changes for Deployment
- Replace `app.run(debug=True)` with Gunicorn
- Add `Procfile`: `web: gunicorn -w 4 api:app`
- Add `runtime.txt`: `python-3.10.5`

---

## 4. API Hardening

### CORS
```python
# Lock down from allow-all to specific origin
CORS(app, origins=[
    "https://marketmind.vercel.app",
    "http://localhost:3000"  # keep for local dev
])
```

### Rate Limiting (Redis-backed)
```python
# Move from in-memory to Redis for persistence across workers
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("REDIS_URL", "memory://"),
    app=app
)
```

### HTTPS
- Handled automatically by Vercel (frontend) and Render (backend)
- No code changes needed

### Input Sanitization
- Add ticker regex validation: `^[A-Z]{1,5}$`
- Sanitize all user inputs before DB queries (SQLAlchemy handles this via parameterized queries)

---

## 5. Frontend Production Changes

### API URL
Replace every hardcoded `http://127.0.0.1:5001` with:
```js
const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5001';
```

Files to update:
- `PredictionMarketsPage.js`
- `PredictionPortfolioChart.js`
- `PaperTradingPage.js` (and its chart)
- `SearchPage.js`
- `Header.js` (notification polling)
- All other components that call the API

### Error Boundaries
```jsx
// Wrap each page in an error boundary so one crash doesn't white-screen the app
<ErrorBoundary fallback={<p>Something went wrong.</p>}>
    <SearchPage />
</ErrorBoundary>
```

### Build Optimization
- `npm run build` produces optimized static files
- Vercel serves them with CDN + gzip + cache headers automatically

---

## 6. Priority Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Replace hardcoded API URLs with env var | 30 min | Enables deployment |
| 2 | Add Clerk auth (frontend sign-in + backend JWT verification) | 2-3 hrs | Multi-user support |
| 3 | Migrate to PostgreSQL (schema + SQLAlchemy models) | 3-4 hrs | Persistent, user-scoped data |
| 4 | Deploy frontend to Vercel | 30 min | Live site |
| 5 | Deploy backend to Render + connect Postgres | 1 hr | Live API |
| 6 | Lock down CORS + add Gunicorn | 30 min | Security |
| 7 | Redis-backed rate limiting | 1 hr | Scalability |
| 8 | Error boundaries + loading states audit | 1 hr | Reliability |

---

## 7. Environment Variables Summary

### Frontend (.env)
```
REACT_APP_API_URL=https://marketmind-api.onrender.com
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@host:5432/marketmind
CLERK_SECRET_KEY=sk_live_xxxxx
NEWS_API_KEY=xxxxx
ALPHA_VANTAGE_API_KEY=xxxxx
FINNHUB_API_KEY=xxxxx
FLASK_ENV=production
REDIS_URL=redis://...  # optional, for rate limiting
```
