import yfinance as yf
import pandas as pd
import numpy as np
import requests
import os
import math
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.ensemble import RandomForestClassifier
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# --- 1. QUANTITATIVE ML MODEL (CLASSIFICATION) ---

def create_features(df, lookback=14):
    """
    Create features for ML models including lagged prices and basic technical indicators
    """
    df = df.copy()
    
    for i in range(1, lookback + 1):
        df[f'lag_{i}'] = df['Close'].shift(i)
    
    df['ma_7'] = df['Close'].rolling(window=7).mean()
    df['ma_14'] = df['Close'].rolling(window=14).mean()
    df['ma_30'] = df['Close'].rolling(window=30).mean() if len(df) > 30 else df['Close'].mean()
    
    df['volatility'] = df['Close'].rolling(window=7).std()
    df['price_change'] = df['Close'].pct_change()
    
    df = df.dropna()
    return df

def random_forest_classifier_predict(df, lookback=14, forecast_horizon=5):
    """
    Random Forest Classification: Predicts probability of price going UP over the forecast horizon.
    This avoids the compounding errors of recursive price prediction.
    """
    try:
        df_features = create_features(df, lookback)
        
        # Create binary target: 1 if price in 'forecast_horizon' days is strictly greater than today
        df_features['Target'] = (df_features['Close'].shift(-forecast_horizon) > df_features['Close']).astype(int)
        
        # Drop the last few rows where we don't know the future yet
        df_train = df_features.dropna()
        
        if len(df_train) < 30: 
            return None
            
        feature_cols = [col for col in df_train.columns if col not in ['Close', 'Target']]
        X_train = df_train[feature_cols].values
        y_train = df_train['Target'].values
        
        # Train Classifier
        rf_model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)
        rf_model.fit(X_train, y_train)
        
        # Predict the most recent day
        current_features = df_features[feature_cols].iloc[-1].values.reshape(1, -1)
        
        # get probability of class 1 (Up)
        prob_up = rf_model.predict_proba(current_features)[0][1]
        return prob_up
    except Exception as e:
        print(f"Options Model (RF Classifier) error: {e}")
        return None

def get_ml_prediction_signal(ticker, current_price):
    """
    Analyzes the probability and returns a directional signal.
    """
    try:
        df = yf.download(ticker, period="2y", auto_adjust=False, progress=False)[['Close']].copy()
        if df.empty or len(df) < 50:
            return {'direction': 'Neutral', 'prob': 0.5}
            
        prob_up = random_forest_classifier_predict(df)
        
        if prob_up is None:
            return {'direction': 'Neutral', 'prob': 0.5}
        
        # High conviction thresholds
        direction = 'Neutral'
        if prob_up >= 0.60:
            direction = 'Buy'
        elif prob_up <= 0.40:
            direction = 'Sell'
            
        return {'direction': direction, 'prob': round(prob_up, 2)}
    
    except Exception as e:
        print(f"Error in get_ml_prediction_signal: {e}")
        return {'direction': 'Neutral', 'prob': 0.5}


# --- 2. TECHNICAL & SENTIMENT ANALYSIS ---

def _calculate_ta(df):
    """Calculates RSI, MACD, and Bollinger Bands manually."""
    df_ta = df.copy()
    
    # RSI
    delta = df_ta['Close'].diff(1)
    gain = delta.where(delta > 0, 0).ewm(alpha=1/14, adjust=False).mean()
    loss = -delta.where(delta < 0, 0).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / loss
    df_ta['RSI_14'] = 100 - (100 / (1 + rs))

    # MACD
    ema_12 = df_ta['Close'].ewm(span=12, adjust=False).mean()
    ema_26 = df_ta['Close'].ewm(span=26, adjust=False).mean()
    df_ta['MACD_12_26_9'] = ema_12 - ema_26
    df_ta['MACDs_12_26_9'] = df_ta['MACD_12_26_9'].ewm(span=9, adjust=False).mean()
    df_ta['MACDh_12_26_9'] = df_ta['MACD_12_26_9'] - df_ta['MACDs_12_26_9']

    # Bollinger Bands
    df_ta['BBM_20_2.0'] = df_ta['Close'].rolling(window=20).mean()
    df_ta['BBS_20_2.0'] = df_ta['Close'].rolling(window=20).std()
    df_ta['BBU_20_2.0'] = df_ta['BBM_20_2.0'] + (df_ta['BBS_20_2.0'] * 2)
    df_ta['BBL_20_2.0'] = df_ta['BBM_20_2.0'] - (df_ta['BBS_20_2.0'] * 2)
    
    return df_ta

