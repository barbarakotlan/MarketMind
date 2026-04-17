import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparklines, SparklinesLine, SparklinesReferenceLine } from 'react-sparklines';
import StockChart from './charts/StockChart';
import { API_ENDPOINTS, apiRequest } from '../config/api';

/**
 * Utility function formatting numbers into readable fiat or percentage strings.
 * 
 * @param {number|string} num - The raw numerical input.
 * @param {boolean} [isPercent=false] - Flag dictating whether to forcefully append a percentage sign.
 * @returns {string} Formatted string with exactly two decimal places, or 'N/A' upon invalid input.
 */
const formatNum = (num, isPercent = false) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const val = Number(num);
    return isPercent ? `${val.toFixed(2)}%` : val.toFixed(2);
};

/**
 * Component visualizing a ticker's current price position relative to its 52-week extrema.
 * Rendered as a continuous progress bar.
 * 
 * @component
 * @param {Object} props - React props.
 * @param {number} props.low - Absolute lowest recorded 52-week price.
 * @param {number} props.high - Absolute highest recorded 52-week price.
 * @param {number} props.price - Current executing price.
 */
const FiftyTwoWeekRange = ({ low, high, price }) => {
    if (!low || !high || !price || high === low) return <span>N/A</span>;
    // Mathematically clamp the current position between 0 and 100 on the visual spectrum
    const percent = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
    return (
        <div className="relative h-2 w-full rounded-pill bg-mm-surface-subtle" title={`Low: $${low} | High: $${high}`}>
            <div className="absolute h-2 rounded-pill bg-mm-accent-primary" style={{ left: `${percent}%` }}>
                <div className="absolute -right-1 top-0 h-2 w-2 rounded-pill bg-mm-accent-primary"></div>
            </div>
        </div>
    );
};

/**
 * Evaluates and strictly styles analyst recommendation strings logically.
 * 
 * @component
 * @param {Object} props - React props.
 * @param {string} props.rating - Raw recommendation string (e.g. "strong buy").
 */
const RatingPill = ({ rating }) => {
    if (!rating) return <span className="text-mm-text-tertiary">N/A</span>;
    let color = 'ui-status-chip';
    // Match basic string containment to dictation conditional stylings safely
    if (rating.includes('buy')) color = 'ui-status-chip ui-status-chip--positive';
    else if (rating.includes('sell')) color = 'ui-status-chip ui-status-chip--negative';
    else if (rating.includes('hold')) color = 'ui-status-chip ui-status-chip--warning';
    
    return (
        <span className={`${color} capitalize`}>
            {rating}
        </span>
    );
};

/**
 * Renders a lightweight, unlabelled trend line representing contextual 7-day movement natively.
 * 
 * @component
 * @param {Object} props - React props.
 * @param {Array<number>} props.data - Sequential array of recent closing values.
 * @param {number} props.change - Trailing interval change dictating primary fill color.
 */
const SparklineChart = ({ data, change }) => {
    // Early exit preventing library crashing upon missing historical structures
    if (!data || data.length === 0) return <div className="h-10 w-24"></div>;
    const color = (change || 0) >= 0 ? '#16a34a' : '#ef4444'; // Green or Red purely derived from net change
    return (
        <div className="h-10 w-24">
            <Sparklines data={data}>
                <SparklinesLine color={color} style={{ strokeWidth: 2 }} />
                <SparklinesReferenceLine type="avg" style={{ stroke: 'rgba(100,116,139,0.2)' }} />
            </Sparklines>
        </div>
    );
};

/**
 * Distinct discrete list item handling representation and formatting of complex ticker fundamentals.
 * 
 * @component
 * @param {Object} props - React props.
 * @param {Object} props.stock - Stock object holding intrinsic variables.
 * @param {Function} props.onRemove - Callback to forcibly de-allocate stock from internal remote watchlist.
 * @param {Function} props.onRowClick - Callback escalating ticker expansion intention up toward the parent component.
 */
