import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext';
import {
  Briefcase,
  TrendingUp,
  RefreshCw,
  RotateCcw,
  BarChart3,
  Loader2,
  AlertTriangle,
  Brain,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import { formatCurrency, formatNum, formatPercent } from './paper/format';
import PortfolioGrowthChart from './paper/PortfolioGrowthChart';
import TradeModal from './paper/TradeModal';

const optimizationMethods = [
    { key: 'black_litterman', label: 'Black-Litterman' },
    { key: 'max_sharpe', label: 'Max Sharpe' },
    { key: 'min_vol', label: 'Min Vol' },
    { key: 'hrp', label: 'HRP' },
];

const metricLabelClass = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-mm-text-tertiary mb-1';
const metricValueClass = 'font-semibold text-mm-text-primary';

const statusBannerClass = (type) =>
    type === 'success'
        ? 'border-mm-positive/20 bg-mm-positive/10 text-mm-positive'
        : 'border-mm-negative/20 bg-mm-negative/10 text-mm-negative';

const statusIconClass = (type) =>
    type === 'success'
        ? 'bg-mm-positive/15 text-mm-positive'
        : 'bg-mm-negative/15 text-mm-negative';

const statusPillClass = (isRefreshing) =>
    isRefreshing
        ? 'bg-mm-accent-primary/10 text-mm-accent-primary'
        : 'bg-mm-positive/10 text-mm-positive';

const holdingsEmptyClass = 'ui-panel-subtle border-dashed py-20 text-center';
const positionCardClass = 'ui-panel p-6 transition-all';

// --- MAIN APPLICATION COMPONENT ---
export default function PaperTradingPage() {
    const { sharedTicker: initialTicker, clearTicker: onConsumeInitialTicker } = useNavigation();
    const [portfolio, setPortfolio] = useState(null);
    const [stockPositions, setStockPositions] = useState([]);
    const [optionsPositions, setOptionsPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [showBuyModal, setShowBuyModal] = useState(false);
    const [showSellModal, setShowSellModal] = useState(false);
    const [selectedStock, setSelectedStock] = useState(null);
    const [buyTicker, setBuyTicker] = useState('');
    const [buyShares, setBuyShares] = useState('');
    const [sellShares, setSellShares] = useState('');
    const [tradeMessage, setTradeMessage] = useState({ type: '', text: '' });

    const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [optimizationMethod, setOptimizationMethod] = useState('black_litterman');
    const [optimizationData, setOptimizationData] = useState(null);
    const [optimizationLoading, setOptimizationLoading] = useState(false);
    const [optimizationError, setOptimizationError] = useState('');

    useEffect(() => {
        const normalizedTicker = String(initialTicker || '').trim().toUpperCase();
        if (!normalizedTicker) return;
        setBuyTicker(normalizedTicker);
        setBuyShares('');
        setShowBuyModal(true);
        if (onConsumeInitialTicker) onConsumeInitialTicker();
    }, [initialTicker, onConsumeInitialTicker]);

    const fetchPortfolio = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const data = await apiRequest(API_ENDPOINTS.PORTFOLIO);

            setPortfolio(data);
            setStockPositions(data.positions || []);
            setOptionsPositions(data.options_positions || []);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            console.error('Error fetching portfolio:', err);
            setTradeMessage({ type: 'error', text: 'Backend Sync Failed. Is your Python server running?' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPortfolio();
        const interval = setInterval(() => {
            fetchPortfolio();
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchOptimization = useCallback(async (method = optimizationMethod) => {
        setOptimizationLoading(true);
        setOptimizationError('');
        try {
            const payload = await apiRequest(API_ENDPOINTS.PORTFOLIO_OPTIMIZE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method,
                    use_predictions: true,
                }),
            });
            setOptimizationData(payload);
        } catch (err) {
            setOptimizationData(null);
            setOptimizationError(err.message || 'Unable to generate portfolio recommendations right now.');
        } finally {
            setOptimizationLoading(false);
        }
    }, [optimizationMethod]);

    useEffect(() => {
        if (!portfolio) return;
        if (stockPositions.length < 2) {
            setOptimizationData(null);
            setOptimizationError('');
            setOptimizationLoading(false);
            return;
        }
        fetchOptimization(optimizationMethod);
    }, [portfolio, stockPositions.length, optimizationMethod, fetchOptimization]);

    const handleBuy = async (e) => {
        e.preventDefault();
        setTradeMessage({ type: '', text: '' });
        try {
            const data = await apiRequest(API_ENDPOINTS.PAPER_BUY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: buyTicker.toUpperCase(), shares: parseFloat(buyShares) })
            });
            setTradeMessage({ type: 'success', text: data.message });
            setBuyTicker('');
            setBuyShares('');
            setShowBuyModal(false);
            fetchPortfolio();
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message || 'Failed to execute trade' });
        }
    };

    const handleSell = async (e) => {
        e.preventDefault();
        setTradeMessage({ type: '', text: '' });
        try {
            const data = await apiRequest(API_ENDPOINTS.PAPER_SELL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: selectedStock.ticker, shares: parseFloat(sellShares) })
            });
            setTradeMessage({ type: 'success', text: data.message });
            setSellShares('');
            setShowSellModal(false);
            setSelectedStock(null);
            fetchPortfolio();
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message || 'Failed to execute trade' });
        }
    };

    const handleConfirmOptionSell = async (contractSymbol, quantity, price, isBuy) => {
        if (isBuy) return { success: false, errorMessage: 'Buying options is not supported in this modal.' };
        const body = JSON.stringify({
            contractSymbol: contractSymbol,
            quantity: quantity,
            price: price
        });
        try {
            const data = await apiRequest(API_ENDPOINTS.PAPER_OPTIONS_SELL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            setTradeMessage({ type: 'success', text: data.message });
            fetchPortfolio();
            return { success: true };
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message });
            return { success: false, errorMessage: err.message };
        }
    };

    const handleManageOption = (optionPosition) => {
        const contract = {
            ticker: optionPosition.ticker,
            current_price: optionPosition.current_price,
            bid: optionPosition.current_price,
            ask: optionPosition.current_price,
        };
        setSelectedOption(contract);
        setIsOptionModalOpen(true);
    };

    const handleReset = async () => {
        if (!window.confirm('Are you sure you want to reset your portfolio?')) return;
        try {
            const data = await apiRequest(API_ENDPOINTS.PORTFOLIO_RESET, { method: 'POST' });
            setTradeMessage({ type: 'success', text: data.message });
            fetchPortfolio();
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message || 'Failed to reset portfolio' });
        }
    };

    if (loading && !portfolio) {
        return (
            <div className="ui-page flex min-h-[60vh] items-center justify-center text-center">
                <div>
                    <Loader2 className="h-12 w-12 text-mm-accent-primary animate-spin mx-auto mb-4" />
                    <p className="text-mm-text-secondary font-medium">Syncing with Local Server...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-page space-y-8">
            {isOptionModalOpen && (
                <TradeModal
                    contract={selectedOption}
                    tradeType="Sell"
                    stockPrice={null}
                    onClose={() => setIsOptionModalOpen(false)}
                    onConfirmTrade={handleConfirmOptionSell}
                />
            )}

            {showBuyModal && (
                <div
                    className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowBuyModal(false)}
                >
                    <div
                        className="ui-panel w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-semibold mb-1 text-mm-text-primary">Buy Stock</h3>
                        <p className="text-sm text-mm-text-secondary mb-5">Enter ticker and quantity to place a paper buy order.</p>
                        <form onSubmit={handleBuy} className="space-y-4">
                            <div>
                                <label className="ui-section-label mb-2 block">Ticker</label>
                                <input
                                    type="text"
                                    value={buyTicker}
                                    onChange={(e) => setBuyTicker(e.target.value)}
                                    placeholder="e.g. AAPL"
                                    className="ui-input font-semibold"
                                    required
                                />
                            </div>
                            <div>
                                <label className="ui-section-label mb-2 block">Shares</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={buyShares}
                                    onChange={(e) => setBuyShares(e.target.value)}
                                    placeholder="10"
                                    className="ui-input font-semibold"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowBuyModal(false)}
                                    className="ui-button-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="ui-button-primary flex-1"
                                >
                                    Submit Buy
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showSellModal && selectedStock && (
                <div
                    className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => {
                        setShowSellModal(false);
                        setSelectedStock(null);
                    }}
                >
                    <div
                        className="ui-panel w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-semibold mb-1 text-mm-text-primary">Sell Stock</h3>
                        <p className="text-sm text-mm-text-secondary mb-5">
                            Sell shares from <span className="font-semibold text-mm-text-primary">{selectedStock.ticker}</span>.
                        </p>
                        <form onSubmit={handleSell} className="space-y-4">
                            <div className="ui-panel-subtle p-3">
                                <p className="ui-section-label mb-1">Available Shares</p>
                                <p className="text-lg font-semibold text-mm-text-primary">{formatNum(selectedStock.shares, 2)}</p>
                            </div>
                            <div>
                                <label className="ui-section-label mb-2 block">Shares to Sell</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    max={selectedStock.shares}
                                    value={sellShares}
                                    onChange={(e) => setSellShares(e.target.value)}
                                    placeholder="1"
                                    className="ui-input font-semibold"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSellModal(false);
                                        setSelectedStock(null);
                                    }}
                                    className="ui-button-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="ui-button-destructive flex-1"
                                >
                                    Submit Sell
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="text-left">
                    <div className="inline-flex items-center justify-center p-2 rounded-control mb-3 border border-mm-positive/20 bg-mm-positive/10">
                        <Briefcase className="w-8 h-8 text-mm-positive" />
                    </div>
                    <p className="ui-section-label mb-2">Simulator</p>
                    <h1 className="ui-page-title mb-2">Paper Trading</h1>
                    <p className="ui-page-subtitle">Practice with virtual funds using live market data.</p>
                </div>
                <div className="ui-panel-subtle flex items-center gap-4 p-3">
                    <div className="text-right">
                        <p className="ui-section-label mb-1">Last Synced</p>
                        <p className="text-sm font-semibold text-mm-text-primary">{lastUpdated || '--:--'}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-control flex items-center justify-center ${refreshing ? 'bg-mm-accent-primary/10 text-mm-accent-primary' : 'bg-mm-positive/10 text-mm-positive'}`}>
                        {refreshing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                    </div>
                </div>
            </div>

            {/* Status Message */}
            {tradeMessage.text && (
                <div className={`rounded-card border p-4 flex items-center gap-4 animate-in slide-in-from-top duration-300 ${statusBannerClass(tradeMessage.type)}`}>
                    <div className={`p-2 rounded-control ${statusIconClass(tradeMessage.type)}`}>
                        {tradeMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    </div>
                    <span className="font-semibold text-sm">{tradeMessage.text}</span>
                    <button onClick={() => setTradeMessage({type: '', text: ''})} className="ml-auto opacity-40 hover:opacity-100">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="ui-panel-elevated p-6">
                    <p className="ui-section-label mb-1">Portfolio Value</p>
                    <p className="text-3xl font-semibold text-mm-text-primary mb-2">{formatCurrency(portfolio?.total_value)}</p>
                    <div className={`ui-status-chip ${(portfolio?.total_pl || 0) >= 0 ? 'ui-status-chip--positive' : 'ui-status-chip--negative'}`}>
                        {(portfolio?.total_pl || 0) >= 0 ? '▲' : '▼'} {formatNum(portfolio?.total_return)}%
                    </div>
                </div>
                <div className="ui-panel p-6">
                    <p className="ui-section-label mb-1">Cash Balance</p>
                    <p className="text-2xl font-semibold text-mm-text-primary">{formatCurrency(portfolio?.cash)}</p>
                </div>
                <div className="ui-panel p-6">
                    <p className="ui-section-label mb-1">Stocks</p>
                    <p className="text-2xl font-semibold text-mm-text-primary">{formatCurrency(portfolio?.positions_value)}</p>
                </div>
                <div className="ui-panel p-6">
                    <p className="ui-section-label mb-1">Options</p>
                    <p className="text-2xl font-semibold text-mm-accent-primary">{formatCurrency(portfolio?.options_value)}</p>
                </div>
                <div className="ui-panel p-6 flex flex-col justify-center">
                    <p className="ui-section-label mb-2">System Status</p>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-control w-fit ${statusPillClass(refreshing)}`}>
                         <div className={`h-2 w-2 rounded-full ${refreshing ? 'bg-mm-accent-primary animate-pulse' : 'bg-mm-positive'}`}></div>
                         <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{refreshing ? 'Fetching Data' : 'Active'}</span>
                    </div>
                </div>
            </div>

            <div className="ui-panel space-y-6 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="ui-section-label mb-2">Portfolio Intelligence</p>
                        <h2 className="text-xl font-semibold text-mm-text-primary">Rebalance Suggestions</h2>
                        <p className="mt-2 max-w-2xl text-sm text-mm-text-secondary">
                            Read-only optimization for your current U.S. equity holdings. Options remain excluded, and any unused capital stays in cash.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {optimizationMethods.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setOptimizationMethod(item.key)}
                                className={optimizationMethod === item.key ? 'ui-button-primary px-4 py-2 text-xs' : 'ui-button-secondary px-4 py-2 text-xs'}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {stockPositions.length < 2 ? (
                    <div className="ui-panel-subtle border-dashed p-6 text-sm text-mm-text-secondary">
                        Add at least two U.S. stock holdings to generate a portfolio rebalance plan.
                        {optionsPositions.length > 0 && (
                            <span className="block mt-2">
                                Current option positions stay excluded from optimization in this first release.
                            </span>
                        )}
                    </div>
                ) : optimizationLoading ? (
                    <div className="ui-panel-subtle flex items-center gap-3 p-6 text-mm-text-secondary">
                        <Loader2 className="h-5 w-5 animate-spin text-mm-accent-primary" />
                        Building portfolio recommendations...
                    </div>
                ) : optimizationError ? (
                    <div className="ui-banner ui-banner-error">
                        <strong className="text-mm-text-primary">Portfolio optimization unavailable.</strong> {optimizationError}
                    </div>
                ) : optimizationData ? (
                    <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div className="ui-panel-subtle p-4">
                                <p className="ui-section-label mb-1">Investable Value</p>
                                <p className="text-xl font-semibold text-mm-text-primary">{formatCurrency(optimizationData.investableValue)}</p>
                            </div>
                            <div className="ui-panel-subtle p-4">
                                <p className="ui-section-label mb-1">Expected Return</p>
                                <p className="text-xl font-semibold text-mm-text-primary">{formatPercent(optimizationData.portfolioMetrics?.expectedAnnualReturn)}</p>
                            </div>
                            <div className="ui-panel-subtle p-4">
                                <p className="ui-section-label mb-1">Volatility</p>
                                <p className="text-xl font-semibold text-mm-text-primary">{formatPercent(optimizationData.portfolioMetrics?.annualVolatility)}</p>
                            </div>
                            <div className="ui-panel-subtle p-4">
                                <p className="ui-section-label mb-1">Sharpe</p>
                                <p className="text-xl font-semibold text-mm-accent-primary">{formatNum(optimizationData.portfolioMetrics?.sharpeRatio, 2)}</p>
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                            <div className="overflow-x-auto rounded-card border border-mm-border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-mm-surface-subtle border-b border-mm-border">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mm-text-secondary">Ticker</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mm-text-secondary">Current</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mm-text-secondary">Target</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mm-text-secondary">Delta</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mm-text-secondary">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-mm-border">
                                        {(optimizationData.recommendedAllocations || []).map((row) => {
                                            const action = (optimizationData.rebalanceActions || []).find((item) => item.ticker === row.ticker)?.action || 'hold';
                                            const isPositive = row.deltaValue >= 0;
                                            return (
                                                <tr key={row.ticker}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-mm-text-primary">{row.ticker}</div>
                                                        <div className="text-xs text-mm-text-secondary">{row.companyName}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-mm-text-secondary">
                                                        {formatPercent(row.currentWeight)} · {formatCurrency(row.currentValue)}
                                                    </td>
                                                    <td className="px-4 py-3 text-mm-text-primary">
                                                        {formatPercent(row.targetWeight)} · {formatCurrency(row.targetValue)}
                                                    </td>
                                                    <td className={`px-4 py-3 font-semibold ${isPositive ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                                        {isPositive ? '+' : ''}{formatCurrency(row.deltaValue)} · {isPositive ? '+' : ''}{formatNum(row.estimatedSharesDelta, 2)} sh
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`ui-status-chip ${action === 'buy' ? 'ui-status-chip--positive' : action === 'trim' ? 'ui-status-chip--warning' : ''}`}>
                                                            {action}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr>
                                            <td className="px-4 py-3 font-semibold text-mm-text-primary">Cash</td>
                                            <td className="px-4 py-3 text-mm-text-secondary">
                                                {formatPercent(optimizationData.cashPosition?.currentWeight)} · {formatCurrency(optimizationData.cashPosition?.currentValue)}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-primary">
                                                {formatPercent(optimizationData.cashPosition?.targetWeight)} · {formatCurrency(optimizationData.cashPosition?.targetValue)}
                                            </td>
                                            <td className={`px-4 py-3 font-semibold ${(optimizationData.cashPosition?.deltaValue || 0) >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                                {formatCurrency(optimizationData.cashPosition?.deltaValue)}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">reserve</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-4">
                                {(optimizationData.excludedHoldings || []).length > 0 && (
                                    <div className="ui-panel-subtle p-4">
                                        <p className="ui-section-label mb-2">Excluded Holdings</p>
                                        {(optimizationData.excludedHoldings || []).map((item) => (
                                            <div key={item.symbol} className="mb-3 text-sm last:mb-0">
                                                <div className="font-semibold text-mm-text-primary">{item.symbol}</div>
                                                <div className="text-mm-text-secondary">{item.reason}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(optimizationData.warnings || []).length > 0 && (
                                    <div className="ui-panel-subtle p-4">
                                        <p className="ui-section-label mb-2">Warnings</p>
                                        <ul className="space-y-2 text-sm text-mm-text-secondary">
                                            {(optimizationData.warnings || []).map((warning) => (
                                                <li key={warning} className="flex gap-2">
                                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-mm-warning" />
                                                    <span>{warning}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            <PortfolioGrowthChart totalValue={portfolio?.total_value} />

            {/* Control Bar */}
            <div className="flex flex-wrap gap-4">
                <button onClick={() => setShowBuyModal(true)} className="ui-button-primary flex-1 sm:flex-none px-10 py-4 text-sm">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Buy Asset
                </button>
                <button onClick={() => fetchPortfolio(true)} disabled={refreshing} className="ui-button-secondary flex-1 sm:flex-none px-10 py-4 text-sm disabled:opacity-50">
                    {refreshing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
                    {refreshing ? 'Syncing...' : 'Force Refresh'}
                </button>
                <button onClick={handleReset} className="ui-button-destructive flex-1 sm:ml-auto px-10 py-4 text-sm">
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Reset
                </button>
            </div>

            {/* Assets Section */}
            <div className="space-y-12">
                {/* Stocks */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-semibold text-mm-text-primary flex items-center gap-3">
                            <TrendingUp className="text-mm-positive" /> Stocks
                        </h2>
                        <span className="ui-chip">{stockPositions.length} Holdings</span>
                    </div>

                    {stockPositions.length === 0 ? (
                        <div className={holdingsEmptyClass}>
                            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-mm-text-tertiary" />
                            <p className="text-mm-text-secondary font-medium">No stock positions found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {stockPositions.map((position) => (
                                <div key={position.ticker} className={`${positionCardClass} hover:border-mm-positive/35 hover:shadow-elevated`}>
                                    <div className="flex flex-col lg:flex-row items-center gap-8">
                                        <div className="w-full lg:w-40">
                                            <h3 className="text-2xl font-semibold text-mm-text-primary">{position.ticker}</h3>
                                            <p className="text-[11px] font-semibold text-mm-text-tertiary uppercase tracking-[0.14em] truncate">{position.company_name}</p>
                                        </div>

                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-6 w-full text-center md:text-left">
                                            <div><p className={metricLabelClass}>Shares</p><p className={metricValueClass}>{position.shares}</p></div>
                                            <div><p className={metricLabelClass}>Avg Cost</p><p className={metricValueClass}>{formatCurrency(position.avg_cost)}</p></div>
                                            <div><p className={metricLabelClass}>Current</p><p className="font-semibold text-mm-accent-primary">{formatCurrency(position.current_price)}</p></div>
                                            <div><p className={metricLabelClass}>Total Value</p><p className={metricValueClass}>{formatCurrency(position.current_value)}</p></div>
                                            <div className="col-span-2 md:col-span-1"><p className={metricLabelClass}>P/L</p><p className={`font-semibold ${position.total_pl >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>{formatCurrency(position.total_pl)}</p></div>
                                        </div>

                                        <button onClick={() => { setSelectedStock(position); setShowSellModal(true); }} className="ui-button-destructive w-full lg:w-auto px-8 py-2.5 text-xs">
                                            Sell
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Options */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-semibold text-mm-text-primary flex items-center gap-3">
                            <Brain className="text-mm-accent-primary" /> Options
                        </h2>
                    </div>

                    {optionsPositions.length === 0 ? (
                        <div className={`${holdingsEmptyClass} py-12`}>
                            <p className="text-mm-text-secondary font-medium">No active option contracts.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {optionsPositions.map((pos) => (
                                <div key={pos.ticker} className={`${positionCardClass} hover:border-mm-accent-primary/35 hover:shadow-elevated`}>
                                    <div className="flex flex-col lg:flex-row items-center gap-8">
                                        <div className="w-full lg:w-60">
                                            <h3 className="text-sm font-semibold break-all text-mm-text-primary">{pos.ticker}</h3>
                                            <p className="text-[11px] font-semibold text-mm-accent-primary uppercase tracking-[0.14em] mt-1">Contract Position</p>
                                        </div>

                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-6 w-full text-center md:text-left">
                                            <div><p className={metricLabelClass}>Qty</p><p className={metricValueClass}>{pos.shares}</p></div>
                                            <div><p className={metricLabelClass}>Avg Prem</p><p className={metricValueClass}>${formatNum(pos.avg_cost)}</p></div>
                                            <div>
                                                <p className={metricLabelClass}>Live Price</p>
                                                <p className={`font-semibold ${pos.current_price !== pos.avg_cost ? 'text-mm-accent-primary' : 'text-mm-text-tertiary'}`}>
                                                    ${formatNum(pos.current_price)}
                                                </p>
                                            </div>
                                            <div><p className={metricLabelClass}>Value</p><p className={metricValueClass}>{formatCurrency(pos.current_value)}</p></div>
                                            <div className="col-span-2 md:col-span-1"><p className={metricLabelClass}>Total P/L</p><p className={`font-semibold ${pos.total_pl >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>{formatCurrency(pos.total_pl)}</p></div>
                                        </div>

                                        <button onClick={() => handleManageOption(pos)} className="ui-button-destructive w-full lg:w-auto px-8 py-2.5 text-xs">
                                            Sell
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
