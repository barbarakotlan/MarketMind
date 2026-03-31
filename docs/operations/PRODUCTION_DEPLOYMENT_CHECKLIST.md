# MarketMind Production Deployment Checklist

This is the first real hosted deployment plan for MarketMind.

## Recommended launch order

1. Deploy the backend first.
2. Verify the backend at `/healthz`.
3. Configure Clerk/backend secrets.
4. Deploy the frontend against the live backend URL.
5. Verify the signed-in app flow.
6. Enable the public API only after Redis-backed rate limiting is provisioned.

## Backend host

Recommended: Render web service

- Root directory: `backend/`
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn -w 4 -b 0.0.0.0:$PORT api:app`
- Health check path: `/healthz`

## Backend required env vars

- `FLASK_ENV=production`
- `CORS_ORIGINS=<your frontend origin>`
- `PERSISTENCE_MODE=postgres`
- `DATABASE_URL=<postgres connection string>`
- `CLERK_SECRET_KEY=<live secret>`
- `CLERK_JWKS_URL=<clerk jwks url>`
- `CLERK_AUDIENCE=<optional audience if used>`
- `NEWS_API_KEY=<provider key>`
- `ALPHA_VANTAGE_API_KEY=<provider key>`
- `FINNHUB_API_KEY=<provider key>`
- `OPENROUTER_API_KEY=<provider key>`

## Backend optional env vars for first public API launch

Leave these disabled unless Redis-backed limiter/cache infrastructure is ready:

- `PUBLIC_API_ENABLED=false`
- `PUBLIC_API_DOCS_ENABLED=false`

When ready to launch the public API:

- `PUBLIC_API_ENABLED=true`
- `PUBLIC_API_DOCS_ENABLED=true`
- `PUBLIC_API_KEY_HASH_PEPPER=<64-hex secret>`
- `PUBLIC_API_RATE_LIMIT_STORAGE_URL=<redis url>`
- `PUBLIC_API_CACHE_URL=<redis url>`
- `PUBLIC_API_DEFAULT_PER_MINUTE_LIMIT=30/minute`
- `PUBLIC_API_DEFAULT_PER_HOUR_LIMIT=500/hour`
- `PUBLIC_API_DEFAULT_DAILY_QUOTA=2500`

## Database migration

Run after the backend service has the correct `DATABASE_URL`:

```bash
cd backend
DATABASE_URL="<database-url>" .venv/bin/python -m alembic upgrade head
```

## Frontend host

Recommended: Vercel

- Root directory: `frontend/`
- Build command: `npm run build`
- Output directory: `build`

## Frontend required env vars

- `REACT_APP_API_URL=<your backend origin>`
- `REACT_APP_CLERK_PUBLISHABLE_KEY=<live publishable key>`

## First production smoke checks

Backend:

- `GET /healthz`
- `GET /news`
- `GET /search-symbols?q=AAPL`
- authenticated `GET /auth/me`

Frontend:

- landing page loads
- sign-in works
- Dashboard loads
- Search loads AAPL
- predictions render
- paper portfolio page renders

Public API, only after enabled:

- `GET /api/public/v1/health`
- `GET /api/public/v1/stock/AAPL`
- `GET /api/public/v2/health`
- `GET /api/public/v2/options/chain/AAPL?date=2026-04-17`
