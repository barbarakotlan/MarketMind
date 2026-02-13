# To run this file, you need to install all dependencies:
# pip install Flask Flask-CORS yfinance pandas scikit-learn numpy requests python-dotenv statsmodels finnhub-python vaderSentiment xgboost schedule

import os
import yfinance as yf
import pandas as pd
import numpy as np
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta, date
import json
import sqlite3
import schedule
import time
import threading
import uuid  # For unique notification IDs
import re  # Added for Smart Alert parsing

# --- DOTENV MUST BE FIRST ---
from dotenv import load_dotenv

load_dotenv()
# --- END FIX ---

# --- Tazeem's Imports ---
from model import create_dataset, estimate_week, try_today, estimate_new, good_model
from news_fetcher import get_general_news
from ensemble_model import ensemble_predict, calculate_metrics, linear_regression_predict, random_forest_predict, xgboost_predict
from professional_evaluation import rolling_window_backtest
from forex_fetcher import get_exchange_rate, get_currency_list
from crypto_fetcher import get_crypto_exchange_rate, get_crypto_list, get_target_currencies
from commodities_fetcher import get_commodity_price, get_commodity_list, get_commodities_by_category
from prediction_markets_fetcher import (
    fetch_markets as pm_fetch_markets,
    search_markets as pm_search_markets,
    get_market_by_id as pm_get_market,
    get_exchange_list as pm_get_exchanges,
    get_current_prices as pm_get_prices,
)
from logger_config import setup_logger, log_api_error

#Emoji Fix
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# --- New Imports for Options Suggester ---
from options_suggester import generate_suggestion

# --- Import for Price Prediction ---
# Initialize logger
import logging

logger = logging.getLogger("marketmind_api")
logger.setLevel(logging.INFO)

handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
handler.setStream(sys.stdout)
logger.addHandler(handler)

logger.info("🚀 MarketMind API Starting...")

# Initialize the Flask application
app = Flask(__name__)
CORS(app)

# --- Rate Limiting Setup ---
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    app=app
)

# Define rate limits
class RateLimits:
    LIGHT = "10/minute"
    STANDARD = "20/minute"
    HEAVY = "2/minute" 
    WRITE = "5/minute"

# --- CONFIGURATION ---
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')

# --- Database Setup (for history snapshots) ---
DATABASE = 'marketmind.db'


def get_db():
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    return conn


