import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';
import { MARKET_OPTIONS, isUsAsset } from './searchUtils';

const normalizeMarket = (market = 'us') => {
    const normalized = String(market || 'us').trim().toLowerCase();
    return MARKET_OPTIONS.some((option) => option.value === normalized) ? normalized : 'us';
};

const normalizeAssetInput = (input, fallbackMarket = 'us') => {
    if (!input) return null;
    if (typeof input === 'object') {
        const market = normalizeMarket(input.market || fallbackMarket);
        const symbol = String(input.symbol || input.displaySymbol || '').trim().toUpperCase();
        if (!symbol) return null;
        const assetId = String(input.assetId || `${market.toUpperCase()}:${symbol}`).trim().toUpperCase();
        return {
            symbol,
            market: market.toUpperCase(),
            assetId,
            displayLabel: market === 'us' ? symbol : assetId,
            name: input.name || input.displayName || symbol,
            exchange: input.exchange || (market === 'hk' ? 'HKEX' : market === 'cn' ? 'CN' : 'US'),
        };
    }

    const rawValue = String(input).trim();
    if (!rawValue) return null;
    const prefixed = rawValue.match(/^([A-Za-z]{2}):(.+)$/);
    const market = normalizeMarket(prefixed?.[1] || fallbackMarket);
    const rawSymbol = prefixed?.[2] || rawValue;
    const symbol = market === 'us'
        ? rawSymbol.trim().toUpperCase()
        : rawSymbol.replace(/\D/g, '').padStart(market === 'hk' ? 5 : 6, '0');
    const assetId = market === 'us' ? `US:${symbol}` : `${market.toUpperCase()}:${symbol}`;
    return {
        symbol,
        market: market.toUpperCase(),
        assetId,
        displayLabel: market === 'us' ? symbol : assetId,
        name: symbol,
        exchange: market === 'hk' ? 'HKEX' : market === 'cn' ? 'CN' : 'US',
    };
};

const mapScreenerSuggestion = (stock = {}) => ({
    ticker: stock.symbol || '',
    name: stock.name || stock.symbol || '',
    change_percent: typeof stock.percent_change === 'number' ? stock.percent_change * 100 : 0,
    volume: typeof stock.volume === 'number' ? stock.volume : 0,
});

const timeFrames = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '14D', value: '14d' },
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

