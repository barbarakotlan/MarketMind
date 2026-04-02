import { API_BASE_URL, API_ENDPOINTS } from './api';

describe('API_ENDPOINTS', () => {
    test('builds prediction market list URLs with optional search params', () => {
        expect(API_ENDPOINTS.PREDICTION_MARKETS()).toBe(
            `${API_BASE_URL}/prediction-markets?exchange=polymarket&limit=50`
        );
        expect(API_ENDPOINTS.PREDICTION_MARKETS('polymarket', 25, 'fed meeting')).toBe(
            `${API_BASE_URL}/prediction-markets?exchange=polymarket&limit=25&search=fed+meeting`
        );
        expect(API_ENDPOINTS.PREDICTION_MARKETS_SEARCH('kalshi', 'inflation', 10)).toBe(
            `${API_BASE_URL}/prediction-markets?exchange=kalshi&limit=10&search=inflation`
        );
    });

    test('builds prediction market detail URLs using the backend query shape', () => {
        expect(API_ENDPOINTS.PREDICTION_MARKET('market-123', 'polymarket')).toBe(
            `${API_BASE_URL}/prediction-markets/market-123?exchange=polymarket`
        );
    });

    test('uses the authenticated prediction market analysis endpoint', () => {
        expect(API_ENDPOINTS.PREDICTION_ANALYZE).toBe(
            `${API_BASE_URL}/prediction-markets/analyze`
        );
    });

    test('builds triggered alert URLs without forcing seen state changes', () => {
        expect(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED()).toBe(
            `${API_BASE_URL}/notifications/triggered`
        );
        expect(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED(true)).toBe(
            `${API_BASE_URL}/notifications/triggered?all=true`
        );
    });

    test('builds option chain URLs with an optional expiration date', () => {
        expect(API_ENDPOINTS.OPTIONS_CHAIN('AAPL')).toBe(
            `${API_BASE_URL}/options/chain/AAPL`
        );
        expect(API_ENDPOINTS.OPTIONS_CHAIN('AAPL', '2026-01-16')).toBe(
            `${API_BASE_URL}/options/chain/AAPL?date=2026-01-16`
        );
    });

    test('uses the supported fundamentals filings endpoint', () => {
        expect(API_ENDPOINTS.FUNDAMENTALS_FILINGS('AAPL')).toBe(
            `${API_BASE_URL}/fundamentals/filings/AAPL`
        );
    });

    test('adds market query params only for non-US research routes', () => {
        expect(API_ENDPOINTS.SEARCH_SYMBOLS('00700', 'hk')).toBe(
            `${API_BASE_URL}/search-symbols?q=00700&market=hk`
        );
        expect(API_ENDPOINTS.STOCK('00700', 'HK')).toBe(
            `${API_BASE_URL}/stock/00700?market=hk`
        );
        expect(API_ENDPOINTS.CHART('00700', '6mo', 'CN')).toBe(
            `${API_BASE_URL}/chart/00700?period=6mo&market=cn`
        );
        expect(API_ENDPOINTS.FUNDAMENTALS('00700', 'HK')).toBe(
            `${API_BASE_URL}/fundamentals/00700?market=hk`
        );
        expect(API_ENDPOINTS.MARKETMIND_AI_CONTEXT('HK:00700', 'HK')).toBe(
            `${API_BASE_URL}/marketmind-ai/context?ticker=HK%3A00700&market=hk`
        );
        expect(API_ENDPOINTS.MARKETMIND_AI_RETRIEVAL_STATUS('HK:00700', 'HK')).toBe(
            `${API_BASE_URL}/marketmind-ai/retrieval-status?ticker=HK%3A00700&market=hk`
        );
    });

    test('builds the SEC intelligence endpoint for fundamentals research', () => {
        expect(API_ENDPOINTS.FUNDAMENTALS_SEC_INTELLIGENCE('AAPL')).toBe(
            `${API_BASE_URL}/fundamentals/sec-intelligence/AAPL`
        );
    });

    test('builds filing detail URLs for on-demand SEC section reads', () => {
        expect(API_ENDPOINTS.FUNDAMENTALS_FILING_DETAIL('AAPL', '0000320193-26-000123')).toBe(
            `${API_BASE_URL}/fundamentals/filings/AAPL/0000320193-26-000123`
        );
    });

    test('builds macro overview URLs with an optional region query', () => {
        expect(API_ENDPOINTS.MACRO_OVERVIEW()).toBe(
            `${API_BASE_URL}/macro/overview`
        );
        expect(API_ENDPOINTS.MACRO_OVERVIEW('asia')).toBe(
            `${API_BASE_URL}/macro/overview?region=asia`
        );
    });

    test('builds market sessions calendar URLs with market and day count', () => {
        expect(API_ENDPOINTS.MARKET_SESSIONS_CALENDAR()).toBe(
            `${API_BASE_URL}/calendar/market-sessions?market=us&days=14`
        );
        expect(API_ENDPOINTS.MARKET_SESSIONS_CALENDAR('hk', 7)).toBe(
            `${API_BASE_URL}/calendar/market-sessions?market=hk&days=7`
        );
    });

    test('uses the authenticated paper portfolio optimization endpoint', () => {
        expect(API_ENDPOINTS.PORTFOLIO_OPTIMIZE).toBe(
            `${API_BASE_URL}/paper/portfolio/optimize`
        );
    });
});
