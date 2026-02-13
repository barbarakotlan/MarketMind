import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparklines, SparklinesLine, SparklinesReferenceLine } from 'react-sparklines';
// --- MODIFIED: Import the named StockChart component from SearchPage ---
import StockChart from './charts/StockChart';

// --- Helper Functions & Components ---

// --- NEW: Helper to format numbers and return 'N/A' ---
const formatNum = (num, isPercent = false) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const val = Number(num);
    if (isPercent) return `${val.toFixed(2)}%`;
    // Use toFixed for consistent decimal places
    return val.toFixed(2);
};

// Creates a visual bar for the 52-week range
const FiftyTwoWeekRange = ({ low, high, price }) => {
    // --- FIX: Check for valid numbers ---
    if (!low || !high || !price || high === low) return <span>N/A</span>;
    const percent = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
    return (
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full relative" title={`Low: $${low} | High: $${high}`}>
            <div 
                className="h-2 bg-blue-500 rounded-full absolute"
                style={{ left: `${percent}%` }}
            >
                {/* This is the dot */}
                <div className="w-2 h-2 bg-blue-700 rounded-full absolute -top-0 -right-1"></div>
            </div>
        </div>
    );
};

// Creates a colored pill for the analyst rating
const RatingPill = ({ rating }) => {
    if (!rating) return <span className="text-gray-400">N/A</span>;
    let color = "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    if (rating.includes("buy")) color = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (rating.includes("sell")) color = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    if (rating.includes("hold")) color = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${color}`}>
            {rating}
        </span>
    );
};

// Creates a small sparkline chart
const SparklineChart = ({ data, change }) => {
    if (!data || data.length === 0) return <div className="h-10 w-24"></div>;
    const color = (change || 0) >= 0 ? '#10B981' : '#EF4444';
    return (
        <div className="h-10 w-24">
            <Sparklines data={data}>
                <SparklinesLine color={color} style={{ strokeWidth: 2 }} />
                <SparklinesReferenceLine type="avg" style={{ stroke: 'rgba(100,100,100,0.2)' }} />
            </Sparklines>
        </div>
    );
};