def get_technical_signal(hist_df):
    try:
        df = _calculate_ta(hist_df).dropna()
        last = df.iloc[-1]
        
        signal = {'direction': 'Neutral'}
        score = 0
        
        if last['RSI_14'] > 70: score -= 1
        elif last['RSI_14'] < 30: score += 1
        
        if last['MACDh_12_26_9'] > 0 and df['MACDh_12_26_9'].iloc[-3] < 0: score += 1
        elif last['MACDh_12_26_9'] < 0 and df['MACDh_12_26_9'].iloc[-3] > 0: score -= 1
            
        if last['Close'] < last['BBL_20_2.0']: score += 0.5
        elif last['Close'] > last['BBU_20_2.0']: score -= 0.5
            
        if score > 0.5: signal['direction'] = 'Buy'
        if score < -0.5: signal['direction'] = 'Sell'
        return signal
    except Exception as e:
        return {'direction': 'Neutral'}

def get_sentiment_signal(ticker):
    try:
        NEWS_API_KEY = os.getenv('NEWS_API_KEY')
        if not NEWS_API_KEY: return {'direction': 'Neutral', 'score': 0}
        
        url = f"https://newsapi.org/v2/everything?q={ticker}&searchIn=title,description&language=en&pageSize=10&sortBy=relevancy&apiKey={NEWS_API_KEY}"
        response = requests.get(url)
        data = response.json()

        if data.get('status') != 'ok' or data.get('totalResults') == 0:
            return {'direction': 'Neutral', 'score': 0}
            
        analyzer = SentimentIntensityAnalyzer()
        compound_sum = sum(analyzer.polarity_scores(a.get('title', ''))['compound'] for a in data.get('articles', []))
        avg_score = compound_sum / len(data.get('articles', []))
        
        direction = 'Buy' if avg_score > 0.15 else ('Sell' if avg_score < -0.15 else 'Neutral')
        return {'direction': direction, 'score': round(avg_score, 3)}
    except Exception as e:
        return {'direction': 'Neutral', 'score': 0}


# --- 3. ORCHESTRATION & CONTRACT SELECTION ---

def analyze_signals(ti, sentiment, ml):
    signals = [ti['direction'], sentiment['direction'], ml['direction']]
    buy_score = signals.count('Buy')
    sell_score = signals.count('Sell')
    
    # Conflict = Hold
    if buy_score >= 1 and sell_score >= 1:
        return {'direction': 'Hold', 'confidence': 'Low', 'reason': f"Signals are conflicting. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"}

    prob_str = f"{int(ml['prob']*100)}% prob of upside" if ml['direction'] == 'Buy' else f"{int((1-ml['prob'])*100)}% prob of downside"

    if buy_score == 3: return {'direction': 'Buy', 'confidence': 'High', 'reason': f"Strong consensus: ML indicates {prob_str}, sentiment is positive, and technicals are bullish."}
    if sell_score == 3: return {'direction': 'Sell', 'confidence': 'High', 'reason': f"Strong consensus: ML indicates {prob_str}, sentiment is negative, and technicals are bearish."}
    
    if buy_score == 2: return {'direction': 'Buy', 'confidence': 'Medium', 'reason': f"Majority 'Buy' signal. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"}
    if sell_score == 2: return {'direction': 'Sell', 'confidence': 'Medium', 'reason': f"Majority 'Sell' signal. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"}
    
    if buy_score == 1: return {'direction': 'Buy', 'confidence': 'Low', 'reason': f"Weak 'Buy' signal. Check macro environment before trading."}
    if sell_score == 1: return {'direction': 'Sell', 'confidence': 'Low', 'reason': f"Weak 'Sell' signal. Check macro environment before trading."}

    return {'direction': 'Hold', 'confidence': 'Low', 'reason': "All signals are currently neutral. Wait for a better setup."}

