import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Globe, RefreshCw } from 'lucide-react';
import { Sparklines, SparklinesLine, SparklinesReferenceLine } from 'react-sparklines';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const INDICATOR_META = {
    URATE: { desc: 'U.S. jobless rate — lower is healthier for the economy.', invert: true },
    CPI: { desc: 'Broad consumer price level. Rising = inflation pressure.', invert: false },
    IP: { desc: 'Factory & utility output index. Rising = economic expansion.', invert: false },
    TNX: { desc: '10-year U.S. government bond yield. Benchmark for borrowing costs.', invert: false },
};

const fmt = (val, unit) => {
    if (val === null || val === undefined) return '—';
    if (unit === '%') return `${val.toFixed(2)}%`;
    if (unit === 'Index') return val.toFixed(2);
    return val.toFixed(3);
};

const TrendIcon = ({ value, prev, invert }) => {
    if (value === null || prev === null) return <Minus className="h-4 w-4 text-mm-text-tertiary" />;
    const up = value > prev;
    const good = invert ? !up : up;
    if (Math.abs(value - prev) < 0.001) return <Minus className="h-4 w-4 text-mm-text-tertiary" />;
    return up
        ? <TrendingUp className={`h-4 w-4 ${good ? 'text-mm-positive' : 'text-mm-negative'}`} />
        : <TrendingDown className={`h-4 w-4 ${good ? 'text-mm-positive' : 'text-mm-negative'}`} />;
};

const IndicatorCard = ({ ind }) => {
    const meta = INDICATOR_META[ind.symbol] || {};
    const sparkValues = (ind.sparkline || []).map((d) => d.value);
    const trend = ind.value !== null && ind.prev !== null ? ind.value - ind.prev : 0;
    const trendColor = (() => {
        if (Math.abs(trend) < 0.001) return 'text-mm-text-secondary';
        const up = trend > 0;
        return meta.invert ? (up ? 'text-mm-negative' : 'text-mm-positive') : (up ? 'text-mm-positive' : 'text-mm-negative');
    })();
    const sparkColor = (() => {
        if (sparkValues.length < 2) return '#64748b';
        const up = sparkValues[sparkValues.length - 1] > sparkValues[sparkValues.length - 2];
        return meta.invert ? (up ? '#ef4444' : '#16a34a') : (up ? '#16a34a' : '#ef4444');
    })();

    return (
        <div className="ui-panel p-5">
            <div className="mb-3 flex items-start justify-between">
                <div>
                    <p className="ui-section-label mb-1">{ind.symbol}</p>
                    <p className="text-base font-semibold text-mm-text-primary">{ind.name}</p>
                </div>
                <TrendIcon value={ind.value} prev={ind.prev} invert={meta.invert} />
            </div>

            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-3xl font-semibold text-mm-text-primary">{fmt(ind.value, ind.unit)}</p>
                    {ind.prev !== null && (
                        <p className={`mt-1 text-xs font-medium ${trendColor}`}>
                            {trend > 0 ? '+' : ''}{trend.toFixed(2)} from prior
                        </p>
                    )}
                    <p className="mt-1 text-xs text-mm-text-tertiary">
                        As of {ind.date ? new Date(ind.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                    </p>
                </div>
                {sparkValues.length > 2 && (
                    <div className="h-12 w-28">
                        <Sparklines data={sparkValues} margin={4}>
                            <SparklinesLine color={sparkColor} style={{ strokeWidth: 2 }} />
                            <SparklinesReferenceLine type="avg" style={{ stroke: 'rgba(100,116,139,0.3)', strokeDasharray: '3,3' }} />
                        </Sparklines>
                    </div>
                )}
            </div>

            {meta.desc && (
                <p className="mt-3 border-t border-mm-border pt-3 text-xs leading-relaxed text-mm-text-secondary">
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
        <div className="ui-panel overflow-hidden">
            <div className="border-b border-mm-border px-5 py-4">
                <h3 className="text-sm font-semibold text-mm-text-primary">{ind.name} — Recent History</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-mm-surface-subtle">
                        <tr>
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-mm-text-secondary">Date</th>
                            <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-mm-text-secondary">Value</th>
                            <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-mm-text-secondary">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => {
                            const prev = rows[i + 1];
                            const delta = prev ? row.value - prev.value : null;
                            const pos = delta !== null && delta > 0;
                            return (
                                <tr key={row.date} className="border-t border-mm-border hover:bg-mm-surface-subtle">
                                    <td className="px-5 py-2 text-mm-text-secondary">
                                        {new Date(row.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-5 py-2 text-right font-medium text-mm-text-primary">
                                        {fmt(row.value, ind.unit)}
                                    </td>
                                    <td className={`px-5 py-2 text-right text-xs font-medium ${delta === null ? 'text-mm-text-tertiary' : pos ? 'text-mm-positive' : 'text-mm-negative'}`}>
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
        apiRequest(API_ENDPOINTS.MACRO_OVERVIEW)
            .then((d) => {
                if (d.error) throw new Error(d.error);
                setIndicators(d);
                setLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setLoading(false);
            });
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="ui-page animate-fade-in space-y-8">
            <div className="ui-page-header flex items-start justify-between gap-4">
                <div>
                    <h1 className="ui-page-title flex items-center gap-2">
                        <Globe className="h-6 w-6 text-mm-accent-primary" />
                        Macro Dashboard
                    </h1>
                    <p className="ui-page-subtitle">Key U.S. economic indicators updated on a monthly cadence.</p>
                </div>
                <button onClick={load} disabled={loading} className="ui-button-secondary gap-2">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {loading && (
                <div className="py-20 text-center">
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-mm-accent-primary border-t-transparent"></div>
                    <p className="text-mm-text-secondary">Fetching macro data…</p>
                </div>
            )}

            {error && !loading && (
                <div className="ui-banner ui-banner-error">{error}</div>
            )}

            {!loading && !error && (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {indicators.map((ind) => (
                            <div
                                key={ind.symbol}
                                onClick={() => setExpanded(expanded === ind.symbol ? null : ind.symbol)}
                                className="cursor-pointer"
                            >
                                <IndicatorCard ind={ind} />
                            </div>
                        ))}
                    </div>

                    {expanded && (() => {
                        const ind = indicators.find((i) => i.symbol === expanded);
                        return ind ? (
                            <div className="animate-fade-in">
                                <HistoryTable ind={ind} />
                            </div>
                        ) : null;
                    })()}

                    {!expanded && (
                        <p className="text-center text-xs text-mm-text-tertiary">
                            Click any card to see 12-month history · Data via EconDB & Yahoo Finance
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default MacroPage;
