import React, { useState } from 'react';
import ActualVsPredictedChart from './charts/ActualVsPredictedChart';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const MODEL_LABELS = {
    ensemble: 'Ensemble',
    auto_arima: 'AutoARIMA',
    naive: 'Naive',
    seasonal_naive_5: 'Seasonal Naive (5)',
    linear_regression: 'Linear Regression',
    random_forest: 'Random Forest',
    xgboost: 'XGBoost',
    lstm: 'LSTM',
    gru: 'GRU',
    transformer: 'Transformer',
};

const formatModelName = (modelName) => (
    MODEL_LABELS[modelName] || modelName.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
);

const metricToneClass = (value, positiveIsGood = true) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'text-mm-text-secondary';
    }
    const isPositive = Number(value) >= 0;
    if (positiveIsGood) {
        return isPositive ? 'text-mm-positive' : 'text-mm-negative';
    }
    return isPositive ? 'text-mm-negative' : 'text-mm-positive';
};

const ModelPerformancePage = () => {
    const [ticker, setTicker] = useState('');
    const [evaluationData, setEvaluationData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedModel, setSelectedModel] = useState('ensemble');
    const [testDays, setTestDays] = useState(60);
    const [deepEvaluation, setDeepEvaluation] = useState(false);

    const fetchEvaluation = async (sym) => {
        if (!sym.trim()) {
            setError('Please enter a stock ticker');
            return;
        }

        setLoading(true);
        setError('');
        setEvaluationData(null);

        try {
            const data = await apiRequest(API_ENDPOINTS.EVALUATE(sym.toUpperCase(), { test_days: testDays }));
            setEvaluationData(data);
        } catch (err) {
            setError(`Error: Could not evaluate ${sym.toUpperCase()}. Please check the ticker and try again.`);
            console.error('Evaluation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEvaluate = (e) => {
        e.preventDefault();
        fetchEvaluation(ticker);
    };

    return (
        <div className="ui-page animate-fade-in space-y-8">
            <div className="ui-page-header text-center">
                <h1 className="ui-page-title mb-2">Model Performance Evaluation</h1>
                <p className="ui-page-subtitle">
                    Professional backtesting for the prediction stack with fast and deep evaluation modes.
                </p>
            </div>

            <div className="ui-panel p-6">
                <form onSubmit={handleEvaluate} className="space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row">
                        <div className="flex-1">
                            <div className="relative">
                                <svg
                                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mm-text-tertiary"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value)}
                                    placeholder="Enter stock ticker (e.g., AAPL, TSLA, MSFT)"
                                    className="ui-input pl-12 text-base"
                                />
                            </div>
                        </div>

                        <div className="w-full lg:w-52">
                            <select
                                value={testDays}
                                onChange={(e) => setTestDays(parseInt(e.target.value, 10))}
                                className="ui-input"
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
                            className={loading ? 'ui-button-secondary cursor-not-allowed opacity-60 px-8 py-3' : 'ui-button-primary px-8 py-3'}
                        >
                            {loading ? 'Evaluating...' : 'Evaluate'}
                        </button>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        <strong>Note:</strong> Backtesting with 6 ML models (RF, XGBoost, LinReg, GRU, LSTM, Transformer). Takes 10–30 seconds.
                    </p>
                </form>
            </div>

            {error && (
                <div className="ui-banner ui-banner-error animate-fade-in">
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {loading && (
                <div className="text-center py-12 animate-fade-in">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Running professional evaluation...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Training RF, XGBoost, LinReg, GRU, LSTM, Transformer and backtesting...</p>
                </div>
            )}

            {evaluationData && !loading && (
                <div className="space-y-8 animate-fade-in">
                    <div className="ui-panel-elevated p-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Ticker</p>
                                <p className="text-2xl font-semibold text-mm-text-primary">{evaluationData.ticker}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Test Period</p>
                                <p className="text-lg font-semibold text-mm-text-primary">{evaluationData.test_period.days} days</p>
                                <p className="text-xs text-mm-text-tertiary">
                                    {evaluationData.test_period.start_date} to {evaluationData.test_period.end_date}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Best Model</p>
                                <p className="text-lg font-semibold text-mm-positive">
                                    {formatModelName(evaluationData.best_model)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Models Tested</p>
                                <p className="text-lg font-semibold text-mm-accent-primary">
                                    {Object.keys(evaluationData.models).length}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-mm-text-secondary mb-1">Feature Spec</p>
                                <p className="text-lg font-semibold text-mm-text-primary">
                                    {evaluationData.featureSpecVersion || 'legacy'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="ui-panel p-6">
                        <h3 className="ui-section-label mb-4">Model Selection</h3>
                        <div className="flex flex-wrap gap-3">
                            {Object.keys(evaluationData.models).map((modelName) => (
                                <button
                                    key={modelName}
                                    onClick={() => setSelectedModel(modelName)}
                                    className={selectedModel === modelName ? 'ui-button-primary px-5 py-3' : 'ui-button-secondary px-5 py-3'}
                                >
                                    {formatModelName(modelName)}
                                    {modelName === evaluationData.best_model && <span className="ml-2">🏆</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ActualVsPredictedChart
                        evaluationData={evaluationData}
                        selectedModel={selectedModel}
                    />

                    <div className="ui-panel p-6">
                        <h3 className="mb-6 text-xl font-semibold text-mm-text-primary">Model Comparison</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-mm-border">
                                        <th className="px-4 py-3 text-left font-semibold text-mm-text-secondary">Model</th>
                                        <th className="px-4 py-3 text-center font-semibold text-mm-text-secondary">MAE</th>
                                        <th className="px-4 py-3 text-center font-semibold text-mm-text-secondary">RMSE</th>
                                        <th className="px-4 py-3 text-center font-semibold text-mm-text-secondary">MAPE</th>
                                        <th className="px-4 py-3 text-center font-semibold text-mm-text-secondary">R²</th>
                                        <th className="px-4 py-3 text-center font-semibold text-mm-text-secondary">Dir Acc</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(evaluationData.models).map(([modelName, data]) => {
                                        const isBest = modelName === evaluationData.best_model;
                                        return (
                                            <tr
                                                key={modelName}
                                                className={isBest ? 'border-b border-mm-border bg-mm-surface-subtle' : 'border-b border-mm-border'}
                                            >
                                                <td className="px-4 py-3 font-semibold text-mm-text-primary">
                                                    {formatModelName(modelName)}
                                                    {isBest && <span className="ml-2">🏆</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center text-mm-text-secondary">${data.metrics.mae}</td>
                                                <td className="px-4 py-3 text-center text-mm-text-secondary">${data.metrics.rmse}</td>
                                                <td className="px-4 py-3 text-center font-medium text-mm-accent-primary">{data.metrics.mape}%</td>
                                                <td className="px-4 py-3 text-center font-medium text-mm-positive">{data.metrics.r_squared}</td>
                                                <td className="px-4 py-3 text-center font-medium text-mm-text-primary">{data.metrics.directional_accuracy}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {evaluationData.returns && (
                        <div className="ui-panel p-6">
                            <h3 className="mb-6 text-xl font-semibold text-mm-text-primary">Trading Performance (Ensemble Strategy)</h3>
                            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-6">
                                <div className="ui-panel-subtle p-4 text-center">
                                    <p className="text-sm text-mm-text-secondary mb-1">Initial Capital</p>
                                    <p className="text-2xl font-semibold text-mm-text-primary">${evaluationData.returns.initial_capital}</p>
                                </div>
                                <div className="ui-panel-subtle p-4 text-center">
                                    <p className="text-sm text-mm-text-secondary mb-1">Final Value</p>
                                    <p className="text-2xl font-semibold text-mm-text-primary">${evaluationData.returns.final_value}</p>
                                </div>
                                <div className="ui-panel-subtle p-4 text-center">
                                    <p className="text-sm text-mm-text-secondary mb-1">Total Return</p>
                                    <p className={`text-2xl font-semibold ${metricToneClass(evaluationData.returns.total_return)}`}>
                                        {evaluationData.returns.total_return}%
                                    </p>
                                </div>
                                <div className="ui-panel-subtle p-4 text-center">
                                    <p className="text-sm text-mm-text-secondary mb-1">vs Buy & Hold</p>
                                    <p className={`text-2xl font-semibold ${metricToneClass(evaluationData.returns.outperformance)}`}>
                                        {evaluationData.returns.outperformance > 0 ? '+' : ''}
                                        {evaluationData.returns.outperformance}%
                                    </p>
                                </div>
                                <div className="ui-panel-subtle p-4 text-center">
                                    <p className="text-sm text-mm-text-secondary mb-1">Sharpe Ratio</p>
                                    <p className="text-2xl font-semibold text-mm-accent-primary">{evaluationData.returns.sharpe_ratio}</p>
                                </div>
                                <div className="ui-panel-subtle p-4 text-center">
                                    <p className="text-sm text-mm-text-secondary mb-1">Max Drawdown</p>
                                    <p className={`text-2xl font-semibold ${metricToneClass(evaluationData.returns.max_drawdown, false)}`}>
                                        {evaluationData.returns.max_drawdown}%
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 text-center text-sm text-mm-text-secondary">
                                Trades executed: <span className="font-semibold text-mm-text-primary">{evaluationData.returns.num_trades}</span>
                            </div>
                        </div>
                    )}

                    {/* Educational Note */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">About This Evaluation</h3>
                        <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                            <li>• Rolling window backtesting with sklearn model retraining every 5 days</li>
                            <li>• 42 engineered features (lagged prices, MAs, volatility, momentum, volume)</li>
                            <li>• Models: Random Forest, XGBoost, Linear Regression, Ensemble, GRU, LSTM, Transformer</li>
                            <li>• GRU, LSTM &amp; Transformer trained once on the training split, evaluated with a sliding 30-day window (1-step-ahead)</li>
                            <li>• Metrics: MAE (avg error), MAPE (% error), R² (accuracy), Directional (up/down correct)</li>
                            <li>• Past performance does not guarantee future results</li>
                        </ul>
                    </div>
                </div>
            )}

            {!evaluationData && !loading && !error && (
                <div className="ui-empty-state py-16 animate-fade-in">
                    <div className="mb-4 rounded-pill border border-mm-border bg-mm-surface p-6">
                        <svg className="h-16 w-16 text-mm-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-mm-text-primary">No Evaluation Yet</h3>
                    <p>Enter a stock ticker above to run professional backtesting.</p>
                </div>
            )}
        </div>
    );
};

export default ModelPerformancePage;
