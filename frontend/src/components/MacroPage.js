import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Globe, RefreshCw, Calendar, Clock, Mic } from 'lucide-react';
import { Sparklines, SparklinesLine, SparklinesReferenceLine } from 'react-sparklines';
import { API_ENDPOINTS, apiRequest } from '../config/api';

/**
 * Metadata for macroeconomic indicators.
 * @property {string} desc - A brief explanation of what the indicator measures.
 * @property {boolean} invert - If true, a lower number is considered "good" (e.g., Unemployment Rate).
 */
const INDICATOR_META = {
    URATE: { desc: 'U.S. jobless rate — lower is healthier for the economy.', invert: true },
    CPI: { desc: 'Broad consumer price level. Rising = inflation pressure.', invert: false },
    IP: { desc: 'Factory & utility output index. Rising = economic expansion.', invert: false },
    TNX: { desc: '10-year U.S. government bond yield. Benchmark for borrowing costs.', invert: false },
    CN_CPI: { desc: 'Mainland China consumer inflation on a year-over-year basis.', invert: false },
    CN_GDP: { desc: 'Mainland China annual GDP growth rate.', invert: false },
    CN_PMI: { desc: 'Official manufacturing PMI. Readings above 50 imply expansion.', invert: false },
    HK_CPI: { desc: 'Hong Kong annual inflation rate.', invert: false },
    HK_URATE: { desc: 'Hong Kong labor-market slack. Lower is healthier.', invert: true },
};

// Available regions for the dashboard
const REGION_OPTIONS = [
    { value: 'us', label: 'United States' },
    { value: 'asia', label: 'Asia' },
];

/**
 * Formats standard indicator values based on their unit type.
 */
const fmt = (val, unit) => {
    if (val === null || val === undefined) return '—';
    if (unit === '%') return `${val.toFixed(2)}%`;
    if (unit === 'Index') return val.toFixed(2);
    return val.toFixed(3);
};

/**
 * Formats market signal values with specific decimal requirements (e.g., 4 decimals for FX).
 */
const fmtSignalValue = (signal) => {
    const value = signal?.value;
    if (value === null || value === undefined) return '—';
    if (signal?.category === 'FX') return value.toFixed(4);
    
    // Format large numbers with commas, handling edge cases for very small numbers
    return value.toLocaleString('en-US', {
        minimumFractionDigits: value < 10 ? 2 : 0,
        maximumFractionDigits: 2,
    });
};

/**
 * Formats the percentage change for market signals, prepending a '+' for positive values.
 */
