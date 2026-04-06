from __future__ import annotations

import json
import math
import os
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Dict, Iterable, List, Optional

import polars as pl

import screener_universe_service


SNAPSHOT_TTL_SECONDS = 60 * 60
METADATA_TTL_SECONDS = 24 * 60 * 60
LOCK_STALE_SECONDS = 10 * 60
LOCK_WAIT_SECONDS = 15
DOWNLOAD_CHUNK_SIZE = 40
TRADING_LOOKBACK = 252
CACHE_DIRNAME = "screener_cache"
SNAPSHOT_FILENAME = "latest_snapshot.parquet"
METADATA_FILENAME = "latest_metadata.json"
META_FILENAME = "snapshot_meta.json"
LOCK_FILENAME = ".refresh.lock"

_RUNTIME_LOCK = RLock()


class ScreenerSnapshotError(RuntimeError):
    pass


def cache_dir(*, base_dir: str) -> str:
    configured = os.getenv("SCREENER_CACHE_DIR", "").strip()
    if configured:
        return configured
    return os.path.join(base_dir, CACHE_DIRNAME)


def snapshot_path(*, base_dir: str) -> str:
    return os.path.join(cache_dir(base_dir=base_dir), SNAPSHOT_FILENAME)


def metadata_path(*, base_dir: str) -> str:
    return os.path.join(cache_dir(base_dir=base_dir), METADATA_FILENAME)


def meta_path(*, base_dir: str) -> str:
    return os.path.join(cache_dir(base_dir=base_dir), META_FILENAME)


def lock_path(*, base_dir: str) -> str:
    return os.path.join(cache_dir(base_dir=base_dir), LOCK_FILENAME)


