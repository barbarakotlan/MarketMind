import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BarChart3, Search, TrendingUp, TrendingDown, RefreshCw,
    RotateCcw, Loader2, AlertTriangle, CheckCircle, XCircle,
    ChevronDown, ChevronUp, DollarSign, Clock, Star, Pause, Play,
    ArrowUpDown, Filter, Award, Percent, Activity
} from 'lucide-react';
import PredictionPortfolioChart from './charts/PredictionPortfolioChart';

const API_BASE = 'http://127.0.0.1:5001';

const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatPercent = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0.00%';
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
};

const formatProbability = (price) => `${(price * 100).toFixed(1)}%`;

// --- Category keywords for filtering ---
const CATEGORIES = {
    'Politics': ['election', 'president', 'congress', 'senate', 'democrat', 'republican', 'vote', 'trump', 'biden', 'governor', 'mayor', 'political'],
    'Crypto': ['bitcoin', 'ethereum', 'crypto', 'btc', 'eth', 'solana', 'token', 'blockchain', 'defi'],
    'Sports': ['nba', 'nfl', 'mlb', 'soccer', 'football', 'championship', 'super bowl', 'world cup', 'tennis', 'ufc'],
    'Tech': ['ai', 'openai', 'google', 'apple', 'microsoft', 'tesla', 'spacex', 'meta', 'nvidia', 'semiconductor'],
    'Finance': ['fed', 'interest rate', 'inflation', 'gdp', 'stock', 'market', 's&p', 'recession', 'treasury'],
};

// --- Probability Bar ---
const ProbabilityBar = ({ outcomes, prices }) => {
    const colors = [
        'bg-green-500', 'bg-red-500', 'bg-blue-500',
        'bg-yellow-500', 'bg-purple-500'
    ];
    return (
        <div className="w-full">
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                {outcomes.map((outcome, i) => {
                    const p = prices[outcome] || 0;
                    return (
                        <div
                            key={outcome}
                            className={`${colors[i % colors.length]} transition-all duration-300`}
                            style={{ width: `${p * 100}%` }}
                        />
                    );
                })}
            </div>
            <div className="flex justify-between mt-1">
                {outcomes.map((outcome, i) => (
                    <span key={outcome} className="text-xs text-gray-500 dark:text-gray-400">
                        {outcome}: {formatProbability(prices[outcome] || 0)}
                    </span>
                ))}
            </div>
        </div>
    );
};