const fmtSignalChange = (signal) => {
    const changePercent = signal?.changePercent;
    if (changePercent === null || changePercent === undefined) return '—';
    return `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
};

/**
 * Safely formats event dates from string to a localized short format.
 */
const formatEventDate = (dateString) => {
    // Append a midday time to avoid timezone offset issues pushing the date backward
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString || 'TBD';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * Filters and sorts upcoming economic events.
 * Prioritizes High/Medium impact events happening today or in the future.
 */
const getFeaturedEvents = (events) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = (events || []).filter((event) => {
        if (!event.date) return true;
        const eventDate = new Date(`${event.date}T12:00:00`);
        return Number.isNaN(eventDate.getTime()) || eventDate >= today;
    });

    const impactFirst = upcoming.filter((event) => event.impact === 'High' || event.impact === 'Medium');
    
    // Return up to 4 high-impact events, falling back to standard upcoming events if none exist
    return (impactFirst.length ? impactFirst : upcoming).slice(0, 4);
};

/**
 * Renders a directional trend icon (Up/Down/Flat).
 * Determines color (green/red) based on whether the movement is economically "good" or "bad".
 */
const TrendIcon = ({ value, prev, invert }) => {
    if (value === null || prev === null) return <Minus className="h-4 w-4 text-mm-text-tertiary" />;
    
    const up = value > prev;
    const good = invert ? !up : up; // E.g., Up is BAD for Unemployment (invert = true)
    
    // Handle flat trends
    if (Math.abs(value - prev) < 0.001) return <Minus className="h-4 w-4 text-mm-text-tertiary" />;
    
    return up
        ? <TrendingUp className={`h-4 w-4 ${good ? 'text-mm-positive' : 'text-mm-negative'}`} />
        : <TrendingDown className={`h-4 w-4 ${good ? 'text-mm-positive' : 'text-mm-negative'}`} />;
};

/**
 * Card component displaying a single economic indicator (e.g., CPI, GDP).
 * Includes current value, delta from prior, description, and a sparkline chart.
 */
const IndicatorCard = ({ ind }) => {
    const meta = INDICATOR_META[ind.symbol] || {};
    const invert = ind.invert ?? meta.invert;
    const sparkValues = (ind.sparkline || []).map((d) => d.value);
    const trend = ind.value !== null && ind.prev !== null ? ind.value - ind.prev : 0;
    
    // Determine the color of the text indicating the change
    const trendColor = (() => {
        if (Math.abs(trend) < 0.001) return 'text-mm-text-secondary';
        const up = trend > 0;
        return invert ? (up ? 'text-mm-negative' : 'text-mm-positive') : (up ? 'text-mm-positive' : 'text-mm-negative');
    })();

    // Determine the color of the sparkline chart
    const sparkColor = (() => {
        if (sparkValues.length < 2) return '#64748b'; // Fallback neutral color
        const up = sparkValues[sparkValues.length - 1] > sparkValues[sparkValues.length - 2];
        return invert ? (up ? '#ef4444' : '#16a34a') : (up ? '#16a34a' : '#ef4444');
    })();

    return (
        <div className="ui-panel p-5">
            {/* Header: Symbol, Name, and Trend Icon */}
            <div className="mb-3 flex items-start justify-between">
                <div>
                    <p className="ui-section-label mb-1">{ind.symbol}</p>
                    <p className="text-base font-semibold text-mm-text-primary">{ind.name}</p>
                </div>
                <TrendIcon value={ind.value} prev={ind.prev} invert={invert} />
            </div>

            {/* Main Data & Chart Container */}
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
                
                {/* Render Sparkline if there are enough data points */}
                {sparkValues.length > 2 && (
                    <div className="h-12 w-28">
                        <Sparklines data={sparkValues} margin={4}>
                            <SparklinesLine color={sparkColor} style={{ strokeWidth: 2 }} />
                            <SparklinesReferenceLine type="avg" style={{ stroke: 'rgba(100,116,139,0.3)', strokeDasharray: '3,3' }} />
                        </Sparklines>
                    </div>
                )}
            </div>

            {/* Footer: Indicator Description */}
            {(ind.description || meta.desc) && (
                <p className="mt-3 border-t border-mm-border pt-3 text-xs leading-relaxed text-mm-text-secondary">
                    {ind.description || meta.desc}
                </p>
            )}
        </div>
    );
};

/**
 * Renders a grid of selected FX and commodity pulses (primarily used for the Asia view).
 */
const MarketSignalsPanel = ({ signals }) => {
    if (!signals.length) return null;

    return (
        <div className="ui-panel p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-semibold text-mm-text-primary">Asia Market Signals</h2>
                    <p className="mt-1 text-xs text-mm-text-secondary">
                        Selected FX and commodity pulse points alongside the macro indicators.
                    </p>
                </div>
                <p className="text-xs text-mm-text-tertiary">Data via Akshare</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {signals.map((signal) => {
                    const positive = (signal.changePercent || 0) >= 0;
                    return (
                        <div key={signal.symbol} className="rounded-control border border-mm-border bg-mm-surface-subtle p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-mm-accent-primary">
                                        {signal.category}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-mm-text-primary">{signal.name}</p>
                                </div>
                                <span className={`text-xs font-semibold ${positive ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                    {fmtSignalChange(signal)}
                                </span>
                            </div>
                            <p className="mt-4 text-2xl font-semibold text-mm-text-primary">{fmtSignalValue(signal)}</p>
                            <p className="mt-2 text-xs text-mm-text-tertiary">
                                {signal.date || 'Latest session'} · {signal.symbol}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * An expandable table showing the previous 12 data points for a selected indicator.
 */
const HistoryTable = ({ ind }) => {
    // Reverse the sparkline array to show newest first, limiting to 12 rows
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

/**
 * Displays upcoming economic events and Fed speeches (Used primarily in the US view).
 */
const UpcomingEventsPanel = ({ events, error }) => {
    const featuredEvents = getFeaturedEvents(events);

    if (!featuredEvents.length && !error) {
        return null;
    }

    return (
        <div className="ui-panel p-5">
            {/* Header */}
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

            {/* Error State */}
            {error ? (
                <div className="rounded-control border border-mm-border bg-mm-surface-subtle px-4 py-3 text-sm text-mm-text-secondary">
                    {error}
                </div>
            ) : (
                /* Events Grid */
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
                                    {/* Impact Badge */}
                                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                                        event.impact === 'High' ? 'ui-status-chip ui-status-chip--negative' :
                                        event.impact === 'Medium' ? 'ui-status-chip ui-status-chip--warning' :
                                        'ui-status-chip'
                                    }`}>
                                        {event.impact}
                                    </span>
                                </div>

                                {/* Event Time & Type */}
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

                                {/* Event Forecast Data */}
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

/**
 * Main Page Component
 * Orchestrates fetching macro data, calendar events, and layout generation.
 */
const MacroPage = () => {
    // State management
    const [region, setRegion] = useState('us'); // Toggle between US and Asia dashboards
    const [indicators, setIndicators] = useState([]);
    const [marketSignals, setMarketSignals] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [eventsError, setEventsError] = useState('');
    
    // Tracks which IndicatorCard is currently expanded to show its HistoryTable
    const [expanded, setExpanded] = useState(null); 
    const [regionSummary, setRegionSummary] = useState(null);

    /**
     * Fetches primary macro indicators and optional regional data.
     * Re-runs whenever the 'region' state changes.
     */
    const load = useCallback(() => {
        setLoading(true);
        setError('');
        setEventsError('');
        
        // Fetch Main Indicators
        apiRequest(API_ENDPOINTS.MACRO_OVERVIEW(region))
            .then((macroPayload) => {
                if (macroPayload?.error) {
                    throw new Error(macroPayload.error);
                }

                // Handle variations in API payload structure
                const nextIndicators = Array.isArray(macroPayload)
                    ? macroPayload
                    : Array.isArray(macroPayload?.indicators)
                        ? macroPayload.indicators
                        : [];
                
                setIndicators(nextIndicators);
                setMarketSignals(Array.isArray(macroPayload?.marketSignals) ? macroPayload.marketSignals : []);
                setRegionSummary(Array.isArray(macroPayload) ? null : macroPayload);
                
                // Collapse the expanded card if its indicator is no longer in the list
                setExpanded((current) => nextIndicators.some((ind) => ind.symbol === current) ? current : null);
            })
            .catch((e) => {
                setIndicators([]);
                setMarketSignals([]);
                setRegionSummary(null);
                setError(e.message || 'Failed to fetch macro data.');
            })
            .finally(() => {
                setLoading(false);
            });

        // Only fetch the economic calendar if looking at the US region
        if (region !== 'us') {
            setEvents([]);
            setEventsError('');
            return;
        }

        // Fetch Economic Calendar Events
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
    }, [region]);

    // Initial data load and refetch on region switch
    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="ui-page animate-fade-in space-y-8">
            {/* Header & Controls */}
            <div className="ui-page-header flex items-start justify-between gap-4">
                <div>
                    <h1 className="ui-page-title flex items-center gap-2">
                        <Globe className="h-6 w-6 text-mm-accent-primary" />
                        Macro Dashboard
                    </h1>
                    <p className="ui-page-subtitle">
                        {region === 'asia'
                            ? 'China and Hong Kong macro indicators with selected FX and commodity signals.'
                            : 'Key U.S. economic indicators updated on a monthly cadence.'}
                    </p>
                    
                    {/* Region Selector Toggle */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {REGION_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setRegion(option.value)}
                                className={region === option.value
                                    ? 'rounded-control bg-mm-accent-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-card'
                                    : 'rounded-control border border-mm-border bg-mm-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-mm-text-secondary transition hover:bg-mm-surface-subtle hover:text-mm-text-primary'}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Manual Refresh Button */}
                <button onClick={load} disabled={loading} className="ui-button-secondary gap-2">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Global Loading State */}
            {loading && (
                <div className="py-20 text-center">
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-mm-accent-primary border-t-transparent"></div>
                    <p className="text-mm-text-secondary">Fetching macro data…</p>
                </div>
            )}

            {/* Global Error State */}
            {error && !loading && (
                <div className="ui-banner ui-banner-error">{error}</div>
            )}

            {/* Dashboard Content */}
            {!loading && !error && (
                <>
                    {/* Conditional Upper Panels based on Region */}
                    {region === 'us' ? (
                        <UpcomingEventsPanel events={events} error={eventsError} />
                    ) : (
                        <div className="ui-panel p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-mm-text-primary">
                                        {regionSummary?.title || 'Asia Macro Dashboard'}
                                    </h2>
                                    <p className="mt-1 text-xs text-mm-text-secondary">
                                        {regionSummary?.description || 'Read-only Asia macro research lane powered by Akshare.'}
                                    </p>
                                </div>
                                <p className="text-xs text-mm-text-tertiary">{regionSummary?.sourceNote || 'Data via Akshare'}</p>
                            </div>
                        </div>
                    )}

                    {/* Asia Market Signals */}
                    {region === 'asia' && <MarketSignalsPanel signals={marketSignals} />}

                    {/* Indicators Grid */}
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

                    {/* Expanded History Table (Shows below the grid when a card is clicked) */}
                    {expanded && (() => {
                        const ind = indicators.find((i) => i.symbol === expanded);
                        return ind ? (
                            <div className="animate-fade-in">
                                <HistoryTable ind={ind} />
                            </div>
                        ) : null;
                    })()}

                    {/* Helper text when no card is expanded */}
                    {!expanded && (
                        <p className="text-center text-xs text-mm-text-tertiary">
                            {region === 'asia'
                                ? 'Click any card to see recent history · Read-only Asia macro lane via Akshare'
                                : 'Click any card to see 12-month history · Data via FRED and Yahoo Finance'}
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default MacroPage;
