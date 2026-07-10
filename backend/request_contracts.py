"""Bounded JSON request contracts for user-controlled write endpoints."""

from __future__ import annotations

from functools import wraps
from typing import Literal

from flask import g, jsonify, request
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, ValidationError, model_validator


class RequestPayload(BaseModel):
    model_config = ConfigDict(
        allow_inf_nan=False,
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
    )


class PaperTradePayload(RequestPayload):
    ticker: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9.^:=_-]+$")
    shares: float = Field(gt=0, le=1_000_000)


class OptionTradePayload(RequestPayload):
    contract_symbol: str = Field(alias="contractSymbol", min_length=8, max_length=64)
    quantity: int = Field(gt=0, le=10_000)
    price: float = Field(gt=0, le=1_000_000)


class PortfolioOptimizationPayload(RequestPayload):
    method: Literal["black_litterman", "max_sharpe", "min_vol", "hrp"] | None = None
    use_predictions: bool = True
    lookback_days: int | None = Field(default=None, ge=30, le=1_500)
    max_weight: float | None = Field(default=None, gt=0, le=1)


class NotificationPayload(RequestPayload):
    ticker: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9.^:=_-]+$")
    condition: Literal["above", "below"]
    target_price: float = Field(gt=0, le=100_000_000)


class SmartNotificationPayload(RequestPayload):
    prompt: str = Field(min_length=1, max_length=500)


class PredictionMarketAnalysisPayload(RequestPayload):
    market_id: str | None = Field(default=None, min_length=1, max_length=256)
    market_url: HttpUrl | None = None
    exchange: str = Field(default="polymarket", min_length=1, max_length=32)

    @model_validator(mode="after")
    def require_market_reference(self):
        if not self.market_id and not self.market_url:
            raise ValueError("market_id or market_url is required")
        return self


class PredictionMarketTradePayload(RequestPayload):
    market_id: str = Field(min_length=1, max_length=256)
    outcome: str = Field(min_length=1, max_length=128)
    contracts: float = Field(gt=0, le=10_000_000)
    exchange: str = Field(default="polymarket", min_length=1, max_length=32)


class ChatMessagePayload(RequestPayload):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=12_000)


class MarketMindChatPayload(RequestPayload):
    messages: list[ChatMessagePayload] = Field(min_length=1, max_length=100)
    attached_ticker: str | None = Field(default=None, alias="attachedTicker", max_length=32)
    chat_id: str | None = Field(default=None, alias="chatId", min_length=1, max_length=64)
    mode: str | None = Field(default=None, min_length=1, max_length=32)


class MarketMindArtifactPreflightPayload(RequestPayload):
    template_key: str = Field(alias="templateKey", min_length=1, max_length=64)
    messages: list[ChatMessagePayload] = Field(min_length=1, max_length=100)
    attached_ticker: str | None = Field(default=None, alias="attachedTicker", max_length=32)


class MarketMindArtifactPayload(MarketMindArtifactPreflightPayload):
    chat_id: str | None = Field(default=None, alias="chatId", min_length=1, max_length=64)
    artifact_id: str | None = Field(default=None, alias="artifactId", min_length=1, max_length=64)


class DeliverableCreatePayload(RequestPayload):
    ticker: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9.^:=_-]+$")
    title: str | None = Field(default=None, max_length=200)
    template_key: str | None = Field(default=None, alias="templateKey", max_length=64)
    thesis_statement: str | None = Field(default=None, alias="thesisStatement", max_length=4_000)
    time_horizon: str | None = Field(default=None, alias="timeHorizon", max_length=200)
    bull_case: str | None = Field(default=None, alias="bullCase", max_length=4_000)
    bear_case: str | None = Field(default=None, alias="bearCase", max_length=4_000)
    invalidation_conditions: str | None = Field(default=None, alias="invalidationConditions", max_length=4_000)
    catalysts: str | None = Field(default=None, max_length=4_000)
    status: str | None = Field(default=None, max_length=32)
    confidence: str | None = Field(default=None, max_length=64)
    memo_audience: str | None = Field(default=None, alias="memoAudience", max_length=200)


class DeliverablePatchPayload(RequestPayload):
    title: str | None = Field(default=None, max_length=200)
    thesis_statement: str | None = Field(default=None, alias="thesisStatement", max_length=4_000)
    time_horizon: str | None = Field(default=None, alias="timeHorizon", max_length=200)
    bull_case: str | None = Field(default=None, alias="bullCase", max_length=4_000)
    bear_case: str | None = Field(default=None, alias="bearCase", max_length=4_000)
    invalidation_conditions: str | None = Field(default=None, alias="invalidationConditions", max_length=4_000)
    catalysts: str | None = Field(default=None, max_length=4_000)
    status: str | None = Field(default=None, max_length=32)
    confidence: str | None = Field(default=None, max_length=64)
    memo_audience: str | None = Field(default=None, alias="memoAudience", max_length=200)

    @model_validator(mode="after")
    def require_update(self):
        if not self.model_fields_set:
            raise ValueError("at least one update field is required")
        return self


class DeliverableReviewPayload(RequestPayload):
    summary: str = Field(min_length=1, max_length=4_000)
    review_type: str | None = Field(default=None, alias="reviewType", max_length=64)
    what_changed: str | None = Field(default=None, alias="whatChanged", max_length=4_000)
    outcome_rating: str | None = Field(default=None, alias="outcomeRating", max_length=64)


class DeliverableAssumptionPayload(RequestPayload):
    label: str = Field(min_length=1, max_length=200)
    value: str = Field(min_length=1, max_length=2_000)
    reason: str | None = Field(default=None, max_length=2_000)
    confidence: str | None = Field(default=None, max_length=64)
    source_type: str | None = Field(default=None, alias="sourceType", max_length=64)


class DeliverableAssumptionsPayload(RequestPayload):
    assumptions: list[DeliverableAssumptionPayload] = Field(max_length=100)


def _validation_details(exc: ValidationError) -> list[dict[str, str]]:
    return [
        {
            "field": ".".join(str(part) for part in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors(include_input=False, include_url=False)
    ]


def validate_json_payload(model_cls, *, methods=("POST", "PUT", "PATCH")):
    """Validate and bound a JSON payload before invoking a route handler."""

    validated_methods = frozenset(str(method).upper() for method in methods)

    def decorator(view_fn):
        @wraps(view_fn)
        def wrapper(*args, **kwargs):
            if request.method not in validated_methods:
                return view_fn(*args, **kwargs)
            if not request.is_json:
                return jsonify({
                    "error": "Request must use application/json.",
                    "code": "invalid_content_type",
                }), 400

            payload = request.get_json(silent=True)
            if payload is None:
                return jsonify({
                    "error": "Request body must contain valid JSON.",
                    "code": "invalid_json",
                }), 400

            try:
                g.validated_payload = model_cls.model_validate(payload)
            except ValidationError as exc:
                return jsonify({
                    "error": "Request payload failed validation.",
                    "code": "invalid_request",
                    "details": _validation_details(exc),
                }), 400

            return view_fn(*args, **kwargs)

        return wrapper

    return decorator
