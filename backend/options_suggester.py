import yfinance as yf
import pandas as pd
import numpy as np
import requests # Import for NewsAPI
import os # Import for API Key
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from datetime import datetime, timedelta

# --- MODIFIED IMPORT ---
# We now import from our new, dedicated model
from options_model import get_ml_prediction_signal

# --- Manually defined TA functions (no pandas-ta needed) ---
def _calculate_ta(df):
    """
    Calculates RSI, MACD, and Bollinger Bands manually and appends to DataFrame.
    """
    df_ta = df.copy()
    
    # 1. RSI (Relative Strength Index)
    delta = df_ta['Close'].diff(1)
    gain = delta.where(delta > 0, 0).ewm(alpha=1/14, adjust=False).mean()
    loss = -delta.where(delta < 0, 0).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / loss
    df_ta['RSI_14'] = 100 - (100 / (1 + rs))

    # 2. MACD (Moving Average Convergence Divergence)
    ema_12 = df_ta['Close'].ewm(span=12, adjust=False).mean()
    ema_26 = df_ta['Close'].ewm(span=26, adjust=False).mean()
    df_ta['MACD_12_26_9'] = ema_12 - ema_26
    df_ta['MACDs_12_26_9'] = df_ta['MACD_12_26_9'].ewm(span=9, adjust=False).mean()
    df_ta['MACDh_12_26_9'] = df_ta['MACD_12_26_9'] - df_ta['MACDs_12_26_9']

    # 3. Bollinger Bands
    df_ta['BBM_20_2.0'] = df_ta['Close'].rolling(window=20).mean()
    df_ta['BBS_20_2.0'] = df_ta['Close'].rolling(window=20).std()
    df_ta['BBU_20_2.0'] = df_ta['BBM_20_2.0'] + (df_ta['BBS_20_2.0'] * 2)
    df_ta['BBL_20_2.0'] = df_ta['BBM_20_2.0'] - (df_ta['BBS_20_2.0'] * 2)
    
    return df_ta


def generate_suggestion(ticker):
    """
    Orchestrator function to generate a complete options suggestion.
    """
    try:
        # 1. Get Stock Data
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y")
        if hist.empty:
            return {"error": "Could not get stock history"}
        
        info = stock.info
        stock_price = info.get('regularMarketPrice', 0)
        if stock_price == 0:
            stock_price = info.get('previousClose', 0)

        # 2. Get Signals
        ti_signal = get_technical_signal(hist)
        sentiment_signal = get_sentiment_signal(ticker)
        
        # Call our new, dedicated model
        ml_signal = get_ml_prediction_signal(ticker, stock_price)

        # 3. Analyze Signals (The "Rules Engine")
        final_signal = analyze_signals(ti_signal, sentiment_signal, ml_signal)

        # --- THIS BLOCK IS REVISED ---
        # We only "Hold" if the direction is explicitly "Hold"
        if final_signal['direction'] == 'Hold':
            return {
                "ticker": ticker,
                "suggestion": "Hold", # This is what the frontend card looks for
                "reason": final_signal['reason'],
                "confidence": "Low"
            }
        # --- END REVISION ---

        # 4. Select a Contract (This will now run for Low, Medium, and High)
        suggestion = select_option_contract(stock, final_signal, stock_price)
        return suggestion

    except Exception as e:
        print(f"Error in generate_suggestion for {ticker}: {e}")
        return {"error": f"Failed to generate suggestion: {str(e)}"}


def get_technical_signal(hist_df):
    """
    Calculates Technical Indicators and generates a signal.
    """
    try:
        # Use our manual TA function
        df = _calculate_ta(hist_df)
        df = df.dropna()
        
        # Get last row
        last = df.iloc[-1]
        
        signal = {'direction': 'Neutral', 'rsi': 'Neutral', 'macd': 'Neutral', 'bbands': 'Neutral'}
        score = 0
        
        # RSI
        if last['RSI_14'] > 70:
            signal['rsi'] = 'Overbought'
            score -= 1
        elif last['RSI_14'] < 30:
            signal['rsi'] = 'Oversold'
            score += 1
        
        # MACD (Check for crossover in last 3 days)
        if last['MACDh_12_26_9'] > 0 and df['MACDh_12_26_9'].iloc[-3] < 0:
            signal['macd'] = 'Bullish Crossover'
            score += 1
        elif last['MACDh_12_26_9'] < 0 and df['MACDh_12_26_9'].iloc[-3] > 0:
            signal['macd'] = 'Bearish Crossover'
            score -= 1
            
        # Bollinger Bands
        if last['Close'] < last['BBL_20_2.0']:
            signal['bbands'] = 'Price below lower band (Potential bounce)'
            score += 0.5 # Weaker signal
        elif last['Close'] > last['BBU_20_2.0']:
            signal['bbands'] = 'Price above upper band (Potential pullback)'
            score -= 0.5
            
        if score > 0.5: signal['direction'] = 'Buy'
        if score < -0.5: signal['direction'] = 'Sell'
        
        return signal
    except Exception as e:
        print(f"Error in TA signal: {e}")
        return {'direction': 'Neutral'}

