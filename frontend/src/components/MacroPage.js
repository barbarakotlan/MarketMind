import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Globe, RefreshCw } from 'lucide-react';
import { Sparklines, SparklinesLine, SparklinesReferenceLine } from 'react-sparklines';

const INDICATOR_META = {
    URATE: { desc: 'U.S. jobless rate — lower is healthier for the economy.', invert: true  },
    CPI:   { desc: 'Broad consumer price level. Rising = inflation pressure.',  invert: false },
    IP:    { desc: 'Factory & utility output index. Rising = economic expansion.', invert: false },
    TNX:   { desc: '10-year U.S. government bond yield. Benchmark for borrowing costs.', invert: false },
};

const fmt = (val, unit) => {
    if (val === null || val === undefined) return '—';
    if (unit === '%') return `${val.toFixed(2)}%`;
    if (unit === 'Index') return val.toFixed(2);
    return val.toFixed(3);
};

const TrendIcon = ({ value, prev, invert }) => {
    if (value === null || prev === null) return <Minus className="w-4 h-4 text-gray-400" />;
    const up = value > prev;
    const good = invert ? !up : up;
    if (Math.abs(value - prev) < 0.001) return <Minus className="w-4 h-4 text-gray-400" />;
    return up
        ? <TrendingUp  className={`w-4 h-4 ${good ? 'text-green-500' : 'text-red-500'}`} />
        : <TrendingDown className={`w-4 h-4 ${good ? 'text-green-500' : 'text-red-500'}`} />;
};

const IndicatorCard = ({ ind }) => {
    const meta = INDICATOR_META[ind.symbol] || {};
    const sparkValues = (ind.sparkline || []).map(d => d.value);
    const trend = ind.value !== null && ind.prev !== null ? ind.value - ind.prev : 0;
    const trendColor = (() => {
        if (Math.abs(trend) < 0.001) return 'text-gray-500';
        const up = trend > 0;
        return meta.invert
            ? (up ? 'text-red-500' : 'text-green-500')
            : (up ? 'text-green-500' : 'text-red-500');
    })();
    const sparkColor = (() => {
        if (sparkValues.length < 2) return '#6b7280';
        const up = sparkValues[sparkValues.length - 1] > sparkValues[sparkValues.length - 2];
        return meta.invert ? (up ? '#ef4444' : '#10b981') : (up ? '#10b981' : '#ef4444');
    })();

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{ind.symbol}</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{ind.name}</p>
                </div>
                <TrendIcon value={ind.value} prev={ind.prev} invert={meta.invert} />
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {fmt(ind.value, ind.unit)}
                    </p>
                    {ind.prev !== null && (
                        <p className={`text-xs font-medium mt-1 ${trendColor}`}>
                            {trend > 0 ? '+' : ''}{(trend).toFixed(ind.unit === '%' ? 2 : 2)} from prior
                        </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        As of {ind.date ? new Date(ind.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                    </p>
                </div>
                {sparkValues.length > 2 && (
                    <div className="w-28 h-12">
                        <Sparklines data={sparkValues} margin={4}>
                            <SparklinesLine color={sparkColor} style={{ strokeWidth: 2 }} />
                            <SparklinesReferenceLine type="avg" style={{ stroke: 'rgba(150,150,150,0.3)', strokeDasharray: '3,3' }} />
                        </Sparklines>
                    </div>
                )}
            </div>

            {meta.desc && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-3">
                    {meta.desc}
                </p>
            )}
        </div>
    );
};

const HistoryTable = ({ ind }) => {
    const rows = [...(ind.sparkline || [])].reverse().slice(0, 12);
    if (!rows.length) return null;
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{ind.name} — Recent History</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-5 py-2 text-left text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Date</th>
                            <th className="px-5 py-2 text-right text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Value</th>
                            <th className="px-5 py-2 text-right text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Change</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rows.map((row, i) => {
                            const prev = rows[i + 1];
                            const delta = prev ? row.value - prev.value : null;
                            const pos = delta !== null && delta > 0;
                            return (
                                <tr key={row.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="px-5 py-2 text-gray-700 dark:text-gray-300">
                                        {new Date(row.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-5 py-2 text-right font-medium text-gray-900 dark:text-white">
                                        {fmt(row.value, ind.unit)}
                                    </td>
                                    <td className={`px-5 py-2 text-right text-xs font-medium ${delta === null ? 'text-gray-400' : pos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {delta === null ? '—' : `${pos ? '+' : ''}${delta.toFixed(2)}`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const MacroPage = () => {
    const [indicators, setIndicators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(null);

    const load = () => {
        setLoading(true);
        setError('');
        fetch('http://127.0.0.1:5001/macro/overview')
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setIndicators(d);
                setLoading(false);
            })
            .catch(e => { setError(e.message); setLoading(false); });
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Globe className="w-6 h-6 text-blue-500" />
                        Macro Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Key U.S. economic indicators — updated monthly
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {loading && (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Fetching macro data…</p>
                </div>
            )}

            {error && !loading && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-xl">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* Indicator cards grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                        {indicators.map(ind => (
                            <div
                                key={ind.symbol}
                                onClick={() => setExpanded(expanded === ind.symbol ? null : ind.symbol)}
                                className="cursor-pointer"
                            >
                                <IndicatorCard ind={ind} />
                            </div>
                        ))}
                    </div>

                    {/* Expanded history table */}
                    {expanded && (() => {
                        const ind = indicators.find(i => i.symbol === expanded);
                        return ind ? (
                            <div className="animate-fade-in">
                                <HistoryTable ind={ind} />
                            </div>
                        ) : null;
                    })()}

                    {!expanded && (
                        <p className="text-xs text-center text-gray-400 dark:text-gray-600">
                            Click any card to see 12-month history · Data via EconDB & Yahoo Finance
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default MacroPage;
