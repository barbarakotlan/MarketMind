from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, Iterable, List, Optional

import akshare_service


TARGET_CHUNK_CHARS = 900
MAX_CHUNK_CHARS = 1200
CHUNK_OVERLAP_CHARS = 150


def _normalize_text(value: Any) -> str:
    text = str(value or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _normalize_snippet(value: Any, *, limit: int = 320) -> str:
    text = re.sub(r"\s+", " ", _normalize_text(value))
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _chunk_text(text: str) -> List[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []
    if len(normalized) <= MAX_CHUNK_CHARS:
        return [normalized]

    paragraphs = [part.strip() for part in normalized.split("\n\n") if part.strip()]
    if not paragraphs:
        paragraphs = [normalized]

    chunks: List[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if current and len(candidate) > TARGET_CHUNK_CHARS:
            chunks.append(current)
            overlap = current[-CHUNK_OVERLAP_CHARS:].strip()
            current = f"{overlap}\n\n{paragraph}".strip() if overlap else paragraph
        else:
            current = candidate
        while len(current) > MAX_CHUNK_CHARS:
            window = current[:MAX_CHUNK_CHARS]
            chunks.append(window.rstrip())
            current = current[MAX_CHUNK_CHARS - CHUNK_OVERLAP_CHARS :].strip()
    if current:
        chunks.append(current)
    return [chunk for chunk in chunks if chunk.strip()]


def _point_id(source_type: str, source_id: str, chunk_index: int, version: str) -> str:
    stable_key = f"{source_type}:{source_id}:{chunk_index}:{version}"
    return hashlib.sha1(stable_key.encode("utf-8")).hexdigest()


def _documents_hash(documents: Iterable[Dict[str, Any]]) -> str:
    payload = json.dumps(list(documents), sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _base_payload(
    *,
    scope: str,
    clerk_user_id: Optional[str],
    asset_id: str,
    ticker: str,
    market: str,
    asset_type: str,
    doc_type: str,
    source: str,
    source_id: str,
    title: Optional[str],
    section_key: Optional[str],
    published_at: Optional[str],
    source_url: Optional[str],
    language: str,
    version: str,
) -> Dict[str, Any]:
    return {
        "scope": scope,
        "clerkUserId": clerk_user_id,
        "assetId": asset_id,
        "ticker": ticker,
        "market": market,
        "assetType": asset_type,
        "docType": doc_type,
        "source": source,
        "sourceId": source_id,
        "title": title,
        "sectionKey": section_key,
        "publishedAt": published_at,
        "sourceUrl": source_url,
        "language": language,
        "version": version,
    }


def _expand_to_chunks(document: Dict[str, Any]) -> List[Dict[str, Any]]:
    text = _normalize_text(document.get("text"))
    if not text:
        return []
    chunks = _chunk_text(text)
    chunk_count = len(chunks)
    payload_base = dict(document["payload"])
    payload_base["chunkCount"] = chunk_count
    expanded = []
    for index, chunk_text in enumerate(chunks):
        payload = dict(payload_base)
        payload["chunkIndex"] = index
        payload["text"] = chunk_text
        payload["snippet"] = _normalize_snippet(chunk_text)
        expanded.append(
            {
                "id": _point_id(
                    payload["docType"],
                    payload["sourceId"],
                    index,
                    payload.get("version") or "v1",
                ),
                "text": chunk_text,
                "payload": payload,
            }
        )
    return expanded


def _single_chunk_document(
    *,
    scope: str,
    clerk_user_id: Optional[str],
    asset_id: str,
    ticker: str,
    market: str,
    asset_type: str,
    doc_type: str,
    source: str,
    source_id: str,
    title: Optional[str],
    text: str,
    section_key: Optional[str] = None,
    published_at: Optional[str] = None,
    source_url: Optional[str] = None,
    language: str = "en",
    version: str = "v1",
) -> List[Dict[str, Any]]:
    payload = _base_payload(
        scope=scope,
        clerk_user_id=clerk_user_id,
        asset_id=asset_id,
        ticker=ticker,
        market=market,
        asset_type=asset_type,
        doc_type=doc_type,
        source=source,
        source_id=source_id,
        title=title,
        section_key=section_key,
        published_at=published_at,
        source_url=source_url,
        language=language,
        version=version,
    )
    return _expand_to_chunks({"payload": payload, "text": text})


def _build_sec_documents(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    asset_id = context.get("assetId") or context.get("ticker") or ""
    ticker = context.get("ticker") or asset_id
    market = context.get("market") or "US"
    docs: List[Dict[str, Any]] = []

    filing = context.get("secFilingsSummary") or {}
    filing_type = filing.get("type")
    filing_date = filing.get("date")
    filing_url = filing.get("url")
    for section in filing.get("sections") or []:
        section_text = section.get("text")
        if not section_text:
            continue
        docs.extend(
            _single_chunk_document(
                scope="global",
                clerk_user_id=None,
                asset_id=asset_id,
                ticker=ticker,
                market=market,
                asset_type="equity",
                doc_type="sec_section",
                source="sec",
                source_id=f"{filing.get('accessionNumber') or filing_type}:{section.get('key')}",
                title=f"{filing_type or 'SEC filing'} · {section.get('title') or section.get('key')}",
                text=section_text,
                section_key=section.get("key"),
                published_at=filing_date,
                source_url=filing_url,
                language="en",
                version=f"{filing.get('accessionNumber') or filing_date or 'latest'}",
            )
        )

    filing_change = context.get("filingChangeSummary") or {}
    for section_change in filing_change.get("sectionChanges") or []:
        change_text = "\n".join(
            part
            for part in [
                f"Status: {section_change.get('status')}" if section_change.get("status") else None,
                section_change.get("currentExcerpt"),
                section_change.get("previousExcerpt"),
            ]
            if part
        )
        if not change_text:
            continue
        docs.extend(
            _single_chunk_document(
                scope="global",
                clerk_user_id=None,
                asset_id=asset_id,
                ticker=ticker,
                market=market,
                asset_type="equity",
                doc_type="filing_change",
                source="sec",
                source_id=f"{filing_change.get('comparisonForm') or 'filing-change'}:{section_change.get('key')}",
                title=f"{filing_change.get('comparisonForm') or 'Filing change'} · {section_change.get('title') or section_change.get('key')}",
                text=change_text,
                section_key=section_change.get("key"),
                published_at=(filing_change.get("currentFiling") or {}).get("date"),
                source_url=(filing_change.get("currentFiling") or {}).get("url"),
                language="en",
                version=str((filing_change.get("currentFiling") or {}).get("accessionNumber") or "latest"),
            )
        )

    for index, item in enumerate(context.get("insiderActivitySummary") or []):
        insider_name = item.get("insiderName") or "Insider"
        text = "\n".join(
            part
            for part in [
                f"Activity: {item.get('activity')}" if item.get("activity") else None,
                f"Form: {item.get('type')}" if item.get("type") else None,
                f"Date: {item.get('date')}" if item.get("date") else None,
                f"Shares: {item.get('shares')}" if item.get("shares") is not None else None,
            ]
            if part
        )
        if not text:
            continue
        docs.extend(
            _single_chunk_document(
                scope="global",
                clerk_user_id=None,
                asset_id=asset_id,
                ticker=ticker,
                market=market,
                asset_type="equity",
                doc_type="insider_activity",
                source="sec",
                source_id=f"insider:{index}:{insider_name}",
                title=f"Insider activity · {insider_name}",
                text=text,
                published_at=item.get("date"),
                source_url=item.get("url"),
                language="en",
                version="v1",
            )
        )

    for index, item in enumerate(context.get("beneficialOwnershipSummary") or []):
        owners = ", ".join(item.get("owners") or [])
        text = "\n".join(
            part
            for part in [
                f"Owners: {owners}" if owners else None,
                f"Disclosure: {item.get('type')}" if item.get("type") else None,
                f"Ownership percent: {item.get('ownershipPercent')}" if item.get("ownershipPercent") is not None else None,
                f"Date: {item.get('date')}" if item.get("date") else None,
            ]
            if part
        )
        if not text:
            continue
        docs.extend(
            _single_chunk_document(
                scope="global",
                clerk_user_id=None,
                asset_id=asset_id,
                ticker=ticker,
                market=market,
                asset_type="equity",
                doc_type="beneficial_ownership",
                source="sec",
                source_id=f"ownership:{index}:{owners or item.get('type') or 'owner'}",
                title=f"Beneficial ownership · {owners or item.get('type') or 'holder'}",
                text=text,
                published_at=item.get("date"),
                source_url=item.get("url"),
                language="en",
                version="v1",
            )
        )

    return docs


def _build_news_documents(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    asset_id = context.get("assetId") or context.get("ticker") or ""
    ticker = context.get("ticker") or asset_id
    market = context.get("market") or "US"
    language = "en" if market == "US" else "zh"
    docs: List[Dict[str, Any]] = []
    for index, item in enumerate(context.get("recentNews") or []):
        title = item.get("title")
        if not title:
            continue
        published_at = item.get("publishedAt") or item.get("publishTime")
        text = "\n".join(
            part
            for part in [
                title,
                f"Publisher: {item.get('publisher')}" if item.get("publisher") else None,
                f"Published: {published_at}" if published_at else None,
            ]
            if part
        )
        docs.extend(
            _single_chunk_document(
                scope="global",
                clerk_user_id=None,
                asset_id=asset_id,
                ticker=ticker,
                market=market,
                asset_type=context.get("assetType") or "equity",
                doc_type="news",
                source="news",
                source_id=f"news:{index}:{title}",
                title=title,
                text=text,
                published_at=published_at,
                source_url=item.get("link"),
                language=language,
                version="v1",
            )
        )
    return docs


def _build_company_research_documents(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    asset_id = context.get("assetId") or context.get("ticker") or ""
    ticker = context.get("ticker") or asset_id
    market = context.get("market") or "US"
    docs: List[Dict[str, Any]] = []
    company_research = context.get("companyResearchSummary") or {}
    profile_items = company_research.get("profile") or []
    if profile_items:
        profile_text = "\n".join(
            f"{item.get('label')}: {item.get('value')}"
            for item in profile_items
            if item.get("label") and item.get("value")
        )
        if profile_text:
            docs.extend(
                _single_chunk_document(
                    scope="global",
                    clerk_user_id=None,
                    asset_id=asset_id,
                    ticker=ticker,
                    market=market,
                    asset_type="equity",
                    doc_type="company_research",
                    source="akshare",
                    source_id=f"{asset_id}:profile",
                    title=f"{context.get('assetName') or ticker} company research",
                    text=profile_text,
                    language="zh",
                    version="v1",
                )
            )

    for index, item in enumerate(company_research.get("announcements") or []):
        title = item.get("title")
        if not title:
            continue
        text = "\n".join(
            part
            for part in [
                title,
                item.get("summary"),
                item.get("content"),
            ]
            if part
        )
        docs.extend(
            _single_chunk_document(
                scope="global",
                clerk_user_id=None,
                asset_id=asset_id,
                ticker=ticker,
                market=market,
                asset_type="equity",
                doc_type="announcement",
                source="akshare",
                source_id=f"{asset_id}:announcement:{index}:{title}",
                title=title,
                text=text or title,
                published_at=item.get("publishTime") or item.get("date"),
                source_url=item.get("link"),
                language="zh",
                version="v1",
            )
        )
    return docs


def _build_asia_macro_documents(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    if str(context.get("market") or "").upper() not in {"HK", "CN"}:
        return []
    try:
        payload = akshare_service.get_asia_macro_overview()
    except Exception:
        return []

    asset_id = context.get("assetId") or context.get("ticker") or ""
    ticker = context.get("ticker") or asset_id
    market = context.get("market") or "HK"
    docs: List[Dict[str, Any]] = []

    indicator_lines = [
        f"{item.get('name')}: {item.get('value')}{item.get('unit') or ''} as of {item.get('date') or 'latest'}"
        for item in (payload.get("indicators") or [])[:6]
        if item.get("name") and item.get("value") is not None
    ]
    signal_lines = [
        f"{item.get('name')}: {item.get('value')}{item.get('unit') or ''}"
        for item in (payload.get("marketSignals") or [])[:4]
        if item.get("name") and item.get("value") is not None
    ]
    macro_text = "\n".join(indicator_lines + signal_lines)
    if macro_text:
        docs.extend(
            _single_chunk_document(
                scope="global",
                clerk_user_id=None,
                asset_id=asset_id,
                ticker=ticker,
                market=market,
                asset_type="equity",
                doc_type="macro_brief",
                source="akshare_macro",
                source_id=f"{asset_id}:asia-macro",
                title="Asia macro backdrop",
                text=macro_text,
                language="en",
                version="v1",
            )
        )
    return docs


def build_global_documents(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    asset_type = context.get("assetType") or "equity"
    if asset_type != "equity":
        return []
    market = str(context.get("market") or "US").upper()
    docs: List[Dict[str, Any]] = []
    docs.extend(_build_news_documents(context))
    if market == "US":
        docs.extend(_build_sec_documents(context))
    elif market in {"HK", "CN"}:
        docs.extend(_build_company_research_documents(context))
        docs.extend(_build_asia_macro_documents(context))
    return docs


def build_user_memo_documents(
    *,
    clerk_user_id: str,
    ticker: str,
    asset_id: str,
    market: str,
    asset_type: str,
    memo_rows: Iterable[Any],
) -> List[Dict[str, Any]]:
    docs: List[Dict[str, Any]] = []
    normalized_market = str(market or "US").upper()
    normalized_ticker = str(ticker or asset_id or "").upper()
    normalized_asset_id = str(asset_id or normalized_ticker).upper()
    for row in memo_rows:
        version = str(getattr(row, "version", "v1"))
        row_id = str(getattr(row, "id", f"memo-{version}"))
        structured_content = dict(getattr(row, "structured_content_json", {}) or {})
        context_snapshot = dict(getattr(row, "context_snapshot_json", {}) or {})

        for section_key, value in structured_content.items():
            if isinstance(value, list):
                text = "\n".join(str(item).strip() for item in value if str(item).strip())
            else:
                text = str(value or "").strip()
            if not text:
                continue
            docs.extend(
                _single_chunk_document(
                    scope="user",
                    clerk_user_id=clerk_user_id,
                    asset_id=normalized_asset_id,
                    ticker=normalized_ticker,
                    market=normalized_market,
                    asset_type=asset_type,
                    doc_type="memo_section",
                    source="memo",
                    source_id=f"{row_id}:{section_key}",
                    title=f"Memo v{version} · {section_key.replace('_', ' ')}",
                    text=text,
                    section_key=section_key,
                    published_at=context_snapshot.get("generatedAt"),
                    language="en",
                    version=version,
                )
            )

        memo_context_lines = []
        fundamentals = context_snapshot.get("fundamentalsSummary") or {}
        if fundamentals.get("companyName"):
            memo_context_lines.append(f"Company: {fundamentals.get('companyName')}")
        if fundamentals.get("sector"):
            memo_context_lines.append(f"Sector: {fundamentals.get('sector')}")
        prediction = context_snapshot.get("predictionSnapshot") or {}
        if prediction.get("recentPredicted") is not None:
            memo_context_lines.append(
                f"Prediction: {prediction.get('recentPredicted')} vs close {prediction.get('recentClose')}"
            )
        for item in context_snapshot.get("retrievedEvidence") or []:
            if item.get("title"):
                memo_context_lines.append(
                    f"Evidence: {item.get('title')} — {item.get('snippet') or ''}".strip()
                )
        memo_context_text = "\n".join(line for line in memo_context_lines if line)
        if memo_context_text:
            docs.extend(
                _single_chunk_document(
                    scope="user",
                    clerk_user_id=clerk_user_id,
                    asset_id=normalized_asset_id,
                    ticker=normalized_ticker,
                    market=normalized_market,
                    asset_type=asset_type,
                    doc_type="memo_context",
                    source="memo",
                    source_id=f"{row_id}:context",
                    title=f"Memo v{version} context snapshot",
                    text=memo_context_text,
                    language="en",
                    version=version,
                )
            )
    return docs


def build_documents_digest(documents: Iterable[Dict[str, Any]]) -> str:
    simplified = [
        {
            "id": doc.get("id"),
            "payload": doc.get("payload"),
            "text": doc.get("text"),
        }
        for doc in documents
    ]
    return _documents_hash(simplified)
