import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowLeftRight, RefreshCw } from 'lucide-react';

const ForexPage = () => {
    const [currencies, setCurrencies] = useState([]);
    const [fromCurrency, setFromCurrency] = useState('USD');
    const [toCurrency, setToCurrency] = useState('EUR');
    const [amount, setAmount] = useState(1);
    const [exchangeData, setExchangeData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Popular currency pairs for quick access
    const popularPairs = [
        { from: 'USD', to: 'EUR', label: 'USD → EUR' },
        { from: 'USD', to: 'GBP', label: 'USD → GBP' },
        { from: 'USD', to: 'JPY', label: 'USD → JPY' },
        { from: 'EUR', to: 'USD', label: 'EUR → USD' },
        { from: 'GBP', to: 'USD', label: 'GBP → USD' },
        { from: 'USD', to: 'CAD', label: 'USD → CAD' },
    ];

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('http://localhost:5001/forex/currencies');
            const data = await response.json();
            setCurrencies(data);
        } catch (err) {
            console.error('Error fetching currencies:', err);
        }
    };

    const handleConvert = async () => {
        setLoading(true);
        setError('');
        
        try {
            const response = await fetch(
                `http://localhost:5001/forex/convert?from=${fromCurrency}&to=${toCurrency}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch exchange rate');
            }

            const data = await response.json();
            setExchangeData(data);
        } catch (err) {
            setError('Could not fetch exchange rate. Please try again.');
            console.error('Conversion error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSwap = (from, to) => {
        setFromCurrency(from);
        setToCurrency(to);
    };

    // Fetch available currencies on mount
    useEffect(() => {
        fetchCurrencies();
    }, []);

    // Automatically convert when currencies are loaded or when from/to currency changes
    useEffect(() => {
        if (currencies.length > 0) {
            handleConvert();
        }
    }, [currencies, fromCurrency, toCurrency]);

    const convertedAmount = exchangeData ? (amount * exchangeData.exchange_rate).toFixed(2) : '0.00';

    return (
        <div className="container mx-auto px-6 py-8 max-w-6xl">
            {/* Header */}
            <div className="text-center mb-8 animate-fade-in">
                <div className="flex items-center justify-center mb-2">
                    <DollarSign className="w-10 h-10 text-blue-600 dark:text-blue-400 mr-3" />
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                        Foreign Exchange (Forex)
                    </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    Real-time currency exchange rates powered by Alpha Vantage
                </p>
            </div>

            {/* Main Converter Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 animate-fade-in transition-colors duration-200">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Currency Converter</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    {/* From Currency */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            From
                        </label>
                        <div className="space-y-2">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Amount"
                                min="0"
                                step="0.01"
                            />
                            <select
                                value={fromCurrency}
                                onChange={(e) => setFromCurrency(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {currencies.map((curr) => (
                                    <option key={curr.code} value={curr.code}>
                                        {curr.flag} {curr.code} - {curr.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Swap Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={() => handleSwap(fromCurrency, toCurrency)}
                            className="p-3 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-full transition-all active:scale-95"
                            aria-label="Swap currencies"
                        >
                            <ArrowLeftRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </button>
                    </div>

                    {/* To Currency */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            To
                        </label>
                        <div className="space-y-2">
                            <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg bg-gray-50 font-bold text-lg">
                                {loading ? '...' : convertedAmount}
                            </div>
                            <select
                                value={toCurrency}
                                onChange={(e) => setToCurrency(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {currencies.map((curr) => (
                                    <option key={curr.code} value={curr.code}>
                                        {curr.flag} {curr.code} - {curr.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Convert Button */}
                <div className="mt-6">
                    <button
                        onClick={handleConvert}
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
                            loading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                    >
                        {loading ? 'Converting...' : 'Convert'}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
                        <span>{error}</span>
                        <button
                            onClick={() => {
                                setError('');
                                handleConvert();
                            }}
                            className="flex items-center space-x-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all text-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Retry</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Exchange Rate Details */}
            {exchangeData && !loading && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-6 mb-8 animate-fade-in border border-blue-100 dark:border-blue-800">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Exchange Rate</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {exchangeData.exchange_rate.toFixed(6)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                1 {exchangeData.from_currency.code} = {exchangeData.exchange_rate.toFixed(4)} {exchangeData.to_currency.code}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Bid Price</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                {exchangeData.bid_price.toFixed(6)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ask Price</p>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400">
                                {exchangeData.ask_price.toFixed(6)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Updated</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {new Date(exchangeData.last_refreshed).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                {exchangeData.timezone}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Popular Pairs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 animate-fade-in">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Popular Currency Pairs</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {popularPairs.map((pair, index) => (
                        <button
                            key={index}
                            onClick={() => handleSwap(pair.from, pair.to)}
                            className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                                fromCurrency === pair.from && toCurrency === pair.to
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            }`}
                        >
                            {pair.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Info Note */}
            <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 animate-fade-in">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>Note:</strong> Exchange rates are provided by Alpha Vantage and are updated in real-time. 
                    Rates shown are for informational purposes only and may differ from actual trading rates. 
                    Always verify rates with your financial institution before making transactions.
                </p>
            </div>
        </div>
    );
};

export default ForexPage;
