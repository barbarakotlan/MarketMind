import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { ArrowLeft, LineChart } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

/**
 * AuthPage Component
 * 
 * Provides a dedicated modal/page combining Clerk's authentication components (`SignIn` and `SignUp`)
 * with a branded, split-view layout. Automatically conforms to application-wide dark mode settings.
 *
 * @component
 * @param {Object} props - React props.
 * @param {Function} props.onBack - Callback handler invoked when the user clicks the "Back" button to return to the previous view.
 * @returns {JSX.Element} The branded authentication container encompassing the Clerk form.
 */
const AuthPage = ({ onBack }) => {
    // Extract global theme configuration via Context
    const { isDarkMode } = useDarkMode();
    
    // Manage internal UI toggle between SignIn and SignUp views instead of routing
    const [mode, setMode] = useState('sign-in');

    return (
        <div className="app-shell min-h-screen flex items-center justify-center px-4 py-10">
            {/* Elevated styling card providing a split-view grid on typical desktop screens */}
            <div className="ui-panel-elevated w-full max-w-5xl overflow-hidden lg:grid lg:grid-cols-2">
                
                {/* --- Left Branding Panel (Hidden on mobile displays) --- */}
                <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                    <div>
                        {/* Dynamic logo loading respecting active theme */}
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

                {/* --- Right Interactive Form Panel --- */}
                <div className="p-6 md:p-10">
                    <div className="flex items-center justify-between mb-5">
                        {/* Navigation escape hatch back to main application */}
                        <button
                            onClick={onBack}
                            className="inline-flex items-center gap-2 text-sm text-mm-text-secondary hover:text-mm-text-primary"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                        
                        {/* Toggle header between Login and Registration pathways */}
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

                    {/* Authentication Logic Engine Injection Point */}
                    <div className="flex justify-center">
                        {mode === 'sign-in' ? (
                            // Render Clerk component forcing virtual routing to prevent conflicting ReactRouter logic
                            <SignIn
                                routing="virtual"
                                signUpUrl="#sign-up"
                                appearance={{
                                    elements: {
                                        // Overriding Clerk themes tightly coupling it to local design tokens
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

