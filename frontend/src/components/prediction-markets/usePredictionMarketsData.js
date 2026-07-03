import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { API_ENDPOINTS, apiRequest } from '../../config/api';

export default function usePredictionMarketsData() {
    const { isLoaded, isSignedIn } = useAuth();
    const [markets, setMarkets] = useState([]);
    const [loadingMarkets, setLoadingMarkets] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [expandedMarketId, setExpandedMarketId] = useState(null);
    const [portfolio, setPortfolio] = useState(null);
    const [tradeHistory, setTradeHistory] = useState([]);
    const [loadingPortfolio, setLoadingPortfolio] = useState(true);
    const [activeTab, setActiveTab] = useState('markets');
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
    const [analysisByMarketId, setAnalysisByMarketId] = useState({});

    const analysisEnabled = isLoaded && isSignedIn;

    const fetchMarkets = useCallback(async (search = '') => {
        setLoadingMarkets(true);
        try {
            const url = API_ENDPOINTS.PREDICTION_MARKETS('polymarket', 50, search);
            const data = await apiRequest(url);
            setMarkets(data.markets || []);
        } catch (err) {
            console.error('Error fetching markets:', err);
        } finally {
            setLoadingMarkets(false);
        }
    }, []);

    const refreshPortfolioState = useCallback(async () => {
        if (!isLoaded || !isSignedIn) {
            setPortfolio(null);
            setTradeHistory([]);
            setLoadingPortfolio(false);
            return;
        }

        setLoadingPortfolio(true);
        try {
            const [portfolioData, historyData] = await Promise.all([
                apiRequest(API_ENDPOINTS.PREDICTION_PORTFOLIO),
                apiRequest(API_ENDPOINTS.PREDICTION_HISTORY),
            ]);
            setPortfolio(portfolioData);
            setTradeHistory(historyData || []);
        } catch (err) {
            console.error('Error refreshing prediction portfolio:', err);
        } finally {
            setLoadingPortfolio(false);
        }
    }, [isLoaded, isSignedIn]);

    const handleReset = async () => {
        if (!window.confirm('Reset your prediction markets portfolio to $10,000?')) return;
        try {
            await apiRequest(API_ENDPOINTS.PREDICTION_RESET, { method: 'POST' });
            setStatusMessage({ type: 'success', text: 'Prediction portfolio reset successfully' });
            setActiveTab('portfolio');
            await refreshPortfolioState();
        } catch {
            setStatusMessage({ type: 'error', text: 'Failed to reset portfolio' });
        }
    };

    const handleSellPosition = async (position) => {
        const numContracts = prompt(`Sell how many "${position.outcome}" contracts? (You have ${position.contracts})`);
        if (!numContracts) return;
        try {
            const data = await apiRequest(API_ENDPOINTS.PREDICTION_SELL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: position.market_id,
                    outcome: position.outcome,
                    contracts: parseFloat(numContracts),
                }),
            });
            setStatusMessage({ type: 'success', text: data.message });
            await refreshPortfolioState();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message || 'Failed to execute sell' });
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveSearch(searchInput);
        fetchMarkets(searchInput);
    };

    const handleAnalyzeMarket = async (market) => {
        if (!analysisEnabled) {
            setAnalysisByMarketId((prev) => ({
                ...prev,
                [market.id]: {
                    status: 'error',
                    data: null,
                    error: 'Sign in to generate Market vs Model analysis.',
                },
            }));
            return;
        }

        setAnalysisByMarketId((prev) => ({
            ...prev,
            [market.id]: { status: 'loading', data: null, error: '' },
        }));

        try {
            const data = await apiRequest(API_ENDPOINTS.PREDICTION_ANALYZE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: market.id,
                    exchange: 'polymarket',
                }),
            });
            setAnalysisByMarketId((prev) => ({
                ...prev,
                [market.id]: { status: 'success', data, error: '' },
            }));
        } catch (err) {
            setAnalysisByMarketId((prev) => ({
                ...prev,
                [market.id]: {
                    status: 'error',
                    data: null,
                    error: err.message || 'Failed to analyze market',
                },
            }));
        }
    };

    const onTradeComplete = async (message) => {
        setStatusMessage({ type: 'success', text: message || 'Trade executed successfully' });
        setExpandedMarketId(null);
        setActiveTab('portfolio');
        await refreshPortfolioState();
    };

    useEffect(() => {
        fetchMarkets();
    }, [fetchMarkets]);

    useEffect(() => {
        refreshPortfolioState();
    }, [refreshPortfolioState]);


    return {
        activeSearch, activeTab, analysisByMarketId, analysisEnabled,
        expandedMarketId, fetchMarkets, handleAnalyzeMarket, handleReset,
        handleSearch, handleSellPosition, loadingMarkets, loadingPortfolio,
        markets, onTradeComplete, portfolio, refreshPortfolioState,
        searchInput, setActiveTab, setExpandedMarketId, setSearchInput,
        setStatusMessage, statusMessage, tradeHistory,
    };
}
