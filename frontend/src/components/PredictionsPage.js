import React, { useState, useEffect } from 'react';
import StockPredictionCard from './ui/StockPredictionCard';
import PredictionChart from './charts/PredictionChart';
import ModelComparisonCard from './ui/ModelComparisonCard';

const PredictionsPage = ({ initialTicker }) => {
    const [ticker, setTicker] = useState('');
    const [predictionData, setPredictionData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [useEnsemble, setUseEnsemble] = useState(true);
    const [useModel, setUseModel] = useState('');
    // Auto-search when initialTicker is provided or ensemble mode changes
    useEffect(() => {
        if (initialTicker && initialTicker.trim()) {
            setTicker(initialTicker);
            fetchPredictions(initialTicker);
        }
    }, [initialTicker, useEnsemble]);

    const fetchPredictions = async (searchTicker) => {
        setLoading(true);
        setError('');
        setPredictionData(null);

        try {
            const endpoint = useEnsemble 
                ? `http://localhost:5001/predict/ensemble/${searchTicker.toUpperCase()}`
                : `http://localhost:5001/predict/${useModel}/${searchTicker.toUpperCase()}`;
            
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error('Failed to fetch prediction data');
            }

            const data = await response.json();
            setPredictionData(data);
        } catch (err) {
            setError(`Error: Could not fetch predictions for ${searchTicker.toUpperCase()}. Please check the ticker and try again.`);
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

    return (
        <div className="container mx-auto px-6 py-8 max-w-5xl">
            <div className="text-center mb-8 animate-fade-in">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    Stock Price Predictions
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Get 7-day price predictions powered by machine learning
                </p>
            </div>

            {/* Search Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 animate-fade-in transition-colors duration-200">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="Enter stock ticker (e.g., AAPL, TSLA, MSFT)"
                                className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg"
                            />
                            {/* Inlined SVG to ensure positioning works correctly */}
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
    onClick={() => {
      const next = !useEnsemble;
      setUseEnsemble(next);
      if (next) {
        setUseModel("LinReg"); // placeholder
      }
      
    }}
    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
      useEnsemble
        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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
    {useEnsemble ? 'Ensemble Mode (3 Models)' : 'Single Model'}
  </button>

  {/* 👇 CONDITIONAL BUTTONS */}
  {!useEnsemble && (
    <div className="flex gap-3">
      <button
        onClick={() => setUseModel("LinReg")}
className={`px-3 py-2 rounded-md transition-all ${
  useModel === "LinReg"
    ? "bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400"
    : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800"
}`}
      >
        Linear Regression
      </button>

      <button
        onClick={() => setUseModel("RandomForest")}
className={`px-3 py-2 rounded-md transition-all ${
  useModel === "RandomForest"
    ? "bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400"
    : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800"
}`}
      >
        Random Forest
      </button>

      <button
        onClick={() => setUseModel("XGBoost")}
className={`px-3 py-2 rounded-md transition-all ${
  useModel === "XGBoost"
    ? "bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400"
    : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800"
}`}
      >
        XGBoost
      </button>
    </div>
  )}
</div>

            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg mb-8 animate-fade-in">
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-12 animate-fade-in">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Analyzing stock data and generating predictions...</p>
                </div>
            )}

            {/* Prediction Results */}
            {predictionData && !loading && (
                <div className="animate-fade-in">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-6 mb-6 border border-blue-100 dark:border-blue-800">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Recent Date</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{predictionData.recentDate}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Actual Close</p>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400">${predictionData.recentClose}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Predicted Close</p>
                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">${predictionData.recentPredicted}</p>
                            </div>
                        </div>
                    </div>

                    <PredictionChart predictionData={predictionData} />

                    {useEnsemble && predictionData.modelBreakdown && (
  <ModelComparisonCard 
    modelBreakdown={predictionData.modelBreakdown}
    modelsUsed={predictionData.modelsUsed}
    confidence={predictionData.confidence}
  />
)}


                    <StockPredictionCard data={predictionData} />

                    <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">About These Predictions</h3>
                        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                            <li>• Predictions are based on historical price patterns using machine learning</li>
                            <li>• Lower prediction error percentage indicates higher accuracy</li>
                            <li>• Use predictions as one of many tools for investment research</li>
                            <li>• Past performance does not guarantee future results</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!predictionData && !loading && !error && (
                <div className="text-center py-16 animate-fade-in">
                    <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
                        <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Enter a stock ticker to see predictions
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Get AI-powered 7-day price forecasts for any stock
                    </p>
                </div>
            )}
        </div>
    );
};

export default PredictionsPage;