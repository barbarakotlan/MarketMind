"""
Disk-persistent store for trained DL models (LSTM, GRU, Transformer).

Layout under MODEL_CACHE_DIR (default: backend/model_cache/):
  {MODEL_TYPE}_{TICKER}.pt          — PyTorch state_dict
  {MODEL_TYPE}_{TICKER}_meta.json   — constructor args + trained_at timestamp
  {MODEL_TYPE}_{TICKER}_scaler_X.pkl — fitted MinMaxScaler for features
  {MODEL_TYPE}_{TICKER}_scaler_y.pkl — fitted MinMaxScaler for targets
"""

import json
import os
import pickle
import threading
from datetime import datetime, timezone
from pathlib import Path

import torch

MODEL_CACHE_DIR = Path(os.environ.get("DL_MODEL_CACHE_DIR", Path(__file__).parent / "model_cache"))
_dir_lock = threading.Lock()


def _ensure_dir():
    with _dir_lock:
        MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _stem(model_type: str, ticker: str) -> str:
    safe_ticker = ticker.upper().replace("/", "_").replace(".", "_")
    return f"{model_type}_{safe_ticker}"


def _hyperparams_from_model(model_type: str, model) -> dict:
    """Extract constructor args from a trained model object."""
    if model_type == "LSTM":
        return {
            "input_size": model.lstm.input_size,
            "hidden_size": model.hidden_size,
            "layer_size": model.layer_size,
            "output_size": model.fc.out_features,
        }
    elif model_type == "GRU":
        return {
            "input_size": model.gru.input_size,
            "hidden_size": model.hidden_size,
            "layer_size": model.layer_size,
            "output_size": model.fc.out_features,
        }
    else:  # Transformer
        return {
            "input_size": model.input_projection.in_features,
            "d_model": model.input_projection.out_features,
            "nhead": model.transformer_encoder.layers[0].self_attn.num_heads,
            "num_layers": len(model.transformer_encoder.layers),
            "output_size": model.fc.out_features,
        }


def save_model(model_type: str, ticker: str, model, scaler_X, scaler_y, val_mape=None):
    """Persist model weights, scalers, and metadata to disk."""
    _ensure_dir()
    stem = _stem(model_type, ticker)

    torch.save(model.state_dict(), MODEL_CACHE_DIR / f"{stem}.pt")

    with open(MODEL_CACHE_DIR / f"{stem}_scaler_X.pkl", "wb") as f:
        pickle.dump(scaler_X, f)
    with open(MODEL_CACHE_DIR / f"{stem}_scaler_y.pkl", "wb") as f:
        pickle.dump(scaler_y, f)

    meta = {
        "model_type": model_type,
        "ticker": ticker.upper(),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "hyperparams": _hyperparams_from_model(model_type, model),
        "val_mape": float(val_mape) if val_mape is not None else None,
    }
    with open(MODEL_CACHE_DIR / f"{stem}_meta.json", "w") as f:
        json.dump(meta, f)


def load_model(model_type: str, ticker: str, model_class, ttl_hours: float):
    """
    Load a model from disk if it exists and is within TTL.

    Returns (model, scaler_X, scaler_y, device, trained_at) or None.
    trained_at is a timezone-aware datetime.
    """
    stem = _stem(model_type, ticker)
    meta_path = MODEL_CACHE_DIR / f"{stem}_meta.json"
    pt_path   = MODEL_CACHE_DIR / f"{stem}.pt"
    sx_path   = MODEL_CACHE_DIR / f"{stem}_scaler_X.pkl"
    sy_path   = MODEL_CACHE_DIR / f"{stem}_scaler_y.pkl"

    if not all(p.exists() for p in (meta_path, pt_path, sx_path, sy_path)):
        return None

    with open(meta_path) as f:
        meta = json.load(f)

    trained_at = datetime.fromisoformat(meta["trained_at"])
    age_seconds = (datetime.now(timezone.utc) - trained_at).total_seconds()
    if age_seconds > ttl_hours * 3600:
        return None

    with open(sx_path, "rb") as f:
        scaler_X = pickle.load(f)
    with open(sy_path, "rb") as f:
        scaler_y = pickle.load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    hp = meta["hyperparams"]

    if model_type in ("LSTM", "GRU"):
        model = model_class(
            input_size=hp["input_size"],
            hidden_size=hp["hidden_size"],
            layer_size=hp["layer_size"],
            output_size=hp["output_size"],
        ).to(device)
    else:  # Transformer
        model = model_class(
            input_size=hp["input_size"],
            d_model=hp["d_model"],
            nhead=hp["nhead"],
            num_layers=hp["num_layers"],
            output_size=hp["output_size"],
        ).to(device)

    model.load_state_dict(torch.load(pt_path, map_location=device, weights_only=True))
    model.eval()

    val_mape = meta.get("val_mape")

    return model, scaler_X, scaler_y, device, trained_at, val_mape


def delete_model(model_type: str, ticker: str) -> bool:
    """
    Remove all cached files for a model+ticker combination.
    Returns True if any files were deleted, False if nothing existed.
    """
    stem = _stem(model_type, ticker)
    deleted = False
    for suffix in (".pt", "_meta.json", "_scaler_X.pkl", "_scaler_y.pkl"):
        path = MODEL_CACHE_DIR / f"{stem}{suffix}"
        if path.exists():
            path.unlink()
            deleted = True
    return deleted
