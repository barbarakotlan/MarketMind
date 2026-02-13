import React from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../Icons';

const StockPredictionCard = ({ data }) => {
    const spe = Math.abs(((data.recentPredicted - data.recentClose) / data.recentClose) * 100);
    const isAccurate = spe <= 1;
    const changeColor = isAccurate ? 'text-green-500' : 'text-red-500';

    const DataRow = ({ label, value }) => (
        <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{value}</span>
        </div>
    );

    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in transition-colors duration-200">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
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