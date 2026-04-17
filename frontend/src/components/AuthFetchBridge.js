import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
    clearAuthTokenGetter,
    installAuthFetchInterceptor,
    setAuthSessionState,
    setAuthTokenGetter,
} from '../config/authFetch';

/**
 * AuthFetchBridge Component
 * 
 * A utility component that acts as a bridge between Clerk authentication 
 * hooks and a global custom fetch interceptor. It dynamically updates 
 * the authorization token provider and session status whenever the user's 
 * authentication state changes.
 * 
 * This component does not render any UI elements.
 * 
 * @component
 * @returns {null} Always returns null as it's a logic-only component.
 */
const AuthFetchBridge = () => {
    // Extract authentication state and the token retrieval function from Clerk
    const { getToken, isLoaded, isSignedIn } = useAuth();
    
    // Retrieve custom JWT template specific to the app's environment configuration
    const jwtTemplate = process.env.REACT_APP_CLERK_JWT_TEMPLATE;

    // Effect: Initialize the fetch interceptor on initial mount.
    // This connects global fetch API calls to the logic provided below.
    useEffect(() => {
        installAuthFetchInterceptor();
    }, []);

    // Effect: Sync Clerk's auth state to the global custom fetch configuration
    useEffect(() => {
        if (!isLoaded) {
            // Setup loading state while Clerk initializes
            setAuthSessionState('loading');
            clearAuthTokenGetter();
            return () => {
                // Cleanup partial state on unmount
                clearAuthTokenGetter();
                setAuthSessionState('unknown');
            };
        }

        if (isSignedIn) {
            // Update session state to signed in
            setAuthSessionState('signedIn');
            
            // Provide a getter function that fetch interceptors can use to obtain a fresh token. 
            // Handles JWT templates and cache-skipping via `opts`.
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
            // Handle signed out state explicitly
            setAuthSessionState('signedOut');
            clearAuthTokenGetter();
        }

        // Cleanup function for when auth dependencies change or component unmounts
        return () => {
            clearAuthTokenGetter();
            setAuthSessionState(isLoaded ? (isSignedIn ? 'signedIn' : 'signedOut') : 'unknown');
        };
    }, [isLoaded, isSignedIn, getToken, jwtTemplate]);

    return null; // Logic-only component, renders nothing to the DOM
};

export default AuthFetchBridge;
