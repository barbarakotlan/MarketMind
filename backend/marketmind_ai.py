from __future__ import annotations

import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

import akshare_service
from asset_identity import parse_asset_reference
from crypto_fetcher import CRYPTO_INFO, get_crypto_exchange_rate
from deliverables import (
    DEFAULT_TEMPLATE_KEY,
    DOCX_MIME_TYPE,
    MEMO_JSON_SCHEMA,
    _fundamentals_summary,
    _prediction_snapshot,
    _recent_news,
    _render_docx,
)
from openrouter_client import (
    DEFAULT_OPENROUTER_MODEL,
    create_chat_completion,
    create_structured_completion,
)
import sec_filings_service
from user_state_store import (
    Deliverable,
    DeliverableMemo,
    MarketMindAiChat,
    MarketMindAiChatMessage,
    load_notifications,
    load_portfolio,
    load_watchlist,
    utcnow,
)


TEMPLATE_KEY_INVESTMENT_THESIS_MEMO = DEFAULT_TEMPLATE_KEY
VALID_TEMPLATE_KEYS = {TEMPLATE_KEY_INVESTMENT_THESIS_MEMO}
STARTER_PROMPTS = [
    "What are the biggest risks to AAPL over the next two quarters?",
    "Summarize the current setup for NVDA using predictions, news, and fundamentals.",
    "What would make a bullish thesis on MSFT break down?",
    "Compare MSFT vs GOOGL using predictions, news, and fundamentals.",
    "Help me think through whether I should monitor or avoid TSLA right now.",
]

ARTIFACT_TEMPLATES = [
    {
        "key": TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
        "label": "Investment Thesis Memo",
        "description": "A structured memo grounded in MarketMind context and the current conversation.",
    }
]

CHAT_SYSTEM_PROMPT = """
You are MarketMindAI, a market research copilot inside the MarketMind application.

Your job is to help the user think clearly using the information already present in MarketMind.
Use the attached application context when it exists. If evidence is weak, missing, or mixed, say so directly.
Only treat server-resolved attached ticker context as authoritative. Do not rely on stale UI state or infer hidden ticker context.
If attached ticker context exists, never say you lack access to ticker context, live app context, or relevant MarketMind data for that asset.
Crypto assets are valid MarketMind context too when attached. Do not treat them as unsupported just because they are not equities.
Do not invent company facts, catalysts, numbers, or conclusions that are not supported by the supplied context.
Do not behave like a generic chatbot detached from the application.
Keep answers concise, analytical, and useful for an investor or student learning how to reason about markets.
If the user asks for a buy/sell/hold view, do not give personalized financial advice. Instead, provide a clearly labeled directional lean such as "lean buy", "lean hold", or "lean sell" based only on the attached context, and explain what would change that view.
Only suggest creating an Investment Thesis Memo when the user is already discussing a specific ticker or thesis.
""".strip()

TICKER_STOP_WORDS = {
    "A", "AN", "AND", "ARE", "AS", "AT", "AVOID", "ABOUT", "ANALYZE", "ANALYSIS",
    "BEARISH", "BIGGEST", "BREAK", "BREAKDOWN", "BUT", "BY", "CAN", "COMPARE", "CURRENT",
    "DOWN", "EVALUATE", "EXPLAIN", "FOR", "FUNDAMENTALS", "HELP", "HOW", "I", "IN", "IS",
    "IT", "MARKET", "MEMO", "MONITOR", "NEWS", "NEXT", "NOT", "NOW", "OF", "ON", "OR",
    "OVER", "PREDICTIONS", "QUARTERS", "RE", "REGARDING", "REVIEW", "RIGHT", "RISK", "RISKS",
    "SETUP", "SHOULD", "STOCK", "STOCKS", "SUMMARIZE", "SUMMARY", "SYMBOL", "THAT", "THE",
    "THESIS", "THINK", "THIS", "THROUGH", "TICKER", "TO", "USING", "WATCH", "WHAT", "WHEN",
    "WHETHER", "WHY", "WITH", "WOULD",
}

CRYPTO_ALIAS_MAP = {
    **{code.upper(): f"{code.upper()}-USD" for code in CRYPTO_INFO.keys()},
    **{str(info.get("name", "")).strip().lower(): f"{code.upper()}-USD" for code, info in CRYPTO_INFO.items() if info.get("name")},
    "bitcoin": "BTC-USD",
    "btc": "BTC-USD",
    "ethereum": "ETH-USD",
    "ether": "ETH-USD",
    "eth": "ETH-USD",
}
CRYPTO_NAME_PATTERNS = sorted(
    ((alias.lower(), canonical) for alias, canonical in CRYPTO_ALIAS_MAP.items() if alias and alias.lower() != canonical.lower()),
    key=lambda item: len(item[0]),
    reverse=True,
)


