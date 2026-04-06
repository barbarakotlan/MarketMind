from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import requests


OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"


def _normalize_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for block in content:
            if isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if text:
                    parts.append(str(text))
        return "\n".join(parts).strip()
    if isinstance(content, dict):
        return json.dumps(content)
    return str(content or "")


def _build_headers(api_key: str) -> Dict[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    site_url = os.getenv("OPENROUTER_SITE_URL", "").strip()
    app_name = os.getenv("OPENROUTER_APP_NAME", "").strip()
    if site_url:
        headers["HTTP-Referer"] = site_url
    if app_name:
        headers["X-Title"] = app_name
    return headers


def _post_chat_completion(
    *,
    payload: Dict[str, Any],
    timeout_seconds: int,
) -> Dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    response = requests.post(
        OPENROUTER_CHAT_COMPLETIONS_URL,
        headers=_build_headers(api_key),
        json=payload,
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    response_json = response.json()
    choices = response_json.get("choices") or []
    if not choices:
        raise ValueError("OpenRouter returned no completion choices")
    return response_json


def create_structured_completion(
    *,
    messages: List[Dict[str, str]],
    json_schema: Dict[str, Any],
    schema_name: str,
    model: Optional[str] = None,
    temperature: float = 0.2,
    timeout_seconds: int = 45,
) -> Dict[str, Any]:
    selected_model = (model or os.getenv("OPENROUTER_MODEL") or DEFAULT_OPENROUTER_MODEL).strip()
    payload: Dict[str, Any] = {
        "model": selected_model,
        "messages": messages,
        "temperature": temperature,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": json_schema,
            },
        },
    }

    response_json = _post_chat_completion(payload=payload, timeout_seconds=timeout_seconds)
    choices = response_json.get("choices") or []

    message = choices[0].get("message") or {}
    if isinstance(message.get("parsed"), dict):
        parsed = message["parsed"]
    else:
        content = _normalize_message_content(message.get("content"))
        if not content:
            raise ValueError("OpenRouter returned empty completion content")
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError("OpenRouter returned non-JSON memo content") from exc

    if not isinstance(parsed, dict):
        raise ValueError("OpenRouter returned an unexpected memo payload type")

    return {
        "model": response_json.get("model") or selected_model,
        "structured_content": parsed,
        "raw_response": response_json,
        "request_payload": payload,
    }


def create_chat_completion(
    *,
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.3,
    timeout_seconds: int = 45,
) -> Dict[str, Any]:
    selected_model = (model or os.getenv("OPENROUTER_MODEL") or DEFAULT_OPENROUTER_MODEL).strip()
    payload: Dict[str, Any] = {
        "model": selected_model,
        "messages": messages,
        "temperature": temperature,
    }
    response_json = _post_chat_completion(payload=payload, timeout_seconds=timeout_seconds)
    choices = response_json.get("choices") or []
    message = choices[0].get("message") or {}
    text = _normalize_message_content(message.get("content"))
    if not text:
        raise ValueError("OpenRouter returned empty completion content")
    return {
        "model": response_json.get("model") or selected_model,
        "assistant_text": text,
        "raw_response": response_json,
        "request_payload": payload,
    }
