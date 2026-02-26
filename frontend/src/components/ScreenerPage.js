import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, DownloadCloud, Settings, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';

const INDICES = ['Any', 'S&P 500', 'DJIA', 'NASDAQ'];
const SECTORS = ['Any', 'Basic Materials', 'Communication Services', 'Consumer Cyclical', 'Consumer Defensive', 'Energy', 'Financial', 'Healthcare', 'Industrials', 'Real Estate', 'Technology', 'Utilities'];
const MARKET_CAPS = ['Any', 'Mega ($200bln and more)', 'Large ($10bln to $200bln)', 'Mid ($2bln to $10bln)', 'Small ($300mln to $2bln)', 'Micro ($50mln to $300mln)', 'Nano (under $50mln)'];

const TABS = [
    { id: 'overview', label: 'Overview', columns: ['Ticker', 'Company', 'Sector', 'Price', 'Change', 'Volume'] },
    { id: 'valuation', label: 'Valuation', columns: ['Ticker', 'Company', 'Market Cap', 'P/E', 'Fwd P/E', 'PEG', 'P/B'] },
    { id: 'financial', label: 'Dividends & Profitability', columns: ['Ticker', 'Company', 'Dividend', 'ROE', 'ROA', 'ROI', 'Gross Margin'] },
];

// --- NEW: Logo Fallback Component ---
const LogoFallback = ({ ticker }) => {
    const [hasError, setHasError] = useState(false);
    const firstLetter = ticker ? ticker.charAt(0).toUpperCase() : '?';

    return (
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-600">
            {!hasError ? (
                <img
                    src={`https://financialmodelingprep.com/image-stock/${ticker}.png`}
                    alt={`${ticker} logo`}
                    className="w-full h-full object-contain p-1 bg-white"
                    onError={() => setHasError(true)}
                />
            ) : (
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{firstLetter}</span>
            )}
        </div>
    );
};

