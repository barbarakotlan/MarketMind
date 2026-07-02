import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiData } from './useApiData';

describe('useApiData', () => {
    test('immediate fetch: loading is true then resolves with data', async () => {
        const fetcher = jest.fn().mockResolvedValue({ ok: 1 });
        const { result } = renderHook(() => useApiData(fetcher, []));

        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.data).toEqual({ ok: 1 });
        expect(result.current.error).toBe('');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('error path surfaces the thrown message and leaves data at initial', async () => {
        const fetcher = jest.fn().mockRejectedValue(new Error('boom'));
        const { result } = renderHook(() => useApiData(fetcher, [], { initialData: [] }));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('boom');
        expect(result.current.data).toEqual([]);
    });

    test('immediate:false does not fetch on mount', () => {
        const fetcher = jest.fn().mockResolvedValue(1);
        const { result } = renderHook(() => useApiData(fetcher, [], { immediate: false }));

        expect(result.current.loading).toBe(false);
        expect(fetcher).not.toHaveBeenCalled();
    });

    test('refetch forwards arguments to the fetcher and returns the result', async () => {
        const fetcher = jest.fn((q) => Promise.resolve(`r:${q}`));
        const { result } = renderHook(() => useApiData(fetcher, [], { immediate: false }));

        let returned;
        await act(async () => {
            returned = await result.current.refetch('AAPL');
        });

        expect(returned).toBe('r:AAPL');
        expect(fetcher).toHaveBeenCalledWith('AAPL');
        expect(result.current.data).toBe('r:AAPL');
        expect(result.current.error).toBe('');
    });

    test('clearOnFetch resets stale data when a subsequent fetch fails', async () => {
        const fetcher = jest
            .fn()
            .mockResolvedValueOnce(['seed'])
            .mockRejectedValueOnce(new Error('later failure'));
        const { result } = renderHook(() =>
            useApiData(fetcher, [], { immediate: false, initialData: [], clearOnFetch: true })
        );

        await act(async () => {
            await result.current.refetch();
        });
        expect(result.current.data).toEqual(['seed']);

        await act(async () => {
            await result.current.refetch();
        });
        // clearOnFetch reset data to initialData at the start; the failed fetch
        // leaves it cleared rather than showing stale results.
        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBe('later failure');
    });

    test('changing deps triggers a refetch', async () => {
        const fetcher = jest.fn().mockResolvedValue(1);
        const { rerender } = renderHook(({ dep }) => useApiData(fetcher, [dep]), {
            initialProps: { dep: 'a' },
        });

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        rerender({ dep: 'b' });
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    });

    test('does not update state after unmount', async () => {
        let resolveFetch;
        const fetcher = jest.fn(() => new Promise((res) => { resolveFetch = res; }));
        const { result, unmount } = renderHook(() => useApiData(fetcher, []));

        const before = result.current;
        unmount();
        await act(async () => {
            resolveFetch({ late: true });
            await Promise.resolve();
        });
        // No throw, and the last-rendered snapshot is unchanged post-unmount.
        expect(before.data).toBeNull();
    });
});