def clear_runtime_cache(*, base_dir: str) -> None:
    with _RUNTIME_LOCK:
        for path in (
            snapshot_path(base_dir=base_dir),
            metadata_path(base_dir=base_dir),
            meta_path(base_dir=base_dir),
            lock_path(base_dir=base_dir),
        ):
            try:
                os.remove(path)
            except FileNotFoundError:
                continue


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _isoformat(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def _read_json(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _write_json_atomic(path: str, payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
    os.replace(tmp_path, path)


def _write_parquet_atomic(path: str, frame: pl.DataFrame) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp_path = f"{path}.tmp"
    frame.write_parquet(tmp_path)
    os.replace(tmp_path, path)


def _age_seconds(iso_timestamp: Optional[str], *, now_dt: datetime) -> float:
    if not iso_timestamp:
        return float("inf")
    try:
        parsed = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
    except ValueError:
        return float("inf")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return max(0.0, (now_dt - parsed.astimezone(timezone.utc)).total_seconds())


@contextmanager
def _refresh_lock(*, base_dir: str):
    path = lock_path(base_dir=base_dir)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    start = time.time()

    while True:
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode("utf-8"))
            os.close(fd)
            break
        except FileExistsError:
            try:
                age = time.time() - os.path.getmtime(path)
            except FileNotFoundError:
                continue
            if age > LOCK_STALE_SECONDS:
                try:
                    os.remove(path)
                except FileNotFoundError:
                    continue
                continue
            if (time.time() - start) > LOCK_WAIT_SECONDS:
                raise ScreenerSnapshotError("Timed out waiting for the screener snapshot refresh lock.")
            time.sleep(0.1)

    try:
        yield
    finally:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass


def _coerce_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def _coerce_int(value: Any) -> Optional[int]:
    number = _coerce_float(value)
    if number is None:
        return None
    return int(number)


def _history_period_for_lookback(lookback_days: int) -> str:
    calendar_days = max(int(math.ceil(lookback_days * 1.7)), lookback_days + 45, 180)
    return f"{calendar_days}d"


def _normalize_history_frame(raw_frame: Any) -> Optional[Any]:
    try:
        import pandas as pd
    except ImportError as exc:  # pragma: no cover
        raise ScreenerSnapshotError("pandas is required to normalize screener history.") from exc

    if not isinstance(raw_frame, pd.DataFrame) or raw_frame.empty:
        return None

    frame = raw_frame.copy()
    if isinstance(frame.columns, pd.MultiIndex):
        frame.columns = [col[-1] for col in frame.columns]

    required = [column for column in ("Open", "High", "Low", "Close", "Volume") if column in frame.columns]
    if "Close" not in required:
        return None

    frame = frame[required].dropna(subset=["Close"])
    if frame.empty:
        return None
    return frame


def _extract_downloaded_histories(raw_download: Any, tickers: List[str]) -> Dict[str, Any]:
    try:
        import pandas as pd
    except ImportError as exc:  # pragma: no cover
        raise ScreenerSnapshotError("pandas is required to extract screener histories.") from exc

    histories: Dict[str, Any] = {}
    if not isinstance(raw_download, pd.DataFrame) or raw_download.empty:
        return histories

    if isinstance(raw_download.columns, pd.MultiIndex):
        first_level = list(raw_download.columns.get_level_values(0))
        if set(first_level).intersection({"Open", "High", "Low", "Close", "Volume"}):
            level_zero_fields = {"Open", "High", "Low", "Close", "Volume"}
            for ticker in tickers:
                columns = [field for field in ("Open", "High", "Low", "Close", "Volume") if (field, ticker) in raw_download.columns]
                if not columns:
                    continue
                frame = raw_download.loc[:, [(field, ticker) for field in columns]].copy()
                frame.columns = columns
                normalized = _normalize_history_frame(frame)
                if normalized is not None:
                    histories[ticker] = normalized
            return histories

        for ticker in tickers:
            if ticker not in raw_download.columns.get_level_values(0):
                continue
            frame = raw_download[ticker].copy()
            normalized = _normalize_history_frame(frame)
            if normalized is not None:
                histories[ticker] = normalized
        return histories

    if len(tickers) == 1:
        normalized = _normalize_history_frame(raw_download)
        if normalized is not None:
            histories[tickers[0]] = normalized
    return histories


def _fetch_histories(*, tickers: List[str], yf_module, logger) -> Dict[str, Any]:
    histories: Dict[str, Any] = {}
    period = _history_period_for_lookback(TRADING_LOOKBACK)

    for start in range(0, len(tickers), DOWNLOAD_CHUNK_SIZE):
        chunk = tickers[start:start + DOWNLOAD_CHUNK_SIZE]
        try:
            downloaded = yf_module.download(
                chunk,
                period=period,
                interval="1d",
                auto_adjust=True,
                progress=False,
                group_by="ticker",
                threads=False,
            )
        except Exception as exc:
            logger.warning("Screener history download failed for chunk %s: %s", ",".join(chunk), exc)
            continue

        histories.update(_extract_downloaded_histories(downloaded, chunk))

    return histories


def _fetch_metadata(*, universe: List[Dict[str, object]], yf_module, logger) -> Dict[str, Dict[str, Any]]:
    metadata: Dict[str, Dict[str, Any]] = {}

    for record in universe:
        ticker = str(record["symbol"])
        fallback_name = str(record.get("name") or ticker)
        fallback_sector = str(record.get("sector") or "Unknown")
        try:
            info = getattr(yf_module.Ticker(ticker), "info", {}) or {}
        except Exception as exc:
            logger.warning("Screener metadata lookup failed for %s: %s", ticker, exc)
            info = {}

        metadata[ticker] = {
            "name": info.get("longName") or info.get("shortName") or fallback_name,
            "sector": info.get("sector") or fallback_sector,
            "market_cap": _coerce_int(info.get("marketCap")),
            "pe_forward": _coerce_float(info.get("forwardPE")),
            "target_mean_price": _coerce_float(info.get("targetMeanPrice")),
            "eps_ttm": _coerce_float(info.get("trailingEps")),
            "currency": info.get("currency") or "USD",
            "exchange": info.get("exchange") or "XNYS",
        }

    return metadata


def _load_existing_metadata(*, base_dir: str) -> Dict[str, Dict[str, Any]]:
    payload = _read_json(metadata_path(base_dir=base_dir))
    if not isinstance(payload, dict):
        return {}
    normalized: Dict[str, Dict[str, Any]] = {}
    for key, value in payload.items():
        if isinstance(value, dict):
            normalized[str(key).upper()] = dict(value)
    return normalized


def _safe_round(value: Optional[float], digits: int = 4) -> Optional[float]:
    if value is None:
        return None
    return round(value, digits)


def _compute_row(record: Dict[str, object], history, metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    history_df = pl.from_pandas(history.reset_index(names="date"))
    if history_df.height < 2:
        return None

    history_df = history_df.sort("date")
    history_df = history_df.with_columns(
        (
            (pl.col("Close") / pl.col("Close").shift(1)) - 1.0
        ).alias("daily_return")
    )

    close_values = history_df.get_column("Close")
    volume_values = history_df.get_column("Volume") if "Volume" in history_df.columns else None
    high_values = history_df.get_column("High") if "High" in history_df.columns else close_values
    low_values = history_df.get_column("Low") if "Low" in history_df.columns else close_values

    current_price = _coerce_float(close_values[-1])
    previous_close = _coerce_float(close_values[-2])
    volume = _coerce_int(volume_values[-1]) if volume_values is not None else None

    if current_price is None or previous_close in (None, 0):
        return None

    day_change = current_price - previous_close
    day_change_pct = day_change / previous_close

    avg_volume_20d = None
    avg_dollar_volume_30d = None
    relative_volume_20d = None
    if volume_values is not None:
        volume_tail_20 = history_df.select(pl.col("Volume").tail(20).mean()).item()
        avg_volume_20d = _coerce_float(volume_tail_20)
        if avg_volume_20d not in (None, 0) and volume is not None:
            relative_volume_20d = volume / avg_volume_20d

        dollar_frame = history_df.with_columns(
            (pl.col("Close") * pl.col("Volume")).alias("dollar_volume")
        )
        avg_dollar_volume_30d = _coerce_float(dollar_frame.select(pl.col("dollar_volume").tail(30).mean()).item())

    momentum_1m = None
    momentum_3m = None
    momentum_6m = None
    if history_df.height > 21:
        base = _coerce_float(close_values[-21])
        if base not in (None, 0):
            momentum_1m = (current_price / base) - 1.0
    if history_df.height > 63:
        base = _coerce_float(close_values[-63])
        if base not in (None, 0):
            momentum_3m = (current_price / base) - 1.0
    if history_df.height > 126:
        base = _coerce_float(close_values[-126])
        if base not in (None, 0):
            momentum_6m = (current_price / base) - 1.0

    year_high = _coerce_float(pl.Series(high_values).tail(min(252, len(high_values))).max())
    year_low = _coerce_float(pl.Series(low_values).tail(min(252, len(low_values))).min())

    distance_from_52w_high_pct = None
    if year_high not in (None, 0):
        distance_from_52w_high_pct = max(0.0, ((year_high - current_price) / year_high) * 100.0)

    distance_from_52w_low_pct = None
    if year_low not in (None, 0):
        distance_from_52w_low_pct = max(0.0, ((current_price - year_low) / year_low) * 100.0)

    returns_tail = history_df.select(pl.col("daily_return").drop_nulls().tail(30).std()).item()
    volatility_30d = None
    if returns_tail is not None:
        volatility_30d = _coerce_float(float(returns_tail) * math.sqrt(252))

    target_mean_price = _coerce_float(metadata.get("target_mean_price"))
    target_upside_pct = None
    if target_mean_price not in (None, 0) and current_price:
        target_upside_pct = ((target_mean_price - current_price) / current_price) * 100.0

    return {
        "symbol": str(record["symbol"]),
        "name": metadata.get("name") or record.get("name") or str(record["symbol"]),
        "sector": metadata.get("sector") or record.get("sector") or "Unknown",
        "index_membership": "|".join(record.get("index_membership") or []),
        "price": _safe_round(current_price, 2),
        "change": _safe_round(day_change, 2),
        "percent_change": _safe_round(day_change_pct, 6),
        "market_cap": metadata.get("market_cap"),
        "volume": volume,
        "avg_volume_20d": _safe_round(avg_volume_20d, 2),
        "avg_dollar_volume_30d": _safe_round(avg_dollar_volume_30d, 2),
        "relative_volume_20d": _safe_round(relative_volume_20d, 4),
        "momentum_1m": _safe_round(momentum_1m, 6),
        "momentum_3m": _safe_round(momentum_3m, 6),
        "momentum_6m": _safe_round(momentum_6m, 6),
        "distance_from_52w_high_pct": _safe_round(distance_from_52w_high_pct, 4),
        "distance_from_52w_low_pct": _safe_round(distance_from_52w_low_pct, 4),
        "volatility_30d": _safe_round(volatility_30d, 6),
        "pe_forward": _safe_round(_coerce_float(metadata.get("pe_forward")), 4),
        "target_mean_price": _safe_round(target_mean_price, 2),
        "target_upside_pct": _safe_round(target_upside_pct, 4),
        "eps_ttm": _safe_round(_coerce_float(metadata.get("eps_ttm")), 4),
        "year_high": _safe_round(year_high, 2),
        "year_low": _safe_round(year_low, 2),
        "currency": metadata.get("currency") or "USD",
        "exchange": metadata.get("exchange") or "XNYS",
    }


def _build_snapshot(*, histories: Dict[str, Any], metadata: Dict[str, Dict[str, Any]], universe: List[Dict[str, object]]) -> tuple[pl.DataFrame, List[str]]:
    rows: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for record in universe:
        ticker = str(record["symbol"])
        history = histories.get(ticker)
        if history is None:
            warnings.append(f"{ticker}: no usable daily history was available for the screener snapshot.")
            continue
        row = _compute_row(record, history, metadata.get(ticker, {}))
        if row is None:
            warnings.append(f"{ticker}: history was too sparse to compute screener factors.")
            continue
        rows.append(row)

    if not rows:
        raise ScreenerSnapshotError("Unable to build a screener snapshot from the current market data inputs.")

    return pl.DataFrame(rows), warnings


def ensure_snapshot(*, base_dir: str, yf_module, logger, force_refresh: bool = False) -> Dict[str, Any]:
    now_dt = _utcnow()
    os.makedirs(cache_dir(base_dir=base_dir), exist_ok=True)

    current_meta = _read_json(meta_path(base_dir=base_dir))
    existing_snapshot = os.path.exists(snapshot_path(base_dir=base_dir))
    existing_metadata = os.path.exists(metadata_path(base_dir=base_dir))
    price_age = _age_seconds(current_meta.get("lastRefresh"), now_dt=now_dt)
    metadata_age = _age_seconds(current_meta.get("metadataRefreshedAt"), now_dt=now_dt)

    needs_price_refresh = force_refresh or (not existing_snapshot) or price_age > SNAPSHOT_TTL_SECONDS
    needs_metadata_refresh = force_refresh or (not existing_metadata) or metadata_age > METADATA_TTL_SECONDS

    if not needs_price_refresh and not needs_metadata_refresh and current_meta:
        payload = dict(current_meta)
        payload.setdefault("snapshotStatus", "fresh")
        payload.setdefault("warnings", [])
        return payload

    try:
        with _refresh_lock(base_dir=base_dir):
            current_meta = _read_json(meta_path(base_dir=base_dir))
            existing_snapshot = os.path.exists(snapshot_path(base_dir=base_dir))
            existing_metadata = os.path.exists(metadata_path(base_dir=base_dir))
            price_age = _age_seconds(current_meta.get("lastRefresh"), now_dt=now_dt)
            metadata_age = _age_seconds(current_meta.get("metadataRefreshedAt"), now_dt=now_dt)
            needs_price_refresh = force_refresh or (not existing_snapshot) or price_age > SNAPSHOT_TTL_SECONDS
            needs_metadata_refresh = force_refresh or (not existing_metadata) or metadata_age > METADATA_TTL_SECONDS

            if not needs_price_refresh and not needs_metadata_refresh and current_meta:
                payload = dict(current_meta)
                payload.setdefault("snapshotStatus", "fresh")
                payload.setdefault("warnings", [])
                return payload

            universe = screener_universe_service.load_universe()
            metadata = _load_existing_metadata(base_dir=base_dir)
            if needs_metadata_refresh or not metadata:
                metadata = _fetch_metadata(universe=universe, yf_module=yf_module, logger=logger)
                _write_json_atomic(metadata_path(base_dir=base_dir), metadata)

            histories = _fetch_histories(
                tickers=[str(record["symbol"]) for record in universe],
                yf_module=yf_module,
                logger=logger,
            )
            snapshot_df, warnings = _build_snapshot(histories=histories, metadata=metadata, universe=universe)
            _write_parquet_atomic(snapshot_path(base_dir=base_dir), snapshot_df)

            meta_payload = {
                "asOf": _isoformat(now_dt),
                "lastRefresh": _isoformat(now_dt),
                "metadataRefreshedAt": _isoformat(now_dt if needs_metadata_refresh or not current_meta.get("metadataRefreshedAt") else datetime.fromisoformat(current_meta["metadataRefreshedAt"].replace("Z", "+00:00"))),
                "snapshotStatus": "fresh",
                "rowCount": snapshot_df.height,
                "universeSize": len(universe),
                "warnings": warnings[:25],
            }
            _write_json_atomic(meta_path(base_dir=base_dir), meta_payload)
            return meta_payload
    except Exception as exc:
        if os.path.exists(snapshot_path(base_dir=base_dir)):
            logger.warning("Screener snapshot refresh failed; serving last good snapshot: %s", exc)
            payload = _read_json(meta_path(base_dir=base_dir))
            payload.setdefault("warnings", [])
            payload["warnings"] = list(payload.get("warnings", [])) + [f"Serving the last successful screener snapshot because refresh failed: {exc}"]
            payload["snapshotStatus"] = "stale"
            payload.setdefault("asOf", current_meta.get("asOf") or _isoformat(now_dt))
            payload.setdefault("lastRefresh", current_meta.get("lastRefresh") or _isoformat(now_dt))
            payload.setdefault("universeSize", len(screener_universe_service.load_universe()))
            return payload
        raise ScreenerSnapshotError(str(exc)) from exc


def load_snapshot_frame(*, base_dir: str) -> pl.DataFrame:
    path = snapshot_path(base_dir=base_dir)
    if not os.path.exists(path):
        raise ScreenerSnapshotError("Screener snapshot is not available yet.")
    return pl.read_parquet(path)


def available_sectors(*, base_dir: str) -> List[str]:
    frame = load_snapshot_frame(base_dir=base_dir)
    return sorted(
        sector
        for sector in frame.get_column("sector").drop_nulls().unique().to_list()
        if sector
    )
