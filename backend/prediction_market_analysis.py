from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from openrouter_client import DEFAULT_OPENROUTER_MODEL, create_structured_completion
from prediction_markets_fetcher import PredictionMarketLookupError, resolve_market_for_analysis


ANALYSIS_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "model_probability": {"type": "number", "minimum": 0, "maximum": 1},
        "brief": {"type": "string"},
        "claims": {
            "type": "array",
            "minItems": 3,
            "maxItems": 5,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "claim": {"type": "string"},
                    "rationale": {"type": "string"},
                },
                "required": ["claim", "rationale"],
            },
        },
        "risk_notes": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "items": {"type": "string"},
        },
    },
    "required": ["model_probability", "brief", "claims", "risk_notes"],
}

ANALYSIS_SYSTEM_PROMPT = """
You are MarketMind's prediction market analyst.

You must evaluate the supplied market using only the application payload.
Do not invent outside news, data, or catalysts. If the evidence is thin, say so.
Return compact, grounded output suitable for a user deciding whether the current market price looks fairly priced.
Claims must be short yes/no-style propositions with one-sentence rationales.
""".strip()
ANALYSIS_AI_TIMEOUT_SECONDS = 8


class PredictionMarketAnalysisError(Exception):
    def __init__(self, message: str, *, status_code: int = 400, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_flag_enabled(name: str, default: bool = False) -> bool:
    raw_value = str(os.getenv(name, "")).strip().lower()
    if not raw_value:
        return default
    return raw_value in {"1", "true", "yes", "on"}


def _clamp_probability(value: Any, default: float = 0.5) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number > 1:
        number = number / 100.0
    return max(0.0, min(1.0, number))


def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    raw_value = str(value or "").strip()
    if not raw_value:
        return None
    candidate = raw_value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _hours_until_close(end_date: Optional[str]) -> Optional[float]:
    parsed = _parse_timestamp(end_date)
    if parsed is None:
        return None
    return (parsed - datetime.now(timezone.utc)).total_seconds() / 3600.0


def _compute_stance(model_probability: float, market_probability: float) -> str:
    delta = model_probability - market_probability
    if abs(delta) <= 0.03:
        return "aligned"
    if model_probability >= 0.55 and delta >= 0.04:
        return "lean_yes"
    if model_probability <= 0.45 and delta <= -0.04:
        return "lean_no"
    return "uncertain"


def _compact_text(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _format_probability(value: float) -> str:
    return f"{value * 100:.1f}%"


def _volume_bucket(volume: float, liquidity: float) -> str:
    depth = max(float(volume or 0), float(liquidity or 0))
    if depth >= 100000:
        return "deep"
    if depth >= 25000:
        return "moderate"
    return "thin"


def _build_risk_notes(market: Dict[str, Any]) -> List[str]:
    notes: List[str] = []
    description = _compact_text(market.get("description"))
    volume = float(market.get("volume") or 0)
    liquidity = float(market.get("liquidity") or 0)
    market_probability = _clamp_probability(market.get("current_probability"))
    hours_to_close = _hours_until_close(market.get("close_time"))

    if len(description) < 80:
        notes.append("Resolution criteria are limited, so interpretation risk is higher than usual.")
    if max(volume, liquidity) < 10000:
        notes.append("Market depth is light, so displayed odds may move sharply on modest flow.")
    if hours_to_close is not None and hours_to_close < 72:
        notes.append("The market is near expiry, so late information can dominate the final price action.")
    if market_probability <= 0.15 or market_probability >= 0.85:
        notes.append("Extreme pricing leaves room for sharp repricing if the market has overfit a single narrative.")

    if len(notes) < 2:
        notes.append("This analysis is based on market structure and supplied rules only, without external research.")
    if len(notes) < 2:
        notes.append("Treat the output as a framing tool, not a substitute for primary-source event research.")

    return notes[:4]


def _build_fallback_claims(market: Dict[str, Any]) -> List[Dict[str, str]]:
    market_probability = _clamp_probability(market.get("current_probability"))
    volume = float(market.get("volume") or 0)
    liquidity = float(market.get("liquidity") or 0)
    description = _compact_text(market.get("description"))
    hours_to_close = _hours_until_close(market.get("close_time"))
    bucket = _volume_bucket(volume, liquidity)

    claims = [
        {
            "claim": "The market already shows a clear directional lean.",
            "rationale": f"Current pricing implies about {_format_probability(market_probability)}, which is meaningfully away from a coin flip.",
        },
        {
            "claim": f"The market's current odds should be treated as {bucket}ly informative rather than definitive.",
            "rationale": f"Reported volume is ${volume:,.0f} and liquidity is ${liquidity:,.0f}, so price discovery looks {bucket}.",
        },
        {
            "claim": "Resolution wording is a meaningful source of risk in this market.",
            "rationale": (
                "The description provides enough detail to frame the setup."
                if len(description) >= 120
                else "The supplied resolution detail is fairly sparse, which increases ambiguity risk."
            ),
        },
    ]

    if hours_to_close is not None:
        if hours_to_close < 72:
            claims.append(
                {
                    "claim": "Late event risk is unusually important here.",
                    "rationale": "The market closes soon, so one headline or official update could move pricing materially.",
                }
            )
        else:
            claims.append(
                {
                    "claim": "There is still enough time for the narrative to evolve before expiry.",
                    "rationale": "The market is not near resolution yet, which leaves room for meaningful repricing.",
                }
            )

    return claims[:4]


def _fallback_model_probability(market: Dict[str, Any]) -> float:
    market_probability = _clamp_probability(market.get("current_probability"))
    description = _compact_text(market.get("description"))
    volume = float(market.get("volume") or 0)
    liquidity = float(market.get("liquidity") or 0)
    hours_to_close = _hours_until_close(market.get("close_time"))

    regression_weight = 0.0
    if len(description) < 80:
        regression_weight += 0.10
    if max(volume, liquidity) < 10000:
        regression_weight += 0.12
    elif max(volume, liquidity) < 25000:
        regression_weight += 0.06
    if hours_to_close is not None and hours_to_close < 72:
        regression_weight += 0.07

    regressed_probability = market_probability + ((0.5 - market_probability) * regression_weight)
    return max(0.05, min(0.95, regressed_probability))


def _build_fallback_brief(market: Dict[str, Any], model_probability: float) -> str:
    market_probability = _clamp_probability(market.get("current_probability"))
    delta = model_probability - market_probability
    delta_points = abs(delta) * 100
    direction = "roughly aligned with" if abs(delta) <= 0.03 else "more cautious than" if delta < 0 else "more constructive than"

    return (
        f"The market is pricing this outcome around {_format_probability(market_probability)}, and the model comes in at "
        f"{_format_probability(model_probability)}. That leaves the model {direction} the tape by about {delta_points:.1f} points. "
        "The gap is driven mainly by market structure inputs like depth, time-to-resolution, and how specific the supplied rules appear."
    )


def _generate_fallback_analysis(market: Dict[str, Any]) -> Dict[str, Any]:
    model_probability = _fallback_model_probability(market)
    return {
        "claims": _build_fallback_claims(market),
        "model_probability": model_probability,
        "brief": _build_fallback_brief(market, model_probability),
        "risk_notes": _build_risk_notes(market),
        "model": "fallback-heuristic",
    }


def _build_prompt_messages(market: Dict[str, Any]) -> List[Dict[str, str]]:
    prompt_payload = {
        "question": market.get("question"),
        "eventTitle": market.get("event_title"),
        "currentProbability": round(_clamp_probability(market.get("current_probability")), 4),
        "endDate": market.get("close_time"),
        "volume": market.get("volume"),
        "liquidity": market.get("liquidity"),
        "description": _compact_text(market.get("description")),
        "outcomes": market.get("outcomes") or [],
        "prices": market.get("prices") or {},
        "sourceUrl": market.get("source_url"),
    }
    return [
        {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Analyze this prediction market payload and return a compact probability view.\n"
                f"{prompt_payload}"
            ),
        },
    ]


def _generate_ai_analysis(market: Dict[str, Any]) -> Dict[str, Any]:
    ai_result = create_structured_completion(
        messages=_build_prompt_messages(market),
        json_schema=ANALYSIS_JSON_SCHEMA,
        schema_name="prediction_market_analysis",
        model=DEFAULT_OPENROUTER_MODEL,
        temperature=0.2,
        timeout_seconds=ANALYSIS_AI_TIMEOUT_SECONDS,
    )
    structured = ai_result["structured_content"]
    return {
        "claims": [
            {
                "claim": _compact_text(item.get("claim")),
                "rationale": _compact_text(item.get("rationale")),
            }
            for item in (structured.get("claims") or [])
            if _compact_text(item.get("claim")) and _compact_text(item.get("rationale"))
        ],
        "model_probability": _clamp_probability(structured.get("model_probability")),
        "brief": _compact_text(structured.get("brief")),
        "risk_notes": [_compact_text(item) for item in (structured.get("risk_notes") or []) if _compact_text(item)],
        "model": ai_result.get("model") or DEFAULT_OPENROUTER_MODEL,
    }


def _finalize_response(market: Dict[str, Any], generated: Dict[str, Any]) -> Dict[str, Any]:
    market_probability = _clamp_probability(market.get("current_probability"))
    model_probability = _clamp_probability(generated.get("model_probability"))
    delta = round(model_probability - market_probability, 4)
    claims = (generated.get("claims") or [])[:5]
    risk_notes = (generated.get("risk_notes") or [])[:4]

    if len(claims) < 3:
        claims = _build_fallback_claims(market)
    if len(risk_notes) < 2:
        risk_notes = _build_risk_notes(market)

    return {
        "market": {
            "id": market.get("id"),
            "exchange": market.get("exchange"),
            "question": market.get("question"),
            "event_title": market.get("event_title"),
            "current_probability": round(market_probability, 4),
            "end_date": market.get("close_time"),
            "source_url": market.get("source_url"),
        },
        "claims": claims,
        "analysis": {
            "model_probability": round(model_probability, 4),
            "delta": delta,
            "stance": _compute_stance(model_probability, market_probability),
            "brief": generated.get("brief") or _build_fallback_brief(market, model_probability),
            "risk_notes": risk_notes,
            "model": generated.get("model"),
        },
        "generated_at": _utcnow_iso(),
    }


def analyze_prediction_market(
    *,
    market_id: Optional[str] = None,
    market_url: Optional[str] = None,
    exchange: str = "polymarket",
) -> Dict[str, Any]:
    try:
        market = resolve_market_for_analysis(
            market_id=market_id,
            market_url=market_url,
            exchange=exchange,
        )
    except PredictionMarketLookupError as exc:
        raise PredictionMarketAnalysisError(str(exc), status_code=exc.status_code) from exc

    if not market.get("question"):
        raise PredictionMarketAnalysisError("Prediction market question is missing", status_code=502)

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    ai_enabled = api_key and _env_flag_enabled("PREDICTION_MARKET_ANALYSIS_USE_AI", default=False)
    if ai_enabled:
        try:
            generated = _generate_ai_analysis(market)
        except Exception:
            generated = _generate_fallback_analysis(market)
    else:
        generated = _generate_fallback_analysis(market)

    return _finalize_response(market, generated)
