import React from 'react';

const StockPredictionCard = ({ data }) => {
    const spe = Math.abs(((data.recentPredicted - data.recentClose) / data.recentClose) * 100);
    const isAccurate = spe <= 1;
    const changeColor = isAccurate ? 'text-mm-positive' : 'text-mm-negative';

    const DataRow = ({ label, value }) => (
        <div className="flex justify-between py-3 border-b border-mm-border last:border-b-0">
            <span className="text-sm text-mm-text-secondary">{label}</span>
            <span className="text-sm font-medium text-mm-text-primary">{value}</span>
        </div>
    );

    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Forecast Review</p>
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-semibold text-mm-text-primary">
                        {data.companyName} ({data.symbol})
                    </h2>
                </div>
                <div className="text-right">
                    <div className={`flex items-center justify-end text-lg font-semibold ${changeColor}`}>
                        <span>Prediction Error: {spe.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
            <div className="mt-6 space-y-2">
                {data.predictions.map((item) => (
                    <DataRow
                    key={item.date} // unique key for React
                    label={item.date}
                    value={`$${item.predictedClose.toFixed(2)}`}
                    />
                ))}
            </div>

        </div>
    );
};

export default StockPredictionCard;
