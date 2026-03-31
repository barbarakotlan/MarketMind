import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Globe, RefreshCw, Calendar, Clock, Mic } from 'lucide-react';
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

const formatEventDate = (dateString) => {
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString || 'TBD';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getFeaturedEvents = (events) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = (events || []).filter((event) => {
        if (!event.date) return true;
        const eventDate = new Date(`${event.date}T12:00:00`);
        return Number.isNaN(eventDate.getTime()) || eventDate >= today;
    });

    const impactFirst = upcoming.filter((event) => event.impact === 'High' || event.impact === 'Medium');
    return (impactFirst.length ? impactFirst : upcoming).slice(0, 4);
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

const UpcomingEventsPanel = ({ events, error }) => {
    const featuredEvents = getFeaturedEvents(events);

    if (!featuredEvents.length && !error) {
        return null;
    }

    return (
        <div className="ui-panel p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-mm-text-primary">
                        <Calendar className="h-4 w-4 text-mm-accent-primary" />
                        Next Macro Events
                    </h2>
                    <p className="mt-1 text-xs text-mm-text-secondary">
                        The highest-signal U.S. reports and Fed appearances coming up this week.
                    </p>
                </div>
                <p className="text-xs text-mm-text-tertiary">Data via Fair Economy</p>
            </div>

            {error ? (
                <div className="rounded-control border border-mm-border bg-mm-surface-subtle px-4 py-3 text-sm text-mm-text-secondary">
                    {error}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {featuredEvents.map((event) => {
                        const isSpeaker = event.type === 'speaker';
                        return (
                            <div key={event.id} className="rounded-control border border-mm-border bg-mm-surface-subtle p-4">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-mm-accent-primary">
                                            {formatEventDate(event.date)}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-mm-text-primary">
                                            {event.event}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                                        event.impact === 'High' ? 'ui-status-chip ui-status-chip--negative' :
                                        event.impact === 'Medium' ? 'ui-status-chip ui-status-chip--warning' :
                                        'ui-status-chip'
                                    }`}>
                                        {event.impact}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-mm-text-secondary">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {event.time || 'TBD'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        {isSpeaker ? <Mic className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                                        {isSpeaker ? 'Fed speaker' : 'Report'}
                                    </span>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                        <p className="text-mm-text-tertiary">Actual</p>
                                        <p className="mt-1 font-medium text-mm-text-primary">{event.actual || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-mm-text-tertiary">Forecast</p>
                                        <p className="mt-1 font-medium text-mm-text-primary">{event.forecast || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-mm-text-tertiary">Previous</p>
                                        <p className="mt-1 font-medium text-mm-text-primary">{event.previous || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const MacroPage = () => {
    const [indicators, setIndicators] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [eventsError, setEventsError] = useState('');
    const [expanded, setExpanded] = useState(null);

    const load = () => {
        setLoading(true);
        setError('');
        setEventsError('');
        apiRequest(API_ENDPOINTS.MACRO_OVERVIEW)
            .then((macroPayload) => {
                if (macroPayload?.error) {
                    throw new Error(macroPayload.error);
                }

                const nextIndicators = Array.isArray(macroPayload) ? macroPayload : [];
                setIndicators(nextIndicators);
                setExpanded((current) => nextIndicators.some((ind) => ind.symbol === current) ? current : null);
            })
            .catch((e) => {
                setIndicators([]);
                setError(e.message || 'Failed to fetch macro data.');
            })
            .finally(() => {
                setLoading(false);
            });

        apiRequest(API_ENDPOINTS.ECONOMIC_CALENDAR)
            .then((calendarPayload) => {
                if (calendarPayload?.error) {
                    setEvents([]);
                    setEventsError(calendarPayload.error);
                    return;
                }
                setEvents(Array.isArray(calendarPayload) ? calendarPayload : []);
            })
            .catch(() => {
                setEvents([]);
                setEventsError('Economic calendar is temporarily unavailable.');
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
                    <UpcomingEventsPanel events={events} error={eventsError} />

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
                            Click any card to see 12-month history · Data via FRED and Yahoo Finance
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default MacroPage;
