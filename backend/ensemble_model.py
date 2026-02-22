import warnings
warnings.filterwarnings('ignore')
import model
import yfinance as yf
import pandas as pd
import numpy as np
from copy import deepcopy as dc
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler
from sklearn.preprocessing import MinMaxScaler
from statsmodels.tsa.ar_model import AutoReg
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

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


# Neural Network Class
class NeuralNetwork(nn.Module):
    """
    Neural Network
    """
    def __init__(self, input_size, hidden_sizes):
        super().__init__()
        layers = []
        prev_size = input_size

        # Create hidden layers
        for h in hidden_sizes:
            layers.append(nn.Linear(prev_size, h))
            layers.append(nn.ReLU())
            prev_size = h

        layers.append(nn.Linear(prev_size, 1))  # output layer
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        """
        Forward pass
        """
        return self.net(x)

# Artificial Neural Network prediction function
def ann_predict(df, days_ahead=7):
    """
    Neural Network prediction
    """
    # Setup data
    df = df.copy()
    df['H-L'] = df["High"] - df["Low"]
    df['O-C'] = df["Open"] - df["Close"]
    df['ma_7'] = df["Close"].rolling(window=7).mean()
    df['ma_14'] = df["Close"].rolling(window=14).mean()
    df['ma_21'] = df["Close"].rolling(window=21).mean()
    df['std_7'] = df["Close"].rolling(window=7).std()

    # Drop Today's data 
    df = df[df.index < pd.Timestamp.today().normalize()]

    # Data for forcasting
    df["Target"] = df["Close"].shift(-days_ahead)

    # Drop rows with NaN values
    df = df.dropna()

    # Setup df for ML
    features = ['H-L','O-C','ma_7', 'ma_14', 'ma_21', 'std_7']
    x = df[features].values
    y = df["Target"].values

    # Scale features
    x_scaler = StandardScaler()
    y_scaler = StandardScaler()
    x = x_scaler.fit_transform(x)
    y = y_scaler.fit_transform(y.reshape(-1, 1))

    # Convert to tensors
    device = "cuda" if torch.cuda.is_available() else "cpu"
    x = torch.tensor(x, dtype=torch.float32).to(device)
    y = torch.tensor(y, dtype=torch.float32).to(device)

    # Model setup
    hidden_sizes = [3]
    model = NeuralNetwork(6, hidden_sizes).to(device)

    # Create DataLoader for batching
    train_loader = DataLoader(TensorDataset(x, y), batch_size=32, shuffle=False)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    # Train the model
    for epoch in range(1000):
        model.train()
        total_loss = 0

        for xb, yb in train_loader:
            preds = model(xb)
            loss = criterion(preds, yb)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

    print(f"Epoch {epoch+1}, Loss: {total_loss/len(train_loader):.6f}")
    
    # Run ANN
    # try:

    #     df["Predicted_ANN"] = np.nan
    #     # Get the last available date
    #     last_date = df.index[-1]

    # except Exception as e:
    #     print(f"ANN error: {e}")
    #     return None


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
def lstm_train(df, lookback=14, seq_len=60, forecast_horizon=7, hidden_size=64, layer_size=2, epochs=50, batch_size=32, lr=0.001):
    '''Train an LSTM model for stock price prediction'''
    # --- Build features ---
    X_features, _, df_features = prepare_ml_data(df, lookback)
    y_values = df_features[['Close']].values

    # --- Create sequences BEFORE splitting and scaling ---
    X_seq, y_seq = create_sequences(X_features, y_values, seq_len, forecast_horizon)

    # --- Split BEFORE normalizing ---
    split = int(len(X_seq) * 0.8)
    X_train_raw, X_test_raw = X_seq[:split], X_seq[split:]
    y_train_raw, y_test_raw = y_seq[:split], y_seq[split:]

    # --- Fit scalers on training data only ---
    # Reshape to 2D to fit scaler, then reshape back to 3D
    n_train, seq_len_, n_features = X_train_raw.shape

    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()

    # Flatten time dimension to fit scaler across all timesteps in training set
    X_train_scaled = scaler_X.fit_transform(X_train_raw.reshape(-1, n_features)).reshape(n_train, seq_len_, n_features)
    X_test_scaled = scaler_X.transform(X_test_raw.reshape(-1, n_features)).reshape(X_test_raw.shape)

    y_train_scaled = scaler_y.fit_transform(y_train_raw.reshape(-1, 1)).reshape(y_train_raw.shape)
    y_test_scaled  = scaler_y.transform(y_test_raw.reshape(-1, 1)).reshape(y_test_raw.shape)

    # --- Convert to tensors ---
    X_train = torch.FloatTensor(X_train_scaled)
    X_test  = torch.FloatTensor(X_test_scaled)
    y_train = torch.FloatTensor(y_train_scaled)
    y_test  = torch.FloatTensor(y_test_scaled)

    # --- Model ---
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    input_size = n_features
    model = LSTM(input_size, hidden_size, layer_size, forecast_horizon).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    loader = DataLoader(TensorDataset(X_train, y_train), batch_size=batch_size, shuffle=True)

    # --- Training loop ---
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
            model.eval()
            with torch.no_grad():
                val_pred = model(X_test.to(device), device)
                val_loss = criterion(val_pred, y_test.to(device))
            print(f"Epoch {epoch+1}/{epochs} | Train Loss: {total_loss/len(loader):.6f} | Val Loss: {val_loss:.6f}")

    return model, scaler_X, scaler_y, device

