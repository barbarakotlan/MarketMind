from __future__ import annotations

import copy
import hashlib
import importlib
import os
import re
from collections import OrderedDict
from threading import RLock
from typing import Any, Dict, Iterable, List, Optional


TRUE_VALUES = {"1", "true", "yes", "on"}
SUPPORTED_LABELS = {"positive", "neutral", "negative"}
DEFAULT_MODEL_ID = "ProsusAI/finbert"
DEFAULT_BATCH_SIZE = 8
DEFAULT_CACHE_MAX_ENTRIES = 5000
LOW_CONFIDENCE_NEUTRAL_THRESHOLD = 0.55

_RUNTIME_LOCK = RLock()
_CLASSIFIER = None
_CLASSIFIER_MODEL_ID = None
_CLASSIFIER_ERROR = None
_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


def reset_sentiment_runtime_state() -> None:
    global _CLASSIFIER, _CLASSIFIER_MODEL_ID, _CLASSIFIER_ERROR
    with _RUNTIME_LOCK:
        _CLASSIFIER = None
        _CLASSIFIER_MODEL_ID = None
        _CLASSIFIER_ERROR = None
        _CACHE.clear()


def is_enabled() -> bool:
    return str(os.getenv("SENTIMENT_INTELLIGENCE_ENABLED", "false")).strip().lower() in TRUE_VALUES


def get_model_id() -> str:
    return str(os.getenv("SENTIMENT_MODEL_ID", DEFAULT_MODEL_ID)).strip() or DEFAULT_MODEL_ID


def get_batch_size() -> int:
    try:
        return max(int(os.getenv("SENTIMENT_BATCH_SIZE", str(DEFAULT_BATCH_SIZE))), 1)
    except (TypeError, ValueError):
        return DEFAULT_BATCH_SIZE


def get_cache_max_entries() -> int:
    try:
        return max(int(os.getenv("SENTIMENT_CACHE_MAX_ENTRIES", str(DEFAULT_CACHE_MAX_ENTRIES))), 1)
    except (TypeError, ValueError):
        return DEFAULT_CACHE_MAX_ENTRIES


def _cache_key(model_id: str, normalized_text: str) -> str:
    digest = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()
    return f"{model_id}:{digest}"


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    with _RUNTIME_LOCK:
        cached = _CACHE.get(key)
        if cached is None:
            return None
        _CACHE.move_to_end(key)
        return copy.deepcopy(cached)


def _cache_set(key: str, value: Dict[str, Any]) -> Dict[str, Any]:
    with _RUNTIME_LOCK:
        _CACHE[key] = copy.deepcopy(value)
        _CACHE.move_to_end(key)
        while len(_CACHE) > get_cache_max_entries():
            _CACHE.popitem(last=False)
    return copy.deepcopy(value)


def _unavailable(reason: str) -> Dict[str, Any]:
    return {"status": "unavailable", "reason": str(reason)}


def _normalize_whitespace(text: Any) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", str(text or "")).strip()


def _normalize_multiline_text(text: Any) -> str:
    value = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t\f\v]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _latin_ratio(text: str) -> float:
    alphabetic_chars = [char for char in text if char.isalpha()]
    if not alphabetic_chars:
        return 0.0
    latin_count = sum(1 for char in alphabetic_chars if ("A" <= char <= "Z") or ("a" <= char <= "z"))
    return latin_count / len(alphabetic_chars)


def _is_english_like(text: str) -> bool:
    compact = re.sub(r"\s+", "", text)
    if len(compact) < 20:
        return False
    return _latin_ratio(text) >= 0.6


def _get_classifier():
    global _CLASSIFIER, _CLASSIFIER_MODEL_ID, _CLASSIFIER_ERROR
    if not is_enabled():
        return None

    model_id = get_model_id()
    with _RUNTIME_LOCK:
        if _CLASSIFIER is not None and _CLASSIFIER_MODEL_ID == model_id:
            return _CLASSIFIER

        try:
            transformers_module = importlib.import_module("transformers")
            _CLASSIFIER = transformers_module.pipeline(
                "text-classification",
                model=model_id,
                tokenizer=model_id,
                return_all_scores=True,
            )
            _CLASSIFIER_MODEL_ID = model_id
            _CLASSIFIER_ERROR = None
        except Exception as exc:
            _CLASSIFIER = None
            _CLASSIFIER_MODEL_ID = model_id
            _CLASSIFIER_ERROR = str(exc)
        return _CLASSIFIER


