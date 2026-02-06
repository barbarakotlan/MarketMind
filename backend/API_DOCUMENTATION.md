# 📚 MarketMind API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:5001`  
**Protocol:** HTTP/REST  
**Format:** JSON

---

## 📑 Table of Contents

1. [Stock Data](#stock-data)
2. [Predictions](#predictions)
3. [Model Evaluation](#model-evaluation)
4. [Company Fundamentals](#company-fundamentals)
5. [Paper Trading](#paper-trading)
6. [Forex](#forex)
7. [Cryptocurrency](#cryptocurrency)
8. [Commodities](#commodities)
9. [Watchlist](#watchlist)
10. [News](#news)
11. [Error Handling](#error-handling)

---

## 📊 Stock Data

### Get Stock Information

```http
GET /stock/<ticker>
```

**Description:** Retrieve current stock information and price

**Parameters:**
- `ticker` (string, path, required): Stock ticker symbol (e.g., "AAPL", "TSLA")

**Response:** `200 OK`
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "currentPrice": 175.43,
  "previousClose": 174.23,
  "change": 1.20,
  "changePercent": 0.69,
  "marketCap": 2876543210000,
  "volume": 54321098,
  "dayHigh": 176.89,
  "dayLow": 174.12
}
```

**Errors:**
- `404`: Stock ticker not found
- `500`: Server error

---

### Get Chart Data

```http
GET /chart/<ticker>
```

**Description:** Retrieve historical price data for charting

**Parameters:**
- `ticker` (string, path, required): Stock ticker symbol

**Response:** `200 OK`
```json
{
  "symbol": "AAPL",
  "dates": ["2024-01-01", "2024-01-02", ...],
  "prices": [175.23, 176.45, ...],
  "volumes": [54321098, 62345678, ...]
}
```

---

## 🔮 Predictions

### Predict Stock Price (Linear Regression)

```http
GET /predict/<ticker>
```

**Description:** Generate 7-day price prediction using Linear Regression model

**Parameters:**
- `ticker` (string, path, required): Stock ticker symbol

**Response:** `200 OK`
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "recentDate": "2024-11-14",
  "recentClose": 175.43,
  "recentPredicted": 176.12,
  "predictions": [
    {
      "date": "2024-11-15",
      "predictedClose": 176.45
    },
    {
      "date": "2024-11-16",
      "predictedClose": 177.23
    }
  ]
}
```

---

### Predict Stock Price (Ensemble)

```http
GET /predict/ensemble/<ticker>
```

**Description:** Generate enhanced 7-day prediction using ensemble of Random Forest, XGBoost, and Linear Regression

**Parameters:**
- `ticker` (string, path, required): Stock ticker symbol

**Response:** `200 OK`
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "currentPrice": 175.43,
  "predictions": [
    {
      "date": "2024-11-15",
      "linear": 176.12,
      "randomForest": 176.45,
      "xgboost": 176.89,
      "ensemble": 176.49
    }
  ],
  "metrics": {
    "mae": 2.34,
    "rmse": 3.12,
    "r2": 0.89
  }
}
```

---

## 📈 Model Evaluation

### Backtest Model Performance

```http
GET /evaluate/<ticker>?test_days=60&retrain_frequency=5
```

**Description:** Professional rolling window backtesting with model retraining

**Parameters:**
- `ticker` (string, path, required): Stock ticker symbol
- `test_days` (integer, query, optional, default: 60): Number of days to backtest
- `retrain_frequency` (integer, query, optional, default: 5): Days between model retraining

**Response:** `200 OK`
```json
{
  "ticker": "AAPL",
  "test_days": 60,
  "retrain_frequency": 5,
  "metrics": {
    "mae": 2.45,
    "rmse": 3.21,
    "mape": 1.42,
    "r2": 0.87,
    "directional_accuracy": 62.5
  },
  "trading_performance": {
    "sharpe_ratio": 1.45,
    "max_drawdown": -8.3,
    "total_return": 12.4,
    "buy_hold_return": 10.2
  },
  "predictions": [
    {
      "date": "2024-09-15",
      "actual": 175.43,
      "predicted": 176.12,
      "error": 0.69
    }
  ]
}
```

---

## 🏢 Company Fundamentals

### Get Company Fundamentals

```http
GET /fundamentals/<ticker>
```

**Description:** Retrieve 40+ fundamental financial metrics for a company

**Parameters:**
- `ticker` (string, path, required): Stock ticker symbol

**Response:** `200 OK`
```json
{
  "symbol": "AAPL",
  "company_info": {
    "name": "Apple Inc.",
    "sector": "Technology",
    "industry": "Consumer Electronics",
    "country": "United States",
    "description": "Apple Inc. designs, manufactures..."
  },
  "market_data": {
    "market_cap": 2876543210000,
    "current_price": 175.43,
    "52_week_high": 182.34,
    "52_week_low": 142.56,
    "beta": 1.23
  },
  "valuation": {
    "pe_ratio": 28.45,
    "peg_ratio": 2.34,
    "price_to_book": 45.67,
    "price_to_sales": 7.89,
    "ev_to_revenue": 6.78,
    "ev_to_ebitda": 22.34
  },
  "profitability": {
    "profit_margin": 25.31,
    "operating_margin": 30.12,
    "gross_margin": 43.26,
    "roa": 22.45,
    "roe": 147.35
  },
  "financial_performance": {
    "revenue": 394328000000,
    "revenue_growth": 7.8,
    "earnings_per_share": 6.13,
    "quarterly_earnings_growth": 11.2,
    "quarterly_revenue_growth": 8.6
  },
  "dividends": {
    "dividend_rate": 0.96,
    "dividend_yield": 0.52,
    "payout_ratio": 15.23
  }
}
```

---

## 💼 Paper Trading

### Get Portfolio

```http
GET /paper/portfolio
```

**Description:** Get current paper trading portfolio summary and positions

**Response:** `200 OK`
```json
{
  "cash": 85432.10,
  "totalValue": 104567.89,
  "totalProfitLoss": 4567.89,
  "totalProfitLossPercent": 4.57,
  "positions": [
    {
      "ticker": "AAPL",
      "shares": 50,
      "avgPrice": 170.45,
      "currentPrice": 175.43,
      "totalCost": 8522.50,
      "currentValue": 8771.50,
      "profitLoss": 249.00,
      "profitLossPercent": 2.92
    }
  ]
}
```

---

### Buy Stocks

```http
POST /paper/buy
```

**Description:** Buy stocks in paper trading portfolio

**Request Body:**
```json
{
  "ticker": "AAPL",
  "shares": 10
}
```

**Response:** `200 OK`
```json
{
  "message": "Successfully bought 10 shares of AAPL at $175.43",
  "transaction": {
    "type": "BUY",
    "ticker": "AAPL",
    "shares": 10,
    "price": 175.43,
    "total": 1754.30,
    "timestamp": "2024-11-14T10:30:00Z"
  },
  "portfolio": {
    "cash": 83677.80,
    "totalValue": 104567.89
  }
}
```

**Errors:**
- `400`: Invalid request (missing ticker/shares, insufficient funds)
- `500`: Server error

---

### Sell Stocks

```http
POST /paper/sell
```

**Description:** Sell stocks from paper trading portfolio

**Request Body:**
```json
{
  "ticker": "AAPL",
  "shares": 5
}
```

**Response:** `200 OK`
```json
{
  "message": "Successfully sold 5 shares of AAPL at $175.43",
  "transaction": {
    "type": "SELL",
    "ticker": "AAPL",
    "shares": 5,
    "price": 175.43,
    "total": 877.15,
    "timestamp": "2024-11-14T11:45:00Z"
  },
  "portfolio": {
    "cash": 84554.95,
    "totalValue": 104567.89
  }
}
```

**Errors:**
- `400`: Invalid request (missing ticker/shares, insufficient shares)

---

### Get Trade History

```http
GET /paper/history
```

**Description:** Get all paper trading transactions

**Response:** `200 OK`
```json
{
  "history": [
    {
      "type": "BUY",
      "ticker": "AAPL",
      "shares": 10,
      "price": 170.45,
      "total": 1704.50,
      "timestamp": "2024-11-10T14:20:00Z"
    },
    {
      "type": "SELL",
      "ticker": "TSLA",
      "shares": 5,
      "price": 245.67,
      "total": 1228.35,
      "timestamp": "2024-11-12T09:15:00Z"
    }
  ]
}
```

---

### Reset Portfolio

```http
POST /paper/reset
```

**Description:** Reset paper trading portfolio to initial state ($100,000 cash)

**Response:** `200 OK`
```json
{
  "message": "Portfolio reset successfully",
  "portfolio": {
    "cash": 100000.00,
    "totalValue": 100000.00,
    "positions": []
  }
}
```

---

## 💱 Forex

### Convert Currency

```http
GET /forex/convert?from=USD&to=EUR
```

**Description:** Get real-time foreign exchange rate

**Query Parameters:**
- `from` (string, required): Source currency code (e.g., "USD")
- `to` (string, required): Target currency code (e.g., "EUR")

**Response:** `200 OK`
```json
{
  "from": "USD",
  "to": "EUR",
  "rate": 0.9234,
  "timestamp": "2024-11-14T15:30:00Z",
  "bidPrice": 0.9232,
  "askPrice": 0.9236
}
```

---

### Get Currency List

```http
GET /forex/currencies
```

**Description:** Get list of supported currencies

**Response:** `200 OK`
```json
{
  "currencies": [
    {"code": "USD", "name": "US Dollar"},
    {"code": "EUR", "name": "Euro"},
    {"code": "GBP", "name": "British Pound"},
    {"code": "JPY", "name": "Japanese Yen"}
  ]
}
```

---

## ₿ Cryptocurrency

### Convert Cryptocurrency

```http
GET /crypto/convert?from=BTC&to=USD
```

**Description:** Get real-time cryptocurrency exchange rate

**Query Parameters:**
- `from` (string, required): Crypto symbol (e.g., "BTC")
- `to` (string, required): Target currency (e.g., "USD")

**Response:** `200 OK`
```json
{
  "from": "BTC",
  "to": "USD",
  "rate": 43250.50,
  "timestamp": "2024-11-14T15:30:00Z",
  "change24h": 2.34,
  "changePercent24h": 0.054
}
```

---

### Get Crypto List

```http
GET /crypto/list
```

**Description:** Get list of popular cryptocurrencies

**Response:** `200 OK`
```json
{
  "cryptocurrencies": [
    {"symbol": "BTC", "name": "Bitcoin"},
    {"symbol": "ETH", "name": "Ethereum"},
    {"symbol": "ADA", "name": "Cardano"}
  ]
}
```

---

## 🌾 Commodities

### Get Commodity Price

```http
GET /commodities/price/CL=F?period=1mo
```

**Description:** Get commodity futures price and history

**Parameters:**
- `commodity` (string, path, required): Commodity futures ticker (e.g., "CL=F" for Crude Oil)
- `period` (string, query, optional, default: "1mo"): Time period (1d, 5d, 1mo, 3mo, 1y)

**Response:** `200 OK`
```json
{
  "code": "CL=F",
  "name": "Crude Oil",
  "full_name": "WTI Crude Oil Futures",
  "current_price": 78.45,
  "previous_price": 77.89,
  "price_change": 0.56,
  "price_change_percent": 0.72,
  "unit": "USD per barrel",
  "date": "2024-11-14",
  "category": "Energy",
  "icon": "🛢️",
  "history": [
    {"date": "2024-10-15", "price": 76.23},
    {"date": "2024-10-16", "price": 77.12}
  ]
}
```

---

### Get Commodities List

```http
GET /commodities/list
```

**Description:** Get list of available commodities

**Response:** `200 OK`
```json
{
  "commodities": [
    {
      "code": "CL=F",
      "name": "Crude Oil",
      "full_name": "WTI Crude Oil Futures",
      "category": "Energy",
      "unit": "USD per barrel",
      "icon": "🛢️"
    }
  ]
}
```

---

### Get All Commodities by Category

```http
GET /commodities/all
```

**Description:** Get all commodity prices grouped by category

**Response:** `200 OK`
```json
{
  "Energy": [
    {
      "code": "CL=F",
      "name": "Crude Oil",
      "current_price": 78.45,
      "price_change_percent": 0.72
    }
  ],
  "Metals": [...],
  "Agriculture": [...]
}
```

---

## ⭐ Watchlist

### Get Watchlist

```http
GET /watchlist
```

**Description:** Get all tickers in watchlist

**Response:** `200 OK`
```json
{
  "watchlist": ["AAPL", "TSLA", "GOOGL", "MSFT"]
}
```

---

### Add to Watchlist

```http
POST /watchlist
```

**Description:** Add ticker to watchlist

**Request Body:**
```json
{
  "ticker": "AAPL"
}
```

**Response:** `200 OK`
```json
{
  "message": "AAPL added to watchlist",
  "watchlist": ["AAPL", "TSLA", "GOOGL", "MSFT"]
}
```

---

### Remove from Watchlist

```http
DELETE /watchlist/<ticker>
```

**Description:** Remove ticker from watchlist

**Parameters:**
- `ticker` (string, path, required): Stock ticker to remove

**Response:** `200 OK`
```json
{
  "message": "AAPL removed from watchlist",
  "watchlist": ["TSLA", "GOOGL", "MSFT"]
}
```

---

## 📰 News

### Get Market News

```http
GET /news
```

**Description:** Get latest financial market news

**Response:** `200 OK`
```json
{
  "articles": [
    {
      "title": "Market Update: S&P 500 Reaches New High",
      "description": "Stock markets rallied today...",
      "url": "https://example.com/article",
      "source": "Financial Times",
      "publishedAt": "2024-11-14T14:30:00Z",
      "image": "https://example.com/image.jpg"
    }
  ]
}
```

---

## ⚠️ Error Handling

All endpoints follow consistent error response format:

### Error Response Structure

```json
{
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Common Errors

**Invalid Ticker:**
```json
{
  "error": "Stock ticker not found"
}
```

**Missing Parameters:**
```json
{
  "error": "Missing required parameter: ticker"
}
```

**Insufficient Funds:**
```json
{
  "error": "Insufficient funds to complete purchase"
}
```

**Data Unavailable:**
```json
{
  "error": "No historical data available"
}
```

---

## 🔐 Authentication

**Current Version:** No authentication required (development mode)

**Future:** API key authentication will be added for production deployment.

---

## 📝 Rate Limiting

**Current Version:** No rate limiting (development mode)

**Future:** Rate limits will be implemented:
- 100 requests per minute per IP
- 1000 requests per hour per IP

---

## 🌐 CORS

Cross-Origin Resource Sharing (CORS) is enabled for all origins in development mode.

---

## 📞 Support

For API support and questions:
- **GitHub Issues:** [bjk2023/MarketMind](https://github.com/bjk2023/MarketMind)
- **Documentation:** See README.md

---

**Last Updated:** November 14, 2024  
**API Version:** 1.0.0  
**License:** MIT
