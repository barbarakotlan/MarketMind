import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, ArrowUpDown, ExternalLink } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

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
        apiRequest(API_ENDPOINTS.SCREENER())
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
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer text-mm-text-secondary hover:text-mm-text-primary select-none ${className}`}
                onClick={() => requestSort(sortKey)}
            >
                <span className="flex items-center gap-1">
                    {label}
                    <ArrowUpDown className={`w-3 h-3 ${active ? 'text-mm-accent-primary' : 'opacity-40'}`} />
                </span>
            </th>
        );
    };

    return (
        <div className="ui-page animate-fade-in">
            {/* Header */}
            <div className="ui-page-header">
                <h1 className="ui-page-title">Stock Screener</h1>
                <p className="ui-page-subtitle mt-1">
                    Live market movers — click any row to research the stock
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {TABS.map(({ key, label, icon: Icon, color }) => (
                    <button
                        key={key}
                        onClick={() => { setActiveTab(key); setSortConfig({ key: 'percent_change', dir: key === 'active' ? 'desc' : (key === 'losers' ? 'asc' : 'desc') }); }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                            activeTab === key
                                ? 'ui-button-primary'
                                : 'ui-button-secondary'
                        }`}
                    >
                        <Icon className={`w-4 h-4 ${activeTab === key ? 'text-white' : color}`} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="ui-panel overflow-hidden">
                {loading && (
                    <div className="p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-mm-accent-primary border-t-transparent mb-3"></div>
                        <p className="text-mm-text-secondary">Loading market data…</p>
                    </div>
                )}
                {error && !loading && (
                    <div className="ui-banner ui-banner-error m-6 text-center">{error}</div>
                )}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-mm-surface-subtle border-b border-mm-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-mm-text-secondary uppercase tracking-wider">Symbol</th>
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
                            <tbody className="divide-y divide-mm-border">
                                {rows.map((stock) => {
                                    const pos = (stock.percent_change ?? 0) >= 0;
                                    return (
                                        <tr
                                            key={stock.symbol}
                                            className="hover:bg-mm-surface-subtle transition-colors cursor-pointer group"
                                            onClick={() => onSearchTicker && onSearchTicker(stock.symbol)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-mm-text-primary">{stock.symbol}</div>
                                                <div className="text-xs text-mm-text-secondary truncate max-w-[160px]">{stock.name}</div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-mm-text-primary">
                                                ${fmt(stock.price)}
                                            </td>
                                            <td className={`px-4 py-3 font-semibold ${pos ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                                {pos ? '+' : ''}{stock.percent_change !== null ? (stock.percent_change * 100).toFixed(2) : '—'}%
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">{fmt(stock.market_cap, '$')}</td>
                                            <td className="px-4 py-3 text-mm-text-secondary">{fmt(stock.volume)}</td>
                                            <td className="px-4 py-3 text-mm-text-secondary">
                                                {stock.pe_forward !== null ? stock.pe_forward.toFixed(1) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">${fmt(stock.year_high)}</td>
                                            <td className="px-4 py-3 text-mm-text-secondary">${fmt(stock.year_low)}</td>
                                            <td className="px-4 py-3">
                                                <ExternalLink className="w-4 h-4 text-mm-accent-primary opacity-0 group-hover:opacity-100" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {rows.length === 0 && (
                            <p className="py-8 text-center text-mm-text-secondary">No data available.</p>
                        )}
                    </div>
                )}
            </div>
            <p className="mt-3 text-xs text-mm-text-tertiary">
                Data via Yahoo Finance · Click any row to open in Search
            </p>
        </div>
    );
};

export default ScreenerPage;
