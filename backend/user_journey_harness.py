from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from unittest import mock

import numpy as np

import api as backend_api
from user_journey_state import (
    restore_user_state_snapshot,
    snapshot_user_state,
    verify_user_state_snapshot,
)
from user_state_store import reset_runtime_state


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _configure_backend_runtime(base_dir: str, database_url: str, persistence_mode: str) -> None:
    base_dir = os.path.abspath(base_dir)
    reset_runtime_state()
    backend_api.BASE_DIR = base_dir
    backend_api.DATABASE = os.path.join(base_dir, "marketmind.db")
    backend_api.DATABASE_URL = str(database_url or "").strip()
    backend_api.PERSISTENCE_MODE = persistence_mode
    backend_api.USER_DATA_DIR = os.path.join(base_dir, "user_data")
    backend_api.PORTFOLIO_FILE = os.path.join(base_dir, "paper_portfolio.json")
    backend_api.NOTIFICATIONS_FILE = os.path.join(base_dir, "notifications.json")
    backend_api.PREDICTION_PORTFOLIO_FILE = os.path.join(base_dir, "prediction_portfolio.json")
    backend_api.ALLOW_LEGACY_USER_DATA_SEED = False
    backend_api.app.testing = True
    backend_api._JWKS_CACHE.clear()
    os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
    backend_api.init_db()


@contextmanager
def auth_shim(user_id: str):
    original_verify = backend_api.verify_clerk_token
    backend_api.verify_clerk_token = lambda token: {
        "sub": user_id,
        "email": f"{user_id}@example.com",
        "username": user_id,
    }
    try:
        yield
    finally:
        backend_api.verify_clerk_token = original_verify


@contextmanager
def deterministic_data_shim():
    pd = backend_api.pd
    idx = pd.date_range("2026-01-01", periods=120, freq="D")
    deterministic_df = pd.DataFrame({"Close": np.linspace(100, 120, len(idx))}, index=idx)

    class FakeTicker:
        def __init__(self, ticker: str):
            symbol = ticker.split(":")[0].upper()
            self.symbol = symbol
            self.info = {
                "symbol": symbol,
                "longName": f"{symbol} Incorporated",
                "regularMarketPrice": 100.0,
                "previousClose": 99.0,
                "marketCap": 1_500_000_000_000,
                "quoteType": "EQUITY",
            }
            self.fast_info = {"last_price": 100.0}
            self.options = ["2026-06-19"]
            self.news = []
            self.quarterly_financials = pd.DataFrame()

        def history(self, period: str = "1mo", interval: str = "1d"):
            dates = pd.date_range("2026-03-01", periods=5, freq="D")
            return pd.DataFrame(
                {
                    "Open": [98.0, 99.0, 100.0, 101.0, 102.0],
                    "High": [99.0, 100.0, 101.0, 102.0, 103.0],
                    "Low": [97.5, 98.5, 99.5, 100.5, 101.5],
                    "Close": [98.5, 99.5, 100.5, 101.5, 102.5],
                    "Volume": [1000, 1200, 1400, 1600, 1800],
                },
                index=dates,
            )

    class FakeNewsResponse:
        def json(self):
            return {
                "status": "ok",
                "articles": [
                    {
                        "title": "Apple product update",
                        "source": {"name": "TestWire"},
                        "url": "https://example.com/apple",
                        "publishedAt": "2026-03-10T12:00:00Z",
                        "urlToImage": "https://example.com/apple.png",
                    }
                ],
            }

    def fake_download(tickers, period: str = "1mo", interval: Optional[str] = None):
        tickers_list = tickers if isinstance(tickers, list) else [tickers]
        dates = pd.date_range("2026-03-01", periods=2, freq="D")

        if len(tickers_list) == 1:
            return pd.DataFrame(
                {
                    "Close": [99.0, 100.0],
                    "Open": [98.0, 99.0],
                    "High": [100.0, 101.0],
                    "Low": [97.5, 98.5],
                    "Volume": [1000, 1200],
                },
                index=dates,
            )

        close_values = {
            ticker: [99.0 + idx, 100.0 + idx]
            for idx, ticker in enumerate(tickers_list)
        }
        return pd.concat({"Close": pd.DataFrame(close_values, index=dates)}, axis=1)

    def fake_predict_stock(ticker: str):
        predictions = [
            {"date": "2026-03-15", "predictedClose": 101.0},
            {"date": "2026-03-16", "predictedClose": 101.5},
        ]
        return backend_api.jsonify({"predictions": predictions})

    def fake_ensemble_predict(df, days_ahead=6):
        return (
            np.array([121.0, 122.0, 123.0, 124.0, 125.0, 126.0]),
            {
                "linear_regression": np.array([121.0, 122.0, 123.0, 124.0, 125.0, 126.0]),
                "random_forest": np.array([120.5, 121.5, 122.5, 123.5, 124.5, 125.5]),
            },
        )

    fake_market = {
        "id": "market-1",
        "question": "Will the launch happen?",
        "is_open": True,
        "outcomes": ["Yes", "No"],
        "prices": {"Yes": 0.45, "No": 0.55},
        "exchange": "polymarket",
    }

    with ExitStack() as stack:
        stack.enter_context(mock.patch.object(backend_api.yf, "Ticker", FakeTicker))
        stack.enter_context(mock.patch.object(backend_api.yf, "download", side_effect=fake_download))
        stack.enter_context(mock.patch.object(backend_api.requests, "get", return_value=FakeNewsResponse()))
        stack.enter_context(mock.patch.object(backend_api, "NEWS_API_KEY", "deterministic-news-key"))
        stack.enter_context(mock.patch.object(backend_api, "create_dataset", side_effect=lambda ticker, period="1y": deterministic_df.copy()))
        stack.enter_context(mock.patch.object(backend_api, "ensemble_predict", side_effect=fake_ensemble_predict))
        stack.enter_context(mock.patch.object(backend_api, "predict_stock", side_effect=fake_predict_stock))
        stack.enter_context(mock.patch.object(backend_api, "pm_fetch_markets", return_value=[fake_market]))
        stack.enter_context(mock.patch.object(backend_api, "pm_search_markets", return_value=[fake_market]))
        stack.enter_context(mock.patch.object(backend_api, "pm_get_market", return_value=fake_market))
        stack.enter_context(mock.patch.object(backend_api, "pm_get_prices", return_value=fake_market["prices"]))
        yield


