import React, { useState, useEffect, useMemo, useRef } from 'react';
// --- MODIFIED IMPORTS ---
import { Search, AlertTriangle, Brain, TrendingUp, TrendingDown, Info, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// Helper to format numbers or return 'N/A'
const formatNum = (num, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return Number(num).toFixed(digits);
};

// --- Trade Modal Component ---
export const TradeModal = ({ contract, tradeType, stockPrice, onClose, onConfirmTrade }) => {
    // --- FIX 1: Start with a blank string ---
    const [quantity, setQuantity] = useState(''); 
   const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!contract) return null;

    const isBuy = tradeType === 'Buy';
    // Use 'ask' for buying, 'bid' for selling (or lastPrice if bid is 0)
    const price = isBuy ? (contract.ask || 0) : (contract.bid || 0);
    // --- FIX 2: Safely parse the quantity for calculation ---
    const totalCost = ( (price || 0) * (parseFloat(quantity) || 0) * 100).toFixed(2);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // --- FIX 3: Validate the quantity is a real number > 0 ---
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
        
        // Pass the validated number to the trade handler
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
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" 
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 animate-fade-in" 
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className={`text-2xl font-bold mb-2 ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                    {isBuy ? 'Buy to Open' : 'Sell to Close'}
                </h2>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{contract.contractSymbol}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
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
                            // --- FIX 4: Allow the input to be blank ---
                            onChange={(e) => setQuantity(e.target.value)}
                           className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="1" // Show '1' as a hint
                            min="1"
                            step="1"
                            required
                        />
                    </div>
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex justify-between text-gray-700 dark:text-gray-300">
                            <span>Limit Price:</span>
                            <span className="font-medium">${formatNum(price)}</span>
                        </div>
                        <div className="flex justify-between text-gray-900 dark:text-white font-bold text-lg mt-2">
                            <span>Estimated {isBuy ? 'Cost' : 'Credit'}:</span>
                            <span>${totalCost}</span>
                        </div>
                    </div>
                    
                    {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
                    
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-all"
                        >
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


// Component to render one side of the chain (Calls or Puts)
const ChainTable = ({ data, type, stockPrice, onTradeClick, ownedPositions }) => {
    const headerColor = type === 'Calls' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const chainContainerRef = useRef(null);

    // --- NEW: SIMPLE DESCENDING SORT ---
    const sortedData = useMemo(() => {
        if (!data || !stockPrice) return [];
        // Sort by strike price, highest to lowest
        return [...data].sort((a, b) => b.strike - a.strike);
    }, [data, stockPrice]);
    // --- END OF SORTING LOGIC ---

    // --- Scroll to ATM ---
    useEffect(() => {
        if (stockPrice && chainContainerRef.current && sortedData.length > 0) {
            // Find the strike closest to the stock price
            let closestIndex = 0;
            let minDiff = Infinity;
            
            sortedData.forEach((contract, index) => {
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
    }, [sortedData, stockPrice]);
    // --- END OF SCROLL ---

    return (
        <div className="w-full">
            <h3 className={`text-2xl font-bold text-center mb-4 ${headerColor}`}>{type}</h3>
            <div ref={chainContainerRef} className="overflow-y-auto h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Trade</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Strike</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Bid</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ask</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Last Price</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedData.map((contract, index) => { 
                            const isITM = stockPrice ? 
                                (type === 'Calls' ? contract.strike < stockPrice : contract.strike > stockPrice) 
                                : false;
                            
                            const owned = ownedPositions[contract.contractSymbol];
                            
                            return (
                                <tr 
                                    key={contract.contractSymbol} 
                                    data-index={index} 
                                    className={`
                                        ${isITM ? 'bg-blue-50 dark:bg-blue-900/20' : ''} 
                                        ${owned ? 'border-l-4 border-yellow-500' : ''}
                                        hover:bg-gray-100 dark:hover:bg-gray-700/50
                                    `}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button 
                                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-md transition-colors"
                                                onClick={() => onTradeClick(contract, 'Buy')}
                                            >
                                                Buy
                                            </button>
                                            {owned && (
                                                <button 
                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition-colors"
                                                    onClick={() => onTradeClick(contract, 'Sell')}
                                                >
                                                    Sell
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">${formatNum(contract.strike)}</td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">${formatNum(contract.bid)}</td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">${formatNum(contract.ask)}</td>
                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">${formatNum(contract.lastPrice)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: SuggestionCard ---
const SuggestionCard = ({ suggestion, onTrade }) => {
    if (!suggestion || suggestion.suggestion === "Hold") {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 animate-fade-in">
                <div className="flex items-center">
                    <Info className="w-8 h-8 text-blue-500 mr-3" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analysis Complete</h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            {suggestion ? suggestion.reason : "No strong signal found. Hold."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const {
        suggestion: tradeType, // "Buy Call" or "Buy Put"
        reason,
        confidence,
        contract,
        targets
    } = suggestion;

    const isCall = tradeType === "Buy Call";
    const confidenceColors = {
        Low: "text-gray-500 dark:text-gray-400",
        Medium: "text-yellow-600 dark:text-yellow-400",
        High: "text-green-600 dark:text-green-400",
    };
    const bgColors = {
        Low: "bg-gray-50 dark:bg-gray-700/50",
        Medium: "bg-yellow-50 dark:bg-yellow-900/20",
        High: "bg-green-50 dark:bg-green-900/20",
    };
    const borderColors = {
        Low: "border-gray-200 dark:border-gray-700",
        Medium: "border-yellow-200 dark:border-yellow-800",
        High: "border-green-200 dark:border-green-800",
    };

    return (
        <div className={`rounded-xl shadow-lg p-6 mb-8 animate-fade-in border ${bgColors[confidence]} ${borderColors[confidence]}`}>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                    <Brain className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Trade Suggestion</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${bgColors[confidence]} ${confidenceColors[confidence]}`}>
                    Confidence: {confidence}
                </span>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-6">{reason}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* --- Column 1: The Trade --- */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Suggested Trade</h3>
                    <div className="flex items-center my-2">
                        {isCall ? (
                            <TrendingUp className="w-10 h-10 text-green-500 mr-3" />
                        ) : (
                            <TrendingDown className="w-10 h-10 text-red-500 mr-3" />
                        )}
                        <span className={`text-3xl font-bold ${isCall ? 'text-green-600' : 'text-red-600'}`}>
                            {tradeType}
                        </span>
                    </div>
                    <button
                        onClick={() => onTrade(contract, isCall ? 'Buy' : 'Buy')} // We always 'Buy' the contract (to open)
                        className={`w-full px-4 py-2 text-white font-semibold rounded-lg transition-all ${isCall ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        Trade This Contract
                    </button>
                </div>

                {/* --- Column 2: The Contract --- */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Contract Details</h3>
                    <div className="space-y-2 mt-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">Strike Price:</span>
                            <span className="font-bold text-gray-900 dark:text-white">${formatNum(contract.strikePrice)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">Expiration:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{contract.expirationDate}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">Premium (Ask):</span>
                            <span className="font-bold text-gray-900 dark:text-white">${formatNum(contract.ask)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">Underlying:</span>
                            <span className="font-bold text-gray-900 dark:text-white">${formatNum(contract.underlyingPrice)}</span>
                        </div>
                    </div>
                </div>
                
                {/* --- Column 3: The Targets --- */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Targets</h3>
                    <div className="space-y-3 mt-3">
                        <div className="flex items-start">
                            <XCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                            <div>
                                <span className="text-gray-600 dark:text-gray-300">Stop Loss:</span>
                                <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{targets.stopLoss}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                            <div>
                                <span className="text-gray-600 dark:text-gray-300">Take Profit:</span>
                                <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{targets.takeProfit}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
// --- END OF NEW COMPONENT ---


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
    
    // --- NEW STATE ---
    const [suggestion, setSuggestion] = useState(null);
    const [suggestionLoading, setSuggestionLoading] = useState(false);
    // --- END NEW STATE ---

    const fetchOwnedPositions = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5001/paper/portfolio');
            const data = await response.json();
            const optionsMap = (data.options_positions || []).reduce((acc, pos) => {
                acc[pos.ticker] = pos; 
                return acc;
            }, {});
            setOwnedPositions(optionsMap);
        } catch (err) {
            console.error("Could not fetch portfolio for options page:", err);
        }
    };

    // --- NEW FUNCTION ---
    const fetchSuggestion = async (tickerToFetch) => {
        setSuggestionLoading(true);
        try {
            const response = await fetch(`http://127.0.0.1:5001/options/suggest/${tickerToFetch}`);
            const data = await response.json();
            if (response.ok) {
                setSuggestion(data);
            } else {
                setSuggestion({ suggestion: "Hold", reason: data.error || "Could not generate suggestion." });
            }
        } catch (err) {
            setSuggestion({ suggestion: "Hold", reason: "Error fetching suggestion." });
        } finally {
            setSuggestionLoading(false);
        }
    };
    // --- END NEW FUNCTION ---

    // --- MODIFIED FUNCTION ---
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
        
        // --- NEW ---
        setSuggestion(null);
        fetchSuggestion(ticker); // Start fetching suggestion
        // --- END NEW ---
        
        fetchOwnedPositions(); 

        try {
            const expResponse = await fetch(`http://127.0.0.1:5001/options/${ticker}`);
            if (!expResponse.ok) {
                const errorData = await expResponse.json();
                throw new Error(errorData.error || 'No options found for this ticker.');
            }
            const expData = await expResponse.json();
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
            // --- NEW ---
            setSuggestionLoading(false); // Stop loading if chain fails
            // --- END NEW ---
        }
    };
    // --- END MODIFIED FUNCTION ---

    const fetchChain = async (tickerToFetch, date) => {
        setLoading(true);
        setError('');
        setChain(null);
        try {
            const chainResponse = await fetch(`http://127.0.0.1:5001/options/chain/${tickerToFetch}?date=${date}`);
            if (!chainResponse.ok) {
                const errorData = await chainResponse.json();
                throw new Error(errorData.error || 'Could not load chain for this date.');
            }
            const chainData = await chainResponse.json();
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
        const endpoint = isBuy ? '/paper/options/buy' : '/paper/options/sell';
        const body = JSON.stringify({
            contractSymbol: contractSymbol,
            quantity: quantity,
            price: price
        });
        
        try {
            const response = await fetch(`http://127.0.0.1:5001${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Trade failed');
            }
            setTradeMessage({ type: 'success', text: data.message });
            fetchOwnedPositions(); // Refresh our owned positions
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
                <div className="text-center mb-8 animate-fade-in">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        Options Chain
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Search a ticker to see available option contracts
                    </p>
                </div>

                {/* Search Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 animate-fade-in">
                    <form onSubmit={handleSearchTicker} className="flex gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="Search ticker (e.g., AAPL)"
                                className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || suggestionLoading}
                            className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${loading || suggestionLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {loading || suggestionLoading ? 'Loading...' : 'Search'}
                        </button>
                    </form>
                </div>
                
                {tradeMessage.text && (
                    <div className={`mb-6 p-4 rounded-lg animate-fade-in ${
                        tradeMessage.type === 'success' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                        {tradeMessage.text}
                    </div>
                )}

                {/* --- NEW: SUGGESTION CARD RENDER --- */}
                {suggestionLoading && (
                    <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-8">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin inline-block" />
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Analyzing ticker...</p>
                    </div>
                )}
                {suggestion && !suggestionLoading && (
                    <SuggestionCard 
                        suggestion={suggestion} 
                        onTrade={handleTradeClick} // Pass the existing trade handler
                    />
                )}
                {/* --- END OF NEW RENDER --- */}

                {error && <div className="text-center p-4 text-red-500">{error}</div>}

                {expirations.length > 0 && (
                    <div className="mb-8 flex justify-between items-center">
                        <div>
                            <label htmlFor="expiration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Expiration Date
                            </label>
                            <select
                                id="expiration"
                                value={selectedDate}
                                onChange={handleDateChange}
                                className="w-full max-w-xs px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {expirations.map(date => (
                                    <option key={date} value={date}>{date}</option>
                                ))}
                            </select>
                        </div>
                        {stockPrice && (
                            <div className="text-right">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Underlying Price</span>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">${formatNum(stockPrice)}</p>
                            </div>
                        )}
                    </div>
                )}
                
                {chain && !loading && (
                    <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 p-4 rounded-lg flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">
                            Options data is from a free developer sandbox and is delayed. Prices are not real-time.
                        </p>
                    </div>
                )}

                {chain && !loading && (
                    <div className="flex flex-col md:flex-row gap-8 animate-fade-in">
                        <ChainTable data={chain.calls} type="Calls" stockPrice={stockPrice} onTradeClick={handleTradeClick} ownedPositions={ownedPositions} />
                        <ChainTable data={chain.puts} type="Puts" stockPrice={stockPrice} onTradeClick={handleTradeClick} ownedPositions={ownedPositions} />
                    </div>
                )}
            </div>
        </>
    );
};

export default OptionsPage;