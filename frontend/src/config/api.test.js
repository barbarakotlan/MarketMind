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

    test('uses the supported fundamentals filings endpoint', () => {
        expect(API_ENDPOINTS.FUNDAMENTALS_FILINGS('AAPL')).toBe(
            `${API_BASE_URL}/fundamentals/filings/AAPL`
        );
    });
});
