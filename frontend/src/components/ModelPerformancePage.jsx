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
    gradient_boosting: 'Gradient Boosting',
    lightgbm: 'LightGBM',
    catboost: 'CatBoost',
    lstm: 'LSTM',
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
            const params = deepEvaluation
                ? {
                    test_days: testDays,
                    fast_mode: false,
                    retrain_frequency: 5,
                    include_explanations: true,
                }
                : {
                    test_days: testDays,
                    fast_mode: true,
                    retrain_frequency: 10,
                    max_train_rows: 450,
                    include_explanations: false,
                };

            const data = await apiRequest(API_ENDPOINTS.EVALUATE(ticker.toUpperCase(), params));
            setEvaluationData(data);
        } catch (err) {
            setError(`Error: Could not evaluate ${ticker.toUpperCase()}. Please check the ticker and try again.`);
            console.error('Evaluation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const selectedExplainability = evaluationData?.models?.[selectedModel]?.explainability;
    const selectedModelSupportsShap = ['linear_regression', 'random_forest', 'xgboost'].includes(selectedModel);

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
                                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
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
                    <label className="flex items-center gap-3 text-sm text-mm-text-secondary">
                        <input
                            type="checkbox"
                            checked={deepEvaluation}
                            onChange={(e) => setDeepEvaluation(e.target.checked)}
                            className="h-4 w-4 rounded border-mm-border text-mm-accent-primary focus:ring-mm-accent-primary"
                        />
                        Run deep evaluation (slower, includes explainability)
                    </label>

                    <div className="ui-panel-subtle px-4 py-3 text-sm text-mm-text-secondary">
                        <strong className="text-mm-text-primary">Note:</strong> Fast mode is optimized for responsiveness. Deep mode can take significantly longer.
                    </div>
                </form>
            </div>

            {error && (
                <div className="ui-banner ui-banner-error animate-fade-in">
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {loading && (
                <div className="py-12 text-center animate-fade-in">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-mm-accent-primary border-t-transparent"></div>
                    <p className="mt-4 text-mm-text-secondary">Running professional evaluation...</p>
                    <p className="mt-2 text-sm text-mm-text-tertiary">Training models and backtesting the evaluation window.</p>
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

                    <div className="ui-panel p-6">
                        <h3 className="mb-2 text-xl font-semibold text-mm-text-primary">Explainability</h3>
                        <p className="mb-6 text-sm text-mm-text-secondary">
                            SHAP is available for Linear Regression, Random Forest, and XGBoost in deep evaluation mode.
                        </p>

                        {selectedExplainability ? (
                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <div className="ui-panel-subtle p-4">
                                    <h4 className="mb-3 font-semibold text-mm-text-primary">Global Top Features</h4>
                                    <div className="space-y-3">
                                        {(selectedExplainability.global_top_features || []).map((item) => (
                                            <div key={item.feature} className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-medium text-mm-text-primary">{item.feature}</p>
                                                    <p className="text-xs text-mm-text-tertiary">Average absolute impact</p>
                                                </div>
                                                <p className="font-semibold text-mm-accent-primary">{item.meanAbsImpact}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="ui-panel-subtle p-4">
                                    <h4 className="mb-3 font-semibold text-mm-text-primary">Latest Prediction Contributors</h4>
                                    <div className="space-y-3">
                                        {(selectedExplainability.latest_prediction_contributors || []).map((item) => (
                                            <div key={item.feature} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                                                <div>
                                                    <p className="font-medium text-mm-text-primary">{item.feature}</p>
                                                    <p className="text-xs text-mm-text-tertiary">Value: {item.value ?? 'n/a'}</p>
                                                </div>
                                                <span className="text-xs text-mm-text-tertiary">Impact</span>
                                                <p className={metricToneClass(item.impact)}>
                                                    {item.impact > 0 ? '+' : ''}
                                                    {item.impact}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="ui-panel-subtle p-4 text-sm text-mm-text-secondary">
                                {selectedModelSupportsShap
                                    ? 'Run deep evaluation to generate SHAP explainability for this model.'
                                    : 'SHAP explanations are unavailable for this model. Use Linear Regression, Random Forest, or XGBoost in deep mode.'}
                            </div>
                        )}
                    </div>

                    <div className="ui-banner ui-banner-warning">
                        <h3 className="mb-2 font-semibold">About This Evaluation</h3>
                        <ul className="space-y-1 text-sm">
                            <li>• Rolling window backtesting with model retraining every 5 days</li>
                            <li>• Versioned forecasting feature spec with lag, rolling trend, volatility, momentum, volume, and session features</li>
                            <li>• Ensemble now blends AutoARIMA, Linear Regression, Random Forest, and XGBoost</li>
                            <li>• Metrics: MAE, MAPE, R², and directional accuracy</li>
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
