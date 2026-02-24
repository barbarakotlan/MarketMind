# 📈 MarketMind

**Professional Stock Market Prediction & Multi-Asset Analysis Platform**

MarketMind is a comprehensive stock market intelligence platform that provides real-time stock data, AI-powered price predictions, professional backtesting tools, and virtual paper trading capabilities.

### Key Features
- **🤖 AI-Powered Predictions** - 7-day stock price forecasting using ensemble ML models (Random Forest, XGBoost, Linear Regression)
- **📊 Professional Backtesting** - Rolling window evaluation with 40+ performance metrics (Sharpe Ratio, Max Drawdown, Returns vs Buy-and-Hold)
- **💰 Paper Trading** - Virtual portfolio management with persistent data storage
- **📈 Real-time Data** - Live stock prices, forex rates, cryptocurrency, and commodities
- **📋 Watchlist Management** - Track multiple stocks with detailed analytics
- **🔍 Comprehensive Analysis** - 40+ fundamental metrics and technical indicators
- **🌗 Dark Mode UI** - Modern, responsive interface with dark/light theme support
- **💾 Database Persistence** - All data stored in SQLite database with migration support

## 🎯 Features

### 📊 Stock Analysis & Predictions
- **Stock Price Predictions** - 7-day forecast using ensemble ML models
- **Model Performance Evaluation** - Professional backtesting with rolling windows
- **Multiple ML Models** - Random Forest, XGBoost, Linear Regression, Ensemble
- **Company Fundamentals** - 40+ financial metrics (P/E, EPS, margins, growth rates)
- **Real-time Stock Data** - Live prices and historical data
- **Watchlist Management** - Track your favorite stocks

### 💼 Paper Trading
- **Virtual Trading Portfolio** - Practice trading with $100,000 virtual cash
- **Buy/Sell Functionality** - Real-time stock transactions
- **Portfolio Tracking** - Track positions, P/L, and total value
- **Trade History** - Complete record of all transactions
- **Performance Metrics** - Returns, gains/losses per position

### 🌍 Multi-Asset Markets
- **Forex (Foreign Exchange)** - Real-time currency conversion for 20+ pairs
- **Cryptocurrency** - Live crypto prices (BTC, ETH, ADA, DOT, SOL, etc.)
- **Commodities** - 12 futures markets (Energy, Metals, Agriculture)
  - Energy: Crude Oil (WTI/Brent), Natural Gas
  - Metals: Gold, Silver, Copper, Platinum
  - Agriculture: Wheat, Corn, Coffee, Sugar, Cotton

### 🎨 User Experience
- **Dark Mode** - Full dark/light theme support with toggle
- **Lucide Icons** - Professional icon system throughout
- **Responsive Design** - Mobile-friendly interface
- **Error Recovery** - Retry buttons for failed API calls
- **Recent Searches** - Quick access to previously searched stocks

### 🔧 Technical Features
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

# Initialize database with seed data
python migrate.py init
python migrate.py seed

brew install libomp #For Mac homebrew

# Start the API server
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
- `GET /fundamentals/<ticker>` - Company fundamentals (40+ metrics)

### Predictions
- `GET /predict/<ticker>` - 7-day price prediction (Linear Regression)
- `GET /predict/ensemble/<ticker>` - 7-day ensemble prediction (RF + XGB + LR)

### Model Evaluation
- `GET /evaluate/<ticker>?test_days=60&retrain_frequency=5` - Professional backtesting

### Paper Trading
- `GET /paper/portfolio` - Get portfolio summary and positions
- `POST /paper/buy` - Buy stocks (body: `{ticker, shares}`)
- `POST /paper/sell` - Sell stocks (body: `{ticker, shares}`)
- `GET /paper/history` - Get trade history
- `POST /paper/reset` - Reset portfolio to initial state

### Forex
- `GET /forex/convert?from=USD&to=EUR` - Currency exchange rate
- `GET /forex/currencies` - List of available currencies

### Cryptocurrency
- `GET /crypto/convert?from=BTC&to=USD` - Crypto exchange rate
- `GET /crypto/list` - List of popular cryptocurrencies
- `GET /crypto/currencies` - List of target fiat currencies