const WatchlistRow = ({ stock, onRemove, onRowClick }) => {
    const isPositive = (stock.change || 0) >= 0;
    
    // Safely decompose arbitrary nested JSON fundamentals structures
    const fundamentals = stock.fundamentals || {};
    const pe = fundamentals.peRatio || 'N/A';
    const mktCap = stock.marketCap || 'N/A';
    const rating = fundamentals.recommendationKey || 'N/A';
    const targetPrice = fundamentals.analystTargetPrice;

    // Calculate theoretical performance caps using analyst data explicitly
    let upsidePercent = 'N/A';
    let upsideColor = 'text-mm-text-secondary';
    if (targetPrice && stock.price) {
        const upside = ((targetPrice - stock.price) / stock.price) * 100;
        upsidePercent = formatNum(upside, true);
        upsideColor = upside >= 0 ? 'text-mm-positive' : 'text-mm-negative';
    }

    return (
        <tr className="border-t border-mm-border hover:bg-mm-surface-subtle cursor-pointer" onClick={() => onRowClick(stock.symbol)}>
            <td className="px-4 py-3">
                <div className="font-semibold text-mm-text-primary">{stock.symbol}</div>
                <div className="w-40 truncate text-xs text-mm-text-secondary">{stock.companyName}</div>
            </td>
            <td className="px-4 py-3 font-medium text-mm-text-primary">${formatNum(stock.price)}</td>
            <td className={`px-4 py-3 font-medium ${isPositive ? 'text-mm-positive' : 'text-mm-negative'}`}>
                {isPositive ? '+' : ''}{formatNum(stock.change)} ({formatNum(stock.changePercent, true)})
            </td>
            <td className="px-4 py-3 text-mm-text-secondary">{mktCap}</td>
            <td className="px-4 py-3 text-mm-text-secondary">{pe === 'N/A' ? 'N/A' : formatNum(pe)}</td>
            <td className="w-40 px-4 py-3">
                <FiftyTwoWeekRange low={fundamentals.week52Low} high={fundamentals.week52High} price={stock.price} />
            </td>
            <td className="px-4 py-3">
                <SparklineChart data={stock.sparkline} change={stock.change} />
            </td>
            <td className="px-4 py-3">
                <RatingPill rating={rating} />
            </td>
            <td className="px-4 py-3 font-medium text-mm-text-primary">
                ${formatNum(targetPrice)}
            </td>
            <td className={`px-4 py-3 font-semibold ${upsideColor}`}>{upsidePercent}</td>
            <td className="px-4 py-3">
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Halt bubbling triggering an unwanted row click routing event
                        onRemove(stock.symbol);
                    }}
                    className="ui-button-destructive px-3 py-1.5"
                >
                    Remove
                </button>
            </td>
        </tr>
    );
};

/**
 * WatchlistPage Component
 * 
 * Comprehensive primary dashboard handling user-bookmarked symbol persistence, streaming data hydration,
 * sorting manipulations natively, and inline charting evaluation.
 * 
 * @component
 * @returns {JSX.Element} The completely hydrated watchlist view.
 */