def _normalize_pipeline_scores(result: Any) -> Dict[str, float]:
    rows = result
    if isinstance(rows, list) and rows and isinstance(rows[0], list):
        rows = rows[0]
    elif isinstance(rows, dict):
        rows = [rows]

    scores = {label: 0.0 for label in SUPPORTED_LABELS}
    for item in rows or []:
        raw_label = str((item or {}).get("label") or "").strip().lower()
        label = raw_label.replace("label_", "")
        if label in SUPPORTED_LABELS:
            try:
                scores[label] = float(item.get("score") or 0.0)
            except (TypeError, ValueError):
                scores[label] = 0.0
    return scores


def _display_label(scores: Dict[str, float]) -> tuple[str, float]:
    winning_label = max(scores, key=scores.get)
    confidence = float(scores.get(winning_label) or 0.0)
    if confidence < LOW_CONFIDENCE_NEUTRAL_THRESHOLD:
        return "neutral", confidence
    return winning_label, confidence


def _scored_payload(scores: Dict[str, float]) -> Dict[str, Any]:
    label, confidence = _display_label(scores)
    return {
        "status": "scored",
        "label": label,
        "confidence": round(confidence, 4),
        "scores": {
            "positive": round(float(scores.get("positive") or 0.0), 4),
            "neutral": round(float(scores.get("neutral") or 0.0), 4),
            "negative": round(float(scores.get("negative") or 0.0), 4),
        },
    }


def score_text(text: Any, *, max_chars: int = 600) -> Dict[str, Any]:
    if not is_enabled():
        return _unavailable("disabled")

    normalized_text = _normalize_whitespace(text)
    if max_chars > 0:
        normalized_text = normalized_text[:max_chars].strip()
    if len(re.sub(r"\s+", "", normalized_text)) < 20:
        return _unavailable("text_too_short")
    if not _is_english_like(normalized_text):
        return _unavailable("non_english_text")

    model_id = get_model_id()
    cache_key = _cache_key(model_id, normalized_text)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    classifier = _get_classifier()
    if classifier is None:
        return _unavailable(_CLASSIFIER_ERROR or "model_unavailable")

    try:
        result = classifier(normalized_text, truncation=True, max_length=512)
    except Exception as exc:
        return _unavailable(f"scoring_failed:{exc}")

    payload = _scored_payload(_normalize_pipeline_scores(result))
    return _cache_set(cache_key, payload)


def _chunk_text(
    text: Any,
    *,
    target_size: int = 700,
    hard_max: int = 900,
    overlap: int = 150,
    max_chunks: int = 8,
) -> List[str]:
    normalized = _normalize_multiline_text(text)
    if not normalized:
        return []
    if len(normalized) <= hard_max:
        return [normalized]

    chunks: List[str] = []
    start = 0
    length = len(normalized)
    preferred_floor = max(int(target_size), 1)
    hard_ceiling = max(int(hard_max), preferred_floor)
    overlap_chars = max(int(overlap), 0)

    while start < length and len(chunks) < max(int(max_chunks), 1):
        max_end = min(start + hard_ceiling, length)
        end = max_end
        if max_end < length:
            search_start = min(start + preferred_floor, max_end)
            window = normalized[search_start:max_end]
            break_candidates = [
                window.rfind("\n\n"),
                window.rfind("\n"),
                window.rfind(". "),
                window.rfind("? "),
                window.rfind("! "),
            ]
            best_break = max(break_candidates)
            if best_break > 0:
                end = search_start + best_break + 1
        end = max(end, start + 1)
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= length:
            break
        next_start = max(end - overlap_chars, start + 1)
        if next_start <= start:
            next_start = end
        start = next_start

    return chunks


