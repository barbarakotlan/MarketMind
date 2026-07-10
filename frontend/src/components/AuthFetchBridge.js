import { useEffect } from 'react';
import { useAuth } from '../auth';
import {
    clearAuthTokenGetter,
    installAuthFetchInterceptor,
    setAuthSessionState,
    setAuthTokenGetter,
} from '../config/authFetch';

const AuthFetchBridge = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const jwtTemplate = import.meta.env.VITE_CLERK_JWT_TEMPLATE;

    useEffect(() => {
        installAuthFetchInterceptor();
    }, []);

    useEffect(() => {
        if (!isLoaded) {
            setAuthSessionState('loading');
            clearAuthTokenGetter();
            return () => {
                clearAuthTokenGetter();
                setAuthSessionState('unknown');
            };
        }

        if (isSignedIn) {
            setAuthSessionState('signedIn');
            setAuthTokenGetter(async ({ skipCache = false } = {}) => {
                try {
                    const opts = {};
                    if (jwtTemplate && jwtTemplate.trim()) {
                        opts.template = jwtTemplate.trim();
                    }
                    if (skipCache) {
                        opts.skipCache = true;
                    }
                    return await getToken(Object.keys(opts).length ? opts : undefined);
                } catch (e) {
                    console.error('Failed to get auth token for API request:', e);
                    return null;
                }
            });
        } else {
            setAuthSessionState('signedOut');
            clearAuthTokenGetter();
        }

        return () => {
            clearAuthTokenGetter();
            setAuthSessionState(isLoaded ? (isSignedIn ? 'signedIn' : 'signedOut') : 'unknown');
        };
    }, [isLoaded, isSignedIn, getToken, jwtTemplate]);

    return null;
};

export default AuthFetchBridge;
