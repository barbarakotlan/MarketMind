import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Activity, Building, ChevronDown, ChevronUp } from 'lucide-react';
import StockDataCard from './ui/StockDataCard';
import StockChart from './charts/StockChart';
import PredictionPreviewCard from './ui/PredictionPreviewCard';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import TickerAutocompleteInput from './TickerAutocompleteInput';

// --- Helpers for Jimmy's cards ---
const formatLargeNumber = (num) => {
    if (!num || isNaN(num)) return 'N/A';
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return Number(num).toLocaleString();
};

const formatNum = (num, isPercent = false) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const val = Number(num);
    return isPercent ? `${val.toFixed(2)}%` : val.toFixed(2);
};

// Expandable company overview + quarterly financials
const StockOverviewCard = ({ summary, financials }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!summary) return null;
    const truncated = isExpanded ? summary : `${summary.slice(0, 350)}...`;
    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Overview</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                {truncated}
                {!isExpanded && (
                    <button onClick={() => setIsExpanded(true)} className="text-blue-600 dark:text-blue-400 font-medium ml-1 hover:underline">
                        Read More
                    </button>
                )}
            </p>
            {financials && financials.revenue && (
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        Quarterly Financials {financials.quarterendDate && `(as of ${financials.quarterendDate})`}
                    </h3>
                    <div className="flex gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex-1">
                            <h4 className="text-sm text-gray-500 dark:text-gray-400">Revenue</h4>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatLargeNumber(financials.revenue)}</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex-1">
                            <h4 className="text-sm text-gray-500 dark:text-gray-400">Net Income</h4>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatLargeNumber(financials.netIncome)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 5-metric key metrics grid
const KeyMetricsCard = ({ metrics }) => {
    if (!metrics) return null;
    const items = [
        { label: 'Beta (5Y)', value: formatNum(metrics.beta) },
        { label: 'Forward P/E', value: formatNum(metrics.forwardPE) },
        { label: 'PEG Ratio', value: formatNum(metrics.pegRatio) },
        { label: 'Price/Book', value: formatNum(metrics.priceToBook) },
        { label: 'Dividend Yield', value: formatNum(metrics.dividendYield, true) },
    ];
    const hasAny = items.some(i => i.value !== 'N/A');
    if (!hasAny) return null;
    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {items.map(item => (
                    <div key={item.label} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</h4>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Analyst rating badge + mean price target + upside %
const AnalystRatingsCard = ({ ratings, price }) => {
    if (!ratings || !ratings.recommendationKey || !ratings.analystTargetPrice) return null;
    const { recommendationKey, analystTargetPrice, numberOfAnalystOpinions } = ratings;
    const upsidePercent = ((analystTargetPrice - price) / price) * 100;
    const key = recommendationKey.toLowerCase();
    let ratingColor = 'text-gray-700 dark:text-gray-300';
    if (key.includes('buy')) ratingColor = 'text-green-600 dark:text-green-400';
    if (key.includes('sell')) ratingColor = 'text-red-600 dark:text-red-400';
    if (key.includes('hold')) ratingColor = 'text-yellow-600 dark:text-yellow-400';
    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Analyst Ratings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Consensus Rating</h3>
                    <p className={`text-5xl font-bold capitalize mt-2 ${ratingColor}`}>{recommendationKey}</p>
                    {numberOfAnalystOpinions && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Based on {numberOfAnalystOpinions} analysts</p>
                    )}
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mean Price Target</h3>
                    <p className="text-5xl font-bold text-gray-900 dark:text-white mt-2">${formatNum(analystTargetPrice)}</p>
                    <p className={`text-lg font-semibold mt-1 ${upsidePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatNum(upsidePercent)}% {upsidePercent >= 0 ? 'Upside' : 'Downside'}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Recent news articles for the searched stock
const StockNewsCard = ({ newsData }) => {
    const formatDate = (dateString) => {
        try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch (e) { return ''; }
    };
    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg animate-fade-in border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recent News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {newsData.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                       className="flex flex-col p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 leading-snug line-clamp-3">{item.title}</h3>
                        {item.thumbnail_url && (
                            <img src={item.thumbnail_url} alt={item.title} className="w-full h-36 object-cover rounded-md my-2" />
                        )}
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-auto pt-2">
                            <span className="font-medium truncate pr-4">{item.publisher}</span>
                            <span className="flex-shrink-0">{formatDate(item.publishTime)}</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

const timeFrames = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '14D', value: '14d' },
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

const mapScreenerSuggestion = (stock = {}) => ({
    ticker: stock.symbol || '',
    name: stock.name || stock.symbol || '',
    change_percent: typeof stock.percent_change === 'number' ? stock.percent_change * 100 : 0,
    volume: typeof stock.volume === 'number' ? stock.volume : 0,
});

const SearchPage = ({ onNavigateToPredictions, initialTicker, onClearInitialTicker }) => {
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [expandedSectors, setExpandedSectors] = useState({});
    // Fetch suggestions from API
    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        try {
            const data = await apiRequest(API_ENDPOINTS.SCREENER());
            setSuggestions({
                trending: {
                    gainers: (data?.gainers || []).map(mapScreenerSuggestion),
                    losers: (data?.losers || []).map(mapScreenerSuggestion),
                    most_active: (data?.active || []).map(mapScreenerSuggestion),
                },
                sectors: {},
            });
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
            setSuggestions({ trending: { gainers: [], losers: [], most_active: [] }, sectors: {} });
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Handle suggestion click
    const handleSuggestionClick = async (ticker) => {
        const normalizedTicker = ticker.toUpperCase();
        setTicker(normalizedTicker);
        setLoading(true);
        setStockData(null);
        setChartData(null);
        setError('');
        const defaultTimeFrame = timeFrames.find(f => f.value === '14d');
        setActiveTimeFrame(defaultTimeFrame);
        try {
            const stockJson = await apiRequest(API_ENDPOINTS.STOCK(normalizedTicker));
            setStockData(stockJson);
            setSearchedTicker(normalizedTicker);
            fetchNewsData(stockJson.companyName);
            await fetchChartData(normalizedTicker, defaultTimeFrame);
            
            // Fetch prediction data
            try {
                const predJson = await apiRequest(API_ENDPOINTS.PREDICT_ENSEMBLE(normalizedTicker));
                setPredictionData(predJson);
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
    const [newsData, setNewsData] = useState(null);
    const [newsLoading, setNewsLoading] = useState(false);

    // --- Autocomplete state ---
    const [suggestions, setSuggestions] = useState(null);

    useEffect(() => {
        if (initialTicker) {
            handleSuggestionClick(initialTicker);
            if (onClearInitialTicker) onClearInitialTicker();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTicker]);

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

    const saveRecentSearch = (ticker) => {
        const updated = [ticker.toUpperCase(), ...recentSearches.filter(t => t !== ticker.toUpperCase())].slice(0, 8);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const fetchNewsData = async (companyName) => {
        if (!companyName) return;
        setNewsLoading(true);
        try {
            const data = await apiRequest(API_ENDPOINTS.NEWS(companyName));
            setNewsData(Array.isArray(data) ? data : null);
        } catch {
            setNewsData(null);
        } finally {
            setNewsLoading(false);
        }
    };

    const fetchChartData = async (symbol, timeFrame) => {
        setChartLoading(true);
        setError('');
        try {
            const chartJson = await apiRequest(API_ENDPOINTS.CHART(symbol, timeFrame.value));
            setChartData(chartJson);
        } catch (err) {
            setError(err.message);
            setChartData(null);
        } finally {
            setChartLoading(false);
        }
    };

    const handleSearch = async (e, overrideTicker) => {
        e.preventDefault();
        const searchTicker = (overrideTicker || ticker || '').trim().toUpperCase();
        if (!searchTicker) return;

        setTicker(searchTicker);
        setLoading(true);
        setStockData(null);
        setChartData(null);
        setPredictionData(null);
        setComparisonData(null);
        setCompareTicker('');
        setNewsData(null);
        setError('');

        const defaultTimeFrame = timeFrames.find(f => f.value === '14d');
        setActiveTimeFrame(defaultTimeFrame);

        try {
            const stockJson = await apiRequest(API_ENDPOINTS.STOCK(searchTicker));
            setStockData(stockJson);
            setSearchedTicker(searchTicker);
            saveRecentSearch(searchTicker);
            fetchNewsData(stockJson.companyName);

            await fetchChartData(searchTicker, defaultTimeFrame);
            try {
                const predJson = await apiRequest(API_ENDPOINTS.PREDICT_ENSEMBLE(searchTicker));
                setPredictionData(predJson);
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
        const normalizedTicker = compareTicker.trim().toUpperCase();
        
        try {
            const chartJson = await apiRequest(API_ENDPOINTS.CHART(normalizedTicker, activeTimeFrame.value));
            setComparisonData({ ticker: normalizedTicker, data: chartJson });
            setCompareTicker(''); 
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRecentSearchClick = (recentTicker) => {
        setTicker(recentTicker);
        handleSearch({ preventDefault: () => {} }, recentTicker);
    };

    const handleTimeFrameChange = (timeFrame) => {
        setActiveTimeFrame(timeFrame);
        if (searchedTicker) {
            fetchChartData(searchedTicker, timeFrame);
            if (comparisonData) {
                (async () => {
                    try {
                        const chartJson = await apiRequest(API_ENDPOINTS.CHART(comparisonData.ticker, timeFrame.value));
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
            const result = await apiRequest(API_ENDPOINTS.WATCHLIST_ITEM(tickerToAdd), {
                method: 'POST',
            });
            alert(result.message || `${tickerToAdd} added to watchlist.`);
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
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
                            <Search className="w-6 h-6 text-gray-400" />
                        </div>
                        <TickerAutocompleteInput
                            value={ticker}
                            onChange={setTicker}
                            onSelect={(sym) => { setTicker(sym); handleSearch({ preventDefault: () => {} }, sym); }}
                            placeholder="e.g., AAPL or Apple"
                            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 text-white font-bold px-8 py-4 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors disabled:bg-blue-300 absolute top-0 right-0 h-full"
                    >
                        {loading ? '...' : 'Search'}
                    </button>
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

                {stockData && (
                    <>
                        <StockOverviewCard
                            summary={stockData.fundamentals?.overview}
                            financials={stockData.financials}
                        />
                        <KeyMetricsCard metrics={stockData.fundamentals} />
                        <AnalystRatingsCard ratings={stockData.fundamentals} price={stockData.price} />
                    </>
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
                            comparisonData={comparisonData}
                        />
                    </div>
                )}

                {newsLoading && <div className="text-center p-8 text-gray-500 dark:text-gray-400">Loading news...</div>}
                {newsData && newsData.length > 0 && !newsLoading && <StockNewsCard newsData={newsData} />}
            </div>

        </div>
    );
};

export default SearchPage;
