import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import {
    Crown, Lock, Check, ShieldCheck, RefreshCw,
    Zap, TrendingUp, ArrowLeft, Star, Sparkles,
} from 'lucide-react';

// ─── Stripe publishable key ───────────────────────────────────────────────────
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
    : null;

// ─── Plan definition ──────────────────────────────────────────────────────────
const PRO_PLAN = {
    label: 'Pro',
    monthlyPrice: 14.97,
    includes: [
        'Everything in Free',
        '100 AI predictions / day',
        'Unlimited Watchlist Size',
        '50 Active Alerts',
        'Unlimited Paper Trading',
        'Unlimited Prediction Markets paper trades',
        'Full access to Fundamentals / Macro / Screener',
    ],
};

// ─── Shared pricing helper — single source of truth ──────────────────────────
function calcPricing(isAnnual) {
    const monthly      = PRO_PLAN.monthlyPrice;
    const billedTotal  = isAnnual ? +(monthly * 12 * 0.8).toFixed(2) : +monthly.toFixed(2);
    const displayPrice = isAnnual ? +(monthly * 0.8).toFixed(2) : +monthly.toFixed(2);
    const savings      = isAnnual ? +(monthly * 12 - billedTotal).toFixed(2) : 0;
    return { monthly, billedTotal, displayPrice, savings };
}

