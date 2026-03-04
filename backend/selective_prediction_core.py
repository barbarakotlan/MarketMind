from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import pandas as pd


HASH_VERSION_SHA256_UTF8_INT = "sha256_utf8_int"


def ticker_hash_bucket(ticker: str, buckets: int) -> int:
    bucket_count = max(int(buckets), 1)
    digest = hashlib.sha256(str(ticker or "").upper().encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % bucket_count


def build_ticker_data_signature(
    feature_columns: List[str],
    schema_version: str,
    lookback: int,
    horizon: int,
    embargo: int,
    vol_window: int,
    magnitude_k: float,
    retrain_frequency: int,
    pred_deadband: float,
) -> str:
    signature_payload = {
        "schema_version": schema_version,
        "feature_columns": feature_columns,
        "lookback": int(lookback),
        "horizon": int(horizon),
        "embargo": int(embargo),
        "vol_window": int(vol_window),
        "magnitude_k": float(magnitude_k),
        "retrain_frequency": int(retrain_frequency),
        "pred_deadband": float(pred_deadband),
    }
    encoded = json.dumps(signature_payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_global_data_signature(
    feature_columns: List[str],
    schema_version: str,
    lookback: int,
    horizon: int,
    embargo: int,
    vol_window: int,
    magnitude_k: float,
    pred_deadband: float,
    global_hash_buckets: int,
    hash_version: str = HASH_VERSION_SHA256_UTF8_INT,
) -> str:
    signature_payload = {
        "schema_version": schema_version,
        "feature_columns": feature_columns,
        "lookback": int(lookback),
        "horizon": int(horizon),
        "embargo": int(embargo),
        "vol_window": int(vol_window),
        "magnitude_k": float(magnitude_k),
        "pred_deadband": float(pred_deadband),
        "hash_version": hash_version,
        "global_hash_buckets": int(global_hash_buckets),
    }
    encoded = json.dumps(signature_payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def validate_ticker_artifact(
    metadata: Dict[str, object],
    expected_signature: str,
    latest_settled_date,
    schema_version: str,
    artifact_ttl_days: int,
) -> Tuple[bool, str]:
    if metadata.get("schema_version") != schema_version:
        return False, "stale_artifact"
    if metadata.get("data_signature") != expected_signature:
        return False, "stale_artifact"

    created_at = _parse_iso_datetime(metadata.get("created_at"))
    if created_at is None:
        return False, "stale_artifact"
    if datetime.now(timezone.utc) - created_at > timedelta(days=int(artifact_ttl_days)):
        return False, "stale_artifact"

    trained_on_str = metadata.get("trained_on_end_date")
    if not trained_on_str or latest_settled_date is None:
        return False, "stale_artifact"

    try:
        trained_on = pd.Timestamp(trained_on_str)
        latest_settled = pd.Timestamp(latest_settled_date)
    except Exception:
        return False, "stale_artifact"
    if trained_on > latest_settled:
        return False, "stale_artifact"
    return True, "ok"


def validate_global_model_artifact(
    metadata: Dict[str, object],
    expected_signature: str,
    latest_settled_date,
    global_schema_version: str,
    artifact_ttl_days_global_model: int,
) -> Tuple[bool, str]:
    if metadata.get("schema_version") != global_schema_version:
        return False, "stale_artifact"
    if metadata.get("data_signature") != expected_signature:
        return False, "stale_artifact"

    created_at = _parse_iso_datetime(metadata.get("created_at"))
    if created_at is None:
        return False, "stale_artifact"
    if datetime.now(timezone.utc) - created_at > timedelta(days=int(artifact_ttl_days_global_model)):
        return False, "stale_artifact"

    trained_on_str = metadata.get("trained_on_end_date_global")
    latest_global_settled_str = metadata.get("latest_available_settled_date_global")
    if not trained_on_str:
        return False, "stale_artifact"
    try:
        trained_on = pd.Timestamp(trained_on_str)
    except Exception:
        return False, "stale_artifact"

    if latest_global_settled_str:
        try:
            latest_global_settled = pd.Timestamp(latest_global_settled_str)
            if trained_on > latest_global_settled:
                return False, "stale_artifact"
        except Exception:
            return False, "stale_artifact"

    if latest_settled_date is None:
        return False, "stale_artifact"
    try:
        latest_settled = pd.Timestamp(latest_settled_date)
    except Exception:
        return False, "stale_artifact"
    if trained_on > latest_settled:
        return False, "stale_artifact"
    return True, "ok"


def validate_global_tau_metadata(
    tau_metadata: Dict[str, object],
    global_model_metadata: Dict[str, object],
    global_tau_schema_version: str,
    artifact_ttl_days_global_tau: int,
) -> Tuple[bool, str]:
    if tau_metadata.get("schema_version") != global_tau_schema_version:
        return False, "stale_artifact"
    if tau_metadata.get("global_model_schema_version") != global_model_metadata.get("schema_version"):
        return False, "stale_artifact"
    if tau_metadata.get("global_model_signature") != global_model_metadata.get("data_signature"):
        return False, "stale_artifact"

    created_at = _parse_iso_datetime(tau_metadata.get("created_at"))
    if created_at is None:
        return False, "stale_artifact"
    if datetime.now(timezone.utc) - created_at > timedelta(days=int(artifact_ttl_days_global_tau)):
        return False, "stale_artifact"
    return True, "ok"
