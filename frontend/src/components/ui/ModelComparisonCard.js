import React from 'react';

const ModelComparisonCard = ({ modelBreakdown, modelsUsed, confidence }) => {
    if (!modelBreakdown || !modelsUsed) return null;

    const modelLabels = {
        'linear_regression': 'Linear Regression',
        'random_forest': 'Random Forest',
        'auto_arima': 'AutoARIMA',
        'naive': 'Naive',
        'seasonal_naive_5': 'Seasonal Naive (5)',
        'xgboost': 'XGBoost',
        'lstm': 'LSTM',
        'transformer': 'Transformer',
        'gradient_boosting': 'Gradient Boosting'
    };

    // Calculate average prediction for each model
    const modelAverages = {};
    Object.keys(modelBreakdown).forEach(model => {
        const predictions = modelBreakdown[model];
        modelAverages[model] = (predictions.reduce((a, b) => a + b, 0) / predictions.length).toFixed(2);
    });

    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Ensemble Breakdown</p>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-semibold text-mm-text-primary flex items-center">
                        <svg className="w-6 h-6 mr-2 text-mm-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Model Comparison
                    </h3>
                    <p className="text-sm text-mm-text-secondary mt-1">
                        Ensemble of {modelsUsed.length} statistical and ML models
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-mm-accent-primary">
                        {confidence}%
                    </div>
                    <p className="text-xs text-mm-text-tertiary">Confidence</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modelsUsed.map(model => (
                    <div key={model} className="ui-panel-subtle p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                                <div>
                                    <h4 className="text-sm font-semibold text-mm-text-primary">
                                        {modelLabels[model] || model.replace(/_/g, ' ')}
                                    </h4>
                                    <p className="text-xs text-mm-text-tertiary">
                                        {modelBreakdown[model].length} trading-session forecast
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-mm-border">
                            <div className="text-center">
                                <p className="text-xs text-mm-text-tertiary mb-1">Avg. Prediction</p>
                                <p className="text-2xl font-bold text-mm-accent-primary">
                                    ${modelAverages[model]}
                                </p>
                            </div>
                        </div>
                        {/* Show first and last prediction */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="text-center">
                                <p className="text-mm-text-tertiary">Day 1</p>
                                <p className="font-medium text-mm-text-primary">
                                    ${modelBreakdown[model][0]}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-mm-text-tertiary">Day {modelBreakdown[model].length}</p>
                                <p className="font-medium text-mm-text-primary">
                                    ${modelBreakdown[model][modelBreakdown[model].length - 1]}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-mm-border">
                <div className="flex items-center text-sm text-mm-text-secondary">
                    <svg className="w-4 h-4 mr-2 text-mm-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>
                        Ensemble combines benchmark and ML models using recent validation performance
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ModelComparisonCard;
