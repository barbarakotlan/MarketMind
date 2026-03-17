# Quality Gates

This document defines what "safe to merge" and "ready to release" mean for MarketMind.

The goal is to keep CI intentional:

- fast, deterministic checks should run automatically on pull requests
- deeper, provider-dependent checks should run manually before release
- experimental or research workflows should not block normal product delivery

## Merge Gates

These checks should be green before code is merged.

### Required Backend Checks

GitHub workflow:
- [`.github/workflows/backend-deterministic-checks.yml`](.github/workflows/backend-deterministic-checks.yml)

Shared command:

```bash
PYTHON_BIN=backend/.venv/bin/python bash backend/run_deterministic_backend_checks.sh
```

What this gate covers:

- auth and protected-route isolation
- chart prediction append regression
- user state snapshot/restore/verify
- deterministic month-style user journey harness
- persistence mode behavior
- JSON to Postgres backfill behavior

Why it is a merge gate:

- it is deterministic
- it does not require live third-party providers
- it protects the app's core user-state and auth boundaries

### Required Frontend Checks

GitHub workflow:
- [`.github/workflows/frontend-checks.yml`](.github/workflows/frontend-checks.yml)

Shared command:

```bash
PATH=/opt/homebrew/bin:$PATH bash frontend/run_frontend_checks.sh
```

What this gate covers:

- frontend unit/component tests
- production frontend build

Why it is a merge gate:

- it is stable with a dummy Clerk publishable key
- it catches rendering, API-shape, and bundling regressions before merge

## Release Gates

These checks are required before release or production rollout, but they are not intended to block every pull request.

### Manual Release Smoke

Run:
- [RELEASE_SMOKE_TEST_CHECKLIST.md](RELEASE_SMOKE_TEST_CHECKLIST.md)

This covers:

- environment and startup
- Clerk sign-in/sign-out behavior
- protected API route checks
- per-user data isolation
- build and basic security checks

### Month-Style Product Simulation

Run:
- [MONTHLY_USER_JOURNEY_SIMULATION.md](MONTHLY_USER_JOURNEY_SIMULATION.md)

Recommended command:

```bash
cd backend

.venv/bin/python user_journey_harness.py \
  --database-url "$DATABASE_URL" \
  --base-dir "$(pwd)" \
  --persistence-mode "$PERSISTENCE_MODE" \
  --user-id "YOUR_CLERK_USER_ID"
```

This gate is release-only because it:

- touches realistic user workflows
- may depend on live third-party provider behavior
- is more expensive than the deterministic CI gate

### Postgres / Clerk Sanity

Before release, confirm:

- backend is running with the intended `PERSISTENCE_MODE`
- `DATABASE_URL` is valid
- Clerk auth is working end to end
- the target environment has the expected CORS and secret configuration

## Non-Blocking Checks

These checks are valuable, but they should not block ordinary product merges unless a change explicitly targets them.

- selective/global benchmark and training workflows
- experimental evaluation comparisons
- long-running research or promotion-gate checks
- live provider-specific investigations

## Decision Rules

Use these rules when deciding whether a failure should block merge or release:

- Block merge:
  a required backend or frontend gate fails
- Block release:
  a release smoke check fails, the month-style harness finds a product bug, or auth/persistence sanity is broken
- Do not block merge by default:
  experimental research checks or third-party provider noise outside deterministic CI

## Practical Summary

For normal pull requests:

1. Required Backend Checks must pass.
2. Required Frontend Checks must pass.

For release:

1. Required Backend Checks must pass.
2. Required Frontend Checks must pass.
3. Release Smoke Test Checklist must be completed.
4. Month-Style User Journey Simulation must pass or any findings must be understood and accepted.
