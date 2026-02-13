import React, { useState } from 'react';
import { SearchIcon } from './Icons';
import ActualVsPredictedChart from './charts/ActualVsPredictedChart';

const ModelPerformancePage = () => {
    const [ticker, setTicker] = useState('');
    const [evaluationData, setEvaluationData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedModel, setSelectedModel] = useState('ensemble');
    const [testDays, setTestDays] = useState(60);

    const handleEvaluate = async (e) => {
        e.preventDefault();
        
        if (!ticker.trim()) {
            setError('Please enter a stock ticker');
            return;
        }

        setLoading(true);
        setError('');
        setEvaluationData(null);

        try {
            const response = await fetch(`http://localhost:5001/evaluate/${ticker.toUpperCase()}?test_days=${testDays}`);
            
            if (!response.ok) {
                throw new Error('Failed to evaluate model');
            }

            const data = await response.json();
            setEvaluationData(data);
        } catch (err) {
            setError(`Error: Could not evaluate ${ticker.toUpperCase()}. Please check the ticker and try again.`);
            console.error('Evaluation error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-6 py-8 max-w-7xl">
            {/* Header */}
            <div className="text-center mb-8 animate-fade-in">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    Model Performance Evaluation
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Professional backtesting with multiple ML models
                </p>
            </div>

            {/* Search Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 animate-fade-in transition-colors duration-200">
                <form onSubmit={handleEvaluate} className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <svg 
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                    placeholder="Enter stock ticker (e.g., AAPL, TSLA, MSFT)"
                                    className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg"
                                />
                            </div>
                        </div>
                        
                        <div className="w-48">
                            <select
                                value={testDays}
                                onChange={(e) => setTestDays(parseInt(e.target.value))}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="20">20 days</option>
                                <option value="30">30 days</option>
                                <option value="60">60 days</option>
                                <option value="90">90 days</option>
                            </select>
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
                            {loading ? 'Evaluating...' : 'Evaluate'}
                        </button>
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        <strong>Note:</strong> Evaluation runs rolling window backtesting with 3 ML models. Takes 10-30 seconds.
                    </p>
                </form>
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
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Running professional evaluation...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Training 3 ML models and backtesting...</p>
                </div>
            )}

            {/* Results */}
            {evaluationData && !loading && (
                <div className="animate-fade-in space-y-8">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ticker</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{evaluationData.ticker}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Test Period</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{evaluationData.test_period.days} days</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500">{evaluationData.test_period.start_date} to {evaluationData.test_period.end_date}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Best Model</p>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">{evaluationData.best_model.replace('_', ' ').toUpperCase()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Models Tested</p>
                                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{Object.keys(evaluationData.models).length}</p>
                            </div>
                        </div>
                    </div>

                    {/* Model Selector */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select Model to View:</h3>
                        <div className="flex flex-wrap gap-3">
                            {Object.keys(evaluationData.models).map((modelName) => (
                                <button
                                    key={modelName}
                                    onClick={() => setSelectedModel(modelName)}
                                    className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                                        selectedModel === modelName
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                                    }`}
                                >
                                    {modelName.replace('_', ' ').toUpperCase()}
                                    {modelName === evaluationData.best_model && (
                                        <span className="ml-2">🏆</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actual vs Predicted Chart */}
                    <ActualVsPredictedChart 
                        evaluationData={evaluationData}
                        selectedModel={selectedModel}
                    />

                    {/* Model Comparison Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Model Comparison</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Model</th>
                                        <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">MAE</th>
                                        <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">RMSE</th>
                                        <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">MAPE</th>
                                        <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">R²</th>
                                        <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Dir Acc</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(evaluationData.models).map(([modelName, data]) => {
                                        const isBest = modelName === evaluationData.best_model;
                                        return (
                                            <tr 
                                                key={modelName}
                                                className={`border-b border-gray-200 dark:border-gray-700 ${
                                                    isBest ? 'bg-green-50 dark:bg-green-900/20' : ''
                                                }`}
                                            >
                                                <td className="py-3 px-4 font-bold text-gray-800 dark:text-gray-200">
                                                    {modelName.replace('_', ' ').toUpperCase()}
                                                    {isBest && <span className="ml-2">🏆</span>}
                                                </td>
                                                <td className="text-center py-3 px-4 dark:text-gray-300">${data.metrics.mae}</td>
                                                <td className="text-center py-3 px-4 dark:text-gray-300">${data.metrics.rmse}</td>
                                                <td className="text-center py-3 px-4 font-medium text-purple-600 dark:text-purple-400">{data.metrics.mape}%</td>
                                                <td className="text-center py-3 px-4 font-medium text-green-600 dark:text-green-400">{data.metrics.r_squared}</td>
                                                <td className="text-center py-3 px-4 font-medium text-blue-600 dark:text-blue-400">{data.metrics.directional_accuracy}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Trading Performance */}
                    {evaluationData.returns && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Trading Performance (Ensemble Strategy)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Initial Capital</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${evaluationData.returns.initial_capital}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Final Value</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${evaluationData.returns.final_value}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Return</p>
                                    <p className={`text-2xl font-bold ${evaluationData.returns.total_return >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {evaluationData.returns.total_return}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">vs Buy & Hold</p>
                                    <p className={`text-2xl font-bold ${evaluationData.returns.outperformance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {evaluationData.returns.outperformance > 0 ? '+' : ''}{evaluationData.returns.outperformance}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sharpe Ratio</p>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{evaluationData.returns.sharpe_ratio}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Max Drawdown</p>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{evaluationData.returns.max_drawdown}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Trades</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{evaluationData.returns.num_trades}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Educational Note */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">About This Evaluation</h3>
                        <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                            <li>• Rolling window backtesting with model retraining every 5 days</li>
                            <li>• 42 engineered features (lagged prices, MAs, volatility, momentum, volume)</li>
                            <li>• Models: Random Forest, XGBoost, Linear Regression, Ensemble</li>
                            <li>• Metrics: MAE (avg error), MAPE (% error), R² (accuracy), Directional (up/down correct)</li>
                            <li>• Past performance does not guarantee future results</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!evaluationData && !loading && !error && (
                <div className="text-center py-16 animate-fade-in">
                    <div className="inline-block p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        No Evaluation Yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Enter a stock ticker above to run professional backtesting
                    </p>
                </div>
            )}
        </div>
    );
};

export default ModelPerformancePage;
