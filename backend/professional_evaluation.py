"""
Professional-grade ML model evaluation system
Implements DATA_SPECS.md with 42 fixed features and rolling window backtesting
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error, r2_score
import warnings
warnings.filterwarnings('ignore')

# Try XGBoost
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except:
    XGBOOST_AVAILABLE = False

from data_fetcher import prepare_data_for_ml


def create_fixed_features(df, lookback=30):
    """
    Create EXACTLY 42 features (always consistent)
    
    Features:
    - 30 lagged prices
    - 4 moving averages (5, 10, 20, 30 day)
    - 3 volatility measures (5, 10, 20 day std)
    - 3 momentum indicators (1, 5, 20 day returns)
    - 2 volume ratios (5, 20 day)
    
    Total: 42 features
    """
    df = df.copy()
    features = []
    
    # 1. Lagged Prices (30 features)
    for i in range(1, lookback + 1):
        col_name = f'lag_{i}'
        df[col_name] = df['Close'].shift(i)
        features.append(col_name)
    
    # 2. Moving Averages (4 features)
    for window in [5, 10, 20, 30]:
        col_name = f'MA_{window}'
        df[col_name] = df['Close'].rolling(window=window, min_periods=1).mean()
        features.append(col_name)
    
    # 3. Volatility (3 features)
    for window in [5, 10, 20]:
        col_name = f'std_{window}'
        df[col_name] = df['Close'].rolling(window=window, min_periods=1).std()
        features.append(col_name)
    
    # 4. Momentum / Returns (3 features)
    for window in [1, 5, 20]:
        col_name = f'return_{window}day'
        df[col_name] = df['Close'].pct_change(periods=window)
        features.append(col_name)
    
    # 5. Volume Ratios (2 features)
    for window in [5, 20]:
        col_name = f'volume_ratio_{window}'
        avg_volume = df['Volume'].rolling(window=window, min_periods=1).mean()
        df[col_name] = df['Volume'] / avg_volume
        df[col_name] = df[col_name].replace([np.inf, -np.inf], 1.0)
        features.append(col_name)
    
    # Fill NaN values
    df[features] = df[features].fillna(method='ffill').fillna(method='bfill').fillna(0)
    
    assert len(features) == 42, f"Expected 42 features, got {len(features)}"
    
    return df, features


def train_models(X_train, y_train):
    """
    Train all 3 models: RandomForest, XGBoost, LinearRegression
    
    Returns dict of trained models
    """
    models = {}
    
    # Random Forest
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    models['random_forest'] = rf
    
    # XGBoost
    if XGBOOST_AVAILABLE:
        xgb_model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1
        )
        xgb_model.fit(X_train, y_train)
        models['xgboost'] = xgb_model
    
    # Linear Regression
    lr = LinearRegression()
    lr.fit(X_train, y_train)
    models['linear_regression'] = lr
    
    return models


def rolling_window_backtest(ticker, test_days=60, retrain_frequency=5):
    """
    Professional rolling window backtesting
    
    Process:
    1. Fetch 2 years of data
    2. Create 42 fixed features
    3. Split: train on first 250+ days, test on last test_days
    4. Retrain every retrain_frequency days
    5. Predict 1 day ahead
    6. Calculate metrics
    
    Returns comprehensive evaluation results
    """
    print(f"\n{'='*60}")
    print(f"PROFESSIONAL EVALUATION: {ticker}")
    print(f"{'='*60}\n")
    
    # 1. Fetch and prepare data
    print(f"[1/6] Fetching data...")
    df_raw = prepare_data_for_ml(ticker, min_days=280)
    
    if df_raw is None or len(df_raw) < 280:
        return None
    
    # 2. Create fixed 42 features
    print(f"[2/6] Engineering 42 features...")
    df, feature_cols = create_fixed_features(df_raw, lookback=30)
    
    print(f"  ✓ Features: {len(feature_cols)}")
    print(f"  ✓ Data shape: {df.shape}")
    
    # 3. Define train/test split
    test_start_idx = len(df) - test_days
    min_train_days = 250
    
    if test_start_idx < min_train_days:
        print(f"  ✗ Insufficient data: need {min_train_days} train days")
        return None
    
    print(f"  ✓ Train: days 1-{test_start_idx} ({test_start_idx} days)")
    print(f"  ✓ Test: days {test_start_idx}-{len(df)} ({test_days} days)")
    
    # 4. Rolling window predictions
    print(f"[3/6] Running rolling window backtest...")
    
    predictions = {
        'random_forest': [],
        'xgboost': [] if XGBOOST_AVAILABLE else None,
        'linear_regression': [],
        'ensemble': []
    }
    actuals = []
    dates = []
    
    models = None
    last_train_idx = None
    
    for i in range(test_start_idx, len(df) - 1):
        # Retrain models every retrain_frequency days or first iteration
        if models is None or (i - test_start_idx) % retrain_frequency == 0:
            train_data = df.iloc[:i]
            X_train = train_data[feature_cols].values
            y_train = train_data['Close'].values
            
            print(f"  → Training at day {i} ({len(X_train)} samples)...")
            models = train_models(X_train, y_train)
            last_train_idx = i
        
        # Prepare test sample (1-day ahead prediction)
        X_test = df.iloc[i][feature_cols].values.reshape(1, -1)
        y_actual = df.iloc[i + 1]['Close']
        
        # Predict with each model
        pred_rf = models['random_forest'].predict(X_test)[0]
        predictions['random_forest'].append(pred_rf)
        
        if XGBOOST_AVAILABLE and 'xgboost' in models:
            pred_xgb = models['xgboost'].predict(X_test)[0]
            predictions['xgboost'].append(pred_xgb)
        
        pred_lr = models['linear_regression'].predict(X_test)[0]
        predictions['linear_regression'].append(pred_lr)
        
        # Ensemble (average)
        ensemble_preds = [pred_rf, pred_lr]
        if XGBOOST_AVAILABLE and 'xgboost' in models:
            ensemble_preds.append(pred_xgb)
        pred_ensemble = np.mean(ensemble_preds)
        predictions['ensemble'].append(pred_ensemble)
        
        # Store actual
        actuals.append(y_actual)
        dates.append(df.index[i + 1])
    
    print(f"  ✓ Generated {len(actuals)} predictions")
    
    # 5. Calculate metrics
    print(f"[4/6] Calculating metrics...")
    actuals_array = np.array(actuals)
    
    results = {
        'ticker': ticker,
        'test_period': {
            'start_date': dates[0].strftime('%Y-%m-%d'),
            'end_date': dates[-1].strftime('%Y-%m-%d'),
            'days': len(dates)
        },
        'dates': [d.strftime('%Y-%m-%d') for d in dates],
        'actuals': [float(a) for a in actuals],
        'models': {}
    }
    
    for model_name, preds in predictions.items():
        if preds is None or len(preds) == 0:
            continue
        
        preds_array = np.array(preds)
        
        # Accuracy metrics
        mae = mean_absolute_error(actuals_array, preds_array)
        rmse = np.sqrt(mean_squared_error(actuals_array, preds_array))
        mape = mean_absolute_percentage_error(actuals_array, preds_array) * 100
        r2 = r2_score(actuals_array, preds_array)
        
        # Directional accuracy
        if len(preds_array) > 1:
            pred_direction = np.diff(preds_array) > 0
            actual_direction = np.diff(actuals_array) > 0
            dir_acc = np.mean(pred_direction == actual_direction) * 100
        else:
            dir_acc = 0
        
        results['models'][model_name] = {
            'predictions': [float(p) for p in preds],
            'metrics': {
                'mae': round(float(mae), 2),
                'rmse': round(float(rmse), 2),
                'mape': round(float(mape), 2),
                'r_squared': round(float(r2), 4),
                'directional_accuracy': round(float(dir_acc), 2)
            }
        }
        
        print(f"  ✓ {model_name}: MAE=${mae:.2f}, MAPE={mape:.2f}%, R²={r2:.4f}")
    
    # 6. Calculate trading returns
    print(f"[5/6] Calculating trading returns...")
    ensemble_preds = np.array(predictions['ensemble'])
    returns_data = calculate_trading_returns(ensemble_preds, actuals_array)
    results['returns'] = returns_data
    
    # Best model
    best_by_mape = min(
        results['models'].items(),
        key=lambda x: x[1]['metrics']['mape']
    )[0]
    results['best_model'] = best_by_mape
    
    print(f"[6/6] Complete!")
    print(f"\n{'='*60}")
    print(f"BEST MODEL: {best_by_mape.upper()}")
    print(f"{'='*60}\n")
    
    return results


def calculate_trading_returns(predictions, actuals, initial_capital=10000):
    """
    Calculate returns from a simple trading strategy
    
    Strategy: Buy if predict >0.5% increase, sell if predict >0.5% decrease
    """
    if len(predictions) < 2:
        return None
    
    capital = initial_capital
    shares = 0
    portfolio_values = [initial_capital]
    num_trades = 0
    
    for i in range(len(predictions) - 1):
        pred_return = (predictions[i + 1] - predictions[i]) / predictions[i]
        actual_price = actuals[i]
        next_price = actuals[i + 1]
        
        # Buy signal
        if pred_return > 0.005 and shares == 0 and capital > 0:
            shares = capital / actual_price
            capital = 0
            num_trades += 1
        
        # Sell signal
        elif pred_return < -0.005 and shares > 0:
            capital = shares * actual_price
            shares = 0
            num_trades += 1
        
        # Portfolio value
        portfolio_value = capital + (shares * next_price)
        portfolio_values.append(portfolio_value)
    
    # Final liquidation
    if shares > 0:
        capital = shares * actuals[-1]
    
    total_return = ((capital - initial_capital) / initial_capital) * 100
    
    # Buy and hold
    buy_hold_final = (initial_capital / actuals[0]) * actuals[-1]
    buy_hold_return = ((buy_hold_final - initial_capital) / initial_capital) * 100
    
    # Sharpe ratio (simplified)
    returns_series = np.diff(portfolio_values) / portfolio_values[:-1]
    sharpe = (np.mean(returns_series) / np.std(returns_series)) * np.sqrt(252) if np.std(returns_series) > 0 else 0
    
    # Max drawdown
    portfolio_array = np.array(portfolio_values)
    running_max = np.maximum.accumulate(portfolio_array)
    drawdown = (portfolio_array - running_max) / running_max * 100
    max_drawdown = np.min(drawdown)
    
    return {
        'initial_capital': initial_capital,
        'final_value': round(float(capital), 2),
        'total_return': round(float(total_return), 2),
        'buy_hold_return': round(float(buy_hold_return), 2),
        'outperformance': round(float(total_return - buy_hold_return), 2),
        'sharpe_ratio': round(float(sharpe), 2),
        'max_drawdown': round(float(max_drawdown), 2),
        'num_trades': num_trades,
        'portfolio_values': [round(float(v), 2) for v in portfolio_values]
    }


if __name__ == "__main__":
    # Test the professional evaluation
    result = rolling_window_backtest('AAPL', test_days=60, retrain_frequency=5)
    
    if result:
        print("\n" + "="*60)
        print("RESULTS SUMMARY")
        print("="*60)
        print(f"\nTicker: {result['ticker']}")
        print(f"Period: {result['test_period']['start_date']} to {result['test_period']['end_date']}")
        print(f"Days tested: {result['test_period']['days']}")
        
        print("\nModel Performance:")
        for model_name, data in result['models'].items():
            metrics = data['metrics']
            print(f"\n{model_name.upper()}:")
            print(f"  MAE:  ${metrics['mae']}")
            print(f"  RMSE: ${metrics['rmse']}")
            print(f"  MAPE: {metrics['mape']}%")
            print(f"  R²:   {metrics['r_squared']}")
            print(f"  Dir Acc: {metrics['directional_accuracy']}%")
        
        print(f"\nTrading Performance (Ensemble):")
        returns = result['returns']
        print(f"  Initial: ${returns['initial_capital']}")
        print(f"  Final:   ${returns['final_value']}")
        print(f"  Return:  {returns['total_return']}%")
        print(f"  B&H:     {returns['buy_hold_return']}%")
        print(f"  Outperf: {returns['outperformance']}%")
        print(f"  Sharpe:  {returns['sharpe_ratio']}")
        print(f"  Max DD:  {returns['max_drawdown']}%")
        print(f"  Trades:  {returns['num_trades']}")
