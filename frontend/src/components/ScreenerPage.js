import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, ArrowUpDown, ExternalLink } from 'lucide-react';

const TABS = [
    { key: 'gainers', label: 'Top Gainers',   icon: TrendingUp,   color: 'text-green-600 dark:text-green-400' },
    { key: 'losers',  label: 'Top Losers',    icon: TrendingDown, color: 'text-red-600 dark:text-red-400'   },
    { key: 'active',  label: 'Most Active',   icon: Activity,     color: 'text-blue-600 dark:text-blue-400' },
];

const fmt = (n, prefix = '', suffix = '') => {
    if (n === null || n === undefined) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T${suffix}`;
    if (abs >= 1e9)  return `${prefix}${(n / 1e9).toFixed(2)}B${suffix}`;
    if (abs >= 1e6)  return `${prefix}${(n / 1e6).toFixed(2)}M${suffix}`;
    return `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
};

const ScreenerPage = ({ onSearchTicker }) => {
    const [activeTab, setActiveTab] = useState('gainers');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'percent_change', dir: 'desc' });

    useEffect(() => {
        setLoading(true);
        fetch('http://127.0.0.1:5001/screener')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => { setError('Failed to load screener data.'); setLoading(false); });
    }, []);

    const rows = useMemo(() => {
        if (!data || !data[activeTab]) return [];
        const list = [...data[activeTab]];
        list.sort((a, b) => {
            const av = a[sortConfig.key] ?? -Infinity;
            const bv = b[sortConfig.key] ?? -Infinity;
            return sortConfig.dir === 'asc' ? av - bv : bv - av;
        });
        return list;
    }, [data, activeTab, sortConfig]);

    const requestSort = (key) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    };

    const SortTh = ({ label, sortKey, className = '' }) => {
        const active = sortConfig.key === sortKey;
        return (
            <th
                className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-800 dark:hover:text-white select-none ${className}`}
                onClick={() => requestSort(sortKey)}
            >
                <span className="flex items-center gap-1">
                    {label}
                    <ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-500' : 'opacity-40'}`} />
                </span>
            </th>
        );
    };

    return (
        <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Screener</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Live market movers — click any row to research the stock
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {TABS.map(({ key, label, icon: Icon, color }) => (
                    <button
                        key={key}
                        onClick={() => { setActiveTab(key); setSortConfig({ key: 'percent_change', dir: key === 'active' ? 'desc' : (key === 'losers' ? 'asc' : 'desc') }); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === key
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        <Icon className={`w-4 h-4 ${activeTab === key ? 'text-white' : color}`} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {loading && (
                    <div className="p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
                        <p className="text-gray-500 dark:text-gray-400">Loading market data…</p>
                    </div>
                )}
                {error && !loading && (
                    <div className="p-8 text-center text-red-500 dark:text-red-400">{error}</div>
                )}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                                    <SortTh label="Price"    sortKey="price"          />
                                    <SortTh label="Change %"  sortKey="percent_change" />
                                    <SortTh label="Mkt Cap"  sortKey="market_cap"     />
                                    <SortTh label="Volume"   sortKey="volume"         />
                                    <SortTh label="P/E Fwd"  sortKey="pe_forward"     />
                                    <SortTh label="52W High" sortKey="year_high"      />
                                    <SortTh label="52W Low"  sortKey="year_low"       />
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {rows.map((stock) => {
                                    const pos = (stock.percent_change ?? 0) >= 0;
                                    return (
                                        <tr
                                            key={stock.symbol}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
                                            onClick={() => onSearchTicker && onSearchTicker(stock.symbol)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-900 dark:text-white">{stock.symbol}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">{stock.name}</div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                ${fmt(stock.price)}
                                            </td>
                                            <td className={`px-4 py-3 font-semibold ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {pos ? '+' : ''}{stock.percent_change !== null ? (stock.percent_change * 100).toFixed(2) : '—'}%
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmt(stock.market_cap, '$')}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmt(stock.volume)}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                {stock.pe_forward !== null ? stock.pe_forward.toFixed(1) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">${fmt(stock.year_high)}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">${fmt(stock.year_low)}</td>
                                            <td className="px-4 py-3">
                                                <ExternalLink className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {rows.length === 0 && (
                            <p className="text-center py-8 text-gray-500 dark:text-gray-400">No data available.</p>
                        )}
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
                Data via Yahoo Finance · Click any row to open in Search
            </p>
        </div>
    );
};

export default ScreenerPage;
