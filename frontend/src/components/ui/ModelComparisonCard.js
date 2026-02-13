import React from 'react';

const ModelComparisonCard = ({ modelBreakdown, modelsUsed, confidence }) => {
    if (!modelBreakdown || !modelsUsed) return null;

    const modelLabels = {
        'linear_regression': 'Linear Regression',
        'random_forest': 'Random Forest',
        'xgboost': 'XGBoost'
    };

    const modelIcons = {
        'linear_regression': '📈',
        'random_forest': '🌲',
        'xgboost': '🚀'
    };

    // Calculate average prediction for each model
    const modelAverages = {};
    Object.keys(modelBreakdown).forEach(model => {
        const predictions = modelBreakdown[model];
        modelAverages[model] = (predictions.reduce((a, b) => a + b, 0) / predictions.length).toFixed(2);
    });

    return (
        <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-800 animate-fade-in transition-colors duration-200">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                        <svg className="w-6 h-6 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Model Comparison
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Ensemble of {modelsUsed.length} ML models
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {confidence}%
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Confidence</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modelsUsed.map(model => (
                    <div key={model} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                                <span className="text-2xl mr-2">{modelIcons[model]}</span>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {modelLabels[model]}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {modelBreakdown[model].length} day forecast
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg. Prediction</p>
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    ${modelAverages[model]}
                                </p>
                            </div>
                        </div>
                        {/* Show first and last prediction */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="text-center">
                                <p className="text-gray-500 dark:text-gray-400">Day 1</p>
                                <p className="font-medium text-gray-900 dark:text-gray-200">
                                    ${modelBreakdown[model][0]}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-gray-500 dark:text-gray-400">Day 6</p>
                                <p className="font-medium text-gray-900 dark:text-gray-200">
                                    ${modelBreakdown[model][modelBreakdown[model].length - 1]}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>
                        Ensemble combines predictions from multiple models for higher accuracy
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ModelComparisonCard;
