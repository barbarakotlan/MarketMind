import warnings
warnings.filterwarnings('ignore')
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler
from sklearn.preprocessing import MinMaxScaler
from statsmodels.tsa.ar_model import AutoReg
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import prediction_service

# Try to import XGBoost, fallback if not available
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("XGBoost not available. Install with: pip install xgboost")

# Creating a dataset based on ticker and period
def create_dataset(ticker, period):
    return prediction_service.create_dataset(ticker, period=period)


def create_features(df, lookback=14):
    """
    Create features for ML models including lagged prices and basic technical indicators
    """
    df = df.copy()

    # Lagged features (previous days' prices)
    for i in range(1, lookback + 1):
        df[f'lag_{i}'] = df['Close'].shift(i)

    # Moving averages
    df['ma_7']  = df['Close'].rolling(window=7,  min_periods=1).mean()
    df['ma_14'] = df['Close'].rolling(window=14, min_periods=1).mean()
    df['ma_30'] = df['Close'].rolling(window=30, min_periods=1).mean()

    # Volatility
    df['volatility'] = df['Close'].rolling(window=7, min_periods=2).std()

    # Price change
    df['price_change'] = df['Close'].pct_change()

    # Drop rows with NaN values
    df = df.dropna()

    return df

# General function to prepare data for ML models that require no training
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

# General function to prepare data for models that require training
def prepare_model_data(df, lookback=14):
    """
    Prepare data for all models
    """
    # Split prices, before any feature engineering
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]

    # Build features separately on each split
    X_train_feat, _, train_features = prepare_ml_data(train_df, lookback)
    X_test_feat,  _, test_features  = prepare_ml_data(test_df,  lookback)

    y_train_vals = train_features[['Close']].values
    y_test_vals  = test_features[['Close']].values

    # For LSTM/Transformer, we will create sequences later
    return X_train_feat, y_train_vals, X_test_feat, y_test_vals

def linear_regression_predict(df, days_ahead=7):
    return prediction_service.linear_regression_predict(df, days_ahead=days_ahead)


def random_forest_predict(df, days_ahead=7, lookback=14):
    return prediction_service.random_forest_predict(df, days_ahead=days_ahead, lookback=lookback)

def xgboost_predict(df, days_ahead=7, lookback=14):
    return prediction_service.xgboost_predict(df, days_ahead=days_ahead, lookback=lookback)

def gradient_boosting_predict(df, days_ahead=7, lookback=14):
    return prediction_service.gradient_boosting_predict(df, days_ahead=days_ahead, lookback=lookback)

def lightgbm_predict(df, days_ahead=7, lookback=14):
    return prediction_service.lightgbm_predict(df, days_ahead=days_ahead, lookback=lookback)

def ensemble_predict(df, days_ahead=7, lookback=14, seq_len=30):
    """
    Extended ensemble that includes LSTM and Transformer
    alongside prediction_service's ensemble
    """
    # Get prediction_service ensemble (arima, lr, rf, xgb)
    base_ensemble, base_breakdown = prediction_service.ensemble_predict(df, days_ahead=days_ahead)

    # Train and run LSTM
    lstm_model, scaler_X, scaler_y, device = lstm_train(
        df, lookback=lookback, seq_len=seq_len, days_ahead=days_ahead
    )
    lstm_pred = lstm_predict(df, lstm_model, scaler_X, scaler_y, device,
                             lookback=lookback, seq_len=seq_len)

    # Train and run Transformer
    tf_model, scaler_X, scaler_y, device = transformer_train(
        df, lookback=lookback, seq_len=seq_len, days_ahead=days_ahead
    )
    tf_pred = transformer_predict(df, tf_model, scaler_X, scaler_y, device,
                                  lookback=lookback, seq_len=seq_len)

    # Merge all predictions
    all_predictions = dict(base_breakdown)
    if lstm_pred is not None:
        all_predictions['lstm'] = lstm_pred
    if tf_pred is not None:
        all_predictions['transformer'] = tf_pred

    # Recompute ensemble average across everything
    full_ensemble = np.mean(list(all_predictions.values()), axis=0)

    return full_ensemble, all_predictions


def calculate_metrics(actual, predicted):
    return prediction_service.calculate_metrics(actual, predicted)

# LSTM Class
class LSTM(nn.Module):
    '''
    LSTM model for time series forecasting
    '''
    def __init__(self, input_size, hidden_size, layer_size, output_size):
        super(LSTM, self).__init__()
        self.hidden_size = hidden_size
        self.layer_size = layer_size
        self.lstm = nn.LSTM(input_size, hidden_size, layer_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)  # output X days at once

    def forward(self, x, device):
        batch_size = x.size(0)
        h0 = torch.zeros(self.layer_size, batch_size, self.hidden_size).to(device)
        c0 = torch.zeros(self.layer_size, batch_size, self.hidden_size).to(device)
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])  # (batch, output_size)
        return out

