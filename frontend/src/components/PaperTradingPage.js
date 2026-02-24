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
                const response = await fetch(`http://127.0.0.1:5001/paper/history?period=${activePeriod}`);
                const data = await response.json();

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
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y) }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#94a3b8', font: { size: 10, weight: 'bold' } } },
                y: { position: 'right', grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 }, callback: (val) => '$' + val.toLocaleString() } }
            },
            interaction: { intersect: false, mode: 'index' },
        };

        return { data, options };
    }, [history, activePeriod]);

    if (!history) return <div className="h-64 flex items-center justify-center text-gray-400">Loading Chart...</div>;

    // --- RE-CALCULATE METRICS ON FRONTEND ---
    const startVal = history.values[0];
    const endVal = history.values[history.values.length - 1];
    const valChange = endVal - startVal;
    const pctChange = startVal !== 0 ? (valChange / startVal) * 100 : 0;
    const isPositive = valChange >= 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Portfolio Performance</h2>
                    {isSimulated && (
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Projected View
                        </span>
                    )}
                </div>
                {/* Timeframe Selector */}
                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
                    {portfolioTimeFrames.map((frame) => (
                        <button
                            key={frame.value}
                            onClick={() => setActivePeriod(frame.value)}
                            className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                                activePeriod === frame.value 
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                        >
                            {frame.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Bar - Calculated from displayed data */}
            <div className={`flex justify-between items-center px-4 py-2 rounded-t-xl mb-0 shadow-sm text-white ${isPositive ? 'bg-green-600' : 'bg-red-600'}`}>
                <span className="text-xs font-bold">
                    {history.dates.length > 0 ? new Date(history.dates[0]).toLocaleDateString() : ''} - Today
                </span>
                <span className="text-xs font-black">
                    {isPositive ? '+' : ''}{formatCurrency(valChange)} ({pctChange.toFixed(2)}%)
                </span>
            </div>

            {/* Chart Canvas */}
            <div className="h-72 w-full bg-gray-50/50 dark:bg-gray-900/20 rounded-b-xl border border-t-0 border-gray-100 dark:border-gray-700/50 p-2">
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

        const success = await onConfirmTrade(contract.contractSymbol || contract.ticker, numQuantity, price, isBuy);

        if (success) {
            onClose();
        } else {
            setError('Trade failed. Check portfolio for details.');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <h2 className={`text-2xl font-bold mb-2 ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                    {isBuy ? 'Buy to Open' : 'Sell to Close'}
                </h2>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{contract.contractSymbol || contract.ticker}</p>
                {stockPrice && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Underlying Price: ${formatNum(stockPrice)}
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Quantity (1 contract = 100 shares)
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="1"
                            min="1"
                            step="1"
                            required
                        />
                    </div>
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex justify-between text-gray-700 dark:text-gray-300">
                            <span>Market Price:</span>
                            <span className="font-medium">${formatNum(price)}</span>
                        </div>
                        <div className="flex justify-between text-gray-900 dark:text-white font-bold text-lg mt-2">
                            <span>Estimated {isBuy ? 'Cost' : 'Credit'}:</span>
                            <span>${totalCost}</span>
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-all">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || price <= 0}
                            className={`flex-1 px-6 py-3 text-white rounded-lg font-semibold transition-all ${
                                (loading || price <= 0) ? 'bg-gray-400 cursor-not-allowed' : (isBuy ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')
                            }`}
                        >
                            {loading ? 'Submitting...' : (price <= 0 ? 'Unavailable' : `Confirm ${isBuy ? 'Buy' : 'Sell'}`)}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MAIN APPLICATION COMPONENT ---
export default function App() {
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

    const fetchPortfolio = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const baseUrl = 'http://127.0.0.1:5001';
            const response = await fetch(`${baseUrl}/paper/portfolio`);
            if (!response.ok) throw new Error("Portfolio fetch failed");
            const data = await response.json();

            // Log to console so you can see the raw data coming from the backend
            console.log("Latest Portfolio Data:", data);

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

    const handleBuy = async (e) => {
        e.preventDefault();
        setTradeMessage({ type: '', text: '' });
        try {
            const response = await fetch('http://127.0.0.1:5001/paper/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: buyTicker.toUpperCase(), shares: parseFloat(buyShares) })
            });
            const data = await response.json();
            if (response.ok) {
                setTradeMessage({ type: 'success', text: data.message });
                setBuyTicker('');
                setBuyShares('');
                setShowBuyModal(false);
                fetchPortfolio();
            } else {
                setTradeMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setTradeMessage({ type: 'error', text: 'Failed to execute trade' });
        }
    };

    const handleSell = async (e) => {
        e.preventDefault();
        setTradeMessage({ type: '', text: '' });
        try {
            const response = await fetch('http://127.0.0.1:5001/paper/sell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: selectedStock.ticker, shares: parseFloat(sellShares) })
            });
            const data = await response.json();
            if (response.ok) {
                setTradeMessage({ type: 'success', text: data.message });
                setSellShares('');
                setShowSellModal(false);
                setSelectedStock(null);
                fetchPortfolio();
            } else {
                setTradeMessage({ type: 'error', text: data.error });
            }
        } catch (err) {
            setTradeMessage({ type: 'error', text: 'Failed to execute trade' });
        }
    };

    const handleConfirmOptionSell = async (contractSymbol, quantity, price, isBuy) => {
        if (isBuy) return false;
        const body = JSON.stringify({
            contractSymbol: contractSymbol,
            quantity: quantity,
            price: price
        });
        try {
            const response = await fetch(`http://127.0.0.1:5001/paper/options/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Trade failed');
            setTradeMessage({ type: 'success', text: data.message });
            fetchPortfolio();
            return true;
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message });
            return false;
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
            const response = await fetch('http://127.0.0.1:5001/paper/reset', { method: 'POST' });
            const data = await response.json();
            setTradeMessage({ type: 'success', text: data.message });
            fetchPortfolio();
        } catch (err) {
            setTradeMessage({ type: 'error', text: 'Failed to reset portfolio' });
        }
    };

    if (loading && !portfolio) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 text-center">
                <div>
                    <Loader2 className="h-12 w-12 text-green-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Syncing with Local Server...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans selection:bg-green-100 selection:text-green-900">
            {isOptionModalOpen && (
                <TradeModal
                    contract={selectedOption}
                    tradeType="Sell"
                    stockPrice={null}
                    onClose={() => setIsOptionModalOpen(false)}
                    onConfirmTrade={handleConfirmOptionSell}
                />
            )}

            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                    <div className="text-left">
                        <div className="inline-flex items-center justify-center p-2 bg-green-100 dark:bg-green-900/30 rounded-xl mb-3">
                            <Briefcase className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight mb-2">Paper Trading</h1>
                        <p className="text-gray-500 dark:text-gray-400">Practice with virtual funds using live market data.</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Synced</p>
                            <p className="text-sm font-black text-gray-700 dark:text-gray-300">{lastUpdated || '--:--'}</p>
                        </div>
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${refreshing ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {refreshing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                        </div>
                    </div>
                </div>

                {/* Status Message */}
                {tradeMessage.text && (
                    <div className={`mb-8 p-4 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-top duration-300 ${
                        tradeMessage.type === 'success' 
                            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                    }`}>
                        <div className={`p-2 rounded-lg ${tradeMessage.type === 'success' ? 'bg-green-200 dark:bg-green-800' : 'bg-red-200 dark:bg-red-800'}`}>
                            {tradeMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <span className="font-bold text-sm">{tradeMessage.text}</span>
                        <button onClick={() => setTradeMessage({type: '', text: ''})} className="ml-auto opacity-40 hover:opacity-100">
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Top Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-6 text-white shadow-2xl shadow-black/20">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Portfolio Value</p>
                        <p className="text-3xl font-black mb-2">{formatCurrency(portfolio?.total_value)}</p>
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${ (portfolio?.total_pl || 0) >= 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white' }`}>
                            {(portfolio?.total_pl || 0) >= 0 ? '▲' : '▼'} {formatNum(portfolio?.total_return)}%
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cash Balance</p>
                        <p className="text-2xl font-black">{formatCurrency(portfolio?.cash)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stocks</p>
                        <p className="text-2xl font-black">{formatCurrency(portfolio?.positions_value)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Options</p>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(portfolio?.options_value)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">System Status</p>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit ${refreshing ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                             <div className={`h-2 w-2 rounded-full ${refreshing ? 'bg-blue-600 animate-pulse' : 'bg-green-600'}`}></div>
                             <span className="text-[10px] font-black uppercase">{refreshing ? 'Fetching Data' : 'Active'}</span>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <PortfolioGrowthChart totalValue={portfolio?.total_value} />
                </div>

                {/* Control Bar */}
                <div className="flex flex-wrap gap-4 mb-10">
                    <button onClick={() => setShowBuyModal(true)} className="flex-1 sm:flex-none px-10 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-green-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <TrendingUp className="w-5 h-5" />
                        Buy Asset
                    </button>
                    <button onClick={() => fetchPortfolio(true)} disabled={refreshing} className="flex-1 sm:flex-none px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                        {refreshing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        {refreshing ? 'Syncing...' : 'Force Refresh'}
                    </button>
                    <button onClick={handleReset} className="flex-1 sm:ml-auto px-10 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-black text-sm hover:bg-red-600 hover:text-white transition-all">
                        <RotateCcw className="w-5 h-5 mr-2 inline" />
                        Reset
                    </button>
                </div>

                {/* Assets Section */}
                <div className="space-y-12">
                    {/* Stocks */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black flex items-center gap-3">
                                <TrendingUp className="text-green-500" /> Stocks
                            </h2>
                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-black text-gray-500 uppercase">{stockPositions.length} Holdings</span>
                        </div>

                        {stockPositions.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl py-20 text-center">
                                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p className="text-gray-400 font-bold">No stock positions found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {stockPositions.map((position) => (
                                    <div key={position.ticker} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 hover:border-green-500 transition-all shadow-sm">
                                        <div className="flex flex-col lg:flex-row items-center gap-8">
                                            <div className="w-full lg:w-40">
                                                <h3 className="text-2xl font-black">{position.ticker}</h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{position.company_name}</p>
                                            </div>

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-6 w-full text-center md:text-left">
                                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Shares</p><p className="font-bold">{position.shares}</p></div>
                                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Avg Cost</p><p className="font-bold">{formatCurrency(position.avg_cost)}</p></div>
                                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Current</p><p className="font-bold text-blue-500">{formatCurrency(position.current_price)}</p></div>
                                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Value</p><p className="font-bold">{formatCurrency(position.current_value)}</p></div>
                                                <div className="col-span-2 md:col-span-1"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">P/L</p><p className={`font-black ${position.total_pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(position.total_pl)}</p></div>
                                            </div>

                                            <button onClick={() => { setSelectedStock(position); setShowSellModal(true); }} className="w-full lg:w-auto px-8 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-black text-xs hover:bg-red-500 hover:text-white transition-all">Sell</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Options */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black flex items-center gap-3">
                                <Brain className="text-blue-500" /> Options
                            </h2>
                        </div>

                        {optionsPositions.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl py-12 text-center text-gray-400 font-bold">
                                No active option contracts.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {optionsPositions.map((pos) => (
                                    <div key={pos.ticker} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 hover:border-blue-500 transition-all shadow-sm">
                                        <div className="flex flex-col lg:flex-row items-center gap-8">
                                            <div className="w-full lg:w-60">
                                                <h3 className="text-sm font-black break-all">{pos.ticker}</h3>
                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Contract Position</p>
                                            </div>

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-6 w-full text-center md:text-left">
                                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Qty</p><p className="font-bold">{pos.shares}</p></div>
                                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Avg Prem</p><p className="font-bold">${formatNum(pos.avg_cost)}</p></div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Live Price</p>
                                                    <p className={`font-black ${pos.current_price !== pos.avg_cost ? 'text-blue-500' : 'text-gray-400'}`}>
                                                        ${formatNum(pos.current_price)}
                                                    </p>
                                                </div>
                                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Value</p><p className="font-bold">{formatCurrency(pos.current_value)}</p></div>
                                                <div className="col-span-2 md:col-span-1"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total P/L</p><p className={`font-black ${pos.total_pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(pos.total_pl)}</p></div>
                                            </div>

                                            <button onClick={() => handleManageOption(pos)} className="w-full lg:w-auto px-8 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all">Sell</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};