# Long Short-Term Memory (LSTM) prediction function
def lstm_predict(df, model, scaler_X, scaler_y, device, lookback=14, seq_len=60):
    '''Predict future stock prices using the trained LSTM model'''
    try:
        model.eval()

        # --- Build features the same way as training ---
        X_features, _, _ = prepare_ml_data(df, lookback)

        # --- Take last seq_len rows BEFORE scaling ---
        last_window_raw = X_features[-seq_len:] # (seq_len, n_features)

        # --- Scale using training scaler (same reshape trick) ---
        n_features = last_window_raw.shape[1]
        last_window_scaled = scaler_X.transform(last_window_raw.reshape(-1, n_features)).reshape(1, seq_len, n_features)

        last_window_tensor = torch.FloatTensor(last_window_scaled).to(device)

        # --- Predict ---
        with torch.no_grad():
            pred_scaled = model(last_window_tensor, device).cpu().numpy() # (1, forecast_horizon)

        # --- Inverse transform ---
        pred_prices = scaler_y.inverse_transform(pred_scaled.reshape(-1, 1)).flatten()
        return pred_prices

    except Exception as e:
        print(f"LSTM error: {e}")
        return None


if __name__ == "__main__":
    # Test the models
    ticker = 'AAPL'
    print(f"Testing ensemble model for {ticker}...")

    # Download data
    data = yf.download(ticker, period="1y", auto_adjust=False)
    df = data[['Close']].copy()

    # # Get predictions
    # ensemble, individual = ensemble_predict(df, days_ahead=7)

    # print("\nPredictions:")
    # print(f"Ensemble: {ensemble}")
    # print(f"\nIndividual models:")
    # for model_name, preds in individual.items():
    #     print(f"  {model_name}: {preds}")
    # ann_predict(data)


    # --- LSTM Train ---
    lookback = 14
    seq_len = 60
    forcast_horizon = 30
    model, scaler_X, scaler_y, device = lstm_train(df, lookback=lookback, seq_len=seq_len, forecast_horizon=forcast_horizon, hidden_size=64, layer_size=2, epochs=100, batch_size=32, lr=0.001)

    # --- Predict ---
    predictions = lstm_predict(df, model, scaler_X, scaler_y, device, lookback=lookback, seq_len=seq_len)

    # --- Output ---
    if predictions is not None:
        last_date = df.index[-1]
        future_dates = pd.bdate_range(start=last_date, periods=forcast_horizon + 1)[1:]  # business days only
        for date, price in zip(future_dates, predictions):
            print(f"{date.date()} → ${price:.2f}")
