import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Briefcase,
  TrendingUp,
  RefreshCw,
  RotateCcw,
  BarChart3,
  Loader2,
  Search,
  AlertTriangle,
  Brain,
  TrendingDown,
  Info,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

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

/**
 * PortfolioGrowthChart: A simplified inline version of the growth chart
 */
const PortfolioGrowthChart = () => {
    const data = [
        { date: 'Mon', value: 98000 },
        { date: 'Tue', value: 99500 },
        { date: 'Wed', value: 97000 },
        { date: 'Thu', value: 101000 },
        { date: 'Fri', value: 103450 },
    ];

    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Portfolio Performance</h3>
            <div className="h-48 w-full flex items-end gap-2 px-2">
                {data.map((d, i) => {
                    const height = ((d.value - minValue) / range) * 100;
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative">
                            <div
                                className="w-full bg-green-500/20 hover:bg-green-500/40 border-t-2 border-green-500 transition-all duration-500 rounded-t-sm"
                                style={{ height: `${Math.max(height, 5)}%` }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10">
                                    {formatCurrency(d.value)}
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-500 mt-2 uppercase font-bold">{d.date}</span>
                        </div>
                    );
                })}
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
    const [tradeHistory, setTradeHistory] = useState([]);
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

    const fetchTradeHistory = async () => {
        try {
            const baseUrl = 'http://127.0.0.1:5001';
            const response = await fetch(`${baseUrl}/paper/transactions`);
            if (!response.ok) throw new Error("History fetch failed");
            const data = await response.json();
            setTradeHistory(data || []);
        } catch (err) {
            console.error('Error fetching trade history:', err);
        }
    };

    useEffect(() => {
        fetchPortfolio();
        fetchTradeHistory();
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
                fetchTradeHistory();
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
                fetchTradeHistory();
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
            fetchTradeHistory();
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
            fetchTradeHistory();
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
                    <PortfolioGrowthChart />
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

                {/* Modal Forms */}
                {showBuyModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-md" onClick={() => setShowBuyModal(false)}>
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <h2 className="text-3xl font-black mb-8">Buy Stock</h2>
                            <form onSubmit={handleBuy} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Symbol</label>
                                    <input type="text" value={buyTicker} onChange={(e) => setBuyTicker(e.target.value.toUpperCase())} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. AAPL" required />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Shares</label>
                                    <input type="number" value={buyShares} onChange={(e) => setBuyShares(e.target.value)} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-green-500" placeholder="10" min="0.01" step="0.01" required />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="submit" className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-600/30">Place Order</button>
                                    <button type="button" onClick={() => setShowBuyModal(false)} className="px-8 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showSellModal && selectedStock && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-md" onClick={() => setShowSellModal(false)}>
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <h2 className="text-3xl font-black mb-2">Sell {selectedStock.ticker}</h2>
                            <p className="text-gray-400 font-bold mb-8 italic">Available: {selectedStock.shares} shares</p>
                            <form onSubmit={handleSell} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Shares to Liquidate</label>
                                    <input type="number" value={sellShares} onChange={(e) => setSellShares(e.target.value)} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-red-500" max={selectedStock.shares} min="0.01" step="0.01" required />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="submit" className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-600/30">Confirm Sale</button>
                                    <button type="button" onClick={() => setShowSellModal(false)} className="px-8 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}