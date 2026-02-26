/**
 * API Configuration
 * Centralized API URL configuration for all frontend components
 * 
 * IMPORTANT: This file uses environment variables for configuration.
 * Create .env files in frontend directory:
 *   - .env.development (for local development)
 *   - .env.production (for production builds)
 */

// API Base URL from environment variable or default to localhost
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

/**
 * API Endpoints Configuration
 * All API endpoints are defined here for consistency
 */
export const API_ENDPOINTS = {
    // Authentication
    AUTH_ME: `${API_BASE_URL}/auth/me`,

    // Stock & Market Data
    STOCK: (ticker) => `${API_BASE_URL}/stock/${ticker}`,
    CHART: (ticker, period = '6mo') => `${API_BASE_URL}/chart/${ticker}?period=${period}`,
    SEARCH_SYMBOLS: (query) => `${API_BASE_URL}/search-symbols?q=${encodeURIComponent(query)}`,
    
    // News
    NEWS: (query) => query 
        ? `${API_BASE_URL}/news?q=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/api/news`,
    
    // Predictions
    PREDICT: (model, ticker) => `${API_BASE_URL}/predict/${model}/${ticker}`,
    PREDICT_ENSEMBLE: (ticker) => `${API_BASE_URL}/predict/ensemble/${ticker}`,
    EVALUATE: (ticker, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return `${API_BASE_URL}/evaluate/${ticker}${queryString ? '?' + queryString : ''}`;
    },
    
    // Options
    OPTIONS: (ticker) => `${API_BASE_URL}/options/${ticker}`,
    OPTIONS_CHAIN: (ticker) => `${API_BASE_URL}/options/chain/${ticker}`,
    OPTIONS_SUGGEST: (ticker) => `${API_BASE_URL}/options/suggest/${ticker}`,
    OPTIONS_STOCK_PRICE: (ticker) => `${API_BASE_URL}/options/stock_price/${ticker}`,
    
    // Paper Trading
    PORTFOLIO: `${API_BASE_URL}/paper/portfolio`,
    PORTFOLIO_HISTORY: (period) => `${API_BASE_URL}/paper/history?period=${period}`,
    PORTFOLIO_TRANSACTIONS: `${API_BASE_URL}/paper/transactions`,
    PORTFOLIO_RESET: `${API_BASE_URL}/paper/reset`,
    PAPER_BUY: `${API_BASE_URL}/paper/buy`,
    PAPER_SELL: `${API_BASE_URL}/paper/sell`,
    PAPER_OPTIONS_BUY: `${API_BASE_URL}/paper/options/buy`,
    PAPER_OPTIONS_SELL: `${API_BASE_URL}/paper/options/sell`,
    
    // Watchlist
    WATCHLIST: `${API_BASE_URL}/watchlist`,
    WATCHLIST_ITEM: (ticker) => `${API_BASE_URL}/watchlist/${ticker}`,
    
    // Notifications
    NOTIFICATIONS: `${API_BASE_URL}/notifications`,
    NOTIFICATIONS_SMART: `${API_BASE_URL}/notifications/smart`,
    NOTIFICATIONS_TRIGGERED: `${API_BASE_URL}/notifications/triggered`,
    NOTIFICATION: (id) => `${API_BASE_URL}/notifications/${id}`,
    NOTIFICATION_TRIGGERED: (id) => `${API_BASE_URL}/notifications/triggered/${id}`,
    
    // Forex
    FOREX_CONVERT: (fromCurrency, toCurrency) => 
        `${API_BASE_URL}/forex/convert?from=${fromCurrency}&to=${toCurrency}`,
    FOREX_CURRENCIES: `${API_BASE_URL}/forex/currencies`,
    
    // Crypto
    CRYPTO_LIST: `${API_BASE_URL}/crypto/list`,
    CRYPTO_CURRENCIES: `${API_BASE_URL}/crypto/currencies`,
    CRYPTO_CONVERT: (from, to) => `${API_BASE_URL}/crypto/convert?from=${from}&to=${to}`,
    
    // Commodities
    COMMODITIES_LIST: `${API_BASE_URL}/commodities/list`,
    COMMODITIES_PRICE: (code) => `${API_BASE_URL}/commodities/price/${code}`,
    
    // Prediction Markets
    PREDICTION_MARKETS: (exchange = 'polymarket', limit = 50) => 
        `${API_BASE_URL}/prediction-markets?exchange=${exchange}&limit=${limit}`,
    PREDICTION_MARKETS_SEARCH: (exchange, search) => 
        `${API_BASE_URL}/prediction-markets/search?exchange=${exchange}&search=${encodeURIComponent(search)}`,
    PREDICTION_MARKET: (exchange, marketId) => 
        `${API_BASE_URL}/prediction-markets/${exchange}/${marketId}`,
    PREDICTION_EXCHANGES: `${API_BASE_URL}/prediction-markets/exchanges`,
    PREDICTION_PRICES: (exchange) => `${API_BASE_URL}/prediction-markets/prices?exchange=${exchange}`,
    
    // Macro & Calendar
    MACRO_INDICATORS: `${API_BASE_URL}/macro/indicators`,
    MACRO_CHART: (indicator, period = '5y') => `${API_BASE_URL}/macro/chart/${indicator}?period=${period}`,
    ECONOMIC_CALENDAR: `${API_BASE_URL}/calendar/economic`,
    
    // Screener
    SCREENER: (category = 'day_gainers') => `${API_BASE_URL}/screener?category=${category}`,
    
    // Fundamentals
    FUNDAMENTALS: (ticker) => `${API_BASE_URL}/fundamentals/${ticker}`,
    FILINGS: (ticker) => `${API_BASE_URL}/filings/${ticker}`,
};

/**
 * API Request Helpers
 * Consistent error handling and request configuration
 */
export const apiRequest = async (url, options = {}) => {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        ...options,
    };
    
    try {
        const response = await fetch(url, defaultOptions);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
};

export { API_BASE_URL };
export default API_ENDPOINTS;
