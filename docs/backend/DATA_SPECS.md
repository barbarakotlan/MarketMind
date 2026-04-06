# Prediction Stack v2 - Data Specifications

## 📊 Overview
This document defines the exact data requirements for professional backtesting and evaluation of our ML prediction models.

---

## 1. Historical Stock Data (Primary)

### Source
- **Primary Provider:** Alpha Vantage (TIME_SERIES_DAILY_ADJUSTED)
- **Fallback Provider:** yfinance
- **Period:** 2 years minimum (504 trading days)
- **Granularity:** Daily
- **Price Type:** Adjusted Close (handles splits/dividends)

### Why Alpha Vantage?
- ✅ More reliable than yfinance
- ✅ Up to 20+ years of historical data
- ✅ Properly adjusted for splits and dividends
- ✅ Better data quality and consistency
- ⚠️ Rate limit: 5 API calls per minute (free tier)

### Required Fields
```python
{
    'Date': DatetimeIndex,  # Trading dates (chronological)
    'Open': float,           # Opening price
    'High': float,           # Highest price of day
    'Low': float,            # Lowest price of day
    'Close': float,          # Closing price (PRIMARY TARGET)
    'Volume': int,           # Trading volume
    'Adj Close': float       # Adjusted closing price
}
```

### Data Quality Requirements
- ✅ No missing values in Close price
- ✅ Minimum 300 trading days
- ✅ Volume data present (no zeros)
- ✅ Chronological order
- ✅ No duplicate dates
- ✅ Remove outliers (>3 standard deviations)
- ✅ Handle market gaps (weekends, holidays)

---

## 2. Feature Engineering (Versioned Feature Spec)

### Feature Spec Version
`prediction-stack-v2`

The upgraded stack no longer relies on an "always 42 features" rule. Instead it uses a versioned forecasting feature specification orchestrated through `MLForecast`, with the exact realized feature columns depending on the active lag/rolling transforms.

### Feature Families

#### A. Lag Features
```python
lag_1
lag_2
lag_3
lag_5
lag_10
lag_20
```
**Purpose:** Capture short and medium-term price memory.

#### B. Rolling Trend Features
```python
rolling_mean_lag1_window_size3
rolling_mean_lag1_window_size5
rolling_mean_lag1_window_size10
rolling_mean_lag5_window_size3
```
**Purpose:** Capture local trend and smoothing behavior without hand-maintaining a fixed feature count.

#### C. Rolling Volatility Features
```python
rolling_std_lag1_window_size3
rolling_std_lag1_window_size5
rolling_std_lag1_window_size10
```
**Purpose:** Capture changing risk and dispersion regimes.

#### D. Momentum / Return Features
Momentum is represented implicitly through lag structure and rolling transforms rather than a hard-coded return-only block.

#### E. Volume-Derived Features
```python
volume_ratio_5
volume_ratio_20
```
**Purpose:** Detect unusual trading activity relative to recent participation.

#### F. Session / Calendar Features
```python
session_weekday
session_month
session_quarter
```
**Purpose:** Provide limited calendar structure while forecast horizons are mapped back to actual trading sessions.

### Handling Early Data
The feature pipeline uses partial rolling windows where appropriate and fills neutral defaults for unavailable volume ratios. Training still requires sufficient overall history before a model is considered eligible.

---

## 3. Backtesting Window Configuration

### Data Split
```
Total Data: 504 days (2 years)
├── Training: 250 days minimum (1 year)
├── Testing:  60 days (3 months)
└── Buffer:   30 days (for feature calculation)

Minimum: Need 280 days total (250 train + 30 buffer)
```

### Rolling Window Strategy
```
Timeline:
[Day 1 -------- Day 250] [Day 251 ------ Day 310]
      Training                 Testing

Iteration 1: Train on [1-250],   predict day 251
Iteration 2: Train on [1-255],   predict day 256  (retrain every 5 days)
Iteration 3: Train on [1-260],   predict day 261
Iteration 4: Train on [1-265],   predict day 266
...
Iteration 12: Train on [1-305],  predict day 310
```

### Parameters
```python
MIN_TRAIN_DAYS = 120      # Minimum history for production ensemble eligibility
TEST_DAYS = 60            # Testing period
RETRAIN_FREQUENCY = 5     # Retrain every 5 trading sessions
PREDICTION_HORIZON = 1    # Predict 1 trading session ahead in rolling evaluation
STEP_SIZE = 1             # Evaluate every day
```

---

## 4. Model Training Requirements

### Statistical Benchmarks (`StatsForecast`)
```python
naive
seasonal_naive_5
auto_arima
```

### Production ML Models (`MLForecast`)

#### Random Forest
```python
{
    'n_estimators': 200,
    'max_depth': 12,
    'min_samples_split': 4,
    'min_samples_leaf': 2,
    'random_state': 42,
    'n_jobs': -1
}
```

#### XGBoost
```python
{
    'n_estimators': 200,
    'max_depth': 6,
    'learning_rate': 0.05,
    'subsample': 0.85,
    'colsample_bytree': 0.85,
    'random_state': 42,
    'n_jobs': 1
}
```

#### Linear Regression
```python
{
    'model': 'sklearn.linear_model.LinearRegression',
    'orchestrator': 'MLForecast'
}
```

### Production Ensemble
The live production ensemble is a weighted average of:
- `auto_arima`
- `linear_regression`
- `random_forest`
- `xgboost`

