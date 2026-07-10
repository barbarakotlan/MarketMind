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
                className="ui-panel-elevated max-w-md w-full mx-4 p-8 animate-in fade-in zoom-in duration-200" 
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className={`mb-2 text-2xl font-semibold ${isBuy ? 'text-mm-positive' : 'text-mm-negative'}`}>
                    {isBuy ? 'Buy to Open' : 'Sell to Close'}
                </h2>
                <p className="text-xl font-semibold text-mm-text-primary">{contract.contractSymbol}</p>
                <p className="mb-6 text-sm text-mm-text-secondary">
                    {`Underlying Price: $${formatNum(stockPrice)}`}
                </p>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="ui-form-label normal-case tracking-normal text-mm-text-secondary">
                            Quantity (1 contract = 100 shares)
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="ui-input text-lg"
                            placeholder="1"
                            min="1"
                            step="1"
                            required
                        />
                    </div>
                    <div className="ui-panel-subtle mb-8 p-5">
                        <div className="mb-2 flex justify-between text-mm-text-secondary">
                            <span>Limit Price:</span>
                            <span className="font-semibold text-mm-text-primary">${formatNum(price)}</span>
                        </div>
                        <div className="flex justify-between border-t border-mm-border pt-2 text-xl font-semibold text-mm-text-primary">
                            <span>Estimated {isBuy ? 'Cost' : 'Credit'}:</span>
                            <span>${totalCost}</span>
                        </div>
                    </div>
                    
                    {error && <p className="ui-banner ui-banner-error mb-4 text-center text-sm">{error}</p>}
                    
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="ui-button-secondary flex-1 px-6 py-3.5"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || price <= 0}
                            className={`flex-1 px-6 py-3.5 rounded-control font-semibold transition ${
                                (loading || price <= 0)
                                    ? 'cursor-not-allowed bg-mm-text-tertiary text-white opacity-60'
                                    : (isBuy ? 'bg-mm-positive text-white hover:opacity-90' : 'bg-mm-negative text-white hover:opacity-90')
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
            <div className="ui-panel mb-8 p-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center">
                    <Info className="mr-4 h-8 w-8 text-mm-accent-primary" />
                    <div>
                        <h2 className="mb-1 text-xl font-semibold text-mm-text-primary">Analysis Complete</h2>
                        <p className="text-mm-text-secondary">
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
        <div className={`ui-panel-elevated p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 border-2 ${confidenceColors[confidence]}`}>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div className="flex items-center">
                    <Brain className="w-8 h-8 text-mm-accent-primary mr-3" />
                    <h2 className="text-2xl font-semibold text-mm-text-primary tracking-tight">AI Quant Suggestion</h2>
                </div>
                <span className="ui-chip px-4 py-1.5 text-sm uppercase tracking-wider">
                    {confidence} Confidence
                </span>
            </div>

            <p className="mb-8 text-lg leading-relaxed text-mm-text-primary">{reason}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: The Trade */}
                <div className="ui-panel-subtle p-6">
                    <h3 className="ui-form-label mb-4">Suggested Action</h3>
                    <div className="flex items-center mb-6">
                        {isCall ? (
                            <TrendingUp className="w-12 h-12 text-mm-positive mr-4" />
                        ) : (
                            <TrendingDown className="w-12 h-12 text-mm-negative mr-4" />
                        )}
                        <span className={`text-3xl font-semibold tracking-tight ${isCall ? 'text-mm-positive' : 'text-mm-negative'}`}>
                            {tradeType}
                        </span>
                    </div>
                    <button
                        onClick={() => onTrade(contract, 'Buy')}
                        className={`w-full rounded-control px-4 py-3 text-white font-semibold transition ${isCall ? 'bg-mm-positive hover:opacity-90' : 'bg-mm-negative hover:opacity-90'}`}
                    >
                        Trade Contract
                    </button>
                </div>

                {/* Column 2: Contract Details */}
                <div className="ui-panel-subtle p-6">
                    <h3 className="ui-form-label mb-4">Contract Data</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-mm-text-secondary">Strike Price:</span>
                            <span className="font-semibold text-mm-text-primary">${formatNum(contract.strikePrice)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-mm-text-secondary">Expiration:</span>
                            <span className="font-semibold text-mm-text-primary">{contract.expirationDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-mm-text-secondary">Premium (Ask):</span>
                            <span className="font-semibold text-mm-accent-primary">${formatNum(contract.currentPrice || contract.ask)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-mm-border">
                            <span className="text-mm-text-secondary">Implied Volatility:</span>
                            <span className="font-semibold text-mm-warning">{contract.impliedVolatility || 'N/A'}%</span>
                        </div>
                    </div>
                </div>
                
                {/* Column 3: Targets */}
                <div className="ui-panel-subtle flex flex-col justify-center p-6">
                    <h3 className="ui-form-label mb-4">Risk Parameters</h3>
                    <div className="space-y-5">
                        <div className="flex items-start rounded-control border p-3" style={{ backgroundColor: 'rgb(var(--mm-negative) / 0.08)', borderColor: 'rgb(var(--mm-negative) / 0.16)' }}>
                            <XCircle className="w-5 h-5 text-mm-negative mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <span className="text-xs font-semibold text-mm-negative uppercase">Stop Loss</span>
                                <p className="mt-1 text-sm font-medium text-mm-text-primary">{targets.stopLoss}</p>
                            </div>
                        </div>
                        <div className="flex items-start rounded-control border p-3" style={{ backgroundColor: 'rgb(var(--mm-positive) / 0.08)', borderColor: 'rgb(var(--mm-positive) / 0.16)' }}>
                            <CheckCircle className="w-5 h-5 text-mm-positive mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <span className="text-xs font-semibold text-mm-positive uppercase">Take Profit</span>
                                <p className="mt-1 text-sm font-medium text-mm-text-primary">{targets.takeProfit}</p>
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
        <div className="ui-panel w-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-mm-border bg-mm-surface-subtle px-6 py-4">
                <h3 className={`flex items-center gap-2 text-xl font-semibold tracking-tight ${headerColor}`}>
                    {type === 'Calls' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    {type}
                </h3>
                <span className="ui-chip px-3 py-1.5 text-[11px] uppercase tracking-wider">
                    ±15% from ATM
                </span>
            </div>
            
            <div ref={chainContainerRef} className="overflow-y-auto max-h-[600px] custom-scrollbar">
                <table className="min-w-full divide-y divide-mm-border">
                    <thead className="sticky top-0 z-10 bg-mm-surface-subtle backdrop-blur-md">
                        <tr>
                            <th className="px-5 py-4 text-left text-xs font-semibold text-mm-text-secondary uppercase tracking-widest">Action</th>
                            <th className="px-5 py-4 text-left text-xs font-semibold text-mm-text-secondary uppercase tracking-widest">Strike</th>
                            <th className="px-5 py-4 text-left text-xs font-semibold text-mm-text-secondary uppercase tracking-widest">Bid / Ask</th>
                            <th className="px-5 py-4 text-left text-xs font-semibold text-mm-text-secondary uppercase tracking-widest">Vol / OI</th>
                            <th className="px-5 py-4 text-left text-xs font-semibold text-mm-text-secondary uppercase tracking-widest">IV</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-mm-border bg-mm-surface">
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
                                                className={`rounded-control px-4 py-2 text-xs font-semibold transition ${type === 'Calls' ? 'bg-mm-positive/12 text-mm-positive hover:bg-mm-positive hover:text-white' : 'bg-mm-negative/12 text-mm-negative hover:bg-mm-negative hover:text-white'}`}
                                                onClick={() => onTradeClick(contract, 'Buy')}
                                            >
                                                Trade
                                            </button>
                                            {owned && (
                                                <button 
                                                    className="ui-button-secondary px-4 py-2 text-xs"
                                                    onClick={() => onTradeClick(contract, 'Sell')}
                                                >
                                                    Close
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg font-semibold ${isITM ? 'text-mm-text-primary' : 'text-mm-text-secondary'}`}>
                                                ${formatNum(contract.strike)}
                                            </span>
                                            {isATM && <span className="rounded-control bg-mm-accent-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-mm-accent-primary">ATM</span>}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-mm-text-primary">${formatNum(contract.ask)} <span className="ml-1 text-xs font-medium text-mm-text-tertiary">Ask</span></span>
                                            <span className="mt-0.5 text-xs text-mm-text-secondary">${formatNum(contract.bid)} Bid</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-mm-text-secondary flex items-center gap-1.5">
                                                <BarChart2 className="w-3.5 h-3.5 text-mm-text-tertiary" />
                                                {contract.volume || 0}
                                            </span>
                                            <span className="mt-0.5 text-xs text-mm-text-tertiary">OI: {contract.openInterest || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <Activity className={`w-4 h-4 ${(contract.impliedVolatility || 0) > 0.5 ? 'text-mm-warning' : 'text-mm-text-tertiary'}`} />
                                            <span className={`text-sm font-semibold ${(contract.impliedVolatility || 0) > 0.5 ? 'text-mm-warning' : 'text-mm-text-secondary'}`}>
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
        
            <div className="ui-page">
                <div className="ui-page-header text-center animate-in fade-in slide-in-from-top-4 duration-500">
                    <h1 className="ui-page-title mb-3">
                        Options Intelligence
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-mm-text-secondary">
                        Analyze option chains and receive AI-driven quantitative trade suggestions.
                    </p>
                </div>

                {/* Search Bar */}
                <div className="ui-panel mb-8 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <form onSubmit={handleSearchTicker} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="Search ticker (e.g., AAPL)"
                                className="ui-input py-4 pl-14 text-lg font-medium"
                            />
                            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-mm-text-tertiary w-6 h-6" />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || suggestionLoading}
                            className={loading || suggestionLoading ? 'ui-button-secondary cursor-not-allowed opacity-60 px-10 py-4 text-lg' : 'ui-button-primary px-10 py-4 text-lg'}
                        >
                            {loading || suggestionLoading ? 'Loading...' : 'Analyze'}
                        </button>
                    </form>
                </div>
                
                {tradeMessage.text && (
                    <div className={`mb-8 p-5 rounded-card animate-in fade-in slide-in-from-top-2 border ${
                        tradeMessage.type === 'success' 
                            ? 'ui-banner ui-banner-success'
                            : 'ui-banner ui-banner-error'
                    }`}>
                        <div className="flex items-center gap-3 font-semibold">
                            {tradeMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            {tradeMessage.text}
                        </div>
                    </div>
                )}

                {/* Suggestion Rendering */}
                {suggestionLoading && (
                    <div className="ui-panel mb-8 p-12 text-center">
                        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-mm-accent-primary" />
                        <h3 className="text-lg font-semibold text-mm-text-primary">Running Quantitative Analysis...</h3>
                        <p className="mt-2 text-mm-text-secondary">Training random forest model and calculating implied volatility.</p>
                    </div>
                )}
                {suggestion && !suggestionLoading && (
                    <SuggestionCard 
                        suggestion={suggestion} 
                        onTrade={handleTradeClick}
                    />
                )}

                {error && <div className="ui-banner ui-banner-error mb-8 text-center font-semibold">{error}</div>}

                {expirations.length > 0 && (
                    <div className="ui-panel mb-8 flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-end animate-in fade-in duration-500">
                        <div className="w-full md:w-auto">
                            <label htmlFor="expiration" className="ui-form-label mb-2">
                                Expiration Date
                            </label>
                            <select
                                id="expiration"
                                value={selectedDate}
                                onChange={handleDateChange}
                                className="ui-input w-full cursor-pointer font-medium md:w-64"
                            >
                                {expirations.map(date => (
                                    <option key={date} value={date}>{date}</option>
                                ))}
                            </select>
                        </div>
                        {stockPrice && (
                            <div className="text-left md:text-right w-full md:w-auto">
                                <span className="ui-form-label mb-1 block">Underlying Price</span>
                                <p className="text-4xl font-semibold text-mm-text-primary">${formatNum(stockPrice)}</p>
                            </div>
                        )}
                    </div>
                )}
                
                {chain && !loading && (
                    <div className="ui-banner ui-banner-warning mb-6 flex items-center gap-3">
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
