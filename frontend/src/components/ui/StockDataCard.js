import React from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../Icons';

// --- Helper to safely format numbers to 2 decimal places ---
const formatNum = (num, isPercent = false) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const val = Number(num);
    if (isPercent) return `${val.toFixed(2)}%`;
    return val.toFixed(2);
};

const currencySymbol = (currency) => {
    switch (String(currency || '').toUpperCase()) {
    case 'HKD':
        return 'HK$';
    case 'CNY':
        return 'CN¥';
    case 'USD':
    default:
        return '$';
    }
};

const StockDataCard = ({ data, onAddToWatchlist, canAddToWatchlist = true }) => {
    // Check if data or fundamentals exist, provide a fallback
    const fundamentals = data.fundamentals || {};
    const pricePrefix = currencySymbol(data.currency);
    
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
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-mm-text-secondary">
                        <span className="rounded-full border border-mm-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
                            {data.market || 'US'}
                        </span>
                        {data.exchange ? <span>{data.exchange}</span> : null}
                        {data.currency ? <span>• {data.currency}</span> : null}
                    </div>
                    <p className="mt-2 text-3xl font-bold text-mm-text-primary">{pricePrefix}{formatNum(data.price)}</p>
                </div>
                <div className="text-right">
                    <div className={`flex items-center justify-end text-lg font-semibold ${changeColor}`}>
                         {isPositive ? <TrendingUpIcon className="h-6 w-6 mr-1" /> : <TrendingDownIcon className="h-6 w-6 mr-1" />}
                        <span>{formatNum(data.change)} ({formatNum(data.changePercent)}%)</span>
                    </div>
                    {canAddToWatchlist ? (
                        <button onClick={() => onAddToWatchlist(data.symbol)} className="ui-button-primary mt-4">
                            + Add to Watchlist
                        </button>
                    ) : (
                        <p className="mt-4 max-w-[220px] text-xs leading-5 text-mm-text-secondary">
                            International Akshare assets are read-only in phase 1, so watchlist actions stay US-only.
                        </p>
                    )}
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
