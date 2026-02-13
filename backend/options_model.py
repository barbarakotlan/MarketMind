import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import warnings
warnings.filterwarnings('ignore')

# --- Feature Creation (Same as ensemble_model) ---

def create_features(df, lookback=14):
    """
    Create features for ML models including lagged prices and basic technical indicators
    """
    df = df.copy()
    
    # Lagged features (previous days' prices)
    for i in range(1, lookback + 1):
        df[f'lag_{i}'] = df['Close'].shift(i)
    
    # Moving averages
    df['ma_7'] = df['Close'].rolling(window=7).mean()
    df['ma_14'] = df['Close'].rolling(window=14).mean()
    df['ma_30'] = df['Close'].rolling(window=30).mean() if len(df) > 30 else df['Close'].mean()
    
    # Volatility (standard deviation)
    df['volatility'] = df['Close'].rolling(window=7).std()
    
    # Price change
    df['price_change'] = df['Close'].pct_change()
    
    # Drop rows with NaN values
    df = df.dropna()
    
    return df

def prepare_ml_data(df, lookback=14):
    """
    Prepare data for ML models
    """
    df_features = create_features(df, lookback)
    
    # Features (X) and target (y)
    feature_cols = [col for col in df_features.columns if col not in ['Close']]
    X = df_features[feature_cols].values
    y = df_features['Close'].values
    
    return X, y, df_features, feature_cols


# --- Robust Random Forest Prediction (Fixed Version) ---

def random_forest_predict(df, days_ahead=7, lookback=14):
    """
    Random Forest prediction, using robust recursive feature generation.
    """
    try:
        df_history = df.copy()

        # 1. Train model on historical data
        X_hist, y_hist, _, feature_cols = prepare_ml_data(df_history, lookback)
        
        if len(X_hist) < 30: return None
        
        rf_model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
        rf_model.fit(X_hist, y_hist)
        
        predictions = []
        
        # 2. Use a temporary DataFrame for recursive prediction
        df_predict = df_history[['Close']].copy()
        
        for _ in range(days_ahead):
            # 3. Create features for the *last available day*
            df_features_loop = create_features(df_predict, lookback)
            
            # 4. Get the most recent feature set
            current_features = df_features_loop[feature_cols].iloc[-1].values
            current_X = current_features.reshape(1, -1)
            
            # 5. Predict next day
            next_pred = rf_model.predict(current_X)[0]
            predictions.append(next_pred)
            
            # 6. Add this prediction to df_predict to be used in next loop
            last_date = df_predict.index[-1]
            next_date = last_date + pd.Timedelta(days=1)
            # Add a new row to df_predict
            df_predict.loc[next_date] = {'Close': next_pred}
        
        return np.array(predictions)
    except Exception as e:
        print(f"Options Model (RF) error: {e}")
        return None

# --- Main Signal Function ---

def get_ml_prediction_signal(ticker, current_price):
    """
    This is the main function to be called by the options suggester.
    """
    try:
        # 1. Get data
        df = yf.download(ticker, period="1y", auto_adjust=False)[['Close']].copy()
        if df.empty or len(df) < 30:
            return {'direction': 'Neutral', 'target': 0, 'change': 0}
            
        # 2. Get 7-day prediction
        predictions = random_forest_predict(df, days_ahead=7)
        
        if predictions is None:
            return {'direction': 'Neutral', 'target': 0, 'change': 0}
        
        # 3. Analyze prediction
        target_price = predictions[-1] # Use the 7-day target
        percent_change = ((target_price - current_price) / current_price) * 100
        
        direction = 'Neutral'
        if percent_change > 3.0: # If ML predicts > 3% gain
            direction = 'Buy'
        elif percent_change < -3.0: # If ML predicts > 3% loss
            direction = 'Sell'
            
        return {'direction': direction, 'target': round(target_price, 2), 'change': round(percent_change, 2)}
    
    except Exception as e:
        print(f"Error in get_ml_prediction_signal: {e}")
        return {'direction': 'Neutral', 'target': 0, 'change': 0}