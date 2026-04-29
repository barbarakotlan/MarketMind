import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
    clearAuthTokenGetter,
    installAuthFetchInterceptor,
    setAuthSessionState,
    setAuthTokenGetter,
} from '../config/authFetch';

const AuthFetchBridge = () => {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const jwtTemplate = process.env.REACT_APP_CLERK_JWT_TEMPLATE;

    useEffect(() => {
        // Install once near the app root so every fetch can share the same auth boundary.
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
                    // Clerk templates are optional locally, but production can use them to mint API-scoped JWTs.
                    const opts = {};
                    if (jwtTemplate && jwtTemplate.trim()) {
                        opts.template = jwtTemplate.trim();
                    }
                    if (skipCache) {
                        opts.skipCache = true;
                    }
                    return await getToken(Object.keys(opts).length ? opts : undefined);
                } catch (e) {
                    console.error('Failed to get Clerk token for API request:', e);
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
