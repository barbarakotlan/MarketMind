# Selective Sweep 5Y + XGBoost Diagnostics v2

- Generated: 2026-03-03T05:31:18.345760Z
- Config: period=5y, xgboost_enabled=True, retrain_frequency=12, min_history=120, min_trades=40, risk_max_sharpe_degrade=0.2

| Ticker | Mode | Status | Objective | Tau | Coverage | Trades | None Sharpe | Mode Sharpe | None MaxDD | Mode MaxDD | Feasible τ | Lift Spread |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AAPL | conservative | disabled_conservative | sharpe | n/a | n/a | n/a | -1.6824 | n/a | -0.3138 | n/a | 0 | 0.003999 |
| AAPL | aggressive | disabled_aggressive | sharpe | n/a | n/a | n/a | -1.6824 | n/a | -0.3138 | n/a | 0 | 0.003999 |
| AAPL | risk_conservative | disabled_risk_conservative | maxdd | n/a | n/a | n/a | -1.6824 | n/a | -0.3138 | n/a | 0 | 0.003999 |
| AAPL | risk_aggressive | disabled_risk_aggressive | maxdd | n/a | n/a | n/a | -1.6824 | n/a | -0.3138 | n/a | 0 | 0.003999 |
| MSFT | conservative | disabled_conservative | sharpe | n/a | n/a | n/a | -1.6912 | n/a | -0.3016 | n/a | 0 | -0.000885 |
| MSFT | aggressive | disabled_aggressive | sharpe | n/a | n/a | n/a | -1.6912 | n/a | -0.3016 | n/a | 0 | -0.000885 |
| MSFT | risk_conservative | ok | maxdd | 0.12 | 0.9570 | 178 | -1.6912 | -1.6843 | -0.3016 | -0.2849 | 14 | -0.000885 |
| MSFT | risk_aggressive | ok | maxdd | 0.19 | 0.8226 | 153 | -1.6912 | -1.3107 | -0.3016 | -0.2560 | 20 | -0.000885 |
| NVDA | conservative | disabled_conservative | sharpe | n/a | n/a | n/a | -1.3234 | n/a | -0.3827 | n/a | 0 | 0.017471 |
| NVDA | aggressive | disabled_aggressive | sharpe | n/a | n/a | n/a | -1.3234 | n/a | -0.3827 | n/a | 0 | 0.017471 |
| NVDA | risk_conservative | disabled_risk_conservative | maxdd | n/a | n/a | n/a | -1.3234 | n/a | -0.3827 | n/a | 0 | 0.017471 |
| NVDA | risk_aggressive | disabled_risk_aggressive | maxdd | n/a | n/a | n/a | -1.3234 | n/a | -0.3827 | n/a | 0 | 0.017471 |
| SPY | conservative | disabled_conservative | sharpe | n/a | n/a | n/a | -4.5921 | n/a | -0.3296 | n/a | 0 | 0.002280 |
| SPY | aggressive | ok | sharpe | 0.24 | 0.7419 | 138 | -4.5921 | -2.6966 | -0.3296 | -0.2068 | 25 | 0.002280 |
| SPY | risk_conservative | disabled_risk_conservative | maxdd | n/a | n/a | n/a | -4.5921 | n/a | -0.3296 | n/a | 0 | 0.002280 |
| SPY | risk_aggressive | ok | maxdd | 0.24 | 0.7419 | 138 | -4.5921 | -2.6966 | -0.3296 | -0.2068 | 25 | 0.002280 |
| PLTR | conservative | disabled_conservative | sharpe | n/a | n/a | n/a | -1.2975 | n/a | -0.5669 | n/a | 0 | 0.015234 |
| PLTR | aggressive | disabled_aggressive | sharpe | n/a | n/a | n/a | -1.2975 | n/a | -0.5669 | n/a | 0 | 0.015234 |
| PLTR | risk_conservative | disabled_risk_conservative | maxdd | n/a | n/a | n/a | -1.2975 | n/a | -0.5669 | n/a | 0 | 0.015234 |
| PLTR | risk_aggressive | disabled_risk_aggressive | maxdd | n/a | n/a | n/a | -1.2975 | n/a | -0.5669 | n/a | 0 | 0.015234 |
| META | conservative | disabled_conservative | sharpe | n/a | n/a | n/a | -1.0010 | n/a | -0.3547 | n/a | 0 | -0.007089 |
| META | aggressive | disabled_aggressive | sharpe | n/a | n/a | n/a | -1.0010 | n/a | -0.3547 | n/a | 0 | -0.007089 |
| META | risk_conservative | disabled_risk_conservative | maxdd | n/a | n/a | n/a | -1.0010 | n/a | -0.3547 | n/a | 0 | -0.007089 |
| META | risk_aggressive | disabled_risk_aggressive | maxdd | n/a | n/a | n/a | -1.0010 | n/a | -0.3547 | n/a | 0 | -0.007089 |

## Per-Ticker Summary

| Ticker | Best Sharpe Mode | Best Risk Mode | Sharpe Modes Lift-Gate Disabled | Risk Improved MaxDD Within Sharpe Cap |
|---|---|---|---|---|
| AAPL | None | None | False | risk_conservative=False, risk_aggressive=False |
| MSFT | None | risk_aggressive | True | risk_conservative=True, risk_aggressive=True |
| NVDA | None | None | False | risk_conservative=False, risk_aggressive=False |
| SPY | aggressive | risk_aggressive | False | risk_conservative=False, risk_aggressive=True |
| PLTR | None | None | False | risk_conservative=False, risk_aggressive=False |
| META | None | None | True | risk_conservative=False, risk_aggressive=False |
