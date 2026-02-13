import React, { useState } from 'react';
import Header from './components/Header';
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

// 1. Import the new page
import NotificationsPage from './components/NotificationsPage';

function App() {
    const [activePage, setActivePage] = useState('search');

    // This state is just to pass down the clear function
    const [alertsToClear, setAlertsToClear] = useState(0);

    const handleClearAlerts = () => {
        // The header handles polling, this is just to pass the function down
        setAlertsToClear(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
            {/* Animation styles */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>

            <Header activePage={activePage} setActivePage={setActivePage} />

            <main>
                {/* 2. Add the rendering logic for all your pages */}
                {activePage === 'search' && <SearchPage />}
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

                {/* --- THIS IS THE NEW PAGE --- */}
                {activePage === 'notifications' && <NotificationsPage onClearAlerts={handleClearAlerts} />}

                {activePage === 'gettingStarted' && <GettingStartedPage />}
            </main>
        </div>
    );
}

export default App;