const ScreenerPage = ({ onSearchTicker }) => {
    const [activeTab, setActiveTab] = useState(TABS[0]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [index, setIndex] = useState('Any');
    const [sector, setSector] = useState('Any');
    const [marketCap, setMarketCap] = useState('Any');

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

    const fetchScreenerData = async (retryCount = 0) => {
        if (retryCount === 0) {
            setLoading(true);
            setError('');
        }

        const filters = {};
        if (index !== 'Any') filters['Index'] = index;
        if (sector !== 'Any') filters['Sector'] = sector;
        if (marketCap !== 'Any') filters['Market Cap.'] = marketCap;

        try {
            const response = await fetch('http://127.0.0.1:5001/screener/advanced', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: Object.keys(filters).length > 0 ? filters : null,
                    tab: activeTab.id
                })
            });

            const result = await response.json();

            if (response.status === 503 && result.error && result.error.includes('warming up')) {
                if (retryCount < 6) {
                    setTimeout(() => fetchScreenerData(retryCount + 1), 5000);
                    return;
                }
            }

            if (result.error) throw new Error(result.error);
            setData(result.data || []);
            setLoading(false);
        } catch (err) {
            setError(err.message || 'Failed to fetch screener data.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScreenerData();
    }, [activeTab, index, sector, marketCap]);

    const handleSort = (column) => {
        let direction = 'desc';
        if (sortConfig.key === column && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key: column, direction });
    };

    const parseForSort = (val) => {
        if (val === null || val === undefined || val === '-') return -Infinity;
        if (typeof val === 'number') return val;

        const str = String(val).replace(/,/g, '');
        let multi = 1;
        if (str.endsWith('B')) multi = 1e9;
        else if (str.endsWith('M')) multi = 1e6;
        else if (str.endsWith('T')) multi = 1e12;
        else if (str.endsWith('%')) return parseFloat(str.slice(0, -1));

        let num = parseFloat(str.replace(/[^\d.-]/g, ''));
        if (isNaN(num)) return str;
        return num * multi;
    };

    const sortedData = [...data].sort((a, b) => {
        if (!sortConfig.key) return 0;
        const valA = parseForSort(a[sortConfig.key]);
        const valB = parseForSort(b[sortConfig.key]);

        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });

    const renderCell = (col, value) => {
        if (value === null || value === undefined || value === '-') return '—';

        if (typeof value === 'string' && value.endsWith('%')) {
            const num = parseFloat(value);
            if (num > 0) return <span className="text-green-600 dark:text-green-400 font-medium">+{value}</span>;
            if (num < 0) return <span className="text-red-600 dark:text-red-400 font-medium">{value}</span>;
            return value;
        }

        if (typeof value === 'number') {
            const isPercentMetric = ['Dividend', 'ROE', 'ROA', 'ROI', 'Gross Margin', 'Change'].includes(col);
            if (isPercentMetric) {
                const pct = (value * 100).toFixed(2);
                if (value > 0) return <span className="text-green-600 dark:text-green-400 font-medium">+{pct}%</span>;
                if (value < 0) return <span className="text-red-600 dark:text-red-400 font-medium">{pct}%</span>;
                return pct + '%';
            }
            return Number.isInteger(value) ? value : value.toFixed(2);
        }
        return value;
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in font-sans">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    Stock Screener <ChevronDown className="w-6 h-6 text-gray-400" />
                </h1>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
                        <DownloadCloud className="w-4 h-4" /> Save Screen
                    </button>
                    <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium">
                    <Filter className="w-4 h-4" /> Filters
                </div>

                {/* --- NEW: Quick Sort Buttons --- */}
                <div className="flex gap-2 mr-2 border-r border-gray-200 dark:border-gray-700 pr-4">
                    <button
                        onClick={() => { setActiveTab(TABS[0]); setSortConfig({ key: 'Change', direction: 'desc' }); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${sortConfig.key === 'Change' && sortConfig.direction === 'desc' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                        <TrendingUp className="w-4 h-4 text-green-500" /> Gainers
                    </button>
                    <button
                        onClick={() => { setActiveTab(TABS[0]); setSortConfig({ key: 'Change', direction: 'asc' }); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${sortConfig.key === 'Change' && sortConfig.direction === 'asc' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                        <TrendingDown className="w-4 h-4 text-red-500" /> Losers
                    </button>
                </div>

                <select value={index} onChange={(e) => setIndex(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg px-3 py-2 outline-none">
                    <option disabled>Index</option>
                    {INDICES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>

                <select value={sector} onChange={(e) => setSector(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg px-3 py-2 outline-none">
                    <option disabled>Sector</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select value={marketCap} onChange={(e) => setMarketCap(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg px-3 py-2 outline-none">
                    <option disabled>Market Cap</option>
                    {MARKET_CAPS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                {(index !== 'Any' || sector !== 'Any' || marketCap !== 'Any' || sortConfig.key) && (
                    <button onClick={() => { setIndex('Any'); setSector('Any'); setMarketCap('Any'); setSortConfig({key: null, direction: 'desc'}); }} className="ml-auto text-sm text-red-500 hover:text-red-600 font-medium">
                        Clear All
                    </button>
                )}
            </div>

            <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700 pb-px overflow-x-auto">
                {TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab.id === tab.id ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-20 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400">Scanning the market...</p>
                    </div>
                ) : error ? (
                    <div className="p-10 text-center text-red-500">{error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left select-none">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    {activeTab.columns.map((col) => (
                                        <th
                                            key={col}
                                            onClick={() => handleSort(col)}
                                            className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                {col}
                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === col ? 'text-blue-500 opacity-100' : 'opacity-40'}`} />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {sortedData.map((row, idx) => (
                                    <tr key={idx} onClick={() => onSearchTicker && onSearchTicker(row['Ticker'])} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors">
                                        {activeTab.columns.map((col, cIdx) => (
                                            <td key={cIdx} className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                {/* --- NEW: Rendering the Logo --- */}
                                                {col === 'Ticker' ? (
                                                    <div className="flex items-center gap-3">
                                                        <LogoFallback ticker={row[col]} />
                                                        <span className="font-bold text-gray-900 dark:text-white">{row[col]}</span>
                                                    </div>
                                                ) : col === 'Company' ? (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px] block">
                                                        {row[col]}
                                                    </span>
                                                ) : (
                                                    renderCell(col, row[col])
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedData.length === 0 && (
                            <div className="p-10 text-center text-gray-500">No stocks match your exact filters.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScreenerPage;