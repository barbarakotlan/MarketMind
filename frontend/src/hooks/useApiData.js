import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useApiData — shared data-fetching state for the common
 * "loading / error / data" page pattern, replacing the repeated
 * setLoading(true) / try / await apiRequest / catch setError / finally
 * setLoading(false) boilerplate.
 *
 * The `fetcher` is any async function (typically one that calls
 * `apiRequest(API_ENDPOINTS.X(...))`). It may return already-transformed data.
 * `refetch(...args)` forwards its arguments to the fetcher, so pages that fetch
 * with parameters (search terms, filters) can call `refetch(query)`.
 *
 * Errors are surfaced as `error` (the thrown Error's `.message`), matching the
 * existing `apiRequest` contract. A mounted-guard prevents state updates after
 * unmount (a latent-bug fix that does not change rendered output).
 *
 * @param {(...args: any[]) => Promise<any>} fetcher
 * @param {any[]} deps  re-run the immediate fetch when these change (like useEffect deps)
 * @param {object} [options]
 * @param {boolean} [options.immediate=true]     fetch once on mount / when deps change
 * @param {any}     [options.initialData=null]   initial value for `data`
 * @param {boolean} [options.clearOnFetch=false] reset `data` to initialData at the start of each fetch
 * @returns {{ data: any, loading: boolean, error: string, refetch: (...args:any[]) => Promise<any>, setData: Function }}
 */
export function useApiData(fetcher, deps = [], options = {}) {
    const { immediate = true, initialData = null, clearOnFetch = false } = options;

    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(immediate);
    const [error, setError] = useState('');

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Keep the latest fetcher without making it a dependency of refetch, so
    // inline-defined fetchers don't churn the callback identity.
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const refetch = useCallback(
        async (...args) => {
            setLoading(true);
            setError('');
            if (clearOnFetch) {
                setData(initialData);
            }
            try {
                const result = await fetcherRef.current(...args);
                if (mountedRef.current) {
                    setData(result);
                }
                return result;
            } catch (err) {
                if (mountedRef.current) {
                    setError(err?.message ?? String(err));
                }
                return undefined;
            } finally {
                if (mountedRef.current) {
                    setLoading(false);
                }
            }
        },
        [clearOnFetch, initialData]
    );

    useEffect(() => {
        if (immediate) {
            refetch();
        }
        // deps drive the immediate refetch; refetch identity is stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, loading, error, refetch, setData };
}

export default useApiData;
