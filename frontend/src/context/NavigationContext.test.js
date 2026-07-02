import { renderHook, act } from '@testing-library/react';
import { NavigationProvider, useNavigation } from './NavigationContext';

const wrapper = ({ children }) => <NavigationProvider>{children}</NavigationProvider>;

describe('NavigationContext', () => {
    test('defaults to the screener page with empty intent', () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        expect(result.current.activePage).toBe('screener');
        expect(result.current.sharedTicker).toBeNull();
        expect(result.current.sharedCompareTicker).toBeNull();
        expect(result.current.sharedAiPrompt).toBe('');
    });

    test('navigate seeds intent and switches page', () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        act(() => result.current.navigate('fundamentals', { ticker: 'AAPL' }));
        expect(result.current.activePage).toBe('fundamentals');
        expect(result.current.sharedTicker).toBe('AAPL');
    });

    test('screenerNav opens the ticker in search and resets compare', () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        act(() => result.current.navigate('search', { compareTicker: 'OLD' }));
        act(() => result.current.screenerNav('MSFT'));
        expect(result.current.activePage).toBe('search');
        expect(result.current.sharedTicker).toBe('MSFT');
        expect(result.current.sharedCompareTicker).toBeNull();
    });

    test('screenerAction routes each action to the right page (ticker normalized)', () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        act(() => result.current.screenerAction({ action: 'predictions', ticker: 'aapl' }));
        expect(result.current.activePage).toBe('predictions');
        expect(result.current.sharedTicker).toBe('AAPL');

        act(() => result.current.screenerAction({ action: 'fundamentals', ticker: 'aapl' }));
        expect(result.current.activePage).toBe('fundamentals');

        act(() => result.current.screenerAction({ action: 'paper', ticker: 'aapl' }));
        expect(result.current.activePage).toBe('portfolio');

        act(() => result.current.screenerAction({ action: 'ai', ticker: 'nvda' }));
        expect(result.current.activePage).toBe('marketmindAI');
        expect(result.current.sharedAiPrompt).toContain('NVDA');

        act(() => result.current.screenerAction({ action: 'compare', ticker: 'aapl', compareTicker: 'msft' }));
        expect(result.current.activePage).toBe('search');
        expect(result.current.sharedTicker).toBe('AAPL');
        expect(result.current.sharedCompareTicker).toBe('MSFT');
    });

    test('screenerAction ignores an empty ticker', () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        act(() => result.current.screenerAction({ action: 'predictions', ticker: '   ' }));
        expect(result.current.activePage).toBe('screener');
        expect(result.current.sharedTicker).toBeNull();
    });

    test('clear functions reset the intent (read-once semantics)', () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        act(() => result.current.navigate('search', { ticker: 'AAPL', compareTicker: 'MSFT', aiPrompt: 'x' }));
        act(() => {
            result.current.clearTicker();
            result.current.clearCompareTicker();
            result.current.clearAiPrompt();
        });
        expect(result.current.sharedTicker).toBeNull();
        expect(result.current.sharedCompareTicker).toBeNull();
        expect(result.current.sharedAiPrompt).toBe('');
    });

    test('useNavigation throws when used outside a provider', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useNavigation())).toThrow(/NavigationProvider/);
        spy.mockRestore();
    });
});
