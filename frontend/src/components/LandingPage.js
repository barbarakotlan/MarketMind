import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import {
    TrendingUp, TrendingDown, BarChart3, Search, Briefcase,
    Building2, Globe, SlidersHorizontal, Brain, ArrowRight,
    Target, Activity, Sun, Moon, ChevronDown, Zap, Shield,
    DollarSign, Bitcoin, Newspaper
} from 'lucide-react';

// ── Live ticker strip ─────────────────────────────────────────────────────────
const TICKERS = [
    { ticker: 'SPY',     label: 'S&P 500' },
    { ticker: 'QQQ',     label: 'NASDAQ' },
    { ticker: 'DIA',     label: 'Dow Jones' },
    { ticker: 'BTC-USD', label: 'Bitcoin' },
    { ticker: 'GLD',     label: 'Gold' },
    { ticker: 'AAPL',    label: 'Apple' },
];

function TickerStrip() {
    const [data, setData] = useState({});

    useEffect(() => {
        Promise.allSettled(
            TICKERS.map(({ ticker }) =>
                fetch(`http://127.0.0.1:5001/stock/${ticker}`).then(r => r.json())
            )
        ).then(results => {
            const map = {};
            results.forEach((r, i) => {
                if (r.status === 'fulfilled' && !r.value?.error) {
                    map[TICKERS[i].ticker] = r.value;
                }
            });
            setData(map);
        }).catch(() => {});
    }, []);

    return (
        <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 overflow-hidden">
            <div className="flex items-center gap-8 px-6 py-2.5 overflow-x-auto no-scrollbar">
                {TICKERS.map(({ ticker, label }) => {
                    const s = data[ticker];
                    const chg = s?.change_percent;
                    const pos = chg > 0;
                    return (
                        <div key={ticker} className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-gray-400">{label}</span>
                            {s ? (
                                <>
                                    <span className="text-sm font-semibold text-white">
                                        ${s.price?.toFixed(2)}
                                    </span>
                                    <span className={`text-xs font-medium flex items-center gap-0.5 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {pos ? '+' : ''}{chg?.toFixed(2)}%
                                    </span>
                                </>
                            ) : (
                                <span className="text-sm text-gray-600 animate-pulse">——</span>
                            )}
                        </div>
                    );
                })}
                <div className="flex-shrink-0 text-xs text-gray-600 ml-auto">Live</div>
            </div>
        </div>
    );
}

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
    {
        icon: Brain,
        title: 'AI-Powered Predictions',
        desc: 'Ensemble ML model combining Random Forest, XGBoost, and Linear Regression for 7-day price forecasts with model-level breakdown.',
        accent: 'from-blue-500 to-indigo-600',
        glow: 'shadow-blue-500/20',
    },
    {
        icon: BarChart3,
        title: 'Professional Backtesting',
        desc: 'Rolling-window evaluation with 40+ performance metrics — Sharpe ratio, Sortino, max drawdown, win rate, and risk-adjusted returns.',
        accent: 'from-purple-500 to-violet-600',
        glow: 'shadow-purple-500/20',
    },
    {
        icon: Briefcase,
        title: 'Paper Trading',
        desc: 'Practice with $100,000 in virtual capital. Execute trades, track open positions, and measure performance — entirely risk-free.',
        accent: 'from-emerald-500 to-green-600',
        glow: 'shadow-emerald-500/20',
    },
    {
        icon: SlidersHorizontal,
        title: 'Live Stock Screener',
        desc: "Browse today's top gainers, losers, and most-active tickers in a real-time sortable table. Click any row to deep-dive instantly.",
        accent: 'from-orange-500 to-amber-600',
        glow: 'shadow-orange-500/20',
    },
    {
        icon: Building2,
        title: 'Deep Fundamentals & SEC Filings',
        desc: 'Multi-year income statements, balance sheets, cash flows, and direct links to 10-K / 10-Q / 8-K EDGAR filings.',
        accent: 'from-indigo-500 to-blue-600',
        glow: 'shadow-indigo-500/20',
    },
    {
        icon: Globe,
        title: 'Macro Dashboard',
        desc: 'Track unemployment (URATE), CPI, industrial production, and 10-Year Treasury yields with 24-month sparkline trend charts.',
        accent: 'from-cyan-500 to-teal-600',
        glow: 'shadow-cyan-500/20',
    },
];

// ── Stats ─────────────────────────────────────────────────────────────────────
const STATS = [
    { value: '3',    label: 'ML Models',     sub: 'Random Forest · XGBoost · Linear' },
    { value: '40+',  label: 'Perf. Metrics', sub: 'Sharpe · Sortino · Max Drawdown' },
    { value: '6',    label: 'Asset Classes', sub: 'Stocks · Forex · Crypto · More' },
    { value: '$100k',label: 'Paper Capital', sub: 'Risk-free trading sandbox' },
];

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
    {
        num: '01',
        icon: Search,
        title: 'Search Any Asset',
        body: 'Enter a ticker to instantly surface price data, company overview, analyst ratings, key metrics, and recent news.',
    },
    {
        num: '02',
        icon: Brain,
        title: 'Analyze the AI Forecast',
        body: 'See a 7-day directional prediction with per-model breakdown, confidence intervals, and full backtesting results.',
    },
    {
        num: '03',
        icon: Briefcase,
        title: 'Trade Risk-Free',
        body: 'Place paper trades to test your thesis. Track your portfolio P&L with professional performance analytics.',
    },
];

// ── Animated mini chart SVG ───────────────────────────────────────────────────
function MiniChart({ color = '#3b82f6', className = '' }) {
    const pts = [40,60,45,65,50,40,55,30,45,50,35,55,25,45,30,20,35,15,25,20];
    const d = pts.reduce((acc, y, i) => {
        const x = (i / (pts.length - 1)) * 200;
        return acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`);
    }, '');
    return (
        <svg viewBox="0 0 200 80" className={className} preserveAspectRatio="none">
            <defs>
                <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={d + ' L200,80 L0,80 Z'} fill={`url(#grad-${color.replace('#','')})`} />
            <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Dashboard Preview ─────────────────────────────────────────────────────────
function DashboardPreview() {
    return (
        <div className="relative w-full max-w-2xl mx-auto">
            {/* Glow */}
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-3xl" />
            <div className="relative bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 border-b border-gray-700/60">
                    <span className="w-3 h-3 rounded-full bg-red-500/70" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                    <span className="ml-4 text-xs text-gray-500 font-mono">marketmind · dashboard</span>
                </div>

                <div className="p-5 space-y-4">
                    {/* Ticker row */}
                    <div className="grid grid-cols-5 gap-2">
                        {[
                            { label:'S&P 500', val:'$592.40', pct:'+0.84%', pos:true },
                            { label:'NASDAQ', val:'$513.21', pct:'+1.12%', pos:true },
                            { label:'Dow', val:'$430.15', pct:'+0.21%', pos:true },
                            { label:'Bitcoin', val:'$96,240', pct:'-1.04%', pos:false },
                            { label:'Gold', val:'$237.80', pct:'+0.38%', pos:true },
                        ].map(t => (
                            <div key={t.label} className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/40">
                                <p className="text-xs text-gray-500 mb-1">{t.label}</p>
                                <p className="text-sm font-bold text-white">{t.val}</p>
                                <p className={`text-xs font-medium ${t.pos ? 'text-emerald-400' : 'text-red-400'}`}>{t.pct}</p>
                            </div>
                        ))}
                    </div>

                    {/* Chart area */}
                    <div className="bg-gray-800/60 rounded-xl border border-gray-700/40 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-sm font-bold text-white">AAPL</span>
                                <span className="ml-2 text-xs text-gray-400">Apple Inc.</span>
                            </div>
                            <span className="text-xs font-semibold text-emerald-400">+2.34%  $189.32</span>
                        </div>
                        <MiniChart color="#3b82f6" className="w-full h-20" />
                    </div>

                    {/* Bottom row */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* AI Prediction card */}
                        <div className="bg-gray-800/60 rounded-xl border border-blue-500/20 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-xs text-gray-400">AI Forecast · 7d</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-xl font-bold text-white">$194.80</span>
                                <span className="text-sm font-medium text-emerald-400 mb-0.5">↑ +2.9%</span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1">
                                {['RF','XGB','LR'].map((m, i) => (
                                    <div key={m} className="text-center">
                                        <div className="text-xs text-gray-500">{m}</div>
                                        <div className={`text-xs font-medium ${i < 2 ? 'text-emerald-400' : 'text-gray-300'}`}>
                                            {['$195.1','$194.4','$193.9'][i]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Portfolio card */}
                        <div className="bg-gray-800/60 rounded-xl border border-emerald-500/20 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs text-gray-400">Paper Portfolio</span>
                            </div>
                            <p className="text-xl font-bold text-white">$108,432</p>
                            <p className="text-sm font-medium text-emerald-400 mt-0.5">+$8,432 P&L</p>
                            <div className="mt-2">
                                <MiniChart color="#10b981" className="w-full h-8" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
const LandingPage = ({ onEnterApp }) => {
    const { isDarkMode, toggleDarkMode } = useDarkMode();

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white overflow-x-hidden">

            {/* ── Navbar ─────────────────────────────────────────────── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-800/60">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <img
                        src={isDarkMode ? 'marketmindtransparentdark.png' : 'marketmindtransparent.png'}
                        alt="MarketMind"
                        className="h-8 w-auto object-contain"
                    />
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => scrollTo('features')}
                            className="hidden md:block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Features
                        </button>
                        <button
                            onClick={() => scrollTo('how-it-works')}
                            className="hidden md:block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            How it works
                        </button>
                        <button
                            onClick={toggleDarkMode}
                            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Toggle dark mode"
                        >
                            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onEnterApp}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors active:scale-95"
                        >
                            Launch App
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── Ticker strip ───────────────────────────────────────── */}
            <div className="fixed top-14 left-0 right-0 z-40">
                <TickerStrip />
            </div>

            {/* ── Hero ───────────────────────────────────────────────── */}
            <section className="relative pt-32 pb-24 px-6 overflow-hidden">
                {/* Background gradients */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute top-40 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
                    <div className="absolute -top-20 left-1/2 w-px h-64 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />
                </div>

                <div className="relative max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left: copy */}
                        <div className="animate-fade-in">
                            {/* Badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 mb-6">
                                <Zap className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wide uppercase">
                                    AI-Powered Market Intelligence
                                </span>
                            </div>

                            <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                                Predict.{' '}
                                <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                                    Trade.
                                </span>{' '}
                                Profit.
                            </h1>

                            <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed mb-8 max-w-lg">
                                MarketMind combines ensemble machine learning, live market data, and professional analytics
                                into a single platform for smarter investment decisions.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={onEnterApp}
                                    className="group flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/25"
                                >
                                    Launch App
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button
                                    onClick={() => scrollTo('features')}
                                    className="flex items-center justify-center gap-2 px-7 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors"
                                >
                                    Explore Features
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Trust signals */}
                            <div className="mt-10 flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1.5">
                                    <Shield className="w-4 h-4 text-emerald-500" />
                                    <span>Risk-free paper trading</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Activity className="w-4 h-4 text-blue-500" />
                                    <span>Live market data</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: dashboard preview */}
                        <div className="animate-fade-in lg:order-last">
                            <DashboardPreview />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats bar ──────────────────────────────────────────── */}
            <section className="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 py-10 px-6">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    {STATS.map(({ value, label, sub }) => (
                        <div key={label} className="text-center">
                            <p className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">{value}</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ───────────────────────────────────────────── */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">
                            Everything You Need
                        </p>
                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
                            Built for serious investors
                        </h2>
                        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                            From AI price predictions to SEC filings — all the tools a professional analyst uses,
                            packaged into a clean, fast interface.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map(({ icon: Icon, title, desc, accent, glow }) => (
                            <div
                                key={title}
                                className={`group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:shadow-xl ${glow} hover:-translate-y-1 transition-all duration-300`}
                            >
                                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${accent} mb-4`}>
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works ───────────────────────────────────────── */}
            <section id="how-it-works" className="py-24 px-6 bg-gray-50 dark:bg-gray-900/50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">
                            Simple Workflow
                        </p>
                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">
                            Up and running in 3 steps
                        </h2>
                    </div>

                    <div className="relative">
                        {/* Connector line */}
                        <div className="absolute top-10 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent hidden md:block" />

                        <div className="grid md:grid-cols-3 gap-10">
                            {STEPS.map(({ num, icon: Icon, title, body }) => (
                                <div key={num} className="relative text-center">
                                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white dark:bg-gray-900 border-2 border-blue-100 dark:border-blue-900/60 shadow-sm mb-5 relative">
                                        <Icon className="w-8 h-8 text-blue-500" />
                                        <span className="absolute -top-2.5 -right-2.5 text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-full w-6 h-6 flex items-center justify-center">
                                            {num.replace('0', '')}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Asset classes ───────────────────────────────────────── */}
            <section className="py-20 px-6 border-y border-gray-200 dark:border-gray-800">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
                        6 asset classes, one platform
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10">
                        Stocks, Forex, Crypto, Commodities, Macro indicators, and Prediction markets — all connected.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        {[
                            { icon: BarChart3, label: 'Equities', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                            { icon: DollarSign, label: 'Forex', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
                            { icon: Bitcoin, label: 'Crypto', color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
                            { icon: Target, label: 'Commodities', color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
                            { icon: Globe, label: 'Macro', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800' },
                            { icon: Activity, label: 'Options', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
                        ].map(({ icon: Icon, label, color }) => (
                            <div
                                key={label}
                                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-semibold ${color}`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────────── */}
            <section className="py-24 px-6 text-center">
                <div className="max-w-2xl mx-auto">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/5 rounded-3xl blur-2xl" />
                        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-12 shadow-2xl shadow-blue-500/25">
                            <h2 className="text-4xl font-extrabold text-white mb-4">
                                Start trading smarter today.
                            </h2>
                            <p className="text-blue-100 mb-8 text-lg">
                                Free to use. No account required. Launch the full platform and start exploring.
                            </p>
                            <button
                                onClick={onEnterApp}
                                className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-colors active:scale-95 shadow-lg"
                            >
                                Launch MarketMind
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────────── */}
            <footer className="border-t border-gray-200 dark:border-gray-800 py-8 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <img
                        src={isDarkMode ? 'marketmindtransparentdark.png' : 'marketmindtransparent.png'}
                        alt="MarketMind"
                        className="h-7 w-auto object-contain opacity-70"
                    />
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                        Built with React · Flask · OpenBB · yfinance · Tailwind CSS
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600">
                        For educational use only. Not financial advice.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
