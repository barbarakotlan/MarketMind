import React, { useState, useEffect } from 'react';
import {
    BarChart3, Search, TrendingUp, TrendingDown, RefreshCw,
    RotateCcw, Loader2, AlertTriangle, CheckCircle, XCircle,
    ChevronDown, ChevronUp, DollarSign, Clock
} from 'lucide-react';

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
const MarketCard = ({ market, isExpanded, onToggle, onTradeComplete }) => {
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
            <button onClick={onToggle} className="w-full p-5 text-left flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">
                        {market.question}
                    </h3>
                    <div className="mt-3">
                        <ProbabilityBar outcomes={market.outcomes} prices={market.prices} />
                    </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                    {market.volume > 0 && (
                        <div className="text-xs text-gray-400">Vol: ${market.volume?.toLocaleString()}</div>
                    )}
                    {market.liquidity > 0 && (
                        <div className="text-xs text-gray-400">Liq: ${market.liquidity?.toLocaleString()}</div>
                    )}
                    {isExpanded
                        ? <ChevronUp className="w-4 h-4 ml-auto text-gray-400" />
                        : <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
                    }
                </div>
            </button>

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

    // --- Data fetching ---
    const fetchMarkets = async (search = '') => {
        setLoadingMarkets(true);
        try {
            const params = new URLSearchParams({ exchange: 'polymarket', limit: '50' });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/prediction-markets?${params}`);
            const data = await res.json();
            setMarkets(data.markets || []);
        } catch (err) {
            console.error('Error fetching markets:', err);
        } finally {
            setLoadingMarkets(false);
        }
    };

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

    const handleReset = async () => {
        if (!window.confirm('Reset your prediction markets portfolio to $10,000?')) return;
        try {
            await fetch(`${API_BASE}/prediction-markets/reset`, { method: 'POST' });
            setStatusMessage({ type: 'success', text: 'Prediction portfolio reset successfully' });
            fetchPortfolio();
            fetchTradeHistory();
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
                })
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMessage({ type: 'success', text: data.message });
                fetchPortfolio();
                fetchTradeHistory();
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
    };

    useEffect(() => {
        fetchMarkets();
        fetchPortfolio();
        fetchTradeHistory();
    }, []);

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
                        <button onClick={() => { fetchMarkets(activeSearch); fetchPortfolio(); }}
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
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6 max-w-md">
                    {[
                        { key: 'markets', label: 'Markets' },
                        { key: 'portfolio', label: 'Portfolio' },
                        { key: 'history', label: 'History' },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ===== MARKETS TAB ===== */}
                {activeTab === 'markets' && (
                    <div>
                        <form onSubmit={handleSearch} className="mb-6 flex gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    placeholder="Search markets (e.g. election, bitcoin, AI...)"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                            <button type="submit"
                                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors text-sm">
                                Search
                            </button>
                        </form>

                        {loadingMarkets ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                            </div>
                        ) : markets.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No markets found.</p>
                                <p className="text-sm mt-1">Try a different search term or check back later.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {markets.map(market => (
                                    <MarketCard
                                        key={market.id}
                                        market={market}
                                        isExpanded={expandedMarketId === market.id}
                                        onToggle={() => setExpandedMarketId(
                                            expandedMarketId === market.id ? null : market.id
                                        )}
                                        onTradeComplete={onTradeComplete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== PORTFOLIO TAB ===== */}
                {activeTab === 'portfolio' && (
                    <div>
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
            </div>
        </div>
    );
};

export default PredictionMarketsPage;