// --- Market Card ---
const MarketCard = ({ market, isExpanded, onToggle, onTradeComplete, exchange, isWatchlisted, onToggleWatchlist }) => {
    const [buyOutcome, setBuyOutcome] = useState(null);
    const [contracts, setContracts] = useState('');
    const [tradeLoading, setTradeLoading] = useState(false);
    const [tradeError, setTradeError] = useState('');
    const [tradeSuccess, setTradeSuccess] = useState('');

    const handleBuy = async (e) => {
        e.preventDefault();
        if (!buyOutcome || !contracts) return;
        setTradeLoading(true);
        setTradeError('');
        setTradeSuccess('');
        try {
            const res = await fetch(`${API_BASE}/prediction-markets/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: market.id,
                    outcome: buyOutcome,
                    contracts: parseFloat(contracts),
                    exchange: exchange,
                })
            });
            const data = await res.json();
            if (res.ok) {
                setTradeSuccess(data.message);
                setContracts('');
                setBuyOutcome(null);
                onTradeComplete();
            } else {
                setTradeError(data.error);
            }
        } catch {
            setTradeError('Failed to execute trade');
        } finally {
            setTradeLoading(false);
        }
    };

    const price = buyOutcome ? (market.prices[buyOutcome] || 0) : 0;
    const totalCost = price * (parseFloat(contracts) || 0);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
            {/* Header - always visible */}
            <div className="w-full p-5 text-left flex items-start gap-4">
                <button onClick={onToggle} className="flex-1 min-w-0 text-left">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">
                        {market.question}
                    </h3>
                    <div className="mt-3">
                        <ProbabilityBar outcomes={market.outcomes} prices={market.prices} />
                    </div>
                </button>
                <div className="text-right shrink-0 space-y-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(market); }}
                        className="block ml-auto mb-1"
                        title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                        <Star className={`w-4 h-4 transition-colors ${
                            isWatchlisted
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'
                        }`} />
                    </button>
                    {market.volume > 0 && (
                        <div className="text-xs text-gray-400">Vol: ${market.volume?.toLocaleString()}</div>
                    )}
                    {market.liquidity > 0 && (
                        <div className="text-xs text-gray-400">Liq: ${market.liquidity?.toLocaleString()}</div>
                    )}
                    <button onClick={onToggle}>
                        {isExpanded
                            ? <ChevronUp className="w-4 h-4 ml-auto text-gray-400" />
                            : <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
                        }
                    </button>
                </div>
            </div>

            {/* Expanded trade panel */}
            {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
                    {market.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                            {market.description.slice(0, 300)}{market.description.length > 300 ? '...' : ''}
                        </p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-400 mb-4">
                        {market.spread != null && <span>Spread: {(market.spread * 100).toFixed(1)}%</span>}
                        {market.close_time && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Closes: {new Date(market.close_time).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    {market.is_open && (
                        <form onSubmit={handleBuy}>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {market.outcomes.map(o => (
                                    <button key={o} type="button"
                                        onClick={() => setBuyOutcome(buyOutcome === o ? null : o)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                                            buyOutcome === o
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'
                                        }`}>
                                        {o} @ {formatProbability(market.prices[o] || 0)}
                                    </button>
                                ))}
                            </div>
                            {buyOutcome && (
                                <div className="flex items-end gap-3 mt-3">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">Contracts</label>
                                        <input type="number" min="1" step="1" value={contracts}
                                            onChange={e => setContracts(e.target.value)}
                                            placeholder="10" required
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
                                    </div>
                                    <div className="text-right min-w-[80px]">
                                        <p className="text-xs text-gray-400">Est. Cost</p>
                                        <p className="text-lg font-black text-gray-900 dark:text-white">{formatCurrency(totalCost)}</p>
                                    </div>
                                    <button type="submit" disabled={tradeLoading || !contracts}
                                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors">
                                        {tradeLoading
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : `Buy ${buyOutcome}`
                                        }
                                    </button>
                                </div>
                            )}
                            {tradeError && <p className="text-red-500 text-xs mt-2 font-medium">{tradeError}</p>}
                            {tradeSuccess && <p className="text-green-500 text-xs mt-2 font-medium">{tradeSuccess}</p>}
                        </form>
                    )}
                    {!market.is_open && (
                        <p className="text-xs text-yellow-500 font-medium">This market is closed for trading.</p>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Main Page ---
const PredictionMarketsPage = () => {
    const [markets, setMarkets] = useState([]);
    const [loadingMarkets, setLoadingMarkets] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [expandedMarketId, setExpandedMarketId] = useState(null);

    const [portfolio, setPortfolio] = useState(null);
    const [tradeHistory, setTradeHistory] = useState([]);
    const [loadingPortfolio, setLoadingPortfolio] = useState(true);

    const [activeTab, setActiveTab] = useState('markets');
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    // Enhancement 1: Exchange switcher
    const [exchange, setExchange] = useState('polymarket');
    const [exchanges, setExchanges] = useState([]);

    // Enhancement 2: Sorting
    const [sortBy, setSortBy] = useState('default');

    // Enhancement 3: Category filtering
    const [activeCategory, setActiveCategory] = useState(null);

    // Enhancement 5: Auto-refresh
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Enhancement 6: Performance stats
    const [stats, setStats] = useState(null);

    // Enhancement 7: Watchlist
    const [watchlistIds, setWatchlistIds] = useState(new Set());
    const [watchlistData, setWatchlistData] = useState([]);

    // --- Data fetching ---
    const fetchMarkets = useCallback(async (search = '') => {
        setLoadingMarkets(true);
        try {
            const params = new URLSearchParams({ exchange, limit: '50' });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/prediction-markets?${params}`);
            const data = await res.json();
            setMarkets(data.markets || []);
        } catch (err) {
            console.error('Error fetching markets:', err);
        } finally {
            setLoadingMarkets(false);
        }
    }, [exchange]);

    const fetchPortfolio = async () => {
        try {
            const res = await fetch(`${API_BASE}/prediction-markets/portfolio`);
            const data = await res.json();
            setPortfolio(data);
        } catch (err) {
            console.error('Error fetching prediction portfolio:', err);
        } finally {
            setLoadingPortfolio(false);
        }
    };

    const fetchTradeHistory = async () => {
        try {
            const res = await fetch(`${API_BASE}/prediction-markets/history`);
            const data = await res.json();
            setTradeHistory(data || []);
        } catch (err) {
            console.error('Error fetching prediction trade history:', err);
        }
    };

    const fetchExchanges = async () => {
        try {
            const res = await fetch(`${API_BASE}/prediction-markets/exchanges`);
            const data = await res.json();
            setExchanges(data || []);
        } catch (err) {
            console.error('Error fetching exchanges:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/prediction-markets/stats`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const fetchWatchlist = async () => {
        try {
            const res = await fetch(`${API_BASE}/prediction-markets/watchlist`);
            const data = await res.json();
            setWatchlistData(data || []);
            setWatchlistIds(new Set((data || []).map(w => w.market_id)));
        } catch (err) {
            console.error('Error fetching watchlist:', err);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Reset your prediction markets portfolio to $10,000?')) return;
        try {
            await fetch(`${API_BASE}/prediction-markets/reset`, { method: 'POST' });
            setStatusMessage({ type: 'success', text: 'Prediction portfolio reset successfully' });
            fetchPortfolio();
            fetchTradeHistory();
            fetchStats();
            fetchWatchlist();
        } catch {
            setStatusMessage({ type: 'error', text: 'Failed to reset portfolio' });
        }
    };

    const handleSellPosition = async (position) => {
        const numContracts = prompt(
            `Sell how many "${position.outcome}" contracts? (You have ${position.contracts})`
        );
        if (!numContracts) return;
        try {
            const res = await fetch(`${API_BASE}/prediction-markets/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: position.market_id,
                    outcome: position.outcome,
                    contracts: parseFloat(numContracts),
                    exchange: exchange,
                })
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMessage({ type: 'success', text: data.message });
                fetchPortfolio();
                fetchTradeHistory();
                fetchStats();
            } else {
                setStatusMessage({ type: 'error', text: data.error });
            }
        } catch {
            setStatusMessage({ type: 'error', text: 'Failed to execute sell' });
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveSearch(searchInput);
        fetchMarkets(searchInput);
    };

    const onTradeComplete = () => {
        fetchPortfolio();
        fetchTradeHistory();
        fetchStats();
    };

    const handleToggleWatchlist = async (market) => {
        const id = market.id;
        if (watchlistIds.has(id)) {
            try {
                await fetch(`${API_BASE}/prediction-markets/watchlist/${encodeURIComponent(id)}`, { method: 'DELETE' });
                setWatchlistIds(prev => { const s = new Set(prev); s.delete(id); return s; });
                setWatchlistData(prev => prev.filter(w => w.market_id !== id));
            } catch {
                setStatusMessage({ type: 'error', text: 'Failed to remove from watchlist' });
            }
        } else {
            try {
                await fetch(`${API_BASE}/prediction-markets/watchlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ market_id: id, question: market.question, exchange })
                });
                setWatchlistIds(prev => new Set(prev).add(id));
                setWatchlistData(prev => [...prev, { market_id: id, question: market.question, exchange }]);
            } catch {
                setStatusMessage({ type: 'error', text: 'Failed to add to watchlist' });
            }
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchMarkets();
        fetchPortfolio();
        fetchTradeHistory();
        fetchExchanges();
        fetchStats();
        fetchWatchlist();
    }, []);

    // Re-fetch markets when exchange changes
    useEffect(() => {
        fetchMarkets(activeSearch);
    }, [exchange]);

    // Enhancement 5: Auto-refresh
    useEffect(() => {
        if (!autoRefresh || activeTab !== 'markets') return;
        const interval = setInterval(() => {
            fetchMarkets(activeSearch);
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, activeTab, activeSearch, fetchMarkets]);

    // Enhancement 2 & 3: Filter + Sort markets
    const processedMarkets = useMemo(() => {
        let filtered = [...markets];

        // Category filter
        if (activeCategory && CATEGORIES[activeCategory]) {
            const keywords = CATEGORIES[activeCategory];
            filtered = filtered.filter(m => {
                const q = m.question.toLowerCase();
                return keywords.some(kw => q.includes(kw));
            });
        }

        // Sort
        if (sortBy === 'volume') {
            filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
        } else if (sortBy === 'liquidity') {
            filtered.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
        } else if (sortBy === 'closing_soon') {
            filtered.sort((a, b) => {
                if (!a.close_time) return 1;
                if (!b.close_time) return -1;
                return new Date(a.close_time) - new Date(b.close_time);
            });
        } else if (sortBy === 'newest') {
            filtered.sort((a, b) => {
                if (!a.close_time) return 1;
                if (!b.close_time) return -1;
                return new Date(b.close_time) - new Date(a.close_time);
            });
        }

        return filtered;
    }, [markets, activeCategory, sortBy]);

    // Watchlisted markets (for the watchlist tab)
    const watchlistedMarkets = useMemo(() => {
        return markets.filter(m => watchlistIds.has(m.id));
    }, [markets, watchlistIds]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                    <div>
                        <div className="inline-flex items-center p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl mb-3">
                            <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight mb-2">Prediction Markets</h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Trade on real-world event outcomes with $10,000 in virtual funds.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Auto-refresh toggle */}
                        <button onClick={() => setAutoRefresh(!autoRefresh)}
                            title={autoRefresh ? 'Pause auto-refresh' : 'Enable auto-refresh'}
                            className={`p-2.5 rounded-xl border transition-colors ${
                                autoRefresh
                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                            }`}>
                            {autoRefresh ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { fetchMarkets(activeSearch); fetchPortfolio(); fetchStats(); }}
                            title="Refresh"
                            className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={handleReset}
                            title="Reset portfolio"
                            className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Status Message */}
                {statusMessage.text && (
                    <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 ${
                        statusMessage.type === 'success'
                            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                    }`}>
                        {statusMessage.type === 'success'
                            ? <CheckCircle className="w-4 h-4 shrink-0" />
                            : <AlertTriangle className="w-4 h-4 shrink-0" />
                        }
                        <span className="font-bold text-sm flex-1">{statusMessage.text}</span>
                        <button onClick={() => setStatusMessage({ type: '', text: '' })}>
                            <XCircle className="w-5 h-5 opacity-40 hover:opacity-100 transition-opacity" />
                        </button>
                    </div>
                )}

                {/* Portfolio Summary Cards */}
                {portfolio && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                        <div className="bg-gradient-to-br from-purple-900 to-black rounded-3xl p-5 text-white shadow-lg">
                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-300 mb-1">Total Value</p>
                            <p className="text-2xl font-black">{formatCurrency(portfolio.total_value)}</p>
                            <span className={`text-xs font-bold ${portfolio.total_pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatPercent(portfolio.total_return)}
                            </span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cash</p>
                            <p className="text-2xl font-black">{formatCurrency(portfolio.cash)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Positions</p>
                            <p className="text-2xl font-black">{formatCurrency(portfolio.positions_value)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">P&L</p>
                            <p className={`text-2xl font-black ${portfolio.total_pl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(portfolio.total_pl)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Tab Switcher */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6 max-w-lg">
                    {[
                        { key: 'markets', label: 'Markets' },
                        { key: 'portfolio', label: 'Portfolio' },
                        { key: 'history', label: 'History' },
                        { key: 'watchlist', label: 'Watchlist' },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}>
                            {tab.key === 'watchlist' && <Star className="w-3.5 h-3.5" />}
                            {tab.label}
                            {tab.key === 'watchlist' && watchlistIds.size > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                                    {watchlistIds.size}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ===== MARKETS TAB ===== */}
                {activeTab === 'markets' && (
                    <div>
                        {/* Search + Exchange + Sort controls */}
                        <form onSubmit={handleSearch} className="mb-4 flex flex-wrap gap-3">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    placeholder="Search markets (e.g. election, bitcoin, AI...)"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>

                            {/* Exchange selector */}
                            <select
                                value={exchange}
                                onChange={e => setExchange(e.target.value)}
                                className="px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 capitalize"
                            >
                                {exchanges.length > 0 ? exchanges.map(ex => (
                                    <option key={ex} value={ex} className="capitalize">{ex}</option>
                                )) : (
                                    <option value="polymarket">polymarket</option>
                                )}
                            </select>

                            {/* Sort selector */}
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="default">Sort: Default</option>
                                <option value="volume">Volume (High→Low)</option>
                                <option value="liquidity">Liquidity (High→Low)</option>
                                <option value="closing_soon">Closing Soon</option>
                                <option value="newest">Newest</option>
                            </select>

                            <button type="submit"
                                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors text-sm">
                                Search
                            </button>
                        </form>

                        {/* Category filter chips */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            <button
                                onClick={() => setActiveCategory(null)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    activeCategory === null
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                                }`}>
                                All
                            </button>
                            {Object.keys(CATEGORIES).map(cat => (
                                <button key={cat}
                                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                        activeCategory === cat
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                                    }`}>
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Auto-refresh indicator */}
                        {autoRefresh && (
                            <div className="flex items-center gap-2 mb-4 text-xs text-purple-500 dark:text-purple-400">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                Auto-refreshing every 30s
                            </div>
                        )}

                        {loadingMarkets ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                            </div>
                        ) : processedMarkets.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No markets found.</p>
                                <p className="text-sm mt-1">Try a different search term, category, or check back later.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {processedMarkets.map(market => (
                                    <MarketCard
                                        key={market.id}
                                        market={market}
                                        exchange={exchange}
                                        isExpanded={expandedMarketId === market.id}
                                        onToggle={() => setExpandedMarketId(
                                            expandedMarketId === market.id ? null : market.id
                                        )}
                                        onTradeComplete={onTradeComplete}
                                        isWatchlisted={watchlistIds.has(market.id)}
                                        onToggleWatchlist={handleToggleWatchlist}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== PORTFOLIO TAB ===== */}
                {activeTab === 'portfolio' && (
                    <div>
                        {/* Portfolio Growth Chart */}
                        {tradeHistory.length > 0 && <PredictionPortfolioChart />}

                        {/* Performance Stats Grid */}
                        {stats && stats.total_trades > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Activity className="w-3.5 h-3.5 text-purple-500" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Trades</p>
                                    </div>
                                    <p className="text-xl font-black">{stats.total_trades}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Percent className="w-3.5 h-3.5 text-blue-500" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Win Rate</p>
                                    </div>
                                    <p className={`text-xl font-black ${stats.win_rate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {stats.win_rate.toFixed(1)}%
                                    </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign className="w-3.5 h-3.5 text-green-500" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total P&L</p>
                                    </div>
                                    <p className={`text-xl font-black ${stats.total_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatCurrency(stats.total_profit)}
                                    </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Best Trade</p>
                                    </div>
                                    <p className="text-xl font-black text-green-600 dark:text-green-400">
                                        {formatCurrency(stats.best_trade)}
                                    </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Worst Trade</p>
                                    </div>
                                    <p className="text-xl font-black text-red-600 dark:text-red-400">
                                        {formatCurrency(stats.worst_trade)}
                                    </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Award className="w-3.5 h-3.5 text-yellow-500" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Profit</p>
                                    </div>
                                    <p className={`text-xl font-black ${stats.avg_trade_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatCurrency(stats.avg_trade_profit)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Positions */}
                        {loadingPortfolio ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                            </div>
                        ) : !portfolio || portfolio.positions.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No open positions.</p>
                                <p className="text-sm mt-1">Browse markets and start trading!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {portfolio.positions.map(pos => (
                                    <div key={pos.position_key}
                                        className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                                                {pos.question}
                                            </p>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                                                <span className="font-bold text-purple-500 dark:text-purple-400">{pos.outcome}</span>
                                                <span>{pos.contracts} contracts</span>
                                                <span>Avg: {formatProbability(pos.avg_cost)}</span>
                                                <span>Now: {formatProbability(pos.current_price)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(pos.current_value)}</p>
                                            <p className={`text-xs font-bold ${pos.total_pl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {formatCurrency(pos.total_pl)} ({formatPercent(pos.total_pl_percent)})
                                            </p>
                                        </div>
                                        <button onClick={() => handleSellPosition(pos)}
                                            className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shrink-0">
                                            Sell
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== HISTORY TAB ===== */}
                {activeTab === 'history' && (
                    <div>
                        {tradeHistory.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No trades yet.</p>
                                <p className="text-sm mt-1">Your trade history will appear here.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-400 uppercase tracking-wider">
                                            <th className="px-4 py-3 text-left">Type</th>
                                            <th className="px-4 py-3 text-left">Market</th>
                                            <th className="px-4 py-3 text-left">Outcome</th>
                                            <th className="px-4 py-3 text-right">Contracts</th>
                                            <th className="px-4 py-3 text-right">Price</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                            <th className="px-4 py-3 text-right">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {[...tradeHistory].reverse().map((trade, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                                        trade.type === 'BUY'
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>{trade.type}</span>
                                                </td>
                                                <td className="px-4 py-3 max-w-xs truncate text-gray-700 dark:text-gray-300">
                                                    {trade.question}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{trade.outcome}</td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{trade.contracts}</td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                    {formatProbability(trade.price)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(trade.total)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-400 text-xs">
                                                    {new Date(trade.timestamp).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== WATCHLIST TAB ===== */}
                {activeTab === 'watchlist' && (
                    <div>
                        {watchlistedMarkets.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No watchlisted markets.</p>
                                <p className="text-sm mt-1">Star markets from the Markets tab to track them here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {watchlistedMarkets.map(market => (
                                    <MarketCard
                                        key={market.id}
                                        market={market}
                                        exchange={exchange}
                                        isExpanded={expandedMarketId === market.id}
                                        onToggle={() => setExpandedMarketId(
                                            expandedMarketId === market.id ? null : market.id
                                        )}
                                        onTradeComplete={onTradeComplete}
                                        isWatchlisted={true}
                                        onToggleWatchlist={handleToggleWatchlist}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PredictionMarketsPage;
