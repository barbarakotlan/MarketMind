import React, { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    Search,
    Bell,
    Building,
    DollarSign,
    Filter,
    ArrowRight
} from 'lucide-react';


const cardClass = 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm';

const MarketCalendarPage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'earnings', 'ipo'
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch('http://127.0.0.1:5001/calendar/events')
            .then(res => res.json())
            .then(data => {
                if (!data.error && Array.isArray(data)) {
                    setEvents(data);
                } else {
                    console.error("API returned an error:", data.error);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch events:", err);
                setLoading(false);
            });
    }, []);

    // Filter and search logic
    const filteredEvents = events.filter(event => {
        const matchesFilter = filter === 'all' || event.type === filter;
        const matchesSearch = event.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              event.name.toLowerCase().includes(searchQuery.toLowerCase());
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

    const handleSetAlert = (event) => {
        // Here you would tie into your existing notification API
        alert(`Alert set for ${event.symbol} ${event.type === 'earnings' ? 'Earnings' : 'IPO'} on ${event.date}!`);
    };

    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-8 animate-fade-in">

            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center">
                        <CalendarIcon className="w-8 h-8 mr-3 text-blue-600 dark:text-blue-400" />
                        Market Calendar
                    </h1>
                    <p className="text-base text-gray-500 dark:text-gray-400 mt-2">
                        Track upcoming earnings reports and initial public offerings (IPOs).
                    </p>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ticker or name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        />
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('earnings')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === 'earnings' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Earnings
                        </button>
                        <button
                            onClick={() => setFilter('ipo')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filter === 'ipo' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            IPOs
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Event List */}
            <div className="space-y-8">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
                    </div>
                ) : sortedDates.length === 0 ? (
                    <div className={`${cardClass} p-12 text-center`}>
                        <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Events Found</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    sortedDates.map((date) => {
                        // Format date nicely (e.g., "Monday, March 1, 2026")
                        const dateObj = new Date(date);
                        // Fixing timezone offset issues for display
                        const formattedDate = new Date(dateObj.getTime() + Math.abs(dateObj.getTimezoneOffset() * 60000)).toLocaleDateString('en-US', {
                            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                        });

                        return (
                            <div key={date} className="relative pl-4 md:pl-0">
                                {/* Sticky Date Header */}
                                <div className="sticky top-0 bg-gray-50/95 dark:bg-[#121212]/95 backdrop-blur-sm py-3 z-10 border-b border-gray-200 dark:border-gray-800 mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-3 hidden md:block"></div>
                                        {formattedDate}
                                    </h2>
                                </div>

                                {/* Events for this date */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {groupedEvents[date].map((event) => (
                                        <div key={event.id} className={`${cardClass} p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group flex flex-col justify-between h-full`}>
                                            <div>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`px-2 py-1 text-xs font-bold rounded uppercase tracking-wider ${
                                                            event.type === 'earnings' 
                                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                        }`}>
                                                            {event.type}
                                                        </span>
                                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                            {event.time}
                                                        </span>
                                                    </div>
                                                </div>

                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center mb-1">
                                                    {event.symbol}
                                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                                                        {event.name}
                                                    </span>
                                                </h3>

                                                <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center mt-2">
                                                    {event.type === 'earnings' ? <DollarSign className="w-4 h-4 mr-1 text-gray-400" /> : <Building className="w-4 h-4 mr-1 text-gray-400" />}
                                                    {event.expected}
                                                </div>
                                            </div>

                                            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                                <button
                                                    onClick={() => handleSetAlert(event)}
                                                    className="flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                                >
                                                    <Bell className="w-4 h-4 mr-1.5" />
                                                    Set Alert
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default MarketCalendarPage;