Weights are derived from recent rolling validation error using inverse-error normalization, with equal-weight fallback when validation is unavailable.

---

## 5. Evaluation Metrics

### Accuracy Metrics
```python
MAE   = Mean Absolute Error (dollars)
RMSE  = Root Mean Square Error (dollars)
MAPE  = Mean Absolute Percentage Error (%)
R²    = Coefficient of Determination (0-1)
```

### Trading Performance Metrics
```python
Total Return         = % gain/loss from strategy
Buy-Hold Return      = % if just bought and held
Outperformance       = Total Return - Buy-Hold Return
Sharpe Ratio         = Risk-adjusted returns
Max Drawdown         = Largest peak-to-trough decline
Win Rate             = % of profitable trades
```

### Directional Accuracy
```python
Correct Direction    = % of times predicted up/down correctly
Correct Ups          = True positives
Correct Downs        = True negatives
False Positives      = Predicted up, went down
False Negatives      = Predicted down, went up
```

---

## 6. Data Structure Example

### Input DataFrame
```python
Shape: (N, feature_count + 1 target)

Index: DatetimeIndex(['2023-11-01', '2023-11-02', ...])

Columns:
- y                            # TARGET
- lag_1, lag_2, lag_3, ...
- rolling_mean_lag1_window_size3, ...
- rolling_std_lag1_window_size3, ...
- volume_ratio_5
- volume_ratio_20
- session_weekday
- session_month
- session_quarter
```

### Output JSON
```json
{
  "ticker": "AAPL",
  "model_name": "ensemble",
  "test_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-10-31",
    "days": 60
  },
  "predictions": [270.5, 271.2, 272.1, ...],
  "actuals": [269.8, 271.5, 271.9, ...],
  "dates": ["2025-08-01", "2025-08-02", ...],
  "metrics": {
    "mae": 1.85,
    "rmse": 2.34,
    "mape": 1.2,
    "r_squared": 0.92,
    "directional_accuracy": 78.3
  },
  "returns": {
    "initial_capital": 10000,
    "final_value": 11250,
    "total_return": 12.5,
    "buy_hold_return": 8.3,
    "outperformance": 4.2,
    "sharpe_ratio": 1.85,
    "max_drawdown": -3.2,
    "win_rate": 65.0,
    "num_trades": 24
  },
  "model_breakdown": {
    "linear_regression": {
      "mae": 2.10,
      "mape": 1.5
    },
    "random_forest": {
      "mae": 1.92,
      "mape": 1.3
    },
    "xgboost": {
      "mae": 1.72,
      "mape": 1.1
    },
    "ensemble": {
      "mae": 1.85,
      "mape": 1.2
    }
  }
}
```

---

## 7. Implementation Checklist

### Phase 1: Data Preparation
- [ ] Download 2 years of historical data via yfinance
- [ ] Validate data quality (no missing values)
- [ ] Create versioned forecasting features through MLForecast
- [ ] Handle early data (first 30 days)
- [ ] Normalize/standardize features
- [ ] Split into train/test windows

### Phase 2: Model Training
- [ ] Implement rolling window logic
- [ ] Train statistical benchmark models on first window
- [ ] Train Random Forest on first window
- [ ] Train XGBoost on first window
- [ ] Train Linear Regression on first window
- [ ] Retrain every 5 days

### Phase 3: Prediction & Evaluation
- [ ] Make predictions for each test day
- [ ] Store predictions and actuals
- [ ] Calculate all metrics (MAE, RMSE, MAPE, etc.)
- [ ] Calculate trading returns
- [ ] Calculate directional accuracy

### Phase 4: API Integration
- [ ] Create `/evaluate/<ticker>` endpoint
- [ ] Return comprehensive JSON response
- [ ] Include optional SHAP explainability payloads
- [ ] Add error handling
- [ ] Add logging

### Phase 5: Frontend Display
- [ ] Create actual vs predicted chart
- [ ] Display metrics table
- [ ] Show cumulative returns graph
- [ ] Model performance comparison

---

## 8. Example Usage

### Python Code
```python
from professional_evaluation import rolling_window_backtest

# Evaluate AAPL over 60 days
result = rolling_window_backtest(
    ticker='AAPL',
    test_days=60,
    retrain_frequency=5,
    fast_mode=False,
    include_explanations=True,
)

print(f"Feature spec: {result['featureSpecVersion']}")
print(f"MAE: ${result['models']['ensemble']['metrics']['mae']}")
print(f"MAPE: {result['models']['ensemble']['metrics']['mape']}%")
print(f"Return: {result['returns']['total_return']}%")
```

### API Call
```bash
curl "http://localhost:5001/evaluate/AAPL?test_days=60"
```

---

## 9. Performance Benchmarks

### Expected Performance
```
Good Model:
- MAPE < 2%
- Directional Accuracy > 60%
- Outperformance > 0%

Excellent Model:
- MAPE < 1%
- Directional Accuracy > 70%
- Outperformance > 5%
```

### Runtime
```
Single ticker evaluation (60 days):
- Random Forest: ~10 seconds
- XGBoost: ~8 seconds
- Linear Regression: ~2 seconds
- Total: ~20-30 seconds
```

---

## 10. Next Steps

1. ✅ Review this spec
2. ⏳ Implement fixed feature engineering
3. ⏳ Build rolling window backtester
4. ⏳ Create evaluation API
5. ⏳ Build frontend visualization

---

**Last Updated:** November 4, 2025
**Version:** 1.0
**Status:** Ready for Implementation
