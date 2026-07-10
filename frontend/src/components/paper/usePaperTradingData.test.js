import { renderHook, act, waitFor } from '@testing-library/react';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';
import usePaperTradingData from './usePaperTradingData';

// vi.mock is hoisted above imports, so the imported
// useNavigation / apiRequest are already mocks.
vi.mock('../../context/NavigationContext', () => ({ useNavigation: vi.fn() }));
vi.mock('../../config/api', async () => ({
    ...(await vi.importActual('../../config/api')),
    apiRequest: vi.fn(),
}));

const PORTFOLIO = { cash: 5000, total_value: 10000, positions: [], options_positions: [] };

beforeEach(() => {
    vi.clearAllMocks();
    useNavigation.mockReturnValue({ sharedTicker: '', clearTicker: vi.fn() });
    apiRequest.mockImplementation((url) => {
        if (url === API_ENDPOINTS.PORTFOLIO) return Promise.resolve(PORTFOLIO);
        if (url === API_ENDPOINTS.PORTFOLIO_OPTIMIZE) return Promise.resolve({ recommendations: [] });
        return Promise.resolve({ message: 'ok' });
    });
});

describe('usePaperTradingData', () => {
    test('fetches the portfolio on mount and clears loading', async () => {
        const { result } = renderHook(() => usePaperTradingData());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.portfolio).toEqual(PORTFOLIO);
        expect(result.current.stockPositions).toEqual([]);
        expect(result.current.optionsPositions).toEqual([]);
    });

    test('surfaces a sync error when the portfolio fetch fails', async () => {
        apiRequest.mockImplementation((url) =>
            url === API_ENDPOINTS.PORTFOLIO ? Promise.reject(new Error('down')) : Promise.resolve({}),
        );
        const { result } = renderHook(() => usePaperTradingData());

        await waitFor(() => expect(result.current.tradeMessage.type).toBe('error'));
        expect(result.current.tradeMessage.text).toMatch(/Backend Sync Failed/i);
        expect(result.current.loading).toBe(false);
    });

    test('consumes an incoming ticker by opening the buy modal', async () => {
        const clearTicker = vi.fn();
        useNavigation.mockReturnValue({ sharedTicker: 'aapl', clearTicker });
        const { result } = renderHook(() => usePaperTradingData());

        await waitFor(() => expect(result.current.showBuyModal).toBe(true));
        expect(result.current.buyTicker).toBe('AAPL');
        expect(clearTicker).toHaveBeenCalled();
    });

    test('runs optimization once there are at least two stock positions', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.PORTFOLIO) {
                return Promise.resolve({ ...PORTFOLIO, positions: [{ ticker: 'A' }, { ticker: 'B' }] });
            }
            if (url === API_ENDPOINTS.PORTFOLIO_OPTIMIZE) return Promise.resolve({ recommendations: ['x'] });
            return Promise.resolve({});
        });
        const { result } = renderHook(() => usePaperTradingData());

        await waitFor(() => expect(result.current.optimizationData).toEqual({ recommendations: ['x'] }));
        expect(result.current.optimizationError).toBe('');
    });

    test('skips optimization with fewer than two positions', async () => {
        const { result } = renderHook(() => usePaperTradingData());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.optimizationData).toBe(null);
        expect(apiRequest).not.toHaveBeenCalledWith(
            API_ENDPOINTS.PORTFOLIO_OPTIMIZE,
            expect.anything(),
        );
    });

    test('handleBuy posts the order, shows success, and closes the modal', async () => {
        const { result } = renderHook(() => usePaperTradingData());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setBuyTicker('msft'));
        act(() => result.current.setBuyShares('10'));
        await act(async () => {
            await result.current.handleBuy({ preventDefault: vi.fn() });
        });

        expect(result.current.tradeMessage).toEqual({ type: 'success', text: 'ok' });
        expect(result.current.showBuyModal).toBe(false);
        expect(apiRequest).toHaveBeenCalledWith(
            API_ENDPOINTS.PAPER_BUY,
            expect.objectContaining({ method: 'POST' }),
        );
    });
});
