# 📈 MarketMind

**Professional Stock Market Prediction & Analysis Platform**

MarketMind is a full-stack application that provides stock market predictions using advanced machine learning models, professional backtesting, and comprehensive performance evaluation.

## 🎯 Features

### Core Functionality
- **Stock Price Predictions** - 7-day forecast using ensemble ML models
- **Model Performance Evaluation** - Professional backtesting with rolling windows
- **Multiple ML Models** - Random Forest, XGBoost, Linear Regression, Ensemble
- **Real-time Stock Data** - Live prices and historical data
- **Market News** - Latest financial news and insights
- **Watchlist Management** - Track your favorite stocks
- **Dark Mode** - Full dark/light theme support

### Technical Features
- **42 Engineered Features** - Lagged prices, moving averages, volatility, momentum, volume
- **Rolling Window Backtesting** - Realistic evaluation with model retraining
- **Comprehensive Metrics** - MAE, RMSE, MAPE, R², Directional Accuracy
- **Trading Performance** - Sharpe Ratio, Max Drawdown, Returns vs Buy-and-Hold
- **Data Quality** - Alpha Vantage + yfinance with validation and outlier removal
- **Professional API** - RESTful endpoints with Flask

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python api.py
```

Backend runs on: `http://localhost:5001`

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

Frontend runs on: `http://localhost:3000`

## 📊 API Endpoints

### Stock Data
- `GET /stock/<ticker>` - Stock information and current price
- `GET /chart/<ticker>` - Historical chart data (1 year)

### Predictions
- `GET /predict/<ticker>` - 7-day price prediction (Linear Regression)
- `GET /predict/ensemble/<ticker>` - 7-day ensemble prediction (RF + XGB + LR)

### Model Evaluation
- `GET /evaluate/<ticker>?test_days=60&retrain_frequency=5` - Professional backtesting

### Watchlist
- `GET /watchlist` - Get all watchlist items
- `POST /watchlist` - Add ticker to watchlist
- `DELETE /watchlist/<ticker>` - Remove ticker

### News
- `GET /news` - Latest market news

## 🧠 Machine Learning Models

### Models Used
1. **Random Forest Regressor** - 100 trees, ensemble learning
2. **XGBoost** - Gradient boosting with 100 estimators
3. **Linear Regression** - Baseline time series model
4. **Ensemble** - Weighted average of all models

### Feature Engineering (42 Features)
- **Lagged Prices** (30) - Previous 30 days
- **Moving Averages** (4) - 5, 10, 20, 30 day SMA
- **Volatility** (3) - 5, 10, 20 day standard deviation
- **Momentum** (3) - 1, 5, 20 day returns
- **Volume Ratios** (2) - 5, 20 day average ratios

### Evaluation Metrics
- **MAE** - Mean Absolute Error
- **RMSE** - Root Mean Square Error
- **MAPE** - Mean Absolute Percentage Error
- **R²** - Coefficient of Determination
- **Directional Accuracy** - % of correct up/down predictions
- **Sharpe Ratio** - Risk-adjusted returns
- **Max Drawdown** - Largest peak-to-trough decline

## 🗂️ Project Structure

```
MarketMind/
├── backend/
│   ├── api.py                          # Flask API
│   ├── model.py                        # Linear regression predictor
│   ├── ensemble_model.py               # RF + XGBoost + Ensemble
│   ├── professional_evaluation.py      # Rolling window backtesting
│   ├── data_fetcher.py                 # Data pipeline (yfinance + Alpha Vantage)
│   ├── news_fetcher.py                 # News API integration
│   ├── requirements.txt                # Python dependencies
│   └── DATA_SPECS.md                   # Technical specifications
│
├── frontend/
│   ├── src/
│   │   ├── App.js                      # Main app component
│   │   ├── components/
│   │   │   ├── Header.js               # Navigation
│   │   │   ├── SearchPage.js           # Stock search
│   │   │   ├── PredictionsPage.js      # Predictions view
│   │   │   ├── ModelPerformancePage.js # Evaluation dashboard
│   │   │   ├── WatchlistPage.js        # Watchlist management
│   │   │   ├── NewsPage.js             # News feed
│   │   │   └── charts/
│   │   │       ├── ActualVsPredictedChart.js
│   │   │       └── PredictionChart.js
│   │   └── index.css                   # Tailwind styles
│   └── package.json
│
└── README.md
```

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
ALPHA_VANTAGE_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
```

## 🎨 Tech Stack

### Backend
- **Flask** - Web framework
- **scikit-learn** - Random Forest, Linear Regression
- **XGBoost** - Gradient boosting
- **pandas** - Data manipulation
- **yfinance** - Stock data (primary)
- **Alpha Vantage** - Stock data (fallback)
- **NumPy** - Numerical computing

### Frontend
- **React** - UI framework
- **Chart.js** - Data visualization
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

## 📈 Performance

**Typical Results (AAPL, 60-day backtest):**
- MAE: $2-5
- MAPE: 1-2%
- R²: 0.80-0.93
- Directional Accuracy: 55-65%

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Disclaimer

This tool is for educational and research purposes only. Stock market predictions are inherently uncertain. Past performance does not guarantee future results. Always do your own research and consult with financial advisors before making investment decisions.
