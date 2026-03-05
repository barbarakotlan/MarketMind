import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
    clearAuthTokenGetter,
    installAuthFetchInterceptor,
    setAuthTokenGetter,
} from '../config/authFetch';

const AuthFetchBridge = () => {
    const { getToken, isSignedIn } = useAuth();

    useEffect(() => {
        installAuthFetchInterceptor();
    }, []);

    useEffect(() => {
        if (isSignedIn) {
            setAuthTokenGetter(async () => await getToken());
        } else {
            clearAuthTokenGetter();
        }

        return () => {
            clearAuthTokenGetter();
        };
    }, [isSignedIn, getToken]);

    return null;
};

export default AuthFetchBridge;

