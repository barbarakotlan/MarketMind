import React, { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, TrendingDown, Activity, Building, ChevronDown, ChevronUp } from 'lucide-react';
import StockDataCard from './ui/StockDataCard';
import StockChart from './charts/StockChart';
import PredictionPreviewCard from './ui/PredictionPreviewCard';
import AssetCompareCard from './ui/AssetCompareCard';
import { API_ENDPOINTS, apiRequest } from '../config/api';

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

const formatCurrency = (num) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return `$${Number(num).toFixed(2)}`;
};

const formatSignedPercent = (num) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const value = Number(num);
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const summarizePredictionEdge = (predictionData) => {
    if (!predictionData) {
        return { value: 'No forecast', caption: 'Prediction preview unavailable.' };
    }
    const recentClose = Number(predictionData.recentClose);
    const target = Number(predictionData.recentPredicted ?? predictionData.predictions?.[0]?.predictedClose);
    if (!Number.isFinite(recentClose) || !Number.isFinite(target) || recentClose === 0) {
        return { value: 'No forecast', caption: 'Prediction preview unavailable.' };
    }
    const spread = ((target - recentClose) / recentClose) * 100;
    return {
        value: `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`,
        caption: `${formatCurrency(target)} predicted vs ${formatCurrency(recentClose)} close`,
    };
};

const buildCompareMetrics = ({ stockData, predictionData, newsData }) => {
    const predictionSummary = summarizePredictionEdge(predictionData);
    return [
        {
            label: 'Price',
            value: formatCurrency(stockData?.price),
            caption:
                stockData?.changePercent !== undefined && stockData?.changePercent !== null
                    ? `${formatSignedPercent(stockData.changePercent)} on the day`
                    : 'Daily change unavailable',
        },
        {
            label: 'Prediction edge',
            value: predictionSummary.value,
            caption: predictionSummary.caption,
        },
        {
            label: 'Sector',
            value: stockData?.fundamentals?.sector || 'N/A',
            caption: stockData?.fundamentals?.industry || 'Industry unavailable',
        },
        {
            label: 'Analyst target',
            value: formatCurrency(stockData?.fundamentals?.analystTargetPrice),
            caption: `${Array.isArray(newsData) ? newsData.length : 0} recent headline(s)`,
        },
    ];
};

