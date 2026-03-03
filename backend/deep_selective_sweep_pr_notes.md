# Selective Prediction Deep Eval Sweep (PR Notes)

- Generated: 2026-03-03T01:48:00.184276Z
- Config: period=2y, xgboost_enabled=False, retrain_frequency=12, min_history=100, seed=42

| Ticker | None Sharpe | None MaxDD | Best Mode | Delta Sharpe | Delta MaxDD | Coverage | Trades |
|---|---:|---:|---|---:|---:|---:|---:|
| AAPL | 3.0976 | -0.0631 | conservative | 0.0000 | 0.0000 | 1.0000 | 39 |
| MSFT | -3.4661 | -0.2721 | conservative | -0.0415 | -0.0016 | 0.9750 | 39 |
| NVDA | -2.0714 | -0.1994 | conservative | 0.0000 | 0.0000 | 1.0000 | 40 |
| TSLA | 1.5268 | -0.0620 | conservative | 0.0000 | 0.0000 | 1.0000 | 40 |
| SPY | -2.2355 | -0.0493 | conservative | 0.0000 | 0.0000 | 1.0000 | 40 |
| PLTR | -2.7021 | -0.3137 | conservative | 0.5187 | 0.0000 | 0.9487 | 37 |
| AMD | -2.0865 | -0.3204 | conservative | 0.0000 | 0.0000 | 1.0000 | 39 |
| META | -4.0628 | -0.2022 | conservative | 0.0000 | 0.0000 | 1.0000 | 39 |

## Highlight

- At least one selective mode improved held-out metrics: `PLTR` `conservative` with delta Sharpe `0.5187` and delta MaxDD `0.0000`.

## MSML Framing

- Selector abstention is enabled only when ranking quality is positive on validation (lift gate) and remains stable on a guard slice.
- When those conditions are not met, the system fails safe to non-abstaining behavior.
- This is a selective prediction layer inspired by Learn-to-Abstain: we only trust the selector when it demonstrates stable ranking of informative vs uninformative periods.

## Validation Scope

- Artifact-based sanity checks verify status plumbing only (`ok`/`disabled_*` propagation and coverage monotonic diagnostics recording).
- These checks are not performance claims because artifacts are not regenerated as part of CI.
