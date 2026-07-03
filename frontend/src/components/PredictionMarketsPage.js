import React from 'react';
import {
    BarChart3, Search, RefreshCw,
    RotateCcw, Loader2, AlertTriangle, CheckCircle, XCircle,
    DollarSign, Clock,
} from 'lucide-react';
import { formatCurrency, formatPercent, formatProbability } from './prediction-markets/format';
import { MarketCard } from './prediction-markets/components';
import usePredictionMarketsData from './prediction-markets/usePredictionMarketsData';

const PredictionMarketsPage = () => {
    const {
        activeSearch, activeTab, analysisByMarketId, analysisEnabled,
        expandedMarketId, fetchMarkets, handleAnalyzeMarket, handleReset,
        handleSearch, handleSellPosition, loadingMarkets, loadingPortfolio,
        markets, onTradeComplete, portfolio, refreshPortfolioState,
        searchInput, setActiveTab, setExpandedMarketId, setSearchInput,
        setStatusMessage, statusMessage, tradeHistory,
    } = usePredictionMarketsData();

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