def init_db():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS portfolio_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                portfolio_value REAL NOT NULL
            );
        ''')
        conn.commit()
        print("Database initialized.")
    except Exception as e:
        print(f"An error occurred during DB initialization: {e}")
    finally:
        if conn:
            conn.close()

from functools import wraps

def validate_request_json(required_fields):
    """
    Decorator to ensure that the incoming JSON request contains
    all required fields. Returns 400 with missing fields if not.
    
    Usage:
        @app.route('/buy', methods=['POST'])
        @validate_request_json(['ticker', 'shares'])
        def buy_stock():
            data = request.get_json()
            ...
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Ensure request is JSON
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400
            
            data = request.get_json()
            # Check for missing fields
            missing = [field for field in required_fields if field not in data]
            if missing:
                return jsonify({"error": f"Missing required fields: {missing}"}), 400
            
            # Everything is fine, call the route function
            return f(*args, **kwargs)
        return wrapper
    return decorator



# --- Persistent Storage Setup ---
PORTFOLIO_FILE = 'paper_portfolio.json'
NOTIFICATIONS_FILE = 'notifications.json'  # <-- NEW FILE FOR ALERTS
PREDICTION_PORTFOLIO_FILE = 'prediction_portfolio.json'


def load_prediction_portfolio():
    """Loads the prediction markets portfolio from its own JSON file."""
    if os.path.exists(PREDICTION_PORTFOLIO_FILE):
        try:
            with open(PREDICTION_PORTFOLIO_FILE, 'r') as f:
                data = json.load(f)
                data.setdefault('cash', 10000.0)
                data.setdefault('starting_cash', 10000.0)
                data.setdefault('positions', {})
                data.setdefault('trade_history', [])
                return data
        except json.JSONDecodeError:
            pass
    return {
        "cash": 10000.0, "starting_cash": 10000.0,
        "positions": {}, "trade_history": []
    }


def save_prediction_portfolio(portfolio):
    """Saves the prediction markets portfolio to its own JSON file."""
    with open(PREDICTION_PORTFOLIO_FILE, 'w') as f:
        json.dump(portfolio, f, indent=4)


def load_portfolio():
    """Loads the portfolio from a JSON file."""
    if os.path.exists(PORTFOLIO_FILE):
        try:
            with open(PORTFOLIO_FILE, 'r') as f:
                data = json.load(f)
                data.setdefault('cash', 100000.0)
                data.setdefault('starting_cash', 100000.0)
                data.setdefault('positions', {})
                data.setdefault('options_positions', {})
                data.setdefault('transactions', [])
                data.setdefault('trade_history', [])
                return data
        except json.JSONDecodeError:
            pass
    return {
        "cash": 100000.0, "starting_cash": 100000.0, "positions": {},
        "options_positions": {}, "transactions": [], "trade_history": []
    }


def save_portfolio(portfolio):
    """Saves the portfolio to a JSON file."""
    with open(PORTFOLIO_FILE, 'w') as f:
        json.dump(portfolio, f, indent=4)


# --- NEW: Notification Storage ---
def load_notifications():
    """Loads notifications from a JSON file."""
    if os.path.exists(NOTIFICATIONS_FILE):
        try:
            with open(NOTIFICATIONS_FILE, 'r') as f:
                data = json.load(f)
                data.setdefault('active', [])
                data.setdefault('triggered', [])
                return data
        except json.JSONDecodeError:
            pass
    return {"active": [], "triggered": []}


def save_notifications(notifications):
    """Saves notifications to a JSON file."""
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifications, f, indent=4)


# --- END NEW ---

# --- Helper function ---
def clean_value(val):
    if val is None or pd.isna(val): return None
    if isinstance(val, (np.int64, np.int32, np.int16, np.int8)): return int(val)
    if isinstance(val, (np.float64, np.float32, np.float16)): return float(val)
    return val


# --- Helper Function ---
def get_symbol_suggestions(query):
    if not ALPHA_VANTAGE_API_KEY:
        print("Alpha Vantage key not configured. Cannot get suggestions.")
        return []
    try:
        url = f'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords={query}&apikey={ALPHA_VANTAGE_API_KEY}'
        r = requests.get(url)
        data = r.json()
        matches = data.get('bestMatches', [])
        formatted_matches = []
        for match in matches:
            if "." not in match.get('1. symbol') and match.get('4. region') == "United States":
                formatted_matches.append({"symbol": match.get('1. symbol'), "name": match.get('2. name')})
        return formatted_matches
    except Exception as e:
        print(f"Error in get_symbol_suggestions: {e}")
        return []


# --- In-memory storage for Watchlist ---
watchlist = set()


# --- Watchlist Endpoints ---
@app.route('/watchlist', methods=['GET'])
@limiter.limit(RateLimits.LIGHT)
def get_watchlist():
    return jsonify(list(watchlist))


@app.route('/watchlist/<string:ticker>', methods=['POST'])
@limiter.limit(RateLimits.WRITE)
def add_to_watchlist(ticker):
    ticker = ticker.upper()
    watchlist.add(ticker)
    return jsonify({"message": f"{ticker} added to watchlist.", "watchlist": list(watchlist)}), 201


@app.route('/watchlist/<string:ticker>', methods=['DELETE'])
@limiter.limit(RateLimits.WRITE)
def remove_from_watchlist(ticker):
    ticker = ticker.upper()
    watchlist.discard(ticker)
    return jsonify({"message": f"{ticker} removed from watchlist.", "watchlist": list(watchlist)})


# --- Stock Data Endpoint ---
@app.route('/stock/<string:ticker>')
@limiter.limit(RateLimits.STANDARD)
def get_stock_data(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0]
        stock = yf.Ticker(sanitized_ticker)
        info = stock.info
        if info.get('regularMarketPrice') is None:
            return jsonify({"error": f"Invalid ticker symbol '{ticker}' or no data available."}), 404
        price = info.get('regularMarketPrice', 0)
        previous_close = info.get('previousClose', price)
        change = price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close else 0
        market_cap_int = info.get('marketCap', 0)
        market_cap_formatted = "N/A"
        if market_cap_int >= 1_000_000_000_000:
            market_cap_formatted = f"{market_cap_int / 1_000_000_000_000:.2f}T"
        elif market_cap_int > 0:
            market_cap_formatted = f"{market_cap_int / 1_000_000_000:.2f}B"
        sparkline = []
        try:
            hist = stock.history(period="7d", interval="1d")
            if not hist.empty:
                sparkline = [clean_value(p) for p in hist['Close']]
        except Exception as e:
            print(f"Could not fetch sparkline data: {e}")
        fundamentals = {}
        if not ALPHA_VANTAGE_API_KEY:
            fundamentals = {
                "peRatio": clean_value(info.get('trailingPE')), "week52High": clean_value(info.get('fiftyTwoWeekHigh')),
                "week52Low": clean_value(info.get('fiftyTwoWeekLow')),
                "analystTargetPrice": clean_value(info.get('targetMeanPrice')),
                "recommendationKey": info.get('recommendationKey'), "overview": info.get('longBusinessSummary')
            }
        else:
            try:
                url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={sanitized_ticker.upper()}&apikey={ALPHA_VANTAGE_API_KEY}'
                r = requests.get(url)
                data = r.json()
                if data and 'Symbol' in data:
                    fundamentals = {
                        "overview": data.get("Description", "N/A"), "peRatio": clean_value(data.get("PERatio")),
                        "forwardPE": clean_value(data.get("ForwardPE")), "pegRatio": clean_value(data.get("PEGRatio")),
                        "dividendYield": clean_value(data.get("DividendYield")), "beta": clean_value(data.get("Beta")),
                        "week52High": clean_value(data.get("52WeekHigh")),
                        "week52Low": clean_value(data.get("52WeekLow")),
                        "analystTargetPrice": clean_value(data.get("AnalystTargetPrice")), "recommendationKey": "N/A"
                    }
                else:
                    raise Exception("No data from Alpha Vantage")
            except Exception as e:
                print(f"Could not fetch fundamentals from Alpha Vantage: {e}. Falling back to yfinance.")
                fundamentals = {
                    "peRatio": clean_value(info.get('trailingPE')),
                    "week52High": clean_value(info.get('fiftyTwoWeekHigh')),
                    "week52Low": clean_value(info.get('fiftyTwoWeekLow')),
                    "analystTargetPrice": clean_value(info.get('targetMeanPrice')),
                    "recommendationKey": info.get('recommendationKey'), "overview": info.get('longBusinessSummary')
                }
        formatted_data = {
            "symbol": info.get('symbol', ticker.upper()), "companyName": info.get('longName', 'N/A'),
            "price": clean_value(price), "change": clean_value(change),
            "changePercent": clean_value(change_percent), "marketCap": market_cap_formatted,
            "sparkline": sparkline, "fundamentals": fundamentals
        }
        return jsonify(formatted_data)
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# --- Chart Endpoint ---
@app.route('/chart/<string:ticker>')
def get_chart_data(ticker):
    period = request.args.get('period', '6mo')
    sanitized_ticker = ticker.split(':')[0]
    period_interval_map = {
        "1d": {"period": "1d", "interval": "5m"}, "5d": {"period": "5d", "interval": "15m"},
        "14d": {"period": "14d", "interval": "1d"}, "1mo": {"period": "1mo", "interval": "1d"},
        "6mo": {"period": "6mo", "interval": "1d"}, "1y": {"period": "1y", "interval": "1d"},
    }
    params = period_interval_map.get(period)
    if not params: return jsonify({"error": "Invalid time frame specified."}), 400
    try:
        stock = yf.Ticker(sanitized_ticker)
        hist = stock.history(period=params["period"], interval=params["interval"])
        if hist.empty: return jsonify({"error": "Could not retrieve time series data."}), 404
        chart_data = []
        for index, row in hist.iterrows():
            chart_data.append({
                "date": index.strftime('%Y-%m-%d %H:%M:%S'), "open": clean_value(row['Open']),
                "high": clean_value(row['High']), "low": clean_value(row['Low']),
                "close": clean_value(row['Close']), "volume": clean_value(row['Volume'])
            })
        try:
            predictions = predict_stock(sanitized_ticker).get_json()['predictions']
            for pred in predictions:
                chart_data.append({
                    "date": pred["date"] + " 00:00:00", "open": None, "high": None, "low": None,
                    "close": pred["predictedClose"], "volume": None
                })
        except Exception as e:
            print(f"Could not append prediction to chart: {e}")
        return jsonify(chart_data)
    except Exception as e:
        return jsonify({"error": f"An error occurred while fetching chart data: {str(e)}"}), 500


# --- News Endpoint ---
@app.route('/news')
def get_query_news():
    query = request.args.get('q')
    if not query: return jsonify({"error": "A search query ('q') is required."}), 400
    if not NEWS_API_KEY: return jsonify({"error": "NewsAPI key is not configured"}), 500
    try:
        url = (f"https://newsapi.org/v2/everything?"
               f"q={query}&searchIn=title,description&language=en&pageSize=8"
               f"&sortBy=relevancy&apiKey={NEWS_API_KEY}")
        response = requests.get(url)
        data = response.json()
        if data.get('status') != 'ok':
            return jsonify({"error": data.get('message', 'Failed to fetch news')}), 500
        formatted_news = [{'title': item.get('title'), 'publisher': item.get('source', {}).get('name', 'N/A'),
                           'link': item.get('url'), 'publishTime': item.get('publishedAt', 'N/A'),
                           'thumbnail_url': item.get('urlToImage')} for item in data.get('articles', [])]
        return jsonify(formatted_news)
    except Exception as e:
        return jsonify({"error": f"An error occurred while fetching news: {str(e)}"}), 500


# --- Options Endpoints ---
@app.route('/options/stock_price/<string:ticker>')
def get_options_stock_price(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0]
        stock = yf.Ticker(sanitized_ticker)
        info = stock.info
        price = info.get('regularMarketPrice', 0)
        if price == 0: price = info.get('previousClose', 0)
        return jsonify({"ticker": sanitized_ticker.upper(), "price": clean_value(price)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/options/<string:ticker>', methods=['GET'])
def get_option_expirations(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0]
        stock = yf.Ticker(sanitized_ticker)
        expirations = stock.options
        if not expirations: return jsonify({"error": "No options found for this ticker."}), 404
        return jsonify(list(expirations))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/options/chain/<string:ticker>', methods=['GET'])
def get_option_chain(ticker):
    date = request.args.get('date')
    if not date: return jsonify({"error": "A date query parameter is required."}), 400
    try:
        sanitized_ticker = ticker.split(':')[0]
        stock = yf.Ticker(sanitized_ticker)
        chain = stock.option_chain(date)
        info = stock.info
        price = info.get('regularMarketPrice', 0)
        if price == 0: price = info.get('previousClose', 0)

        def format_chain(df):
            cols_to_keep = ['contractSymbol', 'strike', 'lastPrice', 'bid', 'ask', 'volume', 'openInterest',
                            'impliedVolatility']
            existing_cols = [col for col in cols_to_keep if col in df.columns]
            df_filtered = df[existing_cols]
            df_cleaned = df_filtered.replace({np.nan: None})
            records = df_cleaned.to_dict('records')
            for record in records:
                for col in existing_cols:
                    record[col] = clean_value(record.get(col))
            return records

        return jsonify(
            {"calls": format_chain(chain.calls), "puts": format_chain(chain.puts), "stock_price": clean_value(price)})
    except Exception as e:
        print(f"Error getting option chain: {e}")
        return jsonify({"error": "Could not retrieve option chain for this date."}), 404


# --- Options Suggestion Endpoint ---
@app.route('/options/suggest/<string:ticker>', methods=['GET'])
def get_option_suggestion(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0].upper()
        suggestion = generate_suggestion(sanitized_ticker)
        if "error" in suggestion: return jsonify(suggestion), 404
        return jsonify(suggestion)
    except Exception as e:
        print(f"Error in suggestion endpoint for {ticker}: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


# --- ML Endpoints ---
@app.route('/predict/<string:model>/<string:ticker>')
@limiter.limit(RateLimits.STANDARD)
def predict_stock(model, ticker):
    try:
        sanitized_ticker = ticker.split(':')[0]
        stock = yf.Ticker(sanitized_ticker)
        info = stock.info

        # --- Model-specific history ---
        if model == "LinReg":
            period = "15d"
            min_rows = 7
        elif model in ("RandomForest", "XGBoost"):
            period = "6mo"
            min_rows = 40
        else:
            return jsonify({"error": "Unknown model"}), 400

        df = create_dataset(sanitized_ticker, period=period)

        if df.empty or len(df) < min_rows:
            return jsonify({"error": "Insufficient historical data."}), 404

        # --- Run model ---
        if model == "LinReg":
            preds = linear_regression_predict(df, days_ahead=7)
        elif model == "RandomForest":
            preds = random_forest_predict(df, days_ahead=7)
        else:  # XGBoost
            preds = xgboost_predict(df, days_ahead=7)

        if preds is None or len(preds) == 0:
            return jsonify({
                "error": f"{model} prediction failed."
            }), 400

        recent_close = float(df["Close"].iloc[-1])
        recent_date = df.index[-1]

        future_dates = [
            recent_date + pd.Timedelta(days=i + 1)
            for i in range(len(preds))
        ]

        response = {
            "symbol": info.get('symbol', sanitized_ticker.upper()),
            "companyName": info.get('longName', 'N/A'),
            "recentDate": recent_date.strftime('%Y-%m-%d'),
            "recentClose": round(recent_close, 2),
            "recentPredicted": round(float(preds[0]), 2),
            "predictions": [
                {
                    "date": date.strftime('%Y-%m-%d'),
                    "predictedClose": round(float(pred), 2)
                }
                for date, pred in zip(future_dates, preds)
            ]
        }

        return jsonify(response)

    except Exception as e:
        log_api_error(logger, f'/predict/{ticker}', e, ticker)
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500



@app.route('/predict/ensemble/<string:ticker>')
@limiter.limit(RateLimits.STANDARD)
def predict_ensemble(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0]
        stock = yf.Ticker(sanitized_ticker)
        info = stock.info
        df = create_dataset(sanitized_ticker, period="1y")
        if df.empty or len(df) < 30: return jsonify({"error": "Insufficient historical data."}), 404
        ensemble_preds, individual_preds = ensemble_predict(df, days_ahead=6)
        if ensemble_preds is None: return jsonify({"error": "Ensemble prediction failed."}), 500
        recent_close = float(df["Close"].iloc[-1])
        recent_date = df.index[-1]
        future_dates = [recent_date + pd.Timedelta(days=i + 1) for i in range(6)]
        response = {
            "symbol": info.get('symbol', ticker.upper()), "companyName": info.get('longName', 'N/A'),
            "recentDate": recent_date.strftime('%Y-%m-%d'), "recentClose": round(recent_close, 2),
            "recentPredicted": round(float(ensemble_preds[0]), 2),
            "predictions": [{"date": date.strftime('%Y-%m-%d'), "predictedClose": round(float(pred), 2)}
                            for date, pred in zip(future_dates, ensemble_preds)],
            "modelBreakdown": {model_name: [round(float(p), 2) for p in preds]
                               for model_name, preds in individual_preds.items()},
            "modelsUsed": list(individual_preds.keys()), "ensembleMethod": "weighted_average",
            "confidence": round(95.0 - (np.std(list(individual_preds.values())) * 2), 1) if len(
                individual_preds) > 1 else 85.0
        }
        return jsonify(response)
    except Exception as e:
        print(f"Error in ensemble prediction for {ticker}: {e}")
        return jsonify({"error": f"Ensemble prediction failed: {str(e)}"}), 500


# --- Paper Trading Endpoints (Using JSON persistence) ---

def record_portfolio_snapshot(portfolio_data):
    total_value = portfolio_data['cash']
    for ticker, pos in portfolio_data.get("positions", {}).items():
        total_value += pos['shares'] * pos['avg_cost']
    for contract, pos in portfolio_data.get("options_positions", {}).items():
        total_value += pos['quantity'] * pos['avg_cost'] * 100
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO portfolio_history (timestamp, portfolio_value) VALUES (?, ?)",
                       (datetime.now(), total_value))
        conn.commit()
    except Exception as e:
        print(f"Failed to record portfolio snapshot: {e}")
    finally:
        if conn: conn.close()


@app.route('/paper/portfolio', methods=['GET'])
def get_paper_portfolio():
    portfolio = load_portfolio()
    positions = portfolio.get("positions", {})
    options_positions = portfolio.get("options_positions", {})

    total_positions_value = 0
    total_cost_basis_stocks = 0
    total_daily_pl_stocks = 0
    positions_list = []

    # --- 1. PROCESS STOCK POSITIONS ---
    # We use yf.download for stocks because it's fast for multiple symbols
    tickers_to_fetch = list(positions.keys())
    if tickers_to_fetch:
        try:
            data = yf.download(tickers_to_fetch, period="2d")
            if not data.empty:
                current_prices = data['Close'].iloc[-1]
                prev_close_prices = data['Close'].iloc[0]

                for ticker, pos in positions.items():
                    shares = float(pos["shares"])
                    avg_cost = float(pos["avg_cost"])

                    if len(tickers_to_fetch) == 1:
                        current_price = float(current_prices)
                        prev_close = float(prev_close_prices)
                    else:
                        current_price = float(current_prices.get(ticker, 0))
                        prev_close = float(prev_close_prices.get(ticker, 0))

                    if pd.isna(current_price) or current_price == 0: current_price = avg_cost
                    if pd.isna(prev_close): prev_close = current_price

                    cost_basis = shares * avg_cost
                    current_value = shares * current_price
                    total_pl = current_value - cost_basis
                    total_pl_percent = (total_pl / cost_basis * 100) if cost_basis > 0 else 0
                    daily_pl = shares * (current_price - prev_close)
                    daily_pl_percent = ((current_price - prev_close) / prev_close * 100) if prev_close > 0 else 0

                    total_positions_value += current_value
                    total_cost_basis_stocks += cost_basis
                    total_daily_pl_stocks += daily_pl

                    positions_list.append({
                        "ticker": ticker,
                        "company_name": yf.Ticker(ticker).info.get('longName', 'N/A'),
                        "shares": shares,
                        "avg_cost": round(avg_cost, 2),
                        "current_price": round(current_price, 2),
                        "current_value": round(current_value, 2),
                        "cost_basis": round(cost_basis, 2),
                        "total_pl": round(total_pl, 2),
                        "total_pl_percent": round(total_pl_percent, 2),
                        "daily_pl": round(daily_pl, 2),
                        "daily_pl_percent": round(daily_pl_percent, 2),
                        "isOption": False
                    })
        except Exception as e:
            print(f"Error processing stock positions: {e}")
            for ticker, pos in positions.items():
                positions_list.append({
                    "ticker": ticker, "company_name": "N/A (Error)", "shares": pos["shares"],
                    "avg_cost": round(pos["avg_cost"], 2), "current_price": round(pos["avg_cost"], 2),
                    "current_value": round(pos["shares"] * pos["avg_cost"], 2),
                    "cost_basis": round(pos["shares"] * pos["avg_cost"], 2),
                    "total_pl": 0, "total_pl_percent": 0, "daily_pl": 0, "daily_pl_percent": 0, "isOption": False
                })

    # --- 2. PROCESS OPTIONS POSITIONS (ENHANCED PRICE DISCOVERY) ---
    options_positions_list = []
    total_options_value = 0

    for contract_symbol, pos in options_positions.items():
        # Fallback to the original buy price (avg_cost) if all else fails
        current_price = float(pos["avg_cost"])
        fetched_successfully = False

        try:
            opt_ticker = yf.Ticker(contract_symbol)

            # Strategy A: Use .history() - Often the most reliable way to get the real-time mark
            # for specific OCC option symbols.
            hist = opt_ticker.history(period="1d")
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
                fetched_successfully = True

            # Strategy B: If history is empty (market closed/illiquid), check live Bid/Ask
            if not fetched_successfully:
                info = opt_ticker.info
                # We check Bid/Ask/Last in order of priority
                live_val = info.get('bid') or info.get('ask') or info.get('regularMarketPrice') or info.get('lastPrice')

                if live_val and live_val > 0:
                    current_price = float(live_val)
                    fetched_successfully = True

            # Strategy C: Check the fast_info attribute as a final attempt
            if not fetched_successfully:
                fast_val = opt_ticker.fast_info.get('last_price')
                if fast_val and fast_val > 0:
                    current_price = float(fast_val)

        except Exception as e:
            print(f"Warning: Could not fetch live price for option {contract_symbol}: {e}")

        # Standard Option Calculation: (Quantity * Price * 100 multiplier)
        current_value = pos["quantity"] * current_price * 100
        cost_basis = pos["quantity"] * pos["avg_cost"] * 100
        total_pl = current_value - cost_basis
        total_pl_percent = (total_pl / cost_basis * 100) if cost_basis > 0 else 0

        total_options_value += current_value

        options_positions_list.append({
            "ticker": contract_symbol,
            "company_name": contract_symbol,
            "shares": pos["quantity"],
            "avg_cost": round(pos["avg_cost"], 2),
            "current_price": round(current_price, 2),  # This should now show 0.86
            "current_value": round(current_value, 2),
            "cost_basis": round(cost_basis, 2),
            "total_pl": round(total_pl, 2),
            "total_pl_percent": round(total_pl_percent, 2),
            "daily_pl": 0,
            "daily_pl_percent": 0,
            "isOption": True
        })

    # --- 3. AGGREGATE TOTALS ---
    total_portfolio_value = portfolio["cash"] + total_positions_value + total_options_value
    starting_cash = portfolio.get("starting_cash", 100000.0)
    total_pl = total_portfolio_value - starting_cash
    total_return = (total_pl / starting_cash * 100) if starting_cash > 0 else 0

    return jsonify({
        "cash": round(portfolio["cash"], 2),
        "positions_value": round(total_positions_value, 2),
        "options_value": round(total_options_value, 2),
        "total_value": round(total_portfolio_value, 2),
        "starting_value": starting_cash,
        "total_pl": round(total_pl, 2),
        "total_return": round(total_return, 2),
        "positions": positions_list,
        "options_positions": options_positions_list
    })


@app.route('/paper/buy', methods=['POST'])
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['ticker', 'shares'])
def buy_stock():
    portfolio = load_portfolio()
    try:
        data = request.get_json();
        ticker = data.get('ticker', '').upper();
        shares = float(data.get('shares', 0))
        if shares <= 0: return jsonify({"error": "Shares must be positive"}), 400
        stock = yf.Ticker(ticker);
        info = stock.info;
        price = info.get('regularMarketPrice')
        if price is None or price == 0: price = info.get('previousClose', 0)
        if price is None or price == 0: return jsonify({"error": f"Could not get price for {ticker}"}), 404
        total_cost = shares * price
        if total_cost > portfolio["cash"]:
            return jsonify({"error": f"Insufficient cash. Need ${total_cost:.2f}, have ${portfolio['cash']:.2f}"}), 400
        pos = portfolio["positions"].get(ticker, {"shares": 0, "avg_cost": 0})
        new_total_shares = pos["shares"] + shares
        new_avg_cost = ((pos["avg_cost"] * pos["shares"]) + total_cost) / new_total_shares
        portfolio["positions"][ticker] = {"shares": new_total_shares, "avg_cost": new_avg_cost}
        portfolio["cash"] -= total_cost
        trade = {"type": "BUY", "ticker": ticker, "shares": shares, "price": price, "total": total_cost,
                 "timestamp": datetime.now().isoformat()}
        portfolio["trade_history"].append(trade)
        portfolio["transactions"].append(
            {"date": datetime.now().strftime('%Y-%m-%d'), "type": "BUY", "ticker": ticker, "shares": shares,
             "price": price, "total": total_cost})
        save_portfolio(portfolio)
        record_portfolio_snapshot(portfolio)
        return jsonify({"success": True, "message": f"Bought {shares} shares of {ticker} at ${price:.2f}"}), 200
    except Exception as e:
        log_api_error(logger, '/paper/buy', e)
        return jsonify({"error": "Failed to execute buy order"}), 500


@app.route('/paper/sell', methods=['POST'])
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['ticker', 'shares'])
def sell_stock():
    portfolio = load_portfolio()
    try:
        data = request.get_json();
        ticker = data.get('ticker', '').upper();
        shares = float(data.get('shares', 0))
        if shares <= 0: return jsonify({"error": "Shares must be positive"}), 400
        pos = portfolio["positions"].get(ticker)
        if not pos or pos["shares"] < shares:
            return jsonify(
                {"error": f"Not enough shares. You have {pos.get('shares', 0)}, trying to sell {shares}"}), 400
        stock = yf.Ticker(ticker);
        info = stock.info;
        price = info.get('regularMarketPrice')
        if price is None or price == 0: price = info.get('previousClose', 0)
        if price is None or price == 0: return jsonify({"error": f"Could not get price for {ticker}"}), 404
        proceeds = shares * price;
        profit = proceeds - (shares * pos["avg_cost"])
        pos["shares"] -= shares
        if pos["shares"] == 0: del portfolio["positions"][ticker]
        portfolio["cash"] += proceeds
        trade = {"type": "SELL", "ticker": ticker, "shares": shares, "price": price, "total": proceeds,
                 "profit": profit, "timestamp": datetime.now().isoformat()}
        portfolio["trade_history"].append(trade)
        portfolio["transactions"].append(
            {"date": datetime.now().strftime('%Y-%m-%d'), "type": "SELL", "ticker": ticker, "shares": shares,
             "price": price, "total": proceeds})
        save_portfolio(portfolio)
        record_portfolio_snapshot(portfolio)
        return jsonify({"success": True, "message": f"Sold {shares} shares of {ticker} at ${price:.2f}",
                        "profit": round(profit, 2)}), 200
    except Exception as e:
        log_api_error(logger, '/paper/sell', e)
        return jsonify({"error": "Failed to execute sell order"}), 500


@app.route('/paper/options/buy', methods=['POST'])
def buy_option():
    portfolio = load_portfolio()
    try:
        data = request.get_json();
        contract_symbol = data.get('contractSymbol');
        quantity = int(data.get('quantity', 0));
        price = float(data.get('price', 0))
        if quantity <= 0: return jsonify({"error": "Quantity must be positive"}), 400
        if price == 0: return jsonify({"error": "Cannot buy an option with no premium."}), 400
        total_cost = quantity * price * 100
        if total_cost > portfolio["cash"]:
            return jsonify({"error": f"Insufficient cash. Need ${total_cost:.2f}, have ${portfolio['cash']:.2f}"}), 400
        pos = portfolio["options_positions"].get(contract_symbol, {"quantity": 0, "avg_cost": 0})
        new_total_quantity = pos["quantity"] + quantity
        new_avg_cost = ((pos["avg_cost"] * pos["quantity"]) + (price * quantity)) / new_total_quantity
        portfolio["options_positions"][contract_symbol] = {"quantity": new_total_quantity, "avg_cost": new_avg_cost}
        portfolio["cash"] -= total_cost
        trade = {"type": "BUY_OPTION", "ticker": contract_symbol, "shares": quantity, "price": price,
                 "total": total_cost, "timestamp": datetime.now().isoformat()}
        portfolio["trade_history"].append(trade)
        save_portfolio(portfolio)
        record_portfolio_snapshot(portfolio)
        return jsonify(
            {"success": True, "message": f"Bought {quantity} {contract_symbol} contract(s) at ${price:.2f}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/paper/options/sell', methods=['POST'])
def sell_option():
    portfolio = load_portfolio()
    try:
        data = request.get_json();
        contract_symbol = data.get('contractSymbol');
        quantity = int(data.get('quantity', 0));
        price = float(data.get('price', 0))
        if quantity <= 0: return jsonify({"error": "Quantity must be positive"}), 400
        if price == 0: return jsonify({"error": "Cannot sell an option for no premium."}), 400
        pos = portfolio["options_positions"].get(contract_symbol)
        if not pos or pos["quantity"] < quantity:
            return jsonify(
                {"error": f"Not enough contracts. You have {pos.get('quantity', 0)}, trying to sell {quantity}"}), 400
        proceeds = quantity * price * 100
        profit = proceeds - (quantity * pos["avg_cost"] * 100)
        pos["quantity"] -= quantity
        if pos["quantity"] == 0: del portfolio["options_positions"][contract_symbol]
        portfolio["cash"] += proceeds
        trade = {"type": "SELL_OPTION", "ticker": contract_symbol, "shares": quantity, "price": price,
                 "total": proceeds, "profit": profit, "timestamp": datetime.now().isoformat()}
        portfolio["trade_history"].append(trade)
        save_portfolio(portfolio)
        record_portfolio_snapshot(portfolio)
        return jsonify({"success": True, "message": f"Sold {quantity} {contract_symbol} contract(s) at ${price:.2f}",
                        "profit": round(profit, 2)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- This is YOUR corrected portfolio history endpoint ---
@app.route('/paper/history', methods=['GET'])
def get_paper_history():
    portfolio = load_portfolio()
    transactions = portfolio.get("transactions", [])
    if not transactions:
        return jsonify({"dates": [], "values": [], "summary": {}})
    try:
        first_tx_date = datetime.strptime(transactions[0]["date"], '%Y-%m-%d').date()
    except (IndexError, ValueError):
        return jsonify({"dates": [], "values": [], "summary": {}})

    period = request.args.get('period', 'ytd');
    today = date.today()
    if period == '1m':
        start_date = today - timedelta(days=30)
    elif period == '3m':
        start_date = today - timedelta(days=90)
    elif period == '1y':
        start_date = today - timedelta(days=365)
    elif period == 'ytd':
        start_date = date(today.year, 1, 1)
    else:
        start_date = first_tx_date
    end_date = today
    if start_date > end_date: start_date = end_date
    if start_date < first_tx_date: start_date = first_tx_date

    all_tickers = list(set([t["ticker"] for t in transactions if t["type"] in ["BUY", "SELL"]]))
    if not all_tickers:
        return jsonify({"dates": [], "values": [], "summary": {}})

    try:
        hist_data = yf.download(all_tickers, start=start_date - timedelta(days=7), end=end_date + timedelta(days=1))
        if hist_data.empty:
            return jsonify({"error": "Could not fetch historical data for portfolio tickers."}), 500

        close_prices_raw = hist_data.get('Close')
        if close_prices_raw is None:
            return jsonify({"error": "Could not get 'Close' price data from yfinance."}), 500

        if isinstance(close_prices_raw, pd.Series):
            close_prices = pd.DataFrame({all_tickers[0]: close_prices_raw})
        elif isinstance(close_prices_raw, (float, np.float64)):
            close_prices = pd.DataFrame({all_tickers[0]: [close_prices_raw]}, index=hist_data.index)
        else:
            close_prices = close_prices_raw

        initial_cash = 100000.0;
        initial_positions = {};
        net_contributions = 0
        for tx in transactions:
            tx_date = datetime.strptime(tx["date"], '%Y-%m-%d').date()
            if tx_date < start_date:
                shares = float(tx["shares"]);
                total = float(tx["total"]);
                ticker = tx["ticker"]
                if tx["type"] == "BUY":
                    initial_cash -= total
                    initial_positions[ticker] = initial_positions.get(ticker, 0) + shares
                elif tx["type"] == "SELL":
                    initial_cash += total
                    initial_positions[ticker] -= shares

        start_value = initial_cash
        for ticker, shares in initial_positions.items():
            if shares > 0 and ticker in close_prices.columns:
                try:
                    price = close_prices[ticker].asof(start_date)
                    if not pd.isna(price): start_value += shares * float(price)
                except (KeyError, TypeError):
                    pass

        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        portfolio_values = [];
        current_cash = initial_cash;
        current_positions = initial_positions.copy()
        tx_by_date = {}
        for tx in transactions:
            tx_date = datetime.strptime(tx["date"], '%Y-%m-%d').date()
            if start_date <= tx_date <= end_date:
                if tx_date not in tx_by_date: tx_by_date[tx_date] = []
                tx_by_date[tx_date].append(tx)

        for day in date_range:
            day_str = day.strftime('%Y-%m-%d')
            if day.date() in tx_by_date:
                for tx in tx_by_date[day.date()]:
                    shares = float(tx["shares"]);
                    total = float(tx["total"]);
                    ticker = tx["ticker"]
                    if tx["type"] == "BUY":
                        current_cash -= total
                        current_positions[ticker] = current_positions.get(ticker, 0) + shares
                    elif tx["type"] == "SELL":
                        current_cash += total
                        current_positions[ticker] -= shares
            total_holdings_value = 0
            for ticker, shares in current_positions.items():
                if shares > 0 and ticker in close_prices.columns:
                    try:
                        price = close_prices[ticker].asof(day)
                        if not pd.isna(price): total_holdings_value += shares * float(price)
                    except (KeyError, TypeError):
                        pass
            portfolio_values.append({"date": day_str, "value": total_holdings_value + current_cash})

        end_value = portfolio_values[-1]["value"] if portfolio_values else start_value
        wealth_generated = end_value - start_value - net_contributions
        if start_value == 0 or start_value is None:
            return_cumulative = 0 if wealth_generated == 0 else float('inf')
        else:
            return_cumulative = (wealth_generated / start_value) * 100
        num_days = (end_date - start_date).days
        if num_days <= 0:
            return_annualized = return_cumulative
        elif num_days < 365:
            return_annualized = return_cumulative * (365.0 / num_days)
        else:
            return_annualized = ((1 + (return_cumulative / 100)) ** (365.0 / num_days) - 1) * 100

        summary = {
            "period": period, "start_date": start_date.strftime('%Y-%m-%d'),
            "end_date": end_date.strftime('%Y-%m-%d'), "start_value": round(start_value, 2),
            "end_value": round(end_value, 2), "wealth_generated": round(wealth_generated, 2),
            "return_cumulative_pct": round(return_cumulative, 2),
            "return_annualized_pct": round(return_annualized, 2)
        }
        return jsonify({
            "dates": [pv["date"] for pv in portfolio_values],
            "values": [round(pv["value"], 2) for pv in portfolio_values],
            "summary": summary
        })
    except Exception as e:
        print(f"Error in /paper/history: {e}")
        return jsonify({"error": f"Failed to build history: {str(e)}"}), 500


@app.route('/paper/transactions', methods=['GET'])
def get_trade_history():
    portfolio = load_portfolio()
    return jsonify(portfolio.get("trade_history", [])[-50:])


@app.route('/paper/reset', methods=['POST'])
def reset_portfolio():
    new_portfolio = {
        "cash": 100000.0, "starting_cash": 100000.0, "positions": {},
        "options_positions": {}, "transactions": [], "trade_history": []
    }
    save_portfolio(new_portfolio)
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM portfolio_history")
        cursor.execute("INSERT INTO portfolio_history (timestamp, portfolio_value) VALUES (?, ?)",
                       (datetime.now(), 100000.0))
        conn.commit()
    except Exception as e:
        print(f"Failed to reset portfolio_history table: {e}")
    finally:
        if conn: conn.close()
    return jsonify({"success": True, "message": "Portfolio reset to starting state",
                    "starting_cash": new_portfolio["starting_cash"]})


# --- NEW: Notification Endpoints ---
@app.route('/notifications', methods=['GET', 'POST'])
def handle_notifications():
    notifications = load_notifications()

    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data or 'ticker' not in data or 'condition' not in data or 'target_price' not in data:
                return jsonify({"error": "Missing required fields (ticker, condition, target_price)"}), 400

            # Check if ticker is valid
            try:
                stock = yf.Ticker(data['ticker']).info
                if stock.get('regularMarketPrice') is None:
                    return jsonify({"error": f"Invalid ticker: {data['ticker']}"}), 400
            except Exception:
                return jsonify({"error": f"Invalid ticker: {data['ticker']}"}), 400

            new_alert = {
                "id": str(uuid.uuid4()),
                "ticker": data['ticker'].upper(),
                "condition": data['condition'],
                "target_price": float(data['target_price']),
                "created_at": datetime.now().isoformat()
            }
            notifications['active'].append(new_alert)
            save_notifications(notifications)
            return jsonify(new_alert), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # GET request
    return jsonify(notifications.get('active', []))


@app.route('/notifications/smart', methods=['POST'])
def create_smart_alert():
    try:
        data = request.json
        prompt = data.get('prompt', '').strip()  # Keep case for now

        # --- 1. IMPROVED AI PARSING LOGIC ---

        # A. Detect Ticker
        # Common Name Mapping
        ticker_map = {
            'apple': 'AAPL', 'tesla': 'TSLA', 'microsoft': 'MSFT',
            'nvidia': 'NVDA', 'amazon': 'AMZN', 'google': 'GOOGL',
            'bitcoin': 'BTC-USD', 'meta': 'META', 'netflix': 'NFLX',
            'ai': 'NVDA', 'artificial intelligence': 'NVDA',  # Proxy for AI queries
            'sp500': '^GSPC', 'market': '^GSPC'
        }

        detected_ticker = None
        prompt_lower = prompt.lower()

        # 1. Check known names first (multi-word aware)
        for name, symbol in ticker_map.items():
            if name in prompt_lower:
                detected_ticker = symbol
                break

        # 2. If no name found, look for explicit uppercase tickers in original prompt
        if not detected_ticker:
            # Filter out common stopwords that might look like tickers
            stop_tickers = {
                'ME', 'MY', 'I', 'WE', 'US', 'THE', 'IS', 'AT', 'ON', 'IN', 'TO',
                'FOR', 'OF', 'BY', 'AN', 'UP', 'DO', 'GO', 'OR', 'IF', 'BE',
                'ARE', 'IT', 'AS', 'HI', 'LO', 'NEW', 'OLD', 'BIG', 'BUY', 'SELL',
                'ALERT', 'NOTIFY', 'TELL', 'SHOW', 'WHEN', 'WHAT', 'WHERE',
                'HOW', 'WHY', 'WHO', 'DROP', 'FALL', 'RISE', 'GAIN', 'TODAY',
                'NEWS', 'REPORT', 'DATA', 'INFO', 'THIS', 'THAT', 'THESE', 'THOSE'
            }

            words = re.findall(r'\b[A-Z]{1,5}\b', prompt)  # Only uppercase words 1-5 chars
            for word in words:
                if word not in stop_tickers:
                    # Validate if it's likely a ticker (simple heuristic: not a common word)
                    detected_ticker = word
                    break

        if not detected_ticker:
            return jsonify({
                               'error': 'Could not identify a specific stock or asset. Try mentioning "Apple", "TSLA", or "Bitcoin".'}), 400

        # B. Detect Intent & Targets
        alert_type = 'price'
        condition = 'above'
        target_price = 0.0

        # Check for News intent
        if any(x in prompt_lower for x in
               ['news', 'earnings', 'report', 'releasing', 'announce', 'article', 'headline']):
            alert_type = 'news'
            condition = 'news_release'
            target_price = 0
        else:
            # Price Intent
            # Check direction
            is_drop = any(
                x in prompt_lower for x in ['drop', 'fall', 'below', 'less', 'under', 'loss', 'down', 'crash'])
            condition = 'below' if is_drop else 'above'

            # Check for Percentage
            pct_match = re.search(r'(\d+(?:\.\d+)?)%', prompt)
            price_match = re.search(r'\$\s?(\d+(?:\.\d+)?)', prompt)
            number_match = re.search(r'\b(\d+(?:\.\d+)?)\b', prompt)

            current_price = 0.0
            # Fetch current price for calculations
            try:
                ticker_obj = yf.Ticker(detected_ticker)
                # fast_info is faster/reliable
                current_price = ticker_obj.fast_info.get('last_price', 0)
                if current_price == 0:
                    current_price = ticker_obj.info.get('regularMarketPrice', 0)
            except:
                pass

            if pct_match and current_price > 0:
                pct = float(pct_match.group(1))
                if is_drop:
                    target_price = current_price * (1 - (pct / 100))
                else:
                    target_price = current_price * (1 + (pct / 100))
            elif price_match:
                target_price = float(price_match.group(1))
            elif number_match:
                # If just a raw number is found (e.g. "hits 100"), assume it's the price
                # But filter out numbers that look like dates or small quantities if necessary
                # For simplicity, take the first number
                val = float(number_match.group(1))
                # Heuristic: if value is < 5 and stock is > 100, might be % without sign?
                # Let's trust user input for now unless it matches the percentage logic
                target_price = val
            else:
                # Default if no number found but price intent detected (e.g. "alert if apple drops")
                # Set target slightly below current
                if is_drop:
                    target_price = current_price * 0.99
                else:
                    target_price = current_price * 1.01

        # --- 2. CREATE AND SAVE ALERT ---
        notifications = load_notifications()  # returns {'active': [], 'triggered': []}

        new_alert = {
            "id": str(uuid.uuid4()),
            "ticker": detected_ticker,
            "condition": condition,
            "target_price": target_price,
            "type": alert_type,  # 'price' or 'news'
            "prompt": prompt,  # Save original text for reference
            "active": True,
            "created_at": datetime.now().isoformat()
        }

        notifications['active'].append(new_alert)
        save_notifications(notifications)

        return jsonify({
            'message': 'Smart alert created successfully',
            'interpretation': f"Watching {detected_ticker} for {condition} events.",
            'alert': new_alert
        })

    except Exception as e:
        print(f"Smart Alert Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/notifications/<string:alert_id>', methods=['DELETE'])
def delete_notification(alert_id):
    notifications = load_notifications()
    notifications['active'] = [a for a in notifications['active'] if a['id'] != alert_id]
    save_notifications(notifications)
    return jsonify({"message": "Alert deleted"}), 200


@app.route('/notifications/triggered', methods=['GET', 'DELETE'])
def get_triggered_notifications():
    notifications = load_notifications()

    if request.method == 'GET':
        # Check for 'all' query param
        if request.args.get('all') == 'true':
            return jsonify(notifications.get('triggered', []))

        # Default behavior: return only unseen
        unseen_alerts = [a for a in notifications['triggered'] if not a.get('seen', False)]
        # Mark them as 'seen'
        for alert in notifications['triggered']:
            alert['seen'] = True
        save_notifications(notifications)
        return jsonify(unseen_alerts)

    # DELETE request
    if request.args.get('id'):
        alert_id = request.args.get('id')
        notifications['triggered'] = [a for a in notifications['triggered'] if a['id'] != alert_id]
    else:
        # Clear all
        notifications['triggered'] = []
    save_notifications(notifications)
    return jsonify({"message": "Triggered alerts cleared"}), 200


@app.route('/notifications/triggered/<string:alert_id>', methods=['DELETE'])
def delete_triggered_notification(alert_id):
    notifications = load_notifications()
    notifications['triggered'] = [a for a in notifications['triggered'] if a['id'] != alert_id]
    save_notifications(notifications)
    return jsonify({"message": "Alert dismissed"}), 200


# --- END NEW NOTIFICATION ENDPOINTS ---


# --- NEW: Background Price Checker ---
def check_alerts():
    print(f"[{datetime.now()}] Running price alert check...")
    notifications_data = load_notifications()
    if not notifications_data['active']:
        return  # No active alerts, do nothing

    active_alerts_copy = notifications_data['active'].copy()
    tickers_to_check = list(set([a['ticker'] for a in active_alerts_copy]))

    try:
        data = yf.download(tickers_to_check, period="1d")
        if data.empty:
            print("Price check: yfinance returned no data.")
            return

        current_prices = data['Close'].iloc[-1]

        triggered_ids = []
        for alert in active_alerts_copy:
            try:
                # Check for NEWS alerts first
                if alert.get('type') == 'news':
                    # Use yfinance news
                    try:
                        ticker_obj = yf.Ticker(alert['ticker'])
                        news_items = ticker_obj.news
                        if news_items:
                            latest_news = news_items[0]
                            # Check if news is from today (or very recent)
                            pub_time = latest_news.get('providerPublishTime')
                            if pub_time:
                                pub_dt = datetime.fromtimestamp(pub_time)
                                # Trigger if news is from last 24 hours
                                if (datetime.now() - pub_dt).total_seconds() < 86400:  # 24 hours
                                    # Trigger alert
                                    triggered_alert = {
                                        "id": str(uuid.uuid4()),
                                        "message": f"NEWS: {latest_news.get('title')} ({alert['ticker']})",
                                        "seen": False,
                                        "timestamp": datetime.now().isoformat()
                                    }
                                    notifications_data['triggered'].append(triggered_alert)
                                    triggered_ids.append(alert['id'])
                    except Exception as news_err:
                        print(f"News check error: {news_err}")
                    continue  # Skip price check for news alerts

                # Price Check Logic
                if len(tickers_to_check) == 1:
                    current_price = float(current_prices)
                else:
                    current_price = float(current_prices.get(alert['ticker'], 0))

                if current_price == 0:
                    continue  # Skip if price is 0

                target_price = alert['target_price']
                condition_met = False

                if alert['condition'] == 'below' and current_price < target_price:
                    condition_met = True
                    message = f"{alert['ticker']} is now ${current_price:.2f} (below your target of ${target_price:.2f})"
                elif alert['condition'] == 'above' and current_price > target_price:
                    condition_met = True
                    message = f"{alert['ticker']} is now ${current_price:.2f} (above your target of ${target_price:.2f})"

                if condition_met:
                    print(f"Triggering alert for {alert['ticker']}")
                    triggered_alert = {
                        "id": str(uuid.uuid4()),
                        "message": message,
                        "seen": False,
                        "timestamp": datetime.now().isoformat()
                    }
                    notifications_data['triggered'].append(triggered_alert)
                    triggered_ids.append(alert['id'])

            except Exception as e:
                print(f"Error checking alert for {alert['ticker']}: {e}")

        # Remove triggered alerts from active list
        if triggered_ids:
            notifications_data['active'] = [a for a in notifications_data['active'] if a['id'] not in triggered_ids]
            save_notifications(notifications_data)
            print(f"Triggered and moved {len(triggered_ids)} alerts.")

    except Exception as e:
        print(f"Failed to check all alert prices: {e}")


def run_scheduler():
    schedule.every(1).minutes.do(check_alerts)
    while True:
        schedule.run_pending()
        time.sleep(1)


# --- END BACKGROUND CHECKER ---


# --- All of Tazeem's other endpoints (Forex, Crypto, etc.) ---
@app.route('/api/news', methods=['GET'])
def news_api():
    try:
        articles = get_general_news();
        return jsonify(articles)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch news: {str(e)}"}), 500


@app.route('/evaluate/<string:ticker>')
@limiter.limit(RateLimits.HEAVY)
def evaluate_models(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0]
        test_days = int(request.args.get('test_days', 60))
        retrain_frequency = int(request.args.get('retrain_frequency', 5))
        result = rolling_window_backtest(sanitized_ticker, test_days=test_days, retrain_frequency=retrain_frequency)
        if result is None: return jsonify({"error": "Insufficient data for evaluation"}), 404
        return jsonify(result)
    except Exception as e:
        print(f"Evaluation error for {ticker}: {e}")
        return jsonify({"error": f"Evaluation failed: {str(e)}"}), 500


@app.route('/forex/convert')
def forex_convert():
    try:
        from_currency = request.args.get('from', 'USD').upper();
        to_currency = request.args.get('to', 'EUR').upper()
        rate_data = get_exchange_rate(from_currency, to_currency)
        if rate_data is None: return jsonify({"error": "Could not fetch exchange rate"}), 404
        return jsonify(rate_data)
    except Exception as e:
        print(f"Forex convert error: {e}")
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 500


@app.route('/forex/currencies')
def forex_currencies():
    try:
        currencies = get_currency_list();
        return jsonify(currencies)
    except Exception as e:
        print(f"Forex currencies error: {e}")
        return jsonify({"error": f"Failed to fetch currencies: {str(e)}"}), 500


@app.route('/crypto/convert')
def crypto_convert():
    try:
        from_crypto = request.args.get('from', 'BTC').upper();
        to_currency = request.args.get('to', 'USD').upper()
        rate_data = get_crypto_exchange_rate(from_crypto, to_currency)
        if rate_data is None: return jsonify({"error": "Could not fetch crypto exchange rate"}), 404
        return jsonify(rate_data)
    except Exception as e:
        print(f"Crypto convert error: {e}")
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 500


@app.route('/crypto/list')
def crypto_list():
    try:
        cryptos = get_crypto_list();
        return jsonify(cryptos)
    except Exception as e:
        print(f"Crypto list error: {e}")
        return jsonify({"error": f"Failed to fetch crypto list: {str(e)}"}), 500


@app.route('/crypto/currencies')
def crypto_target_currencies():
    try:
        currencies = get_target_currencies();
        return jsonify(currencies)
    except Exception as e:
        print(f"Crypto currencies error: {e}")
        return jsonify({"error": f"Failed to fetch currencies: {str(e)}"}), 500


@app.route('/commodities/price/<string:commodity>')
def commodity_price(commodity):
    try:
        period = request.args.get('period', '5d')
        data = get_commodity_price(commodity, period)
        if data is None: return jsonify({"error": "Could not fetch commodity price"}), 404
        return jsonify(data)
    except Exception as e:
        print(f"Commodity price error: {e}")
        return jsonify({"error": f"Failed to fetch commodity: {str(e)}"}), 500


@app.route('/commodities/list')
def commodities_list():
    try:
        commodities = get_commodity_list();
        return jsonify(commodities)
    except Exception as e:
        print(f"Commodities list error: {e}")
        return jsonify({"error": f"Failed to fetch commodities: {str(e)}"}), 500


@app.route('/commodities/all')
def commodities_all():
    try:
        commodities = get_commodities_by_category();
        return jsonify(commodities)
    except Exception as e:
        print(f"Commodities all error: {e}")
        return jsonify({"error": f"Failed to fetch all commodities: {str(e)}"}), 500


# ============================================================
# PREDICTION MARKETS ENDPOINTS (Standalone Feature)
# ============================================================

@app.route('/prediction-markets', methods=['GET'])
@limiter.limit(RateLimits.STANDARD)
def list_prediction_markets():
    """List prediction markets with optional search and exchange filtering."""
    try:
        exchange = request.args.get('exchange', 'polymarket')
        limit = request.args.get('limit', 50, type=int)
        search = request.args.get('search', '').strip()

        if limit < 1 or limit > 200:
            return jsonify({"error": "Limit must be between 1 and 200"}), 400

        if search:
            markets = pm_search_markets(search, exchange, limit)
        else:
            markets = pm_fetch_markets(exchange, limit)

        return jsonify({
            "exchange": exchange,
            "count": len(markets),
            "markets": markets
        })
    except Exception as e:
        log_api_error(logger, '/prediction-markets', e)
        return jsonify({"error": f"Failed to fetch prediction markets: {str(e)}"}), 500


@app.route('/prediction-markets/exchanges', methods=['GET'])
@limiter.limit(RateLimits.LIGHT)
def list_prediction_exchanges():
    """List available prediction market exchanges."""
    return jsonify(pm_get_exchanges())


@app.route('/prediction-markets/<path:market_id>', methods=['GET'])
@limiter.limit(RateLimits.STANDARD)
def get_prediction_market(market_id):
    """Get details for a single prediction market."""
    try:
        exchange = request.args.get('exchange', 'polymarket')
        market = pm_get_market(market_id, exchange)
        if not market:
            return jsonify({"error": f"Market not found"}), 404
        return jsonify(market)
    except Exception as e:
        log_api_error(logger, f'/prediction-markets/{market_id}', e)
        return jsonify({"error": "Failed to fetch market details"}), 500


@app.route('/prediction-markets/portfolio', methods=['GET'])
@limiter.limit(RateLimits.LIGHT)
def get_prediction_portfolio():
    """Get the prediction markets paper trading portfolio with live P&L."""
    try:
        portfolio = load_prediction_portfolio()
        positions = portfolio.get("positions", {})
        positions_list = []
        total_positions_value = 0

        for pos_key, pos in positions.items():
            market_id = pos.get("market_id", "")
            outcome = pos.get("outcome", "")
            exchange = pos.get("exchange", "polymarket")
            contracts = pos["contracts"]
            avg_cost = pos["avg_cost"]
            question = pos.get("question", "Unknown Market")

            current_price = avg_cost
            prices = pm_get_prices(market_id, exchange)
            if prices and outcome in prices:
                current_price = prices[outcome]

            current_value = contracts * current_price
            cost_basis = contracts * avg_cost
            total_pl = current_value - cost_basis
            total_pl_percent = (total_pl / cost_basis * 100) if cost_basis > 0 else 0

            total_positions_value += current_value

            positions_list.append({
                "position_key": pos_key,
                "market_id": market_id,
                "question": question,
                "outcome": outcome,
                "contracts": contracts,
                "avg_cost": round(avg_cost, 4),
                "current_price": round(current_price, 4),
                "current_value": round(current_value, 2),
                "cost_basis": round(cost_basis, 2),
                "total_pl": round(total_pl, 2),
                "total_pl_percent": round(total_pl_percent, 2),
            })

        total_value = portfolio["cash"] + total_positions_value
        starting_cash = portfolio.get("starting_cash", 10000.0)
        total_pl = total_value - starting_cash
        total_return = (total_pl / starting_cash * 100) if starting_cash > 0 else 0

        return jsonify({
            "cash": round(portfolio["cash"], 2),
            "positions_value": round(total_positions_value, 2),
            "total_value": round(total_value, 2),
            "starting_value": starting_cash,
            "total_pl": round(total_pl, 2),
            "total_return": round(total_return, 2),
            "positions": positions_list,
        })
    except Exception as e:
        log_api_error(logger, '/prediction-markets/portfolio', e)
        return jsonify({"error": "Failed to load prediction portfolio"}), 500


@app.route('/prediction-markets/buy', methods=['POST'])
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['market_id', 'outcome', 'contracts'])
def buy_prediction_contract():
    """Buy Yes/No contracts on a prediction market at current market price."""
    portfolio = load_prediction_portfolio()
    try:
        data = request.get_json()
        market_id = data['market_id']
        outcome = data['outcome']
        contracts = float(data['contracts'])
        exchange = data.get('exchange', 'polymarket')

        if contracts <= 0:
            return jsonify({"error": "Contracts must be positive"}), 400

        market = pm_get_market(market_id, exchange)
        if not market:
            return jsonify({"error": f"Market not found"}), 404
        if not market["is_open"]:
            return jsonify({"error": "Market is closed for trading"}), 400
        if outcome not in market["prices"]:
            return jsonify({"error": f"Invalid outcome '{outcome}'. Valid: {market['outcomes']}"}), 400

        price = market["prices"][outcome]
        if price <= 0 or price >= 1:
            return jsonify({"error": f"Cannot trade at price {price}"}), 400

        total_cost = contracts * price

        if total_cost > portfolio["cash"]:
            return jsonify({"error": f"Insufficient cash. Need ${total_cost:.2f}, have ${portfolio['cash']:.2f}"}), 400

        pos_key = f"{market_id}::{outcome}"
        pos = portfolio["positions"].get(pos_key, {
            "market_id": market_id,
            "outcome": outcome,
            "exchange": exchange,
            "question": market["question"],
            "contracts": 0,
            "avg_cost": 0
        })

        old_total = pos["contracts"] * pos["avg_cost"]
        new_contracts = pos["contracts"] + contracts
        new_avg_cost = (old_total + total_cost) / new_contracts

        pos["contracts"] = new_contracts
        pos["avg_cost"] = new_avg_cost
        portfolio["positions"][pos_key] = pos
        portfolio["cash"] -= total_cost

        trade = {
            "type": "BUY",
            "market_id": market_id,
            "question": market["question"],
            "outcome": outcome,
            "contracts": contracts,
            "price": price,
            "total": round(total_cost, 4),
            "timestamp": datetime.now().isoformat()
        }
        portfolio["trade_history"].append(trade)
        save_prediction_portfolio(portfolio)

        return jsonify({
            "success": True,
            "message": f"Bought {contracts:.0f} '{outcome}' contracts at ${price:.4f} each",
            "total_cost": round(total_cost, 2)
        }), 200
    except Exception as e:
        log_api_error(logger, '/prediction-markets/buy', e)
        return jsonify({"error": "Failed to execute buy order"}), 500


@app.route('/prediction-markets/sell', methods=['POST'])
@limiter.limit(RateLimits.WRITE)
@validate_request_json(['market_id', 'outcome', 'contracts'])
def sell_prediction_contract():
    """Sell prediction market contracts at current market price."""
    portfolio = load_prediction_portfolio()
    try:
        data = request.get_json()
        market_id = data['market_id']
        outcome = data['outcome']
        contracts = float(data['contracts'])
        exchange = data.get('exchange', 'polymarket')

        if contracts <= 0:
            return jsonify({"error": "Contracts must be positive"}), 400

        pos_key = f"{market_id}::{outcome}"
        pos = portfolio["positions"].get(pos_key)
        if not pos or pos["contracts"] < contracts:
            held = pos["contracts"] if pos else 0
            return jsonify({"error": f"Not enough contracts. Have {held:.0f}, trying to sell {contracts:.0f}"}), 400

        market = pm_get_market(market_id, exchange)
        if not market:
            return jsonify({"error": "Market not found"}), 404

        price = market["prices"].get(outcome, pos["avg_cost"])
        proceeds = contracts * price
        profit = proceeds - (contracts * pos["avg_cost"])

        pos["contracts"] -= contracts
        if pos["contracts"] <= 0:
            del portfolio["positions"][pos_key]

        portfolio["cash"] += proceeds

        trade = {
            "type": "SELL",
            "market_id": market_id,
            "question": market["question"],
            "outcome": outcome,
            "contracts": contracts,
            "price": price,
            "total": round(proceeds, 4),
            "profit": round(profit, 4),
            "timestamp": datetime.now().isoformat()
        }
        portfolio["trade_history"].append(trade)
        save_prediction_portfolio(portfolio)

        return jsonify({
            "success": True,
            "message": f"Sold {contracts:.0f} '{outcome}' contracts at ${price:.4f} each",
            "profit": round(profit, 2)
        }), 200
    except Exception as e:
        log_api_error(logger, '/prediction-markets/sell', e)
        return jsonify({"error": "Failed to execute sell order"}), 500


@app.route('/prediction-markets/history', methods=['GET'])
@limiter.limit(RateLimits.LIGHT)
def get_prediction_trade_history():
    """Get prediction market trade history (last 50 trades)."""
    portfolio = load_prediction_portfolio()
    return jsonify(portfolio.get("trade_history", [])[-50:])


@app.route('/prediction-markets/reset', methods=['POST'])
@limiter.limit(RateLimits.WRITE)
def reset_prediction_portfolio():
    """Reset prediction markets portfolio to starting state."""
    new_portfolio = {
        "cash": 10000.0,
        "starting_cash": 10000.0,
        "positions": {},
        "trade_history": []
    }
    save_prediction_portfolio(new_portfolio)
    return jsonify({
        "success": True,
        "message": "Prediction markets portfolio reset to starting state",
        "starting_cash": 10000.0
    })


@app.route('/fundamentals/<string:ticker>')
def get_fundamentals(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0]
        if not ALPHA_VANTAGE_API_KEY:
            return jsonify({"error": "Alpha Vantage API key not configured"}), 500
            
        url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={sanitized_ticker.upper()}&apikey={ALPHA_VANTAGE_API_KEY}'
        response = requests.get(url)
        data = response.json()
        
        if not data or 'Symbol' not in data:
            return jsonify({"error": f"No fundamental data found for {ticker}"}), 404

        # Map Alpha Vantage keys (PascalCase) to Frontend keys (snake_case)
        formatted_data = {
            "symbol": data.get("Symbol"),
            "name": data.get("Name"),
            "description": data.get("Description"),
            "exchange": data.get("Exchange"),
            "currency": data.get("Currency"),
            "sector": data.get("Sector"),
            "industry": data.get("Industry"),
            "country": data.get("Country"),
            
            # Key Metrics
            "market_cap": clean_value(data.get("MarketCapitalization")),
            "pe_ratio": clean_value(data.get("PERatio")),
            "forward_pe": clean_value(data.get("ForwardPE")),
            "trailing_pe": clean_value(data.get("TrailingPE")),
            "peg_ratio": clean_value(data.get("PEGRatio")),
            "eps": clean_value(data.get("EPS")),
            "beta": clean_value(data.get("Beta")),
            "book_value": clean_value(data.get("BookValue")),
            
            # Dividends
            "dividend_per_share": clean_value(data.get("DividendPerShare")),
            "dividend_yield": clean_value(data.get("DividendYield")),
            "dividend_date": data.get("DividendDate"),
            "ex_dividend_date": data.get("ExDividendDate"),
            
            # Profitability
            "profit_margin": clean_value(data.get("ProfitMargin")),
            "operating_margin_ttm": clean_value(data.get("OperatingMarginTTM")),
            "return_on_assets_ttm": clean_value(data.get("ReturnOnAssetsTTM")),
            "return_on_equity_ttm": clean_value(data.get("ReturnOnEquityTTM")),
            
            # Financials
            "revenue_ttm": clean_value(data.get("RevenueTTM")),
            "gross_profit_ttm": clean_value(data.get("GrossProfitTTM")),
            "diluted_eps_ttm": clean_value(data.get("DilutedEPSTTM")),
            "revenue_per_share_ttm": clean_value(data.get("RevenuePerShareTTM")),
            "quarterly_earnings_growth_yoy": clean_value(data.get("QuarterlyEarningsGrowthYOY")),
            "quarterly_revenue_growth_yoy": clean_value(data.get("QuarterlyRevenueGrowthYOY")),
            
            # Valuation & Price
            "analyst_target_price": clean_value(data.get("AnalystTargetPrice")),
            "price_to_sales_ratio_ttm": clean_value(data.get("PriceToSalesRatioTTM")),
            "price_to_book_ratio": clean_value(data.get("PriceToBookRatio")),
            "ev_to_revenue": clean_value(data.get("EVToRevenue")),
            "ev_to_ebitda": clean_value(data.get("EVToEBITDA")),
            "week_52_high": clean_value(data.get("52WeekHigh")),
            "week_52_low": clean_value(data.get("52WeekLow")),
            "day_50_moving_average": clean_value(data.get("50DayMovingAverage")),
            "day_200_moving_average": clean_value(data.get("200DayMovingAverage")),
            "shares_outstanding": clean_value(data.get("SharesOutstanding")),
        }
        
        return jsonify(formatted_data)

    except Exception as e:
        print(f"Fundamentals error for {ticker}: {e}")
        return jsonify({"error": f"Failed to fetch fundamentals: {str(e)}"}), 500
# --- NEW: Autocomplete Symbol Search (from Jimmy's branch) ---
@app.route('/search-symbols')
def search_symbols():
    query = request.args.get('q')
    if not query: return jsonify([])
    try:
        formatted_matches = get_symbol_suggestions(query)
        return jsonify(formatted_matches)
    except Exception as e:
        print(f"Error in symbol search: {e}")
        return jsonify({"error": str(e)}), 500


# --- Main execution ---
if __name__ == '__main__':
    init_db()  # Initialize the SQLite history table

    # --- NEW: Start the background thread ---
    print("Starting background alert checker...")
    checker_thread = threading.Thread(target=run_scheduler, daemon=True)
    checker_thread.start()

    app.run(debug=True, port=5001, use_reloader=False)  # use_reloader=False is important for threads