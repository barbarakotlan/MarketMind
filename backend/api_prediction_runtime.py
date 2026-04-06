from __future__ import annotations

import prediction_service


def to_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return False


def live_ensemble_signal_components(
    sanitized_ticker,
    *,
    create_dataset_fn,
    ensemble_predict_fn,
    np_module,
):
    df = create_dataset_fn(sanitized_ticker, period="1y")
    if df.empty or len(df) < 30:
        return None

    ensemble_preds, individual_preds = ensemble_predict_fn(df, days_ahead=7)
    if ensemble_preds is None or len(ensemble_preds) == 0:
        return None

    recent_close = float(df["Close"].iloc[-1])
    raw_signal = 0.0 if recent_close == 0 else float((float(ensemble_preds[0]) - recent_close) / recent_close)

    model_returns = []
    for preds in individual_preds.values():
        if preds is None or len(preds) == 0 or recent_close == 0:
            continue
        model_returns.append((float(preds[0]) - recent_close) / recent_close)
    disagreement = float(np_module.std(model_returns)) if len(model_returns) > 1 else 0.0

    return {
        "df": df,
        "ensemble_preds": ensemble_preds,
        "individual_preds": individual_preds,
        "recent_close": recent_close,
        "raw_signal": raw_signal,
        "disagreement": disagreement,
    }


def chart_prediction_points(
    sanitized_ticker,
    *,
    live_ensemble_signal_components_fn,
    pd_module,
):
    signal_parts = live_ensemble_signal_components_fn(sanitized_ticker)
    if signal_parts is None:
        return []

    ensemble_preds = signal_parts["ensemble_preds"]
    if ensemble_preds is None or len(ensemble_preds) == 0:
        return []

    future_dates = prediction_service.get_future_prediction_dates(signal_parts["df"], len(ensemble_preds))
    if not future_dates:
        recent_date = signal_parts["df"].index[-1]
        future_dates = [recent_date + pd_module.Timedelta(days=i + 1) for i in range(len(ensemble_preds))]
    return [
        {
            "date": date.strftime("%Y-%m-%d 00:00:00"),
            "open": None,
            "high": None,
            "low": None,
            "close": round(float(pred), 2),
            "volume": None,
        }
        for date, pred in zip(future_dates, ensemble_preds)
    ]


def resolve_selector_gate_for_ticker(
    sanitized_ticker,
    requested_mode,
    selector_source_requested="auto",
    *,
    live_ensemble_signal_components_fn,
    infer_selective_decision_fn,
    logger,
):
    signal_parts = live_ensemble_signal_components_fn(sanitized_ticker)
    raw_signal = signal_parts["raw_signal"] if signal_parts else 0.0
    disagreement = signal_parts["disagreement"] if signal_parts else 0.0
    return infer_selective_decision_fn(
        ticker=sanitized_ticker,
        requested_mode=requested_mode,
        selector_source_requested=selector_source_requested,
        raw_signal=raw_signal,
        ensemble_disagreement=disagreement,
        logger=logger,
    )