export default function useSearchData() {
    const {
        sharedTicker: initialTicker,
        sharedCompareTicker: initialCompareTicker,
        clearTicker,
        clearCompareTicker,
    } = useNavigation();
    const onClearInitialTicker = () => {
        clearTicker();
        clearCompareTicker();
    };
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
            const data = await apiRequest(API_ENDPOINTS.SEARCH_SYMBOLS(query, selectedMarket));
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
    const handleSuggestionClick = async (asset) => {
        await runSearch(asset);
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
    const [searchedAsset, setSearchedAsset] = useState(null);
    const [selectedMarket, setSelectedMarket] = useState('us');
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
            (async () => {
                await runSearch(initialTicker);
                if (initialCompareTicker) {
                    try {
                        await fetchComparisonBundle(
                            String(initialCompareTicker).trim().toUpperCase(),
                            timeFrames.find(f => f.value === '14d')
                        );
                    } catch {
                        setComparisonData(null);
                    }
                }
            })();
            if (onClearInitialTicker) onClearInitialTicker();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTicker, initialCompareTicker]);

    useEffect(() => {
        // Load recent searches from localStorage
        const saved = localStorage.getItem('recentSearches');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setRecentSearches(Array.isArray(parsed) ? parsed.map((entry) => normalizeAssetInput(entry, 'us')).filter(Boolean) : []);
            } catch (e) {
                console.error('Failed to load recent searches:', e);
            }
        }
    }, []); 

    const saveRecentSearch = (asset) => {
        const normalizedAsset = normalizeAssetInput(asset, selectedMarket);
        if (!normalizedAsset) return;
        setRecentSearches((prevSearches) => {
            const updated = [
                normalizedAsset,
                ...prevSearches.filter((item) => item?.assetId !== normalizedAsset.assetId),
            ].slice(0, 8);
            localStorage.setItem('recentSearches', JSON.stringify(updated));
            return updated;
        });
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const fetchNewsData = async (companyName, requestId, market = 'US', relatedNews = null) => {
        if (market !== 'US') {
            if (isCurrentSearchRequest(requestId)) {
                setNewsData(Array.isArray(relatedNews) && relatedNews.length ? relatedNews : null);
                setNewsLoading(false);
            }
            return;
        }
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

    const fetchChartData = async (asset, timeFrame, requestId = null) => {
        const chartRequestId = latestChartRequestIdRef.current + 1;
        latestChartRequestIdRef.current = chartRequestId;
        if (requestId === null || isCurrentSearchRequest(requestId)) {
            setError('');
        }
        setChartLoading(true);
        try {
            const chartJson = await apiRequest(API_ENDPOINTS.CHART(asset.symbol, timeFrame.value, asset.market));
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

    const fetchPredictionData = async (asset, requestId) => {
        if (!isUsAsset(asset)) {
            if (isCurrentSearchRequest(requestId)) {
                setPredictionData(null);
            }
            return;
        }
        try {
            const predJson = await apiRequest(API_ENDPOINTS.PREDICT_ENSEMBLE(asset.symbol));
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
            const stockJson = await apiRequest(API_ENDPOINTS.STOCK(symbol, 'us'));
            if (!isCurrentComparisonRequest(comparisonRequestId)) {
                return false;
            }
            const [chartResult, predictionResult, newsResult] = await Promise.allSettled([
                apiRequest(API_ENDPOINTS.CHART(symbol, timeFrame.value, 'us')),
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
        const asset = normalizeAssetInput(rawTicker, selectedMarket);
        if (!asset) return;

        const requestId = latestSearchRequestIdRef.current + 1;
        latestSearchRequestIdRef.current = requestId;
        latestChartRequestIdRef.current += 1;
        latestComparisonRequestIdRef.current += 1;

        setTicker(asset.displayLabel);
        setSelectedMarket(asset.market.toLowerCase());
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
        setSearchedAsset(null);

        const defaultTimeFrame = timeFrames.find(f => f.value === '14d');
        setActiveTimeFrame(defaultTimeFrame);

        try {
            const stockJson = await apiRequest(API_ENDPOINTS.STOCK(asset.symbol, asset.market));
            if (!isCurrentSearchRequest(requestId)) return;

            setStockData(stockJson);
            const resolvedAsset = normalizeAssetInput(
                {
                    symbol: stockJson.symbol || asset.symbol,
                    market: stockJson.market || asset.market,
                    assetId: stockJson.assetId || asset.assetId,
                    name: stockJson.companyName || asset.name,
                    exchange: stockJson.exchange || asset.exchange,
                },
                asset.market
            );
            setSearchedAsset(resolvedAsset);
            setSearchedTicker(resolvedAsset?.displayLabel || asset.displayLabel);
            if (resolvedAsset?.market) {
                setSelectedMarket(resolvedAsset.market.toLowerCase());
            }
            saveRecentSearch(resolvedAsset || asset);

            await Promise.allSettled([
                fetchNewsData(stockJson.companyName, requestId, resolvedAsset?.market || asset.market, stockJson.relatedNews),
                fetchChartData(resolvedAsset || asset, defaultTimeFrame, requestId),
                fetchPredictionData(resolvedAsset || asset, requestId),
            ]);
        } catch (err) {
            if (!isCurrentSearchRequest(requestId)) return;
            setError(err.message || 'An error occurred. Try "AAPL", "HK:00700", or "CN:600519".');
            setSearchedTicker('');
        } finally {
            if (isCurrentSearchRequest(requestId)) {
                setLoading(false);
            }
        }
    };

    // --- NEW: Autocomplete handlers ---
    const handleAutocompleteClick = (suggestion) => {
        runSearch(suggestion);
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
        if (normalizedTicker === searchedAsset?.symbol) {
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

    const handleRecentSearchClick = (recentAsset) => {
        runSearch(recentAsset);
    };

    const handleTimeFrameChange = (timeFrame) => {
        setActiveTimeFrame(timeFrame);
        if (searchedAsset) {
            fetchChartData(searchedAsset, timeFrame);
            if (comparisonData && isUsAsset(searchedAsset)) {
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
        if (!isUsAsset(searchedAsset)) {
            return;
        }
        try {
            const result = await apiRequest(API_ENDPOINTS.WATCHLIST_ITEM(tickerToAdd), {
                method: 'POST',
            });
            alert(result.message || `${tickerToAdd} added to watchlist.`);
        } catch (err) {
            alert(err.message || 'Failed to add stock to watchlist. Is the server running?');
        }
    };


    return {
        activeTimeFrame, autocompleteSuggestions, chartData, chartLoading,
        clearRecentSearches, compareTicker, comparisonData, error,
        expandedSectors, fetchSuggestions, handleAddComparison, handleAddToWatchlist,
        handleAutocompleteClick, handleRecentSearchClick, handleSearch, handleSuggestionClick,
        handleTickerBlur, handleTickerChange, handleTickerFocus, handleTimeFrameChange,
        loading, loadingSuggestions, newsData, newsLoading,
        predictionData, recentSearches, searchedAsset, searchedTicker,
        selectedMarket, setCompareTicker, setComparisonData, setSelectedMarket,
        showAutocomplete, stockData, suggestions, ticker,
        toggleSector,
    };
}
