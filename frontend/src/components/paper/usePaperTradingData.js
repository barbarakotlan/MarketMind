import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';

export default function usePaperTradingData() {
    const { sharedTicker: initialTicker, clearTicker: onConsumeInitialTicker } = useNavigation();
    const [portfolio, setPortfolio] = useState(null);
    const [stockPositions, setStockPositions] = useState([]);
    const [optionsPositions, setOptionsPositions] = useState([]);
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
    const [optimizationMethod, setOptimizationMethod] = useState('black_litterman');
    const [optimizationData, setOptimizationData] = useState(null);
    const [optimizationLoading, setOptimizationLoading] = useState(false);
    const [optimizationError, setOptimizationError] = useState('');

    useEffect(() => {
        const normalizedTicker = String(initialTicker || '').trim().toUpperCase();
        if (!normalizedTicker) return;
        setBuyTicker(normalizedTicker);
        setBuyShares('');
        setShowBuyModal(true);
        if (onConsumeInitialTicker) onConsumeInitialTicker();
    }, [initialTicker, onConsumeInitialTicker]);

    const fetchPortfolio = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const data = await apiRequest(API_ENDPOINTS.PORTFOLIO);

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

    useEffect(() => {
        fetchPortfolio();
        const interval = setInterval(() => {
            fetchPortfolio();
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchOptimization = useCallback(async (method = optimizationMethod) => {
        setOptimizationLoading(true);
        setOptimizationError('');
        try {
            const payload = await apiRequest(API_ENDPOINTS.PORTFOLIO_OPTIMIZE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method,
                    use_predictions: true,
                }),
            });
            setOptimizationData(payload);
        } catch (err) {
            setOptimizationData(null);
            setOptimizationError(err.message || 'Unable to generate portfolio recommendations right now.');
        } finally {
            setOptimizationLoading(false);
        }
    }, [optimizationMethod]);

    useEffect(() => {
        if (!portfolio) return;
        if (stockPositions.length < 2) {
            setOptimizationData(null);
            setOptimizationError('');
            setOptimizationLoading(false);
            return;
        }
        fetchOptimization(optimizationMethod);
    }, [portfolio, stockPositions.length, optimizationMethod, fetchOptimization]);

    const handleBuy = async (e) => {
        e.preventDefault();
        setTradeMessage({ type: '', text: '' });
        try {
            const data = await apiRequest(API_ENDPOINTS.PAPER_BUY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: buyTicker.toUpperCase(), shares: parseFloat(buyShares) })
            });
            setTradeMessage({ type: 'success', text: data.message });
            setBuyTicker('');
            setBuyShares('');
            setShowBuyModal(false);
            fetchPortfolio();
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message || 'Failed to execute trade' });
        }
    };

    const handleSell = async (e) => {
        e.preventDefault();
        setTradeMessage({ type: '', text: '' });
        try {
            const data = await apiRequest(API_ENDPOINTS.PAPER_SELL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: selectedStock.ticker, shares: parseFloat(sellShares) })
            });
            setTradeMessage({ type: 'success', text: data.message });
            setSellShares('');
            setShowSellModal(false);
            setSelectedStock(null);
            fetchPortfolio();
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message || 'Failed to execute trade' });
        }
    };

    const handleConfirmOptionSell = async (contractSymbol, quantity, price, isBuy) => {
        if (isBuy) return { success: false, errorMessage: 'Buying options is not supported in this modal.' };
        const body = JSON.stringify({
            contractSymbol: contractSymbol,
            quantity: quantity,
            price: price
        });
        try {
            const data = await apiRequest(API_ENDPOINTS.PAPER_OPTIONS_SELL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            setTradeMessage({ type: 'success', text: data.message });
            fetchPortfolio();
            return { success: true };
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message });
            return { success: false, errorMessage: err.message };
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
            const data = await apiRequest(API_ENDPOINTS.PORTFOLIO_RESET, { method: 'POST' });
            setTradeMessage({ type: 'success', text: data.message });
            fetchPortfolio();
        } catch (err) {
            setTradeMessage({ type: 'error', text: err.message || 'Failed to reset portfolio' });
        }
    };

    return {
        buyShares, buyTicker, fetchPortfolio, handleBuy,
        handleConfirmOptionSell, handleManageOption, handleReset, handleSell,
        isOptionModalOpen, lastUpdated, loading, optimizationData,
        optimizationError, optimizationLoading, optimizationMethod, optionsPositions,
        portfolio, refreshing, selectedOption, selectedStock,
        sellShares, setBuyShares, setBuyTicker, setIsOptionModalOpen,
        setOptimizationMethod, setSelectedStock, setSellShares, setShowBuyModal,
        setShowSellModal, setTradeMessage, showBuyModal, showSellModal,
        stockPositions, tradeMessage,
    };
}