const WatchlistPage = () => {
    // Structural state handling primary array of resolved entities
    const [watchlistData, setWatchlistData] = useState([]);
    
    // Asynchronous UI states governing skeletal rendering during fetch attempts
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Sort configurations determining view order logically
    const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'ascending' });
    
    // Detailed analysis states for conditionally mounted expansion properties
    const [selectedTicker, setSelectedTicker] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [chartError, setChartError] = useState(null);
    const [activeTimeFrame, setActiveTimeFrame] = useState({ label: '6M', value: '6mo' });

    /**
     * Re-calculates and fetches absolute current positions for array sequentially by isolating
     * individual stock configurations via the backend.
     */
    const fetchWatchlistData = useCallback(async () => {
        setError(null);
        try {
            // Retrieve bookmark pointers strictly
            const tickers = await apiRequest(API_ENDPOINTS.WATCHLIST);
            if (tickers.length === 0) {
                setWatchlistData([]);
                setLoading(false);
                return;
            }
            // Disperse requests asynchronously over resolved string pointers
            const promises = tickers.map((ticker) => apiRequest(API_ENDPOINTS.STOCK(ticker)));
            const detailedData = await Promise.all(promises);
            // Drop unrecoverable pointers gracefully
            setWatchlistData(detailedData.filter((data) => !data.error));
        } catch (err) {
            setError('Failed to fetch watchlist data. Is the backend server running?');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Erases ticker remotely and subsequently purges local memory copy optimistically.
     * 
     * @param {string} ticker - The core system identifier.
     */
    const handleRemoveStock = async (ticker) => {
        try {
            await apiRequest(API_ENDPOINTS.WATCHLIST_ITEM(ticker), { method: 'DELETE' });
            setWatchlistData((prevData) => prevData.filter((stock) => stock.symbol !== ticker));
        } catch (err) {
            setError('Failed to remove stock.');
        }
    };

    /**
     * Obtains specialized time-series data chunks rendering an expansive chart component.
     * 
     * @param {string} symbol - Equity targeted.
     * @param {Object} timeFrame - Formatted bounds context dictating historical breadth.
     */
    const fetchChartData = async (symbol, timeFrame) => {
        setChartData(null);
        setChartError(null);
        try {
            const chartJson = await apiRequest(API_ENDPOINTS.CHART(symbol, timeFrame.value));
            setChartData(chartJson);
        } catch (err) {
            setChartError(err.message);
        }
    };

    /**
     * Toggles expansion of nested chart views, dynamically spinning off sub-requests locally.
     * 
     * @param {string} symbol - Row targeted for expansion capability
     */
    const handleRowClick = (symbol) => {
        // Evaluate closure to dictate cleanup
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

    // Proxies specific chart timeline boundaries to child graph.
    const handleTimeFrameChange = (timeFrame) => {
        setActiveTimeFrame(timeFrame);
        if (selectedTicker) {
            fetchChartData(selectedTicker, timeFrame);
        }
    };

    // Effect: Enforce aggressive polling interval maintaining sub-minute fidelity implicitly across the watchlist view
    useEffect(() => {
        setLoading(true);
        fetchWatchlistData();
        const refreshInterval = setInterval(fetchWatchlistData, 60000); // Poll explicitly every 60s
        return () => clearInterval(refreshInterval);
    }, [fetchWatchlistData]);

    /**
     * Evaluates deeply nested parameters enabling arbitrary, highly resilient data sorting capabilities functionally.
     * Optimized explicitly utilizing react primitives ensuring execution exclusively on variable alteration.
     */
    const sortedWatchlistData = useMemo(() => {
        const sortableData = [...watchlistData];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                let aValue;
                let bValue;

                // Handle inherently dynamic sorting variables explicitly 
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
                    // Normalize fiat market cap representations mapping string sizes into computable numerical bytes
                    const parseCap = (cap) => {
                        if (typeof cap !== 'string') return 0;
                        if (cap.endsWith('T')) return parseFloat(cap) * 1e12; // Trillions
                        if (cap.endsWith('B')) return parseFloat(cap) * 1e9;  // Billions
                        return 0; // Safeguard bounds implicitly
                    };
                    aValue = parseCap(a.marketCap);
                    bValue = parseCap(b.marketCap);
                } else {
                    // Pluck generic attributes
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }

                // Explicit comparative operations determining true rank displacement naturally
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [watchlistData, sortConfig]);

    /**
     * Safely mutates global layout array parameter contexts determining directionality.
     * Multiple presses intentionally toggle reverse modes seamlessly.
     */
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    /**
     * Inline subcomponent handling rendering visual sort chevrons safely.
     * 
     * @param {Object} props - Functional Properties.
     * @param {string} props.label - UI descriptor.
     * @param {string} props.sortKey - Raw configuration reference target.
     */
    const SortableTh = ({ label, sortKey }) => {
        const isSorted = sortConfig.key === sortKey;
        const arrow = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';
        return (
            <th
                className="px-4 py-3 font-semibold text-mm-text-secondary cursor-pointer hover:bg-mm-surface-subtle"
                onClick={() => requestSort(sortKey)}
            >
                {label} {arrow}
            </th>
        );
    };

    // Conditional mounting escapes bypassing render loops completely during fatal networking
    if (loading) return <div className="ui-page"><div className="ui-empty-state py-12">Loading watchlist...</div></div>;
    if (error) return <div className="ui-page"><div className="ui-banner ui-banner-error">{error}</div></div>;

    return (
        <div className="ui-page animate-fade-in space-y-8">
            <div className="ui-page-header">
                <h1 className="ui-page-title">My Watchlist</h1>
            </div>

            {sortedWatchlistData.length > 0 ? (
                <div className="ui-panel overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-mm-border bg-mm-surface-subtle">
                            <tr>
                                <SortableTh label="Symbol" sortKey="symbol" />
                                <SortableTh label="Price" sortKey="price" />
                                <SortableTh label="Change" sortKey="change" />
                                <SortableTh label="Market Cap" sortKey="marketCap" />
                                <SortableTh label="P/E (TTM)" sortKey="peRatio" />
                                <th className="px-4 py-3 font-semibold text-mm-text-secondary">52-Week Range</th>
                                <th className="px-4 py-3 font-semibold text-mm-text-secondary">7-Day Trend</th>
                                <th className="px-4 py-3 font-semibold text-mm-text-secondary">Rating</th>
                                <SortableTh label="Price Target" sortKey="targetPrice" />
                                <SortableTh label="Upside" sortKey="upside" />
                                <th className="px-4 py-3 font-semibold text-mm-text-secondary">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedWatchlistData.map((stock) => (
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
                <div className="ui-empty-state mt-8">
                    Your watchlist is empty. Add stocks from the Search page.
                </div>
            )}

            {/* Conditionally appended expansion chart encapsulating historical pricing upon explicit user selection */}
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
                    {chartError && <div className="ui-banner ui-banner-error mt-4">{chartError}</div>}
                </div>
            )}
        </div>
    );
};

export default WatchlistPage;
