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

const MarketCalendarPage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'report', 'speaker'
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        // Hitting our new real-time backend route
        fetch('http://127.0.0.1:5001/calendar/economic')
            .then(res => res.json())
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
        <div className="max-w-6xl mx-auto p-4 lg:p-8 animate-fade-in bg-gray-50 dark:bg-[#121212] min-h-screen">

            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center">
                        <CalendarIcon className="w-8 h-8 mr-3 text-blue-600 dark:text-blue-500" />
                        U.S. Economic Calendar
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xl">
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
                            className="w-full sm:w-60 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex bg-gray-200/50 dark:bg-[#1e1e1e] p-1 rounded-lg border border-gray-200 dark:border-gray-800">
                        {['all', 'report', 'speaker'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all capitalize ${
                                    filter === f 
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' 
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {f === 'all' ? 'All Events' : f + 's'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dense Data Table Layout */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">

                {/* Desktop Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                    </div>
                ) : sortedDates.length === 0 ? (
                    <div className="py-20 text-center">
                        <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Events Found</h3>
                        <p className="text-sm text-gray-500">There are no matching economic events for this week.</p>
                    </div>
                ) : (
                    sortedDates.map((date) => (
                        <div key={date}>
                            {/* Date Separator */}
                            <div className="px-6 py-2 bg-blue-50/50 dark:bg-blue-900/10 border-y border-gray-100 dark:border-gray-800">
                                <h2 className="text-sm font-extrabold text-blue-800 dark:text-blue-400 tracking-wide">
                                    {formatDate(date)}
                                </h2>
                            </div>

                            {/* Event Rows */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                                {groupedEvents[date].map((event) => {
                                    const isSpeaker = event.type === 'speaker';

                                    return (
                                        <div key={event.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors items-center group">

                                            {/* Time */}
                                            <div className="col-span-2 flex items-center text-sm font-bold text-gray-900 dark:text-gray-300">
                                                <Clock className="w-4 h-4 mr-2 text-gray-400 hidden md:block" />
                                                {event.time}
                                            </div>

                                            {/* Event Name */}
                                            <div className="col-span-4 flex items-center text-sm font-medium text-gray-800 dark:text-gray-200">
                                                {isSpeaker ? (
                                                    <Mic className="w-4 h-4 mr-2 text-purple-500 flex-shrink-0" />
                                                ) : (
                                                    <TrendingUp className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                                                )}
                                                <span className={`${isSpeaker ? 'text-gray-600 dark:text-gray-400' : 'font-bold'}`}>
                                                    {event.event}
                                                </span>
                                            </div>

                                            {/* Impact Badge */}
                                            <div className="col-span-1 text-sm font-bold flex md:block justify-between items-center">
                                                <span className="md:hidden text-gray-500 font-normal">Impact:</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                                                    event.impact === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    event.impact === 'Medium' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                }`}>
                                                    {event.impact}
                                                </span>
                                            </div>

                                            {/* Actual */}
                                            <div className="col-span-1 text-sm font-bold text-gray-900 dark:text-white md:text-right flex md:block justify-between items-center">
                                                <span className="md:hidden text-gray-500 font-normal">Actual:</span>
                                                {event.actual !== '-' ? (
                                                    <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                        {event.actual}
                                                    </span>
                                                ) : '-'}
                                            </div>

                                            {/* Forecast */}
                                            <div className="col-span-1 text-sm text-gray-600 dark:text-gray-400 md:text-right flex md:block justify-between">
                                                <span className="md:hidden text-gray-500">Forecast:</span>
                                                {event.forecast}
                                            </div>

                                            {/* Previous */}
                                            <div className="col-span-2 text-sm text-gray-500 dark:text-gray-500 md:text-right flex md:block justify-between">
                                                <span className="md:hidden text-gray-500">Previous:</span>
                                                {event.previous}
                                            </div>

                                            {/* Alert Button */}
                                            <div className="col-span-1 md:text-right mt-2 md:mt-0">
                                                <button
                                                    onClick={() => handleSetAlert(event.event)}
                                                    className="text-gray-400 hover:text-blue-500 transition-colors"
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