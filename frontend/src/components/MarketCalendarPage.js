import React, { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    Search,
    Bell,
    Mic,
    TrendingUp,
    Clock,
    Activity
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import {
    formatMarketSessionDateTime,
    getMarketSessionLabel,
    getMarketSessionSummary,
    getMarketSessionToneClasses,
    getTimezoneLabel,
} from './ui/marketSessionUtils';

// Supported markets for the Market Sessions view
const SESSION_MARKETS = [
    { value: 'us', label: 'US' },
    { value: 'hk', label: 'HK' },
    { value: 'cn', label: 'CN' },
];

/**
 * MarketCalendarPage Component
 * Displays an interactive dashboard with two main views:
 * 1. Economic Calendar: Real-time macroeconomic reports and Fed speaker schedules.
 * 2. Market Sessions: Trading hours, breaks, and holidays across various global markets.
 */
const MarketCalendarPage = () => {
    // --- State Management ---
    
    // Economic Calendar State
    const [events, setEvents] = useState([]); // Raw event data from API
    const [loading, setLoading] = useState(true); // Loading state for economic events
    const [filter, setFilter] = useState('all'); // Event type filter: 'all', 'report', or 'speaker'
    const [searchQuery, setSearchQuery] = useState(''); // Text search for specific events
    
    // Market Sessions State
    const [sessionPayload, setSessionPayload] = useState(null); // Data for market sessions
    const [sessionLoading, setSessionLoading] = useState(false); // Loading state for market sessions
    const [sessionError, setSessionError] = useState(''); // Error handling for market sessions
    const [selectedMarket, setSelectedMarket] = useState('us'); // Currently selected market ('us', 'hk', 'cn')

    // Global View State
    const [activeView, setActiveView] = useState('economic'); // Toggles between 'economic' and 'sessions'

    // --- Side Effects ---

    // 1. Fetch Economic Calendar Data on initial mount
    useEffect(() => {
        setLoading(true);
        // Hitting the real-time backend route for economic data
        apiRequest(API_ENDPOINTS.ECONOMIC_CALENDAR)
            .then(data => {
                // Ensure data is valid and is an array before setting state
                if (!data.error && Array.isArray(data)) {
                    setEvents(data);
                }
            })
            .catch(err => console.error("Failed to fetch events:", err))
            .finally(() => setLoading(false));
    }, []); // Empty dependency array ensures this only runs once on mount

    // 2. Fetch Market Session Data when view or market changes
    useEffect(() => {
        // Only fetch if the user is currently looking at the 'sessions' view
        if (activeView !== 'sessions') {
            return;
        }
        
        setSessionLoading(true);
        setSessionError('');
        
        // Fetch session data based on the currently selected market (e.g., 'us', 'hk')
        apiRequest(API_ENDPOINTS.MARKET_SESSIONS_CALENDAR(selectedMarket))
            .then((data) => setSessionPayload(data))
            .catch((err) => {
                console.error("Failed to fetch market sessions:", err);
                setSessionPayload(null);
                setSessionError(err?.message || 'Failed to fetch market sessions.');
            })
            .finally(() => setSessionLoading(false));
    }, [activeView, selectedMarket]); // Re-run when view toggles or market changes

    // --- Data Transformation & Helpers ---

    // Filter events based on selected type (report/speaker) and user search query
    const filteredEvents = events.filter(event => {
        const matchesFilter = filter === 'all' || event.type === filter;
        const matchesSearch = event.event?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Group the filtered events by their date string so they can be rendered in categorized sections
    const groupedEvents = filteredEvents.reduce((acc, event) => {
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push(event);
        return acc;
    }, {});

    // Extract dates from grouped data and sort them chronologically to ensure correct display order
    const sortedDates = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));

    // Placeholder function for setting user alerts on specific events
    const handleSetAlert = (eventName) => {
        alert(`Alert set for: ${eventName}`);
    };

    // Formats a raw date string (YYYY-MM-DD) into a clean, human-readable format (e.g., "FRIDAY, OCT 25")
    const formatDate = (dateString) => {
        // Appending T12:00:00 forces midday to prevent timezone conversion from shifting the date back one day
        const d = new Date(dateString + 'T12:00:00'); 
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
    };

    return (
        <div className="ui-page animate-fade-in">

            {/* --- Header & Global Controls Section --- */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    {/* Dynamic Title based on active view */}
                    <h1 className="ui-page-title flex items-center">
                        <CalendarIcon className="w-8 h-8 mr-3 text-mm-accent-primary" />
                        {activeView === 'economic' ? 'U.S. Economic Calendar' : 'Market Sessions'}
                    </h1>
                    {/* Dynamic Subtitle based on active view */}
                    <p className="ui-page-subtitle mt-2 max-w-xl">
                        {activeView === 'economic'
                            ? 'Track live macroeconomic reports and Federal Reserve speaker schedules.'
                            : 'Understand regular trading sessions, lunch breaks, and upcoming holidays across US, Hong Kong, and mainland China.'}
                    </p>
                </div>

                {/* View Toggles & Contextual Filters */}
                <div className="flex flex-col gap-3 w-full md:w-auto">
                    {/* Primary Tab Group: Economic vs Sessions */}
                    <div className="ui-tab-group flex">
                        {[
                            { key: 'economic', label: 'Economic' },
                            { key: 'sessions', label: 'Market Sessions' },
                        ].map((view) => (
                            <button
                                key={view.key}
                                onClick={() => setActiveView(view.key)}
                                className={`px-4 py-1.5 text-xs ${
                                    activeView === view.key
                                        ? 'ui-tab ui-tab-active'
                                        : 'ui-tab'
                                }`}
                            >
                                {view.label}
                            </button>
                        ))}
                    </div>

                    {/* Contextual Controls: Change based on the active view */}
                    {activeView === 'economic' ? (
                        // Economic Controls: Search bar and Event Type filters
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <div className="relative flex-1 sm:flex-none">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search events..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="ui-input w-full sm:w-60 py-2 pl-9 text-sm"
                                />
                            </div>
                            <div className="ui-tab-group flex">
                                {['all', 'report', 'speaker'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-4 py-1.5 text-xs capitalize ${
                                            filter === f 
                                                ? 'ui-tab ui-tab-active'
                                                : 'ui-tab'
                                        }`}
                                    >
                                        {f === 'all' ? 'All Events' : f + 's'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // Session Controls: Market Selection Chips (US, HK, CN)
                        <div className="flex gap-2">
                            {SESSION_MARKETS.map((marketOption) => (
                                <button
                                    key={marketOption.value}
                                    type="button"
                                    onClick={() => setSelectedMarket(marketOption.value)}
                                    className={selectedMarket === marketOption.value ? 'ui-chip bg-mm-accent-primary text-white border-mm-accent-primary' : 'ui-chip'}
                                >
                                    {marketOption.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- Main Content Area --- */}
            {activeView === 'sessions' ? (
                // --- MARKET SESSIONS VIEW ---
                <div className="space-y-6">
                    {/* Loading State */}
                    {sessionLoading ? (
                        <div className="ui-panel py-20 flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-mm-accent-primary border-t-transparent"></div>
                        </div>
                    // Error State
                    ) : sessionError ? (
                        <div className="rounded-card border border-mm-negative/20 bg-mm-negative/10 px-6 py-4 text-mm-negative">
                            {sessionError}
                        </div>
                    // Data Render
                    ) : sessionPayload ? (
                        <>
                            {/* Current Session Summary Panel */}
                            <div className="ui-panel p-6">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={`rounded-pill border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getMarketSessionToneClasses(sessionPayload.today)}`}>
                                        {getMarketSessionLabel(sessionPayload.today)}
                                    </span>
                                    <span className="text-sm font-semibold text-mm-text-primary">{sessionPayload.exchange}</span>
                                    <span className="text-sm text-mm-text-secondary">• {getTimezoneLabel(sessionPayload.timezone)}</span>
                                </div>
                                <h2 className="mt-4 text-2xl font-semibold text-mm-text-primary">
                                    {sessionPayload.marketLabel} session today
                                </h2>
                                <p className="mt-2 text-sm text-mm-text-secondary">
                                    {getMarketSessionSummary(sessionPayload.today)}
                                </p>
                            </div>

                            {/* Upcoming Schedules Grid */}
                            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
                                {/* Left Column: Upcoming regular sessions */}
                                <div className="ui-panel overflow-hidden">
                                    <div className="border-b border-mm-border px-6 py-4">
                                        <h3 className="text-lg font-semibold text-mm-text-primary">Upcoming Sessions</h3>
                                    </div>
                                    <div className="divide-y divide-mm-border">
                                        {(sessionPayload.sessions || []).map((session) => (
                                            <div key={`${session.market}-${session.sessionDate}`} className="px-6 py-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-mm-text-primary">{session.sessionDate}</p>
                                                        <p className="mt-1 text-sm text-mm-text-secondary">
                                                            Opens {formatMarketSessionDateTime(session.opensAt, session.timezone)} • closes {formatMarketSessionDateTime(session.closesAt, session.timezone)}
                                                        </p>
                                                        {session.hasBreak ? (
                                                            <p className="mt-1 text-sm text-mm-text-secondary">
                                                                Lunch break {formatMarketSessionDateTime(session.breakStart, session.timezone)} to {formatMarketSessionDateTime(session.breakEnd, session.timezone)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    {/* Badge for early market close */}
                                                    {session.isEarlyClose ? (
                                                        <span className="rounded-pill border border-mm-warning/20 bg-mm-warning/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-mm-warning">
                                                            Early Close
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Column: Holidays & Special Sessions */}
                                <div className="space-y-6">
                                    {/* Holidays List */}
                                    <div className="ui-panel p-6">
                                        <h3 className="text-lg font-semibold text-mm-text-primary">Upcoming Holidays</h3>
                                        {(sessionPayload.upcomingHolidays || []).length > 0 ? (
                                            <div className="mt-4 space-y-3">
                                                {sessionPayload.upcomingHolidays.map((holiday) => (
                                                    <div key={holiday.date} className="rounded-card border border-mm-border bg-mm-surface-subtle px-4 py-3">
                                                        <p className="text-sm font-semibold text-mm-text-primary">{holiday.date}</p>
                                                        <p className="mt-1 text-sm text-mm-text-secondary">{holiday.label}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-4 text-sm text-mm-text-secondary">No weekday market holidays are visible in the current lookahead window.</p>
                                        )}
                                    </div>

                                    {/* Special (Early Close) Sessions List */}
                                    <div className="ui-panel p-6">
                                        <h3 className="text-lg font-semibold text-mm-text-primary">Special Sessions</h3>
                                        {(sessionPayload.specialSessions || []).length > 0 ? (
                                            <div className="mt-4 space-y-3">
                                                {sessionPayload.specialSessions.map((session) => (
                                                    <div key={`${session.sessionDate}-${session.type}`} className="rounded-card border border-mm-border bg-mm-surface-subtle px-4 py-3">
                                                        <p className="text-sm font-semibold text-mm-text-primary">{session.sessionDate}</p>
                                                        <p className="mt-1 text-sm text-mm-text-secondary">
                                                            Early close at {formatMarketSessionDateTime(session.closesAt, sessionPayload.timezone)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-4 text-sm text-mm-text-secondary">No early-close sessions are visible in the current lookahead window.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            ) : (
            
            // --- ECONOMIC CALENDAR VIEW ---
            <div className="ui-panel overflow-hidden">

                {/* Desktop Table Header (hidden on mobile) */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-mm-surface-subtle border-b border-mm-border text-xs font-semibold text-mm-text-secondary uppercase tracking-wider">
                    <div className="col-span-2">Time (ET)</div>
                    <div className="col-span-4">Event / Report</div>
                    <div className="col-span-1">Impact</div>
                    <div className="col-span-1 text-right">Actual</div>
                    <div className="col-span-1 text-right">Forecast</div>
                    <div className="col-span-2 text-right">Previous</div>
                    <div className="col-span-1 text-right">Alert</div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="py-20 flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-mm-accent-primary border-t-transparent"></div>
                    </div>
                // Empty State (no events found for query/filter)
                ) : sortedDates.length === 0 ? (
                    <div className="py-20 text-center">
                        <Activity className="w-12 h-12 mx-auto text-mm-text-tertiary mb-3" />
                        <h3 className="text-lg font-semibold text-mm-text-primary">No Events Found</h3>
                        <p className="text-sm text-mm-text-secondary">There are no matching economic events for this week.</p>
                    </div>
                // Data Render: Iterate through grouped dates
                ) : (
                    sortedDates.map((date) => (
                        <div key={date}>
                            {/* Date Group Header/Separator */}
                            <div className="px-6 py-2 bg-mm-accent-primary/8 border-y border-mm-border">
                                <h2 className="text-sm font-semibold text-mm-accent-primary tracking-wide">
                                    {formatDate(date)}
                                </h2>
                            </div>

                            {/* List events under the specific date */}
                            <div className="divide-y divide-mm-border">
                                {groupedEvents[date].map((event) => {
                                    const isSpeaker = event.type === 'speaker';

                                    return (
                                        // Individual Event Row (Responsive grid)
                                        <div key={event.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-mm-surface-subtle transition-colors items-center group">

                                            {/* Time Column */}
                                            <div className="col-span-2 flex items-center text-sm font-semibold text-mm-text-primary">
                                                <Clock className="w-4 h-4 mr-2 text-mm-text-tertiary hidden md:block" />
                                                {event.time}
                                            </div>

                                            {/* Event Name & Icon Column */}
                                            <div className="col-span-4 flex items-center text-sm font-medium text-mm-text-primary">
                                                {isSpeaker ? (
                                                    <Mic className="w-4 h-4 mr-2 text-mm-accent-primary flex-shrink-0" />
                                                ) : (
                                                    <TrendingUp className="w-4 h-4 mr-2 text-mm-accent-primary flex-shrink-0" />
                                                )}
                                                <span className={`${isSpeaker ? 'text-mm-text-secondary' : 'font-semibold'}`}>
                                                    {event.event}
                                                </span>
                                            </div>

                                            {/* Impact Level Column (High, Medium, Low) */}
                                            <div className="col-span-1 text-sm font-semibold flex md:block justify-between items-center">
                                                <span className="md:hidden text-mm-text-secondary font-normal">Impact:</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                                                    event.impact === 'High' ? 'ui-status-chip ui-status-chip--negative' :
                                                    event.impact === 'Medium' ? 'ui-status-chip ui-status-chip--warning' :
                                                    'ui-status-chip'
                                                }`}>
                                                    {event.impact}
                                                </span>
                                            </div>

                                            {/* Actual Result Column */}
                                            <div className="col-span-1 text-sm font-semibold text-mm-text-primary md:text-right flex md:block justify-between items-center">
                                                <span className="md:hidden text-mm-text-secondary font-normal">Actual:</span>
                                                {event.actual !== '-' ? (
                                                    <span className="rounded-control bg-mm-surface-subtle px-2 py-1">
                                                        {event.actual}
                                                    </span>
                                                ) : '-'}
                                            </div>

                                            {/* Forecasted Expectation Column */}
                                            <div className="col-span-1 text-sm text-mm-text-secondary md:text-right flex md:block justify-between">
                                                <span className="md:hidden text-mm-text-secondary">Forecast:</span>
                                                {event.forecast}
                                            </div>

                                            {/* Previous Month/Quarter Result Column */}
                                            <div className="col-span-2 text-sm text-mm-text-tertiary md:text-right flex md:block justify-between">
                                                <span className="md:hidden text-mm-text-secondary">Previous:</span>
                                                {event.previous}
                                            </div>

                                            {/* Action Column: Set Alert */}
                                            <div className="col-span-1 md:text-right mt-2 md:mt-0">
                                                <button
                                                    onClick={() => handleSetAlert(event.event)}
                                                    className="text-mm-text-tertiary hover:text-mm-accent-primary transition-colors"
                                                    title="Set Reminder"
                                                >
                                                    <Bell className="w-4 h-4 md:ml-auto" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
            )}
        </div>
    );
};

export default MarketCalendarPage;
