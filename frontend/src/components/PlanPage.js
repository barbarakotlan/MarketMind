import React, { useState } from 'react';
import {
    Check, X, Zap, Crown, Sparkles, ArrowUpRight,
    TrendingUp, Shield, Clock, Users, GraduationCap, ChevronRight
} from 'lucide-react';

// ─── Shared style tokens ──────────────────────────────────────────────────────
const cardClass =
    'bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm';

// ─── Plan data ────────────────────────────────────────────────────────────────
const PLANS = [
    {
        id: 'free',
        icon: Zap,
        label: 'Free',
        price: 0,
        cadence: 'forever',
        tagline: 'Explore the markets. No credit card required.',
        accent: 'from-gray-500 to-gray-600',
        accentLight: 'bg-gray-50 dark:bg-gray-700/40',
        accentText: 'text-gray-600 dark:text-gray-300',
        ctaLabel: 'Get Started Free',
        ctaStyle:
            'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100',
        includes: [
            'Basic stock search',
            'Up to 5 AI predictions / day',
            'Watchlist (10 tickers)',
            'Alerts: 2 Active Alerts',
            'Paper trading (20 per month)',
            'Prediction Markets paper trades: 0',
            'Limited and delayed access to Fundamentals/Macro/Screener',
        ],
        excludes: [],
    },
    {
        id: 'pro',
        icon: Crown,
        label: 'Pro',
        price: 14.97,
        cadence: 'per month',
        tagline: 'Everything you need to trade smarter.',
        accent: 'from-blue-600 to-indigo-700',
        accentLight: 'bg-blue-50 dark:bg-blue-900/30',
        accentText: 'text-blue-600 dark:text-blue-400',
        ctaLabel: 'Upgrade to Pro',
        ctaStyle:
            'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25',
        badge: 'Most Popular',
        includes: [
            'Everything in Free',
            '100 AI predictions / day',
            'Unlimited Watchlist Size',
            'Alerts: 50 Active Alerts',
            'Unlimited Paper Trading',
            'Unlimited Prediction Markets paper trades',
            'Full, Unlimited Access to Fundamentals/Macro/Screener',
        ],
        excludes: [],
    },
];

const FUTURE_FEATURES = [
    { icon: GraduationCap, label: 'Student Tier',       desc: 'Discounted Pro access for verified .edu emails.' },
    { icon: Users,         label: 'Team Plans',          desc: 'Shared portfolios and collaborative watchlists.' },
    { icon: Sparkles,      label: 'Ad-Supported Free',   desc: 'Optional ads to unlock extra prediction credits.' },
];

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, isAnnual, onUpgrade }) {
    const Icon        = plan.icon;
    const monthly     = typeof plan.price === 'number' ? plan.price : parseInt(plan.price, 10);
    const displayPrice = isAnnual && monthly > 0 ? Math.round(monthly * 0.8) : monthly;

    function handleCTA() {
        if (monthly === 0) return;   // free plan — no checkout needed
        onUpgrade(isAnnual);
    }

    return (
        <div className={`
            relative flex flex-col rounded-2xl border-2 transition-all duration-300
            ${plan.badge === 'Most Popular'
                ? 'border-blue-400 dark:border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.02]'
                : 'border-gray-200 dark:border-gray-700 shadow-sm'}
            bg-white dark:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5
        `}>
            {plan.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold tracking-wide text-white bg-gradient-to-r ${plan.accent}`}>
                    {plan.badge}
                </div>
            )}

            <div className={`p-6 rounded-t-2xl ${plan.accentLight}`}>
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${plan.accent} mb-4`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">{plan.label}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.tagline}</p>
                <div className="mt-5 flex items-end gap-1">
                    {monthly === 0 ? (
                        <span className="text-4xl font-black text-gray-900 dark:text-white">Free</span>
                    ) : (
                        <>
                            <span className="text-4xl font-black text-gray-900 dark:text-white">${displayPrice}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">/{plan.cadence}</span>
                        </>
                    )}
                </div>
                {isAnnual && monthly > 0 && (
                    <p className={`text-xs font-semibold mt-1 ${plan.accentText}`}>
                        Save 20% with annual billing
                    </p>
                )}
            </div>

            <div className="px-6 pt-5">
                <button
                    onClick={handleCTA}
                    className={`w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 ${plan.ctaStyle}`}
                >
                    {plan.ctaLabel}
                    <ArrowUpRight className="w-4 h-4" />
                </button>
            </div>

            <div className="px-6 pt-5 pb-6 flex-1">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Includes</p>
                <ul className="space-y-2.5">
                    {plan.includes.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                            <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.accentText}`} />
                            <span>{f}</span>
                        </li>
                    ))}
                    {plan.excludes.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400 dark:text-gray-600">
                            <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="line-through">{f}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function HowItWorksStrip() {
    const steps = [
        { icon: Shield,     label: 'Sign up with Clerk',   desc: 'Secure, instant account creation.' },
        { icon: Crown,      label: 'Choose your plan',     desc: 'Upgrade anytime, cancel anytime.' },
        { icon: TrendingUp, label: 'Stripe Checkout',      desc: 'One-click payment, fully encrypted.' },
        { icon: Zap,        label: 'Instant access',       desc: 'Features unlock immediately after payment.' },
    ];
    return (
        <div className={`${cardClass} p-8 mt-10`}>
            <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Clock className="w-4 h-4" /> How Upgrading Works
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {steps.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="flex flex-col items-start gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-gray-300 dark:text-gray-600 w-5">{`0${i + 1}`}</span>
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{s.label}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.desc}</p>
                            </div>
                            {i < steps.length - 1 && (
                                <ChevronRight className="hidden md:block absolute text-gray-200" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ComingUpSection() {
    return (
        <div className="mt-10">
            <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> On the Roadmap
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {FUTURE_FEATURES.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-4 p-5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="p-2 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 flex-shrink-0">
                            <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
/**
 * Props:
 *   onNavigateToCheckout(isAnnual) — called when user clicks "Upgrade to Pro"
 *                                    navigate to <CheckoutPage isAnnual={isAnnual} />
 */
const PlanPage = ({ onNavigateToCheckout }) => {
    const [isAnnual, setIsAnnual] = useState(false);

    return (
        <div className="max-w-7xl mx-auto p-6 lg:p-8 animate-fade-in">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 mb-4">
                    <Crown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Plans & Pricing</span>
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Invest in your edge
                </h1>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                    Start free, upgrade when you're ready. No hidden fees, cancel anytime.
                </p>

                <div className="inline-flex items-center gap-3 mt-6 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
                    <button
                        onClick={() => setIsAnnual(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isAnnual ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setIsAnnual(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${isAnnual ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Annual
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/40 px-1.5 py-0.5 rounded-md">
                            -20%
                        </span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-3xl mx-auto">
                {PLANS.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        isAnnual={isAnnual}
                        onUpgrade={(annual) => onNavigateToCheckout(annual)}
                    />
                ))}
            </div>

            <HowItWorksStrip />
            <ComingUpSection />

            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-10">
                Payments processed securely by Stripe. You can cancel or change your plan at any time from your account settings.
            </p>
        </div>
    );
};

export default PlanPage;