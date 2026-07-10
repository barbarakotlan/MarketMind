import { API_BASE_URL } from './api';
import {
    installAuthFetchInterceptor,
    setAuthSessionState,
    setAuthTokenGetter,
    uninstallAuthFetchInterceptor,
} from './authFetch';

describe('auth fetch transport', () => {
    let fetchSpy;

    beforeEach(() => {
        uninstallAuthFetchInterceptor();
        fetchSpy = vi.fn().mockResolvedValue({ status: 200 });
        window.fetch = fetchSpy;
    });

    afterEach(() => {
        uninstallAuthFetchInterceptor();
    });

    test('adds a bearer token only to backend requests', async () => {
        const getToken = vi.fn().mockResolvedValue('signed-token');
        setAuthSessionState('signedIn');
        setAuthTokenGetter(getToken);
        installAuthFetchInterceptor();

        await window.fetch(`${API_BASE_URL}/stock/AAPL`, {
            headers: { 'X-Request-ID': 'request-1' },
        });
        await window.fetch('https://example.com/news');

        const backendInit = fetchSpy.mock.calls[0][1];
        expect(backendInit.headers.get('Authorization')).toBe('Bearer signed-token');
        expect(backendInit.headers.get('X-Request-ID')).toBe('request-1');
        expect(fetchSpy.mock.calls[1]).toEqual(['https://example.com/news', {}]);
        expect(getToken).toHaveBeenCalledTimes(1);
    });

    test('preserves an explicit authorization header', async () => {
        setAuthSessionState('signedIn');
        setAuthTokenGetter(vi.fn().mockResolvedValue('replacement-token'));
        installAuthFetchInterceptor();

        await window.fetch(`${API_BASE_URL}/paper/portfolio`, {
            headers: { Authorization: 'Bearer caller-token' },
        });

        expect(fetchSpy.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer caller-token');
    });

    test('retries one unauthorized response with a refreshed token', async () => {
        fetchSpy
            .mockResolvedValueOnce({ status: 401 })
            .mockResolvedValueOnce({ status: 200 });
        const getToken = vi
            .fn()
            .mockResolvedValueOnce('stale-token')
            .mockResolvedValueOnce('fresh-token');
        setAuthSessionState('signedIn');
        setAuthTokenGetter(getToken);
        installAuthFetchInterceptor();

        const response = await window.fetch(`${API_BASE_URL}/auth/me`);

        expect(response.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(fetchSpy.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer stale-token');
        expect(fetchSpy.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer fresh-token');
        expect(getToken).toHaveBeenLastCalledWith({ skipCache: true });
    });

    test('does not wait for a token when the session is signed out', async () => {
        setAuthSessionState('signedOut');
        installAuthFetchInterceptor();

        await window.fetch(`${API_BASE_URL}/stock/MSFT`);

        expect(fetchSpy).toHaveBeenCalledWith(expect.anything(), {});
    });
});
