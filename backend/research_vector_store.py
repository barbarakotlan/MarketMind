from __future__ import annotations

import importlib
import os
from threading import RLock
from typing import Any, Dict, Iterable, List, Optional


DEFAULT_GLOBAL_COLLECTION = "marketmind_global_research_v1"
DEFAULT_USER_COLLECTION = "marketmind_user_research_v1"

TRUE_VALUES = {"1", "true", "yes", "on"}

_RUNTIME_LOCK = RLock()
_QDRANT_CLIENT = None
_QDRANT_MODULE = None
_QDRANT_MODELS_MODULE = None
_QDRANT_CLIENT_KEY = None


class ResearchVectorStoreError(Exception):
    pass


class ResearchVectorStoreUnavailableError(ResearchVectorStoreError):
    pass


def reset_runtime_state() -> None:
    global _QDRANT_CLIENT, _QDRANT_MODULE, _QDRANT_MODELS_MODULE, _QDRANT_CLIENT_KEY
    with _RUNTIME_LOCK:
        _QDRANT_CLIENT = None
        _QDRANT_MODULE = None
        _QDRANT_MODELS_MODULE = None
        _QDRANT_CLIENT_KEY = None


def is_enabled() -> bool:
    return str(os.getenv("RESEARCH_RETRIEVAL_ENABLED", "")).strip().lower() in TRUE_VALUES


def get_qdrant_url() -> str:
    return str(os.getenv("QDRANT_URL") or "").strip()


def get_qdrant_api_key() -> Optional[str]:
    value = str(os.getenv("QDRANT_API_KEY") or "").strip()
    return value or None


def global_collection_name() -> str:
    return str(os.getenv("QDRANT_GLOBAL_COLLECTION") or DEFAULT_GLOBAL_COLLECTION).strip()


def user_collection_name() -> str:
    return str(os.getenv("QDRANT_USER_COLLECTION") or DEFAULT_USER_COLLECTION).strip()


def _load_qdrant_module():
    global _QDRANT_MODULE
    with _RUNTIME_LOCK:
        if _QDRANT_MODULE is not None:
            return _QDRANT_MODULE
        try:
            _QDRANT_MODULE = importlib.import_module("qdrant_client")
        except ImportError as exc:
            raise ResearchVectorStoreUnavailableError(
                "Qdrant client is not installed for research retrieval."
            ) from exc
        return _QDRANT_MODULE


def _load_qdrant_models_module():
    global _QDRANT_MODELS_MODULE
    with _RUNTIME_LOCK:
        if _QDRANT_MODELS_MODULE is not None:
            return _QDRANT_MODELS_MODULE
        try:
            _QDRANT_MODELS_MODULE = importlib.import_module("qdrant_client.models")
        except ImportError as exc:
            raise ResearchVectorStoreUnavailableError(
                "Qdrant models are not available for research retrieval."
            ) from exc
        return _QDRANT_MODELS_MODULE


def _client_cache_key() -> tuple[str, Optional[str]]:
    return (get_qdrant_url(), get_qdrant_api_key())


def _load_client():
    global _QDRANT_CLIENT, _QDRANT_CLIENT_KEY
    url = get_qdrant_url()
    if not url:
        raise ResearchVectorStoreUnavailableError("Qdrant is not configured.")

    cache_key = _client_cache_key()
    with _RUNTIME_LOCK:
        if _QDRANT_CLIENT is not None and _QDRANT_CLIENT_KEY == cache_key:
            return _QDRANT_CLIENT
        module = _load_qdrant_module()
        api_key = get_qdrant_api_key()
        try:
            if url in {":memory:", "memory"}:
                _QDRANT_CLIENT = module.QdrantClient(":memory:")
            else:
                _QDRANT_CLIENT = module.QdrantClient(url=url, api_key=api_key)
        except Exception as exc:
            raise ResearchVectorStoreUnavailableError(f"Could not connect to Qdrant: {exc}") from exc
        _QDRANT_CLIENT_KEY = cache_key
        return _QDRANT_CLIENT


def _collection_name_for_scope(scope: str) -> str:
    normalized_scope = str(scope or "").strip().lower()
    if normalized_scope == "user":
        return user_collection_name()
    return global_collection_name()


def ensure_collection(scope: str, vector_size: int) -> str:
    client = _load_client()
    models = _load_qdrant_models_module()
    collection_name = _collection_name_for_scope(scope)
    try:
        exists = False
        collection_exists = getattr(client, "collection_exists", None)
        if callable(collection_exists):
            exists = bool(collection_exists(collection_name))
        else:
            client.get_collection(collection_name)
            exists = True
    except Exception:
        exists = False

    if exists:
        return collection_name

    client.create_collection(
        collection_name=collection_name,
        vectors_config=models.VectorParams(size=int(vector_size), distance=models.Distance.COSINE),
    )
    return collection_name


def _build_filter(must: Optional[Dict[str, Any]] = None):
    must = must or {}
    models = _load_qdrant_models_module()
    conditions = []
    for key, value in must.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple, set)):
            values = [item for item in value if item is not None]
            if not values:
                continue
            match_any_cls = getattr(models, "MatchAny", None)
            if match_any_cls is not None:
                match = match_any_cls(any=list(values))
            else:
                match = models.MatchValue(value=list(values)[0])
        else:
            match = models.MatchValue(value=value)
        conditions.append(models.FieldCondition(key=key, match=match))
    return models.Filter(must=conditions) if conditions else None


def upsert_documents(scope: str, documents: Iterable[Dict[str, Any]], vector_size: int) -> int:
    docs = [dict(doc or {}) for doc in documents if doc]
    if not docs:
        return 0
    client = _load_client()
    models = _load_qdrant_models_module()
    collection_name = ensure_collection(scope, vector_size)
    points = [
        models.PointStruct(id=doc["id"], vector=doc["vector"], payload=doc["payload"])
        for doc in docs
    ]
    client.upsert(collection_name=collection_name, points=points, wait=True)
    return len(points)


def query_documents(
    scope: str,
    *,
    query_vector: List[float],
    limit: int,
    must_filter: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    client = _load_client()
    collection_name = _collection_name_for_scope(scope)
    query_filter = _build_filter(must_filter)
    try:
        response = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=max(int(limit), 1),
            with_payload=True,
        )
    except Exception:
        return []
    results = []
    for item in response or []:
        payload = dict(getattr(item, "payload", {}) or {})
        results.append(
            {
                "id": str(getattr(item, "id", "")),
                "score": float(getattr(item, "score", 0.0)),
                "payload": payload,
            }
        )
    return results


def count_documents(scope: str, *, must_filter: Optional[Dict[str, Any]] = None) -> int:
    client = _load_client()
    collection_name = _collection_name_for_scope(scope)
    query_filter = _build_filter(must_filter)
    try:
        response = client.count(collection_name=collection_name, count_filter=query_filter, exact=True)
    except Exception:
        return 0
    return int(getattr(response, "count", 0) or 0)


def get_runtime_status() -> Dict[str, Any]:
    enabled = is_enabled()
    status = {
        "enabled": enabled,
        "available": False,
        "qdrantUrl": get_qdrant_url() or None,
        "globalCollection": global_collection_name(),
        "userCollection": user_collection_name(),
    }
    if not enabled:
        status["reason"] = "disabled"
        return status
    try:
        _load_client()
        status["available"] = True
    except ResearchVectorStoreUnavailableError as exc:
        status["reason"] = str(exc)
    return status