def select_option_contract(stock, signal, stock_price):
    try:
        direction = signal['direction']
        is_call = (direction == 'Buy')
        
        expirations = stock.options
        if not expirations: return {"error": "No option expirations found."}
        
        today = datetime.now()
        target_exp = None
        for exp_str in expirations:
            exp_date = datetime.strptime(exp_str, '%Y-%m-%d')
            days_to_exp = (exp_date - today).days
            if 30 <= days_to_exp <= 45: # Standard swing trade timeframe
                target_exp = exp_str
                break
        
        if target_exp is None:
            target_exp = expirations[min(2, len(expirations)-1)]
            days_to_exp = (datetime.strptime(target_exp, '%Y-%m-%d') - today).days
            
        chain = stock.option_chain(target_exp)
        df = chain.calls if is_call else chain.puts
        
        if df.empty: return {"error": f"No chain found for {target_exp}"}
            
        # Filter for liquidity
        liquid_df = df[df['openInterest'] > 10]
        if not liquid_df.empty: df = liquid_df
             
        # Select closest OTM strike
        if is_call:
            otm_strikes = df[df['strike'] > stock_price]
            contract = otm_strikes.iloc[0] if not otm_strikes.empty else df.iloc[-1]
        else:
            otm_strikes = df[df['strike'] < stock_price]
            contract = otm_strikes.iloc[-1] if not otm_strikes.empty else df.iloc[0]
        
        premium = contract['ask'] if contract.get('ask', 0) > 0 else contract.get('lastPrice', 0)
        iv = contract.get('impliedVolatility', 0.20) # fallback to 20% if missing
        
        # Calculate Expected Move (Stock * IV * sqrt(days/365))
        expected_move = stock_price * iv * math.sqrt(max(1, days_to_exp) / 365.0)
        target_stock_price = stock_price + expected_move if is_call else stock_price - expected_move
        
        take_profit_premium = round(premium * 1.5, 2) 
        stop_loss_premium = round(premium * 0.6, 2)   

        reasoning = signal['reason']
        if iv > 0:
            reasoning += f" Market implies a $\pm${round(expected_move, 2)} move by expiration."

        return {
            "ticker": stock.info.get('symbol'),
            "suggestion": "Buy Call" if is_call else "Buy Put",
            "reason": reasoning,
            "confidence": signal['confidence'],
            "contract": {
                "contractSymbol": contract['contractSymbol'],
                "strikePrice": contract['strike'],
                "expirationDate": target_exp,
                "currentPrice": premium,
                "bid": contract.get('bid', 0),
                "ask": contract.get('ask', 0),
                "volume": int(contract.get('volume', 0)) if not pd.isna(contract.get('volume', 0)) else 0,
                "openInterest": int(contract.get('openInterest', 0)) if not pd.isna(contract.get('openInterest', 0)) else 0,
                "impliedVolatility": round(iv * 100, 2),
                "underlyingPrice": stock_price
            },
            "targets": {
                "stopLoss": f"Cut losses if premium drops to ~${stop_loss_premium}",
                "takeProfit": f"Take profits if premium reaches ~${take_profit_premium} (Stock near ${round(target_stock_price, 2)})"
            }
        }
    except Exception as e:
        return {"error": f"Could not format contract: {str(e)}"}

def generate_suggestion(ticker):
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y")
        if hist.empty: return {"error": "Could not get stock history"}
        
        info = stock.info
        stock_price = info.get('regularMarketPrice', 0)
        if stock_price == 0: stock_price = info.get('previousClose', 0)

        ti_signal = get_technical_signal(hist)
        sentiment_signal = get_sentiment_signal(ticker)
        ml_signal = get_ml_prediction_signal(ticker, stock_price)

        final_signal = analyze_signals(ti_signal, sentiment_signal, ml_signal)

        if final_signal['direction'] == 'Hold':
            return {"ticker": ticker, "suggestion": "Hold", "reason": final_signal['reason'], "confidence": "Low"}

        return select_option_contract(stock, final_signal, stock_price)

    except Exception as e:
        return {"error": f"Failed to generate suggestion: {str(e)}"}