def get_sentiment_signal(ticker):
    """
    Uses VADER to get a sentiment score from recent news.
    """
    try:
        NEWS_API_KEY = "4f2abfc0913748ee9cedf3b5e5878bcc" # As defined in your api.py
        if not NEWS_API_KEY:
            return {'direction': 'Neutral', 'score': 0}
        
        url = (f"https://newsapi.org/v2/everything?"
               f"q={ticker}"
               f"&searchIn=title,description"
               f"&language=en"
               f"&pageSize=10" # Get 10 articles
               f"&sortBy=relevancy"
               f"&apiKey={NEWS_API_KEY}")
        
        response = requests.get(url)
        data = response.json()

        if data.get('status') != 'ok' or data.get('totalResults') == 0:
            return {'direction': 'Neutral', 'score': 0}
            
        analyzer = SentimentIntensityAnalyzer()
        compound_sum = 0
        articles = data.get('articles', [])
        
        for article in articles:
            title = article.get('title', '')
            vs = analyzer.polarity_scores(title)
            compound_sum += vs['compound']
            
        avg_score = compound_sum / len(articles)
        
        direction = 'Neutral'
        if avg_score > 0.15:
            direction = 'Buy'
        elif avg_score < -0.15:
            direction = 'Sell'
            
        return {'direction': direction, 'score': round(avg_score, 3)}
    except Exception as e:
        print(f"Error in sentiment signal: {e}")
        return {'direction': 'Neutral', 'score': 0}

def get_ml_signal(ticker, current_price):
    """
    Gets ML signal from our new dedicated options_model.
    """
    try:
        return get_ml_prediction_signal(ticker, current_price)
    except Exception as e:
        print(f"Error in get_ml_signal wrapper: {e}")
        return {'direction': 'Neutral', 'target': 0, 'change': 0}


# --- THIS FUNCTION IS FULLY REVISED ---
def analyze_signals(ti, sentiment, ml):
    """
    Combines signals to create a final decision and confidence.
    This version will create "Low" confidence plays.
    """
    signals = [ti['direction'], sentiment['direction'], ml['direction']]
    
    buy_score = signals.count('Buy')
    sell_score = signals.count('Sell')
    
    # 1. Handle CONFLICT (1 Buy, 1 Sell) -> This is a definite HOLD
    if buy_score >= 1 and sell_score >= 1:
        direction = 'Hold'
        confidence = 'Low'
        reason = f"Signals are conflicting. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"
        return {'direction': direction, 'confidence': confidence, 'reason': reason}

    # 2. Handle HIGH confidence (3/3)
    if buy_score == 3:
        direction = 'Buy'
        confidence = 'High'
        reason = f"Strong consensus: ML predicts ${ml['target']} (+{ml['change']}%), sentiment is positive ({sentiment['score']}), and technicals are bullish."
        return {'direction': direction, 'confidence': confidence, 'reason': reason}
    if sell_score == 3:
        direction = 'Sell'
        confidence = 'High'
        reason = f"Strong consensus: ML predicts ${ml['target']} ({ml['change']}%), sentiment is negative ({sentiment['score']}), and technicals are bearish."
        return {'direction': direction, 'confidence': confidence, 'reason': reason}

    # 3. Handle MEDIUM confidence (2/3)
    if buy_score == 2:
        direction = 'Buy'
        confidence = 'Medium'
        reason = f"Majority 'Buy' signal. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"
        if ml['direction'] == 'Buy' and ti['direction'] == 'Buy':
             reason += " (ML and TI in agreement)"
        return {'direction': direction, 'confidence': confidence, 'reason': reason}
    if sell_score == 2:
        direction = 'Sell'
        confidence = 'Medium'
        reason = f"Majority 'Sell' signal. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"
        if ml['direction'] == 'Sell' and ti['direction'] == 'Sell':
             reason += " (ML and TI in agreement)"
        return {'direction': direction, 'confidence': confidence, 'reason': reason}

    # 4. Handle LOW confidence (1/3)
    if buy_score == 1:
        direction = 'Buy'
        confidence = 'Low'
        reason = f"Single 'Buy' signal. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"
        return {'direction': direction, 'confidence': confidence, 'reason': reason}
    if sell_score == 1:
        direction = 'Sell'
        confidence = 'Low'
        reason = f"Single 'Sell' signal. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"
        return {'direction': direction, 'confidence': confidence, 'reason': reason}

    # 5. Handle all NEUTRAL
    direction = 'Hold'
    confidence = 'Low'
    reason = f"All signals are neutral. (ML: {ml['direction']}, Sentiment: {sentiment['direction']}, TI: {ti['direction']})"
    return {'direction': direction, 'confidence': confidence, 'reason': reason}
