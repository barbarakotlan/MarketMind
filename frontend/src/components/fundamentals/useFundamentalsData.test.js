import { renderHook, act, waitFor } from '@testing-library/react';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';
import useFundamentalsData from './useFundamentalsData';

jest.mock('../../context/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../../config/api', () => ({
    ...jest.requireActual('../../config/api'),
    apiRequest: jest.fn(),
}));

const OVERVIEW = { symbol: 'AAPL', market: 'US', marketSession: { state: 'open' } };
const FINANCIALS = { revenue: 1000 };
const FILINGS = { filings: [{ accessionNumber: 'acc1', form: '10-K' }] };
const SEC = { summary: 'sec-summary' };

// Deterministic URL construction lets us route the mock by exact endpoint.
function routeAppleUs(url) {
    if (url === API_ENDPOINTS.FUNDAMENTALS('AAPL', 'US')) return Promise.resolve(OVERVIEW);
    if (url === API_ENDPOINTS.FUNDAMENTALS_FINANCIALS('AAPL')) return Promise.resolve(FINANCIALS);
    if (url === API_ENDPOINTS.FUNDAMENTALS_FILINGS('AAPL', 'US')) return Promise.resolve(FILINGS);
    if (url === API_ENDPOINTS.FUNDAMENTALS_SEC_INTELLIGENCE('AAPL', 'US')) return Promise.resolve(SEC);
    if (url === API_ENDPOINTS.FUNDAMENTALS_FILING_DETAIL('AAPL', 'acc1')) {
        return Promise.resolve({ sections: [{ key: 'sec1', title: 'Business' }] });
    }
    return Promise.resolve({});
}

async function search(result, ticker) {
    act(() => result.current.setTicker(ticker));
    await act(async () => {
        await result.current.handleSearch({ preventDefault: jest.fn() });
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    useNavigation.mockReturnValue({ sharedTicker: '', clearTicker: jest.fn() });
    apiRequest.mockImplementation(routeAppleUs);
});

describe('useFundamentalsData', () => {
    test('starts empty with the US tab set', () => {
        const { result } = renderHook(() => useFundamentalsData());
        expect(result.current.fundamentals).toBe(null);
        expect(result.current.loading).toBe(false);
        expect(result.current.tabs.map((t) => t.key)).toEqual(['overview', 'financials', 'filings']);
        expect(result.current.internationalResearchMode).toBeFalsy();
    });

    test('loads a US ticker with financials, filings and SEC intelligence', async () => {
        const { result } = renderHook(() => useFundamentalsData());
        await search(result, 'AAPL');

        await waitFor(() => expect(result.current.fundamentals).toEqual(OVERVIEW));
        expect(result.current.financials).toEqual(FINANCIALS);
        expect(result.current.filings).toEqual(FILINGS);
        expect(result.current.secIntelligence).toEqual(SEC);
        expect(result.current.selectedMarket).toBe('us');
        expect(result.current.activeTab).toBe('overview');
        expect(result.current.marketSession).toEqual({ state: 'open' });
    });

    test('an international (HK) ticker uses research tabs and skips US-only fetches', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.FUNDAMENTALS('00700', 'HK')) {
                return Promise.resolve({ symbol: '00700', market: 'HK' });
            }
            return Promise.resolve({});
        });
        const { result } = renderHook(() => useFundamentalsData());
        await search(result, 'HK:00700');

        await waitFor(() => expect(result.current.fundamentals).not.toBe(null));
        expect(result.current.internationalResearchMode).toBe(true);
        expect(result.current.tabs.map((t) => t.key)).toEqual(['overview', 'research']);
        expect(result.current.financials).toBe(null);
    });

    test('surfaces a fetch error and clears loading', async () => {
        apiRequest.mockImplementation((url) =>
            url === API_ENDPOINTS.FUNDAMENTALS('AAPL', 'US')
                ? Promise.reject(new Error('boom'))
                : Promise.resolve({}),
        );
        const { result } = renderHook(() => useFundamentalsData());
        await search(result, 'AAPL');

        await waitFor(() => expect(result.current.error).toBe('boom'));
        expect(result.current.loading).toBe(false);
    });

    test('auto-loads and consumes an incoming ticker from navigation', async () => {
        const clearTicker = jest.fn();
        useNavigation.mockReturnValue({ sharedTicker: 'AAPL', clearTicker });
        const { result } = renderHook(() => useFundamentalsData());

        await waitFor(() => expect(result.current.fundamentals).toEqual(OVERVIEW));
        expect(clearTicker).toHaveBeenCalled();
    });

    test('handleToggleFilingDetail loads detail on expand and collapses on re-toggle', async () => {
        const { result } = renderHook(() => useFundamentalsData());
        await search(result, 'AAPL');
        await waitFor(() => expect(result.current.fundamentals).toEqual(OVERVIEW));

        const filing = { accessionNumber: 'acc1' };
        await act(async () => {
            await result.current.handleToggleFilingDetail(filing);
        });

        await waitFor(() => expect(result.current.filingDetailState.acc1?.status).toBe('success'));
        expect(result.current.expandedFilingAccession).toBe('acc1');
        expect(result.current.filingDetailState.acc1.data.sections[0].key).toBe('sec1');
        expect(result.current.filingDetailState.acc1.activeSectionKey).toBe('sec1');

        await act(async () => {
            await result.current.handleToggleFilingDetail(filing);
        });
        expect(result.current.expandedFilingAccession).toBe(null);
    });

    test('exposes formatters used by the view', () => {
        const { result } = renderHook(() => useFundamentalsData());
        expect(result.current.formatNumber(2.84e12, '$')).toBe('$2.84T');
        expect(result.current.formatNumber('N/A')).toBe('N/A');
        expect(result.current.formatPercent(0.1234)).toBe('12.34%');
        expect(result.current.formatPercentValue(12.5)).toBe('12.5%');
        expect(result.current.formatSignedInteger(5)).toBe('+5');
        expect(result.current.formatSignedInteger(-3)).toBe('-3');
    });
});