### Commodities
- `GET /commodities/price/<commodity>` - Commodity futures price
- `GET /commodities/list` - List of available commodities
- `GET /commodities/all` - All commodities grouped by category

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
│   ├── api.py                  # Flask API with all endpoints
│   ├── database.py             # SQLAlchemy database models and utilities
│   ├── migrate.py              # Database migration and seeding scripts
│   ├── model.py                # Linear regression predictor
│   ├── ensemble_model.py       # RF + XGBoost + Ensemble
│   ├── professional_evaluation.py      # Rolling window backtesting
│   ├── data_fetcher.py         # Data pipeline (yfinance + Alpha Vantage)
│   ├── forex_fetcher.py        # Forex exchange rates
│   ├── crypto_fetcher.py       # Cryptocurrency prices
│   ├── commodities_fetcher.py  # Commodity futures data
│   ├── news_fetcher.py         # News API integration
│   ├── security.py             # Rate limiting and input validation
│   ├── logger_config.py        # Logging configuration
│   ├── requirements.txt        # Python dependencies
│   ├── test_db.py              # Database integration tests
│   └── DATA_SPECS.md           # Technical specifications
│
├── frontend/
│   ├── src/
│   │   ├── App.js                      # Main app component
│   │   ├── components/
│   │   │   ├── Header.js               # Navigation with dropdown
│   │   │   ├── SearchPage.js           # Stock search
│   │   │   ├── PredictionsPage.js      # Predictions view
│   │   │   ├── ModelPerformancePage.js # Evaluation dashboard
│   │   │   ├── FundamentalsPage.js     # Company fundamentals
│   │   │   ├── PaperTradingPage.js     # Virtual trading portfolio
│   │   │   ├── ForexPage.js            # Currency exchange
│   │   │   ├── CryptoPage.js           # Cryptocurrency tracking
│   │   │   ├── CommoditiesPage.js      # Commodities market
│   │   │   ├── WatchlistPage.js        # Watchlist management
│   │   │   ├── NewsPage.js             # News feed
│   │   │   └── charts/
│   │   │       ├── ActualVsPredictedChart.js
│   │   │       └── PredictionChart.js
│   │   ├── context/
│   │   │   └── DarkModeContext.js      # Dark mode provider
│   │   └── index.css                   # Tailwind styles
│   ├── public/
│   │   └── index.html                  # HTML template
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
- **Flask-CORS** - Cross-origin resource sharing
- **Flask-SQLAlchemy** - Database ORM
- **Flask-Limiter** - Rate limiting
- **scikit-learn** - Random Forest, Linear Regression
- **XGBoost** - Gradient boosting
- **pandas** - Data manipulation
- **yfinance** - Stock & commodity data (primary)
- **Alpha Vantage** - Forex, crypto, fundamentals API
- **NumPy** - Numerical computing
- **requests** - HTTP library
- **python-dotenv** - Environment variables
- **SQLite** - Database storage

### Frontend
- **React** - UI framework
- **Chart.js** - Data visualization
- **Tailwind CSS** - Styling
- **lucide-react** - Professional icon system
- **Axios** - HTTP client
- **Context API** - State management (Dark mode)

## 💾 Database

MarketMind uses SQLite for persistent data storage with SQLAlchemy ORM. The database includes:

### Database Models
- **User** - User accounts (demo user for development)
- **Watchlist** - Stock watchlists with detailed data
- **Portfolio** - Paper trading portfolios
- **Position** - Current stock positions in portfolios
- **Trade** - Complete trade history
- **Alert** - Price alerts and notifications
- **PortfolioHistory** - Daily portfolio snapshots for analytics

### Database Operations
```bash
# Initialize database
python migrate.py init

# Reset database (clear all data)
python migrate.py reset

# Seed with sample data
python migrate.py seed

# Backup database
python migrate.py backup

# Restore from backup
python migrate.py restore backup_file.db

# View database info
python migrate.py info
```

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
>>>>>>> 2e78c3d026cb68bb66abfca85131da7d22f7700e
