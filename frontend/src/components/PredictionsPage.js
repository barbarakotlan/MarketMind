import React, { useState, useEffect } from 'react';
import StockPredictionCard from './ui/StockPredictionCard';
import PredictionChart from './charts/PredictionChart';
import ModelComparisonCard from './ui/ModelComparisonCard';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import TickerAutocompleteInput from './TickerAutocompleteInput';

const DEFAULT_SINGLE_MODEL = 'LinReg';

const PredictionsPage = ({ initialTicker }) => {
    const [ticker, setTicker] = useState('');
    const [predictionData, setPredictionData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [useEnsemble, setUseEnsemble] = useState(true);
    const [useModel, setUseModel] = useState(DEFAULT_SINGLE_MODEL);

    const buildPredictionEndpoint = (searchTicker) => {
        const selectedModel = useModel || DEFAULT_SINGLE_MODEL;
        return useEnsemble
            ? API_ENDPOINTS.PREDICT_ENSEMBLE(searchTicker.toUpperCase())
            : API_ENDPOINTS.PREDICT(selectedModel, searchTicker.toUpperCase());
    };

    useEffect(() => {
        if (initialTicker && initialTicker.trim()) {
            setTicker(initialTicker);
            fetchPredictions(initialTicker);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTicker, useEnsemble]);

    const fetchPredictions = async (searchTicker) => {
        setLoading(true);
        setError('');
        setPredictionData(null);

        try {
            const data = await apiRequest(buildPredictionEndpoint(searchTicker));
            setPredictionData(data);
        } catch (err) {
            setError(err.message || `Error: Could not fetch predictions for ${searchTicker.toUpperCase()}. Please check the ticker and try again.`);
            console.error('Prediction fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();

        if (!ticker.trim()) {
            setError('Please enter a stock ticker');
            return;
        }

        fetchPredictions(ticker);
    };

    const handleSelectEnsembleMode = () => {
        setUseEnsemble(true);
    };

    const handleSelectSingleModelMode = () => {
        setUseEnsemble(false);
        if (!useModel) {
            setUseModel(DEFAULT_SINGLE_MODEL);
        }
    };

    const modeButtonClass = (active) => (
        active
            ? 'rounded-control border border-mm-accent-primary/20 bg-mm-accent-primary/10 px-4 py-2 font-semibold text-mm-accent-primary'
            : 'rounded-control border border-mm-border bg-mm-surface px-4 py-2 font-semibold text-mm-text-secondary transition hover:bg-mm-surface-subtle hover:text-mm-text-primary'
    );

    const modelButtonClass = (active) => (
        active
            ? 'rounded-control bg-mm-accent-primary px-3 py-2 text-white ring-2 ring-mm-accent-primary/25'
            : 'rounded-control border border-mm-border bg-mm-surface px-3 py-2 text-mm-text-secondary transition hover:bg-mm-surface-subtle hover:text-mm-text-primary'
    );

    return (
        <div className="ui-page animate-fade-in space-y-8">
            <div className="ui-page-header text-center">
                <h1 className="ui-page-title mb-2">Stock Price Predictions</h1>
                <p className="ui-page-subtitle">
                    Get 7 trading-session price predictions powered by a unified forecasting stack
                </p>
            </div>

            {/* Search Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 animate-fade-in transition-colors duration-200">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <TickerAutocompleteInput
                                value={ticker}
                                onChange={setTicker}
                                onSelect={(sym) => { setTicker(sym); fetchPredictions(sym); }}
                                placeholder="Enter stock ticker (e.g., AAPL, TSLA, MSFT)"
                                className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg"
                            />
                            <svg
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${
                            loading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                    >
                        {loading ? 'Predicting...' : 'Predict'}
                    </button>
                </form>
                
                {/* Ensemble Toggle */}
                <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={handleSelectEnsembleMode}
                        className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
                            useEnsemble
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                        }`}
                    >
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                            />
                        </svg>
                        Ensemble Mode (3 Models)
                    </button>
                    <button
                        type="button"
                        onClick={handleSelectSingleModelMode}
                        className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
                            useEnsemble
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                        }`}
                    >
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                            />
                        </svg>
                        Single Model
                    </button>
                    {!useEnsemble && (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setUseModel('LinReg')}
                                className={`px-3 py-2 rounded-md transition-all ${
                                    useModel === 'LinReg'
                                        ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400'
                                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                                }`}
                            >
                                Linear Regression
                            </button>
                            <button
                                type="button"
                                onClick={() => setUseModel('RandomForest')}
                                className={`px-3 py-2 rounded-md transition-all ${
                                    useModel === 'RandomForest'
                                        ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400'
                                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                                }`}
                            >
                                Random Forest
                            </button>
                            <button
                                type="button"
                                onClick={() => setUseModel('XGBoost')}
                                className={`px-3 py-2 rounded-md transition-all ${
                                    useModel === 'XGBoost'
                                        ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400'
                                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                                }`}
                            >
                                XGBoost
                            </button>
                            <button
                                type="button"
                                onClick={() => setUseModel('GRU')}
                                className={`px-3 py-2 rounded-md transition-all ${
                                    useModel === 'GRU'
                                        ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400'
                                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                                }`}
                            >
                                GRU
                            </button>
                            <button
                                type="button"
                                onClick={() => setUseModel('LSTM')}
                                className={`px-3 py-2 rounded-md transition-all ${
                                    useModel === 'LSTM'
                                        ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400'
                                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                                }`}
                            >
                                LSTM
                            </button>
                            <button
                                type="button"
                                onClick={() => setUseModel('Transformer')}
                                className={`px-3 py-2 rounded-md transition-all ${
                                    useModel === 'Transformer'
                                        ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400'
                                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                                }`}
                            >
                                Transformer
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {error && (
                <div className="rounded-card border border-mm-negative/20 bg-mm-negative/10 px-6 py-4 animate-fade-in">
                    <p className="font-medium text-mm-negative">{error}</p>
                </div>
            )}

            {loading && (
                <div className="text-center py-12 animate-fade-in">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-mm-accent-primary border-t-transparent"></div>
                    <p className="mt-4 text-mm-text-secondary">Analyzing stock data and generating predictions...</p>
                </div>
            )}

            {predictionData && !loading && (
                <div className="animate-fade-in space-y-6">
                    <div className="ui-panel-elevated p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Recent Date</p>
                                <p className="text-xl font-semibold text-mm-text-primary">{predictionData.recentDate}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Actual Close</p>
                                <p className="text-xl font-semibold text-mm-positive">${predictionData.recentClose}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Predicted Close</p>
                                <p className="text-xl font-semibold text-mm-accent-primary">${predictionData.recentPredicted}</p>
                            </div>
                        </div>
                    </div>

                    {(() => {
                        const filteredPredictions = predictionData.predictions.filter(pred => {
                            const day = new Date(pred.date + 'T00:00:00').getDay();
                            return day !== 0 && day !== 6; // skip weekends
                        });

                        const filteredData = {
                            ...predictionData,
                            predictions: filteredPredictions
                        };

                        return (
                            <>
                                <PredictionChart predictionData={filteredData} />

                                {useEnsemble && predictionData.modelBreakdown && (
                                    <ModelComparisonCard
                                        modelBreakdown={predictionData.modelBreakdown}
                                        modelsUsed={predictionData.modelsUsed}
                                        confidence={predictionData.confidence}
                                    />
                                )}

                                <StockPredictionCard data={filteredData} />
                            </>
                        );
                    })()}

                    <div className="ui-panel-subtle p-4">
                        <h3 className="font-semibold text-mm-accent-primary mb-2">About These Predictions</h3>
                        <ul className="text-sm text-mm-text-secondary space-y-1">
                            <li>• Predictions are based on historical price patterns using machine learning</li>
                            <li>• Lower prediction error percentage indicates higher accuracy</li>
                            <li>• Use predictions as one of many tools for investment research</li>
                            <li>• Past performance does not guarantee future results</li>
                        </ul>
                    </div>
                </div>
            )}

            {!predictionData && !loading && !error && (
                <div className="ui-panel-subtle text-center py-16 animate-fade-in">
                    <div className="inline-block p-6 rounded-full bg-mm-surface mb-4 border border-mm-border">
                        <svg className="w-16 h-16 text-mm-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-mm-text-primary mb-2">
                        Enter a stock ticker to see predictions
                    </h3>
                    <p className="text-mm-text-secondary">
                        Get 7 trading-session price forecasts for any U.S. stock
                    </p>
                </div>
            )}
        </div>
    );
};

export default PredictionsPage;
