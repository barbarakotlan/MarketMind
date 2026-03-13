# Monthly User Journey Simulation

This runbook turns the MarketMind "use it like a real user for a month" exercise into a repeatable workflow. It is designed to validate the full UI -> API -> persistence path for one authenticated Clerk user while restoring that account to its original state afterward.

Use this alongside [RELEASE_SMOKE_TEST_CHECKLIST.md](/Users/tazeemmahashin/MarketMind/RELEASE_SMOKE_TEST_CHECKLIST.md). The release checklist is broad and release-oriented; this document is a deeper product-usage simulation focused on realistic behavior over time.

## What This Covers

The simulation is meant to exercise the user-owned state that now lives in both the per-user JSON mirror and the SQL persistence layer:

- watchlist
- active and triggered alerts
- paper trading portfolio, trades, and snapshots
- prediction-market paper portfolio and trades
- authenticated navigation through the main app shell

It does not attempt to persist or backfill third-party market/news data, model outputs, or benchmark artifacts.

## Prerequisites

- Backend is running and authenticated requests work.
- Frontend is running and the app is reachable in a real browser.
- The target user can sign in with Clerk.
- If `PERSISTENCE_MODE` is `dual` or `postgres`, `DATABASE_URL` is set.
- The backend virtualenv is available at `backend/.venv`.

## Snapshot The Baseline

Before touching the account, capture a baseline snapshot for the target Clerk user.

```bash
cd /Users/tazeemmahashin/MarketMind/backend

SNAPSHOT_DIR="/tmp/marketmind-monthly-sim-$(date +%Y%m%d-%H%M%S)"

.venv/bin/python user_journey_state.py \
  --database-url "$DATABASE_URL" \
  --base-dir "$(pwd)" \
  snapshot \
  --user-id "YOUR_CLERK_USER_ID" \
  --snapshot-dir "$SNAPSHOT_DIR"
```

Keep the printed `snapshot_path` or the `SNAPSHOT_DIR` itself. You will use it to restore the account after the simulation.

## Run The Simulation

Treat the simulation as four sessions, each representing a week of normal product use.

### Week 1: Research And Setup

- Sign in with the target Clerk account.
- Search for at least three tickers across different sectors.
- Open price charts and fundamentals for those names.
- Review at least one related news feed.
- Add two or three symbols to the watchlist.

Expected outcomes:

- Search results are stable and correspond to the latest search.
- Charts and quote data load for the selected ticker.
- Watchlist updates persist after navigation or refresh.

### Week 2: Monitoring And Alerting

- Revisit the watchlist.
- Create at least one price alert.
- Create at least one smart/news alert if that workflow is enabled.
- Visit the notifications view and verify alert state is coherent.

Expected outcomes:

- New alert rules appear in the notifications UI.
- Passive polling does not mark triggered alerts as seen.
- Triggered alert state remains isolated to the signed-in user.

### Week 3: Paper Trading

- Buy at least one equity position.
- If options trading is part of the scenario, open one paper options position.
- Review dashboard, portfolio, and history views after the trade.
- Sell at least part of one position.

Expected outcomes:

- Cash, positions, and trade history update immediately.
- Dashboard summaries reflect both equity and options holdings.
- Portfolio state survives refresh and re-login.

### Week 4: Prediction Markets And Review

- Browse prediction markets.
- Buy one prediction-market paper position.
- Confirm the Portfolio tab shows the position immediately after the trade.
- Sell the position back down.
- Review final history and portfolio cash.

Expected outcomes:

- Prediction-market trades persist correctly.
- Post-trade refresh lands on an up-to-date portfolio view.
- Open positions and trade history match the executed actions.

## Checkpoints During The Run

Use these checkpoints after each weekly session if you want stronger evidence than the UI alone.

```bash
cd /Users/tazeemmahashin/MarketMind/backend

.venv/bin/python user_journey_state.py \
  --database-url "$DATABASE_URL" \
  --base-dir "$(pwd)" \
  verify \
  --user-id "YOUR_CLERK_USER_ID"
```

This prints a JSON summary of the current SQL-backed state and JSON mirror state for that user.

## How To Classify Findings

When something looks wrong during the simulation, classify it before filing follow-up work:

- Product bug
  The UI, API contract, or persisted user state is incorrect.
- Third-party asset noise
  The core app behavior is fine, but a non-critical external image, CDN, or provider asset fails.
- Harness issue
  The failure comes from automation timing, a brittle selector, or an unrealistic test assumption rather than user-visible product behavior.

Only product bugs should block the simulation from being called a real product signal.

## Restore The Original State

After the simulation is complete, restore the baseline snapshot.

```bash
cd /Users/tazeemmahashin/MarketMind/backend

.venv/bin/python user_journey_state.py \
  --database-url "$DATABASE_URL" \
  --base-dir "$(pwd)" \
  restore \
  --user-id "YOUR_CLERK_USER_ID" \
  --snapshot-dir "$SNAPSHOT_DIR"
```

The command exits non-zero if the restored state does not match the saved snapshot.

## Verify The Restore

Run a final comparison against the saved snapshot.

```bash
cd /Users/tazeemmahashin/MarketMind/backend

.venv/bin/python user_journey_state.py \
  --database-url "$DATABASE_URL" \
  --base-dir "$(pwd)" \
  verify \
  --user-id "YOUR_CLERK_USER_ID" \
  --snapshot-dir "$SNAPSHOT_DIR"
```

Successful restore criteria:

- `matches_snapshot` is `true`
- `json_matches_snapshot` is `true`
- `sql_matches_snapshot` is `true`

## Notes

- The snapshot tool captures both SQL-backed user state and the per-user mirror files under `backend/user_data/<clerk_user_id>/`.
- The restore step intentionally rewrites the target user's mirror directory so the account returns to the captured baseline exactly.
- This process is safe for normal product validation, but it should still be run against a known user account whose activity you are intentionally simulating.
