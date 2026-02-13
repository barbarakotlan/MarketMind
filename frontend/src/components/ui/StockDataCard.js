import React from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../Icons';

// --- Helper to safely format numbers to 2 decimal places ---
const formatNum = (num, isPercent = false) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const val = Number(num);
    if (isPercent) return `${val.toFixed(2)}%`;
    return val.toFixed(2);
};

const StockDataCard = ({ data, onAddToWatchlist }) => {
    // Check if data or fundamentals exist, provide a fallback
    const fundamentals = data.fundamentals || {};
    
    const isPositive = (data.change || 0) >= 0; 
    const changeColor = isPositive ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';

    const DataRow = ({ label, value }) => (
        <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{String(value)}</span>
        </div>
    );

    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{data.companyName} ({data.symbol})</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-2">${formatNum(data.price)}</p>
                </div>
                <div className="text-right">
                    <div className={`flex items-center justify-end text-lg font-semibold ${changeColor}`}>
                         {isPositive ? <TrendingUpIcon className="h-6 w-6 mr-1" /> : <TrendingDownIcon className="h-6 w-6 mr-1" />}
                        <span>{formatNum(data.change)} ({formatNum(data.changePercent)}%)</span>
                    </div>
                    <button onClick={() => onAddToWatchlist(data.symbol)} className="mt-4 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                        + Add to Watchlist
                    </button>
                </div>
            </div>
            <div className="mt-6">
                {/* --- THIS IS THE FIX --- */}
                {/* We now get the data from the 'fundamentals' object */}
                <DataRow label="Market Cap" value={data.marketCap || 'N/A'} />
                <DataRow label="P/E Ratio (TTM)" value={formatNum(fundamentals.peRatio)} />
                <DataRow label="52 Week High" value={`$${formatNum(fundamentals.week52High)}`} />
                <DataRow label="52 Week Low" value={`$${formatNum(fundamentals.week52Low)}`} />
            </div>
        </div>
    );
};

export default StockDataCard;