def _auth_headers() -> Dict[str, str]:
    return {"Authorization": "Bearer harness-token"}


def _response_json(response):
    try:
        return response.get_json()
    except Exception:
        return None


def _record_result(
    results: List[Dict[str, Any]],
    *,
    phase: str,
    name: str,
    status: str,
    classification: str,
    response_status: Optional[int] = None,
    details: Optional[Any] = None,
) -> None:
    results.append(
        {
            "phase": phase,
            "name": name,
            "status": status,
            "classification": classification,
            **({"response_status": response_status} if response_status is not None else {}),
            **({"details": details} if details is not None else {}),
        }
    )


def _expect_success(
    results: List[Dict[str, Any]],
    *,
    phase: str,
    name: str,
    response,
    provider_dependent: bool = False,
) -> Tuple[bool, Any]:
    payload = _response_json(response)
    if 200 <= response.status_code < 300:
        _record_result(
            results,
            phase=phase,
            name=name,
            status="passed",
            classification="pass",
            response_status=response.status_code,
        )
        return True, payload

    classification = "provider_dependency" if provider_dependent else "product_bug"
    _record_result(
        results,
        phase=phase,
        name=name,
        status="failed",
        classification=classification,
        response_status=response.status_code,
        details=payload,
    )
    return False, payload