# LSTM Helper
def create_sequences(X, y, seq_len, forecast_horizon):
    """
    Slide a window across the time series to create input/output pairs.
    Args:
        X:                 2D array (n_samples, n_features)
        y:                 2D array (n_samples, 1)
        seq_len:           number of past days to use as input
        forecast_horizon:  number of future days to predict
    Returns:
        X_seq: (n_sequences, seq_len, n_features)
        y_seq: (n_sequences, forecast_horizon)
    """
    Xs, ys = [], []
    for i in range(len(X) - seq_len - forecast_horizon + 1):
        Xs.append(X[i : i + seq_len])
        ys.append(y[i + seq_len : i + seq_len + forecast_horizon, 0])
    return np.array(Xs), np.array(ys)

# Train LSTM model
def lstm_train(df, lookback=14, seq_len=30, days_ahead=7, hidden_size=64, layer_size=2, epochs=50, batch_size=32, lr=0.001):
    '''Train an LSTM model for stock price prediction'''
    # Prepare data
    X, y, _ = prepare_ml_data(df, lookback)
    y = y.reshape(-1, 1)
    
    X_seq, y_seq = create_sequences(X, y, seq_len, days_ahead)
    
    n_samples, seq_len_, n_features = X_seq.shape
    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()
    
    X_scaled = scaler_X.fit_transform(X_seq.reshape(-1, n_features)).reshape(n_samples, seq_len_, n_features)
    y_scaled = scaler_y.fit_transform(y_seq.reshape(-1, 1)).reshape(y_seq.shape)
    
    X_tensor = torch.FloatTensor(X_scaled)
    y_tensor = torch.FloatTensor(y_scaled)

    # Model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    input_size = n_features
    model = LSTM(input_size, hidden_size, layer_size, days_ahead).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    loader = DataLoader(TensorDataset(X_tensor, y_tensor), batch_size=batch_size, shuffle=True)

    # Training loop
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            pred = model(xb, device)
            loss = criterion(pred, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 10 == 0:
            # print(f"Epoch {epoch+1}/{epochs} | Train Loss: {total_loss/len(loader):.6f}")
            pass

    return model, scaler_X, scaler_y, device

# Long Short-Term Memory (LSTM) prediction function
def lstm_predict(df, model, scaler_X, scaler_y, device, lookback=14, seq_len=30):
    '''Predict future stock prices using the trained LSTM model'''
    try:
        model.eval()

        # Build features
        X_features, _, _ = prepare_ml_data(df, lookback)

        # Take last seq_len rows
        last_window_raw = X_features[-seq_len:]
        n_features = last_window_raw.shape[1]
        last_window_scaled = scaler_X.transform(last_window_raw.reshape(-1, n_features)).reshape(1, seq_len, n_features)
        last_window_tensor = torch.FloatTensor(last_window_scaled).to(device)

        # Predict
        with torch.no_grad():
            pred_scaled = model(last_window_tensor, device).cpu().numpy()

        # Inverse transform
        pred_prices = scaler_y.inverse_transform(pred_scaled.reshape(-1, 1)).flatten()

        # Return predictions
        predictions = np.array(pred_prices)

        return predictions

    except Exception as e:
        print(f"LSTM error: {e}")
        return None

# Transformer Class
class TransformerModel(nn.Module):
    '''
    Transformer model for time series forecasting
    '''
    def __init__(self, input_size, d_model=64, nhead=4, num_layers=2, output_size=7, dropout=0.1):
        super(TransformerModel, self).__init__()

        # Project input features into d_model dimensions
        self.input_projection = nn.Linear(input_size, d_model)

        # Positional encoding (tells model the order of timesteps)
        self.pos_encoder = PositionalEncoding(d_model, dropout)

        # Transformer encoder (stacked self-attention + feedforward layers)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=d_model * 4,
            dropout=dropout,
            batch_first=True       # (batch, seq, features)
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        # Final output layer → predict N days ahead
        self.fc = nn.Linear(d_model, output_size)

    def forward(self, x):
        # x shape: (batch, seq_len, input_size)
        x = self.input_projection(x)        # → (batch, seq_len, d_model)
        x = self.pos_encoder(x)             # → add positional info
        x = self.transformer_encoder(x)     # → self-attention across all timesteps
        x = self.fc(x[:, -1, :])           # → take last timestep → (batch, output_size)
        return x

# Positional Encoding
# Adds order information since Transformer has no built-in sense of sequence order
class PositionalEncoding(nn.Module):
    '''
    Adds positional encoding to the input so the Transformer knows the order of timesteps
    '''
    def __init__(self, d_model, dropout=0.1, max_len=500):
        super(PositionalEncoding, self).__init__()
        self.dropout = nn.Dropout(p=dropout)

        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len).unsqueeze(1).float()
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model))

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)                            # (1, max_len, d_model)

        self.register_buffer('pe', pe)

    def forward(self, x):
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)

