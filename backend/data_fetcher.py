"""
Data fetcher with Alpha Vantage (primary) and yfinance (fallback)
"""
import os
import pandas as pd
import numpy as np
import requests
import yfinance as yf
from datetime import datetime, timedelta
from dotenv import load_dotenv
import time

load_dotenv()

ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')


def fetch_stock_data(ticker, source='alpha_vantage', outputsize='full'):
    """
    Fetch historical stock data from Alpha Vantage or yfinance
    
    Args:
        ticker: Stock symbol
        source: 'alpha_vantage' or 'yfinance'
        outputsize: 'compact' (100 days) or 'full' (20+ years)
    
    Returns:
        DataFrame with columns: Date (index), Open, High, Low, Close, Volume
    """
    if source == 'alpha_vantage':
        return fetch_from_alpha_vantage(ticker, outputsize)
    else:
        return fetch_from_yfinance(ticker)


def fetch_from_alpha_vantage(ticker, outputsize='full'):
    """
    Fetch from Alpha Vantage TIME_SERIES_DAILY (free tier)
    
    Benefits:
    - Up to 20+ years of data
    - More reliable than yfinance
    - 5 calls per minute limit (free tier)
    
    Note: Using TIME_SERIES_DAILY (free) instead of DAILY_ADJUSTED (premium)
    For adjusted prices, we fall back to yfinance which auto-adjusts
    """
    try:
        url = f'https://www.alphavantage.co/query'
        params = {
            'function': 'TIME_SERIES_DAILY',
            'symbol': ticker,
            'apikey': ALPHA_VANTAGE_API_KEY,
            'outputsize': outputsize,
            'datatype': 'json'
        }
        
        print(f"Fetching {ticker} from Alpha Vantage...")
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        # Debug: print response keys
        print(f"Response keys: {list(data.keys())}")
        
        # Check for errors
        if 'Error Message' in data:
            print(f"Alpha Vantage error: {data['Error Message']}")
            return None
        
        if 'Note' in data:
            print(f"Alpha Vantage rate limit: {data['Note']}")
            return None
        
        # Check for both possible key names
        time_series_key = None
        if 'Time Series (Daily)' in data:
            time_series_key = 'Time Series (Daily)'
        elif 'Time Series (Daily) Adjusted' in data:
            time_series_key = 'Time Series (Daily) Adjusted'
        
        if time_series_key is None:
            print(f"No time series data found for {ticker}")
            print(f"Available keys: {list(data.keys())}")
            return None
        
        # Parse the time series data
        time_series = data[time_series_key]
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(time_series, orient='index')
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
        
        # Rename columns (Alpha Vantage uses numeric keys)
        # TIME_SERIES_DAILY format (free tier, no adjusted close)
        df = df.rename(columns={
            '1. open': 'Open',
            '2. high': 'High',
            '3. low': 'Low',
            '4. close': 'Close',
            '5. volume': 'Volume'
        })
        
        # Convert to numeric
        for col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        print(f"✓ Fetched {len(df)} days from Alpha Vantage (unadjusted)")
        return df[['Open', 'High', 'Low', 'Close', 'Volume']]
    
    except Exception as e:
        print(f"Alpha Vantage fetch error: {e}")
        return None


def fetch_from_yfinance(ticker, period='2y'):
    """
    Fallback to yfinance
    """
    try:
        print(f"Fetching {ticker} from yfinance...")
        df = yf.download(ticker, period=period, auto_adjust=True, progress=False)
        
        if df.empty:
            return None
        
        # Standardize column names
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [col[0] for col in df.columns]
        
        df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
        print(f"✓ Fetched {len(df)} days from yfinance")
        return df
    
    except Exception as e:
        print(f"yfinance fetch error: {e}")
        return None


def get_stock_data_with_fallback(ticker, min_days=300):
    """
    Smart data fetcher with fallback
    
    Strategy:
    1. Try yfinance first (auto-adjusted, good for ML)
    2. If insufficient data, try Alpha Vantage for more history
    
    Returns:
        DataFrame or None
    """
    # Try yfinance first (auto-adjusted prices, 2 years)
    df = fetch_from_yfinance(ticker, period='2y')
    
    if df is not None and len(df) >= min_days:
        print(f"✓ Using yfinance data (adjusted prices)")
        return df
    
    # Fallback to Alpha Vantage for more history
    print(f"Trying Alpha Vantage for more historical data...")
    df = fetch_from_alpha_vantage(ticker, outputsize='full')
    
    if df is not None and len(df) >= min_days:
        print(f"⚠️  Using Alpha Vantage data (unadjusted - may affect accuracy)")
        return df
    
    return None


def validate_and_clean_data(df):
    """
    Validate and clean stock data according to DATA_SPECS.md
    
    Requirements:
    - No missing values in Close
    - Remove outliers (>3 std deviations)
    - Handle gaps
    - Minimum 300 days
    """
    if df is None or df.empty:
        return None
    
    original_len = len(df)
    
    # 1. Remove rows with missing Close prices
    df = df[df['Close'].notna()].copy()
    
    # 2. Forward fill other missing values
    df = df.ffill()
    
    # 3. Remove outliers in Close (>3 standard deviations from rolling mean)
    rolling_mean = df['Close'].rolling(window=20, min_periods=1).mean()
    rolling_std = df['Close'].rolling(window=20, min_periods=1).std()
    
    # Identify outliers
    lower_bound = rolling_mean - (3 * rolling_std)
    upper_bound = rolling_mean + (3 * rolling_std)
    
    # Keep only data within bounds
    df = df[(df['Close'] >= lower_bound) & (df['Close'] <= upper_bound)]
    
    # 4. Ensure minimum data length
    if len(df) < 300:
        print(f"Insufficient data after cleaning: {len(df)} days (need 300)")
        return None
    
    cleaned_count = original_len - len(df)
    print(f"✓ Data validated: {len(df)} days ({cleaned_count} outliers removed)")
    
    return df


def prepare_data_for_ml(ticker, min_days=300):
    """
    Complete pipeline: fetch, validate, clean
    
    Returns:
        Clean DataFrame ready for feature engineering
    """
    # Fetch with fallback
    df = get_stock_data_with_fallback(ticker, min_days)
    
    if df is None:
        print(f"Failed to fetch data for {ticker}")
        return None
    
    # Validate and clean
    df_clean = validate_and_clean_data(df)
    
    if df_clean is None:
        print(f"Data validation failed for {ticker}")
        return None
    
    print(f"✓ {ticker} data ready: {len(df_clean)} days")
    return df_clean


if __name__ == "__main__":
    # Test the data fetcher
    ticker = "AAPL"
    print(f"\n=== Testing data fetcher for {ticker} ===\n")
    
    # Test Alpha Vantage
    df_av = fetch_from_alpha_vantage(ticker, outputsize='compact')
    if df_av is not None:
        print(f"Alpha Vantage: {len(df_av)} days")
        print(df_av.tail())
    
    # Test yfinance
    df_yf = fetch_from_yfinance(ticker)
    if df_yf is not None:
        print(f"\nyfinance: {len(df_yf)} days")
        print(df_yf.tail())
    
    # Test full pipeline
    print("\n=== Full pipeline test ===")
    df_final = prepare_data_for_ml(ticker)
    if df_final is not None:
        print(f"\nFinal data shape: {df_final.shape}")
        print(df_final.describe())
