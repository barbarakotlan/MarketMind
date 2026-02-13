import React, { useState, useEffect } from 'react';
import {
    Search, Star, Briefcase, Building2, TrendingUp, Target, Globe, DollarSign,
    Bitcoin, BarChart3, Newspaper, BookOpen, ChevronDown, Bell, Layers
} from 'lucide-react';


const Header = ({ activePage, setActivePage }) => {

    const [showOtherMenu, setShowOtherMenu] = useState(false);
    // --- NEW: State for notifications ---
    const [newAlertCount, setNewAlertCount] = useState(0);

    // --- NEW: Function to check for new alerts ---
    const checkAlerts = () => {
        fetch('http://127.0.0.1:5001/notifications/triggered')
            .then(res => res.json())
            .then(data => {
                setNewAlertCount(data.length);
            })
            .catch(err => console.error("Error fetching alerts:", err));
    };

    // --- NEW: Poll for alerts every 15 seconds ---
    useEffect(() => {
        checkAlerts(); // Check once on load
        const interval = setInterval(checkAlerts, 15000); // Check every 15 seconds
        return () => clearInterval(interval);
    }, []);

    // --- NEW: Clear count when navigating to the page ---
    const handleNavClick = (pageName) => {
        if (pageName === 'notifications') {
            setNewAlertCount(0); // Clear count immediately
        }
        setActivePage(pageName);
    };
    const NavButton = ({ pageName, children }) => {
        const isActive = activePage === pageName;
        return (
            <button
                onClick={() => handleNavClick(pageName)} // Use new handler
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap relative ${
                    isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
            >
                {children}
                {/* --- NEW: Red dot logic --- */}
                {pageName === 'notifications' && newAlertCount > 0 && (
                    <span className="absolute top-0 right-0 block h-3 w-3 -mt-1 -mr-1">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                    </span>
                )}
            </button>
        );
    };

    const NavDivider = () => (
        <div className="h-6 w-px bg-gray-700 dark:bg-gray-600 mx-1"></div>
    );

    return (
        <header className="bg-gray-800 dark:bg-gray-950 text-white shadow-lg transition-colors duration-200">
            <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center">
                    <h1 className="text-xl font-bold tracking-wider">MarketMind</h1>
                </div>
                <div className="flex items-center space-x-4">
                    {/* Navigation Buttons - Organized by Section */}
                    <div className="flex items-center space-x-1 bg-gray-900 dark:bg-gray-800 rounded-lg p-1 relative">
                        {/* Main Actions */}
                        <NavButton pageName="search">
                            <Search className="w-4 h-4 inline mr-1" />
                            Search
                        </NavButton>
                        <NavButton pageName="watchlist">
                            <Star className="w-4 h-4 inline mr-1" />
                            Watchlist
                        </NavButton>
                        <NavButton pageName="portfolio">
                            <Briefcase className="w-4 h-4 inline mr-1" />
                            Portfolio
                        </NavButton>
                        <NavButton pageName="fundamentals">
                            <Building2 className="w-4 h-4 inline mr-1" />
                            Fundamentals
                        </NavButton>

                        <NavDivider />

                        {/* Stock Analysis */}
                        <NavButton pageName="predictions">
                            <TrendingUp className="w-4 h-4 inline mr-1" />
                            Predict
                        </NavButton>
                        <NavButton pageName="performance">
                            <Target className="w-4 h-4 inline mr-1" />
                            Evaluate
                        </NavButton>
                        <NavButton pageName="options">
                            <BarChart3 className="w-4 h-4 inline mr-1" />
                            Options
                        </NavButton>

                        <NavDivider />

                        {/* Other Markets Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowOtherMenu(!showOtherMenu)}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap flex items-center space-x-1 ${
                                    ['forex', 'crypto', 'commodities', 'predictionMarkets'].includes(activePage)
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}
                            >
                                <Globe className="w-4 h-4" />
                                <span>Other</span>
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showOtherMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu with Slide Animation */}
                            <div
                                className={`absolute top-full left-0 mt-2 bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden transition-all duration-300 ease-out z-50 ${
                                    showOtherMenu 
                                        ? 'opacity-100 translate-y-0 max-h-64'
                                        : 'opacity-0 -translate-y-2 max-h-0 pointer-events-none'
                                }`}
                                style={{ minWidth: '180px' }}
                                onMouseLeave={() => setShowOtherMenu(false)} // Close on mouse leave
                            >
                                <button
                                    onClick={() => { handleNavClick('forex'); setShowOtherMenu(false); }}
                                    className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors duration-150 flex items-center space-x-2 ${
                                        activePage === 'forex' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                    <DollarSign className="w-4 h-4" />
                                    <span>Forex</span>
                                </button>
                                <button
                                    onClick={() => { handleNavClick('crypto'); setShowOtherMenu(false); }}
                                    className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors duration-150 flex items-center space-x-2 ${
                                        activePage === 'crypto' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                    <Bitcoin className="w-4 h-4" />
                                    <span>Crypto</span>
                                </button>
                                <button
                                    onClick={() => { handleNavClick('commodities'); setShowOtherMenu(false); }}
                                    className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors duration-150 flex items-center space-x-2 ${
                                        activePage === 'commodities' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    <span>Commodities</span>
                                </button>
                                <button
                                    onClick={() => { handleNavClick('predictionMarkets'); setShowOtherMenu(false); }}
                                    className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors duration-150 flex items-center space-x-2 ${
                                        activePage === 'predictionMarkets' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                    <Layers className="w-4 h-4" />
                                    <span>Prediction Mkt</span>
                                </button>
                            </div>
                        </div>

                        <NavDivider />

                        {/* Information */}
                        <NavButton pageName="news">
                            <Newspaper className="w-4 h-4 inline mr-1" />
                            News
                        </NavButton>

                        {/* --- THIS IS THE NEW BUTTON --- */}
                        <NavButton pageName="notifications">
                            <Bell className="w-4 h-4 inline" />
                        </NavButton>

                        <NavButton pageName="gettingStarted">
                            <BookOpen className="w-4 h-4 inline mr-1" />
                            Learn
                        </NavButton>
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Header;