import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from statsmodels.tsa.ar_model import AutoReg
import warnings
warnings.filterwarnings('ignore')

# Try to import XGBoost, fallback if not available
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("XGBoost not available. Install with: pip install xgboost")


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
    
    return X, y, df_features


def linear_regression_predict(df, days_ahead=7):
    """
    Linear Regression (AutoReg) prediction - existing method
    """
    try:
        df = df.copy()
        today = pd.Timestamp.today().normalize()
        df["Predicted_LR"] = np.nan
        
        # Get the last available date
        last_date = df.index[-1]
        
        for day in range(days_ahead):
            values = df["Predicted_LR"].fillna(df["Close"]).dropna().values
            
            # Use AutoReg model
            model = AutoReg(values, lags=min(5, len(values)-1))
            model_fit = model.fit()
            
            next_pred = model_fit.predict(start=len(values), end=len(values))[0]
            next_date = last_date + pd.Timedelta(days=day+1)
            
            df.loc[next_date] = [np.nan, next_pred]
            last_date = next_date
        
        predictions = df[df["Predicted_LR"].notna()].tail(days_ahead)
        return predictions["Predicted_LR"].values
    except Exception as e:
        print(f"Linear Regression error: {e}")
        return None


def random_forest_predict(df, days_ahead=7, lookback=14):
    """
    Random Forest prediction
    """
    try:
        # Prepare data
        X, y, df_features = prepare_ml_data(df, lookback)
        
        if len(X) < 30:  # Need minimum data
            return None
        
        # Train Random Forest
        rf_model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        rf_model.fit(X, y)
        
        # Predict next days
        predictions = []
        last_known = df['Close'].iloc[-lookback:].values
        current_features = df_features.iloc[-1][1:].values  # Exclude Close
        
        for _ in range(days_ahead):
            # Reshape for prediction
            current_X = current_features.reshape(1, -1)
            next_pred = rf_model.predict(current_X)[0]
            predictions.append(next_pred)
            
            # Update features for next prediction (simple rolling)
            last_known = np.append(last_known[1:], next_pred)
            # Update lagged features (simplified)
            current_features[0] = next_pred  # lag_1
            if len(current_features) > 1:
                current_features[1] = current_features[0]  # lag_2
        
        return np.array(predictions)
    except Exception as e:
        print(f"Random Forest error: {e}")
        return None


def xgboost_predict(df, days_ahead=7, lookback=14):
    """
    XGBoost prediction
    """
    if not XGBOOST_AVAILABLE:
        return None
    
    try:
        # Prepare data
        X, y, df_features = prepare_ml_data(df, lookback)
        
        if len(X) < 30:  # Need minimum data
            return None
        
        # Train XGBoost
        xgb_model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
            n_jobs=-1
        )
        xgb_model.fit(X, y)
        
        # Predict next days
        predictions = []
        last_known = df['Close'].iloc[-lookback:].values
        current_features = df_features.iloc[-1][1:].values  # Exclude Close
        
        for _ in range(days_ahead):
            # Reshape for prediction
            current_X = current_features.reshape(1, -1)
            next_pred = xgb_model.predict(current_X)[0]
            predictions.append(next_pred)
            
            # Update features for next prediction
            last_known = np.append(last_known[1:], next_pred)
            current_features[0] = next_pred  # lag_1
            if len(current_features) > 1:
                current_features[1] = current_features[0]  # lag_2
        
        return np.array(predictions)
    except Exception as e:
        print(f"XGBoost error: {e}")
        return None


def ensemble_predict(df, days_ahead=7):
    """
    Ensemble prediction - average of all available models
    """
    predictions = {}
    
    # Get predictions from each model
    lr_pred = linear_regression_predict(df, days_ahead)
    rf_pred = random_forest_predict(df, days_ahead)
    xgb_pred = xgboost_predict(df, days_ahead)
    
    # Store individual predictions
    if lr_pred is not None:
        predictions['linear_regression'] = lr_pred
    if rf_pred is not None:
        predictions['random_forest'] = rf_pred
    if xgb_pred is not None:
        predictions['xgboost'] = xgb_pred
    
    # Calculate ensemble (weighted average)
    if len(predictions) == 0:
        return None, {}
    
    # Simple average for now (can be weighted later based on historical performance)
    ensemble = np.mean(list(predictions.values()), axis=0)
    
    return ensemble, predictions


def calculate_metrics(actual, predicted):
    """
    Calculate accuracy metrics
    """
    mae = mean_absolute_error(actual, predicted)
    rmse = np.sqrt(mean_squared_error(actual, predicted))
    mape = np.mean(np.abs((actual - predicted) / actual)) * 100
    
    return {
        'mae': round(float(mae), 2),
        'rmse': round(float(rmse), 2),
        'mape': round(float(mape), 2)
    }


if __name__ == "__main__":
    # Test the models
    ticker = "AAPL"
    print(f"Testing ensemble model for {ticker}...")
    
    # Download data
    data = yf.download(ticker, period="1y", auto_adjust=False)
    df = data[['Close']].copy()
    
    # Get predictions
    ensemble, individual = ensemble_predict(df, days_ahead=7)
    
    print("\nPredictions:")
    print(f"Ensemble: {ensemble}")
    print(f"\nIndividual models:")
    for model_name, preds in individual.items():
        print(f"  {model_name}: {preds}")