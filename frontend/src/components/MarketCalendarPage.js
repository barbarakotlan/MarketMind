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

const MarketCalendarPage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'report', 'speaker'
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        // Hitting our new real-time backend route
        apiRequest(API_ENDPOINTS.ECONOMIC_CALENDAR)
            .then(data => {
                if (!data.error && Array.isArray(data)) {
                    setEvents(data);
                }
            })
            .catch(err => console.error("Failed to fetch events:", err))
            .finally(() => setLoading(false));
    }, []);

    // Filter and search logic
    const filteredEvents = events.filter(event => {
        const matchesFilter = filter === 'all' || event.type === filter;
        const matchesSearch = event.event?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Group events by date
    const groupedEvents = filteredEvents.reduce((acc, event) => {
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push(event);
        return acc;
    }, {});

    // Sort dates chronologically
    const sortedDates = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));

    const handleSetAlert = (eventName) => {
        alert(`Alert set for: ${eventName}`);
    };

    // Helper to format date cleanly
    const formatDate = (dateString) => {
        const d = new Date(dateString + 'T12:00:00'); // Force midday to avoid timezone shifts
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
    };

    return (
        <div className="ui-page animate-fade-in">

            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="ui-page-title flex items-center">
                        <CalendarIcon className="w-8 h-8 mr-3 text-mm-accent-primary" />
                        U.S. Economic Calendar
                    </h1>
                    <p className="ui-page-subtitle mt-2 max-w-xl">
                        Track live macroeconomic reports and Federal Reserve speaker schedules.
                    </p>
                </div>

                {/* Search & Filters */}
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
            </div>

            {/* Dense Data Table Layout */}
            <div className="ui-panel overflow-hidden">

                {/* Desktop Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-mm-surface-subtle border-b border-mm-border text-xs font-semibold text-mm-text-secondary uppercase tracking-wider">
                    <div className="col-span-2">Time (ET)</div>
                    <div className="col-span-4">Event / Report</div>
                    <div className="col-span-1">Impact</div>
                    <div className="col-span-1 text-right">Actual</div>
                    <div className="col-span-1 text-right">Forecast</div>
                    <div className="col-span-2 text-right">Previous</div>
                    <div className="col-span-1 text-right">Alert</div>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-mm-accent-primary border-t-transparent"></div>
                    </div>
                ) : sortedDates.length === 0 ? (
                    <div className="py-20 text-center">
                        <Activity className="w-12 h-12 mx-auto text-mm-text-tertiary mb-3" />
                        <h3 className="text-lg font-semibold text-mm-text-primary">No Events Found</h3>
                        <p className="text-sm text-mm-text-secondary">There are no matching economic events for this week.</p>
                    </div>
                ) : (
                    sortedDates.map((date) => (
                        <div key={date}>
                            {/* Date Separator */}
                            <div className="px-6 py-2 bg-mm-accent-primary/8 border-y border-mm-border">
                                <h2 className="text-sm font-semibold text-mm-accent-primary tracking-wide">
                                    {formatDate(date)}
                                </h2>
                            </div>

                            {/* Event Rows */}
                            <div className="divide-y divide-mm-border">
                                {groupedEvents[date].map((event) => {
                                    const isSpeaker = event.type === 'speaker';

                                    return (
                                        <div key={event.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-mm-surface-subtle transition-colors items-center group">

                                            {/* Time */}
                                            <div className="col-span-2 flex items-center text-sm font-semibold text-mm-text-primary">
                                                <Clock className="w-4 h-4 mr-2 text-mm-text-tertiary hidden md:block" />
                                                {event.time}
                                            </div>

                                            {/* Event Name */}
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

                                            {/* Impact Badge */}
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

                                            {/* Actual */}
                                            <div className="col-span-1 text-sm font-semibold text-mm-text-primary md:text-right flex md:block justify-between items-center">
                                                <span className="md:hidden text-mm-text-secondary font-normal">Actual:</span>
                                                {event.actual !== '-' ? (
                                                    <span className="rounded-control bg-mm-surface-subtle px-2 py-1">
                                                        {event.actual}
                                                    </span>
                                                ) : '-'}
                                            </div>

                                            {/* Forecast */}
                                            <div className="col-span-1 text-sm text-mm-text-secondary md:text-right flex md:block justify-between">
                                                <span className="md:hidden text-mm-text-secondary">Forecast:</span>
                                                {event.forecast}
                                            </div>

                                            {/* Previous */}
                                            <div className="col-span-2 text-sm text-mm-text-tertiary md:text-right flex md:block justify-between">
                                                <span className="md:hidden text-mm-text-secondary">Previous:</span>
                                                {event.previous}
                                            </div>

                                            {/* Alert Button */}
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
        </div>
    );
};

export default MarketCalendarPage;
