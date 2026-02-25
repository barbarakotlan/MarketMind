import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../context/DarkModeContext';
import {
    BarChart3, Search, Briefcase,
    Building2, Globe, SlidersHorizontal, Brain, ArrowRight,
    Target, Activity, Sun, Moon, ChevronDown, Zap, Shield,
    DollarSign, Bitcoin,
} from 'lucide-react';

// ── Animation variants ────────────────────────────────────────────────────────
const blurUp = {
    hidden: { opacity: 0, filter: 'blur(10px)', y: 18 },
    show: {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

const blurIn = {
    hidden: { opacity: 0, filter: 'blur(12px)', scale: 0.97 },
    show: {
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

const stagger = (delay = 0.08) => ({
    hidden: {},
    show: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

const viewportOnce = { once: true, margin: '-60px' };

// ── Marquee ticker ────────────────────────────────────────────────────────────
const STOCK_TICKERS = [
    { ticker: 'SPY',     label: 'S&P 500' },
    { ticker: 'QQQ',     label: 'NASDAQ' },
    { ticker: 'DIA',     label: 'Dow Jones' },
    { ticker: 'AAPL',    label: 'AAPL' },
    { ticker: 'MSFT',    label: 'MSFT' },
    { ticker: 'NVDA',    label: 'NVDA' },
    { ticker: 'TSLA',    label: 'TSLA' },
    { ticker: 'GOOGL',   label: 'GOOGL' },
    { ticker: 'AMZN',    label: 'AMZN' },
    { ticker: 'BTC-USD', label: 'BTC' },
    { ticker: 'ETH-USD', label: 'ETH' },
    { ticker: 'GLD',     label: 'Gold' },
];

function MarqueeTicker() {
    const [stocks, setStocks] = useState([]);
    const [news,   setNews]   = useState([]);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        // Mock stock data
        const mockStocks = [
            { type: 'stock', label: 'S&P 500', price: 452.38, change: 0.72 },
            { type: 'stock', label: 'NASDAQ', price: 398.42, change: 1.24 },
            { type: 'stock', label: 'Dow Jones', price: 389.15, change: -0.34 },
            { type: 'stock', label: 'AAPL', price: 182.52, change: 1.45 },
            { type: 'stock', label: 'MSFT', price: 415.26, change: 0.89 },
            { type: 'stock', label: 'NVDA', price: 875.28, change: 2.34 },
            { type: 'stock', label: 'TSLA', price: 175.34, change: -1.23 },
            { type: 'stock', label: 'GOOGL', price: 141.80, change: 0.56 },
            { type: 'stock', label: 'AMZN', price: 178.25, change: 0.91 },
            { type: 'stock', label: 'BTC', price: 51234.67, change: 3.45 },
            { type: 'stock', label: 'ETH', price: 2987.43, change: 2.12 },
            { type: 'stock', label: 'Gold', price: 2034.80, change: -0.15 },
        ];
        
        // Mock news headlines
        const mockNews = [
            { type: 'news', text: 'Fed signals potential rate cuts in coming months', source: 'Reuters' },
            { type: 'news', text: 'Tech stocks rally on strong AI earnings', source: 'Bloomberg' },
            { type: 'news', text: 'Oil prices stabilize amid Middle East tensions', source: 'CNBC' },
        ];
        
        setStocks(mockStocks);
        setNews(mockNews);
    }, []);

    // Interleave news into stock items then duplicate for seamless loop
    const combined = useMemo(() => {
        if (stocks.length === 0) return [];
        if (news.length === 0) return stocks;
        const out = [];
        const step = Math.max(2, Math.floor(stocks.length / (news.length + 1)));
        let ni = 0;
        stocks.forEach((s, i) => {
            out.push(s);
            if ((i + 1) % step === 0 && ni < news.length) {
                out.push(news[ni++]);
            }
        });
        return out;
    }, [stocks, news]);

    const looped = useMemo(() => [...combined, ...combined], [combined]);

    if (combined.length === 0) {
        // Loading skeleton
        return (
            <div className="bg-gray-900/90 border-b border-gray-700/50 h-10 flex items-center px-6 gap-8">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex gap-2 items-center flex-shrink-0">
                        <div className="h-3 w-12 bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-14 bg-gray-700 rounded animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    const duration = combined.length * 3.5; // seconds — 3.5s per item

    return (
        <div
            className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-700/50 overflow-hidden relative select-none"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* LIVE badge — fixed left */}
            <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-2 pl-3 pr-4 bg-gray-900 border-r border-gray-700/60">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Live</span>
            </div>

            {/* Scrolling strip */}
            <div className="overflow-hidden ml-[72px]">
                <div
                    className="flex items-stretch whitespace-nowrap"
                    style={{
                        animation: `marquee ${duration}s linear infinite`,
                        animationPlayState: paused ? 'paused' : 'running',
                        willChange: 'transform',
                    }}
                >
                    {looped.map((item, i) =>
                        item.type === 'stock' ? (
                            <div
                                key={i}
                                className="inline-flex items-center gap-2.5 px-5 py-2.5 border-r border-gray-700/40 flex-shrink-0"
                            >
                                <span className="text-xs font-bold text-white">{item.label}</span>
                                <span className="text-xs text-gray-400">
                                    ${typeof item.price === 'number' ? item.price.toFixed(2) : '—'}
                                </span>
                                <span className={`text-xs font-semibold ${item.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {item.change > 0 ? '▲' : '▼'} {Math.abs(item.change ?? 0).toFixed(2)}%
                                </span>
                            </div>
                        ) : (
                            <div
                                key={i}
                                className="inline-flex items-center gap-2 px-5 py-2.5 border-r border-gray-700/40 flex-shrink-0 max-w-xs"
                            >
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex-shrink-0">
                                    News
                                </span>
                                <span className="text-xs text-gray-300 truncate">{item.text}</span>
                                {item.source && (
                                    <span className="text-xs text-gray-600 flex-shrink-0">— {item.source}</span>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
    {
        icon: Brain, title: 'AI-Powered Predictions',
        desc: 'Ensemble ML model combining Random Forest, XGBoost, and Linear Regression for 7-day price forecasts with model-level breakdown.',
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
    { value: '3',    label: 'ML Models',     sub: 'Random Forest · XGBoost · Linear' },
    { value: '40+',  label: 'Perf. Metrics', sub: 'Sharpe · Sortino · Max Drawdown' },
    { value: '6',    label: 'Asset Classes', sub: 'Stocks · Forex · Crypto · More' },
    { value: '$100k',label: 'Paper Capital', sub: 'Risk-free trading sandbox' },
];

const STEPS = [
    {
        num: '1',
        icon: Search,
        title: 'Search Any Asset',
        terminal: [
            { text: 'marketmind search AAPL', prefix: '$', color: 'text-gray-300' },
            { text: 'connecting to data feeds...', color: 'text-gray-500', dim: true, think: 200 },
            { text: '[OK] price data received (14ms)', color: 'text-emerald-400' },
            { text: '[OK] fundamentals loaded', color: 'text-emerald-400' },
            { text: '[OK] 24 recent news articles', color: 'text-emerald-400' },
            { text: '┌─ AAPL ─ Apple Inc. ─────┐', color: 'text-blue-400' },
            { text: '│ Price: $182.52 ▲ 1.24%  │', color: 'text-gray-300' },
            { text: '│ Market Cap: $2.84T      │', color: 'text-gray-300' },
            { text: '│ P/E: 28.4 | EPS: $6.43  │', color: 'text-gray-300' },
            { text: '└─────────────────────────┘', color: 'text-blue-400' },
        ],
        body: 'Enter a ticker to instantly surface price data, company overview, analyst ratings, key metrics, and recent news.'
    },
    {
        num: '2',
        icon: Brain,
        title: 'Analyze the AI Forecast',
        terminal: [
            { text: 'marketmind predict AAPL --days 7', prefix: '$', color: 'text-gray-300' },
            { text: 'loading ensemble models...', color: 'text-gray-500', dim: true, think: 150 },
            { text: '▶ Random Forest ...........', color: 'text-purple-400', think: 300 },
            { text: '  accuracy: 87.3% ✓', color: 'text-gray-400' },
            { text: '▶ XGBoost .................', color: 'text-purple-400', think: 250 },
            { text: '  accuracy: 89.1% ✓', color: 'text-gray-400' },
            { text: '▶ Linear Regression .......', color: 'text-purple-400', think: 200 },
            { text: '  accuracy: 82.7% ✓', color: 'text-gray-400' },
            { text: '', color: 'text-gray-400' },
            { text: '╔═ 7-DAY FORECAST ═════════╗', color: 'text-emerald-500' },
            { text: '║  Direction: BULLISH ▲    ║', color: 'text-emerald-400' },
            { text: '║  Confidence: 84.2%       ║', color: 'text-emerald-400' },
            { text: '║  Target: $190.12 (+4.2%) ║', color: 'text-emerald-400' },
            { text: '╚══════════════════════════╝', color: 'text-emerald-500' },
        ],
        body: 'See a 7-day directional prediction with per-model breakdown, confidence intervals, and full backtesting results.'
    },
    {
        num: '3',
        icon: Briefcase,
        title: 'Trade Risk-Free',
        terminal: [
            { text: 'marketmind trade buy AAPL 100', prefix: '$', color: 'text-gray-300' },
            { text: 'paper trading account: $100,000.00', color: 'text-gray-500', dim: true },
            { text: 'validating order...', color: 'text-gray-500', dim: true, think: 150 },
            { text: '[OK] Order filled @ $182.50', color: 'text-emerald-400' },
            { text: '[OK] 100 shares added to portfolio', color: 'text-emerald-400' },
            { text: ' ', color: 'text-gray-400' },
            { text: '┌─ PORTFOLIO UPDATE ──────┐', color: 'text-blue-400' },
            { text: '│ Position: AAPL x100     │', color: 'text-gray-300' },
            { text: '│ Avg Cost: $182.50       │', color: 'text-gray-300' },
            { text: '│ Market Value: $18,252   │', color: 'text-gray-300' },
            { text: '│ Day P&L: +$124.00 ▲     │', color: 'text-emerald-400' },
            { text: '│ Total P&L: +$1,247.00 ▲ │', color: 'text-emerald-400' },
            { text: '└─────────────────────────┘', color: 'text-blue-400' },
        ],
        body: 'Place paper trades to test your thesis. Track your portfolio P&L with professional performance analytics.'
    },
];

// ── Step terminals with orchestrated typing ──────────────────────────────────
function StepTerminals() {
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        // Start sequence when component enters viewport
        const timer = setTimeout(() => {
            setHasStarted(true);
            setActiveStep(0);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleStepComplete = (stepIndex) => {
        setCompletedSteps(prev => new Set([...prev, stepIndex]));
        if (stepIndex < STEPS.length - 1) {
            setTimeout(() => {
                setActiveStep(stepIndex + 1);
            }, 300);
        }
    };

    const handleReset = () => {
        setCompletedSteps(new Set());
        setActiveStep(0);
        setTimeout(() => setActiveStep(0), 50);
    };

    return (
        <div className="relative">
            <div className="grid md:grid-cols-3 gap-6 relative">
                {STEPS.map(({ num, icon: Icon, title, terminal, body }, index) => {
                    const isActive = activeStep === index;
                    const isCompleted = completedSteps.has(index);
                    const showTerminal = isActive || isCompleted;

                    return (
                        <motion.div
                            key={num}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.15, type: 'spring', stiffness: 100 }}
                            className="relative"
                        >
                            {/* Step indicator with pulse */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
                                    isCompleted
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : isActive
                                            ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400'
                                }`}>
                                    {isActive && (
                                        <span className="absolute inset-0 rounded-xl bg-blue-500 animate-ping opacity-20" />
                                    )}
                                    {isCompleted ? (
                                        <motion.span 
                                            initial={{ scale: 0 }} 
                                            animate={{ scale: 1 }} 
                                            className="text-lg"
                                        >
                                            ✓
                                        </motion.span>
                                    ) : (
                                        <Icon className="w-5 h-5" />
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs font-mono text-gray-500">step_{num}.sh</span>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
                                </div>
                            </div>

                            {/* Terminal window with CRT effect */}
                            <div className={`relative bg-gray-950 rounded-xl overflow-hidden border transition-all duration-500 ${
                                isActive
                                    ? 'border-blue-500/60 shadow-2xl shadow-blue-500/20 scale-[1.02]'
                                    : isCompleted
                                        ? 'border-emerald-500/40 shadow-lg'
                                        : 'border-gray-800/60 opacity-80'
                            }`}>
                                {/* CRT scanlines overlay */}
                                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                                    style={{
                                        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
                                    }}
                                />
                                
                                {/* Subtle glow when active */}
                                {isActive && (
                                    <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />
                                )}

                                {/* Terminal header */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
                                    <div className="flex gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/90" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/90" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90" />
                                    </div>
                                    <span className="text-[10px] text-gray-600 font-mono ml-2 truncate">
                                        user@marketmind:~/{num === '1' ? 'search' : num === '2' ? 'predict' : 'trade'}
                                    </span>
                                </div>

                                {/* Terminal content */}
                                <div className="p-4 h-40 overflow-hidden relative">
                                    {hasStarted && showTerminal ? (
                                        <TerminalTyper
                                            lines={terminal}
                                            isActive={isActive}
                                            onComplete={() => handleStepComplete(index)}
                                        />
                                    ) : (
                                        <div className="text-gray-700 font-mono text-xs flex items-center h-full justify-center">
                                            <span className="animate-pulse">_</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed"
                            >
                                {body}
                            </motion.p>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Terminal typewriter component with binary decode for output only ─────────
function TerminalTyper({ lines, isActive, onComplete }) {
    const [completedLines, setCompletedLines] = useState([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [currentChar, setCurrentChar] = useState(0);
    const [decodedText, setDecodedText] = useState('');
    const [mode, setMode] = useState('idle'); // 'idle' | 'typing' | 'thinking' | 'decoding' | 'done'
    const [showCursor, setShowCursor] = useState(true);
    const [autoScrollY, setAutoScrollY] = useState(0);
    const scrollRef = useRef(null);
    const processingRef = useRef(false);

    const binaryChars = ['0', '1', '░', '▒', '▓'];

    // Auto-scroll to follow content
    useEffect(() => {
        if (scrollRef.current && mode !== 'done') {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [completedLines, currentChar, decodedText, mode]);

    // Autoscroll up/down after completion
    useEffect(() => {
        if (mode !== 'done' || !scrollRef.current) return;
        
        const container = scrollRef.current;
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 0) return;

        let direction = 1;
        let scrollPos = maxScroll;
        
        const autoScroll = setInterval(() => {
            scrollPos += direction * 0.5;
            if (scrollPos >= maxScroll) {
                scrollPos = maxScroll;
                direction = -1;
            } else if (scrollPos <= 0) {
                scrollPos = 0;
                direction = 1;
            }
            container.scrollTop = scrollPos;
        }, 50);

        return () => clearInterval(autoScroll);
    }, [mode]);

    // Start animation when active
    useEffect(() => {
        if (!isActive || mode !== 'idle' || completedLines.length > 0) return;
        
        const startTimer = setTimeout(() => {
            const firstLine = lines[0];
            processingRef.current = false;
            if (firstLine.prefix) {
                setMode('typing');
            } else {
                setMode('decoding');
            }
        }, 150);
        
        return () => clearTimeout(startTimer);
    }, [isActive, mode, completedLines.length, lines]);

    // Handle typing mode
    useEffect(() => {
        if (mode !== 'typing' || currentLineIndex >= lines.length || processingRef.current) return;

        const line = lines[currentLineIndex];
        
        if (currentChar < line.text.length) {
            const timer = setTimeout(() => {
                setCurrentChar(prev => prev + 1);
            }, 12);
            return () => clearTimeout(timer);
        } else {
            // Finished typing this command
            processingRef.current = true;
            setCompletedLines(prev => [...prev, { ...line, displayText: line.text }]);
            setCurrentChar(0);
            
            const nextLine = lines[currentLineIndex + 1];
            if (!nextLine) {
                setMode('done');
                onComplete?.();
                return;
            }
            
            setCurrentLineIndex(prev => prev + 1);
            processingRef.current = false;
            
            if (nextLine.think) {
                setMode('thinking');
                setTimeout(() => {
                    setMode('decoding');
                }, nextLine.think);
            } else {
                setMode('decoding');
            }
        }
    }, [mode, currentChar, currentLineIndex, lines, onComplete]);

    // Handle decoding mode
    useEffect(() => {
        if (mode !== 'decoding' || currentLineIndex >= lines.length || processingRef.current) return;

        processingRef.current = true;
        const line = lines[currentLineIndex];
        
        // Skip empty lines
        if (!line.text || line.text.trim() === '') {
            setCompletedLines(prev => [...prev, { ...line, displayText: ' ' }]);
            setDecodedText('');
            processingRef.current = false;
            
            const nextLine = lines[currentLineIndex + 1];
            if (!nextLine) {
                setMode('done');
                onComplete?.();
                return;
            }
            
            setCurrentLineIndex(prev => prev + 1);
            
            if (nextLine.prefix) {
                setMode('typing');
            } else if (nextLine.think) {
                setMode('thinking');
                setTimeout(() => setMode('decoding'), nextLine.think);
            } else {
                setMode('decoding');
            }
            return;
        }

        const text = line.text;
        const chars = text.split('');
        
        let fillIndex = 0;
        let decodeIndex = 0;
        let isCancelled = false;
        
        // Phase 1: Fill with binary
        const fillInterval = setInterval(() => {
            if (isCancelled) return;
            
            if (fillIndex > chars.length) {
                clearInterval(fillInterval);
                // Phase 2: Decode to text
                const decodeInterval = setInterval(() => {
                    if (isCancelled) {
                        clearInterval(decodeInterval);
                        return;
                    }
                    
                    if (decodeIndex > chars.length) {
                        clearInterval(decodeInterval);
                        // Line complete
                        setCompletedLines(prev => [...prev, { ...line, displayText: text }]);
                        setDecodedText('');
                        processingRef.current = false;
                        
                        const nextLine = lines[currentLineIndex + 1];
                        if (!nextLine) {
                            setMode('done');
                            onComplete?.();
                            return;
                        }
                        
                        setCurrentLineIndex(prev => prev + 1);
                        
                        if (nextLine.prefix) {
                            setMode('typing');
                        } else if (nextLine.think) {
                            setMode('thinking');
                            setTimeout(() => setMode('decoding'), nextLine.think);
                        } else {
                            setMode('decoding');
                        }
                        return;
                    }
                    
                    const partial = chars.map((char, i) => 
                        i < decodeIndex ? char : binaryChars[Math.floor(Math.random() * binaryChars.length)]
                    ).join('');
                    setDecodedText(partial);
                    decodeIndex++;
                }, 4);
                return;
            }
            
            const binary = chars.map((_, i) => 
                i < fillIndex ? binaryChars[Math.floor(Math.random() * binaryChars.length)] : ''
            ).join('');
            setDecodedText(binary);
            fillIndex++;
        }, 3);

        return () => {
            isCancelled = true;
            clearInterval(fillInterval);
        };
    }, [mode, currentLineIndex, lines, onComplete]);

    // Cursor blink
    useEffect(() => {
        const cursorInterval = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 600);
        return () => clearInterval(cursorInterval);
    }, []);

    const currentLine = lines[currentLineIndex];
    const isTyping = mode === 'typing';
    const isDecoding = mode === 'decoding';

    return (
        <div ref={scrollRef} className="font-mono text-[11px] leading-5 h-full overflow-y-auto scrollbar-hide">
            {/* Completed lines */}
            {completedLines.map((line, i) => (
                <div key={i} className={`${line.color} ${line.dim ? 'opacity-60' : ''}`}>
                    {line.prefix && <span className="text-gray-600 mr-2">{line.prefix}</span>}
                    {line.displayText || line.text}
                </div>
            ))}
            
            {/* Current line being processed */}
            {currentLineIndex < lines.length && isActive && mode !== 'done' && (
                <div className={currentLine?.color}>
                    {currentLine?.prefix && (
                        <span className="text-gray-600 mr-2">{currentLine.prefix}</span>
                    )}
                    
                    {isTyping ? (
                        <>
                            {currentLine.text.slice(0, currentChar)}
                            <span 
                                className={`inline-block w-2 h-4 ml-0.5 align-middle transition-opacity duration-100 ${
                                    showCursor ? 'bg-emerald-500' : 'bg-transparent'
                                }`}
                            />
                        </>
                    ) : isDecoding ? (
                        <>
                            {decodedText}
                            <span 
                                className={`inline-block w-2 h-4 ml-0.5 align-middle transition-opacity duration-100 ${
                                    showCursor ? 'bg-emerald-500' : 'bg-transparent'
                                }`}
                            />
                        </>
                    ) : mode === 'thinking' ? (
                        <span className="inline-flex gap-0.5 ml-1">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                    ) : null}
                </div>
            )}
        </div>
    );
}

// ── Animated mini chart SVG ───────────────────────────────────────────────────
function MiniChart({ color = '#3b82f6', className = '' }) {
    const pts = [40,60,45,65,50,40,55,30,45,50,35,55,25,45,30,20,35,15,25,20];
    const d = pts.reduce((acc, y, i) => {
        const x = (i / (pts.length - 1)) * 200;
        return acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`);
    }, '');
    const id = `g${color.replace('#', '')}`;
    return (
        <svg viewBox="0 0 200 80" className={className} preserveAspectRatio="none">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={`${d} L200,80 L0,80 Z`} fill={`url(#${id})`} />
            <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Dashboard preview ─────────────────────────────────────────────────────────
function DashboardPreview() {
    return (
        <motion.div
            variants={blurIn}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.35 }}
            className="relative w-full max-w-2xl mx-auto"
        >
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
                            { label:'S&P 500', val:'$592.40', pct:'+0.84%', pos:true  },
                            { label:'NASDAQ',  val:'$513.21', pct:'+1.12%', pos:true  },
                            { label:'Dow',     val:'$430.15', pct:'+0.21%', pos:true  },
                            { label:'Bitcoin', val:'$96,240', pct:'-1.04%', pos:false },
                            { label:'Gold',    val:'$237.80', pct:'+0.38%', pos:true  },
                        ].map(t => (
                            <div key={t.label} className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/40">
                                <p className="text-xs text-gray-500 mb-1">{t.label}</p>
                                <p className="text-sm font-bold text-white">{t.val}</p>
                                <p className={`text-xs font-medium ${t.pos ? 'text-emerald-400' : 'text-red-400'}`}>{t.pct}</p>
                            </div>
                        ))}
                    </div>
                    {/* Chart */}
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
                    {/* Bottom cards */}
                    <div className="grid grid-cols-2 gap-3">
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
                        <div className="bg-gray-800/60 rounded-xl border border-emerald-500/20 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs text-gray-400">Paper Portfolio</span>
                            </div>
                            <p className="text-xl font-bold text-white">$108,432</p>
                            <p className="text-sm font-medium text-emerald-400 mt-0.5">+$8,432 P&L</p>
                            <MiniChart color="#10b981" className="w-full h-8 mt-2" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

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
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

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
                            className="hidden md:block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            Features
                        </button>
                        <button onClick={() => scrollTo('how-it-works')}
                            className="hidden md:block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            How it works
                        </button>
                        <button onClick={toggleDarkMode}
                            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Toggle dark mode">
                            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <button onClick={onEnterApp}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors active:scale-95">
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
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 mb-6">
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
                                className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed mb-8 max-w-lg">
                                MarketMind combines ensemble machine learning, live market data, and professional analytics
                                into a single platform for smarter investment decisions.
                            </motion.p>

                            <motion.div variants={blurUp} className="flex flex-col sm:flex-row gap-3">
                                <button onClick={onEnterApp}
                                    className="group flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/25">
                                    Launch App
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button onClick={() => scrollTo('features')}
                                    className="flex items-center justify-center gap-2 px-7 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors">
                                    Explore Features
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </motion.div>

                            <motion.div variants={blurUp} className="mt-10 flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
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
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
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
                            className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
                            Built for serious investors
                        </motion.h2>
                        <motion.p variants={blurUp}
                            className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
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
                                className={`group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:shadow-xl ${glow} hover:-translate-y-1 transition-all duration-300 cursor-default`}
                            >
                                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${accent} mb-4`}>
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
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
                            className="text-4xl font-extrabold text-gray-900 dark:text-white">
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
                            className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
                            6 asset classes, one platform
                        </motion.h2>
                        <motion.p variants={blurUp}
                            className="text-gray-500 dark:text-gray-400 mb-10">
                            Stocks, Forex, Crypto, Commodities, Macro indicators, and Options — all connected.
                        </motion.p>
                        <motion.div variants={stagger(0.06)} className="flex flex-wrap justify-center gap-3">
                            {[
                                { icon: BarChart3,       label: 'Equities',    color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                                { icon: DollarSign,      label: 'Forex',       color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
                                { icon: Bitcoin,         label: 'Crypto',      color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
                                { icon: Target,          label: 'Commodities', color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
                                { icon: Globe,           label: 'Macro',       color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800' },
                                { icon: Activity,        label: 'Options',     color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
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
                                Free to use. No account required. Launch the full platform and start exploring.
                            </p>
                            <button onClick={onEnterApp}
                                className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-colors active:scale-95 shadow-lg">
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
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        © {new Date().getFullYear()} MarketMind. All rights reserved.
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
