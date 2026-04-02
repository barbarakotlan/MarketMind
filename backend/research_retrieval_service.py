from __future__ import annotations

import os
from threading import RLock
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

import research_document_builder
import research_embedding_service
import research_vector_store
from user_state_store import Deliverable, DeliverableMemo, utcnow


TRUE_VALUES = {"1", "true", "yes", "on"}

_SYNC_LOCK = RLock()
_GLOBAL_SYNC_STATE: Dict[str, Dict[str, Any]] = {}
_USER_SYNC_STATE: Dict[Tuple[str, str], Dict[str, Any]] = {}


class ResearchRetrievalError(Exception):
    pass


def reset_runtime_state() -> None:
    with _SYNC_LOCK:
        _GLOBAL_SYNC_STATE.clear()
        _USER_SYNC_STATE.clear()
    research_embedding_service.reset_runtime_state()
    research_vector_store.reset_runtime_state()


def is_enabled() -> bool:
    return str(os.getenv("RESEARCH_RETRIEVAL_ENABLED", "")).strip().lower() in TRUE_VALUES


def retrieval_top_k() -> int:
    try:
        return max(int(os.getenv("RETRIEVAL_TOP_K", "12")), 1)
    except ValueError:
        return 12


def retrieval_rerank_k() -> int:
    try:
        return max(int(os.getenv("RETRIEVAL_RERANK_K", "8")), 1)
    except ValueError:
        return 8


