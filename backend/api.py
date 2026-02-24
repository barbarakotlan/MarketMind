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
import time

# --- DOTENV MUST BE FIRST ---
from dotenv import load_dotenv

load_dotenv()
# --- END FIX ---

# --- OpenBB (optional, used for financials/filings/screener/macro) ---
try:
    from openbb import obb
    OPENBB_AVAILABLE = True
except ImportError:
    OPENBB_AVAILABLE = False

# --- Imports for advanced screener ---
from finvizfinance.screener.overview import Overview
from finvizfinance.screener.valuation import Valuation
from finvizfinance.screener.financial import Financial

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
        logger.info("Database initialized.")
    except Exception as e:
        logger.error(f"An error occurred during DB initialization: {e}")
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

# --- Screener Cache Setup ---
SCREENER_CACHE = {
    "overview": [],
    "valuation": [],
    "financial": [],
    "last_updated": None,
    "is_updating": False
}

def parse_market_cap(val_str):
    """Helper to convert Finviz string '2.50B' into actual math numbers for filtering."""
    if not val_str or val_str == '-': return 0
    val_str = str(val_str).replace(',', '')
    multiplier = 1
    if val_str.endswith('B'): multiplier = 1e9
    elif val_str.endswith('M'): multiplier = 1e6
    elif val_str.endswith('T'): multiplier = 1e12
    else: return 0
    try:
        return float(val_str[:-1]) * multiplier
    except:
        return 0

