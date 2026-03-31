# Memray for MarketMind

This directory contains the optional memory-profiling workflow for MarketMind's
Python backend.

Memray is a good fit here because MarketMind has two memory-interesting Python
surfaces:

- the long-running Flask/Gunicorn backend in `backend/api.py`
- the heavier data / ML jobs in `backend/selective_prediction.py` and
  `backend/selective_prediction_global.py`

It is especially useful for this codebase because those paths rely on
`pandas`, `numpy`, `scikit-learn`, and `xgboost`, which means native allocation
tracking is often worth enabling.

## Install

Memray is intentionally not part of the default runtime dependency set.

Install it into the backend virtualenv only when you want to profile:

```bash
cd /Users/tazeemmahashin/MarketMind
backend/.venv/bin/pip install -r backend/requirements-dev.txt
```

## Recommended workflows

### 1. Profile the backend server from process start

Use this when you want to reproduce a leak or allocation spike during startup or
while exercising HTTP routes:

```bash
cd /Users/tazeemmahashin/MarketMind
backend/profiling/memray/run_api_under_memray.sh
```

This writes a capture to `backend/profiling/memray/output/` by default and
runs the backend with `--native` enabled.

You can override Memray CLI flags directly:

```bash
backend/profiling/memray/run_api_under_memray.sh --live
backend/profiling/memray/run_api_under_memray.sh -o /tmp/marketmind-api.bin
```

### 2. Profile a heavy selective / benchmark job

Use this for the longest-running ML / benchmark commands:

```bash
cd /Users/tazeemmahashin/MarketMind
backend/profiling/memray/run_selective_global_under_memray.sh -- \
  eval \
  --tickers AAPL,MSFT,NVDA,SPY \
  --global-root backend/model_artifacts/selective_global/v2
```

The script forwards everything after `--` to:

```bash
python -m backend.selective_prediction_global ...
```

If you omit `--`, the script treats all arguments as
`backend.selective_prediction_global` arguments and uses default Memray flags.

### 3. Turn a capture into readable reports

```bash
cd /Users/tazeemmahashin/MarketMind
backend/profiling/memray/report_memray_capture.sh \
  backend/profiling/memray/output/selective_eval_20260330_120000.bin
```

This generates:

- `<name>_summary.txt`
- `<name>_stats.txt`
- `<name>_flamegraph.html`

## Attach mode

Memray also supports attaching to an already-running Python process. That can be
useful for profiling a warm backend without restarting it, but it is more
fragile than launching the process under Memray from the start and may require
debugger permissions or an authentication prompt on macOS.

Example:

```bash
backend/.venv/bin/python -m memray attach --native <pid>
backend/.venv/bin/python -m memray attach --native -o /tmp/backend-attach.bin <pid>
```

Use attach mode as a development-only debugging tool.

## When to use this in MarketMind

Start with Memray when:

- the backend grows in RSS after repeated route usage
- a selective train / eval / benchmark run appears to allocate far more memory
  than expected
- a profiling result needs to separate Python allocations from `numpy` /
  `pandas` / `xgboost` native allocations

Do not add Memray to normal runtime startup or production deploy paths. This is
an opt-in developer workflow.
