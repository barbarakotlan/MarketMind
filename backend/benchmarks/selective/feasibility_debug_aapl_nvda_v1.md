# Feasibility Waterfall Debug (AAPL + NVDA)

| Ticker | Mode | A Constraints | B Objective | C Guard | Final feasible | Disabled reason | Best failing candidate |
|---|---|---:|---:|---:|---:|---|---|
| AAPL | conservative | 18 | 1 | 0 | 0 | lift_gate | tau=0.15, failed=lift_gate, valSharpe=-0.203, valMaxDD=-0.209, guardSharpe=0.23218859519179152, guardMaxDD=-0.2607550820713853 |
| AAPL | aggressive | 20 | 1 | 0 | 0 | lift_gate | tau=0.15, failed=lift_gate, valSharpe=-0.203, valMaxDD=-0.209, guardSharpe=0.23218859519179152, guardMaxDD=-0.2607550820713853 |
| AAPL | risk_conservative | 18 | 1 | 0 | 0 | guard_split | tau=0.16, failed=guard_split, valSharpe=-0.307, valMaxDD=-0.193, guardSharpe=0.3591087703121106, guardMaxDD=-0.25074829153748224 |
| AAPL | risk_aggressive | 20 | 1 | 0 | 0 | guard_split | tau=0.19, failed=guard_split, valSharpe=-3.425, valMaxDD=-0.189, guardSharpe=-0.455853206458743, guardMaxDD=-0.2765624916337962 |
| NVDA | conservative | 37 | 1 | 1 | 1 | None | tau=0.36, failed=None, valSharpe=0.727, valMaxDD=-0.221, guardSharpe=0.4673077261231584, guardMaxDD=-0.2622877711603733 |
| NVDA | aggressive | 37 | 1 | 1 | 1 | None | tau=0.36, failed=None, valSharpe=0.727, valMaxDD=-0.221, guardSharpe=0.4673077261231584, guardMaxDD=-0.2622877711603733 |
| NVDA | risk_conservative | 37 | 1 | 1 | 1 | None | tau=0.36, failed=None, valSharpe=0.727, valMaxDD=-0.221, guardSharpe=0.4673077261231584, guardMaxDD=-0.2622877711603733 |
| NVDA | risk_aggressive | 37 | 1 | 1 | 1 | None | tau=0.36, failed=None, valSharpe=0.727, valMaxDD=-0.221, guardSharpe=0.4673077261231584, guardMaxDD=-0.2622877711603733 |

- Tau curves written to `benchmarks/selective/feasibility_debug_aapl_nvda_v1_tau_curves.csv` (step=0.02).
- Validation lift spread: AAPL=-0.016850, NVDA=0.028321
