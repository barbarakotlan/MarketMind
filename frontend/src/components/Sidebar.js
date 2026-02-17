import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import {
    LayoutDashboard, Search, Star, Briefcase, Building2,
    TrendingUp, Target, BarChart3, DollarSign, Bitcoin,
    Layers, Newspaper, Bell, BookOpen, Sun, Moon,
    ChevronLeft, ChevronRight, Boxes
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
            { page: 'predictionMarkets', icon: Layers, label: 'Prediction Mkt' },
        ],
    },
    {
        label: 'Info',
        items: [
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
        fetch('http://127.0.0.1:5001/notifications/triggered')
            .then(res => res.json())
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
                    <span className="text-lg font-bold tracking-wider truncate">MarketMind</span>
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

            {/* Footer: dark mode toggle */}
            <div className="flex-shrink-0 border-t border-gray-700 p-2">
                <button
                    onClick={toggleDarkMode}
                    className={`w-full flex items-center rounded-lg px-2 py-2 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-white transition-colors duration-150 ${
                        isCollapsed ? 'justify-center' : 'justify-start space-x-3'
                    }`}
                    aria-label="Toggle dark mode"
                    title={isCollapsed ? (isDarkMode ? 'Light Mode' : 'Dark Mode') : undefined}
                >
                    {isDarkMode ? (
                        <Sun className="w-5 h-5 flex-shrink-0 text-yellow-400" />
                    ) : (
                        <Moon className="w-5 h-5 flex-shrink-0" />
                    )}
                    {!isCollapsed && (
                        <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
