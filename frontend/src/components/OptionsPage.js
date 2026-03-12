'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, 
    AlertTriangle, 
    Brain, 
    TrendingUp, 
    TrendingDown, 
    Info, 
    CheckCircle, 
    XCircle, 
    Loader2, 
    BarChart2, 
    Activity 
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// Helper to format numbers or return 'N/A'
const formatNum = (num, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return Number(num).toFixed(digits);
};

// --- TRADE MODAL COMPONENT ---
export const TradeModal = ({ contract, tradeType, stockPrice, onClose, onConfirmTrade }) => {
    const [quantity, setQuantity] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!contract) return null;

    const isBuy = tradeType === 'Buy';
    // Use 'ask' for buying, 'bid' for selling (or lastPrice if bid is 0)
    const price = isBuy ? (contract.ask || contract.currentPrice || 0) : (contract.bid || contract.currentPrice || 0);
    const totalCost = ((price || 0) * (parseFloat(quantity) || 0) * 100).toFixed(2);
    
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
        
        const success = await onConfirmTrade(contract.contractSymbol, numQuantity, price, isBuy);
       
        if (success) {
            onClose();
        } else {
            setError('Trade failed. Check portfolio for details.');
        }
        setLoading(false);
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" 
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200 shadow-2xl" 
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className={`text-2xl font-bold mb-2 ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                    {isBuy ? 'Buy to Open' : 'Sell to Close'}
                </h2>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{contract.contractSymbol}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {`Underlying Price: $${formatNum(stockPrice)}`}
                </p>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Quantity (1 contract = 100 shares)
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                            placeholder="1"
                            min="1"
                            step="1"
                            required
                        />
                    </div>
                    <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-2">
                            <span>Limit Price:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">${formatNum(price)}</span>
                        </div>
                        <div className="flex justify-between text-gray-900 dark:text-white font-black text-xl pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span>Estimated {isBuy ? 'Cost' : 'Credit'}:</span>
                            <span>${totalCost}</span>
                        </div>
                    </div>
                    
                    {error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
                    
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || price <= 0}
                            className={`flex-1 px-6 py-3.5 text-white rounded-xl font-bold transition-all shadow-lg ${
                                (loading || price <= 0) ? 'bg-gray-400 cursor-not-allowed shadow-none' : (isBuy ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20')
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

// --- SUGGESTION CARD COMPONENT ---
const SuggestionCard = ({ suggestion, onTrade }) => {
    if (!suggestion || suggestion.suggestion === "Hold") {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center">
                    <Info className="w-8 h-8 text-blue-500 mr-4" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Analysis Complete</h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            {suggestion ? suggestion.reason : "No strong signal found. Hold."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const {
        suggestion: tradeType,
        reason,
        confidence,
        contract,
        targets
    } = suggestion;

    const isCall = tradeType === "Buy Call";
    const confidenceColors = {
        Low: "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
        Medium: "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
        High: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    };

    return (
        <div className={`rounded-2xl shadow-lg p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 border-2 ${confidenceColors[confidence]}`}>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div className="flex items-center">
                    <Brain className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">AI Quant Suggestion</h2>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider bg-white/50 dark:bg-black/20`}>
                    {confidence} Confidence
                </span>
            </div>

            <p className="text-gray-800 dark:text-gray-200 mb-8 text-lg leading-relaxed">{reason}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: The Trade */}
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Suggested Action</h3>
                    <div className="flex items-center mb-6">
                        {isCall ? (
                            <TrendingUp className="w-12 h-12 text-green-500 mr-4" />
                        ) : (
                            <TrendingDown className="w-12 h-12 text-red-500 mr-4" />
                        )}
                        <span className={`text-3xl font-black tracking-tight ${isCall ? 'text-green-600' : 'text-red-600'}`}>
                            {tradeType}
                        </span>
                    </div>
                    <button
                        onClick={() => onTrade(contract, 'Buy')}
                        className={`w-full px-4 py-3 text-white font-bold rounded-xl transition-all shadow-lg ${isCall ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}
                    >
                        Trade Contract
                    </button>
                </div>

                {/* Column 2: Contract Details */}
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Contract Data</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">Strike Price:</span>
                            <span className="font-bold text-gray-900 dark:text-white">${formatNum(contract.strikePrice)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">Expiration:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{contract.expirationDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">Premium (Ask):</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">${formatNum(contract.currentPrice || contract.ask)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                            <span className="text-gray-500 dark:text-gray-400">Implied Volatility:</span>
                            <span className="font-bold text-orange-500">{contract.impliedVolatility || 'N/A'}%</span>
                        </div>
                    </div>
                </div>
                
                {/* Column 3: Targets */}
                <div className="bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Risk Parameters</h3>
                    <div className="space-y-5">
                        <div className="flex items-start bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                            <XCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <span className="text-xs font-bold text-red-800 dark:text-red-400 uppercase">Stop Loss</span>
                                <p className="font-medium text-sm text-gray-800 dark:text-gray-200 mt-1">{targets.stopLoss}</p>
                            </div>
                        </div>
                        <div className="flex items-start bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <span className="text-xs font-bold text-green-800 dark:text-green-400 uppercase">Take Profit</span>
                                <p className="font-medium text-sm text-gray-800 dark:text-gray-200 mt-1">{targets.takeProfit}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SLEEK CHAIN TABLE COMPONENT ---
const ChainTable = ({ data, type, stockPrice, onTradeClick, ownedPositions }) => {
    const headerColor = type === 'Calls' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const chainContainerRef = useRef(null);

    // Filter to only show strikes within 15% of current price to reduce clutter
    const filteredAndSortedData = useMemo(() => {
        if (!data || !stockPrice) return [];
        const upperBound = stockPrice * 1.15;
        const lowerBound = stockPrice * 0.85;
        
        return data
            .filter(c => c.strike >= lowerBound && c.strike <= upperBound)
            .sort((a, b) => b.strike - a.strike); 
    }, [data, stockPrice]);

    // Scroll to ATM strike
    useEffect(() => {
        if (stockPrice && chainContainerRef.current && filteredAndSortedData.length > 0) {
            let closestIndex = 0;
            let minDiff = Infinity;
            
            filteredAndSortedData.forEach((contract, index) => {
                const diff = Math.abs(contract.strike - stockPrice);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = index;
                }
            });

            const rowElement = chainContainerRef.current.querySelector(`[data-index="${closestIndex}"]`);
            if (rowElement) {
                rowElement.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
    }, [filteredAndSortedData, stockPrice]);

    return (
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/80 dark:bg-gray-800/80`}>
                <h3 className={`text-xl font-black tracking-tight flex items-center gap-2 ${headerColor}`}>
                    {type === 'Calls' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    {type}
                </h3>
                <span className="text-[11px] uppercase font-bold tracking-wider text-gray-500 bg-gray-200 dark:bg-gray-700 px-3 py-1.5 rounded-full">
                    ±15% from ATM
                </span>
            </div>
            
            <div ref={chainContainerRef} className="overflow-y-auto max-h-[600px] custom-scrollbar">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50/95 dark:bg-gray-900/95 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="px-5 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Action</th>
                            <th className="px-5 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Strike</th>
                            <th className="px-5 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Bid / Ask</th>
                            <th className="px-5 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Vol / OI</th>
                            <th className="px-5 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">IV</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50">
                        {filteredAndSortedData.map((contract, index) => { 
                            const isITM = stockPrice ? 
                                (type === 'Calls' ? contract.strike < stockPrice : contract.strike > stockPrice) 
                                : false;
                            
                            const owned = ownedPositions[contract.contractSymbol];
                            
                            const moneyness = stockPrice ? Math.abs((contract.strike - stockPrice) / stockPrice) * 100 : 0;
                            const isATM = moneyness < 1.5; 
                            
                            return (
                                <tr 
                                    key={contract.contractSymbol} 
                                    data-index={index} 
                                    className={`
                                        group transition-colors
                                        ${isITM ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''} 
                                        ${isATM ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}
                                        ${owned ? 'border-l-4 border-l-yellow-500 bg-yellow-50/60 dark:bg-yellow-900/20' : ''}
                                        hover:bg-gray-50 dark:hover:bg-gray-700/50
                                    `}
                                >
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm ${type === 'Calls' ? 'bg-green-100 text-green-700 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white' : 'bg-red-100 text-red-700 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white'}`}
                                                onClick={() => onTradeClick(contract, 'Buy')}
                                            >
                                                Trade
                                            </button>
                                            {owned && (
                                                <button 
                                                    className="px-4 py-2 bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800 text-xs font-bold rounded-lg hover:opacity-80 transition-opacity shadow-sm"
                                                    onClick={() => onTradeClick(contract, 'Sell')}
                                                >
                                                    Close
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <span className={`font-black text-lg ${isITM ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                                ${formatNum(contract.strike)}
                                            </span>
                                            {isATM && <span className="text-[10px] uppercase font-black tracking-widest text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">ATM</span>}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">${formatNum(contract.ask)} <span className="text-xs text-gray-400 font-medium ml-1">Ask</span></span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${formatNum(contract.bid)} Bid</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                                <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
                                                {contract.volume || 0}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">OI: {contract.openInterest || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <Activity className={`w-4 h-4 ${(contract.impliedVolatility || 0) > 0.5 ? 'text-orange-500' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-semibold ${(contract.impliedVolatility || 0) > 0.5 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {contract.impliedVolatility ? (contract.impliedVolatility * 100).toFixed(1) + '%' : 'N/A'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const OptionsPage = () => {
    const [ticker, setTicker] = useState('');
    const [expirations, setExpirations] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [chain, setChain] = useState(null);
    const [stockPrice, setStockPrice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContract, setModalContract] = useState(null);
    const [modalTradeType, setModalTradeType] = useState('Buy');
    const [tradeMessage, setTradeMessage] = useState({ type: '', text: '' });

    const [ownedPositions, setOwnedPositions] = useState({});
    
    const [suggestion, setSuggestion] = useState(null);
    const [suggestionLoading, setSuggestionLoading] = useState(false);

    const fetchOwnedPositions = async () => {
        try {
            const data = await apiRequest(API_ENDPOINTS.PORTFOLIO);
            const optionsMap = (data.options_positions || []).reduce((acc, pos) => {
                acc[pos.ticker] = pos; 
                return acc;
            }, {});
            setOwnedPositions(optionsMap);
        } catch (err) {
            console.error("Could not fetch portfolio for options page:", err);
        }
    };

    const fetchSuggestion = async (tickerToFetch) => {
        setSuggestionLoading(true);
        try {
            const data = await apiRequest(API_ENDPOINTS.OPTIONS_SUGGEST(tickerToFetch));
            setSuggestion(data);
        } catch (err) {
            setSuggestion({ suggestion: "Hold", reason: err.message || "Error fetching suggestion." });
        } finally {
            setSuggestionLoading(false);
        }
    };

    const handleSearchTicker = async (e) => {
        e.preventDefault();
        if (!ticker) return;

        setLoading(true);
        setError('');
        setChain(null);
        setExpirations([]);
        setSelectedDate('');
        setStockPrice(null);
        setTradeMessage({ type: '', text: '' });
        
        setSuggestion(null);
        fetchSuggestion(ticker); 
        
        fetchOwnedPositions(); 

        try {
            const expData = await apiRequest(API_ENDPOINTS.OPTIONS(ticker));
            setExpirations(expData);
            
            if (expData.length > 0) {
                setSelectedDate(expData[0]);
                await fetchChain(ticker, expData[0]);
            } else {
                setLoading(false);
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
            setSuggestionLoading(false); 
        }
    };

    const fetchChain = async (tickerToFetch, date) => {
        setLoading(true);
        setError('');
        setChain(null);
        try {
            const chainData = await apiRequest(API_ENDPOINTS.OPTIONS_CHAIN(tickerToFetch, date));
            setChain(chainData);
            setStockPrice(chainData.stock_price); 
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (e) => {
        const newDate = e.target.value;
        setSelectedDate(newDate);
        fetchChain(ticker, newDate);
    };

    const handleTradeClick = (contract, tradeType) => {
        setModalContract(contract);
        setModalTradeType(tradeType);
        setIsModalOpen(true);
    };

    const handleConfirmTrade = async (contractSymbol, quantity, price, isBuy) => {
        const endpoint = isBuy ? API_ENDPOINTS.PAPER_OPTIONS_BUY : API_ENDPOINTS.PAPER_OPTIONS_SELL;
        const body = JSON.stringify({
            contractSymbol: contractSymbol,
            quantity: quantity,
            price: price
        });
        
        try {
            const data = await apiRequest(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            setTradeMessage({ type: 'success', text: data.message });
            fetchOwnedPositions();
            return true;
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message });
            return false;
        }
    };

    return (
        <>
            {isModalOpen && (
                <TradeModal
                    contract={modalContract}
                    tradeType={modalTradeType}
                    stockPrice={stockPrice}
                    onClose={() => setIsModalOpen(false)}
                    onConfirmTrade={handleConfirmTrade}
                />
            )}
        
            <div className="container mx-auto px-6 py-8 max-w-7xl">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
                        Options Intelligence
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Analyze option chains and receive AI-driven quantitative trade suggestions.
                    </p>
                </div>

                {/* Search Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <form onSubmit={handleSearchTicker} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="Search ticker (e.g., AAPL)"
                                className="w-full px-5 py-4 pl-14 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-lg font-medium transition-all"
                            />
                            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || suggestionLoading}
                            className={`px-10 py-4 rounded-xl font-bold text-lg text-white transition-all shadow-lg ${loading || suggestionLoading ? 'bg-gray-400 shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 hover:-translate-y-0.5'}`}
                        >
                            {loading || suggestionLoading ? 'Loading...' : 'Analyze'}
                        </button>
                    </form>
                </div>
                
                {tradeMessage.text && (
                    <div className={`mb-8 p-5 rounded-xl animate-in fade-in slide-in-from-top-2 border-2 ${
                        tradeMessage.type === 'success' 
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                    }`}>
                        <div className="flex items-center gap-3 font-semibold">
                            {tradeMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            {tradeMessage.text}
                        </div>
                    </div>
                )}

                {/* Suggestion Rendering */}
                {suggestionLoading && (
                    <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Running Quantitative Analysis...</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">Training random forest model and calculating implied volatility.</p>
                    </div>
                )}
                {suggestion && !suggestionLoading && (
                    <SuggestionCard 
                        suggestion={suggestion} 
                        onTrade={handleTradeClick}
                    />
                )}

                {error && <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl font-semibold mb-8">{error}</div>}

                {expirations.length > 0 && (
                    <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in duration-500">
                        <div className="w-full md:w-auto">
                            <label htmlFor="expiration" className="block text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Expiration Date
                            </label>
                            <select
                                id="expiration"
                                value={selectedDate}
                                onChange={handleDateChange}
                                className="w-full md:w-64 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium cursor-pointer"
                            >
                                {expirations.map(date => (
                                    <option key={date} value={date}>{date}</option>
                                ))}
                            </select>
                        </div>
                        {stockPrice && (
                            <div className="text-left md:text-right w-full md:w-auto">
                                <span className="block text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Underlying Price</span>
                                <p className="text-4xl font-black text-gray-900 dark:text-white">${formatNum(stockPrice)}</p>
                            </div>
                        )}
                    </div>
                )}
                
                {chain && !loading && (
                    <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400 p-4 rounded-xl flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                        <p className="text-sm font-medium">
                            Options data is from a free developer sandbox and is delayed. Prices are not real-time.
                        </p>
                    </div>
                )}

                {chain && !loading && (
                    <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ChainTable data={chain.calls} type="Calls" stockPrice={stockPrice} onTradeClick={handleTradeClick} ownedPositions={ownedPositions} />
                        <ChainTable data={chain.puts} type="Puts" stockPrice={stockPrice} onTradeClick={handleTradeClick} ownedPositions={ownedPositions} />
                    </div>
                )}
            </div>
        </>
    );
};

export default OptionsPage;
