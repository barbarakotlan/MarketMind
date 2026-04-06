import React, { useEffect, useState } from 'react';
import { SignedIn, SignedOut, useAuth, useUser} from '@clerk/clerk-react';
import { Crown, X } from 'lucide-react';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import AuthFetchBridge from './components/AuthFetchBridge';
import Sidebar from './components/Sidebar';
import PlanPage from './components/PlanPage';
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
import CheckoutPage from './components/CheckoutPage';
import MarketMindAIPage from './components/MarketMindAIPage';

const LANDING_VISIBILITY_KEY = 'marketmind.hideLanding';

const shouldHideLandingByDefault = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.localStorage.getItem(LANDING_VISIBILITY_KEY) === 'true';
};

function App() {
    const { isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    const [showLanding, setShowLanding] = useState(() => !shouldHideLandingByDefault());
    const [activePage, setActivePage] = useState('dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sharedTicker, setSharedTicker] = useState(null);
    const [checkoutAnnual, setCheckoutAnnual] = useState(false);
    const [subscriptionNotice, setSubscriptionNotice] = useState(null);
    useEffect(() => {
        if (!isLoaded || !isSignedIn || typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(LANDING_VISIBILITY_KEY, 'true');
        setShowLanding(false);
    }, [isLoaded, isSignedIn]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleSubscriptionLimit = (event) => {
            const detail = event?.detail || {};
            setSubscriptionNotice({
                message: detail.message || 'Free limit reached. Upgrade to Pro to continue.',
                limitKey: detail.limitKey || null,
            });
        };

        window.addEventListener('marketmind:subscription-limit', handleSubscriptionLimit);
        return () => {
            window.removeEventListener('marketmind:subscription-limit', handleSubscriptionLimit);
        };
    }, []);

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

    if (!isLoaded) {
        return null;
    }

    if (showLanding && !isSignedIn) {
        return <LandingPage onEnterApp={handleEnterApp} />;
    }

    return (
        <>
            <AuthFetchBridge />
            <SignedOut>
                <AuthPage onBack={handleReturnToLanding} />
            </SignedOut>

            <SignedIn>
                <div className="app-shell flex h-screen overflow-hidden">
                    <Sidebar
                        activePage={activePage}
                        setActivePage={setActivePage}
                        isCollapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
                    />

                    <main className={`app-shell-main flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
                        {subscriptionNotice && (
                            <div className="sticky top-0 z-30 border-b border-amber-200 bg-amber-50/95 px-4 py-3 backdrop-blur dark:border-amber-900/40 dark:bg-amber-950/90">
                                <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                            <Crown className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                                Free Limit Reached
                                            </p>
                                            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                                                {subscriptionNotice.message}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSubscriptionNotice(null);
                                                setActivePage('plan');
                                            }}
                                            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                                        >
                                            Upgrade to Pro
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSubscriptionNotice(null)}
                                            className="rounded-md p-1 text-amber-700 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                                            aria-label="Dismiss upgrade notice"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activePage === 'dashboard' && <DashboardPage setActivePage={setActivePage} />}
                        {activePage === 'search' && <SearchPage initialTicker={sharedTicker} onClearInitialTicker={() => setSharedTicker(null)} />}
                        {activePage === 'screener' && <ScreenerPage onSearchTicker={handleScreenerNav} />}
                        {activePage === 'plan' && (
                            <PlanPage
                                onNavigateToCheckout={(isAnnual) => {
                                    setCheckoutAnnual(isAnnual);
                                    setActivePage('checkout');
                                }}
                            />
                        )}
                        {activePage === 'checkout' && (
                            <CheckoutPage
                                isAnnual={checkoutAnnual}
                                userEmail={user?.emailAddresses[0]?.emailAddress}
                                onBack={() => setActivePage('plans')}
                                onSuccess={() => setActivePage('dashboard')}
                            />
                        )}
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
                        {activePage === 'marketmindAI' && <MarketMindAIPage />}
                        {activePage === 'gettingStarted' && <GettingStartedPage />}
                        {activePage === 'calendar' && <MarketCalendarPage />}
                    </main>
                </div>
            </SignedIn>
        </>
    );
}

export default App;
