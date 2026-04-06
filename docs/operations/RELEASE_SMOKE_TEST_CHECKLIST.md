# Release Smoke Test Checklist

This checklist is one of MarketMind's release gates. See [QUALITY_GATES.md](QUALITY_GATES.md) for the full merge-versus-release policy.

## 1. Environment + Startup
- [ ] Backend starts with `cd backend && ./start_backend.sh` and serves `http://localhost:5001`.
- [ ] Frontend starts with `cd frontend && npm start` and serves `http://localhost:3000`.
- [ ] `.env` and `frontend/.env` are present locally (not committed), with valid Clerk/API keys.
- [ ] In production, `FLASK_ENV=production` and `CORS_ORIGINS` are explicitly set.

## 2. Auth Flow (Clerk)
- [ ] Signed-out users are shown auth page and cannot access in-app data views.
- [ ] Sign up creates a Clerk user and transitions to signed-in app state.
- [ ] Sign in returns the user to app state and API calls succeed with Bearer token.
- [ ] Sign out clears session and returns to signed-out state.

## 3. Protected API Route Checks
- [ ] `GET /auth/me` returns `401` without token and `200` with token.
- [ ] `GET /watchlist`, `GET /paper/portfolio`, `GET /notifications`, and prediction portfolio routes return `401` without token.
- [ ] Authenticated requests to protected endpoints succeed with valid token.

## 4. Per-User Data Isolation
- [ ] User A adds watchlist symbol; User B does not see it.
- [ ] User A executes paper/options trade; User B history remains unchanged.
- [ ] User A notifications/triggered alerts are not visible to User B.
- [ ] New authenticated users do not inherit legacy shared JSON state unless `ALLOW_LEGACY_USER_DATA_SEED=true`.

## 5. Core Data/API Smoke
- [ ] Search and quote endpoints return data for a valid ticker (e.g., `AAPL`).
- [ ] Chart endpoint returns non-empty series for the same ticker.
- [ ] Portfolio + prediction market pages load without hardcoded localhost dependency regressions.
- [ ] Sidebar theme toggle and scroll behavior look correct in both light and dark mode.

## 6. Security/CORS Basics
- [ ] Response headers include `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`.
- [ ] Production responses include `Strict-Transport-Security`.
- [ ] CORS only allows configured origins from `CORS_ORIGINS` (no wildcard in production).
- [ ] No real secrets are present in tracked files; `.gitignore` still excludes `.env*`.

## 7. Build + Tests
- [ ] Frontend build passes: `cd frontend && npm run build`.
- [ ] Security/unit tests pass: `cd backend && python -m unittest tests/test_security.py`.
- [ ] Auth/isolation tests pass: `cd backend && python -m unittest tests/test_auth_isolation.py`.