# --- END REVISION ---


def select_option_contract(stock, signal, stock_price):
    """
    Finds a suitable contract from the chain based on the signal.
    """
    try:
        direction = signal['direction']
        is_call = (direction == 'Buy')
        
        # 1. Find a suitable expiration date (e.g., 20-45 days out)
        expirations = stock.options
        if not expirations:
            return {"error": "No option expirations found for this ticker."}
        
        today = datetime.now()
        target_exp = None
        for exp_str in expirations:
            exp_date = datetime.strptime(exp_str, '%Y-%m-%d')
            days_to_exp = (exp_date - today).days
            if 20 <= days_to_exp <= 45:
                target_exp = exp_str
                break
        
        if target_exp is None:
            target_exp = expirations[min(2, len(expirations)-1)] # Fallback: 3rd expiration
        
        # 2. Get the chain for that date
        chain = stock.option_chain(target_exp)
        df = chain.calls if is_call else chain.puts
        
        if df.empty:
            return {"error": f"No { 'calls' if is_call else 'puts' } found for {target_exp}"}
            
        # 3. Find a strike price (e.g., first one Out-of-the-Money)
        if is_call:
            # Find first strike > stock_price
            otm_strikes = df[df['strike'] > stock_price]
            if otm_strikes.empty:
                contract = df.iloc[-1] # Fallback to last available
            else:
                contract = otm_strikes.iloc[0] # Closest OTM
        else:
            # Find first strike < stock_price
            otm_strikes = df[df['strike'] < stock_price]
            if otm_strikes.empty:
                contract = df.iloc[0] # Fallback to first available
            else:
                contract = otm_strikes.iloc[-1] # Closest OTM
        
        # 4. Format the suggestion
        premium = contract['ask'] if is_call else contract['bid']
        if premium == 0: premium = contract['lastPrice']
        
        # Set simple stop/profit targets
        stop_loss_premium = round(premium * 0.5, 2) # 50% loss
        take_profit_premium = round(premium * 2.0, 2) # 100% gain

        # --- MODIFIED: Match the contract symbol key ---
        return {
            "ticker": stock.info.get('symbol'),
            "suggestion": "Buy Call" if is_call else "Buy Put",
            "reason": signal['reason'],
            "confidence": signal['confidence'],
            "contract": {
                "contractSymbol": contract['contractSymbol'], # Match React modal
                "strikePrice": contract['strike'],
                "expirationDate": target_exp,
                "currentPrice": premium,
                "bid": contract['bid'],
                "ask": contract['ask'],
                "underlyingPrice": stock_price
            },
            "targets": {
                "stopLoss": f"Consider selling if premium drops to ~${stop_loss_premium}",
                "takeProfit": f"Consider selling if premium rises to ~${take_profit_premium}"
            }
        }
        # --- END MODIFIED ---
    except Exception as e:
        print(f"Error selecting contract: {e}")
        return {"error": f"Could not find a suitable contract: {str(e)}"}


if __name__ == "__main__":
    # --- Test the new suggester ---
    ticker = "AAPL"
    print(f"Generating suggestion for {ticker}...")
    suggestion = generate_suggestion(ticker)
    
    import json
    print(json.dumps(suggestion, indent=2))
    
    print("\nGenerating suggestion for MSFT...")
    suggestion_msft = generate_suggestion("MSFT")
    print(json.dumps(suggestion_msft, indent=2))