class MarketMindAIError(Exception):
    def __init__(self, message: str, *, status_code: int = 400, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


def _serialize_timestamp(value):
    return value.isoformat() if value else None


def _coerce_uuid(value: str, *, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except Exception as exc:
        raise MarketMindAIError(f"Invalid {field_name}", status_code=400) from exc


def _normalize_ticker(ticker: Optional[str], *, market: Optional[str] = None) -> Optional[str]:
    raw_value = str(ticker or "").strip()
    if not raw_value:
        return None
    lowered = raw_value.lower()
    if lowered in CRYPTO_ALIAS_MAP:
        return CRYPTO_ALIAS_MAP[lowered]
    normalized = raw_value.upper()
    if normalized in CRYPTO_ALIAS_MAP:
        return CRYPTO_ALIAS_MAP[normalized]
    try:
        asset = parse_asset_reference(raw_value, market)
        return asset["symbol"] if asset["market"] == "US" else asset["assetId"]
    except Exception:
        return normalized or None


def _collect_unique_candidates(matches) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for match in matches:
        candidate = _normalize_ticker(match)
        if not candidate or candidate in TICKER_STOP_WORDS or candidate in seen:
            continue
        seen.add(candidate)
        ordered.append(candidate)
    return ordered


def _is_symbol_like_token(raw_value: str) -> bool:
    value = str(raw_value or "").strip()
    if not value:
        return False
    return value.isupper() or value.islower()


def _extract_explicit_ticker_candidates(text: str) -> List[str]:
    raw_text = str(text or "")
    if not raw_text.strip():
        return []

    lowered = raw_text.lower()

    international_prefixed = _collect_unique_candidates(
        match.group(0)
        for match in re.finditer(r"\b(?:HK|CN):\d{4,6}\b", raw_text, flags=re.IGNORECASE)
    )
    if international_prefixed:
        return international_prefixed

    international_suffixed = _collect_unique_candidates(
        match.group(0)
        for match in re.finditer(r"\b\d{4,6}(?:\.(?:HK|SS|SH|SZ))\b", raw_text, flags=re.IGNORECASE)
    )
    if international_suffixed:
        return international_suffixed

    direct_crypto_pairs = _collect_unique_candidates(
        match.group(0)
        for match in re.finditer(r"\b([A-Za-z]{2,5}-USD)\b", raw_text)
    )
    if direct_crypto_pairs:
        return direct_crypto_pairs

    named_asset_candidates = _collect_unique_candidates(
        canonical
        for alias, canonical in CRYPTO_NAME_PATTERNS
        if re.search(rf"\b{re.escape(alias)}\b", lowered)
    )
    if named_asset_candidates:
        return named_asset_candidates

    dollar_candidates = _collect_unique_candidates(
        match.group(1)
        for match in re.finditer(r"\$([A-Za-z]{1,5})\b", raw_text)
    )
    if dollar_candidates:
        return dollar_candidates

    cue_patterns = (
        r"\b(?:TICKER|SYMBOL)\s+\$?([A-Za-z]{1,5})\b",
        r"\b(?:FOR|ON|ABOUT|REGARDING|RE|TO|AROUND|AVOID|MONITOR|WATCH|COMPARE|ANALYZE|REVIEW|EVALUATE)\s+\$?([A-Za-z]{1,5})\b",
    )
    cue_candidates: List[str] = []
    for pattern in cue_patterns:
        cue_candidates.extend(
            _collect_unique_candidates(
                match.group(1)
                for match in re.finditer(pattern, raw_text, flags=re.IGNORECASE)
                if _is_symbol_like_token(match.group(1))
            )
        )
    cue_candidates = _collect_unique_candidates(cue_candidates)
    if cue_candidates:
        return cue_candidates

    return _collect_unique_candidates(re.findall(r"\b[A-Z]{1,5}\b", raw_text))


def _resolve_latest_ticker(
    latest_user_message: Optional[str],
    previous_ticker: Optional[str],
) -> Dict[str, Optional[str]]:
    prior = _normalize_ticker(previous_ticker)
    candidates = _extract_explicit_ticker_candidates(latest_user_message or "")

    if len(candidates) > 1:
        return {
            "resolvedTicker": None,
            "previousTicker": prior,
            "status": "ambiguous",
        }

    if len(candidates) == 1:
        resolved = candidates[0]
        return {
            "resolvedTicker": resolved,
            "previousTicker": prior,
            "status": "kept" if resolved == prior else "switched",
        }

    if prior:
        return {
            "resolvedTicker": prior,
            "previousTicker": prior,
            "status": "kept",
        }

    return {
        "resolvedTicker": None,
        "previousTicker": None,
        "status": "detached",
    }


def _infer_compare_pair(latest_user_message: Optional[str]) -> Optional[List[str]]:
    raw_text = str(latest_user_message or "").strip()
    if not raw_text:
        return None

    lowered = raw_text.lower()
    split_match = re.split(r"\b(?:vs|versus|against)\b", raw_text, maxsplit=1, flags=re.IGNORECASE)
    if len(split_match) == 2:
        left_candidates = _extract_explicit_ticker_candidates(split_match[0])
        right_candidates = _extract_explicit_ticker_candidates(split_match[1])
        if left_candidates and right_candidates:
            pair = [left_candidates[-1], right_candidates[0]]
            if pair[0] != pair[1]:
                return pair

    between_match = re.search(r"\bbetween\b(?P<left>.+?)\band\b(?P<right>.+)", raw_text, flags=re.IGNORECASE)
    if between_match:
        left_candidates = _extract_explicit_ticker_candidates(between_match.group("left"))
        right_candidates = _extract_explicit_ticker_candidates(between_match.group("right"))
        if left_candidates and right_candidates:
            pair = [left_candidates[-1], right_candidates[0]]
            if pair[0] != pair[1]:
                return pair

    if "compare" in lowered and any(marker in lowered for marker in (" vs ", " versus ", " against ")):
        candidates = _extract_explicit_ticker_candidates(raw_text)
        if len(candidates) == 2 and candidates[0] != candidates[1]:
            return candidates

    return None


def _replay_ticker_state(messages: List[Dict[str, str]]) -> Dict[str, Optional[str]]:
    active_ticker: Optional[str] = None
    final_status: Optional[str] = None
    for message in _meaningful_user_messages(messages):
        resolution = _resolve_latest_ticker(message["content"], active_ticker)
        active_ticker = _normalize_ticker(resolution.get("resolvedTicker"))
        final_status = resolution.get("status")
    return {
        "resolvedTicker": active_ticker,
        "status": final_status or "detached",
    }


def _compute_effective_chat_ticker(messages: List[Dict[str, str]]) -> Optional[str]:
    return _normalize_ticker(_replay_ticker_state(messages).get("resolvedTicker"))


def _artifact_matches_chat_ticker(
    session: Session,
    clerk_user_id: str,
    latest_artifact_id: Optional[uuid.UUID],
    attached_ticker: Optional[str],
) -> bool:
    if not latest_artifact_id:
        return True
    artifact = session.get(Deliverable, latest_artifact_id)
    if artifact is None or artifact.clerk_user_id != clerk_user_id:
        return False
    return artifact.ticker == _normalize_ticker(attached_ticker)


def _reconcile_chat_row(
    session: Session,
    clerk_user_id: str,
    row: MarketMindAiChat,
    *,
    normalized_messages: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    message_rows = None
    if normalized_messages is None:
        message_rows = session.scalars(
            select(MarketMindAiChatMessage)
            .where(
                MarketMindAiChatMessage.chat_id == row.id,
                MarketMindAiChatMessage.clerk_user_id == clerk_user_id,
            )
            .order_by(MarketMindAiChatMessage.sort_order.asc(), MarketMindAiChatMessage.created_at.asc())
        ).all()
        normalized_messages = [
            {"role": message_row.role, "content": message_row.content}
            for message_row in message_rows
        ]

    replayed_state = _replay_ticker_state(normalized_messages or [])
    effective_ticker = _normalize_ticker(replayed_state.get("resolvedTicker"))
    if not effective_ticker and replayed_state.get("status") != "ambiguous":
        effective_ticker = _normalize_ticker(row.attached_ticker)
    if row.attached_ticker != effective_ticker:
        row.attached_ticker = effective_ticker

    if row.latest_artifact_id and not _artifact_matches_chat_ticker(session, clerk_user_id, row.latest_artifact_id, row.attached_ticker):
        row.latest_artifact_id = None

    session.flush()

    return {
        "row": row,
        "messages": normalized_messages,
        "messageRows": message_rows,
    }


def _normalize_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    for item in messages or []:
        role = str((item or {}).get("role") or "").strip().lower()
        content = str((item or {}).get("content") or "").strip()
        if role not in {"user", "assistant", "system"} or not content:
            continue
        normalized.append({"role": role, "content": content})
    return normalized[-16:]


def _meaningful_user_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    return [
        message
        for message in messages
        if message["role"] == "user" and len(message["content"].strip()) >= 12
    ]


def _artifact_summary(row: Deliverable, latest_version: Optional[int] = None) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "templateKey": row.template_key,
        "ticker": row.ticker,
        "title": row.title,
        "status": row.status,
        "latestVersion": latest_version,
        "createdAt": _serialize_timestamp(row.created_at),
        "updatedAt": _serialize_timestamp(row.updated_at),
    }


def _artifact_version_payload(row: DeliverableMemo) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "version": row.version,
        "modelSlug": row.model_slug,
        "generationStatus": row.generation_status,
        "structuredContent": dict(row.structured_content_json or {}),
        "mimeType": row.mime_type,
        "hasArtifact": bool(row.docx_blob),
        "createdAt": _serialize_timestamp(row.created_at),
        "errorMessage": row.error_message,
    }


def _chat_title_from_messages(messages: List[Dict[str, str]]) -> str:
    first_user_message = next((message["content"] for message in messages if message["role"] == "user"), "")
    cleaned = " ".join(first_user_message.split()).strip()
    if not cleaned:
        return "New chat"
    if len(cleaned) <= 72:
        return cleaned
    return cleaned[:69].rstrip() + "..."


def _chat_preview_from_messages(messages: List[Dict[str, str]]) -> Optional[str]:
    if not messages:
        return None
    cleaned = " ".join(messages[-1]["content"].split()).strip()
    if not cleaned:
        return None
    if len(cleaned) <= 140:
        return cleaned
    return cleaned[:137].rstrip() + "..."


def _chat_summary(row: MarketMindAiChat) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "title": row.title,
        "attachedTicker": row.attached_ticker,
        "lastMessagePreview": row.last_message_preview,
        "latestArtifactId": str(row.latest_artifact_id) if row.latest_artifact_id else None,
        "createdAt": _serialize_timestamp(row.created_at),
        "updatedAt": _serialize_timestamp(row.updated_at),
    }


