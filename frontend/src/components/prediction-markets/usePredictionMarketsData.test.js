import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('@clerk/clerk-react', () => ({ useAuth: jest.fn() }));
jest.mock('../../config/api', () => ({
    ...jest.requireActual('../../config/api'),
    apiRequest: jest.fn(),
}));

import { useAuth } from '@clerk/clerk-react';
import { API_ENDPOINTS, apiRequest } from '../../config/api';
import usePredictionMarketsData from './usePredictionMarketsData';

const MARKETS = [{ id: 'm1', question: 'Will X happen?' }];

beforeEach(() => {
    jest.clearAllMocks();
    apiRequest.mockImplementation((url) => {
        if (url === API_ENDPOINTS.PREDICTION_PORTFOLIO) return Promise.resolve({ cash: 10000 });
        if (url === API_ENDPOINTS.PREDICTION_HISTORY) return Promise.resolve([{ id: 't1' }]);
        if (url === API_ENDPOINTS.PREDICTION_ANALYZE) return Promise.resolve({ verdict: 'edge' });
        return Promise.resolve({ markets: MARKETS }); // the markets endpoint (parameterized URL)
    });
});

describe('usePredictionMarketsData', () => {
    test('signed-out: fetches markets on mount, leaves portfolio empty, analysis disabled', async () => {
        useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
        const { result } = renderHook(() => usePredictionMarketsData());

        await waitFor(() => expect(result.current.loadingMarkets).toBe(false));
        expect(result.current.markets).toEqual(MARKETS);
        expect(result.current.analysisEnabled).toBe(false);
        expect(result.current.portfolio).toBe(null);
        expect(result.current.tradeHistory).toEqual([]);
        expect(result.current.loadingPortfolio).toBe(false);
    });

    test('signed-in: loads portfolio and trade history, analysis enabled', async () => {
        useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
        const { result } = renderHook(() => usePredictionMarketsData());

        await waitFor(() => expect(result.current.loadingPortfolio).toBe(false));
        expect(result.current.portfolio).toEqual({ cash: 10000 });
        expect(result.current.tradeHistory).toEqual([{ id: 't1' }]);
        expect(result.current.analysisEnabled).toBe(true);
    });

    test('handleAnalyzeMarket short-circuits to an error prompt when signed out', async () => {
        useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
        const { result } = renderHook(() => usePredictionMarketsData());
        await waitFor(() => expect(result.current.loadingMarkets).toBe(false));

        await act(async () => {
            await result.current.handleAnalyzeMarket({ id: 'm1' });
        });

        expect(result.current.analysisByMarketId.m1.status).toBe('error');
        expect(result.current.analysisByMarketId.m1.error).toMatch(/Sign in/i);
        expect(apiRequest).not.toHaveBeenCalledWith(API_ENDPOINTS.PREDICTION_ANALYZE, expect.anything());
    });

    test('handleAnalyzeMarket runs the analysis and stores the result when signed in', async () => {
        useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
        const { result } = renderHook(() => usePredictionMarketsData());
        await waitFor(() => expect(result.current.loadingPortfolio).toBe(false));

        await act(async () => {
            await result.current.handleAnalyzeMarket({ id: 'm1' });
        });

        expect(result.current.analysisByMarketId.m1.status).toBe('success');
        expect(result.current.analysisByMarketId.m1.data).toEqual({ verdict: 'edge' });
    });

    test('handleSearch applies the search input and refetches', async () => {
        useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
        const { result } = renderHook(() => usePredictionMarketsData());
        await waitFor(() => expect(result.current.loadingMarkets).toBe(false));

        act(() => result.current.setSearchInput('election'));
        await act(async () => {
            result.current.handleSearch({ preventDefault: jest.fn() });
        });

        expect(result.current.activeSearch).toBe('election');
    });
});
