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
    Create features for ML models including lagged prices and technical indicators.
    All features are strictly backward-looking — no future leakage.
    """
    df = df.copy()

    # Pull full OHLCV if it was stashed in attrs by create_dataset
    ohlcv = df.attrs.get("canonical_ohlcv")
    if ohlcv is not None:
        ohlcv = ohlcv.reindex(df.index)
        for col in ("Open", "High", "Low", "Volume"):
            if col in ohlcv.columns:
                df[col] = ohlcv[col]

    # --- Lagged closes ---
    for i in range(1, lookback + 1):
        df[f'lag_{i}'] = df['Close'].shift(i)

    # --- Moving averages ---
    df['ma_7']  = df['Close'].rolling(window=7,  min_periods=1).mean()
    df['ma_14'] = df['Close'].rolling(window=14, min_periods=1).mean()
    df['ma_30'] = df['Close'].rolling(window=30, min_periods=1).mean()
    df['ma_50'] = df['Close'].rolling(window=50, min_periods=1).mean()

    # MA crossover signals
    df['ma_7_14_cross']  = df['ma_7']  - df['ma_14']
    df['ma_14_30_cross'] = df['ma_14'] - df['ma_30']

    # --- Volatility & returns ---
    df['volatility']   = df['Close'].rolling(window=14, min_periods=2).std()
    df['price_change'] = df['Close'].pct_change()
    df['log_return']   = np.log(df['Close'] / df['Close'].shift(1))

    if 'High' in df.columns and 'Low' in df.columns:
        df['high_low_range'] = (df['High'] - df['Low']) / df['Close']
    if 'Open' in df.columns:
        df['close_open_gap'] = (df['Close'] - df['Open']) / df['Open'].replace(0, np.nan)

    # --- RSI (14-period) ---
    delta = df['Close'].diff()
    gain  = delta.clip(lower=0).rolling(window=14, min_periods=1).mean()
    loss  = (-delta.clip(upper=0)).rolling(window=14, min_periods=1).mean()
    rs    = gain / loss.replace(0, np.nan)
    df['rsi_14'] = 100 - (100 / (1 + rs))

    # --- MACD (12/26 EMA, 9-period signal) ---
    ema_12            = df['Close'].ewm(span=12, adjust=False).mean()
    ema_26            = df['Close'].ewm(span=26, adjust=False).mean()
    df['macd']        = ema_12 - ema_26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist']   = df['macd'] - df['macd_signal']

    # --- Bollinger Bands (20-period, 2σ) ---
    bb_mid         = df['Close'].rolling(window=20, min_periods=1).mean()
    bb_std         = df['Close'].rolling(window=20, min_periods=2).std()
    df['bb_upper'] = bb_mid + 2 * bb_std
    df['bb_lower'] = bb_mid - 2 * bb_std
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / bb_mid.replace(0, np.nan)
    df['bb_pct']   = (df['Close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower']).replace(0, np.nan)

    # --- Volume features ---
    if 'Volume' in df.columns:
        df['volume_ma_10']  = df['Volume'].rolling(window=10, min_periods=1).mean()
        df['volume_ratio']  = df['Volume'] / df['volume_ma_10'].replace(0, np.nan)
        df['volume_change'] = df['Volume'].pct_change()

    # --- Momentum ---
    df['momentum_5']  = df['Close'] - df['Close'].shift(5)
    df['momentum_10'] = df['Close'] - df['Close'].shift(10)
    df['roc_5']       = df['Close'].pct_change(periods=5)

    # Drop OHLCV columns before returning — models should only see engineered features
    df = df.drop(columns=[c for c in ('Open', 'High', 'Low', 'Volume') if c in df.columns])

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


def ensemble_predict(df, days_ahead=7):
    return prediction_service.ensemble_predict(df, days_ahead=days_ahead)


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
def lstm_train(df, lookback=14, seq_len=30, days_ahead=7, hidden_size=64, layer_size=2, epochs=50, batch_size=32, lr=0.001, val_frac=0.15):
    '''Train an LSTM model for stock price prediction.

    Leak-free pipeline (mirrors gru_train):
      1. Feature engineering on full dataset (all backward-looking — no leakage).
      2. Chronological train / val / test split before any normalization.
      3. Fit scalers on training sequences only; transform val/test without refitting.
    '''
    # --- 1. Feature engineering ---
    X_all, _, df_features = prepare_ml_data(df, lookback)
    y_all = df_features[['Close']].values

    # --- 2. Chronological split ---
    n = len(X_all)
    test_size = int(n * val_frac)
    val_size  = int(n * val_frac)
    val_end   = n - test_size
    train_end = val_end - val_size

    X_train, y_train = X_all[:train_end],        y_all[:train_end]
    X_val,   y_val   = X_all[train_end:val_end], y_all[train_end:val_end]

    # --- 3. Sliding-window sequences ---
    X_train_raw, y_train_raw = create_sequences(X_train, y_train, seq_len, days_ahead)
    X_val_raw,   y_val_raw   = create_sequences(X_val,   y_val,   seq_len, days_ahead)

    if len(X_train_raw) == 0:
        raise ValueError("Not enough training data to form sequences.")

    n_train, seq_len_, n_features = X_train_raw.shape

    # --- 4. Fit scalers on training data only ---
    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()

    X_train_scaled = scaler_X.fit_transform(X_train_raw.reshape(-1, n_features)).reshape(n_train, seq_len_, n_features)
    y_train_scaled = scaler_y.fit_transform(y_train_raw.reshape(-1, 1)).reshape(y_train_raw.shape)

    if len(X_val_raw) > 0:
        X_val_scaled = scaler_X.transform(X_val_raw.reshape(-1, n_features)).reshape(X_val_raw.shape)
        y_val_scaled = scaler_y.transform(y_val_raw.reshape(-1, 1)).reshape(y_val_raw.shape)
    else:
        X_val_scaled = X_val_raw
        y_val_scaled = y_val_raw

    X_train_t = torch.FloatTensor(X_train_scaled)
    y_train_t = torch.FloatTensor(y_train_scaled)
    X_val_t   = torch.FloatTensor(X_val_scaled)
    y_val_t   = torch.FloatTensor(y_val_scaled)

    # --- 5. Build and train model ---
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LSTM(n_features, hidden_size, layer_size, days_ahead).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    loader = DataLoader(TensorDataset(X_train_t, y_train_t), batch_size=batch_size, shuffle=True)

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

        if (epoch + 1) % 10 == 0 and len(X_val_raw) > 0:
            model.eval()
            with torch.no_grad():
                val_pred = model(X_val_t.to(device), device)
                val_loss = criterion(val_pred, y_val_t.to(device))
            print(f"Epoch {epoch+1}/{epochs} | Train Loss: {total_loss/len(loader):.6f} | Val Loss: {val_loss:.6f}")

    # Compute val MAPE on day-1 predictions (inverse-transformed) for confidence scoring
    val_mape = None
    if len(X_val_raw) > 0:
        model.eval()
        with torch.no_grad():
            val_pred_scaled = model(X_val_t.to(device), device).cpu().numpy()
        pred_day1 = scaler_y.inverse_transform(val_pred_scaled[:, :1].reshape(-1, 1)).flatten()
        actual_day1 = y_val_raw[:len(val_pred_scaled), 0]
        denom = np.maximum(np.abs(actual_day1), 1e-9)
        val_mape = float(np.mean(np.abs((actual_day1 - pred_day1) / denom)) * 100)

    return model, scaler_X, scaler_y, device, val_mape

# Long Short-Term Memory (LSTM) prediction function
def lstm_predict(df, model, scaler_X, scaler_y, device, lookback=14, seq_len=30):
    '''Predict future stock prices using the trained LSTM model'''
    try:
        model.eval()

        # Build features
        X_features, _, _ = prepare_ml_data(df, lookback)

        if len(X_features) < seq_len:
            print(f"lstm_predict: insufficient data ({len(X_features)} rows < seq_len={seq_len})")
            return None

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

# GRU Class
class GRU(nn.Module):
    '''
    GRU model for time series forecasting.
    Simpler than LSTM: only a hidden state (no cell state).
    '''
    def __init__(self, input_size, hidden_size, layer_size, output_size):
        super(GRU, self).__init__()
        self.hidden_size = hidden_size
        self.layer_size = layer_size
        self.gru = nn.GRU(input_size, hidden_size, layer_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x, device):
        batch_size = x.size(0)
        h0 = torch.zeros(self.layer_size, batch_size, self.hidden_size).to(device)
        out, _ = self.gru(x, h0)
        out = self.fc(out[:, -1, :])  # take last timestep → (batch, output_size)
        return out


def gru_train(df, lookback=14, seq_len=30, days_ahead=7, hidden_size=64, layer_size=2, epochs=50, batch_size=32, lr=0.001, val_frac=0.15):
    '''Train a GRU model for stock price prediction.

    Leak-free data pipeline:
      1. Compute features on the full dataset.
         Every feature (lags, rolling means, volatility, momentum) is
         backward-looking: the value at time t depends only on data at t
         and earlier, so computing them before the split introduces no
         future leakage.
      2. Split the feature rows chronologically into train / val / test
         BEFORE any normalization.  Default fractions: ~70% / 15% / 15%.
      3. Fit MinMaxScaler exclusively on TRAINING sequences, then apply
         that fitted scaler (no refit) to val and test sequences.
    '''
    # --- 1. Feature engineering on full dataset (no leakage: all backward-looking) ---
    X_all, _, df_features = prepare_ml_data(df, lookback)
    y_all = df_features[['Close']].values

    # --- 2. Chronological train / val / test split (before any scaling) ---
    n = len(X_all)
    test_size = int(n * val_frac)
    val_size  = int(n * val_frac)
    val_end   = n - test_size
    train_end = val_end - val_size

    X_train, y_train = X_all[:train_end],        y_all[:train_end]
    X_val,   y_val   = X_all[train_end:val_end], y_all[train_end:val_end]
    X_test,  y_test  = X_all[val_end:],          y_all[val_end:]

    # --- 3. Sliding-window sequences for each split ---
    X_train_raw, y_train_raw = create_sequences(X_train, y_train, seq_len, days_ahead)
    X_val_raw,   y_val_raw   = create_sequences(X_val,   y_val,   seq_len, days_ahead)
    X_test_raw,  y_test_raw  = create_sequences(X_test,  y_test,  seq_len, days_ahead)

    if len(X_train_raw) == 0:
        raise ValueError("Not enough training data to form sequences.")

    n_train, seq_len_, n_features = X_train_raw.shape

    # --- 4. Fit scalers on TRAINING data only; transform val and test ---
    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()

    X_train_scaled = scaler_X.fit_transform(X_train_raw.reshape(-1, n_features)).reshape(n_train, seq_len_, n_features)
    y_train_scaled = scaler_y.fit_transform(y_train_raw.reshape(-1, 1)).reshape(y_train_raw.shape)

    if len(X_val_raw) > 0:
        X_val_scaled = scaler_X.transform(X_val_raw.reshape(-1, n_features)).reshape(X_val_raw.shape)
        y_val_scaled = scaler_y.transform(y_val_raw.reshape(-1, 1)).reshape(y_val_raw.shape)
    else:
        X_val_scaled = X_val_raw
        y_val_scaled = y_val_raw

    if len(X_test_raw) > 0:
        X_test_scaled = scaler_X.transform(X_test_raw.reshape(-1, n_features)).reshape(X_test_raw.shape)
        y_test_scaled = scaler_y.transform(y_test_raw.reshape(-1, 1)).reshape(y_test_raw.shape)
    else:
        X_test_scaled = X_test_raw
        y_test_scaled = y_test_raw

    # --- 5. Build and train model ---
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    X_train_t = torch.FloatTensor(X_train_scaled)
    y_train_t = torch.FloatTensor(y_train_scaled)
    X_val_t   = torch.FloatTensor(X_val_scaled)
    y_val_t   = torch.FloatTensor(y_val_scaled)

    model = GRU(n_features, hidden_size, layer_size, days_ahead).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    loader = DataLoader(TensorDataset(X_train_t, y_train_t), batch_size=batch_size, shuffle=True)

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

        if (epoch + 1) % 10 == 0 and len(X_val_raw) > 0:
            model.eval()
            with torch.no_grad():
                val_pred = model(X_val_t.to(device), device)
                val_loss = criterion(val_pred, y_val_t.to(device))
            print(f"Epoch {epoch+1}/{epochs} | Train Loss: {total_loss/len(loader):.6f} | Val Loss: {val_loss:.6f}")

    # Compute val MAPE on day-1 predictions (inverse-transformed) for confidence scoring
    val_mape = None
    if len(X_val_raw) > 0:
        model.eval()
        with torch.no_grad():
            val_pred_scaled = model(X_val_t.to(device), device).cpu().numpy()
        pred_day1 = scaler_y.inverse_transform(val_pred_scaled[:, :1].reshape(-1, 1)).flatten()
        actual_day1 = y_val_raw[:len(val_pred_scaled), 0]
        denom = np.maximum(np.abs(actual_day1), 1e-9)
        val_mape = float(np.mean(np.abs((actual_day1 - pred_day1) / denom)) * 100)

    return model, scaler_X, scaler_y, device, val_mape


def gru_predict(df, model, scaler_X, scaler_y, device, lookback=14, seq_len=30, days_ahead=7):
    '''Predict future stock prices using the trained GRU model.

    Uses the same scaler that was fitted on training data only during
    gru_train — no refitting here.
    '''
    try:
        model.eval()

        X_features, _, _ = prepare_ml_data(df, lookback)

        if len(X_features) < seq_len:
            print(f"gru_predict: insufficient data ({len(X_features)} rows < seq_len={seq_len})")
            return None

        last_window_raw = X_features[-seq_len:]
        n_features = last_window_raw.shape[1]
        last_window_scaled = scaler_X.transform(last_window_raw.reshape(-1, n_features)).reshape(1, seq_len, n_features)
        last_window_tensor = torch.FloatTensor(last_window_scaled).to(device)

        with torch.no_grad():
            pred_scaled = model(last_window_tensor, device).cpu().numpy()

        pred_prices = scaler_y.inverse_transform(pred_scaled.reshape(-1, 1)).flatten()

        return np.array(pred_prices)

    except Exception as e:
        print(f"GRU error: {e}")
        return None


def dl_rolling_confidence(df, model, scaler_X, scaler_y, device, model_type,
                          lookback=14, seq_len=30, n_windows=10):
    """
    Compute DL model confidence via rolling inference over n_windows non-overlapping
    7-day evaluation windows on known actuals.  No retraining — uses the cached model.

    Each window uses seq_len days of input and evaluates all 7 predicted days against
    real closes, matching the actual prediction horizon.  Windows are non-overlapping
    in the test region so the MAPE samples are independent.

    Maps: confidence = clamp(100 - avg_mape * 5, 50, 95)
    Returns a float in [50, 95], or None if data is insufficient.
    """
    try:
        X_features, _, df_features = prepare_ml_data(df, lookback)
        y_all = df_features['Close'].values

        # Each window needs seq_len input days + 7 actual days (non-overlapping in test region)
        if len(X_features) < seq_len + n_windows * 7:
            return None

        model.eval()
        mapes = []
        for i in range(n_windows):
            # Non-overlapping: window i ends at len - 7*(n_windows - i)
            end_idx = len(X_features) - 7 * (n_windows - i)
            if end_idx < seq_len or end_idx + 7 > len(y_all):
                continue

            window_X = X_features[end_idx - seq_len:end_idx]
            actuals_7 = y_all[end_idx:end_idx + 7]  # 7 real closes following the window

            n_features = window_X.shape[1]
            window_scaled = scaler_X.transform(
                window_X.reshape(-1, n_features)
            ).reshape(1, seq_len, n_features)
            window_tensor = torch.FloatTensor(window_scaled).to(device)

            with torch.no_grad():
                if model_type == "Transformer":
                    pred_scaled = model(window_tensor).cpu().numpy()
                else:
                    pred_scaled = model(window_tensor, device).cpu().numpy()

            # Inverse-transform all 7 predicted days
            pred_7 = scaler_y.inverse_transform(
                pred_scaled[0].reshape(-1, 1)
            ).flatten()

            denom = np.maximum(np.abs(actuals_7), 1e-9)
            window_mape = float(np.mean(np.abs((actuals_7 - pred_7) / denom)) * 100)
            mapes.append(window_mape)

        if not mapes:
            return None

        avg_mape = float(np.mean(mapes))
        return round(max(50.0, min(95.0, 100.0 - avg_mape * 5.0)), 1)

    except Exception as e:
        print(f"dl_rolling_confidence error: {e}")
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
def transformer_train(df, lookback=14, seq_len=30, days_ahead=7, d_model=64, nhead=4, num_layers=2, epochs=50, batch_size=32, lr=0.001, val_frac=0.15):
    '''Train a Transformer model for stock price prediction.

    Leak-free pipeline (mirrors gru_train):
      1. Feature engineering on full dataset (all backward-looking — no leakage).
      2. Chronological train / val / test split before any normalization.
      3. Fit scalers on training sequences only; transform val/test without refitting.
    '''
    # --- 1. Feature engineering ---
    X_all, _, df_features = prepare_ml_data(df, lookback)
    y_all = df_features[['Close']].values

    # --- 2. Chronological split ---
    n = len(X_all)
    test_size = int(n * val_frac)
    val_size  = int(n * val_frac)
    val_end   = n - test_size
    train_end = val_end - val_size

    X_train, y_train = X_all[:train_end],        y_all[:train_end]
    X_val,   y_val   = X_all[train_end:val_end], y_all[train_end:val_end]

    # --- 3. Sliding-window sequences ---
    X_train_raw, y_train_raw = create_sequences(X_train, y_train, seq_len, days_ahead)
    X_val_raw,   y_val_raw   = create_sequences(X_val,   y_val,   seq_len, days_ahead)

    if len(X_train_raw) == 0:
        raise ValueError("Not enough training data to form sequences.")

    n_train, seq_len_, n_features = X_train_raw.shape

    # --- 4. Fit scalers on training data only ---
    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()

    X_train_scaled = scaler_X.fit_transform(X_train_raw.reshape(-1, n_features)).reshape(n_train, seq_len_, n_features)
    y_train_scaled = scaler_y.fit_transform(y_train_raw.reshape(-1, 1)).reshape(y_train_raw.shape)

    if len(X_val_raw) > 0:
        X_val_scaled = scaler_X.transform(X_val_raw.reshape(-1, n_features)).reshape(X_val_raw.shape)
        y_val_scaled = scaler_y.transform(y_val_raw.reshape(-1, 1)).reshape(y_val_raw.shape)
    else:
        X_val_scaled = X_val_raw
        y_val_scaled = y_val_raw

    X_train_t = torch.FloatTensor(X_train_scaled)
    y_train_t = torch.FloatTensor(y_train_scaled)
    X_val_t   = torch.FloatTensor(X_val_scaled)
    y_val_t   = torch.FloatTensor(y_val_scaled)

    # --- 5. Build and train model ---
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
    loader = DataLoader(TensorDataset(X_train_t, y_train_t), batch_size=batch_size, shuffle=True)

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

        if (epoch + 1) % 10 == 0 and len(X_val_raw) > 0:
            model.eval()
            with torch.no_grad():
                val_pred = model(X_val_t.to(device))
                val_loss = criterion(val_pred, y_val_t.to(device))
            print(f"Epoch {epoch+1}/{epochs} | Train Loss: {total_loss/len(loader):.6f} | Val Loss: {val_loss:.6f}")

    # Compute val MAPE on day-1 predictions (inverse-transformed) for confidence scoring
    val_mape = None
    if len(X_val_raw) > 0:
        model.eval()
        with torch.no_grad():
            val_pred_scaled = model(X_val_t.to(device)).cpu().numpy()
        pred_day1 = scaler_y.inverse_transform(val_pred_scaled[:, :1].reshape(-1, 1)).flatten()
        actual_day1 = y_val_raw[:len(val_pred_scaled), 0]
        denom = np.maximum(np.abs(actual_day1), 1e-9)
        val_mape = float(np.mean(np.abs((actual_day1 - pred_day1) / denom)) * 100)

    return model, scaler_X, scaler_y, device, val_mape

def transformer_predict(df, model, scaler_X, scaler_y, device, lookback=14, seq_len=30):
    '''Predict future stock prices using the trained Transformer model'''
    try:
        model.eval()

        # Build features
        X_features, _, _ = prepare_ml_data(df, lookback)

        if len(X_features) < seq_len:
            print(f"transformer_predict: insufficient data ({len(X_features)} rows < seq_len={seq_len})")
            return None

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

# Main for Testing
if __name__ == "__main__":
    # Test the models
    ticker = 'AAPL'
    print(f"Testing ensemble model for {ticker}...")

    # Download data
    df = create_dataset(ticker, period="2y")

    # Get predictions
    print("\nPredictions:")
    print("\nIndividual models:")
    linear_reg = linear_regression_predict(df, days_ahead=7)
    random_forest = random_forest_predict(df, days_ahead=7)
    xgboost = xgboost_predict(df, days_ahead=7)
    print(f"Linear Regression: {linear_reg}")
    print(f"Random Forest: {random_forest}")
    if XGBOOST_AVAILABLE:
        print(f"XGBoost: {xgboost}")


    # LSTM Train
    print("\nTraining LSTM model...")
    lookback = 14
    seq_len = 30
    days_ahead = 7
    model, scaler_X, scaler_y, device = lstm_train(df, lookback=lookback, seq_len=seq_len, days_ahead=days_ahead, hidden_size=64, layer_size=2, epochs=100, batch_size=32, lr=0.001)

    # Predict
    lstm_pred = lstm_predict(df, model, scaler_X, scaler_y, device, lookback=lookback, seq_len=seq_len)

    # Output
    if lstm_pred is not None:
        print("\nPredicted prices:")
        for i, price in enumerate(lstm_pred):
            print(f"Day {i+1} → ${price:.2f}")


    # Transformer Train
    print("\nTraining Transformer model...")
    model, scaler_X, scaler_y, device = transformer_train(df, lookback=lookback, seq_len=seq_len, days_ahead=days_ahead, d_model=64, nhead=4, num_layers=2, epochs=100, batch_size=32, lr=0.001)

    # Transformer Predict
    transformer_pred = transformer_predict(df, model, scaler_X, scaler_y, device, lookback=lookback, seq_len=seq_len)

    # Output 
    if transformer_pred is not None:
        print("\nPredicted prices:")
        for i, price in enumerate(transformer_pred):
            print(f"Day {i+1} → ${price:.2f}")


    ensemble, ensemble_pred = ensemble_predict(df, days_ahead=days_ahead)
    if ensemble is not None:
        print(f"\nEnsemble Predictions (Next {days_ahead} Days)")
        for i, val in enumerate(ensemble, start=1):
            print(f"Day {i}: {val:.2f}")

        print(f"\nIndividual Model Predictions")
        for model_name, preds in ensemble_pred.items():
            print(f"\n{model_name}:")
            for i, val in enumerate(preds, start=1):
                print(f"Day {i}: {val:.2f}")
    else:
        print("No predictions available.")