def _run_journey(client, *, results: List[Dict[str, Any]]) -> None:
    # Week 1: Research and setup
    stock_resp = client.get("/stock/AAPL")
    _expect_success(results, phase="week_1_research", name="stock_quote", response=stock_resp, provider_dependent=True)

    chart_resp = client.get("/chart/AAPL?period=1mo")
    _expect_success(results, phase="week_1_research", name="chart_data", response=chart_resp, provider_dependent=True)

    news_resp = client.get("/news?q=Apple")
    _expect_success(results, phase="week_1_research", name="news_query", response=news_resp, provider_dependent=True)

    add_watchlist = client.post("/watchlist/MSFT", headers=_auth_headers())
    watchlist_ok, watchlist_payload = _expect_success(
        results,
        phase="week_1_research",
        name="watchlist_add",
        response=add_watchlist,
    )
    if watchlist_ok and "watchlist" in (watchlist_payload or {}):
        if "MSFT" in watchlist_payload["watchlist"]:
            _record_result(results, phase="week_1_research", name="watchlist_verify", status="passed", classification="pass")
        else:
            _record_result(
                results,
                phase="week_1_research",
                name="watchlist_verify",
                status="failed",
                classification="product_bug",
                details=watchlist_payload,
            )

    # Week 2: Monitoring and alerting
    create_alert = client.post(
        "/notifications",
        headers=_auth_headers(),
        json={"ticker": "MSFT", "condition": "below", "target_price": 1.0},
    )
    alert_ok, alert_payload = _expect_success(
        results,
        phase="week_2_alerting",
        name="price_alert_create",
        response=create_alert,
        provider_dependent=True,
    )
    alert_id = alert_payload.get("id") if isinstance(alert_payload, dict) else None

    list_alerts = client.get("/notifications", headers=_auth_headers())
    alerts_ok, alerts_payload = _expect_success(
        results,
        phase="week_2_alerting",
        name="price_alert_list",
        response=list_alerts,
    )
    if alerts_ok and isinstance(alerts_payload, list):
        matches = any(alert.get("id") == alert_id for alert in alerts_payload)
        _record_result(
            results,
            phase="week_2_alerting",
            name="price_alert_verify",
            status="passed" if matches else "failed",
            classification="pass" if matches else "product_bug",
            details={"alert_id": alert_id},
        )

    if alert_id:
        delete_alert = client.delete(f"/notifications/{alert_id}", headers=_auth_headers())
        _expect_success(results, phase="week_2_alerting", name="price_alert_delete", response=delete_alert)

    # Week 3: Paper trading
    buy_stock = client.post(
        "/paper/buy",
        headers=_auth_headers(),
        json={"ticker": "AAPL", "shares": 0.01},
    )
    bought, _ = _expect_success(
        results,
        phase="week_3_paper_trading",
        name="paper_buy",
        response=buy_stock,
        provider_dependent=True,
    )

    portfolio_resp = client.get("/paper/portfolio", headers=_auth_headers())
    portfolio_ok, portfolio_payload = _expect_success(
        results,
        phase="week_3_paper_trading",
        name="paper_portfolio",
        response=portfolio_resp,
        provider_dependent=True,
    )
    if bought and portfolio_ok and isinstance(portfolio_payload, dict):
        has_position = any(position.get("ticker") == "AAPL" for position in portfolio_payload.get("positions", []))
        _record_result(
            results,
            phase="week_3_paper_trading",
            name="paper_position_verify",
            status="passed" if has_position else "failed",
            classification="pass" if has_position else "product_bug",
        )

    sell_stock = client.post(
        "/paper/sell",
        headers=_auth_headers(),
        json={"ticker": "AAPL", "shares": 0.01},
    )
    _expect_success(
        results,
        phase="week_3_paper_trading",
        name="paper_sell",
        response=sell_stock,
        provider_dependent=True,
    )

    transactions_resp = client.get("/paper/transactions", headers=_auth_headers())
    _expect_success(
        results,
        phase="week_3_paper_trading",
        name="paper_transactions",
        response=transactions_resp,
    )

    # Week 4: Prediction markets and review
    markets_resp = client.get("/prediction-markets?exchange=polymarket&limit=5")
    markets_ok, markets_payload = _expect_success(
        results,
        phase="week_4_prediction_markets",
        name="prediction_market_list",
        response=markets_resp,
        provider_dependent=True,
    )
    selected_market = None
    if markets_ok and isinstance(markets_payload, dict):
        for market in markets_payload.get("markets", []):
            prices = market.get("prices") or {}
            if market.get("is_open") and prices:
                selected_market = market
                break

    if not selected_market:
        _record_result(
            results,
            phase="week_4_prediction_markets",
            name="prediction_market_select",
            status="skipped",
            classification="provider_dependency",
            details={"reason": "No open market with prices was available"},
        )
        return

    chosen_outcome = next(iter(selected_market.get("prices", {}).keys()))
    buy_prediction = client.post(
        "/prediction-markets/buy",
        headers=_auth_headers(),
        json={
            "market_id": selected_market.get("id") or selected_market.get("market_id"),
            "outcome": chosen_outcome,
            "contracts": 1,
            "exchange": selected_market.get("exchange", "polymarket"),
        },
    )
    prediction_bought, _ = _expect_success(
        results,
        phase="week_4_prediction_markets",
        name="prediction_buy",
        response=buy_prediction,
        provider_dependent=True,
    )

    prediction_portfolio = client.get("/prediction-markets/portfolio", headers=_auth_headers())
    portfolio_ok, prediction_payload = _expect_success(
        results,
        phase="week_4_prediction_markets",
        name="prediction_portfolio",
        response=prediction_portfolio,
        provider_dependent=True,
    )
    if prediction_bought and portfolio_ok and isinstance(prediction_payload, dict):
        has_prediction_position = any(
            position.get("market_id") == (selected_market.get("id") or selected_market.get("market_id"))
            for position in prediction_payload.get("positions", [])
        )
        _record_result(
            results,
            phase="week_4_prediction_markets",
            name="prediction_position_verify",
            status="passed" if has_prediction_position else "failed",
            classification="pass" if has_prediction_position else "product_bug",
        )

    sell_prediction = client.post(
        "/prediction-markets/sell",
        headers=_auth_headers(),
        json={
            "market_id": selected_market.get("id") or selected_market.get("market_id"),
            "outcome": chosen_outcome,
            "contracts": 1,
            "exchange": selected_market.get("exchange", "polymarket"),
        },
    )
    _expect_success(
        results,
        phase="week_4_prediction_markets",
        name="prediction_sell",
        response=sell_prediction,
        provider_dependent=True,
    )

    history_resp = client.get("/prediction-markets/history", headers=_auth_headers())
    _expect_success(
        results,
        phase="week_4_prediction_markets",
        name="prediction_history",
        response=history_resp,
    )