// Expandable company overview + quarterly financials
const StockOverviewCard = ({ summary, financials }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!summary) return null;
    const truncated = isExpanded ? summary : `${summary.slice(0, 350)}...`;
    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Company Overview</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Overview</h2>
            <p className="mb-4 leading-relaxed text-mm-text-secondary">
                {truncated}
                {!isExpanded && (
                    <button onClick={() => setIsExpanded(true)} className="ml-1 font-medium text-mm-accent-primary hover:underline">
                        Read More
                    </button>
                )}
            </p>
            {financials && financials.revenue && (
                <div>
                    <h3 className="mb-3 text-lg font-semibold text-mm-text-primary">
                        Quarterly Financials {financials.quarterendDate && `(as of ${financials.quarterendDate})`}
                    </h3>
                    <div className="flex gap-4">
                        <div className="ui-panel-subtle flex-1 p-4">
                            <h4 className="text-sm text-mm-text-secondary">Revenue</h4>
                            <p className="mt-1 text-xl font-semibold text-mm-text-primary">{formatLargeNumber(financials.revenue)}</p>
                        </div>
                        <div className="ui-panel-subtle flex-1 p-4">
                            <h4 className="text-sm text-mm-text-secondary">Net Income</h4>
                            <p className="mt-1 text-xl font-semibold text-mm-text-primary">{formatLargeNumber(financials.netIncome)}</p>
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
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Core Metrics</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Key Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {items.map(item => (
                    <div key={item.label} className="ui-panel-subtle p-4 text-center">
                        <h4 className="text-sm font-medium text-mm-text-secondary">{item.label}</h4>
                        <p className="mt-1 text-2xl font-semibold text-mm-text-primary">{item.value}</p>
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
    let ratingColor = 'text-mm-text-secondary';
    if (key.includes('buy')) ratingColor = 'text-mm-positive';
    if (key.includes('sell')) ratingColor = 'text-mm-negative';
    if (key.includes('hold')) ratingColor = 'text-mm-warning';
    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Street View</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Analyst Ratings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="ui-panel-subtle flex flex-col items-center justify-center p-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-mm-text-secondary">Consensus Rating</h3>
                    <p className={`text-5xl font-bold capitalize mt-2 ${ratingColor}`}>{recommendationKey}</p>
                    {numberOfAnalystOpinions && (
                        <p className="mt-1 text-sm text-mm-text-secondary">Based on {numberOfAnalystOpinions} analysts</p>
                    )}
                </div>
                <div className="ui-panel-subtle flex flex-col items-center justify-center p-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-mm-text-secondary">Mean Price Target</h3>
                    <p className="mt-2 text-5xl font-bold text-mm-text-primary">${formatNum(analystTargetPrice)}</p>
                    <p className={`mt-1 text-lg font-semibold ${upsidePercent >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
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
        <div className="ui-panel mt-8 animate-fade-in p-4 sm:p-6">
            <p className="ui-section-label mb-3">Catalysts</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Recent News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {newsData.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                       className="flex flex-col rounded-control border border-mm-border p-4 transition-colors hover:bg-mm-surface-subtle">
                        <h3 className="mb-2 line-clamp-3 text-sm font-semibold leading-snug text-mm-text-primary">{item.title}</h3>
                        {item.thumbnail_url && (
                            <img src={item.thumbnail_url} alt={item.title} className="w-full h-36 object-cover rounded-md my-2" />
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-mm-text-secondary">
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
    // --- NEW: Autocomplete states ---
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

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

    // --- NEW: Autocomplete fetch function ---
    const fetchAutocompleteSuggestions = async (query) => {
        if (!query || query.length < 2) {
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }
        
        try {
            const data = await apiRequest(API_ENDPOINTS.SEARCH_SYMBOLS(query));
            setAutocompleteSuggestions(data.slice(0, 8));
            setShowAutocomplete(data.length > 0);
        } catch (error) {
            console.error('Error fetching autocomplete suggestions:', error);
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
        }
    };
    // --- END AUTOCOMPLETE ---

    // Handle suggestion click
    const handleSuggestionClick = async (ticker) => {
        await runSearch(ticker);
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
    const latestSearchRequestIdRef = useRef(0);
    const latestChartRequestIdRef = useRef(0);
    const latestComparisonRequestIdRef = useRef(0);

    const isCurrentSearchRequest = (requestId) => latestSearchRequestIdRef.current === requestId;
    const isCurrentChartRequest = (requestId) => latestChartRequestIdRef.current === requestId;
    const isCurrentComparisonRequest = (requestId) => latestComparisonRequestIdRef.current === requestId;

    useEffect(() => {
        if (initialTicker) {
            runSearch(initialTicker);
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
        const normalizedTicker = ticker.toUpperCase();
        setRecentSearches((prevSearches) => {
            const updated = [normalizedTicker, ...prevSearches.filter(t => t !== normalizedTicker)].slice(0, 8);
            localStorage.setItem('recentSearches', JSON.stringify(updated));
            return updated;
        });
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const fetchNewsData = async (companyName, requestId) => {
        if (!companyName) {
            if (isCurrentSearchRequest(requestId)) {
                setNewsData(null);
                setNewsLoading(false);
            }
            return;
        }

        setNewsLoading(true);
        try {
            const data = await apiRequest(API_ENDPOINTS.NEWS(companyName));
            if (!isCurrentSearchRequest(requestId)) return;
            setNewsData(Array.isArray(data) ? data : null);
        } catch {
            if (!isCurrentSearchRequest(requestId)) return;
            setNewsData(null);
        } finally {
            if (isCurrentSearchRequest(requestId)) {
                setNewsLoading(false);
            }
        }
    };

    const fetchChartData = async (symbol, timeFrame, requestId = null) => {
        const chartRequestId = latestChartRequestIdRef.current + 1;
        latestChartRequestIdRef.current = chartRequestId;
        if (requestId === null || isCurrentSearchRequest(requestId)) {
            setError('');
        }
        setChartLoading(true);
        try {
            const chartJson = await apiRequest(API_ENDPOINTS.CHART(symbol, timeFrame.value));
            if ((requestId !== null && !isCurrentSearchRequest(requestId)) || !isCurrentChartRequest(chartRequestId)) {
                return false;
            }
            setChartData(chartJson);
            return true;
        } catch (err) {
            if ((requestId !== null && !isCurrentSearchRequest(requestId)) || !isCurrentChartRequest(chartRequestId)) {
                return false;
            }
            setError(err.message);
            setChartData(null);
            return false;
        } finally {
            if ((requestId === null || isCurrentSearchRequest(requestId)) && isCurrentChartRequest(chartRequestId)) {
                setChartLoading(false);
            }
        }
    };

    const fetchPredictionData = async (symbol, requestId) => {
        try {
            const predJson = await apiRequest(API_ENDPOINTS.PREDICT_ENSEMBLE(symbol));
            if (!isCurrentSearchRequest(requestId)) return;
            setPredictionData(predJson);
        } catch {
            if (!isCurrentSearchRequest(requestId)) return;
            setPredictionData(null);
        }
    };

    const fetchComparisonBundle = async (symbol, timeFrame) => {
        const comparisonRequestId = latestComparisonRequestIdRef.current + 1;
        latestComparisonRequestIdRef.current = comparisonRequestId;

        try {
            const stockJson = await apiRequest(API_ENDPOINTS.STOCK(symbol));
            if (!isCurrentComparisonRequest(comparisonRequestId)) {
                return false;
            }
            const [chartResult, predictionResult, newsResult] = await Promise.allSettled([
                apiRequest(API_ENDPOINTS.CHART(symbol, timeFrame.value)),
                apiRequest(API_ENDPOINTS.PREDICT_ENSEMBLE(symbol)),
                stockJson.companyName ? apiRequest(API_ENDPOINTS.NEWS(stockJson.companyName)) : Promise.resolve([]),
            ]);
            if (!isCurrentComparisonRequest(comparisonRequestId)) {
                return false;
            }
            setComparisonData({
                ticker: symbol,
                stockData: stockJson,
                chartData: chartResult.status === 'fulfilled' ? chartResult.value : null,
                predictionData: predictionResult.status === 'fulfilled' ? predictionResult.value : null,
                newsData:
                    newsResult.status === 'fulfilled' && Array.isArray(newsResult.value)
                        ? newsResult.value
                        : [],
            });
            return true;
        } catch (err) {
            if (!isCurrentComparisonRequest(comparisonRequestId)) {
                return false;
            }
            setComparisonData(null);
            throw err;
        }
    };

    const runSearch = async (rawTicker) => {
        const searchTicker = (rawTicker || '').trim().toUpperCase();
        if (!searchTicker) return;

        const requestId = latestSearchRequestIdRef.current + 1;
        latestSearchRequestIdRef.current = requestId;
        latestChartRequestIdRef.current += 1;
        latestComparisonRequestIdRef.current += 1;

        setTicker(searchTicker);
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);
        setLoading(true);
        setStockData(null);
        setChartData(null);
        setPredictionData(null);
        setComparisonData(null);
        setCompareTicker('');
        setNewsData(null);
        setNewsLoading(false);
        setError('');
        setSearchedTicker('');

        const defaultTimeFrame = timeFrames.find(f => f.value === '14d');
        setActiveTimeFrame(defaultTimeFrame);

        try {
            const stockJson = await apiRequest(API_ENDPOINTS.STOCK(searchTicker));
            if (!isCurrentSearchRequest(requestId)) return;

            setStockData(stockJson);
            setSearchedTicker(searchTicker);
            saveRecentSearch(searchTicker);

            await Promise.allSettled([
                fetchNewsData(stockJson.companyName, requestId),
                fetchChartData(searchTicker, defaultTimeFrame, requestId),
                fetchPredictionData(searchTicker, requestId),
            ]);
        } catch (err) {
            if (!isCurrentSearchRequest(requestId)) return;
            setError(err.message || 'An error occurred. Try "AAPL", "GOOGL", or "TSLA".');
            setSearchedTicker('');
        } finally {
            if (isCurrentSearchRequest(requestId)) {
                setLoading(false);
            }
        }
    };

    // --- NEW: Autocomplete handlers ---
    const handleAutocompleteClick = (suggestion) => {
        runSearch(suggestion.symbol);
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
        await runSearch(overrideTicker || ticker);
    };
    
    const handleAddComparison = async (e) => {
        e.preventDefault();
        if (!compareTicker || !activeTimeFrame) return;
        const normalizedTicker = compareTicker.trim().toUpperCase();
        if (normalizedTicker === searchedTicker) {
            alert('Choose a different ticker to compare.');
            return;
        }
        
        try {
            await fetchComparisonBundle(normalizedTicker, activeTimeFrame);
            setCompareTicker(''); 
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRecentSearchClick = (recentTicker) => {
        runSearch(recentTicker);
    };

    const handleTimeFrameChange = (timeFrame) => {
        setActiveTimeFrame(timeFrame);
        if (searchedTicker) {
            fetchChartData(searchedTicker, timeFrame);
            if (comparisonData) {
                (async () => {
                    try {
                        await fetchComparisonBundle(comparisonData.ticker, timeFrame);
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
        <div className="ui-page animate-fade-in flex flex-col items-center">
            <div className="w-full max-w-4xl">
                <div className="ui-page-header text-center">
                    <h1 className="ui-page-title">Stock Ticker Search</h1>
                    <p className="ui-page-subtitle">Enter a ticker, compare adjacent names, and inspect supporting context without the page changing visual tone from block to block.</p>
                </div>

                <div className="ui-panel p-6 sm:p-8">
                    <form onSubmit={handleSearch} className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            <Search className="h-5 w-5 text-mm-text-tertiary" />
                        </div>
                        <input
                            type="text"
                            value={ticker}
                            onChange={handleTickerChange}
                            onFocus={handleTickerFocus}
                            onBlur={handleTickerBlur}
                            placeholder="e.g., AAPL or Apple"
                            className="ui-input w-full py-4 pl-12 pr-32 text-lg"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="ui-button-primary absolute right-2 top-2 h-[44px] px-6"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>

                        {showAutocomplete && autocompleteSuggestions.length > 0 && (
                            <div className="ui-panel-elevated absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden animate-fade-in">
                                <ul className="divide-y divide-mm-border">
                                    {autocompleteSuggestions.map((stock) => (
                                        <li
                                            key={stock.symbol}
                                            onMouseDown={() => handleAutocompleteClick(stock)}
                                            className="cursor-pointer px-4 py-3 text-left hover:bg-mm-surface-subtle"
                                        >
                                            <span className="font-semibold text-mm-text-primary">{stock.symbol}</span>
                                            <span className="ml-3 text-mm-text-secondary">{stock.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </form>

                    {recentSearches.length > 0 && (
                        <div className="mt-6 animate-fade-in">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="ui-section-label mb-0">Recent Searches</p>
                                <button
                                    onClick={clearRecentSearches}
                                    className="text-xs font-medium text-mm-text-secondary hover:text-mm-accent-primary"
                                >
                                    Clear All
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map((recentTicker) => (
                                    <button
                                        key={recentTicker}
                                        onClick={() => handleRecentSearchClick(recentTicker)}
                                        className="ui-chip"
                                    >
                                        {recentTicker}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-8">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="ui-section-label mb-0">Trending and Suggested</h3>
                            <button
                                onClick={fetchSuggestions}
                                disabled={loadingSuggestions}
                                className="text-xs font-medium text-mm-accent-primary hover:underline"
                            >
                                {loadingSuggestions ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>

                        {suggestions && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div className="rounded-card border p-4 shadow-card" style={{ backgroundColor: 'rgb(var(--mm-positive) / 0.07)', borderColor: 'rgb(var(--mm-positive) / 0.14)' }}>
                                        <h4 className="mb-3 flex items-center text-sm font-semibold text-mm-positive">
                                            <TrendingUp className="mr-1 h-4 w-4" />
                                            Top Gainers
                                        </h4>
                                        <div className="space-y-2">
                                            {(suggestions?.trending?.gainers || []).slice(0, 3).map((stock) => (
                                                <button
                                                    key={stock.ticker}
                                                    onClick={() => handleSuggestionClick(stock.ticker)}
                                                    className="w-full rounded-control p-2 text-left transition-colors hover:bg-mm-surface"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-mm-text-primary">{stock.ticker}</span>
                                                        <span className="text-sm text-mm-positive">+{stock.change_percent.toFixed(2)}%</span>
                                                    </div>
                                                    <div className="truncate text-xs text-mm-text-secondary">{stock.name}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-card border p-4 shadow-card" style={{ backgroundColor: 'rgb(var(--mm-negative) / 0.06)', borderColor: 'rgb(var(--mm-negative) / 0.14)' }}>
                                        <h4 className="mb-3 flex items-center text-sm font-semibold text-mm-negative">
                                            <TrendingDown className="mr-1 h-4 w-4" />
                                            Top Losers
                                        </h4>
                                        <div className="space-y-2">
                                            {(suggestions?.trending?.losers || []).slice(0, 3).map((stock) => (
                                                <button
                                                    key={stock.ticker}
                                                    onClick={() => handleSuggestionClick(stock.ticker)}
                                                    className="w-full rounded-control p-2 text-left transition-colors hover:bg-mm-surface"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-mm-text-primary">{stock.ticker}</span>
                                                        <span className="text-sm text-mm-negative">{stock.change_percent.toFixed(2)}%</span>
                                                    </div>
                                                    <div className="truncate text-xs text-mm-text-secondary">{stock.name}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="ui-panel-subtle p-4">
                                        <h4 className="mb-3 flex items-center text-sm font-semibold text-mm-accent-primary">
                                            <Activity className="mr-1 h-4 w-4" />
                                            Most Active
                                        </h4>
                                        <div className="space-y-2">
                                            {(suggestions?.trending?.most_active || []).slice(0, 3).map((stock) => (
                                                <button
                                                    key={stock.ticker}
                                                    onClick={() => handleSuggestionClick(stock.ticker)}
                                                    className="w-full rounded-control p-2 text-left transition-colors hover:bg-mm-surface"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-mm-text-primary">{stock.ticker}</span>
                                                        <span className="text-xs text-mm-text-secondary">{(stock.volume / 1000000).toFixed(1)}M</span>
                                                    </div>
                                                    <div className="truncate text-xs text-mm-text-secondary">{stock.name}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="mb-3 flex items-center text-sm font-semibold text-mm-text-primary">
                                        <Building className="mr-2 h-4 w-4 text-mm-accent-primary" />
                                        Browse by Sector
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                                        {Object.entries(suggestions?.sectors || {}).map(([sector, sectorData]) => (
                                            <div key={sector} className="ui-panel-subtle overflow-hidden">
                                                <button
                                                    onClick={() => toggleSector(sector)}
                                                    className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-mm-surface"
                                                >
                                                    <div>
                                                        <h5 className="text-sm font-medium text-mm-text-primary">{sector}</h5>
                                                        <p className="truncate text-xs text-mm-text-secondary">{sectorData.description}</p>
                                                    </div>
                                                    {expandedSectors[sector] ? (
                                                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-mm-text-tertiary" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-mm-text-tertiary" />
                                                    )}
                                                </button>

                                                {expandedSectors[sector] && (
                                                    <div className="px-3 pb-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            {sectorData.stocks.slice(0, 8).map((stock) => (
                                                                <button
                                                                    key={stock.ticker}
                                                                    onClick={() => handleSuggestionClick(stock.ticker)}
                                                                    className="rounded-control border border-mm-border bg-mm-surface px-2 py-1 text-xs font-medium text-mm-text-secondary transition-colors hover:bg-mm-surface-subtle hover:text-mm-accent-primary"
                                                                >
                                                                    {stock.ticker}
                                                                    {stock.change_percent !== 0 && (
                                                                        <span className={`ml-1 ${stock.change_percent > 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
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
            </div>

            <div className="mt-6 w-full max-w-5xl">
                {error && !chartLoading && (
                    <div className="rounded-card border p-4 text-center text-mm-negative shadow-card" style={{ backgroundColor: 'rgb(var(--mm-negative) / 0.08)', borderColor: 'rgb(var(--mm-negative) / 0.16)' }}>
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

                {stockData && comparisonData && (
                    <div className="ui-panel mt-8 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="ui-section-label mb-2">Compare Mode</p>
                                <h2 className="mt-2 text-2xl font-semibold text-mm-text-primary">
                                    {searchedTicker} vs {comparisonData.ticker}
                                </h2>
                                <p className="mt-2 text-sm text-mm-text-secondary">
                                    Side-by-side context for price, predictions, fundamentals, and news.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setComparisonData(null)}
                                className="ui-button-secondary"
                            >
                                Clear comparison
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 xl:grid-cols-2">
                            <AssetCompareCard
                                eyebrow="Primary"
                                accent="blue"
                                ticker={searchedTicker}
                                title={stockData.companyName}
                                subtitle={stockData.fundamentals?.industry || 'Current search result'}
                                metrics={buildCompareMetrics({
                                    stockData,
                                    predictionData,
                                    newsData,
                                })}
                            />
                            <AssetCompareCard
                                eyebrow="Comparison"
                                accent="slate"
                                ticker={comparisonData.ticker}
                                title={comparisonData.stockData?.companyName}
                                subtitle={comparisonData.stockData?.fundamentals?.industry || 'Comparison asset'}
                                metrics={buildCompareMetrics({
                                    stockData: comparisonData.stockData,
                                    predictionData: comparisonData.predictionData,
                                    newsData: comparisonData.newsData,
                                })}
                            />
                        </div>
                    </div>
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

                {chartLoading && <div className="p-8 text-center text-mm-text-secondary">Loading chart...</div>}
                {chartData && !chartLoading && (
                    <div className="mt-8 animate-fade-in">
                        <div className="ui-panel p-4 sm:p-5">
                            <form onSubmit={handleAddComparison} className="flex gap-2">
                                <input
                                    type="text"
                                    value={compareTicker}
                                    onChange={(e) => setCompareTicker(e.target.value.toUpperCase())}
                                    placeholder="Compare (e.g., MSFT)"
                                    className="ui-input"
                                />
                                <button
                                    type="submit"
                                    className="ui-button-secondary px-6"
                                >
                                    Add
                                </button>
                            </form>
                        </div>

                        <StockChart
                            chartData={chartData}
                            ticker={searchedTicker}
                            onTimeFrameChange={handleTimeFrameChange}
                            activeTimeFrame={activeTimeFrame}
                            comparisonData={
                                comparisonData?.chartData
                                    ? { ticker: comparisonData.ticker, data: comparisonData.chartData }
                                    : null
                            }
                        />
                    </div>
                )}

                {newsLoading && <div className="p-8 text-center text-mm-text-secondary">Loading news...</div>}
                {newsData && newsData.length > 0 && !newsLoading && <StockNewsCard newsData={newsData} />}
            </div>
        </div>
    );
};

export default SearchPage;
