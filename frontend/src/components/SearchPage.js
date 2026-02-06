import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react'; 
import StockDataCard from './ui/StockDataCard';
import PredictionPreviewCard from './ui/PredictionPreviewCard';
import StockChart from './charts/StockChart'; 

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
    const [suggestions, setSuggestions] = useState([]);
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

    const saveRecentSearch = (searchTicker) => {
        const updated = [searchTicker.toUpperCase(), ...recentSearches.filter(t => t !== searchTicker.toUpperCase())].slice(0, 8);
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
    
    // --- This is the REVERTED executeSearch ---
    const executeSearch = async (searchTicker) => {
        setShowSuggestions(false); 
        setSuggestions([]);

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
            const stockResponse = await fetch(`http://127.0.0.1:5001/stock/${searchTicker}`);
            if (!stockResponse.ok) {
                const errorData = await stockResponse.json();
                throw new Error(errorData.error || 'Stock data not found');
            }
            const stockJson = await stockResponse.json();
            setStockData(stockJson);
            setSearchedTicker(searchTicker);
            saveRecentSearch(searchTicker);

            await fetchChartData(searchTicker, defaultTimeFrame);
            
            try {
                const predResponse = await fetch(`http://127.0.0.1:5001/predict/${searchTicker}`);
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

    const handleSearch = (e) => {
        e.preventDefault();
        if (ticker) {
            executeSearch(ticker);
        }
    };

    const handleRecentSearchClick = (recentTicker) => {
        setTicker(recentTicker);
        executeSearch(recentTicker);
    };

    const handleSuggestionClick = (suggestion) => {
        setTicker(suggestion.symbol); 
        setSuggestions([]); 
        setShowSuggestions(false); 
        executeSearch(suggestion.symbol); 
    };

    const handleTickerChange = (e) => {
        setTicker(e.target.value.toUpperCase());
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
                        onFocus={() => {
                            if (ticker.length > 0 && suggestions.length > 0) {
                                setShowSuggestions(true);
                            }
                        }}
                        onBlur={() => {
                            setTimeout(() => {
                                setShowSuggestions(false);
                            }, 200);
                        }}
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
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden animate-fade-in">
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {suggestions.map((stock) => (
                                    <li
                                        key={stock.symbol}
                                        onMouseDown={() => handleSuggestionClick(stock)}
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