def _status(
    *,
    enabled: bool,
    available: bool,
    used: bool = False,
    reason: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    payload = {
        "enabled": enabled,
        "available": available,
        "used": used,
    }
    if reason:
        payload["reason"] = reason
    payload.update(extra)
    return payload


def _asset_key(context: Dict[str, Any]) -> str:
    return str(context.get("assetId") or context.get("ticker") or "").upper()


def _ticker_key(context: Dict[str, Any]) -> str:
    return str(context.get("ticker") or context.get("assetId") or "").upper()


def _asset_type(context: Dict[str, Any]) -> str:
    return str(context.get("assetType") or "equity").lower()


def _market(context: Dict[str, Any]) -> str:
    return str(context.get("market") or "US").upper()


def _preferred_doc_types(context: Dict[str, Any]) -> List[str]:
    market = _market(context)
    if market == "US":
        return [
            "sec_section",
            "filing_change",
            "insider_activity",
            "beneficial_ownership",
            "news",
            "memo_section",
            "memo_context",
        ]
    if market in {"HK", "CN"}:
        return [
            "announcement",
            "company_research",
            "news",
            "macro_brief",
            "memo_section",
            "memo_context",
        ]
    return ["news", "memo_section", "memo_context"]


def _doc_type_bonus(doc_type: str, preferred_doc_types: List[str]) -> float:
    if doc_type not in preferred_doc_types:
        return 0.0
    rank = preferred_doc_types.index(doc_type)
    return max(0.0, 0.25 - (rank * 0.03))


def _should_rerank(context: Dict[str, Any], candidates: List[Dict[str, Any]]) -> bool:
    if _market(context) != "US" or not candidates:
        return False
    languages = {
        str((item.get("payload") or {}).get("language") or "").lower()
        for item in candidates
        if item.get("payload")
    }
    return not languages or all(language.startswith("en") or not language for language in languages)


def _prepare_vector_documents(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not documents:
        return []
    vectors = research_embedding_service.encode_documents(doc["text"] for doc in documents)
    prepared = []
    for document, vector in zip(documents, vectors):
        prepared.append({**document, "vector": vector})
    return prepared


def _sync_global_documents(context: Dict[str, Any]) -> Dict[str, Any]:
    asset_key = _asset_key(context)
    documents = research_document_builder.build_global_documents(context)
    digest = research_document_builder.build_documents_digest(documents)
    with _SYNC_LOCK:
        cached = _GLOBAL_SYNC_STATE.get(asset_key)
        if cached and cached.get("digest") == digest:
            return dict(cached)

    if not documents:
        status = {
            "assetId": asset_key,
            "docCount": 0,
            "lastSyncedAt": utcnow().isoformat(),
            "digest": digest,
        }
        with _SYNC_LOCK:
            _GLOBAL_SYNC_STATE[asset_key] = status
        return dict(status)

    prepared_documents = _prepare_vector_documents(documents)
    vector_size = len(prepared_documents[0]["vector"])
    research_vector_store.upsert_documents("global", prepared_documents, vector_size)
    doc_count = research_vector_store.count_documents("global", must_filter={"assetId": asset_key})
    status = {
        "assetId": asset_key,
        "docCount": doc_count,
        "lastSyncedAt": utcnow().isoformat(),
        "digest": digest,
    }
    with _SYNC_LOCK:
        _GLOBAL_SYNC_STATE[asset_key] = status
    return dict(status)


def _memo_rows_for_context(session: Session, clerk_user_id: str, context: Dict[str, Any]) -> List[DeliverableMemo]:
    ticker = _ticker_key(context)
    return (
        session.scalars(
            select(DeliverableMemo)
            .join(Deliverable, Deliverable.id == DeliverableMemo.deliverable_id)
            .where(
                Deliverable.clerk_user_id == clerk_user_id,
                Deliverable.ticker == ticker,
            )
            .order_by(DeliverableMemo.created_at.desc(), DeliverableMemo.version.desc())
            .limit(8)
        ).all()
    )


def _sync_user_documents(session: Session, clerk_user_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
    asset_key = _asset_key(context)
    ticker = _ticker_key(context)
    memo_rows = _memo_rows_for_context(session, clerk_user_id, context)
    documents = research_document_builder.build_user_memo_documents(
        clerk_user_id=clerk_user_id,
        ticker=ticker,
        asset_id=asset_key,
        market=_market(context),
        asset_type=_asset_type(context),
        memo_rows=memo_rows,
    )
    digest = research_document_builder.build_documents_digest(documents)
    cache_key = (clerk_user_id, ticker)
    with _SYNC_LOCK:
        cached = _USER_SYNC_STATE.get(cache_key)
        if cached and cached.get("digest") == digest:
            return dict(cached)

    if not documents:
        status = {
            "assetId": asset_key,
            "ticker": ticker,
            "docCount": 0,
            "lastSyncedAt": utcnow().isoformat(),
            "digest": digest,
        }
        with _SYNC_LOCK:
            _USER_SYNC_STATE[cache_key] = status
        return dict(status)

    prepared_documents = _prepare_vector_documents(documents)
    vector_size = len(prepared_documents[0]["vector"])
    research_vector_store.upsert_documents("user", prepared_documents, vector_size)
    doc_count = research_vector_store.count_documents(
        "user",
        must_filter={"clerkUserId": clerk_user_id, "assetId": asset_key},
    )
    status = {
        "assetId": asset_key,
        "ticker": ticker,
        "docCount": doc_count,
        "lastSyncedAt": utcnow().isoformat(),
        "digest": digest,
    }
    with _SYNC_LOCK:
        _USER_SYNC_STATE[cache_key] = status
    return dict(status)


def _normalize_candidates(
    candidates: Iterable[Dict[str, Any]],
    *,
    preferred_doc_types: List[str],
) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for item in candidates:
        payload = dict(item.get("payload") or {})
        doc_type = str(payload.get("docType") or "")
        score = float(item.get("score") or 0.0)
        normalized.append(
            {
                **item,
                "payload": payload,
                "text": payload.get("text") or "",
                "scoreWithBonus": score + _doc_type_bonus(doc_type, preferred_doc_types),
            }
        )
    normalized.sort(key=lambda row: row.get("scoreWithBonus", 0.0), reverse=True)
    return normalized


def _evidence_payload(item: Dict[str, Any], *, rank: int) -> Dict[str, Any]:
    payload = item.get("payload") or {}
    return {
        "docType": payload.get("docType"),
        "title": payload.get("title"),
        "snippet": payload.get("snippet") or research_document_builder._normalize_snippet(payload.get("text")),
        "source": payload.get("source"),
        "sourceUrl": payload.get("sourceUrl"),
        "assetId": payload.get("assetId"),
        "ticker": payload.get("ticker"),
        "market": payload.get("market"),
        "score": round(float(item.get("rerankScore", item.get("scoreWithBonus", item.get("score", 0.0)))), 6),
        "rank": rank,
        "sectionKey": payload.get("sectionKey"),
    }


def _retrieve_candidates_for_context(
    session: Session,
    clerk_user_id: str,
    query_text: str,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    enabled = is_enabled()
    if not enabled:
        return {"evidence": [], "status": _status(enabled=False, available=False, reason="disabled")}
    if _asset_type(context) != "equity":
        return {"evidence": [], "status": _status(enabled=True, available=True, reason="unsupported_asset_type")}
    try:
        embedding_status = research_embedding_service.get_runtime_status()
        vector_status = research_vector_store.get_runtime_status()
        if not embedding_status.get("available"):
            return {"evidence": [], "status": _status(enabled=True, available=False, reason=embedding_status.get("reason"))}
        if not vector_status.get("available"):
            return {"evidence": [], "status": _status(enabled=True, available=False, reason=vector_status.get("reason"))}

        global_sync = _sync_global_documents(context)
        user_sync = _sync_user_documents(session, clerk_user_id, context)
        query_vector = research_embedding_service.encode_query(query_text)
        top_k = retrieval_top_k()
        preferred_doc_types = _preferred_doc_types(context)
        global_hits = research_vector_store.query_documents(
            "global",
            query_vector=query_vector,
            limit=top_k,
            must_filter={"assetId": _asset_key(context)},
        )
        user_hits = research_vector_store.query_documents(
            "user",
            query_vector=query_vector,
            limit=top_k,
            must_filter={"clerkUserId": clerk_user_id, "assetId": _asset_key(context)},
        )
        candidates = _normalize_candidates([*global_hits, *user_hits], preferred_doc_types=preferred_doc_types)
        rerank_used = False
        if _should_rerank(context, candidates):
            rerank_limit = min(retrieval_rerank_k(), len(candidates))
            reranked = research_embedding_service.rerank_documents(
                query=query_text,
                documents=candidates[:rerank_limit],
                allow_rerank=True,
            )
            candidates = reranked + candidates[rerank_limit:]
            candidates.sort(
                key=lambda item: (
                    float(item.get("rerankScore", float("-inf"))),
                    float(item.get("scoreWithBonus", item.get("score", 0.0))),
                ),
                reverse=True,
            )
            rerank_used = True
        evidence = [_evidence_payload(item, rank=index + 1) for index, item in enumerate(candidates[:6])]
        return {
            "evidence": evidence,
            "status": _status(
                enabled=True,
                available=True,
                used=bool(evidence),
                reason=None if evidence else "no_relevant_documents",
                globalSync=global_sync,
                userSync=user_sync,
                candidateCount=len(candidates),
                rerankUsed=rerank_used,
            ),
        }
    except Exception as exc:
        return {"evidence": [], "status": _status(enabled=True, available=False, reason=str(exc))}


def retrieve_for_context(
    session: Session,
    clerk_user_id: str,
    *,
    query_text: str,
    context: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if not context or not query_text.strip():
        return {"retrievedEvidence": [], "retrievalStatus": _status(enabled=is_enabled(), available=is_enabled(), reason="no_context")}
    result = _retrieve_candidates_for_context(session, clerk_user_id, query_text, context)
    return {
        "retrievedEvidence": result["evidence"],
        "retrievalStatus": result["status"],
    }


def retrieve_for_compare(
    session: Session,
    clerk_user_id: str,
    *,
    query_text: str,
    contexts: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not contexts or not query_text.strip():
        return {"retrievedEvidence": [], "retrievalStatus": _status(enabled=is_enabled(), available=is_enabled(), reason="no_context")}
    combined_evidence: List[Dict[str, Any]] = []
    grouped_status: List[Dict[str, Any]] = []
    for context in contexts:
        result = _retrieve_candidates_for_context(session, clerk_user_id, query_text, context)
        ticker = _ticker_key(context)
        grouped_status.append({"ticker": ticker, **result["status"]})
        for item in result["evidence"]:
            combined_evidence.append({**item, "ticker": ticker})
    combined_evidence.sort(key=lambda item: (item.get("ticker") or "", item.get("rank") or 9999))
    return {
        "retrievedEvidence": combined_evidence,
        "retrievalStatus": _status(
            enabled=is_enabled(),
            available=all(status.get("available") for status in grouped_status) if grouped_status else is_enabled(),
            used=bool(combined_evidence),
            compare=True,
            groups=grouped_status,
        ),
    }


def index_memo_version(
    *,
    clerk_user_id: str,
    ticker: str,
    context_snapshot: Dict[str, Any],
    memo_row: DeliverableMemo,
) -> Dict[str, Any]:
    if not is_enabled():
        return _status(enabled=False, available=False, reason="disabled")
    vector_status = research_vector_store.get_runtime_status()
    embedding_status = research_embedding_service.get_runtime_status()
    if not vector_status.get("available"):
        return _status(enabled=True, available=False, reason=vector_status.get("reason"))
    if not embedding_status.get("available"):
        return _status(enabled=True, available=False, reason=embedding_status.get("reason"))
    documents = research_document_builder.build_user_memo_documents(
        clerk_user_id=clerk_user_id,
        ticker=ticker,
        asset_id=str(context_snapshot.get("assetId") or ticker).upper(),
        market=str(context_snapshot.get("market") or "US").upper(),
        asset_type=str(context_snapshot.get("assetType") or "equity").lower(),
        memo_rows=[memo_row],
    )
    if not documents:
        return _status(enabled=True, available=True, reason="no_documents")
    prepared_documents = _prepare_vector_documents(documents)
    vector_size = len(prepared_documents[0]["vector"])
    upserted = research_vector_store.upsert_documents("user", prepared_documents, vector_size)
    cache_key = (clerk_user_id, str(ticker or "").upper())
    with _SYNC_LOCK:
        _USER_SYNC_STATE.pop(cache_key, None)
    return _status(enabled=True, available=True, used=bool(upserted), upserted=upserted)


def get_status_for_context(
    session: Session,
    clerk_user_id: str,
    *,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    enabled = is_enabled()
    if not enabled:
        return _status(enabled=False, available=False, reason="disabled")
    embedding_status = research_embedding_service.get_runtime_status()
    vector_status = research_vector_store.get_runtime_status()
    if not embedding_status.get("available"):
        return _status(enabled=True, available=False, reason=embedding_status.get("reason"))
    if not vector_status.get("available"):
        return _status(enabled=True, available=False, reason=vector_status.get("reason"))
    global_sync = _sync_global_documents(context)
    user_sync = _sync_user_documents(session, clerk_user_id, context)
    return _status(
        enabled=True,
        available=True,
        assetId=_asset_key(context),
        ticker=_ticker_key(context),
        globalCollection=research_vector_store.global_collection_name(),
        userCollection=research_vector_store.user_collection_name(),
        globalSync=global_sync,
        userSync=user_sync,
    )