def filter_cached_data(data, filters):
    """Manually filters the cached dataset based on user dropdowns."""
    filtered = data
    for key, value in filters.items():
        if key == 'Sector':
            filtered = [row for row in filtered if row.get('Sector') == value]
        elif key == 'Market Cap.':
            filtered_temp = []
            for row in filtered:
                mc_val = parse_market_cap(row.get('Market Cap'))
                if value == 'Mega ($200bln and more)' and mc_val >= 200e9: filtered_temp.append(row)
                elif value == 'Large ($10bln to $200bln)' and 10e9 <= mc_val < 200e9: filtered_temp.append(row)
                elif value == 'Mid ($2bln to $10bln)' and 2e9 <= mc_val < 10e9: filtered_temp.append(row)
                elif value == 'Small ($300mln to $2bln)' and 300e6 <= mc_val < 2e9: filtered_temp.append(row)
                elif value == 'Micro ($50mln to $300mln)' and 50e6 <= mc_val < 300e6: filtered_temp.append(row)
                elif value == 'Nano (under $50mln)' and mc_val < 50e6: filtered_temp.append(row)
            filtered = filtered_temp
    return filtered

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
        logger.warning("Alpha Vantage key not configured. Cannot get suggestions.")
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
        logger.error(f"Error in get_symbol_suggestions: {e}")
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
            logger.warning(f"Could not fetch sparkline data: {e}")
        financials = {}
        try:
            qf = stock.quarterly_financials
            if not qf.empty:
                financials = {
                    "revenue": clean_value(qf.loc['Total Revenue'].iloc[0]) if 'Total Revenue' in qf.index else None,
                    "netIncome": clean_value(qf.loc['Net Income'].iloc[0]) if 'Net Income' in qf.index else None,
                    "quarterendDate": str(qf.columns[0].date()) if not qf.empty else None
                }
        except Exception as e:
            logger.warning(f"Could not fetch quarterly financials: {e}")
        yf_extended = {
            "forwardPE": clean_value(info.get('forwardPE')), "pegRatio": clean_value(info.get('pegRatio')),
            "priceToBook": clean_value(info.get('priceToBook')), "beta": clean_value(info.get('beta')),
            "dividendYield": clean_value(info.get('dividendYield')),
            "numberOfAnalystOpinions": info.get('numberOfAnalystOpinions')
        }
        fundamentals = {}
        if not ALPHA_VANTAGE_API_KEY:
            fundamentals = {
                "peRatio": clean_value(info.get('trailingPE')), "week52High": clean_value(info.get('fiftyTwoWeekHigh')),
                "week52Low": clean_value(info.get('fiftyTwoWeekLow')),
                "analystTargetPrice": clean_value(info.get('targetMeanPrice')),
                "recommendationKey": info.get('recommendationKey'), "overview": info.get('longBusinessSummary'),
                **yf_extended
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
                        "analystTargetPrice": clean_value(data.get("AnalystTargetPrice")), "recommendationKey": "N/A",
                        "priceToBook": clean_value(info.get('priceToBook')),
                        "numberOfAnalystOpinions": info.get('numberOfAnalystOpinions')
                    }
                else:
                    raise Exception("No data from Alpha Vantage")
            except Exception as e:
                logger.warning(f"Could not fetch fundamentals from Alpha Vantage: {e}. Falling back to yfinance.")
                fundamentals = {
                    "peRatio": clean_value(info.get('trailingPE')),
                    "week52High": clean_value(info.get('fiftyTwoWeekHigh')),
                    "week52Low": clean_value(info.get('fiftyTwoWeekLow')),
                    "analystTargetPrice": clean_value(info.get('targetMeanPrice')),
                    "recommendationKey": info.get('recommendationKey'), "overview": info.get('longBusinessSummary'),
                    **yf_extended
                }
        formatted_data = {
            "symbol": info.get('symbol', ticker.upper()), "companyName": info.get('longName', 'N/A'),
            "price": clean_value(price), "change": clean_value(change),
            "changePercent": clean_value(change_percent), "marketCap": market_cap_formatted,
            "sparkline": sparkline, "fundamentals": fundamentals, "financials": financials
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
            logger.warning(f"Could not append prediction to chart: {e}")
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
        logger.error(f"Error getting option chain: {e}")
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
        logger.error(f"Error in suggestion endpoint for {ticker}: {e}")
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
        logger.error(f"Error in ensemble prediction for {ticker}: {e}")
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
        logger.error(f"Failed to record portfolio snapshot: {e}")
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
            logger.error(f"Error processing stock positions: {e}")
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
            logger.warning(f"Could not fetch live price for option {contract_symbol}: {e}")

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
        logger.error(f"Error in /paper/history: {e}")
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
        logger.error(f"Failed to reset portfolio_history table: {e}")
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
        logger.error(f"Smart Alert Error: {e}")
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


# --- NEW: Background Price Checker & Screener Cache ---
def update_screener_cache():
    global SCREENER_CACHE
    if SCREENER_CACHE["is_updating"]:
        return
    SCREENER_CACHE["is_updating"] = True
    logger.info("Updating Screener Cache in the background (S&P 500)...")

    try:
        base_filter = {"Index": "S&P 500"}

        # 1. Fetch Overview (This has Company and Sector)
        scr_overview = Overview()
        scr_overview.set_filter(filters_dict=base_filter)
        overview_data = scr_overview.screener_view().replace({np.nan: None}).to_dict('records')
        SCREENER_CACHE["overview"] = overview_data

        # 2. Create a "Dictionary" to map Ticker -> Company & Sector
        info_map = {}
        for row in overview_data:
            info_map[row.get('Ticker')] = {
                'Company': row.get('Company'),
                'Sector': row.get('Sector'),
                'Market Cap': row.get('Market Cap')
            }

        # 3. Fetch Valuation and inject missing columns
        scr_val = Valuation()
        scr_val.set_filter(filters_dict=base_filter)
        val_data = scr_val.screener_view().replace({np.nan: None}).to_dict('records')
        for row in val_data:
            ticker = row.get('Ticker')
            if ticker in info_map:
                row['Company'] = info_map[ticker]['Company']
                row['Sector'] = info_map[ticker]['Sector']
                if 'Market Cap' not in row:
                    row['Market Cap'] = info_map[ticker]['Market Cap']
        SCREENER_CACHE["valuation"] = val_data

        # 4. Fetch Financials and inject missing columns
        scr_fin = Financial()
        scr_fin.set_filter(filters_dict=base_filter)
        fin_data = scr_fin.screener_view().replace({np.nan: None}).to_dict('records')
        for row in fin_data:
            ticker = row.get('Ticker')
            if ticker in info_map:
                row['Company'] = info_map[ticker]['Company']
                row['Sector'] = info_map[ticker]['Sector']
                row['Market Cap'] = info_map[ticker]['Market Cap']
        SCREENER_CACHE["financial"] = fin_data

        SCREENER_CACHE["last_updated"] = datetime.now().isoformat()
        logger.info("Screener Cache updated successfully!")
    except Exception as e:
        logger.error(f"Failed to update screener cache: {e}")
    finally:
        SCREENER_CACHE["is_updating"] = False
# --- NEW: Background Price Checker ---
def check_alerts():
    logger.info(f"Running price alert check...")
    notifications_data = load_notifications()
    if not notifications_data['active']:
        return  # No active alerts, do nothing

    active_alerts_copy = notifications_data['active'].copy()
    tickers_to_check = list(set([a['ticker'] for a in active_alerts_copy]))

    try:
        data = yf.download(tickers_to_check, period="1d")
        if data.empty:
            logger.warning("Price check: yfinance returned no data.")
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
                        logger.error(f"News check error: {news_err}")
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
                    logger.info(f"Triggering alert for {alert['ticker']}")
                    triggered_alert = {
                        "id": str(uuid.uuid4()),
                        "message": message,
                        "seen": False,
                        "timestamp": datetime.now().isoformat()
                    }
                    notifications_data['triggered'].append(triggered_alert)
                    triggered_ids.append(alert['id'])

            except Exception as e:
                logger.error(f"Error checking alert for {alert['ticker']}: {e}")

        # Remove triggered alerts from active list
        if triggered_ids:
            notifications_data['active'] = [a for a in notifications_data['active'] if a['id'] not in triggered_ids]
            save_notifications(notifications_data)
            logger.info(f"Triggered and moved {len(triggered_ids)} alerts.")

    except Exception as e:
        logger.error(f"Failed to check all alert prices: {e}")


def run_scheduler():
    schedule.every(1).minutes.do(check_alerts)
    schedule.every(1).hours.do(update_screener_cache)  # Refresh data every hour

    # Run once immediately on startup so the UI has data right away!
    update_screener_cache()

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
        logger.error(f"Evaluation error for {ticker}: {e}")
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
        logger.error(f"Forex convert error: {e}")
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 500


@app.route('/forex/currencies')
def forex_currencies():
    try:
        currencies = get_currency_list();
        return jsonify(currencies)
    except Exception as e:
        logger.error(f"Forex currencies error: {e}")
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
        logger.error(f"Crypto convert error: {e}")
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 500


@app.route('/crypto/list')
def crypto_list():
    try:
        cryptos = get_crypto_list();
        return jsonify(cryptos)
    except Exception as e:
        logger.error(f"Crypto list error: {e}")
        return jsonify({"error": f"Failed to fetch crypto list: {str(e)}"}), 500


@app.route('/crypto/currencies')
def crypto_target_currencies():
    try:
        currencies = get_target_currencies();
        return jsonify(currencies)
    except Exception as e:
        logger.error(f"Crypto currencies error: {e}")
        return jsonify({"error": f"Failed to fetch currencies: {str(e)}"}), 500


@app.route('/commodities/price/<string:commodity>')
def commodity_price(commodity):
    try:
        period = request.args.get('period', '5d')
        data = get_commodity_price(commodity, period)
        if data is None: return jsonify({"error": "Could not fetch commodity price"}), 404
        return jsonify(data)
    except Exception as e:
        logger.error(f"Commodity price error: {e}")
        return jsonify({"error": f"Failed to fetch commodity: {str(e)}"}), 500


@app.route('/commodities/list')
def commodities_list():
    try:
        commodities = get_commodity_list();
        return jsonify(commodities)
    except Exception as e:
        logger.error(f"Commodities list error: {e}")
        return jsonify({"error": f"Failed to fetch commodities: {str(e)}"}), 500


@app.route('/commodities/all')
def commodities_all():
    try:
        commodities = get_commodities_by_category();
        return jsonify(commodities)
    except Exception as e:
        logger.error(f"Commodities all error: {e}")
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


def _fundamentals_from_yfinance(sym):
    """Build a fundamentals dict from yfinance when Alpha Vantage is unavailable."""
    try:
        info = yf.Ticker(sym).info
        if not info or info.get('quoteType') not in ('EQUITY', 'ETF', 'MUTUALFUND'):
            return None
        def _s(key):
            v = info.get(key)
            return str(v) if v is not None else 'N/A'
        return {
            "symbol": info.get('symbol', sym),
            "name": info.get('longName') or info.get('shortName') or 'N/A',
            "description": info.get('longBusinessSummary', 'N/A'),
            "exchange": info.get('exchange', 'N/A'),
            "currency": info.get('currency', 'N/A'),
            "sector": info.get('sector', 'N/A'),
            "industry": info.get('industry', 'N/A'),
            "country": info.get('country', 'N/A'),
            "market_cap": _s('marketCap'),
            "pe_ratio": _s('trailingPE'),
            "forward_pe": _s('forwardPE'),
            "trailing_pe": _s('trailingPE'),
            "peg_ratio": _s('pegRatio'),
            "eps": _s('trailingEps'),
            "beta": _s('beta'),
            "book_value": _s('bookValue'),
            "dividend_per_share": _s('dividendRate'),
            "dividend_yield": _s('dividendYield'),
            "dividend_date": 'N/A',
            "ex_dividend_date": 'N/A',
            "profit_margin": _s('profitMargins'),
            "operating_margin_ttm": _s('operatingMargins'),
            "return_on_assets_ttm": _s('returnOnAssets'),
            "return_on_equity_ttm": _s('returnOnEquity'),
            "revenue_ttm": _s('totalRevenue'),
            "gross_profit_ttm": _s('grossProfits'),
            "diluted_eps_ttm": _s('trailingEps'),
            "revenue_per_share_ttm": _s('revenuePerShare'),
            "quarterly_earnings_growth_yoy": _s('earningsQuarterlyGrowth'),
            "quarterly_revenue_growth_yoy": _s('revenueGrowth'),
            "analyst_target_price": _s('targetMeanPrice'),
            "price_to_sales_ratio_ttm": _s('priceToSalesTrailing12Months'),
            "price_to_book_ratio": _s('priceToBook'),
            "ev_to_revenue": _s('enterpriseToRevenue'),
            "ev_to_ebitda": _s('enterpriseToEbitda'),
            "week_52_high": _s('fiftyTwoWeekHigh'),
            "week_52_low": _s('fiftyTwoWeekLow'),
            "day_50_moving_average": _s('fiftyDayAverage'),
            "day_200_moving_average": _s('twoHundredDayAverage'),
            "shares_outstanding": _s('sharesOutstanding'),
        }
    except Exception as e:
        logger.warning(f"yfinance fundamentals fallback failed for {sym}: {e}")
        return None


@app.route('/fundamentals/<string:ticker>')
def get_fundamentals(ticker):
    try:
        sanitized_ticker = ticker.split(':')[0].upper()

        # Try Alpha Vantage first (richer data), fall back to yfinance
        av_data = None
        if ALPHA_VANTAGE_API_KEY:
            try:
                url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={sanitized_ticker}&apikey={ALPHA_VANTAGE_API_KEY}'
                av_resp = requests.get(url, timeout=10)
                av_json = av_resp.json()
                if av_json and 'Symbol' in av_json:
                    av_data = av_json
            except Exception as e:
                logger.warning(f"Alpha Vantage fundamentals failed for {sanitized_ticker}: {e}")

        if av_data:
            data = av_data
        else:
            # Fallback: yfinance
            yf_data = _fundamentals_from_yfinance(sanitized_ticker)
            if yf_data:
                return jsonify(yf_data)
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
        logger.error(f"Fundamentals error for {ticker}: {e}")
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
        logger.error(f"Error in symbol search: {e}")
        return jsonify({"error": str(e)}), 500



# Create a "memory" cache so we don't spam the API
CALENDAR_CACHE = {
    "data": None,
    "last_fetched": 0
}


@app.route('/calendar/economic', methods=['GET'])
def get_economic_calendar():
    global CALENDAR_CACHE
    current_time = time.time()

    # Check if we fetched the data less than 15 minutes ago (900 seconds).
    # If we did, instantly return the saved data instead of hitting the API again.
    if CALENDAR_CACHE["data"] is not None and (current_time - CALENDAR_CACHE["last_fetched"]) < 900:
        return jsonify(CALENDAR_CACHE["data"])

    try:
        url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

        # Use a highly realistic User-Agent so their Cloudflare protection doesn't block us
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        }

        response = requests.get(url, headers=headers)

        # If they still block us, but we have old data saved, just show the old data!
        if response.status_code != 200:
            if CALENDAR_CACHE["data"] is not None:
                return jsonify(CALENDAR_CACHE["data"])
            return jsonify({"error": f"Failed to fetch calendar (Status {response.status_code})"}), 500

        data = response.json()
        formatted_events = []

        for index, item in enumerate(data):
            if item.get('country') != 'USD':
                continue

            raw_date = item.get('date', '')
            try:
                dt = datetime.strptime(raw_date[:19], "%Y-%m-%dT%H:%M:%S")
                date_str = dt.strftime("%Y-%m-%d")
                time_str = dt.strftime("%I:%M %p").lstrip("0")
            except Exception:
                date_str = raw_date
                time_str = "TBD"

            title = item.get('title', 'Unknown Event')
            event_type = 'speaker' if 'Speaks' in title or 'Testifies' in title else 'report'

            def clean_val(v):
                return v if v and str(v).strip() != "" else "-"

            formatted_events.append({
                "id": index,
                "date": date_str,
                "time": time_str,
                "type": event_type,
                "event": title,
                "impact": item.get('impact', 'Low'),
                "actual": clean_val(item.get('actual')),
                "forecast": clean_val(item.get('forecast')),
                "previous": clean_val(item.get('previous'))
            })

        # Success! Save the new data to our cache and log the time
        CALENDAR_CACHE["data"] = formatted_events
        CALENDAR_CACHE["last_fetched"] = current_time

        return jsonify(formatted_events)

    except Exception as e:
        # If the internet drops or it crashes, return the cached data as a fallback
        if CALENDAR_CACHE["data"] is not None:
            return jsonify(CALENDAR_CACHE["data"])
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────────────────────────────────────
# OpenBB-powered endpoints
# ─────────────────────────────────────────────────────────────────────────────

