import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../context/DarkModeContext';
import {
    BarChart3, Briefcase,
    Building2, Globe, SlidersHorizontal, Brain, ArrowRight,
    Target, Activity, Sun, Moon, ChevronDown, Zap, Shield,
    DollarSign, Bitcoin,
} from 'lucide-react';
import { blurUp, blurIn, stagger, viewportOnce } from './landing/animations';
import MarqueeTicker from './landing/MarqueeTicker';
import StepTerminals from './landing/StepTerminals';
import DashboardPreview from './landing/DashboardPreview';

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
    {
        icon: Brain, title: 'AI-Powered Predictions',
        desc: 'Unified forecasting stack combining AutoARIMA, Random Forest, XGBoost, and Linear Regression for 7 trading-session forecasts with model-level breakdown.',
        accent: 'from-blue-500 to-indigo-600', glow: 'hover:shadow-blue-500/15',
    },
    {
        icon: BarChart3, title: 'Professional Backtesting',
        desc: 'Rolling-window evaluation with 40+ performance metrics — Sharpe ratio, Sortino, max drawdown, win rate, and risk-adjusted returns.',
        accent: 'from-purple-500 to-violet-600', glow: 'hover:shadow-purple-500/15',
    },
    {
        icon: Briefcase, title: 'Paper Trading',
        desc: 'Practice with $100,000 in virtual capital. Execute trades, track open positions, and measure performance — entirely risk-free.',
        accent: 'from-emerald-500 to-green-600', glow: 'hover:shadow-emerald-500/15',
    },
    {
        icon: SlidersHorizontal, title: 'Live Stock Screener',
        desc: "Browse today's top gainers, losers, and most-active tickers in a real-time sortable table. Click any row to deep-dive instantly.",
        accent: 'from-orange-500 to-amber-600', glow: 'hover:shadow-orange-500/15',
    },
    {
        icon: Building2, title: 'Deep Fundamentals & SEC Filings',
        desc: 'Multi-year income statements, balance sheets, cash flows, and direct links to 10-K / 10-Q / 8-K EDGAR filings.',
        accent: 'from-indigo-500 to-blue-600', glow: 'hover:shadow-indigo-500/15',
    },
    {
        icon: Globe, title: 'Macro Dashboard',
        desc: 'Track unemployment, CPI, industrial production, and 10-Year Treasury yields with 24-month sparkline trend charts.',
        accent: 'from-cyan-500 to-teal-600', glow: 'hover:shadow-cyan-500/15',
    },
];

const STATS = [
    { value: '4',    label: 'Prod. Models',  sub: 'AutoARIMA · RF · XGBoost · Linear' },
    { value: '40+',  label: 'Perf. Metrics', sub: 'Sharpe · Sortino · Max Drawdown' },
    { value: '6',    label: 'Asset Classes', sub: 'Stocks · Forex · Crypto · More' },
    { value: '$100k',label: 'Paper Capital', sub: 'Risk-free trading sandbox' },
];