def score_long_text(
    text: Any,
    *,
    target_size: int = 700,
    hard_max: int = 900,
    overlap: int = 150,
    max_chunks: int = 8,
) -> Dict[str, Any]:
    chunks = _chunk_text(
        text,
        target_size=target_size,
        hard_max=hard_max,
        overlap=overlap,
        max_chunks=max_chunks,
    )
    if not chunks:
        return _unavailable("text_too_short")

    weighted_scores = {label: 0.0 for label in SUPPORTED_LABELS}
    total_weight = 0
    saw_scored_chunk = False

    for chunk in chunks[:max_chunks]:
        sentiment = score_text(chunk, max_chars=hard_max)
        if sentiment.get("status") != "scored":
            continue
        weight = max(len(chunk), 1)
        saw_scored_chunk = True
        total_weight += weight
        for label in SUPPORTED_LABELS:
            weighted_scores[label] += float((sentiment.get("scores") or {}).get(label) or 0.0) * weight

    if not saw_scored_chunk or total_weight <= 0:
        return _unavailable("model_unavailable")

    averaged_scores = {label: weighted_scores[label] / total_weight for label in SUPPORTED_LABELS}
    return _scored_payload(averaged_scores)


def _annotate_collection(
    items: Iterable[Dict[str, Any]],
    scorer_fn,
) -> List[Dict[str, Any]]:
    annotated: List[Dict[str, Any]] = []
    for item in items or []:
        row = dict(item or {})
        row["sentiment"] = scorer_fn(row)
        annotated.append(row)
    return annotated


def score_news_item(item: Dict[str, Any]) -> Dict[str, Any]:
    title = _normalize_whitespace(item.get("title") or item.get("headline"))
    summary = _normalize_whitespace(item.get("summary") or item.get("description"))
    combined = " ".join(part for part in [title, summary] if part).strip()
    return score_text(combined, max_chars=600)


def annotate_news_items(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return _annotate_collection(items, score_news_item)


def score_announcement_item(item: Dict[str, Any]) -> Dict[str, Any]:
    title = _normalize_whitespace(item.get("title"))
    description = _normalize_whitespace(item.get("description"))
    combined = " ".join(part for part in [title, description] if part).strip()
    return score_text(combined, max_chars=600)


def annotate_announcement_items(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return _annotate_collection(items, score_announcement_item)


def annotate_sec_sections(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def score_section(item: Dict[str, Any]) -> Dict[str, Any]:
        return score_long_text(item.get("text"), target_size=700, hard_max=900, overlap=150, max_chunks=8)

    return _annotate_collection(items, score_section)


def annotate_filing_section_changes(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    annotated: List[Dict[str, Any]] = []
    for item in items or []:
        row = dict(item or {})
        row["currentSentiment"] = score_text(row.get("currentExcerpt"), max_chars=600)
        row["previousSentiment"] = score_text(row.get("previousExcerpt"), max_chars=600)
        annotated.append(row)
    return annotated


def summarize_sentiments(
    sentiments: Iterable[Optional[Dict[str, Any]]],
    *,
    source_types: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    scored_items = [
        item
        for item in (sentiments or [])
        if isinstance(item, dict) and item.get("status") == "scored" and isinstance(item.get("scores"), dict)
    ]
    if not scored_items:
        return None

    aggregate_scores = {label: 0.0 for label in SUPPORTED_LABELS}
    for item in scored_items:
        for label in SUPPORTED_LABELS:
            aggregate_scores[label] += float(item["scores"].get(label) or 0.0)

    count = len(scored_items)
    averaged_scores = {label: aggregate_scores[label] / count for label in SUPPORTED_LABELS}
    payload = _scored_payload(averaged_scores)
    payload["scoredCount"] = count
    if source_types:
        payload["sourceTypes"] = [source for source in source_types if source]
    return payload


def summarize_collection(
    items: Iterable[Dict[str, Any]],
    *,
    sentiment_key: str = "sentiment",
    source_types: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    return summarize_sentiments(
        [
            (item or {}).get(sentiment_key)
            for item in (items or [])
        ],
        source_types=source_types,
    )


def merge_summaries(summaries: Iterable[Optional[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
    weighted_sentiments: List[Dict[str, Any]] = []
    for summary in summaries or []:
        if not isinstance(summary, dict) or summary.get("status") != "scored":
            continue
        repeat = max(int(summary.get("scoredCount") or 1), 1)
        weighted_sentiments.extend([summary] * repeat)
    return summarize_sentiments(weighted_sentiments)