# Train Transformer model
def transformer_train(df, lookback=14, seq_len=30, days_ahead=7, d_model=64, nhead=4, num_layers=2, epochs=50, batch_size=32, lr=0.001):
    '''Train a Transformer model for stock price prediction'''
   # Prepare data
    X, y, _ = prepare_ml_data(df, lookback)
    y = y.reshape(-1, 1)

    X_seq, y_seq = create_sequences(X, y, seq_len, days_ahead)

    n_samples, seq_len_, n_features = X_seq.shape
    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()
    
    X_scaled = scaler_X.fit_transform(X_seq.reshape(-1, n_features)).reshape(n_samples, seq_len_, n_features)
    y_scaled = scaler_y.fit_transform(y_seq.reshape(-1, 1)).reshape(y_seq.shape)
    
    X_tensor = torch.FloatTensor(X_scaled)
    y_tensor = torch.FloatTensor(y_scaled)

    # Model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = TransformerModel(
        input_size=n_features,
        d_model=d_model,
        nhead=nhead,
        num_layers=num_layers,
        output_size=days_ahead
    ).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    loader = DataLoader(TensorDataset(X_tensor, y_tensor), batch_size=batch_size, shuffle=True)

    # Training loop
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            pred = model(xb)
            loss = criterion(pred, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 10 == 0:
            # print(f"Epoch {epoch+1}/{epochs} | Train Loss: {total_loss/len(loader):.6f}")
            pass

    return model, scaler_X, scaler_y, device

def transformer_predict(df, model, scaler_X, scaler_y, device, lookback=14, seq_len=30):
    '''Predict future stock prices using the trained Transformer model'''
    try:
        model.eval()

        # Build features
        X_features, _, _ = prepare_ml_data(df, lookback)

        # Take last seq_len rows
        last_window_raw = X_features[-seq_len:]
        n_features = last_window_raw.shape[1]
        last_window_scaled = scaler_X.transform(last_window_raw.reshape(-1, n_features)).reshape(1, seq_len, n_features)
        last_window_tensor = torch.FloatTensor(last_window_scaled).to(device)

        # Predict
        with torch.no_grad():
            pred_scaled = model(last_window_tensor).cpu().numpy()

        # Inverse transform
        pred_prices = scaler_y.inverse_transform(pred_scaled.reshape(-1, 1)).flatten()

        return np.array(pred_prices)

    except Exception as e:
        print(f"Transformer error: {e}")
        return None


# Main for testing individual models and the full ensemble
if __name__ == "__main__":
    ticker = 'AAPL'
    df = create_dataset(ticker, period="2y")

    days_ahead = 7
    lookback = 14
    seq_len = 30

    # Individual quick models (no training needed)
    print("\nIndividual Models:")
    future_dates = prediction_service.get_future_prediction_dates(df, days_ahead)

    for name, pred in [
        ("Linear Regression", linear_regression_predict(df, days_ahead)),
        ("Random Forest",     random_forest_predict(df, days_ahead)),
        ("XGBoost",           xgboost_predict(df, days_ahead)),
        ("Gradient Boosting", gradient_boosting_predict(df, days_ahead)),
    ]:
        if pred is not None:
            print(f"\n{name}:")
            for date, price in zip(future_dates, pred):
                print(f"  {date.strftime('%Y-%m-%d')} → ${price:.2f}")

    # Deep learning models
    print("\nTraining LSTM...")
    lstm_model, scaler_X, scaler_y, device = lstm_train(
        df, lookback=lookback, seq_len=seq_len, days_ahead=days_ahead
    )
    lstm_pred = lstm_predict(df, lstm_model, scaler_X, scaler_y, device, lookback=lookback, seq_len=seq_len)
    if lstm_pred is not None:
        print("\nLSTM:")
        for date, price in zip(future_dates, lstm_pred):
            print(f"  {date.strftime('%Y-%m-%d')} → ${price:.2f}")

    print("\nTraining Transformer...")
    tf_model, scaler_X, scaler_y, device = transformer_train( df, lookback=lookback, seq_len=seq_len, days_ahead=days_ahead
    )
    tf_pred = transformer_predict(df, tf_model, scaler_X, scaler_y, device,lookback=lookback, seq_len=seq_len)
    if tf_pred is not None:
        print("\nTransformer:")
        for date, price in zip(future_dates, tf_pred):
            print(f"  {date.strftime('%Y-%m-%d')} → ${price:.2f}")

    # Full ensemble including LSTM + Transformer
    print("\nFull Ensemble:")
    full_ens, breakdown = ensemble_predict(df, days_ahead, lookback, seq_len)
    if full_ens is not None:
        for date, price in zip(future_dates, full_ens):
            print(f"  {date.strftime('%Y-%m-%d')} → ${price:.2f}")

        print("\nPer-model breakdown:")
        for model_name, preds in breakdown.items():
            print(f"  {model_name}: {[round(p, 2) for p in preds]}")
