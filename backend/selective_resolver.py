from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Literal, Optional


SELECTOR_STATUS = {
    "ok",
    "disabled",
    "insufficient_history",
    "model_unavailable",
    "stale_artifact",
    "disabled_mode",
}
SELECTOR_SOURCE = {"ticker", "global", "none"}
SELECTOR_SOURCE_REQUESTABLE = {"auto", "ticker", "global"}
STATUS_PRECEDENCE_AUTO = ["stale_artifact", "disabled_mode", "model_unavailable"]
SELECTIVE_DISABLED_STATUSES = {
    "disabled",
    "insufficient_history",
    "model_unavailable",
    "stale_artifact",
    "disabled_mode",
}


@dataclass(frozen=True)
class AttemptResult:
    source: Literal["ticker", "global"]
    status: Literal["ok", "insufficient_history", "model_unavailable", "stale_artifact", "disabled_mode"]
    prob: Optional[float] = None
    tau: Optional[float] = None
    reason: Optional[str] = None


def normalize_selector_source_requested(selector_source_requested: str) -> str:
    source = str(selector_source_requested or "auto").lower()
    return source if source in SELECTOR_SOURCE_REQUESTABLE else "auto"


def resolve_attempt_sources(
    selector_source_requested: str,
    global_selector_enabled: bool,
    global_selector_policy: str,
) -> List[str]:
    source_requested = normalize_selector_source_requested(selector_source_requested)
    if source_requested in {"ticker", "global"}:
        return [source_requested]

    if not bool(global_selector_enabled):
        return ["ticker"]

    policy = str(global_selector_policy or "prefer_ticker").lower()
    if policy == "prefer_global":
        return ["global", "ticker"]
    if policy == "global_only":
        return ["global"]
    return ["ticker", "global"]


def collapse_attempt_failures(attempts: List[AttemptResult]) -> str:
    if attempts and all(a.status == "insufficient_history" for a in attempts):
        return "insufficient_history"
    for status in STATUS_PRECEDENCE_AUTO:
        if any(a.status == status for a in attempts):
            return status
    return "model_unavailable"


def non_ok_selector_response(
    mode_requested: str,
    status: str,
    regime_bucket: str,
) -> Dict[str, object]:
    return {
        "abstain": False,
        "selector_prob": None,
        "selector_threshold": None,
        "selector_mode_requested": mode_requested,
        "selector_mode_effective": "none",
        "selector_status": status,
        "selector_source": "none",
        "abstain_reason": None,
        "regime_bucket": str(regime_bucket),
    }


def _sanitize_attempt_result(result: AttemptResult) -> AttemptResult:
    # Keep public invariant safe even if a caller mistakenly returns status=ok without usable values.
    if result.status == "ok" and (result.prob is None or result.tau is None):
        return AttemptResult(
            source=result.source,
            status="disabled_mode",
            prob=None,
            tau=None,
            reason=result.reason or "ok_missing_prob_or_tau",
        )
    return result


def resolve_selector_attempts(
    mode_requested: str,
    selector_source_requested: str,
    global_selector_enabled: bool,
    global_selector_policy: str,
    attempt_runner: Callable[[str], AttemptResult],
    regime_bucket: str = "unknown",
    logger=None,
) -> Dict[str, object]:
    if mode_requested == "none":
        return non_ok_selector_response(
            mode_requested=mode_requested,
            status="disabled",
            regime_bucket=regime_bucket,
        )

    attempt_sources = resolve_attempt_sources(
        selector_source_requested=selector_source_requested,
        global_selector_enabled=global_selector_enabled,
        global_selector_policy=global_selector_policy,
    )
    attempts: List[AttemptResult] = []

    for source in attempt_sources:
        result = _sanitize_attempt_result(attempt_runner(source))
        attempts.append(result)
        if result.status == "ok":
            prob = float(result.prob)
            tau = float(result.tau)
            abstain = prob < tau
            return {
                "abstain": bool(abstain),
                "selector_prob": prob,
                "selector_threshold": tau,
                "selector_mode_requested": mode_requested,
                "selector_mode_effective": mode_requested,
                "selector_status": "ok",
                "selector_source": result.source,
                "abstain_reason": "selector_prob_below_threshold" if abstain else None,
                "regime_bucket": str(regime_bucket),
            }

    final_status = collapse_attempt_failures(attempts)
    if logger:
        try:
            failure_reasons = {a.source: {"status": a.status, "reason": a.reason} for a in attempts}
            logger.debug(
                "selector resolve mode=%s source_req=%s attempted_sources=%s failures=%s final=%s",
                mode_requested,
                normalize_selector_source_requested(selector_source_requested),
                attempt_sources,
                failure_reasons,
                final_status,
            )
        except Exception:
            pass
    return non_ok_selector_response(
        mode_requested=mode_requested,
        status=final_status,
        regime_bucket=regime_bucket,
    )
