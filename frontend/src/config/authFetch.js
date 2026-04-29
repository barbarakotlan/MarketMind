import { API_BASE_URL } from './api';

const LEGACY_API_ORIGINS = new Set(['http://127.0.0.1:5001', 'http://localhost:5001']);

let tokenGetter = null;
let originalFetch = null;
let interceptorInstalled = false;
let authSessionState = 'unknown';

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
    // Accept the configured API origin plus older localhost references that still appear in some call sites.
    return origin === apiOrigin || LEGACY_API_ORIGINS.has(origin);
};

const normalizeBackendUrl = (url) => {
    try {
        const parsed = new URL(url, window.location.origin);
        if (!LEGACY_API_ORIGINS.has(parsed.origin)) {
            return parsed.toString();
        }
        // Route legacy localhost backend URLs through the current API base so deploy previews stay consistent.
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

export const setAuthSessionState = (nextState) => {
    authSessionState = nextState || 'unknown';
};

const waitForTokenGetter = async (timeoutMs = 1500) => {
    if (tokenGetter) {
        return tokenGetter;
    }

    // The bridge may mount a beat after early API calls, so wait briefly before sending an anonymous request.
    const startedAt = Date.now();
    while (!tokenGetter && Date.now() - startedAt < timeoutMs) {
        if (authSessionState === 'signedOut') {
            break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 25));
    }

    return tokenGetter;
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

        const buildHeaders = (sourceHeaders, tokenValue) => {
            const headers = new Headers(
                sourceHeaders || (normalizedInput instanceof Request ? normalizedInput.headers : undefined)
            );
            if (tokenValue && !headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${tokenValue}`);
            }
            return headers;
        };

        const activeTokenGetter = tokenGetter || (authSessionState !== 'signedOut' ? await waitForTokenGetter() : null);

        if (!activeTokenGetter) {
            return originalFetch(normalizedInput, init);
        }

        let token = await activeTokenGetter({ skipCache: false });
        let headers = buildHeaders(init.headers, token);
        let response = await originalFetch(normalizedInput, { ...init, headers });

        // If token is stale/expired, retry once with a fresh token.
        if (response.status === 401) {
            const latestTokenGetter = tokenGetter || activeTokenGetter;
            const freshToken = latestTokenGetter ? await latestTokenGetter({ skipCache: true }) : null;
            if (freshToken && freshToken !== token) {
                headers = buildHeaders(init.headers, freshToken);
                response = await originalFetch(normalizedInput, { ...init, headers });
            }
        }

        return response;
    };

    interceptorInstalled = true;
};
