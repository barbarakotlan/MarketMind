import React, { useEffect, useState } from 'react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import AuthFetchBridge from './components/AuthFetchBridge';
import Sidebar from './components/Sidebar';
import DashboardPage from './components/DashboardPage';
import SearchPage from './components/SearchPage';
import GettingStartedPage from './components/GettingStartedPage';
import WatchlistPage from './components/WatchlistPage';
import PaperTradingPage from './components/PaperTradingPage';
import FundamentalsPage from './components/FundamentalsPage';
import PredictionsPage from './components/PredictionsPage';
import ModelPerformancePage from './components/ModelPerformancePage';
import OptionsPage from './components/OptionsPage';
import ForexPage from './components/ForexPage';
import CryptoPage from './components/CryptoPage';
import CommoditiesPage from './components/CommoditiesPage';
import NewsPage from './components/NewsPage';
import NotificationsPage from './components/NotificationsPage';
import PredictionMarketsPage from './components/PredictionMarketsPage';
import MarketCalendarPage from './components/MarketCalendarPage';
import ScreenerPage from './components/ScreenerPage';
import MacroPage from './components/MacroPage';

const LANDING_VISIBILITY_KEY = 'marketmind.hideLanding';

const shouldHideLandingByDefault = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.localStorage.getItem(LANDING_VISIBILITY_KEY) === 'true';
};

function App() {
    const { isLoaded, isSignedIn } = useAuth();
    const [showLanding, setShowLanding] = useState(() => !shouldHideLandingByDefault());
    const [activePage, setActivePage] = useState('dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sharedTicker, setSharedTicker] = useState(null);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(LANDING_VISIBILITY_KEY, 'true');
        setShowLanding(false);
    }, [isLoaded, isSignedIn]);

    const handleScreenerNav = (ticker) => {
        setSharedTicker(ticker);
        setActivePage('search');
    };

    const handleEnterApp = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(LANDING_VISIBILITY_KEY, 'true');
        }
        setShowLanding(false);
    };

    const handleReturnToLanding = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(LANDING_VISIBILITY_KEY);
        }
        setShowLanding(true);
    };

    if (showLanding && !(isLoaded && isSignedIn)) {
        return <LandingPage onEnterApp={handleEnterApp} />;
    }

    return (
        <>
            <AuthFetchBridge />
            <SignedOut>
                <AuthPage onBack={handleReturnToLanding} />
            </SignedOut>

            <SignedIn>
                <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden font-sans">
                    <style>{`
                        @keyframes fade-in {
                            from { opacity: 0; transform: translateY(10px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                    `}</style>

                    <Sidebar
                        activePage={activePage}
                        setActivePage={setActivePage}
                        isCollapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
                    />

                    <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
                        {activePage === 'dashboard' && <DashboardPage setActivePage={setActivePage} />}
                        {activePage === 'search' && <SearchPage initialTicker={sharedTicker} onClearInitialTicker={() => setSharedTicker(null)} />}
                        {activePage === 'screener' && <ScreenerPage onSearchTicker={handleScreenerNav} />}
                        {activePage === 'macro' && <MacroPage />}
                        {activePage === 'watchlist' && <WatchlistPage />}
                        {activePage === 'portfolio' && <PaperTradingPage />}
                        {activePage === 'fundamentals' && <FundamentalsPage />}
                        {activePage === 'predictions' && <PredictionsPage />}
                        {activePage === 'performance' && <ModelPerformancePage />}
                        {activePage === 'options' && <OptionsPage />}
                        {activePage === 'forex' && <ForexPage />}
                        {activePage === 'crypto' && <CryptoPage />}
                        {activePage === 'commodities' && <CommoditiesPage />}
                        {activePage === 'news' && <NewsPage />}
                        {activePage === 'notifications' && <NotificationsPage />}
                        {activePage === 'predictionMarkets' && <PredictionMarketsPage />}
                        {activePage === 'gettingStarted' && <GettingStartedPage />}
                        {activePage === 'calendar' && <MarketCalendarPage />}
                    </main>
                </div>
            </SignedIn>
        </>
    );
}

export default App;
