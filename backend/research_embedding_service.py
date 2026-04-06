from __future__ import annotations

import importlib
import os
from threading import RLock
from typing import Any, Dict, Iterable, List


TRUE_VALUES = {"1", "true", "yes", "on"}

DEFAULT_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DEFAULT_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

_RUNTIME_LOCK = RLock()
_SENTENCE_TRANSFORMERS_MODULE = None
_DENSE_MODEL = None
_DENSE_MODEL_NAME = None
_RERANKER_MODEL = None
_RERANKER_MODEL_NAME = None


class ResearchEmbeddingError(Exception):
    pass


class ResearchEmbeddingUnavailableError(ResearchEmbeddingError):
    pass


def reset_runtime_state() -> None:
    global _SENTENCE_TRANSFORMERS_MODULE, _DENSE_MODEL, _DENSE_MODEL_NAME, _RERANKER_MODEL, _RERANKER_MODEL_NAME
    with _RUNTIME_LOCK:
        _SENTENCE_TRANSFORMERS_MODULE = None
        _DENSE_MODEL = None
        _DENSE_MODEL_NAME = None
        _RERANKER_MODEL = None
        _RERANKER_MODEL_NAME = None


def is_enabled() -> bool:
    return str(os.getenv("RESEARCH_RETRIEVAL_ENABLED", "")).strip().lower() in TRUE_VALUES


def get_embedding_model_name() -> str:
    return str(os.getenv("RETRIEVAL_EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL).strip()


def get_reranker_model_name() -> str:
    return str(os.getenv("RETRIEVAL_RERANKER_MODEL") or DEFAULT_RERANKER_MODEL).strip()


def _load_sentence_transformers_module():
    global _SENTENCE_TRANSFORMERS_MODULE
    with _RUNTIME_LOCK:
        if _SENTENCE_TRANSFORMERS_MODULE is not None:
            return _SENTENCE_TRANSFORMERS_MODULE
        try:
            _SENTENCE_TRANSFORMERS_MODULE = importlib.import_module("sentence_transformers")
        except ImportError as exc:
            raise ResearchEmbeddingUnavailableError(
                "SentenceTransformers is not installed for research retrieval."
            ) from exc
        return _SENTENCE_TRANSFORMERS_MODULE


def _load_dense_model():
    global _DENSE_MODEL, _DENSE_MODEL_NAME
    model_name = get_embedding_model_name()
    with _RUNTIME_LOCK:
        if _DENSE_MODEL is not None and _DENSE_MODEL_NAME == model_name:
            return _DENSE_MODEL
        module = _load_sentence_transformers_module()
        try:
            _DENSE_MODEL = module.SentenceTransformer(model_name)
        except Exception as exc:
            raise ResearchEmbeddingUnavailableError(
                f"Could not load retrieval embedding model {model_name}: {exc}"
            ) from exc
        _DENSE_MODEL_NAME = model_name
        return _DENSE_MODEL


def _load_reranker_model():
    global _RERANKER_MODEL, _RERANKER_MODEL_NAME
    model_name = get_reranker_model_name()
    with _RUNTIME_LOCK:
        if _RERANKER_MODEL is not None and _RERANKER_MODEL_NAME == model_name:
            return _RERANKER_MODEL
        module = _load_sentence_transformers_module()
        try:
            _RERANKER_MODEL = module.CrossEncoder(model_name)
        except Exception as exc:
            raise ResearchEmbeddingUnavailableError(
                f"Could not load retrieval reranker model {model_name}: {exc}"
            ) from exc
        _RERANKER_MODEL_NAME = model_name
        return _RERANKER_MODEL


def get_embedding_dimension() -> int:
    model = _load_dense_model()
    dimension_fn = getattr(model, "get_sentence_embedding_dimension", None)
    if callable(dimension_fn):
        return int(dimension_fn())
    sample_vector = encode_documents(["dimension probe"])[0]
    return len(sample_vector)


def _normalize_vectors(vectors: Any) -> List[List[float]]:
    if hasattr(vectors, "tolist"):
        vectors = vectors.tolist()
    if not vectors:
        return []
    if isinstance(vectors[0], (int, float)):
        return [[float(value) for value in vectors]]
    return [[float(value) for value in vector] for vector in vectors]


def encode_documents(texts: Iterable[str]) -> List[List[float]]:
    normalized_texts = [str(text or "").strip() for text in texts if str(text or "").strip()]
    if not normalized_texts:
        return []
    model = _load_dense_model()
    encoder = getattr(model, "encode_document", None) or getattr(model, "encode", None)
    if not callable(encoder):
        raise ResearchEmbeddingUnavailableError("Dense embedding model does not expose an encode method.")
    vectors = encoder(normalized_texts, normalize_embeddings=True)
    return _normalize_vectors(vectors)


def encode_query(text: str) -> List[float]:
    normalized_text = str(text or "").strip()
    if not normalized_text:
        raise ResearchEmbeddingUnavailableError("A retrieval query is required.")
    model = _load_dense_model()
    encoder = getattr(model, "encode_query", None) or getattr(model, "encode", None)
    if not callable(encoder):
        raise ResearchEmbeddingUnavailableError("Dense embedding model does not expose a query encoder.")
    vector = encoder(normalized_text, normalize_embeddings=True)
    normalized_vectors = _normalize_vectors(vector)
    return normalized_vectors[0]


def rerank_documents(
    *,
    query: str,
    documents: List[Dict[str, Any]],
    allow_rerank: bool = True,
) -> List[Dict[str, Any]]:
    if not allow_rerank or not documents:
        return documents

    reranker = _load_reranker_model()
    pairs = [(str(query or ""), str(doc.get("text") or doc.get("snippet") or "")) for doc in documents]
    try:
        scores = reranker.predict(pairs)
    except Exception as exc:
        raise ResearchEmbeddingUnavailableError(f"Could not rerank retrieval candidates: {exc}") from exc

    if hasattr(scores, "tolist"):
        scores = scores.tolist()

    reranked = []
    for doc, score in zip(documents, scores):
        next_doc = dict(doc)
        next_doc["rerankScore"] = float(score)
        reranked.append(next_doc)
    reranked.sort(key=lambda item: item.get("rerankScore", float("-inf")), reverse=True)
    return reranked


def get_runtime_status() -> Dict[str, Any]:
    enabled = is_enabled()
    status = {
        "enabled": enabled,
        "embeddingModel": get_embedding_model_name(),
        "rerankerModel": get_reranker_model_name(),
        "available": False,
    }
    if not enabled:
        status["reason"] = "disabled"
        return status
    try:
        model = _load_dense_model()
        status["available"] = True
        dimension_fn = getattr(model, "get_sentence_embedding_dimension", None)
        if callable(dimension_fn):
            status["embeddingDimension"] = int(dimension_fn())
        try:
            _load_reranker_model()
            status["rerankerAvailable"] = True
        except ResearchEmbeddingUnavailableError as exc:
            status["rerankerAvailable"] = False
            status["rerankerReason"] = str(exc)
    except ResearchEmbeddingUnavailableError as exc:
        status["reason"] = str(exc)
    return status
