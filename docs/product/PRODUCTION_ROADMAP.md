# MarketMind Production Roadmap

Last reviewed: July 2026

This roadmap describes the code that is in the repository now and the work that
still separates it from a dependable public launch. Historical implementation
plans have been removed so this document can be used as an operational decision
record.

## Current Architecture

### Frontend

- React 19 application built with Vite 8 on Node 24.
- React Router owns URL navigation and direct-link restoration.
- A shared API client centralizes `VITE_API_URL`, authentication, request
  cancellation, timeouts, and normalized errors.
- Clerk provides production identity. `VITE_AUTH_MODE=local` supplies one
  development-only identity without requiring a Clerk account.
- Vitest enforces coverage floors and Playwright exercises critical browser
  journeys in CI.
- Production output is written to `frontend/dist/`.

### Backend

- Flask application served by Gunicorn in production.
- `backend/api.py` is the composition root and route registry. Domain behavior
  is delegated to handler, service, persistence, and provider modules.
- `backend/api_runtime.py` owns request IDs, error envelopes, security headers,
  Redis probes, and readiness aggregation.
- Pydantic request contracts reject malformed, oversized, and unexpected input
  before domain handlers run.
- `/healthz` reports process liveness. `/readyz` checks user-state storage and
  configured Redis dependencies.
- Expensive ML imports are deferred until prediction work is requested.

### Identity And Persistence

- Clerk JWTs are verified against JWKS and mapped to capability-scoped
  principals.
- Local auth is accepted only outside production and still passes through the
  normal authorization checks.
- PostgreSQL, SQLAlchemy, and Alembic are the production persistence path.
- Paper trades use database transactions and optimistic versioning so cash,
  positions, trades, and snapshots change atomically.
- JSON persistence remains available for local development. Writes are locked
  and atomically replaced; production refuses to start in JSON mode.

### Workers And Shared Infrastructure

- Alert evaluation runs in `backend/alert_worker.py`, not inside Gunicorn.
- The worker uses a PostgreSQL advisory lock so only one replica actively polls.
- Redis is required in production for distributed rate limiting. It is also
  required before the public API cache is enabled.
- AI and provider calls have explicit timeouts, bounded inputs, and grounded
  fallback behavior.

### Quality Gates

- Backend CI runs Ruff, a grade-F complexity guard, branch coverage with a 60%
  floor, deterministic integration tests, Postgres migrations, dependency
  auditing, and a production image smoke test.
- Frontend CI runs ESLint, unit/component tests, coverage floors, a Vite
  production build, dependency auditing, and Playwright browser journeys.
- The deterministic month-style harness snapshots and restores user state while
  exercising research, alerts, paper trading, and prediction markets.

## Authentication Decision

Keep Clerk for the hosted multi-user product. It solves account security,
session refresh, OAuth, and account recovery without making MarketMind own an
identity system. The local auth mode removes Clerk from the inner development
loop, so there is no reason to weaken production identity to improve local
ergonomics.

Before launch, configure a production Clerk instance, restrict redirect origins,
set the backend issuer and JWKS values, and test sign-in, sign-out, expiry, and
cross-user isolation in the deployed environment.

## Remaining Priorities

### P0: First Production Environment

1. Provision PostgreSQL and Redis with backups, monitoring, and separate staging
   and production credentials.
2. Deploy the backend image and alert worker from the same immutable revision.
3. Run Alembic migrations as a release step before shifting traffic.
4. Deploy `frontend/dist/` with `VITE_API_URL` and the live Clerk publishable key.
5. Add centralized logs, error reporting, latency metrics, and alerts for
   readiness failures, provider errors, quota exhaustion, and worker stalls.
6. Document and rehearse database restore, application rollback, secret
   rotation, and provider outage procedures.

### P1: Backend Boundaries And Reliability

1. Continue splitting feature route registration out of `backend/api.py`. The
   composition root is still large even though business logic has moved into
   domain modules.
2. Standardize external providers behind typed adapters with retry budgets,
   circuit breakers, cache policy, and provenance metadata.
3. Move long-running forecasts, document generation, and bulk research work to
   a durable job queue with status endpoints and cancellation.
4. Raise backend coverage above the current merge floor, concentrating on
   provider degradation, transaction rollback, authorization, and migrations.
5. Load-test portfolio writes, public API quota reservation, Redis rate limits,
   and the alert worker against production-sized concurrency.

### P1: Product Safety And Trust

1. Display source timestamps, provider status, and stale-data warnings wherever
   users make decisions from market data.
2. Make model confidence, evaluation windows, and prediction limitations
   visible and consistent across research and portfolio workflows.
3. Add an auditable record for generated investment memos, evidence snapshots,
   assumptions, and model versions.
4. Complete accessibility and responsive browser testing across every core
   workflow, not only the critical Playwright journeys.

### P2: Scale And Product Expansion

1. Add portfolio-level risk analytics and scenario testing with explicit data
   lineage.
2. Expand public API observability, customer usage reporting, key rotation, and
   abuse response before broad beta access.
3. Introduce data-retention controls, account export/deletion, and a documented
   privacy policy before collecting production user data.
4. Measure provider cost and cache effectiveness before increasing polling or
   enabling computationally expensive features by default.

## Production Configuration

Frontend variables:

```dotenv
VITE_API_URL=https://api.example.com
VITE_AUTH_MODE=clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

Backend baseline:

```dotenv
FLASK_ENV=production
AUTH_MODE=clerk
CORS_ORIGINS=https://app.example.com
PERSISTENCE_MODE=postgres
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/marketmind
RATE_LIMIT_STORAGE_URL=rediss://host:6379/0
CLERK_JWKS_URL=https://example.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://example.clerk.accounts.dev
FLASK_SECRET_KEY=<random secret>
```

Enable `PUBLIC_API_ENABLED`, `PUBLIC_API_DOCS_ENABLED`, and
`PUBLIC_API_CACHE_URL` only after public API keys, Redis, quotas, logs, and abuse
response are operational.

## Release Criteria

A production release is ready only when:

- required backend and frontend workflows are green for the exact revision;
- migrations have succeeded against staging and a rollback path is known;
- `/healthz` and `/readyz` pass in the target environment;
- Clerk sign-in and user isolation pass the release smoke checklist;
- the web process and alert worker are running separately;
- dashboards and alerts can detect backend, database, Redis, provider, and
  worker failures;
- a recent backup has been restored successfully in a non-production
  environment.

See the [production deployment checklist](../operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md)
and [quality gates](../operations/QUALITY_GATES.md) for executable steps.
