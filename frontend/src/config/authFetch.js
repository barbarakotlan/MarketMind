import { API_BASE_URL } from './api';

const LEGACY_API_ORIGINS = new Set(['http://127.0.0.1:5001', 'http://localhost:5001']);

let tokenGetter = null;
let originalFetch = null;
let interceptorInstalled = false;

const getOrigin = (url) => {
    try {
        return new URL(url, window.location.origin).origin;
    } catch (e) {
        return null;
    }
};

const isBackendRequest = (url) => {
    const origin = getOrigin(url);
    const apiOrigin = getOrigin(API_BASE_URL);
    if (!origin) return false;
    return origin === apiOrigin || LEGACY_API_ORIGINS.has(origin);
};

const normalizeBackendUrl = (url) => {
    try {
        const parsed = new URL(url, window.location.origin);
        if (!LEGACY_API_ORIGINS.has(parsed.origin)) {
            return parsed.toString();
        }
        const apiBase = new URL(API_BASE_URL, window.location.origin);
        parsed.protocol = apiBase.protocol;
        parsed.host = apiBase.host;
        return parsed.toString();
    } catch (e) {
        return url;
    }
};

export const setAuthTokenGetter = (getter) => {
    tokenGetter = getter;
};

export const clearAuthTokenGetter = () => {
    tokenGetter = null;
};

export const installAuthFetchInterceptor = () => {
    if (interceptorInstalled || typeof window === 'undefined') return;
    originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input.url;
        if (!isBackendRequest(requestUrl)) {
            return originalFetch(input, init);
        }

        const normalizedUrl = normalizeBackendUrl(requestUrl);
        const normalizedInput =
            typeof input === 'string'
                ? normalizedUrl
                : (normalizedUrl !== requestUrl ? new Request(normalizedUrl, input) : input);

        if (!tokenGetter) {
            return originalFetch(normalizedInput, init);
        }

        const token = await tokenGetter();
        if (!token) {
            return originalFetch(normalizedInput, init);
        }

        const headers = new Headers(init.headers || (normalizedInput instanceof Request ? normalizedInput.headers : undefined));
        if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        return originalFetch(normalizedInput, { ...init, headers });
    };

    interceptorInstalled = true;
};
