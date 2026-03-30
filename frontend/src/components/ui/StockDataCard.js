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
    const changeColor = isPositive ? 'text-mm-positive' : 'text-mm-negative';

    const DataRow = ({ label, value }) => (
        <div className="flex justify-between border-b border-mm-border py-3 last:border-b-0">
            <span className="text-sm text-mm-text-secondary">{label}</span>
            <span className="text-sm font-medium text-mm-text-primary">{String(value)}</span>
        </div>
    );

    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="ui-section-label mb-2">Asset Snapshot</p>
                    <h2 className="text-2xl font-semibold text-mm-text-primary">{data.companyName} ({data.symbol})</h2>
                    <p className="mt-2 text-3xl font-bold text-mm-text-primary">${formatNum(data.price)}</p>
                </div>
                <div className="text-right">
                    <div className={`flex items-center justify-end text-lg font-semibold ${changeColor}`}>
                         {isPositive ? <TrendingUpIcon className="h-6 w-6 mr-1" /> : <TrendingDownIcon className="h-6 w-6 mr-1" />}
                        <span>{formatNum(data.change)} ({formatNum(data.changePercent)}%)</span>
                    </div>
                    <button onClick={() => onAddToWatchlist(data.symbol)} className="ui-button-primary mt-4">
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