// ── Main component ────────────────────────────────────────────────────────────
const LandingPage = ({ onEnterApp }) => {
    const { isDarkMode, toggleDarkMode } = useDarkMode();
    const [navScrolled, setNavScrolled] = useState(false);

    // Detect scroll for nav shadow
    useEffect(() => {
        const onScroll = () => setNavScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Fixed-header-aware smooth scroll
    const scrollTo = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const offset = 96; // navbar (56px) + ticker strip (~40px)
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    };

    return (
        <div className="app-shell min-h-screen">

            {/* ── Navbar ─────────────────────────────────────────────── */}
            <nav className={`fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b transition-shadow duration-300 ${
                navScrolled
                    ? 'border-gray-200/80 dark:border-gray-800/80 shadow-sm dark:shadow-gray-900'
                    : 'border-gray-200/40 dark:border-gray-800/40'
            }`}>
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <motion.img
                        src={isDarkMode ? 'marketmindtransparentdark.png' : 'marketmindtransparent.png'}
                        alt="MarketMind"
                        className="h-8 w-auto object-contain"
                        initial={{ opacity: 0, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        transition={{ duration: 0.5 }}
                    />
                    <motion.div
                        className="flex items-center gap-4"
                        initial={{ opacity: 0, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <button onClick={() => scrollTo('features')}
                            className="hidden md:block text-sm text-mm-text-secondary hover:text-mm-text-primary transition-colors">
                            Features
                        </button>
                        <button onClick={() => scrollTo('how-it-works')}
                            className="hidden md:block text-sm text-mm-text-secondary hover:text-mm-text-primary transition-colors">
                            How it works
                        </button>
                        <button onClick={toggleDarkMode}
                            className="rounded-control p-2 text-mm-text-secondary hover:bg-mm-surface-subtle transition-colors"
                            aria-label="Toggle dark mode">
                            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <button onClick={onEnterApp}
                            className="ui-button-primary px-4 py-2 active:scale-95">
                            Launch App
                        </button>
                    </motion.div>
                </div>
            </nav>

            {/* ── Ticker strip ───────────────────────────────────────── */}
            <div className="fixed top-14 left-0 right-0 z-40">
                <MarqueeTicker />
            </div>

            {/* ── Hero ───────────────────────────────────────────────── */}
            <section className="relative pt-36 pb-24 px-6 overflow-hidden">
                {/* Background glows */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl" />
                    <div className="absolute top-40 right-1/4 w-80 h-80 bg-indigo-500/8 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Copy */}
                        <motion.div
                            variants={stagger(0.1)}
                            initial="hidden"
                            animate="show"
                        >
                            <motion.div variants={blurUp}
                                className="ui-chip mb-6 inline-flex items-center gap-2 px-3 py-1.5">
                                <Zap className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wide uppercase">
                                    AI-Powered Market Intelligence
                                </span>
                            </motion.div>

                            <motion.h1 variants={blurUp}
                                className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                                Predict.{' '}
                                <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                                    Trade.
                                </span>{' '}
                                Profit.
                            </motion.h1>

                            <motion.p variants={blurUp}
                                className="mb-8 max-w-lg text-xl leading-relaxed text-mm-text-secondary">
                                MarketMind combines ensemble machine learning, live market data, and professional analytics
                                into a single platform for smarter investment decisions.
                            </motion.p>

                            <motion.div variants={blurUp} className="flex flex-col sm:flex-row gap-3">
                                <button onClick={onEnterApp}
                                    className="ui-button-primary group flex items-center justify-center gap-2 px-7 py-3.5 active:scale-95">
                                    Launch App
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button onClick={() => scrollTo('features')}
                                    className="ui-button-secondary flex items-center justify-center gap-2 px-7 py-3.5">
                                    Explore Features
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </motion.div>

                            <motion.div variants={blurUp} className="mt-10 flex items-center gap-6 text-sm text-mm-text-secondary">
                                <div className="flex items-center gap-1.5">
                                    <Shield className="w-4 h-4 text-emerald-500" />
                                    <span>Risk-free paper trading</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Activity className="w-4 h-4 text-blue-500" />
                                    <span>Live market data</span>
                                </div>
                            </motion.div>
                        </motion.div>

                        {/* Dashboard preview */}
                        <DashboardPreview />
                    </div>
                </div>
            </section>

            {/* ── Stats bar ──────────────────────────────────────────── */}
            <section className="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 py-12 px-6">
                <motion.div
                    className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8"
                    variants={stagger(0.1)}
                    initial="hidden"
                    whileInView="show"
                    viewport={viewportOnce}
                >
                    {STATS.map(({ value, label, sub }) => (
                        <motion.div key={label} variants={blurUp} className="text-center">
                            <p className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">{value}</p>
                            <p className="mt-1 text-sm font-semibold text-mm-text-primary">{label}</p>
                            <p className="mt-0.5 text-xs text-mm-text-secondary">{sub}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ── Features ───────────────────────────────────────────── */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        variants={stagger(0.1)}
                        initial="hidden"
                        whileInView="show"
                        viewport={viewportOnce}
                    >
                        <motion.p variants={blurUp}
                            className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">
                            Everything You Need
                        </motion.p>
                        <motion.h2 variants={blurUp}
                            className="mb-4 text-4xl font-extrabold text-mm-text-primary">
                            Built for serious investors
                        </motion.h2>
                        <motion.p variants={blurUp}
                            className="mx-auto max-w-2xl text-lg text-mm-text-secondary">
                            From AI price predictions to SEC filings — all the tools a professional analyst uses,
                            packaged into a clean, fast interface.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                        variants={stagger(0.07)}
                        initial="hidden"
                        whileInView="show"
                        viewport={viewportOnce}
                    >
                        {FEATURES.map(({ icon: Icon, title, desc, accent, glow }) => (
                            <motion.div
                                key={title}
                                variants={blurUp}
                                className={`ui-panel group p-6 hover:shadow-elevated ${glow} hover:-translate-y-1 transition-all duration-300 cursor-default`}
                            >
                                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${accent} mb-4`}>
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="mb-2 text-base font-semibold text-mm-text-primary">{title}</h3>
                                <p className="text-sm leading-relaxed text-mm-text-secondary">{desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── How it works ───────────────────────────────────────── */}
            <section id="how-it-works" className="min-h-screen py-24 px-6 bg-gray-50 dark:bg-gray-900/50 flex items-center">
                <div className="max-w-6xl mx-auto w-full">
                    <motion.div
                        className="text-center mb-20"
                        variants={stagger(0.1)}
                        initial="hidden"
                        whileInView="show"
                        viewport={viewportOnce}
                    >
                        <motion.p variants={blurUp}
                            className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-3 font-mono">
                            $ ./run_workflow.sh
                        </motion.p>
                        <motion.h2 variants={blurUp}
                            className="text-4xl font-extrabold text-mm-text-primary">
                            Up and running in 3 steps
                        </motion.h2>
                    </motion.div>

                    <StepTerminals />
                </div>
            </section>

            {/* ── Asset classes ───────────────────────────────────────── */}
            <section className="py-20 px-6 border-y border-gray-200 dark:border-gray-800">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        variants={stagger(0.1)}
                        initial="hidden"
                        whileInView="show"
                        viewport={viewportOnce}
                    >
                        <motion.h2 variants={blurUp}
                            className="mb-3 text-3xl font-extrabold text-mm-text-primary">
                            6 asset classes, one platform
                        </motion.h2>
                        <motion.p variants={blurUp}
                            className="mb-10 text-mm-text-secondary">
                            Stocks, Forex, Crypto, Commodities, Macro indicators, and Options — all connected.
                        </motion.p>
                        <motion.div variants={stagger(0.06)} className="flex flex-wrap justify-center gap-3">
                            {[
                                { icon: BarChart3,       label: 'Equities',    color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                                { icon: DollarSign,      label: 'Forex',       color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
                                { icon: Bitcoin,         label: 'Crypto',      color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
                                { icon: Target,          label: 'Commodities', color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
                                { icon: Globe,           label: 'Macro',       color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800' },
                                { icon: Activity,        label: 'Options',     color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                            ].map(({ icon: Icon, label, color }) => (
                                <motion.div key={label} variants={blurUp}
                                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-semibold ${color}`}>
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────────── */}
            <section className="py-24 px-6 text-center">
                <motion.div
                    className="max-w-2xl mx-auto"
                    variants={blurIn}
                    initial="hidden"
                    whileInView="show"
                    viewport={viewportOnce}
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/5 rounded-3xl blur-2xl" />
                        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-12 shadow-2xl shadow-blue-500/25">
                            <h2 className="text-4xl font-extrabold text-white mb-4">
                                Start trading smarter today.
                            </h2>
                            <p className="text-blue-100 mb-8 text-lg">
                                Create a free account to sync your portfolio, watchlist, and alerts across sessions.
                            </p>
                            <button onClick={onEnterApp}
                                className="group inline-flex items-center gap-2 rounded-control bg-white px-8 py-4 font-semibold text-blue-700 shadow-lg transition-colors hover:bg-blue-50 active:scale-95">
                                Launch MarketMind
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ── Footer ─────────────────────────────────────────────── */}
            <footer className="border-t border-gray-200 dark:border-gray-800 py-8 px-6">
                <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-3 text-center">
                    <img
                        src={isDarkMode ? 'marketmindtransparentdark.png' : 'marketmindtransparent.png'}
                        alt="MarketMind"
                        className="h-7 w-auto object-contain opacity-70"
                    />
                    <p className="text-sm text-mm-text-tertiary">
                        © {new Date().getFullYear()} MarketMind. All rights reserved.
                    </p>
                    <p className="text-xs text-mm-text-tertiary">
                        For educational use only. Not financial advice.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
