import { renderHook, act, waitFor } from '@testing-library/react';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';
import useSearchData from './useSearchData';

jest.mock('../../context/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../../config/api', () => ({
    ...jest.requireActual('../../config/api'),
    apiRequest: jest.fn(),
}));

function route(url) {
    if (url === API_ENDPOINTS.SCREENER()) {
        return Promise.resolve({
            gainers: [{ symbol: 'NVDA', name: 'Nvidia', percent_change: 0.02, volume: 100 }],
            losers: [],
            active: [],
        });
    }
    // main search (asset market 'US')
    if (url === API_ENDPOINTS.STOCK('AAPL', 'US')) {
        return Promise.resolve({ symbol: 'AAPL', companyName: 'Apple Inc', market: 'US', assetId: 'US:AAPL' });
    }
    if (url === API_ENDPOINTS.CHART('AAPL', '14d', 'US')) return Promise.resolve({ prices: [1, 2, 3] });
    if (url === API_ENDPOINTS.PREDICT_ENSEMBLE('AAPL')) return Promise.resolve({ direction: 'up' });
    if (url === API_ENDPOINTS.NEWS('Apple Inc')) return Promise.resolve([{ title: 'apple news' }]);
    // comparison (market 'us')
    if (url === API_ENDPOINTS.STOCK('MSFT', 'us')) return Promise.resolve({ symbol: 'MSFT', companyName: 'Microsoft' });
    if (url === API_ENDPOINTS.CHART('MSFT', '14d', 'us')) return Promise.resolve({ prices: [4, 5, 6] });
    if (url === API_ENDPOINTS.PREDICT_ENSEMBLE('MSFT')) return Promise.resolve({ direction: 'down' });
    if (url === API_ENDPOINTS.NEWS('Microsoft')) return Promise.resolve([{ title: 'msft news' }]);
    // autocomplete
    if (url === API_ENDPOINTS.SEARCH_SYMBOLS('AAP', 'us')) return Promise.resolve([{ symbol: 'AAPL', name: 'Apple' }]);
    return Promise.resolve({});
}

beforeAll(() => {
    window.alert = jest.fn();
});

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    useNavigation.mockReturnValue({
        sharedTicker: '',
        sharedCompareTicker: '',
        clearTicker: jest.fn(),
        clearCompareTicker: jest.fn(),
    });
    apiRequest.mockImplementation(route);
});

async function runSearchFor(result, ticker) {
    await act(async () => {
        await result.current.handleSearch({ preventDefault: jest.fn() }, ticker);
    });
}

describe('useSearchData', () => {
    test('fetches trending suggestions on mount and maps them', async () => {
        const { result } = renderHook(() => useSearchData());
        await waitFor(() => expect(result.current.loadingSuggestions).toBe(false));
        expect(result.current.suggestions.trending.gainers[0]).toEqual({
            ticker: 'NVDA',
            name: 'Nvidia',
            change_percent: 2,
            volume: 100,
        });
    });

    test('runSearch populates stock, chart, prediction and news, and records a recent search', async () => {
        const { result } = renderHook(() => useSearchData());
        await runSearchFor(result, 'AAPL');

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.stockData).toMatchObject({ symbol: 'AAPL' });
        expect(result.current.chartData).toEqual({ prices: [1, 2, 3] });
        expect(result.current.predictionData).toEqual({ direction: 'up' });
        expect(result.current.newsData).toEqual([{ title: 'apple news' }]);
        expect(result.current.searchedTicker).toBe('AAPL');
        expect(result.current.recentSearches[0].assetId).toBe('US:AAPL');
        // recent search persisted
        expect(JSON.parse(localStorage.getItem('recentSearches'))[0].assetId).toBe('US:AAPL');
    });

    test('handleAddComparison loads a comparison bundle for a different ticker', async () => {
        const { result } = renderHook(() => useSearchData());
        await runSearchFor(result, 'AAPL');
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setCompareTicker('MSFT'));
        await act(async () => {
            await result.current.handleAddComparison({ preventDefault: jest.fn() });
        });

        await waitFor(() => expect(result.current.comparisonData).not.toBe(null));
        expect(result.current.comparisonData.ticker).toBe('MSFT');
        expect(result.current.comparisonData.chartData).toEqual({ prices: [4, 5, 6] });
        expect(result.current.compareTicker).toBe('');
    });

    test('handleAddComparison rejects comparing a ticker to itself', async () => {
        const { result } = renderHook(() => useSearchData());
        await runSearchFor(result, 'AAPL');
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setCompareTicker('AAPL'));
        await act(async () => {
            await result.current.handleAddComparison({ preventDefault: jest.fn() });
        });

        expect(window.alert).toHaveBeenCalledWith('Choose a different ticker to compare.');
        expect(result.current.comparisonData).toBe(null);
    });

    test('handleTickerChange fetches autocomplete for 2+ chars, clears below that', async () => {
        const { result } = renderHook(() => useSearchData());
        await waitFor(() => expect(result.current.loadingSuggestions).toBe(false));

        await act(async () => {
            result.current.handleTickerChange({ target: { value: 'aap' } });
        });
        await waitFor(() => expect(result.current.autocompleteSuggestions.length).toBe(1));
        expect(result.current.showAutocomplete).toBe(true);

        await act(async () => {
            result.current.handleTickerChange({ target: { value: 'a' } });
        });
        expect(result.current.autocompleteSuggestions).toEqual([]);
        expect(result.current.showAutocomplete).toBe(false);
    });

    test('clearRecentSearches empties the list and localStorage', async () => {
        const { result } = renderHook(() => useSearchData());
        await runSearchFor(result, 'AAPL');
        await waitFor(() => expect(result.current.recentSearches.length).toBe(1));

        act(() => result.current.clearRecentSearches());
        expect(result.current.recentSearches).toEqual([]);
        expect(localStorage.getItem('recentSearches')).toBe(null);
    });

    test('auto-runs a search for an incoming navigation ticker and consumes it', async () => {
        const clearTicker = jest.fn();
        const clearCompareTicker = jest.fn();
        useNavigation.mockReturnValue({
            sharedTicker: 'AAPL',
            sharedCompareTicker: '',
            clearTicker,
            clearCompareTicker,
        });
        const { result } = renderHook(() => useSearchData());

        await waitFor(() => expect(result.current.stockData).toMatchObject({ symbol: 'AAPL' }));
        expect(clearTicker).toHaveBeenCalled();
        expect(clearCompareTicker).toHaveBeenCalled();
    });
});