// ─── Order summary (left column) ─────────────────────────────────────────────
function OrderSummary({ isAnnual, onToggleAnnual }) {
    const { monthly, billedTotal, displayPrice, savings } = calcPricing(isAnnual);

    return (
        <div className="flex flex-col gap-6">
            {/* Plan hero card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-500/20">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5" />
                <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Crown className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-blue-100 uppercase tracking-wider">MarketMind</p>
                                <p className="text-lg font-extrabold">Pro Plan</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 text-xs font-bold">
                            <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
                            Most Popular
                        </div>
                    </div>

                    <div className="flex items-end gap-1.5 mb-1">
                        <span className="text-4xl font-black">${displayPrice.toFixed(2)}</span>
                        <span className="text-blue-200 text-sm mb-1.5">
                            / {isAnnual ? 'mo, billed annually' : 'month'}
                        </span>
                    </div>

                    {savings > 0 && (
                        <div className="inline-flex items-center gap-1.5 bg-green-400/20 border border-green-400/30 text-green-200 rounded-full px-3 py-1 text-xs font-bold">
                            <Sparkles className="w-3 h-3" />
                            You save ${savings.toFixed(2)} / year
                        </div>
                    )}
                </div>
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Annual billing</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Save 20% with annual billing</p>
                </div>
                <button
                    onClick={onToggleAnnual}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${isAnnual ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label="Toggle annual billing"
                >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isAnnual ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Price breakdown */}
            <div className="space-y-2.5 text-sm px-1">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Pro plan × {isAnnual ? '12 months' : '1 month'}</span>
                    <span>${(isAnnual ? monthly * 12 : monthly).toFixed(2)}</span>
                </div>
                {savings > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400 font-semibold">
                        <span>Annual discount (−20%)</span>
                        <span>−${savings.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Tax</span>
                    <span>$0.00</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-extrabold text-gray-900 dark:text-white text-base">
                    <span>Total due today</span>
                    <span>${billedTotal.toFixed(2)}</span>
                </div>
            </div>

            {/* Feature list */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        What you unlock
                    </p>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {PRO_PLAN.includes.map((f) => (
                        <li key={f} className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                            <Check className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                            {f}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500 px-1">
                {[
                    { icon: ShieldCheck, label: 'SSL Encrypted'    },
                    { icon: RefreshCw,   label: 'Cancel anytime'    },
                    { icon: Zap,         label: 'Instant access'    },
                    { icon: TrendingUp,  label: 'Powered by Stripe' },
                ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3" />
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Inner form — must be inside <Elements> ───────────────────────────────────
function CheckoutForm({ isAnnual, onSuccess }) {
    const stripe   = useStripe();
    const elements = useElements();
    const [error,   setError]   = useState(null);
    const [loading, setLoading] = useState(false);

    const { billedTotal } = calcPricing(isAnnual);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!stripe || !elements) return;

        setError(null);
        setLoading(true);

        const { error: stripeError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/checkout/success`,
            },
            redirect: 'if_required',
        });

        if (stripeError) {
            setError(stripeError.message);
            setLoading(false);
        } else {
            onSuccess();
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
                <p className="text-xs font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-4">
                    Payment Details
                </p>
                <PaymentElement />
            </div>

            {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                    <span className="mt-0.5 flex-shrink-0">⚠</span>
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || loading}
                className={`
                    w-full py-4 rounded-xl text-sm font-extrabold tracking-wide
                    flex items-center justify-center gap-2.5
                    transition-all duration-200
                    ${(!stripe || loading)
                        ? 'bg-blue-400 dark:bg-blue-700 text-white cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/30 active:scale-[0.98]'
                    }
                `}
            >
                {loading ? (
                    <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Processing…
                    </>
                ) : (
                    <>
                        <Lock className="w-4 h-4" />
                        Pay ${billedTotal.toFixed(2)} — Activate Pro
                    </>
                )}
            </button>

            <p className="text-center text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" />
                256-bit SSL · Powered by Stripe · Card data never touches our servers
            </p>
        </form>
    );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ isAnnual, onGoToDashboard }) {
    const { billedTotal } = calcPricing(isAnnual);

    return (
        <div className="flex flex-col items-center justify-center text-center gap-6 py-12 px-6">
            <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-blue-500/40">
                    <Check className="w-12 h-12 text-white" strokeWidth={2.5} />
                </div>
                <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 blur-2xl scale-150 animate-pulse" />
            </div>

            <div>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">
                    Payment Successful
                </p>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Welcome to Pro! 🎉
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm max-w-xs mx-auto leading-relaxed">
                    Your MarketMind Pro subscription is now active. All features are unlocked immediately.
                </p>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden text-sm">
                <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Receipt
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    <div className="flex justify-between px-5 py-3 text-gray-600 dark:text-gray-400">
                        <span>Plan</span>
                        <span className="font-semibold text-gray-900 dark:text-white">MarketMind Pro</span>
                    </div>
                    <div className="flex justify-between px-5 py-3 text-gray-600 dark:text-gray-400">
                        <span>Billing</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{isAnnual ? 'Annual' : 'Monthly'}</span>
                    </div>
                    <div className="flex justify-between px-5 py-3 text-gray-600 dark:text-gray-400">
                        <span>Charged</span>
                        <span className="font-semibold text-gray-900 dark:text-white">${billedTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onGoToDashboard}
                className="px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
            >
                Go to Dashboard →
            </button>

            <p className="text-xs text-gray-400 dark:text-gray-500">
                A receipt has been sent to your email by Stripe.
            </p>
        </div>
    );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function CheckoutPage({
    isAnnual: initialAnnual = false,
    userEmail = '',
    onBack,
    onSuccess,
}) {
    const [isAnnual,     setIsAnnual]     = useState(initialAnnual);
    const [clientSecret, setClientSecret] = useState(null);
    const [fetchError,   setFetchError]   = useState(null);
    const [requestNonce, setRequestNonce] = useState(0);
    const [success,      setSuccess]      = useState(false);

    useEffect(() => {
        setClientSecret(null);
        setFetchError(null);
    }, [isAnnual]);

    useEffect(() => {
        let cancelled = false;
        setFetchError(null);

        apiRequest(API_ENDPOINTS.CHECKOUT_CREATE_SUBSCRIPTION, {
            method: 'POST',
            body: JSON.stringify({ billing: isAnnual ? 'annual' : 'monthly' }),
        })
            .then(data => {
                if (cancelled) return;
                setClientSecret(data.clientSecret);
            })
            .catch((error) => {
                if (!cancelled) {
                    setFetchError(error?.message || 'Could not reach the server. Please try again.');
                }
            });

        return () => { cancelled = true; };
    }, [isAnnual, requestNonce]);

    const appearance = {
        theme: 'stripe',
        variables: {
            colorPrimary:    '#2563eb',
            colorBackground: '#ffffff',
            colorText:       '#111827',
            colorDanger:     '#ef4444',
            fontFamily:      'ui-sans-serif, system-ui, sans-serif',
            borderRadius:    '12px',
            spacingUnit:     '4px',
        },
        rules: {
            '.Input': {
                border:    '2px solid #e5e7eb',
                boxShadow: 'none',
                padding:   '12px 16px',
            },
            '.Input:focus': {
                border:    '2px solid #2563eb',
                boxShadow: 'none',
            },
            '.Label': {
                fontSize:      '11px',
                fontWeight:    '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color:         '#6b7280',
            },
        },
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <SuccessScreen isAnnual={isAnnual} onGoToDashboard={onSuccess} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
            {/* Top bar */}
            <div className="max-w-5xl mx-auto mb-8 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Plans
                </button>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <Lock className="w-3.5 h-3.5" />
                    Secured by Stripe
                </div>
            </div>

            {/* Main grid */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 items-start">

                {/* Left — order summary */}
                <OrderSummary isAnnual={isAnnual} onToggleAnnual={() => setIsAnnual(a => !a)} />

                {/* Right — payment */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
                    <div className="p-8">
                        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
                            Complete your purchase
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-7">
                            {userEmail
                                ? `Your card details are handled entirely by Stripe for ${userEmail}.`
                                : 'Your card details are handled entirely by Stripe.'}
                        </p>

                        {fetchError ? (
                            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                                {fetchError}
                                <button
                                    onClick={() => {
                                        setClientSecret(null);
                                        setFetchError(null);
                                        setRequestNonce(value => value + 1);
                                    }}
                                    className="block mt-2 text-xs underline"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : !clientSecret ? (
                            <div className="flex flex-col gap-4 animate-pulse">
                                {[80, 100, 60, 60, 100].map((w, i) => (
                                    <div key={i} className={`h-12 w-${w} rounded-xl bg-gray-100 dark:bg-gray-800`} />
                                ))}
                            </div>
                        ) : !stripePromise ? (
                            <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-4 text-sm text-yellow-800 dark:text-yellow-300">
                                Checkout is not configured yet. Please add your Stripe publishable key.
                            </div>
                        ) : (
                            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                                <CheckoutForm
                                    isAnnual={isAnnual}
                                    onSuccess={() => setSuccess(true)}
                                />
                            </Elements>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-10">
                By completing this purchase you agree to our Terms of Service. Subscriptions renew automatically. Cancel anytime.
            </p>
        </div>
    );
}