// A single row in the watchlist
const WatchlistRow = ({ stock, onRemove, onRowClick }) => {
    const isPositive = (stock.change || 0) >= 0;
    
    // --- MODIFIED: Access data from the 'fundamentals' object ---
    const fundamentals = stock.fundamentals || {};
    const pe = fundamentals.peRatio || 'N/A';
    const mktCap = stock.marketCap || 'N/A';
    const rating = fundamentals.recommendationKey || 'N/A';
    const targetPrice = fundamentals.analystTargetPrice;

    let upsidePercent = 'N/A';
    let upsideColor = 'text-gray-600 dark:text-gray-400';
    if (targetPrice && stock.price) {
        const upside = ((targetPrice - stock.price) / stock.price) * 100;
        upsidePercent = formatNum(upside, true);
        upsideColor = upside >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    }
    
    return (
        <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => onRowClick(stock.symbol)}>
            <td className="py-3 px-4">
                <div className="font-bold text-gray-900 dark:text-white">{stock.symbol}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate w-40">{stock.companyName}</div>
            </td>
            <td className="py-3 px-4 font-medium dark:text-gray-200">${formatNum(stock.price)}</td>
            <td className={`py-3 px-4 font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isPositive ? '+' : ''}{formatNum(stock.change)} ({formatNum(stock.changePercent)}%)
            </td>
            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{mktCap}</td>
            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{pe === 'N/A' ? 'N/A' : formatNum(pe)}</td>
            <td className="py-3 px-4 w-40">
                {/* --- MODIFIED: Access 52-week data from 'fundamentals' --- */}
                <FiftyTwoWeekRange low={fundamentals.week52Low} high={fundamentals.week52High} price={stock.price} />
            </td>
            <td className="py-3 px-4">
                <SparklineChart data={stock.sparkline} change={stock.change} />
            </td>
            <td className="py-3 px-4">
                <RatingPill rating={rating} />
            </td>
            <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-200">
                ${formatNum(targetPrice)}
            </td>
            <td className={`py-3 px-4 font-semibold ${upsideColor}`}>
                {upsidePercent}
            </td>
            <td className="py-3 px-4">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(stock.symbol);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md transition-colors"
                >
                    Remove
                </button>
            </td>
        </tr>
    );
};


// --- Main Watchlist Page Component ---
const WatchlistPage = () => {
    const [watchlistData, setWatchlistData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'ascending' });

    const [selectedTicker, setSelectedTicker] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [chartError, setChartError] = useState(null);
    const [activeTimeFrame, setActiveTimeFrame] = useState({ label: '6M', value: '6mo' });

    const fetchWatchlistData = useCallback(async () => {
        setError(null);
        try {
            const response = await fetch('http://127.0.0.1:5001/watchlist');
            const tickers = await response.json();
            if (tickers.length === 0) {
                setWatchlistData([]);
                setLoading(false);
                return;
            }
            // --- MODIFIED: Fetch from the new /stock endpoint ---
            const promises = tickers.map(ticker =>
                fetch(`http://127.0.0.1:5001/stock/${ticker}`).then(res => res.json())
            );
            const detailedData = await Promise.all(promises);
            setWatchlistData(detailedData.filter(data => !data.error));
        } catch (err) {
            setError('Failed to fetch watchlist data. Is the backend server running?');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleRemoveStock = async (ticker) => {
        try {
            await fetch(`http://127.0.0.1:5001/watchlist/${ticker}`, { method: 'DELETE' });
            setWatchlistData(prevData => prevData.filter(stock => stock.symbol !== ticker));
        } catch (err) {
            setError('Failed to remove stock.');
        }
    };

    const fetchChartData = async (symbol, timeFrame) => {
        setChartData(null);
        setChartError(null);
        try {
            const chartResponse = await fetch(`http://127.0.0.1:5001/chart/${symbol}?period=${timeFrame.value}`);
            if (!chartResponse.ok) throw new Error('Chart data not found');
            const chartJson = await chartResponse.json();
            setChartData(chartJson);
        } catch (err) {
            setChartError(err.message);
        }
    };

    const handleRowClick = (symbol) => {
        if (selectedTicker === symbol) {
            setSelectedTicker(null);
            setChartData(null);
        } else {
            setSelectedTicker(symbol);
            const defaultTimeFrame = { label: '6M', value: '6mo' };
            setActiveTimeFrame(defaultTimeFrame);
            fetchChartData(symbol, defaultTimeFrame);
        }
    };

    const handleTimeFrameChange = (timeFrame) => {
        setActiveTimeFrame(timeFrame);
        if (selectedTicker) {
            fetchChartData(selectedTicker, timeFrame);
        }
    };

    useEffect(() => {
        setLoading(true); 
        fetchWatchlistData(); 
        const refreshInterval = setInterval(fetchWatchlistData, 60000); 
        return () => clearInterval(refreshInterval); 
    }, [fetchWatchlistData]);

    const sortedWatchlistData = useMemo(() => {
        let sortableData = [...watchlistData];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                let aValue, bValue;
                
                // --- MODIFIED: Access sorting data from 'fundamentals' object ---
                if (sortConfig.key === 'targetPrice') {
                    aValue = a.fundamentals?.analystTargetPrice || 0;
                    bValue = b.fundamentals?.analystTargetPrice || 0;
                } else if (sortConfig.key === 'upside') {
                    aValue = ((a.fundamentals?.analystTargetPrice - a.price) / a.price) || -Infinity;
                    bValue = ((b.fundamentals?.analystTargetPrice - b.price) / b.price) || -Infinity;
                } else if (sortConfig.key === 'peRatio') {
                    aValue = a.fundamentals?.peRatio || 0;
                    bValue = b.fundamentals?.peRatio || 0;
                } else if (sortConfig.key === 'marketCap') {
                    const parseCap = (cap) => {
                        if (typeof cap !== 'string') return 0;
                        if (cap.endsWith('T')) return parseFloat(cap) * 1e12;
                        if (cap.endsWith('B')) return parseFloat(cap) * 1e9;
                        return 0;
                    }
                    aValue = parseCap(a.marketCap);
                    bValue = parseCap(b.marketCap);
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [watchlistData, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    if (loading) return <div className="text-center p-8 text-gray-600 dark:text-gray-400">Loading watchlist...</div>;
    if (error) return <div className="text-center p-8 text-red-500 dark:text-red-400">{error}</div>;

    const SortableTh = ({ label, sortKey }) => {
        const isSorted = sortConfig.key === sortKey;
        const arrow = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';
        return (
            <th 
                className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => requestSort(sortKey)}
            >
                {label} {arrow}
            </th>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">My Watchlist</h1>
            {sortedWatchlistData.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
                            <tr>
                                <SortableTh label="Symbol" sortKey="symbol" />
                                <SortableTh label="Price" sortKey="price" />
                                <SortableTh label="Change" sortKey="change" />
                                <SortableTh label="Market Cap" sortKey="marketCap" />
                                <SortableTh label="P/E (TTM)" sortKey="peRatio" />
                                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">52-Week Range</th>
                                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">7-Day Trend</th>
                                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Rating</th>
                                <SortableTh label="Price Target" sortKey="targetPrice" />
                                <SortableTh label="Upside" sortKey="upside" />
                                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedWatchlistData.map(stock => (
                                <WatchlistRow 
                                    key={stock.symbol} 
                                    stock={stock} 
                                    onRemove={handleRemoveStock}
                                    onRowClick={handleRowClick} 
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 mt-8">Your watchlist is empty. Add stocks from the Search page.</p>
            )}

            {selectedTicker && (
                <div className="mt-8">
                    {chartData && (
                        <StockChart
                            chartData={chartData}
                            ticker={selectedTicker}
                            onTimeFrameChange={handleTimeFrameChange}
                            activeTimeFrame={activeTimeFrame}
                        />
                    )}
                    {chartError && <div className="text-center p-8 text-red-500">{chartError}</div>}
                </div>
            )}
        </div>
    );
};

export default WatchlistPage;