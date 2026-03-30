import React from 'react';

const PredictionPreviewCard = ({ predictionData, onViewFullPredictions }) => {
    if (!predictionData) return null;

    // Show only first 3 predictions
    const previewPredictions = predictionData.predictions.slice(0, 3);
    
    // Calculate trend
    const firstPrediction = previewPredictions[0]?.predictedClose || 0;
    const lastPrediction = previewPredictions[previewPredictions.length - 1]?.predictedClose || 0;
    const trendUp = lastPrediction > firstPrediction;
    const trendPercent = ((lastPrediction - firstPrediction) / firstPrediction * 100).toFixed(2);

    return (
        <div className="ui-panel mt-6 animate-fade-in p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="ui-section-label mb-2">Forecast Snapshot</p>
                    <h3 className="flex items-center text-lg font-semibold text-mm-text-primary">
                        <svg className="mr-2 h-5 w-5 text-mm-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Prediction
                    </h3>
                    <p className="mt-1 text-sm text-mm-text-secondary">Next 3 trading sessions</p>
                </div>
                <div className={`text-right ${trendUp ? 'text-mm-positive' : 'text-mm-negative'}`}>
                    <div className="flex items-center justify-end">
                        {trendUp ? (
                            <svg className="w-6 h-6 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
                            </svg>
                        )}
                        <span className="text-2xl font-bold">{trendUp ? '+' : ''}{trendPercent}%</span>
                    </div>
                    <p className="text-xs font-medium text-mm-text-secondary">3-session trend</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
                {previewPredictions.map((pred, index) => (
                    <div key={pred.date} className="ui-panel-subtle p-3 text-center">
                        <p className="mb-1 text-xs text-mm-text-tertiary">
                            {index === 0 ? 'Tomorrow' : index === 1 ? 'Day 2' : 'Day 3'}
                        </p>
                        <p className="text-lg font-semibold text-mm-text-primary">
                            ${pred.predictedClose.toFixed(2)}
                        </p>
                        <p className="text-xs text-mm-text-tertiary">{pred.date}</p>
                    </div>
                ))}
            </div>

            <button
                onClick={onViewFullPredictions}
                className="ui-button-primary w-full"
            >
                <span>See Full 7-Week Forecast</span>
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </button>
        </div>
    );
};

export default PredictionPreviewCard;