def run_harness(
    *,
    user_id: str,
    base_dir: str,
    database_url: str,
    persistence_mode: str,
    snapshot_dir: Optional[str],
    mode: str,
    preserve_snapshot: bool,
) -> Dict[str, Any]:
    _configure_backend_runtime(base_dir, database_url, persistence_mode)
    snapshot_dir = snapshot_dir or tempfile.mkdtemp(prefix="marketmind-user-journey-")

    report: Dict[str, Any] = {
        "started_at": utcnow_iso(),
        "user_id": user_id,
        "persistence_mode": persistence_mode,
        "mode": mode,
        "snapshot_dir": snapshot_dir,
        "results": [],
        "summary": {},
    }

    snapshot_result = snapshot_user_state(
        base_dir=base_dir,
        user_id=user_id,
        database_url=database_url,
        snapshot_dir=snapshot_dir,
    )
    report["snapshot"] = {
        "snapshot_path": snapshot_result["snapshot_path"],
        "summary": snapshot_result["summary"],
    }

    try:
        with ExitStack() as stack:
            stack.enter_context(auth_shim(user_id))
            if mode == "deterministic":
                stack.enter_context(deterministic_data_shim())
            client = backend_api.app.test_client()
            _run_journey(client, results=report["results"])
    except Exception as exc:
        report["results"].append(
            {
                "phase": "harness",
                "name": "unexpected_exception",
                "status": "failed",
                "classification": "product_bug",
                "details": {"error": str(exc)},
            }
        )
    finally:
        restore_result = restore_user_state_snapshot(
            base_dir=base_dir,
            user_id=user_id,
            database_url=database_url,
            snapshot_dir=snapshot_dir,
        )
        verify_result = verify_user_state_snapshot(
            base_dir=base_dir,
            user_id=user_id,
            database_url=database_url,
            snapshot_dir=snapshot_dir,
        )
        report["restore"] = restore_result
        report["verify"] = verify_result

        if restore_result.get("matches_snapshot") and verify_result.get("matches_snapshot") and not preserve_snapshot:
            shutil.rmtree(snapshot_dir, ignore_errors=True)
            report["snapshot_deleted"] = True
        else:
            report["snapshot_deleted"] = False

    provider_issues = sum(1 for result in report["results"] if result["classification"] == "provider_dependency")
    product_failures = sum(1 for result in report["results"] if result["classification"] == "product_bug")
    passed_steps = sum(1 for result in report["results"] if result["status"] == "passed")
    skipped_steps = sum(1 for result in report["results"] if result["status"] == "skipped")

    report["finished_at"] = utcnow_iso()
    report["summary"] = {
        "passed_steps": passed_steps,
        "provider_issues": provider_issues,
        "product_failures": product_failures,
        "skipped_steps": skipped_steps,
        "restore_matches_snapshot": bool(report["restore"].get("matches_snapshot")),
        "verify_matches_snapshot": bool(report["verify"].get("matches_snapshot")),
        "ok": product_failures == 0
        and report["restore"].get("matches_snapshot")
        and report["verify"].get("matches_snapshot"),
    }
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a repeatable MarketMind month-style user journey against the real Flask routes."
    )
    parser.add_argument("--user-id", required=True, help="Clerk user ID to simulate")
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", "").strip(),
        help="SQL database URL for the live user-state store",
    )
    parser.add_argument(
        "--base-dir",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="Backend base directory containing user_data/",
    )
    parser.add_argument(
        "--persistence-mode",
        default=os.getenv("PERSISTENCE_MODE", "postgres").strip().lower(),
        help="Persistence mode to configure for the harness run",
    )
    parser.add_argument(
        "--snapshot-dir",
        default=None,
        help="Optional directory for the temporary user snapshot",
    )
    parser.add_argument(
        "--mode",
        choices=["live", "deterministic"],
        default="live",
        help="Use live providers or deterministic stubs for external data",
    )
    parser.add_argument(
        "--preserve-snapshot",
        action="store_true",
        help="Keep the snapshot directory after the harness finishes",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    report = run_harness(
        user_id=args.user_id,
        base_dir=args.base_dir,
        database_url=args.database_url,
        persistence_mode=args.persistence_mode,
        snapshot_dir=args.snapshot_dir,
        mode=args.mode,
        preserve_snapshot=args.preserve_snapshot,
    )
    print(json.dumps(report, indent=2))
    return 0 if report["summary"]["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
