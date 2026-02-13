import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Activity, Building, ChevronDown, ChevronUp } from 'lucide-react';
import StockDataCard from './ui/StockDataCard';
import StockChart from './charts/StockChart';
import PredictionPreviewCard from './ui/PredictionPreviewCard';

const timeFrames = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '14D', value: '14d' },
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

// --- Custom hook for debouncing ---
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        
        // Clean up the timeout on every render if value or delay changes
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

const SearchPage = ({ onNavigateToPredictions }) => {
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [expandedSectors, setExpandedSectors] = useState({});
    // --- NEW: Autocomplete states ---
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    // Fetch suggestions from API
    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        try {
            const response = await fetch('http://127.0.0.1:5001/search/suggestions');
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data);
            }
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // --- NEW: Autocomplete fetch function ---
    const fetchAutocompleteSuggestions = async (query) => {
        if (!query || query.length < 2) {
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }
        
        try {
            const response = await fetch(`http://127.0.0.1:5001/search-symbols?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                setAutocompleteSuggestions(data.slice(0, 8)); // Limit to 8 results
                setShowAutocomplete(true);
            } else {
                setAutocompleteSuggestions([]);
                setShowAutocomplete(false);
            }
        } catch (error) {
            console.error('Error fetching autocomplete suggestions:', error);
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
        }
    };
    // --- END AUTOCOMPLETE ---

    // Handle suggestion click
    const handleSuggestionClick = async (ticker) => {
        setTicker(ticker);
        setLoading(true);
        setStockData(null);
        setChartData(null);
        setError('');
        const defaultTimeFrame = timeFrames.find(f => f.value === '14d');
        setActiveTimeFrame(defaultTimeFrame);
        try {
            const stockResponse = await fetch(`http://127.0.0.1:5001/stock/${ticker}`);
            if (!stockResponse.ok) {
                const errorData = await stockResponse.json();
                throw new Error(errorData.error || 'Stock data not found');
            }
            const stockJson = await stockResponse.json();
            setStockData(stockJson);
            setSearchedTicker(ticker);
            await fetchChartData(ticker, defaultTimeFrame);
            
            // Fetch prediction data
            try {
                const predResponse = await fetch(`http://127.0.0.1:5001/predict/${ticker}`);
                if (predResponse.ok) {
                    const predJson = await predResponse.json();
                    setPredictionData(predJson);
                } else {
                    setPredictionData(null);
                }
            } catch {
                setPredictionData(null);
            }
        } catch (err) {
            setError(err.message || 'An error occurred.');
            setSearchedTicker('');
        } finally {
            setLoading(false);
        }
    };

    // Fetch suggestions on component mount
    useEffect(() => {
        fetchSuggestions();
    }, []);

    // Toggle sector expansion
    const toggleSector = (sector) => {
        setExpandedSectors(prev => ({
            ...prev,
            [sector]: !prev[sector]
        }));
    };

    const [ticker, setTicker] = useState('');
    const [searchedTicker, setSearchedTicker] = useState('');
    const [stockData, setStockData] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [activeTimeFrame, setActiveTimeFrame] = useState(timeFrames.find(f => f.value === '14d'));
    const [loading, setLoading] = useState(false);
    const [chartLoading, setChartLoading] = useState(false);
    const [error, setError] = useState('');
    const [recentSearches, setRecentSearches] = useState([]);
    const [predictionData, setPredictionData] = useState(null);
    
    const [compareTicker, setCompareTicker] = useState('');
    const [comparisonData, setComparisonData] = useState(null);

    // --- Autocomplete state ---
    const [suggestions, setSuggestions] = useState(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // --- Debounce the user's input ---
    const debouncedQuery = useDebounce(ticker, 300); // 300ms delay

    useEffect(() => {
        // Load recent searches from localStorage
        const saved = localStorage.getItem('recentSearches');
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load recent searches:', e);
            }
        }
    }, []); 

    // --- This effect runs when the DEBOUNCED query changes ---
    useEffect(() => {
        const fetchSuggestions = async () => {
            // Don't search for 1-letter queries or if it's a known recent search
            if (debouncedQuery.length < 2 || recentSearches.includes(debouncedQuery)) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            try {
                // Call our new backend endpoint
                const response = await fetch(`http://127.0.0.1:5001/search-symbols?q=${debouncedQuery}`);
                if (!response.ok) throw new Error("Search failed");
                
                const data = await response.json();
                
                // Don't show suggestions if the only match is what's typed
                if (data.length === 1 && data[0].symbol === debouncedQuery) {
                     setSuggestions([]);
                     setShowSuggestions(false);
                } else {
                    setSuggestions(data);
                    setShowSuggestions(data.length > 0);
                }
                
            } catch (err) {
                console.error("Suggestion fetch error:", err);
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        fetchSuggestions();
    }, [debouncedQuery, recentSearches]); // <-- Linter warning fixed

    const saveRecentSearch = (ticker) => {
        const updated = [ticker.toUpperCase(), ...recentSearches.filter(t => t !== ticker.toUpperCase())].slice(0, 8);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const fetchChartData = async (symbol, timeFrame) => {
        setChartLoading(true);
        setError('');
        try {
            const chartResponse = await fetch(`http://127.0.0.1:5001/chart/${symbol}?period=${timeFrame.value}`);
            if (!chartResponse.ok) {
                const errorData = await chartResponse.json();
                throw new Error(errorData.error || 'Chart data not found');
            }
            const chartJson = await chartResponse.json();
            setChartData(chartJson);
        } catch (err) {
            setError(err.message);
            setChartData(null);
        } finally {
            setChartLoading(false);
        }
    };

    // --- NEW: Autocomplete handlers ---
    const handleAutocompleteClick = (suggestion) => {
        setTicker(suggestion.symbol);
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);
        handleSearch({ preventDefault: () => {} });
    };

    const handleTickerChange = (e) => {
        const value = e.target.value.toUpperCase();
        setTicker(value);
        fetchAutocompleteSuggestions(value);
    };

    const handleTickerFocus = () => {
        if (ticker.length > 1 && autocompleteSuggestions.length > 0) {
            setShowAutocomplete(true);
        }
    };

    const handleTickerBlur = () => {
        setTimeout(() => {
            setShowAutocomplete(false);
        }, 200);
    };
    // --- END AUTOCOMPLETE HANDLERS ---

    const handleSearch = async (e, overrideTicker) => {
        e.preventDefault();
        const searchTicker = overrideTicker || ticker;
        if (!searchTicker) return;

        setLoading(true);
        setStockData(null);
        setChartData(null);
        setPredictionData(null);
        setComparisonData(null); 
        setCompareTicker('');
        setError('');

        const defaultTimeFrame = timeFrames.find(f => f.value === '14d');
        setActiveTimeFrame(defaultTimeFrame);

        try {
            const stockResponse = await fetch(`http://127.0.0.1:5001/stock/${ticker}`);
            if (!stockResponse.ok) {
                const errorData = await stockResponse.json();
                throw new Error(errorData.error || 'Stock data not found');
            }
            const stockJson = await stockResponse.json();
            setStockData(stockJson);
            setSearchedTicker(ticker);
            saveRecentSearch(ticker);

            await fetchChartData(ticker, defaultTimeFrame);
            try {
                const predResponse = await fetch(`http://127.0.0.1:5001/predict/${ticker}`);
                if (predResponse.ok) {
                    const predJson = await predResponse.json();
                    setPredictionData(predJson);
                } else {
                    setPredictionData(null);
                }
            } catch {
                setPredictionData(null);
            }

        } catch (err) {
            setError(err.message || 'An error occurred. Try "AAPL", "GOOGL", or "TSLA".');
            setSearchedTicker('');
        } finally {
            setLoading(false);
        }
    };
    
    const handleAddComparison = async (e) => {
        e.preventDefault();
        if (!compareTicker || !activeTimeFrame) return;
        
        try {
            const chartResponse = await fetch(`http://127.0.0.1:5001/chart/${compareTicker}?period=${activeTimeFrame.value}`);
            if (!chartResponse.ok) {
                throw new Error('Comparison ticker data not found');
            }
            const chartJson = await chartResponse.json();
            setComparisonData({ ticker: compareTicker.toUpperCase(), data: chartJson });
            setCompareTicker(''); 
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRecentSearchClick = (recentTicker) => {
        setTicker(recentTicker);
        handleSearch({ preventDefault: () => {} });
    };

    const handleTimeFrameChange = (timeFrame) => {
        setActiveTimeFrame(timeFrame);
        if (searchedTicker) {
            fetchChartData(searchedTicker, timeFrame);
            if (comparisonData) {
                (async () => {
                    try {
                        const chartResponse = await fetch(`http://127.0.0.1:5001/chart/${comparisonData.ticker}?period=${timeFrame.value}`);
                        const chartJson = await chartResponse.json();
                        setComparisonData({ ...comparisonData, data: chartJson });
                    } catch {
                        setComparisonData(null);
                    }
                })();
            }
        }
    };

    const handleAddToWatchlist = async (tickerToAdd) => {
        try {
            const response = await fetch(`http://127.0.0.1:5001/watchlist/${tickerToAdd}`, {
                method: 'POST',
            });
            const result = await response.json();
            alert(result.message);
        } catch (err) {
            alert('Failed to add stock to watchlist. Is the server running?');
        }
    };

    return (
        <div className="container mx-auto px-4 py-16 flex flex-col items-center">
            <div className="w-full max-w-2xl text-center">
                <h1 className="text-5xl font-extrabold text-gray-800 dark:text-white">Stock Ticker Search</h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-3">Enter a stock symbol to get the latest data.</p>
                <form onSubmit={handleSearch} className="mt-8 relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <Search className="w-6 h-6 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={ticker}
                        onChange={handleTickerChange}
                        onFocus={handleTickerFocus}
                        onBlur={handleTickerBlur}
                        placeholder="e.g., AAPL or Apple"
                        className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 text-white font-bold px-8 py-4 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors disabled:bg-blue-300 absolute top-0 right-0 h-full"
                    >
                        {loading ? '...' : 'Search'}
                    </button>

                    {/* Autocomplete Dropdown */}
                    {showAutocomplete && autocompleteSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden animate-fade-in">
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {autocompleteSuggestions.map((stock) => (
                                    <li
                                        key={stock.symbol}
                                        onMouseDown={() => handleAutocompleteClick(stock)}
                                        className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <span className="font-bold text-gray-900 dark:text-white">{stock.symbol}</span>
                                        <span className="ml-3 text-gray-600 dark:text-gray-400">{stock.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </form>
                
                {recentSearches.length > 0 && (
                    <div className="mt-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Recent Searches</p>
                            <button
                                onClick={clearRecentSearches}
                                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium"
                            >
                                Clear All
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recentSearches.map((recentTicker) => (
                                <button
                                    key={recentTicker}
                                    onClick={() => handleRecentSearchClick(recentTicker)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                                >
                                    {recentTicker}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Trending & Suggested Stocks */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Trending Now</h3>
                        <button
                            onClick={fetchSuggestions}
                            disabled={loadingSuggestions}
                            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                            {loadingSuggestions ? '...' : 'Refresh'}
                        </button>
                    </div>
                    
                    {suggestions && (
                        <div className="space-y-6">
                            {/* Trending Sections */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Top Gainers */}
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center">
                                        <TrendingUp className="w-4 h-4 mr-1" />
                                        Top Gainers
                                    </h4>
                                    <div className="space-y-2">
                                        {(suggestions?.trending?.gainers || []).slice(0, 3).map((stock) => (
                                            <button
                                                key={stock.ticker}
                                                onClick={() => handleSuggestionClick(stock.ticker)}
                                                className="w-full text-left p-2 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-gray-800 dark:text-gray-200">{stock.ticker}</span>
                                                    <span className="text-sm text-green-600 dark:text-green-400">
                                                        +{stock.change_percent.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    {stock.name}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Top Losers */}
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center">
                                        <TrendingDown className="w-4 h-4 mr-1" />
                                        Top Losers
                                    </h4>
                                    <div className="space-y-2">
                                        {(suggestions?.trending?.losers || []).slice(0, 3).map((stock) => (
                                            <button
                                                key={stock.ticker}
                                                onClick={() => handleSuggestionClick(stock.ticker)}
                                                className="w-full text-left p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-gray-800 dark:text-gray-200">{stock.ticker}</span>
                                                    <span className="text-sm text-red-600 dark:text-red-400">
                                                        {stock.change_percent.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    {stock.name}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Most Active */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center">
                                        <Activity className="w-4 h-4 mr-1" />
                                        Most Active
                                    </h4>
                                    <div className="space-y-2">
                                        {(suggestions?.trending?.most_active || []).slice(0, 3).map((stock) => (
                                            <button
                                                key={stock.ticker}
                                                onClick={() => handleSuggestionClick(stock.ticker)}
                                                className="w-full text-left p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-gray-800 dark:text-gray-200">{stock.ticker}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {(stock.volume / 1000000).toFixed(1)}M
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    {stock.name}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Sector Suggestions */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                    <Building className="w-4 h-4 mr-1" />
                                    Browse by Sector
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {Object.entries(suggestions?.sectors || {}).map(([sector, sectorData]) => (
                                        <div key={sector} className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => toggleSector(sector)}
                                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <div className="text-left">
                                                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">{sector}</h5>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sectorData.description}</p>
                                                </div>
                                                {expandedSectors[sector] ? (
                                                    <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                )}
                                            </button>
                                            
                                            {expandedSectors[sector] && (
                                                <div className="px-3 pb-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {sectorData.stocks.slice(0, 8).map((stock) => (
                                                            <button
                                                                key={stock.ticker}
                                                                onClick={() => handleSuggestionClick(stock.ticker)}
                                                                className="px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors border border-gray-200 dark:border-gray-600"
                                                            >
                                                                {stock.ticker}
                                                                {stock.change_percent !== 0 && (
                                                                    <span className={`ml-1 ${stock.change_percent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                        {stock.change_percent > 0 ? '↑' : '↓'}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="w-full max-w-4xl mt-4">
                
                {/* This is the original error message display */}
                {error && !chartLoading && (
                    <div className="text-red-500 text-center p-4 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-lg">
                        {error}
                    </div>
                )}
                
                {stockData && <StockDataCard data={stockData} onAddToWatchlist={handleAddToWatchlist} />}
                
                {predictionData && (
                    <PredictionPreviewCard 
                        predictionData={predictionData}
                        onViewFullPredictions={() => {
                            if (onNavigateToPredictions) {
                                onNavigateToPredictions(searchedTicker);
                            }
                        }}
                    />
                )}
                {chartLoading && <div className="text-center p-8 text-gray-500 dark:text-gray-400">Loading chart...</div>}
                {chartData && !chartLoading && (
                    <div className="mt-8 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg animate-fade-in">
                        {/* --- Comparison Input --- */}
                        <form onSubmit={handleAddComparison} className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={compareTicker}
                                onChange={(e) => setCompareTicker(e.target.value.toUpperCase())}
                                placeholder="Compare (e.g., MSFT)"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                                type="submit"
                                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-all"
                            >
                                Add
                            </button>
                        </form>
                        
                        {/* --- The Chart Component --- */}
                        <StockChart
                            chartData={chartData}
                            ticker={searchedTicker}
                            onTimeFrameChange={handleTimeFrameChange}
                            activeTimeFrame={activeTimeFrame}
                            comparisonData={comparisonData} // Pass comparison data
                        />
                    </div>
                )}
            </div>

        </div>
    );
};

export default SearchPage;