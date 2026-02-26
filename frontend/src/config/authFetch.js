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
        if (!isBackendRequest(requestUrl) || !tokenGetter) {
            return originalFetch(input, init);
        }

        const token = await tokenGetter();
        if (!token) {
            return originalFetch(input, init);
        }

        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        return originalFetch(input, { ...init, headers });
    };

    interceptorInstalled = true;
};

