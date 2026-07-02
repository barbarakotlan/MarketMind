import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
    BarChart3, Search, RefreshCw,
    RotateCcw, Loader2, AlertTriangle, CheckCircle, XCircle,
    DollarSign, Clock,
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import { formatCurrency, formatPercent, formatProbability } from './prediction-markets/format';
import { MarketCard } from './prediction-markets/components';

const PredictionMarketsPage = () => {
    const { isLoaded, isSignedIn } = useAuth();
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
    const [analysisByMarketId, setAnalysisByMarketId] = useState({});

    const analysisEnabled = isLoaded && isSignedIn;

    const fetchMarkets = useCallback(async (search = '') => {
        setLoadingMarkets(true);
        try {
            const url = API_ENDPOINTS.PREDICTION_MARKETS('polymarket', 50, search);
            const data = await apiRequest(url);
            setMarkets(data.markets || []);
        } catch (err) {
            console.error('Error fetching markets:', err);
        } finally {
            setLoadingMarkets(false);
        }
    }, []);

    const refreshPortfolioState = useCallback(async () => {
        if (!isLoaded || !isSignedIn) {
            setPortfolio(null);
            setTradeHistory([]);
            setLoadingPortfolio(false);
            return;
        }

        setLoadingPortfolio(true);
        try {
            const [portfolioData, historyData] = await Promise.all([
                apiRequest(API_ENDPOINTS.PREDICTION_PORTFOLIO),
                apiRequest(API_ENDPOINTS.PREDICTION_HISTORY),
            ]);
            setPortfolio(portfolioData);
            setTradeHistory(historyData || []);
        } catch (err) {
            console.error('Error refreshing prediction portfolio:', err);
        } finally {
            setLoadingPortfolio(false);
        }
    }, [isLoaded, isSignedIn]);

    const handleReset = async () => {
        if (!window.confirm('Reset your prediction markets portfolio to $10,000?')) return;
        try {
            await apiRequest(API_ENDPOINTS.PREDICTION_RESET, { method: 'POST' });
            setStatusMessage({ type: 'success', text: 'Prediction portfolio reset successfully' });
            setActiveTab('portfolio');
            await refreshPortfolioState();
        } catch {
            setStatusMessage({ type: 'error', text: 'Failed to reset portfolio' });
        }
    };

    const handleSellPosition = async (position) => {
        const numContracts = prompt(`Sell how many "${position.outcome}" contracts? (You have ${position.contracts})`);
        if (!numContracts) return;
        try {
            const data = await apiRequest(API_ENDPOINTS.PREDICTION_SELL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: position.market_id,
                    outcome: position.outcome,
                    contracts: parseFloat(numContracts),
                }),
            });
            setStatusMessage({ type: 'success', text: data.message });
            await refreshPortfolioState();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message || 'Failed to execute sell' });
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveSearch(searchInput);
        fetchMarkets(searchInput);
    };

    const handleAnalyzeMarket = async (market) => {
        if (!analysisEnabled) {
            setAnalysisByMarketId((prev) => ({
                ...prev,
                [market.id]: {
                    status: 'error',
                    data: null,
                    error: 'Sign in to generate Market vs Model analysis.',
                },
            }));
            return;
        }

        setAnalysisByMarketId((prev) => ({
            ...prev,
            [market.id]: { status: 'loading', data: null, error: '' },
        }));

        try {
            const data = await apiRequest(API_ENDPOINTS.PREDICTION_ANALYZE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: market.id,
                    exchange: 'polymarket',
                }),
            });
            setAnalysisByMarketId((prev) => ({
                ...prev,
                [market.id]: { status: 'success', data, error: '' },
            }));
        } catch (err) {
            setAnalysisByMarketId((prev) => ({
                ...prev,
                [market.id]: {
                    status: 'error',
                    data: null,
                    error: err.message || 'Failed to analyze market',
                },
            }));
        }
    };

    const onTradeComplete = async (message) => {
        setStatusMessage({ type: 'success', text: message || 'Trade executed successfully' });
        setExpandedMarketId(null);
        setActiveTab('portfolio');
        await refreshPortfolioState();
    };

    useEffect(() => {
        fetchMarkets();
    }, [fetchMarkets]);

    useEffect(() => {
        refreshPortfolioState();
    }, [refreshPortfolioState]);

    return (
        <div className="ui-page animate-fade-in space-y-8">
            <div className="ui-page-header flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="mb-3 inline-flex items-center rounded-control border border-mm-border bg-mm-surface p-2 shadow-card">
                        <BarChart3 className="h-8 w-8 text-mm-accent-primary" />
                    </div>
                    <h1 className="ui-page-title mb-2">Prediction Markets</h1>
                    <p className="ui-page-subtitle">
                        Trade on real-world event outcomes with $10,000 in virtual funds.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => { fetchMarkets(activeSearch); refreshPortfolioState(); }} title="Refresh" className="ui-button-secondary p-2.5">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <button onClick={handleReset} title="Reset portfolio" className="ui-button-destructive p-2.5">
                        <RotateCcw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {statusMessage.text && (
                <div className={statusMessage.type === 'success' ? 'ui-banner ui-banner-success' : 'ui-banner ui-banner-error'}>
                    <div className="flex items-center gap-3">
                        {statusMessage.type === 'success'
                            ? <CheckCircle className="h-4 w-4 shrink-0" />
                            : <AlertTriangle className="h-4 w-4 shrink-0" />
                        }
                        <span className="flex-1 text-sm font-semibold">{statusMessage.text}</span>
                        <button onClick={() => setStatusMessage({ type: '', text: '' })}>
                            <XCircle className="h-5 w-5 opacity-50 transition-opacity hover:opacity-100" />
                        </button>
                    </div>
                </div>
            )}

            {portfolio && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="ui-panel-elevated p-5">
                        <p className="ui-section-label mb-1">Total Value</p>
                        <p className="text-2xl font-semibold text-mm-text-primary">{formatCurrency(portfolio.total_value)}</p>
                        <span className={`text-xs font-semibold ${portfolio.total_pl >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
                            {formatPercent(portfolio.total_return)}
                        </span>
                    </div>
                    <div className="ui-panel p-5">
                        <p className="ui-section-label mb-1">Cash</p>
                        <p className="text-2xl font-semibold text-mm-text-primary">{formatCurrency(portfolio.cash)}</p>
                    </div>
                    <div className="ui-panel p-5">
                        <p className="ui-section-label mb-1">Positions</p>
                        <p className="text-2xl font-semibold text-mm-text-primary">{formatCurrency(portfolio.positions_value)}</p>
                    </div>
                    <div className="ui-panel p-5">
                        <p className="ui-section-label mb-1">P&L</p>
                        <p className={`text-2xl font-semibold ${portfolio.total_pl >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
                            {formatCurrency(portfolio.total_pl)}
                        </p>
                    </div>
                </div>
            )}

            <div className="ui-tab-group flex max-w-md">
                {[
                    { key: 'markets', label: 'Markets' },
                    { key: 'portfolio', label: 'Portfolio' },
                    { key: 'history', label: 'History' },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={activeTab === tab.key ? 'ui-tab ui-tab-active flex-1' : 'ui-tab flex-1'}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'markets' && (
                <div>
                    <form onSubmit={handleSearch} className="mb-6 flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mm-text-tertiary" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search markets (e.g. election, bitcoin, AI...)"
                                className="ui-input py-3 pl-10 text-sm"
                            />
                        </div>
                        <button type="submit" className="ui-button-primary px-6 py-3 text-sm">
                            Search
                        </button>
                    </form>

                    {loadingMarkets ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-mm-accent-primary" />
                        </div>
                    ) : markets.length === 0 ? (
                        <div className="ui-empty-state py-16">
                            <BarChart3 className="mb-3 h-12 w-12 text-mm-text-tertiary opacity-30" />
                            <p className="font-medium">No markets found.</p>
                            <p className="mt-1 text-sm">Try a different search term or check back later.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {markets.map((market) => (
                                <MarketCard
                                    key={market.id}
                                    market={market}
                                    isExpanded={expandedMarketId === market.id}
                                    onToggle={() => setExpandedMarketId(expandedMarketId === market.id ? null : market.id)}
                                    onTradeComplete={onTradeComplete}
                                    onAnalyze={handleAnalyzeMarket}
                                    analysisState={analysisByMarketId[market.id]}
                                    analysisEnabled={analysisEnabled}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'portfolio' && (
                <div>
                    {loadingPortfolio ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-mm-accent-primary" />
                        </div>
                    ) : !portfolio || portfolio.positions.length === 0 ? (
                        <div className="ui-empty-state py-16">
                            <DollarSign className="mb-3 h-12 w-12 text-mm-text-tertiary opacity-30" />
                            <p className="font-medium">No open positions.</p>
                            <p className="mt-1 text-sm">Browse markets and start trading.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {portfolio.positions.map((pos) => (
                                <div key={pos.position_key} className="ui-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold leading-snug text-mm-text-primary">{pos.question}</p>
                                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-mm-text-tertiary">
                                            <span className="font-semibold text-mm-accent-primary">{pos.outcome}</span>
                                            <span>{pos.contracts} contracts</span>
                                            <span>Avg: {formatProbability(pos.avg_cost)}</span>
                                            <span>Now: {formatProbability(pos.current_price)}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-semibold text-mm-text-primary">{formatCurrency(pos.current_value)}</p>
                                        <p className={`text-xs font-semibold ${pos.total_pl >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                            {formatCurrency(pos.total_pl)} ({formatPercent(pos.total_pl_percent)})
                                        </p>
                                    </div>
                                    <button onClick={() => handleSellPosition(pos)} className="ui-button-destructive px-4 py-2 text-sm">
                                        Sell
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div>
                    {tradeHistory.length === 0 ? (
                        <div className="ui-empty-state py-16">
                            <Clock className="mb-3 h-12 w-12 text-mm-text-tertiary opacity-30" />
                            <p className="font-medium">No trades yet.</p>
                            <p className="mt-1 text-sm">Your trade history will appear here.</p>
                        </div>
                    ) : (
                        <div className="ui-panel overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-mm-surface-subtle text-xs uppercase text-mm-text-secondary">
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Market</th>
                                        <th className="px-4 py-3 text-left">Outcome</th>
                                        <th className="px-4 py-3 text-right">Contracts</th>
                                        <th className="px-4 py-3 text-right">Price</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...tradeHistory].reverse().map((trade, i) => (
                                        <tr key={i} className="border-t border-mm-border hover:bg-mm-surface-subtle">
                                            <td className="px-4 py-3">
                                                <span className={trade.type === 'BUY' ? 'ui-status-chip ui-status-chip--positive' : 'ui-status-chip ui-status-chip--negative'}>
                                                    {trade.type}
                                                </span>
                                            </td>
                                            <td className="max-w-xs truncate px-4 py-3 text-mm-text-secondary">{trade.question}</td>
                                            <td className="px-4 py-3 font-semibold text-mm-text-primary">{trade.outcome}</td>
                                            <td className="px-4 py-3 text-right text-mm-text-secondary">{trade.contracts}</td>
                                            <td className="px-4 py-3 text-right text-mm-text-secondary">{formatProbability(trade.price)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-mm-text-primary">{formatCurrency(trade.total)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-mm-text-tertiary">{new Date(trade.timestamp).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PredictionMarketsPage;
