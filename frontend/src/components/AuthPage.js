import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { ArrowLeft, LineChart } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

const AuthPage = ({ onBack }) => {
    const { isDarkMode } = useDarkMode();
    const [mode, setMode] = useState('sign-in');

    return (
        <div className="app-shell min-h-screen flex items-center justify-center px-4 py-10">
            <div className="ui-panel-elevated w-full max-w-5xl overflow-hidden lg:grid lg:grid-cols-2">
                <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                    <div>
                        <img
                            src={isDarkMode ? 'marketmindtransparentdark.png' : 'marketmindtransparent.png'}
                            alt="MarketMind"
                            className="h-10 w-auto object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold mb-4">Secure access to your market workspace</h1>
                        <p className="text-blue-100 leading-relaxed">
                            Sign in to sync your watchlist, paper trades, alerts, and prediction positions with your account.
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-blue-100">
                            <LineChart className="w-5 h-5" />
                            <span className="text-sm">Multi-device portfolio continuity</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-10">
                    <div className="flex items-center justify-between mb-5">
                        <button
                            onClick={onBack}
                            className="inline-flex items-center gap-2 text-sm text-mm-text-secondary hover:text-mm-text-primary"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                        <div className="ui-tab-group">
                            <button
                                onClick={() => setMode('sign-in')}
                                className={`px-3 py-1.5 text-sm ${
                                    mode === 'sign-in'
                                        ? 'ui-tab ui-tab-active'
                                        : 'ui-tab'
                                }`}
                            >
                                Sign in
                            </button>
                            <button
                                onClick={() => setMode('sign-up')}
                                className={`px-3 py-1.5 text-sm ${
                                    mode === 'sign-up'
                                        ? 'ui-tab ui-tab-active'
                                        : 'ui-tab'
                                }`}
                            >
                                Sign up
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        {mode === 'sign-in' ? (
                            <SignIn
                                routing="virtual"
                                signUpUrl="#sign-up"
                                appearance={{
                                    elements: {
                                        card: 'shadow-none border border-mm-border bg-mm-surface',
                                    },
                                }}
                            />
                        ) : (
                            <SignUp
                                routing="virtual"
                                signInUrl="#sign-in"
                                appearance={{
                                    elements: {
                                        card: 'shadow-none border border-mm-border bg-mm-surface',
                                    },
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