def _obb_to_float(val):
    """Safely convert OpenBB field values to JSON-serialisable floats."""
    if val is None:
        return None
    try:
        f = float(val)
        return None if (f != f) else round(f, 4)  # NaN check
    except (TypeError, ValueError):
        return None


@app.route('/fundamentals/financials/<string:ticker>')
def get_financial_statements(ticker):
    """4-year income statement, balance sheet, and cash flow via OpenBB."""
    if not OPENBB_AVAILABLE:
        return jsonify({"error": "OpenBB not installed on this server."}), 503
    sym = ticker.upper().split(':')[0]
    try:
        def _stmt(fn, fields):
            df = fn(sym, provider='yfinance').to_dataframe()
            if df.empty:
                return []
            rows = []
            for col in df.columns[:4]:  # up to 4 years
                row = {"period": str(col)[:10]}
                for key, src in fields:
                    row[key] = _obb_to_float(df[src].iloc[0]) if src in df.index else None
                rows.append(row)
            return rows

        income_df  = obb.equity.fundamental.income(sym, provider='yfinance', period='annual', limit=4).to_dataframe()
        balance_df = obb.equity.fundamental.balance(sym, provider='yfinance', period='annual', limit=4).to_dataframe()
        cashflow_df = obb.equity.fundamental.cash(sym, provider='yfinance', period='annual', limit=4).to_dataframe()

        def _rows(df, field_map):
            out = []
            for _, row in df.iterrows():
                rec = {"period": str(row.get('date', row.get('period_of_report', '')))[:10]}
                for dest, src in field_map.items():
                    rec[dest] = _obb_to_float(row.get(src))
                out.append(rec)
            return out

        INCOME_FIELDS = {
            "revenue": "revenue", "gross_profit": "gross_profit",
            "operating_income": "operating_income", "net_income": "net_income",
            "ebitda": "ebitda", "eps": "eps_diluted",
        }
        BALANCE_FIELDS = {
            "total_assets": "total_assets", "total_liab": "total_liabilities",
            "total_equity": "total_equity", "cash": "cash_and_cash_equivalents",
            "total_debt": "total_debt", "working_capital": "net_current_assets",
        }
        CASHFLOW_FIELDS = {
            "operating": "net_cash_flow_from_operating_activities",
            "investing": "net_cash_flow_from_investing_activities",
            "financing": "net_cash_flow_from_financing_activities",
            "capex": "capital_expenditure",
            "free_cf": "free_cash_flow",
        }

        return jsonify({
            "income_statement": _rows(income_df, INCOME_FIELDS),
            "balance_sheet":    _rows(balance_df, BALANCE_FIELDS),
            "cash_flow":        _rows(cashflow_df, CASHFLOW_FIELDS),
        })
    except Exception as e:
        logger.error(f"Financial statements error for {sym}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/fundamentals/filings/<string:ticker>')
def get_sec_filings(ticker):
    """Recent SEC filings (10-K, 10-Q, 8-K, etc.) via OpenBB EDGAR."""
    if not OPENBB_AVAILABLE:
        return jsonify({"error": "OpenBB not installed on this server."}), 503
    sym = ticker.upper().split(':')[0]
    RELEVANT = {'10-K', '10-Q', '8-K', '10-K/A', '10-Q/A', 'DEF 14A', 'S-1', '20-F', '6-K'}
    try:
        df = obb.equity.fundamental.filings(sym, provider='sec', limit=50).to_dataframe()
        results = []
        for _, row in df.iterrows():
            report_type = str(row.get('report_type', row.get('type', ''))).upper()
            if report_type not in RELEVANT:
                continue
            results.append({
                "date":        str(row.get('date', row.get('filed', '')))[:10],
                "type":        report_type,
                "description": str(row.get('description', row.get('form', '')))[:200],
                "url":         str(row.get('url', row.get('link', ''))) or None,
            })
        return jsonify(results[:30])
    except Exception as e:
        logger.error(f"SEC filings error for {sym}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/screener')
def get_screener():
    """Top gainers, losers, and most-active via OpenBB/yfinance."""
    if not OPENBB_AVAILABLE:
        return jsonify({"error": "OpenBB not installed on this server."}), 503

    def _fmt(results):
        out = []
        for r in results:
            out.append({
                "symbol":          r.symbol,
                "name":            r.name or '',
                "price":           _obb_to_float(r.price),
                "change":          _obb_to_float(r.change),
                "percent_change":  _obb_to_float(r.percent_change),
                "market_cap":      _obb_to_float(r.market_cap),
                "volume":          int(r.volume) if r.volume else None,
                "pe_forward":      _obb_to_float(r.pe_forward),
                "year_high":       _obb_to_float(r.year_high),
                "year_low":        _obb_to_float(r.year_low),
                "eps_ttm":         _obb_to_float(r.eps_ttm),
            })
        return out

    try:
        gainers = _fmt(obb.equity.discovery.gainers(provider='yfinance').results)
        losers  = _fmt(obb.equity.discovery.losers(provider='yfinance').results)
        active  = _fmt(obb.equity.discovery.active(provider='yfinance').results)
        return jsonify({"gainers": gainers, "losers": losers, "active": active})
    except Exception as e:
        logger.error(f"Screener error: {e}")
        return jsonify({"error": str(e)}), 500


MACRO_INDICATORS = [
    {"symbol": "URATE", "name": "Unemployment Rate",     "unit": "%",    "multiplier": 100},
    {"symbol": "CPI",   "name": "Consumer Price Index",  "unit": "Index","multiplier": 1},
    {"symbol": "IP",    "name": "Industrial Production", "unit": "Index","multiplier": 1},
]


@app.route('/screener/advanced', methods=['POST'])
def advanced_screener():
    try:
        data = request.get_json() or {}
        filters = data.get('filters', {})
        tab = data.get('tab', 'overview')
        limit = data.get('limit', 50)

        # 1. Grab data instantly from memory
        cached_data = SCREENER_CACHE.get(tab, [])

        # 2. Safety check: If the server just turned on and is still fetching...
        if not cached_data:
            if SCREENER_CACHE.get("is_updating"):
                return jsonify(
                    {"error": "Screener is warming up the cache. Please wait ~15 seconds and try again."}), 503
            return jsonify({"count": 0, "data": []})

        # 3. Apply the user's dropdown filters
        if filters:
            cached_data = filter_cached_data(cached_data, filters)

        return jsonify({
            "count": len(cached_data),
            "data": cached_data[:limit]
        })

    except Exception as e:
        logger.error(f"Advanced screener error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/macro/overview')
def get_macro_overview():
    """Key US macro indicators + 10-Year Treasury yield via OpenBB/econdb + yfinance."""
    if not OPENBB_AVAILABLE:
        return jsonify({"error": "OpenBB not installed on this server."}), 503
    result = []
    try:
        for ind in MACRO_INDICATORS:
            try:
                df = obb.economy.indicators(
                    symbol=ind["symbol"], country='US', provider='econdb'
                ).to_dataframe().reset_index()
                df = df.sort_values('date')
                last  = df.iloc[-1]
                prev  = df.iloc[-2] if len(df) > 1 else last
                val      = float(last['value']) * ind["multiplier"]
                prev_val = float(prev['value']) * ind["multiplier"]
                sparkline = [
                    {"date": str(row['date']), "value": round(float(row['value']) * ind["multiplier"], 4)}
                    for _, row in df.tail(24).iterrows()
                ]
                result.append({
                    "symbol":    ind["symbol"],
                    "name":      ind["name"],
                    "unit":      ind["unit"],
                    "value":     round(val, 3),
                    "prev":      round(prev_val, 3),
                    "date":      str(last['date']),
                    "sparkline": sparkline,
                })
            except Exception as e:
                logger.warning(f"Macro indicator {ind['symbol']} failed: {e}")

        # 10-Year Treasury yield from yfinance
        try:
            tnx = yf.Ticker('^TNX')
            info = tnx.info
            rate = info.get('regularMarketPrice') or info.get('previousClose')
            hist = tnx.history(period='2y', interval='1mo')
            sparkline = [
                {"date": str(d.date()), "value": round(float(v), 3)}
                for d, v in zip(hist.index, hist['Close'])
            ]
            prev_rate = float(hist['Close'].iloc[-2]) if len(hist) > 1 else rate
            result.append({
                "symbol":    "TNX",
                "name":      "10-Year Treasury Yield",
                "unit":      "%",
                "value":     round(float(rate), 3) if rate else None,
                "prev":      round(prev_rate, 3),
                "date":      str(hist.index[-1].date()) if not hist.empty else '',
                "sparkline": sparkline,
            })
        except Exception as e:
            logger.warning(f"TNX fetch failed: {e}")

        return jsonify(result)
    except Exception as e:
        logger.error(f"Macro overview error: {e}")
        return jsonify({"error": str(e)}), 500


# --- Main execution ---
if __name__ == '__main__':
    init_db()  # Initialize the SQLite history table

    # --- NEW: Start the background thread ---
    logger.info("Starting background alert checker...")
    checker_thread = threading.Thread(target=run_scheduler, daemon=True)
    checker_thread.start()

    app.run(debug=True, port=5001, use_reloader=False)

