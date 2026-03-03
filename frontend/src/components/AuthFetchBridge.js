import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
    clearAuthTokenGetter,
    installAuthFetchInterceptor,
    setAuthTokenGetter,
} from '../config/authFetch';

const AuthFetchBridge = () => {
    const { getToken, isSignedIn } = useAuth();
    const jwtTemplate = process.env.REACT_APP_CLERK_JWT_TEMPLATE;

    useEffect(() => {
        installAuthFetchInterceptor();
    }, []);

    useEffect(() => {
        if (isSignedIn) {
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
                    console.error('Failed to get Clerk token for API request:', e);
                    return null;
                }
            });
        } else {
            clearAuthTokenGetter();
        }

        return () => {
            clearAuthTokenGetter();
        };
    }, [isSignedIn, getToken, jwtTemplate]);

    return null;
};

export default AuthFetchBridge;