def _chat_message_payload(row: MarketMindAiChatMessage) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "role": row.role,
        "content": row.content,
        "createdAt": _serialize_timestamp(row.created_at),
    }


def _context_has_grounding(context: Dict[str, Any]) -> bool:
    return bool(
        context.get("predictionSnapshot")
        or context.get("recentNews")
        or context.get("fundamentalsSummary", {}).get("companyName")
        or context.get("secFilingsSummary", {}).get("type")
        or context.get("filingChangeSummary", {}).get("comparisonForm")
        or context.get("insiderActivitySummary")
        or context.get("beneficialOwnershipSummary")
        or context.get("cryptoQuote")
        or context.get("watchlistMembership")
        or context.get("activeAlerts")
        or context.get("paperTradeHistory")
        or context.get("currentPaperPosition", {}).get("shares")
    )


def _compact_context_summary(context: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not context:
        return None
    prediction = context.get("predictionSnapshot") or {}
    fundamentals = context.get("fundamentalsSummary") or {}
    sec_filing = context.get("secFilingsSummary") or {}
    filing_change = context.get("filingChangeSummary") or {}
    insider_activity = context.get("insiderActivitySummary") or []
    beneficial_ownership = context.get("beneficialOwnershipSummary") or []
    crypto_quote = context.get("cryptoQuote") or {}
    return {
        "ticker": context.get("ticker"),
        "assetId": context.get("assetId"),
        "market": context.get("market") or "US",
        "assetType": context.get("assetType") or "equity",
        "watchlistMembership": bool(context.get("watchlistMembership")),
        "activeAlerts": len(context.get("activeAlerts") or []),
        "paperTradeCount": len(context.get("paperTradeHistory") or []),
        "hasPosition": bool((context.get("currentPaperPosition") or {}).get("shares")),
        "predictionHeadline": (
            f"${prediction.get('recentPredicted')} predicted vs ${prediction.get('recentClose')} close"
            if prediction.get("recentPredicted") is not None and prediction.get("recentClose") is not None
            else None
        ),
        "companyName": fundamentals.get("companyName"),
        "sector": fundamentals.get("sector"),
        "latestSecFiling": (
            f"{sec_filing.get('type')} filed {sec_filing.get('date')}"
            if sec_filing.get("type") and sec_filing.get("date")
            else None
        ),
        "filingChangeHeadline": (
            f"{filing_change.get('comparisonForm')} changes in {len(filing_change.get('sectionChanges') or [])} section(s)"
            if filing_change.get("comparisonForm")
            else None
        ),
        "insiderActivityCount": len(insider_activity),
        "beneficialOwnershipCount": len(beneficial_ownership),
        "quoteHeadline": (
            f"{crypto_quote.get('fromCrypto', {}).get('code')} spot {crypto_quote.get('exchangeRate')}"
            if crypto_quote.get("exchangeRate") is not None
            else None
        ),
        "newsCount": len(context.get("recentNews") or []),
    }


CONTEXT_DENIAL_PATTERNS = (
    "i don't have access to real-time market data",
    "i do not have access to real-time market data",
    "i don't have access to ticker context",
    "i do not have access to ticker context",
    "no ticker is attached",
    "if you attach",
    "if a ticker were attached",
    "if available in the app",
    "until then, i cannot",
)


def _response_claims_missing_context(text: Optional[str]) -> bool:
    normalized = str(text or "").lower()
    if not normalized:
        return False
    if any(pattern in normalized for pattern in CONTEXT_DENIAL_PATTERNS):
        return True
    return bool(
        re.search(r"\b(?:do not|don't|cannot|can't)\b.{0,50}\bticker context\b", normalized)
        or re.search(r"\bno\b.{0,20}\bticker context\b", normalized)
    )


def _last_meaningful_user_text(messages: List[Dict[str, str]]) -> str:
    meaningful = _meaningful_user_messages(messages)
    return meaningful[-1]["content"] if meaningful else ""


def _user_requested_directional_lean(text: str) -> bool:
    lowered = str(text or "").lower()
    return any(
        phrase in lowered
        for phrase in (
            "buy/sell/hold",
            "buy sell hold",
            "buy or sell",
            "buy, sell, or hold",
            "is it a buy",
            "should i buy",
            "should i sell",
        )
    )


def _prediction_based_lean(context: Optional[Dict[str, Any]]) -> tuple[Optional[str], Optional[str]]:
    prediction = (context or {}).get("predictionSnapshot") or {}
    recent_close = prediction.get("recentClose")
    recent_predicted = prediction.get("recentPredicted")
    if recent_close in (None, 0) or recent_predicted is None:
        return None, None
    try:
        delta_pct = (float(recent_predicted) - float(recent_close)) / float(recent_close)
    except Exception:
        return None, None

    if delta_pct >= 0.03:
        lean = "lean buy"
    elif delta_pct <= -0.03:
        lean = "lean sell"
    else:
        lean = "lean hold"

    rationale = (
        f"the current prediction snapshot points to {recent_predicted} versus a recent close of {recent_close} "
        f"({delta_pct * 100:.1f}% spread)"
    )
    return lean, rationale


def _build_grounded_fallback_reply(
    *,
    attached_ticker: str,
    context: Dict[str, Any],
    messages: List[Dict[str, str]],
) -> str:
    asset_type = context.get("assetType") or "equity"
    fundamentals = context.get("fundamentalsSummary") or {}
    prediction = context.get("predictionSnapshot") or {}
    news_items = context.get("recentNews") or []
    sec_filing = context.get("secFilingsSummary") or {}
    filing_change = context.get("filingChangeSummary") or {}
    insider_activity = context.get("insiderActivitySummary") or []
    beneficial_ownership = context.get("beneficialOwnershipSummary") or []
    quote = context.get("cryptoQuote") or {}
    current_position = context.get("currentPaperPosition") or {}

    asset_name = (
        context.get("assetName")
        or fundamentals.get("companyName")
        or context.get("cryptoSymbol")
        or attached_ticker
    )

    lines = [
        f"I do have MarketMind context attached for **{attached_ticker}** ({asset_name}). Here is the grounded setup from the current session:",
        "",
    ]
    bullets: List[str] = []

    if asset_type == "crypto":
        if quote.get("exchangeRate") is not None:
            bullets.append(
                f"Crypto quote context: **${quote.get('exchangeRate'):,.2f}** spot for {quote.get('fromCrypto', {}).get('code') or asset_name}."
            )
        else:
            bullets.append("MarketMind recognizes this as a cryptocurrency, but live quote data is limited right now.")
    elif fundamentals.get("companyName"):
        sector = fundamentals.get("sector") or "Unknown sector"
        bullets.append(f"Fundamentals context: **{fundamentals.get('companyName')}** in **{sector}**.")

    if prediction.get("recentPredicted") is not None and prediction.get("recentClose") is not None:
        confidence = prediction.get("confidence")
        confidence_clause = f" with **{confidence}%** confidence" if confidence is not None else ""
        bullets.append(
            f"Prediction snapshot: **${prediction.get('recentPredicted')}** predicted versus **${prediction.get('recentClose')}** recent close{confidence_clause}."
        )
    else:
        bullets.append("Prediction snapshot: no model forecast is attached to this chat right now.")

    if news_items:
        bullets.append(
            f"Recent news: **{len(news_items)}** headline(s) in context; latest is “{news_items[0].get('title', 'Untitled headline')}”."
        )
    else:
        bullets.append("Recent news: no fresh headlines are attached to this chat right now.")

    if sec_filing.get("type") and sec_filing.get("date"):
        section_titles = [section.get("title") for section in (sec_filing.get("sections") or []) if section.get("title")]
        section_suffix = f" covering {', '.join(section_titles)}" if section_titles else ""
        bullets.append(
            f"SEC filing context: latest attached filing is **{sec_filing.get('type')}** from **{sec_filing.get('date')}**{section_suffix}."
        )

    if filing_change.get("comparisonForm"):
        changed_sections = filing_change.get("sectionChanges") or []
        if changed_sections:
            section_titles = ", ".join(
                section.get("title") for section in changed_sections[:3] if section.get("title")
            )
            bullets.append(
                f"SEC change watch: the latest **{filing_change.get('comparisonForm')}** differs from the prior filing across **{len(changed_sections)}** section(s)"
                + (f", including {section_titles}." if section_titles else ".")
            )

    if insider_activity:
        latest_insider = insider_activity[0]
        insider_name = latest_insider.get("insiderName") or "Recent insider"
        activity = latest_insider.get("activity") or latest_insider.get("type") or "filing"
        bullets.append(
            f"Insider activity: **{insider_name}** filed a recent **{latest_insider.get('type') or 'Form 4'}** tagged as **{activity}**."
        )

    if beneficial_ownership:
        latest_owner = beneficial_ownership[0]
        owner_names = ", ".join(latest_owner.get("owners") or [])
        percent = latest_owner.get("ownershipPercent")
        percent_clause = f" at roughly **{percent:.1f}%** ownership" if percent is not None else ""
        bullets.append(
            f"Major holder context: recent **{latest_owner.get('type') or '13D/13G'}** disclosure"
            + (f" from **{owner_names}**" if owner_names else "")
            + percent_clause
            + "."
        )

    if context.get("watchlistMembership") or context.get("activeAlerts"):
        bullets.append(
            f"Workspace context: tracked={bool(context.get('watchlistMembership'))}, active alerts={len(context.get('activeAlerts') or [])}."
        )

    if current_position.get("shares"):
        bullets.append(
            f"Paper position: current MarketMind paper portfolio holds **{current_position.get('shares')}** shares/units."
        )

    lines.extend(f"- {bullet}" for bullet in bullets)

    if _user_requested_directional_lean(_last_meaningful_user_text(messages)):
        lean, rationale = _prediction_based_lean(context)
        lines.extend(["", "**Context-based lean:**"])
        if lean and rationale:
            lines.append(f"- **{lean}** because {rationale}.")
        else:
            lines.append("- The current MarketMind context is enough to summarize the setup, but not enough to make a clean buy/sell/hold call from app data alone.")
        lines.append("- This is not personalized advice; it is only the directional read supported by the attached MarketMind context.")

    return "\n".join(lines)


def _build_compare_chat_messages(
    messages: List[Dict[str, str]],
    compare_pair: List[str],
    compare_contexts: List[Dict[str, Any]],
    mode: Optional[str],
) -> List[Dict[str, str]]:
    assembled = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    assembled.append(
        {
            "role": "system",
            "content": (
                "Comparison mode is active. Compare the two attached assets using MarketMind context only. "
                "Do not refuse due to missing ticker context because comparison context is already attached. "
                "If the user asks buy/sell/hold, offer a relative or conditional lean grounded only in the supplied data.\n"
                f"Mode: {str(mode or 'general').strip().lower()}\n"
                f"Compare pair: {compare_pair[0]} vs {compare_pair[1]}\n"
                f"Contexts JSON:\n{json.dumps(compare_contexts, indent=2)}"
            ),
        }
    )
    assembled.extend(messages)
    return assembled


def _build_grounded_compare_reply(
    *,
    compare_pair: List[str],
    compare_contexts: List[Dict[str, Any]],
    messages: List[Dict[str, str]],
) -> str:
    lines = [
        f"I do have MarketMind comparison context attached for **{compare_pair[0]}** and **{compare_pair[1]}**. Here is the grounded setup from the current session:",
    ]

    for context in compare_contexts:
        ticker = context.get("ticker") or "Asset"
        asset_name = (
            context.get("assetName")
            or (context.get("fundamentalsSummary") or {}).get("companyName")
            or ticker
        )
        prediction = context.get("predictionSnapshot") or {}
        news_items = context.get("recentNews") or []
        quote = context.get("cryptoQuote") or {}
        lines.extend(["", f"**{ticker} ({asset_name})**"])
        if quote.get("exchangeRate") is not None:
            lines.append(f"- Spot quote context: **${quote.get('exchangeRate'):,.2f}**.")
        if prediction.get("recentPredicted") is not None and prediction.get("recentClose") is not None:
            lines.append(
                f"- Prediction snapshot: **${prediction.get('recentPredicted')}** predicted vs **${prediction.get('recentClose')}** recent close."
            )
        else:
            lines.append("- Prediction snapshot: unavailable in the current context.")
        if news_items:
            lines.append(f"- Recent news: **{len(news_items)}** headline(s); latest is “{news_items[0].get('title', 'Untitled headline')}”.")
        else:
            lines.append("- Recent news: no fresh headlines are attached right now.")
        fundamentals = context.get("fundamentalsSummary") or {}
        if fundamentals.get("sector"):
            lines.append(f"- Sector context: **{fundamentals.get('sector')}**.")

    if _user_requested_directional_lean(_last_meaningful_user_text(messages)):
        lean_pairs = [
            (context.get("ticker") or "Asset",) + _prediction_based_lean(context)
            for context in compare_contexts
        ]
        valid_leans = [item for item in lean_pairs if item[1] and item[2]]
        lines.extend(["", "**Relative lean:**"])
        if valid_leans:
            for ticker, lean, rationale in valid_leans:
                lines.append(f"- **{ticker}: {lean}** because {rationale}.")
        else:
            lines.append("- The attached comparison context is enough to compare the setups, but not enough to turn it into a clean directional ranking from app data alone.")
        lines.append("- This is not personalized advice; it is only the relative read supported by the attached MarketMind context.")

    return "\n".join(lines)


def _ensure_grounded_completion(
    *,
    ai_messages: List[Dict[str, str]],
    completion: Dict[str, Any],
    attached_ticker: Optional[str],
    context: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if not attached_ticker or not context:
        return completion
    if not _response_claims_missing_context(completion.get("assistant_text")):
        return completion

    corrective_messages = [
        *ai_messages,
        {
            "role": "system",
            "content": (
                f"You already have authoritative MarketMind context for {attached_ticker}. "
                "Revise your answer using that attached context. Do not claim the context is missing. "
                "If the user asks buy/sell/hold, give a clearly labeled conditional lean instead of refusing outright."
            ),
        },
    ]
    retried_completion = create_chat_completion(messages=corrective_messages, model=DEFAULT_OPENROUTER_MODEL)
    if not _response_claims_missing_context(retried_completion.get("assistant_text")):
        return retried_completion

    return {
        "model": retried_completion.get("model") or DEFAULT_OPENROUTER_MODEL,
        "assistant_text": _build_grounded_fallback_reply(
            attached_ticker=attached_ticker,
            context=context,
            messages=ai_messages,
        ),
    }


def _ensure_grounded_compare_completion(
    *,
    ai_messages: List[Dict[str, str]],
    completion: Dict[str, Any],
    compare_pair: List[str],
    compare_contexts: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not compare_pair or not compare_contexts:
        return completion
    if not _response_claims_missing_context(completion.get("assistant_text")):
        return completion

    corrective_messages = [
        *ai_messages,
        {
            "role": "system",
            "content": (
                f"You already have authoritative MarketMind comparison context for {compare_pair[0]} and {compare_pair[1]}. "
                "Revise your answer using that attached comparison context. Do not claim the context is missing."
            ),
        },
    ]
    retried_completion = create_chat_completion(messages=corrective_messages, model=DEFAULT_OPENROUTER_MODEL)
    if not _response_claims_missing_context(retried_completion.get("assistant_text")):
        return retried_completion

    return {
        "model": retried_completion.get("model") or DEFAULT_OPENROUTER_MODEL,
        "assistant_text": _build_grounded_compare_reply(
            compare_pair=compare_pair,
            compare_contexts=compare_contexts,
            messages=ai_messages,
        ),
    }


def _infer_suggested_actions(messages: List[Dict[str, str]], attached_ticker: Optional[str]) -> List[Dict[str, str]]:
    if not attached_ticker or not _meaningful_user_messages(messages):
        return []
    last_user_message = _meaningful_user_messages(messages)[-1]["content"].lower()
    keywords = (
        "memo",
        "thesis memo",
        "investment memo",
        "brief",
        "one-pager",
        "report",
        "write this up",
    )
    if any(keyword in last_user_message for keyword in keywords):
        return [
            {
                "type": "generate_artifact",
                "templateKey": TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
                "label": "Generate Investment Thesis Memo",
            }
        ]
    return []


def _infer_artifact_intent(messages: List[Dict[str, str]], attached_ticker: Optional[str]) -> Optional[Dict[str, Any]]:
    if not attached_ticker or not _meaningful_user_messages(messages):
        return None
    last_user_message = _meaningful_user_messages(messages)[-1]["content"].lower()
    auto_generate_phrases = (
        "generate a memo",
        "generate memo",
        "write a memo",
        "create a memo",
        "investment thesis memo",
        "write this up",
        "turn this into a memo",
    )
    if any(phrase in last_user_message for phrase in auto_generate_phrases):
        return {
            "templateKey": TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
            "label": "Investment Thesis Memo",
            "autoGenerate": True,
        }
    return None


def _build_chat_messages(
    messages: List[Dict[str, str]],
    attached_ticker: Optional[str],
    context: Optional[Dict[str, Any]],
    mode: Optional[str],
    ticker_resolution: Optional[Dict[str, Optional[str]]] = None,
) -> List[Dict[str, str]]:
    assembled = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    mode_label = str(mode or "general").strip().lower()
    resolution_status = (ticker_resolution or {}).get("status")
    if resolution_status == "ambiguous":
        assembled.append(
            {
                "role": "system",
                "content": (
                    "The latest user message references multiple tickers. "
                    "Do not choose one on your own. Ask the user which single ticker should be attached "
                    "for MarketMind-grounded analysis before giving a ticker-specific answer."
                ),
            }
        )
    elif attached_ticker:
        assembled.append(
            {
                "role": "system",
                "content": (
                    "Attached MarketMind ticker context is available. Treat it as the authoritative application context.\n"
                    f"Mode: {mode_label}\n"
                    f"Ticker: {attached_ticker}\n"
                    f"Context JSON:\n{json.dumps(context or {}, indent=2)}"
                ),
            }
        )
    else:
        assembled.append(
            {
                "role": "system",
                "content": (
                    "No ticker is attached. You can still answer general questions about markets, investing workflows, "
                    "and how to use MarketMind, but do not pretend app-specific ticker context exists."
                ),
            }
        )
    assembled.extend(messages)
    return assembled


def _build_artifact_prompt_payload(
    *,
    attached_ticker: str,
    artifact_title: str,
    messages: List[Dict[str, str]],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    transcript = [
        {"role": message["role"], "content": message["content"]}
        for message in messages
    ]
    return {
        "template": TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
        "title": artifact_title,
        "ticker": attached_ticker,
        "instructions": [
            "Draft a serious investment thesis memo using the attached MarketMind conversation and MarketMind ticker context.",
            "Use only the information in the transcript and attached application context.",
            "If the evidence is mixed or incomplete, say so directly instead of inventing certainty.",
            "Keep the tone analytical, calm, and useful for personal investment review.",
        ],
        "conversationTranscript": transcript,
        "marketMindContext": context,
    }


def _build_artifact_messages(prompt_payload: Dict[str, Any]) -> List[Dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are drafting an investment thesis memo for MarketMindAI. "
                "Use the provided conversation and MarketMind context only. "
                "Return JSON only and follow the schema exactly."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create an Investment Thesis Memo from the following MarketMindAI session.\n\n"
                f"{json.dumps(prompt_payload, indent=2)}"
            ),
        },
    ]


def _next_artifact_version(session: Session, artifact_id: uuid.UUID) -> int:
    current_max = session.scalar(
        select(func.max(DeliverableMemo.version)).where(DeliverableMemo.deliverable_id == artifact_id)
    )
    return int(current_max or 0) + 1


def _artifact_row_for_user(session: Session, clerk_user_id: str, artifact_id: str) -> Deliverable:
    artifact_uuid = _coerce_uuid(artifact_id, field_name="artifact identifier")
    row = session.scalar(
        select(Deliverable).where(
            Deliverable.id == artifact_uuid,
            Deliverable.clerk_user_id == clerk_user_id,
            Deliverable.template_key == TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
        )
    )
    if row is None:
        raise MarketMindAIError("Artifact not found", status_code=404)
    return row


def _artifact_version_for_user(
    session: Session,
    clerk_user_id: str,
    artifact_id: str,
    version_id: str,
) -> DeliverableMemo:
    row = _artifact_row_for_user(session, clerk_user_id, artifact_id)
    version_uuid = _coerce_uuid(version_id, field_name="artifact version identifier")
    version = session.scalar(
        select(DeliverableMemo).where(
            DeliverableMemo.id == version_uuid,
            DeliverableMemo.deliverable_id == row.id,
        )
    )
    if version is None:
        raise MarketMindAIError("Artifact version not found", status_code=404)
    return version


def _chat_row_for_user(session: Session, clerk_user_id: str, chat_id: str) -> MarketMindAiChat:
    chat_uuid = _coerce_uuid(chat_id, field_name="chat identifier")
    row = session.scalar(
        select(MarketMindAiChat).where(
            MarketMindAiChat.id == chat_uuid,
            MarketMindAiChat.clerk_user_id == clerk_user_id,
        )
    )
    if row is None:
        raise MarketMindAIError("Chat not found", status_code=404)
    return row


def list_marketmind_ai_chats(session: Session, clerk_user_id: str) -> List[Dict[str, Any]]:
    rows = session.scalars(
        select(MarketMindAiChat)
        .where(MarketMindAiChat.clerk_user_id == clerk_user_id)
        .order_by(MarketMindAiChat.updated_at.desc(), MarketMindAiChat.created_at.desc())
        .limit(20)
    ).all()
    summaries = []
    for row in rows:
        repaired = _reconcile_chat_row(session, clerk_user_id, row)
        summaries.append(_chat_summary(repaired["row"]))
    return summaries


def get_marketmind_ai_chat_detail(session: Session, clerk_user_id: str, chat_id: str) -> Dict[str, Any]:
    row = _chat_row_for_user(session, clerk_user_id, chat_id)
    repaired = _reconcile_chat_row(session, clerk_user_id, row)
    message_rows = repaired["messageRows"] or []
    return {
        "chat": _chat_summary(repaired["row"]),
        "messages": [_chat_message_payload(message_row) for message_row in message_rows],
    }


def delete_marketmind_ai_chat(session: Session, clerk_user_id: str, chat_id: str) -> None:
    row = _chat_row_for_user(session, clerk_user_id, chat_id)
    session.execute(
        delete(MarketMindAiChatMessage).where(
            MarketMindAiChatMessage.chat_id == row.id,
            MarketMindAiChatMessage.clerk_user_id == clerk_user_id,
        )
    )
    session.delete(row)
    session.flush()


def save_marketmind_ai_chat_state(
    session: Session,
    clerk_user_id: str,
    *,
    messages: List[Dict[str, str]],
    attached_ticker: Optional[str] = None,
    chat_id: Optional[str] = None,
    latest_artifact_id: Optional[str] = None,
    skip_message_ticker_resolution: bool = False,
) -> Dict[str, Any]:
    normalized_messages = _normalize_messages(messages)
    now = utcnow()
    resolved_ticker = (
        _normalize_ticker(attached_ticker)
        if skip_message_ticker_resolution
        else (_compute_effective_chat_ticker(normalized_messages) or _normalize_ticker(attached_ticker))
    )

    if chat_id:
        row = _chat_row_for_user(session, clerk_user_id, chat_id)
    else:
        row = MarketMindAiChat(
            clerk_user_id=clerk_user_id,
            title="New chat",
            attached_ticker=None,
            last_message_preview=None,
            latest_artifact_id=None,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()

    if latest_artifact_id:
        row.latest_artifact_id = _coerce_uuid(latest_artifact_id, field_name="artifact identifier")

    row.title = _chat_title_from_messages(normalized_messages)
    row.attached_ticker = resolved_ticker
    row.last_message_preview = _chat_preview_from_messages(normalized_messages)
    row.updated_at = now

    session.execute(
        delete(MarketMindAiChatMessage).where(
            MarketMindAiChatMessage.chat_id == row.id,
            MarketMindAiChatMessage.clerk_user_id == clerk_user_id,
        )
    )
    for index, message in enumerate(normalized_messages):
        session.add(
            MarketMindAiChatMessage(
                chat_id=row.id,
                clerk_user_id=clerk_user_id,
                sort_order=index,
                role=message["role"],
                content=message["content"],
                created_at=now,
            )
        )

    if row.latest_artifact_id and not _artifact_matches_chat_ticker(session, clerk_user_id, row.latest_artifact_id, row.attached_ticker):
        row.latest_artifact_id = None

    session.flush()
    return _chat_summary(row)


def _default_artifact_title(ticker: str) -> str:
    return f"{ticker} Investment Thesis Memo"


def _artifact_market_supported(ticker: Optional[str]) -> bool:
    normalized_ticker = _normalize_ticker(ticker)
    if not normalized_ticker or _is_crypto_ticker(normalized_ticker):
        return bool(normalized_ticker)
    try:
        asset = parse_asset_reference(normalized_ticker)
    except Exception:
        return True
    return asset.get("market") == "US"


def _ensure_ai_configured() -> None:
    if not os.getenv("OPENROUTER_API_KEY", "").strip():
        raise MarketMindAIError("MarketMindAI is not configured yet.", status_code=503)


def get_bootstrap_payload() -> Dict[str, Any]:
    return {
        "aiAvailable": bool(os.getenv("OPENROUTER_API_KEY", "").strip()),
        "starterPrompts": STARTER_PROMPTS,
        "templates": ARTIFACT_TEMPLATES,
        "defaultTemplateKey": TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
    }


def _is_crypto_ticker(ticker: str) -> bool:
    normalized_ticker = _normalize_ticker(ticker)
    if not normalized_ticker:
        return False
    if normalized_ticker.endswith("-USD"):
        base_symbol = normalized_ticker[:-4]
        return base_symbol in CRYPTO_INFO
    return normalized_ticker in CRYPTO_INFO


def _build_crypto_context_payload(normalized_ticker: str) -> Dict[str, Any]:
    base_symbol = normalized_ticker[:-4] if normalized_ticker.endswith("-USD") else normalized_ticker
    crypto_info = CRYPTO_INFO.get(base_symbol, {})
    crypto_quote = get_crypto_exchange_rate(base_symbol, "USD")
    fundamentals = _fundamentals_summary(normalized_ticker) or {}
    fundamentals.setdefault("companyName", crypto_info.get("name") or base_symbol)
    fundamentals.setdefault("sector", "Cryptocurrency")
    fundamentals.setdefault("industry", "Digital Asset")
    fundamentals.setdefault(
        "summary",
        f"{crypto_info.get('name') or base_symbol} is tracked inside MarketMind as a cryptocurrency quoted against USD.",
    )
    normalized_quote = None
    if crypto_quote:
        normalized_quote = {
            "fromCrypto": crypto_quote.get("from_crypto") or {},
            "toCurrency": crypto_quote.get("to_currency") or {},
            "exchangeRate": crypto_quote.get("exchange_rate"),
            "bidPrice": crypto_quote.get("bid_price"),
            "askPrice": crypto_quote.get("ask_price"),
            "lastRefreshed": crypto_quote.get("last_refreshed"),
            "timezone": crypto_quote.get("timezone"),
        }

    return {
        "assetType": "crypto",
        "assetName": crypto_info.get("name") or base_symbol,
        "cryptoSymbol": base_symbol,
        "cryptoQuote": normalized_quote,
        "fundamentalsSummary": fundamentals,
    }


def build_marketmind_ai_context(
    session: Session,
    clerk_user_id: str,
    ticker: str,
    *,
    market: Optional[str] = None,
) -> Dict[str, Any]:
    normalized_ticker = _normalize_ticker(ticker, market=market)
    if not normalized_ticker:
        raise MarketMindAIError("Ticker is required", status_code=400)

    asset = None
    if not _is_crypto_ticker(normalized_ticker):
        try:
            asset = parse_asset_reference(normalized_ticker, market)
        except Exception as exc:
            raise MarketMindAIError("Invalid market-qualified ticker.", status_code=400) from exc

    watchlist = load_watchlist(session, clerk_user_id)
    notifications = load_notifications(session, clerk_user_id)
    portfolio = load_portfolio(session, clerk_user_id)

    active_alerts = [
        alert
        for alert in notifications.get("active", [])
        if str(alert.get("ticker", "")).upper() == normalized_ticker
    ]
    paper_trade_history = [
        trade
        for trade in portfolio.get("trade_history", [])[-50:]
        if str(trade.get("ticker", "")).upper() == normalized_ticker
    ][-10:]
    current_position = dict((portfolio.get("positions") or {}).get(normalized_ticker) or {})
    base_context = {
        "ticker": normalized_ticker,
        "assetId": asset["assetId"] if asset else normalized_ticker,
        "market": asset["market"] if asset else "US",
        "exchange": asset["exchange"] if asset else None,
        "assetType": "crypto" if _is_crypto_ticker(normalized_ticker) else "equity",
        "watchlistMembership": normalized_ticker in watchlist,
        "activeAlerts": active_alerts,
        "predictionSnapshot": None,
        "recentNews": [],
        "fundamentalsSummary": {},
        "paperTradeHistory": paper_trade_history,
        "currentPaperPosition": current_position,
    }
    if _is_crypto_ticker(normalized_ticker):
        base_context["predictionSnapshot"] = _prediction_snapshot(normalized_ticker)
        base_context["recentNews"] = _recent_news(normalized_ticker)
        base_context["fundamentalsSummary"] = _fundamentals_summary(normalized_ticker)
        base_context.update(_build_crypto_context_payload(normalized_ticker))
    elif asset and asset["market"] in {"HK", "CN"}:
        try:
            international_context = akshare_service.get_equity_ai_context(asset["assetId"])
        except akshare_service.AkshareUnavailableError as exc:
            raise MarketMindAIError(str(exc), status_code=503) from exc
        except akshare_service.AkshareAssetNotFoundError as exc:
            raise MarketMindAIError(str(exc), status_code=404) from exc
        base_context["assetName"] = international_context.get("assetName")
        base_context["recentNews"] = international_context.get("recentNews") or []
        base_context["fundamentalsSummary"] = international_context.get("fundamentalsSummary") or {}
        base_context["companyResearchSummary"] = international_context.get("companyResearch") or {}
    else:
        base_context["predictionSnapshot"] = _prediction_snapshot(normalized_ticker)
        base_context["recentNews"] = _recent_news(normalized_ticker)
        base_context["fundamentalsSummary"] = _fundamentals_summary(normalized_ticker)
        try:
            sec_intelligence = sec_filings_service.get_company_sec_intelligence(normalized_ticker)
        except Exception:
            sec_intelligence = {}
        sec_filing_summary = sec_intelligence.get("latestAnnualOrQuarterly")
        if sec_filing_summary:
            base_context["secFilingsSummary"] = sec_filing_summary
        if sec_intelligence.get("filingChangeSummary"):
            base_context["filingChangeSummary"] = sec_intelligence["filingChangeSummary"]
        if sec_intelligence.get("insiderActivity"):
            base_context["insiderActivitySummary"] = sec_intelligence["insiderActivity"]
        if sec_intelligence.get("beneficialOwnership"):
            base_context["beneficialOwnershipSummary"] = sec_intelligence["beneficialOwnership"]
    return base_context


def generate_marketmind_ai_reply(
    session: Session,
    clerk_user_id: str,
    *,
    messages: List[Dict[str, Any]],
    attached_ticker: Optional[str] = None,
    chat_id: Optional[str] = None,
    mode: Optional[str] = None,
) -> Dict[str, Any]:
    _ensure_ai_configured()
    normalized_messages = _normalize_messages(messages)
    if not _meaningful_user_messages(normalized_messages):
        raise MarketMindAIError("Add a meaningful user message before sending chat.", status_code=400)

    previous_ticker = None
    if chat_id:
        existing_chat = _chat_row_for_user(session, clerk_user_id, chat_id)
        repaired_chat = _reconcile_chat_row(session, clerk_user_id, existing_chat)
        previous_ticker = repaired_chat["row"].attached_ticker
    else:
        previous_ticker = _normalize_ticker(attached_ticker)

    latest_user_message = _meaningful_user_messages(normalized_messages)[-1]["content"]
    compare_pair = _infer_compare_pair(latest_user_message)
    if compare_pair:
        compare_contexts = [
            build_marketmind_ai_context(session, clerk_user_id, compare_pair[0]),
            build_marketmind_ai_context(session, clerk_user_id, compare_pair[1]),
        ]
        ai_messages = _build_compare_chat_messages(normalized_messages, compare_pair, compare_contexts, mode)
        completion = create_chat_completion(messages=ai_messages, model=DEFAULT_OPENROUTER_MODEL)
        completion = _ensure_grounded_compare_completion(
            ai_messages=ai_messages,
            completion=completion,
            compare_pair=compare_pair,
            compare_contexts=compare_contexts,
        )
        assistant_message = {
            "role": "assistant",
            "content": completion["assistant_text"],
        }
        chat_summary = save_marketmind_ai_chat_state(
            session,
            clerk_user_id,
            messages=[*normalized_messages, assistant_message],
            attached_ticker=None,
            chat_id=chat_id,
            skip_message_ticker_resolution=True,
        )
        return {
            "assistantMessage": assistant_message,
            "chat": chat_summary,
            "contextSummary": None,
            "comparePair": compare_pair,
            "compareContextSummary": [_compact_context_summary(context) for context in compare_contexts],
            "suggestedActions": [],
            "artifactIntent": None,
            "tickerResolution": {
                "resolvedTicker": None,
                "previousTicker": previous_ticker,
                "status": "compare",
            },
        }

    ticker_resolution = _resolve_latest_ticker(latest_user_message, previous_ticker)
    ticker = _normalize_ticker(ticker_resolution.get("resolvedTicker"))
    context = build_marketmind_ai_context(session, clerk_user_id, ticker) if ticker else None
    ai_messages = _build_chat_messages(normalized_messages, ticker, context, mode, ticker_resolution=ticker_resolution)
    completion = create_chat_completion(messages=ai_messages, model=DEFAULT_OPENROUTER_MODEL)
    completion = _ensure_grounded_completion(
        ai_messages=ai_messages,
        completion=completion,
        attached_ticker=ticker,
        context=context,
    )
    artifact_intent = _infer_artifact_intent(normalized_messages, ticker)
    assistant_message = {
        "role": "assistant",
        "content": completion["assistant_text"],
    }
    chat_summary = save_marketmind_ai_chat_state(
        session,
        clerk_user_id,
        messages=[*normalized_messages, assistant_message],
        attached_ticker=ticker,
        chat_id=chat_id,
    )
    return {
        "assistantMessage": assistant_message,
        "chat": chat_summary,
        "contextSummary": _compact_context_summary(context),
        "suggestedActions": [] if artifact_intent and artifact_intent.get("autoGenerate") else _infer_suggested_actions(normalized_messages, ticker),
        "artifactIntent": artifact_intent,
        "tickerResolution": ticker_resolution,
    }


def create_artifact_preflight(
    session: Session,
    clerk_user_id: str,
    *,
    template_key: Optional[str],
    messages: List[Dict[str, Any]],
    attached_ticker: Optional[str],
) -> Dict[str, Any]:
    resolved_template = str(template_key or TEMPLATE_KEY_INVESTMENT_THESIS_MEMO).strip()
    if resolved_template not in VALID_TEMPLATE_KEYS:
        raise MarketMindAIError("Unsupported artifact template", status_code=400)

    normalized_messages = _normalize_messages(messages)
    ticker = _normalize_ticker(attached_ticker)
    context = build_marketmind_ai_context(session, clerk_user_id, ticker) if ticker else None
    required_items: List[Dict[str, str]] = []

    if not ticker:
        required_items.append(
            {
                "field": "attachedTicker",
                "message": "Attach a ticker before generating an Investment Thesis Memo.",
            }
        )

    if not _meaningful_user_messages(normalized_messages):
        required_items.append(
            {
                "field": "messages",
                "message": "Add at least one meaningful user message before generating a memo.",
            }
        )

    if ticker and not _context_has_grounding(context or {}):
        required_items.append(
            {
                "field": "context",
                "message": "MarketMind needs enough ticker context to ground the memo.",
            }
        )

    if ticker and not _artifact_market_supported(ticker):
        required_items.append(
            {
                "field": "attachedTicker",
                "message": "International Akshare tickers are available for read-only AI research in phase 1, but memo artifacts remain US-only for now.",
            }
        )

    return {
        "status": "ready" if not required_items else "blocked",
        "requiredItems": required_items,
        "contextSummary": _compact_context_summary(context),
    }


def list_marketmind_ai_artifacts(session: Session, clerk_user_id: str) -> List[Dict[str, Any]]:
    rows = session.scalars(
        select(Deliverable)
        .where(
            Deliverable.clerk_user_id == clerk_user_id,
            Deliverable.template_key == TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
        )
        .order_by(Deliverable.updated_at.desc(), Deliverable.created_at.desc())
    ).all()
    if not rows:
        return []

    artifact_ids = [row.id for row in rows]
    memo_rows = session.scalars(
        select(DeliverableMemo)
        .where(DeliverableMemo.deliverable_id.in_(artifact_ids))
        .order_by(DeliverableMemo.deliverable_id.asc(), DeliverableMemo.version.desc())
    ).all()
    latest_versions: Dict[str, int] = {}
    for memo in memo_rows:
        latest_versions.setdefault(str(memo.deliverable_id), memo.version)

    return [_artifact_summary(row, latest_versions.get(str(row.id))) for row in rows]


def get_marketmind_ai_artifact_detail(
    session: Session,
    clerk_user_id: str,
    artifact_id: str,
) -> Dict[str, Any]:
    row = _artifact_row_for_user(session, clerk_user_id, artifact_id)
    versions = session.scalars(
        select(DeliverableMemo)
        .where(DeliverableMemo.deliverable_id == row.id)
        .order_by(DeliverableMemo.version.desc(), DeliverableMemo.created_at.desc())
    ).all()
    latest_version = versions[0].version if versions else None
    return {
        "artifact": _artifact_summary(row, latest_version),
        "versions": [_artifact_version_payload(version) for version in versions],
    }


def generate_marketmind_ai_artifact(
    session: Session,
    clerk_user_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    _ensure_ai_configured()
    template_key = str(payload.get("templateKey") or TEMPLATE_KEY_INVESTMENT_THESIS_MEMO).strip()
    normalized_messages = _normalize_messages(payload.get("messages") or [])
    attached_ticker = _normalize_ticker(payload.get("attachedTicker"))
    artifact_id = payload.get("artifactId")
    chat_id = payload.get("chatId")

    preflight = create_artifact_preflight(
        session,
        clerk_user_id,
        template_key=template_key,
        messages=normalized_messages,
        attached_ticker=attached_ticker,
    )
    if preflight["status"] != "ready":
        raise MarketMindAIError(
            "Artifact generation is blocked until the workspace is ready.",
            status_code=409,
            payload={"preflight": preflight},
        )

    context = build_marketmind_ai_context(session, clerk_user_id, attached_ticker)
    now = utcnow()
    artifact_row: Deliverable

    if artifact_id:
        artifact_row = _artifact_row_for_user(session, clerk_user_id, artifact_id)
        if artifact_row.ticker != attached_ticker:
            raise MarketMindAIError(
                "Attached ticker does not match the selected artifact.",
                status_code=409,
            )
    else:
        artifact_row = Deliverable(
            clerk_user_id=clerk_user_id,
            template_key=TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
            ticker=attached_ticker,
            title=_default_artifact_title(attached_ticker),
            status="draft",
            memo_audience="personal investment review",
            created_at=now,
            updated_at=now,
        )
        session.add(artifact_row)
        session.flush()

    version_number = _next_artifact_version(session, artifact_row.id)
    prompt_payload = _build_artifact_prompt_payload(
        attached_ticker=attached_ticker,
        artifact_title=artifact_row.title,
        messages=normalized_messages,
        context=context,
    )
    prompt_messages = _build_artifact_messages(prompt_payload)

    try:
        ai_result = create_structured_completion(
            messages=prompt_messages,
            json_schema=MEMO_JSON_SCHEMA,
            schema_name=TEMPLATE_KEY_INVESTMENT_THESIS_MEMO,
            model=DEFAULT_OPENROUTER_MODEL,
        )
        structured_content = ai_result["structured_content"]
        artifact_bytes = _render_docx(
            {
                "title": artifact_row.title,
                "ticker": artifact_row.ticker,
                "status": artifact_row.status,
                "timeHorizon": None,
            },
            structured_content,
        )
        version = DeliverableMemo(
            deliverable_id=artifact_row.id,
            version=version_number,
            model_slug=ai_result["model"],
            generation_status="completed",
            prompt_snapshot_json={"messages": prompt_messages, "sourceMessages": normalized_messages},
            context_snapshot_json=context,
            structured_content_json=structured_content,
            docx_blob=artifact_bytes,
            mime_type=DOCX_MIME_TYPE,
            created_at=utcnow(),
            error_message=None,
        )
        session.add(version)
        artifact_row.updated_at = utcnow()
        session.flush()
        chat_summary = None
        if chat_id:
            chat_summary = save_marketmind_ai_chat_state(
                session,
                clerk_user_id,
                messages=normalized_messages,
                attached_ticker=attached_ticker,
                chat_id=chat_id,
                latest_artifact_id=str(artifact_row.id),
            )
        return {
            "artifact": _artifact_summary(artifact_row, version.version),
            "version": _artifact_version_payload(version),
            "chat": chat_summary,
        }
    except Exception as exc:
        failed_version = DeliverableMemo(
            deliverable_id=artifact_row.id,
            version=version_number,
            model_slug=DEFAULT_OPENROUTER_MODEL,
            generation_status="failed",
            prompt_snapshot_json={"messages": prompt_messages, "sourceMessages": normalized_messages},
            context_snapshot_json=context,
            structured_content_json={},
            docx_blob=None,
            mime_type=None,
            created_at=utcnow(),
            error_message=str(exc),
        )
        session.add(failed_version)
        artifact_row.updated_at = utcnow()
        session.flush()
        chat_summary = None
        if chat_id:
            chat_summary = save_marketmind_ai_chat_state(
                session,
                clerk_user_id,
                messages=normalized_messages,
                attached_ticker=attached_ticker,
                chat_id=chat_id,
                latest_artifact_id=str(artifact_row.id),
            )
        failed_payload = {
            "artifact": _artifact_summary(artifact_row, failed_version.version),
            "version": _artifact_version_payload(failed_version),
            "chat": chat_summary,
        }
        failed_payload["_statusCode"] = 502
        return failed_payload


def get_marketmind_ai_artifact_download(
    session: Session,
    clerk_user_id: str,
    artifact_id: str,
    version_id: str,
) -> Dict[str, Any]:
    artifact = _artifact_row_for_user(session, clerk_user_id, artifact_id)
    version = _artifact_version_for_user(session, clerk_user_id, artifact_id, version_id)
    if not version.docx_blob:
        raise MarketMindAIError("Artifact file is not available for this version.", status_code=404)
    return {
        "filename": f"{artifact.ticker.lower()}-investment-thesis-memo-v{version.version}.docx",
        "mimeType": version.mime_type or DOCX_MIME_TYPE,
        "bytes": version.docx_blob,
    }
