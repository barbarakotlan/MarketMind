import React, { useState, useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { useDarkMode } from '../context/DarkModeContext';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import {
    LayoutDashboard, Search, Star, Briefcase, Building2,
    TrendingUp, Target, BarChart3, DollarSign, Bitcoin,
    Layers, Newspaper, Bell, BookOpen, Sun, Moon,
    ChevronLeft, ChevronRight, Boxes, Calendar, SlidersHorizontal, Globe
} from 'lucide-react';


const NAV_GROUPS = [
    {
        label: null,
        items: [
            { page: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        ],
    },
    {
        label: 'Trading',
        items: [
            { page: 'search', icon: Search, label: 'Search' },
            { page: 'screener', icon: SlidersHorizontal, label: 'Screener' },
            { page: 'watchlist', icon: Star, label: 'Watchlist' },
            { page: 'portfolio', icon: Briefcase, label: 'Portfolio' },
            { page: 'fundamentals', icon: Building2, label: 'Fundamentals' },
        ],
    },
    {
        label: 'Analysis',
        items: [
            { page: 'predictions', icon: TrendingUp, label: 'Predictions' },
            { page: 'performance', icon: Target, label: 'Evaluate' },
            { page: 'options', icon: BarChart3, label: 'Options' },
        ],
    },
    {
        label: 'Markets',
        items: [
            { page: 'forex', icon: DollarSign, label: 'Forex' },
            { page: 'crypto', icon: Bitcoin, label: 'Crypto' },
            { page: 'commodities', icon: Boxes, label: 'Commodities' },
            { page: 'macro', icon: Globe, label: 'Macro' },
            { page: 'predictionMarkets', icon: Layers, label: 'Prediction Mkt' },
        ],
    },
    {
        label: 'Info',
        items: [
            { page: 'calendar', icon: Calendar, label: 'Calendar' }, // <-- Added Calendar page here
            { page: 'news', icon: Newspaper, label: 'News' },
            { page: 'notifications', icon: Bell, label: 'Alerts' },
            { page: 'gettingStarted', icon: BookOpen, label: 'Learn' },
        ],
    },
];

const Sidebar = ({ activePage, setActivePage, isCollapsed, onToggleCollapse }) => {
    const { isDarkMode, toggleDarkMode } = useDarkMode();
    const [newAlertCount, setNewAlertCount] = useState(0);

    const checkAlerts = () => {
        apiRequest(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED)
            .then(data => {
                setNewAlertCount(data.length);
            })
            .catch(err => console.error("Error fetching alerts:", err));
    };

    useEffect(() => {
        checkAlerts();
        const interval = setInterval(checkAlerts, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleNavClick = (pageName) => {
        if (pageName === 'notifications') {
            setNewAlertCount(0);
        }
        setActivePage(pageName);
    };

    const NavItem = ({ item }) => {
        const Icon = item.icon;
        const isActive = activePage === item.page;
        const isAlerts = item.page === 'notifications';
        return (
            <button
                onClick={() => handleNavClick(item.page)}
                title={isCollapsed ? item.label : undefined}
                className={`relative w-full flex items-center rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-150 ${
                    isCollapsed ? 'justify-center' : 'justify-start space-x-3'
                } ${
                    isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
            >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
                {isAlerts && newAlertCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                )}
            </button>
        );
    };

    return (
        <aside
            className={`fixed left-0 top-0 h-screen z-40 flex flex-col bg-gray-800 dark:bg-gray-950 text-white transition-all duration-300 ${
                isCollapsed ? 'w-16' : 'w-56'
            }`}
        >
            {/* Brand bar */}
            <div className="flex items-center justify-between h-14 px-3 border-b border-gray-700 flex-shrink-0">
                {!isCollapsed && (
                    <img
                        src={isDarkMode ? 'marketmindtransparentdark.png' : 'marketmindtransparent.png'}
                        alt="MarketMind"
                        className="h-9 w-auto object-contain"
                    />
                )}
                {isCollapsed && (
                    <span className="text-lg font-bold mx-auto">M</span>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="p-1 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors flex-shrink-0"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
                {NAV_GROUPS.map((group, gi) => (
                    <div key={gi}>
                        {group.label && (
                            isCollapsed
                                ? <hr className="mx-1 my-2 border-gray-700" />
                                : <p className="px-2 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.label}</p>
                        )}
                        {group.items.map(item => (
                            <NavItem key={item.page} item={item} />
                        ))}
                    </div>
                ))}
            </nav>

            {/* Footer: profile + dark mode toggle */}
            <div className="flex-shrink-0 border-t border-gray-700 p-2">
                <div className={`w-full flex items-center ${isCollapsed ? 'justify-center gap-2' : 'justify-between px-1'}`}>
                    <UserButton afterSignOutUrl="/" />
                    <button
                        onClick={toggleDarkMode}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors duration-150"
                        aria-label="Toggle dark mode"
                        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                        {isDarkMode ? (
                            <Sun className="w-4 h-4 text-yellow-400" />
                        ) : (
                            <Moon className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
