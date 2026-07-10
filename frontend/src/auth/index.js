import React, { createContext, useContext } from 'react';
import {
    ClerkProvider,
    SignIn as ClerkSignIn,
    SignUp as ClerkSignUp,
    UserButton as ClerkUserButton,
    useAuth as useClerkAuth,
} from '@clerk/clerk-react';
import { CircleUserRound } from 'lucide-react';

const DEFAULT_LOCAL_AUTH_TOKEN = 'marketmind-local-development';

export const resolveAuthConfiguration = ({ authMode, publishableKey, nodeEnv }) => {
    const mode = String(authMode || 'clerk').trim().toLowerCase();

    if (!['clerk', 'local'].includes(mode)) {
        return {
            mode,
            error: `Unsupported authentication mode: ${mode}`,
        };
    }

    if (mode === 'local' && nodeEnv === 'production') {
        return {
            mode,
            error: 'Local authentication is disabled in production.',
        };
    }

    if (mode === 'clerk' && !publishableKey) {
        return {
            mode,
            error: 'Set REACT_APP_CLERK_PUBLISHABLE_KEY or use REACT_APP_AUTH_MODE=local for development.',
        };
    }

    return { mode, error: null };
};

const publishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
const configuration = resolveAuthConfiguration({
    authMode: process.env.REACT_APP_AUTH_MODE,
    publishableKey,
    nodeEnv: process.env.NODE_ENV,
});
const localAuthToken = process.env.REACT_APP_LOCAL_AUTH_TOKEN || DEFAULT_LOCAL_AUTH_TOKEN;
const localUserId = process.env.REACT_APP_LOCAL_AUTH_USER_ID || 'local_development_user';

const AuthContext = createContext(null);

const LocalAuthProvider = ({ children }) => (
    <AuthContext.Provider
        value={{
            mode: 'local',
            isLoaded: true,
            isSignedIn: true,
            userId: localUserId,
            getToken: async () => localAuthToken,
        }}
    >
        {children}
    </AuthContext.Provider>
);

const ClerkAuthBridge = ({ children }) => {
    const clerkAuth = useClerkAuth();

    return (
        <AuthContext.Provider value={{ ...clerkAuth, mode: 'clerk' }}>
            {children}
        </AuthContext.Provider>
    );
};

const AuthConfigurationError = ({ message }) => (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 text-center">
        <div>
            <h1 className="text-2xl font-bold mb-3">Authentication is not configured</h1>
            <p className="text-gray-300">{message}</p>
        </div>
    </div>
);

export const AuthProvider = ({ children }) => {
    if (configuration.error) {
        return <AuthConfigurationError message={configuration.error} />;
    }

    if (configuration.mode === 'local') {
        return <LocalAuthProvider>{children}</LocalAuthProvider>;
    }

    return (
        <ClerkProvider publishableKey={publishableKey}>
            <ClerkAuthBridge>{children}</ClerkAuthBridge>
        </ClerkProvider>
    );
};

export const useAuth = () => {
    const auth = useContext(AuthContext);
    if (!auth) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return auth;
};

export const SignedIn = ({ children }) => {
    const { isLoaded, isSignedIn } = useAuth();
    return isLoaded && isSignedIn ? children : null;
};

export const SignedOut = ({ children }) => {
    const { isLoaded, isSignedIn } = useAuth();
    return isLoaded && !isSignedIn ? children : null;
};

export const SignIn = (props) => {
    const { mode } = useAuth();
    return mode === 'clerk' ? <ClerkSignIn {...props} /> : null;
};

export const SignUp = (props) => {
    const { mode } = useAuth();
    return mode === 'clerk' ? <ClerkSignUp {...props} /> : null;
};

export const UserButton = (props) => {
    const { mode } = useAuth();
    if (mode === 'clerk') {
        return <ClerkUserButton {...props} />;
    }

    return (
        <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-mm-border bg-mm-surface-subtle text-mm-text-secondary"
            aria-label="Local development user"
            title="Local development user"
        >
            <CircleUserRound className="h-5 w-5" />
        </span>
    );
};
