import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// --- REGISTER CHARTJS COMPONENTS ---
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip,
  Legend, Filler
);

// --- HELPER FUNCTIONS ---
const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatNum = (num, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    const parsed = parseFloat(num);
    return isNaN(parsed) ? '0.00' : parsed.toFixed(digits);
};

const formatPercent = (num, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00%';
    return `${formatNum(Number(num) * 100, digits)}%`;
};

const optimizationMethods = [
    { key: 'black_litterman', label: 'Black-Litterman' },
    { key: 'max_sharpe', label: 'Max Sharpe' },
    { key: 'min_vol', label: 'Min Vol' },
    { key: 'hrp', label: 'HRP' },
];

// --- ROBUST PORTFOLIO GRAPH COMPONENT ---
const portfolioTimeFrames = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y', value: '1y' },
];

const PortfolioGrowthChart = ({ totalValue }) => {
    const [history, setHistory] = useState(null);
    const [activePeriod, setActivePeriod] = useState('1m');
    const [isSimulated, setIsSimulated] = useState(false);
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const chartTextColor = isDarkMode ? '#CBD5E1' : '#64748B';
    const chartGridColor = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.14)';
    const tooltipBackground = isDarkMode ? '#020617' : 'rgba(15, 23, 42, 0.9)';

    // --- MOCK DATA GENERATOR ---
    const generateMockHistory = useCallback((period) => {
        const pointsMap = { '1d': 24, '1w': 7, '1m': 30, '3m': 90, 'ytd': 120, '1y': 365 };
        const points = pointsMap[period] || 30;
        const now = new Date();
        const dates = [];
        const values = [];

        // ANCHOR LOGIC:
        const endPrice = totalValue || 100000;
        let startPrice = 100000;

        // For short term, start near current. For long term, start at 100k factory reset.
        if (period === '1d') {
            startPrice = endPrice * (1 + (Math.random() * 0.01 - 0.005));
        } else if (period === '1w') {
            startPrice = endPrice * (1 + (Math.random() * 0.04 - 0.02));
        } else {
            startPrice = 100000;
        }

        // Generate Bridge
        for (let i = 0; i <= points; i++) {
            const date = new Date(now);
            if (period === '1d') date.setHours(date.getHours() - (points - i));
            else date.setDate(date.getDate() - (points - i));
            dates.push(date.toISOString());

            // Brownian Bridge Interpolation
            const progress = i / points;
            const linearTrend = startPrice + (endPrice - startPrice) * progress;
            const noiseMagnitude = (endPrice * 0.02);
            const noise = (Math.random() - 0.5) * noiseMagnitude * Math.sin(progress * Math.PI);

            values.push(linearTrend + noise);
        }

        // Force precise endpoints
        values[0] = startPrice;
        values[values.length - 1] = endPrice;

        return { dates, values };
    }, [totalValue]);

    // Effect to fetch data whenever activePeriod or totalValue changes
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const data = await apiRequest(API_ENDPOINTS.PORTFOLIO_HISTORY(activePeriod));

                if (isMounted) {
                    if (!data.error && data.dates && data.dates.length > 2) {
                        setHistory({ dates: data.dates, values: data.values });
                        setIsSimulated(false);
                    } else {
                        setHistory(generateMockHistory(activePeriod));
                        setIsSimulated(true);
                    }
                }
            } catch (error) {
                if (isMounted) {
                    setHistory(generateMockHistory(activePeriod));
                    setIsSimulated(true);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [activePeriod, totalValue, generateMockHistory]);

    const chartConfig = useMemo(() => {
        if (!history) return null;

        const labels = history.dates.map(d => {
            const date = new Date(d);
            return activePeriod === '1d'
                ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        });

        const data = {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: history.values,
                borderColor: '#16a34a',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                fill: {
                    target: 'origin',
                    above: 'rgba(22, 163, 74, 0.1)',
                }
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: tooltipBackground,
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y) }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: chartTextColor, font: { size: 10, weight: 'bold' } } },
                y: { position: 'right', grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 10 }, callback: (val) => '$' + val.toLocaleString() } }
            },
            interaction: { intersect: false, mode: 'index' },
        };

        return { data, options };
    }, [activePeriod, chartGridColor, chartTextColor, history, tooltipBackground]);

    if (!history) return <div className="h-64 flex items-center justify-center text-mm-text-secondary">Loading Chart...</div>;

    // --- RE-CALCULATE METRICS ON FRONTEND ---
    const startVal = history.values[0];
    const endVal = history.values[history.values.length - 1];
    const valChange = endVal - startVal;
    const pctChange = startVal !== 0 ? (valChange / startVal) * 100 : 0;
    const isPositive = valChange >= 0;

    return (
        <div className="ui-panel p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <p className="ui-section-label mb-2">Performance</p>
                    <h2 className="text-lg font-semibold text-mm-text-primary">Portfolio Performance</h2>
                    {isSimulated && (
                        <span className="ui-status-chip mt-3 border border-mm-accent-primary/15 bg-mm-accent-primary/10 text-mm-accent-primary">
                            Projected View
                        </span>
                    )}
                </div>
                {/* Timeframe Selector */}
                <div className="flex rounded-control border border-mm-border bg-mm-surface-subtle p-1">
                    {portfolioTimeFrames.map((frame) => (
                        <button
                            key={frame.value}
                            onClick={() => setActivePeriod(frame.value)}
                            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                activePeriod === frame.value 
                                ? 'bg-mm-accent-primary text-white shadow-card' 
                                : 'text-mm-text-secondary hover:bg-mm-surface hover:text-mm-text-primary'
                            }`}
                        >
                            {frame.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Bar - Calculated from displayed data */}
            <div className={`flex justify-between items-center px-4 py-2 rounded-control mb-3 ${isPositive ? 'bg-mm-positive/12 text-mm-positive' : 'bg-mm-negative/12 text-mm-negative'}`}>
                <span className="text-xs font-semibold">
                    {history.dates.length > 0 ? new Date(history.dates[0]).toLocaleDateString() : ''} - Today
                </span>
                <span className="text-xs font-semibold">
                    {isPositive ? '+' : ''}{formatCurrency(valChange)} ({pctChange.toFixed(2)}%)
                </span>
            </div>

            {/* Chart Canvas */}
            <div className="h-72 w-full rounded-control border border-mm-border bg-mm-surface-subtle p-2">
                {chartConfig && <Line data={chartConfig.data} options={chartConfig.options} />}
            </div>
        </div>
    );
};

/**
 * TradeModal: Handles buying/selling logic for options and stocks
 */
const TradeModal = ({ contract, tradeType, stockPrice, onClose, onConfirmTrade }) => {
    const [quantity, setQuantity] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!contract) return null;

    const isBuy = tradeType === 'Buy';
    const price = isBuy ? (contract.ask || contract.current_price || 0) : (contract.bid || contract.current_price || 0);
    const totalCost = ( (price || 0) * (parseFloat(quantity) || 0) * 100).toFixed(2);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const numQuantity = parseInt(quantity);
        if (isNaN(numQuantity) || numQuantity <= 0) {
            setError('Please enter a valid quantity.');
            setLoading(false);
            return;
        }

       if (price <= 0) {
            setError('Cannot trade with $0.00 price. Market may be closed or illiquid.');
            setLoading(false);
            return;
        }

        const result = await onConfirmTrade(contract.contractSymbol || contract.ticker, numQuantity, price, isBuy);

        if (result?.success) {
            onClose();
        } else {
            setError(result?.errorMessage || 'Trade failed. Check portfolio for details.');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" onClick={onClose}>
            <div className="ui-panel max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200 p-8" onClick={(e) => e.stopPropagation()}>
                <h2 className={`text-2xl font-semibold mb-2 ${isBuy ? 'text-mm-accent-primary' : 'text-mm-negative'}`}>
                    {isBuy ? 'Buy to Open' : 'Sell to Close'}
                </h2>
                <p className="text-lg font-semibold text-mm-text-primary">{contract.contractSymbol || contract.ticker}</p>
                {stockPrice && (
                    <p className="text-sm text-mm-text-secondary mb-6">
                        Underlying Price: ${formatNum(stockPrice)}
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-mm-text-secondary mb-2">
                            Quantity (1 contract = 100 shares)
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="ui-input"
                            placeholder="1"
                            min="1"
                            step="1"
                            required
                        />
                    </div>
                    <div className="ui-panel-subtle mb-6 p-4">
                        <div className="flex justify-between text-mm-text-secondary">
                            <span>Market Price:</span>
                            <span className="font-medium">${formatNum(price)}</span>
                        </div>
                        <div className="flex justify-between text-mm-text-primary font-semibold text-lg mt-2">
                            <span>Estimated {isBuy ? 'Cost' : 'Credit'}:</span>
                            <span>${totalCost}</span>
                        </div>
                    </div>

                    {error && <p className="text-mm-negative text-sm text-center mb-4">{error}</p>}

                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="ui-button-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || price <= 0}
                            className={`flex-1 ${(loading || price <= 0) ? 'ui-button-secondary cursor-not-allowed opacity-60' : (isBuy ? 'ui-button-primary' : 'ui-button-destructive')}`}
                            aria-disabled={loading || price <= 0}
                        >
                            {loading ? 'Submitting...' : (price <= 0 ? 'Unavailable' : `Confirm ${isBuy ? 'Buy' : 'Sell'}`)}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

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
export default function App({ initialTicker, onConsumeInitialTicker }) {
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
