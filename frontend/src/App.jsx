import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from './auth';
import { NavigationProvider, PAGE_PATHS } from './context/NavigationContext';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import AuthFetchBridge from './components/AuthFetchBridge';
import Sidebar from './components/Sidebar';
import RouteErrorBoundary from './components/RouteErrorBoundary';


const DashboardPage = lazy(() => import('./components/DashboardPage'));
const SearchPage = lazy(() => import('./components/SearchPage'));
const GettingStartedPage = lazy(() => import('./components/GettingStartedPage'));
const WatchlistPage = lazy(() => import('./components/WatchlistPage'));
const PaperTradingPage = lazy(() => import('./components/PaperTradingPage'));
const FundamentalsPage = lazy(() => import('./components/FundamentalsPage'));
const PredictionsPage = lazy(() => import('./components/PredictionsPage'));
const ModelPerformancePage = lazy(() => import('./components/ModelPerformancePage'));
const OptionsPage = lazy(() => import('./components/OptionsPage'));
const ForexPage = lazy(() => import('./components/ForexPage'));
const CryptoPage = lazy(() => import('./components/CryptoPage'));
const CommoditiesPage = lazy(() => import('./components/CommoditiesPage'));
const NewsPage = lazy(() => import('./components/NewsPage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const PredictionMarketsPage = lazy(() => import('./components/PredictionMarketsPage'));
const MarketCalendarPage = lazy(() => import('./components/MarketCalendarPage'));
const ScreenerPage = lazy(() => import('./components/ScreenerPage'));
const MacroPage = lazy(() => import('./components/MacroPage'));
const MarketMindAIPage = lazy(() => import('./components/MarketMindAIPage'));

const APP_ROUTES = [
    ['dashboard', DashboardPage],
    ['search', SearchPage],
    ['screener', ScreenerPage],
    ['macro', MacroPage],
    ['watchlist', WatchlistPage],
    ['portfolio', PaperTradingPage],
    ['fundamentals', FundamentalsPage],
    ['predictions', PredictionsPage],
    ['performance', ModelPerformancePage],
    ['options', OptionsPage],
    ['forex', ForexPage],
    ['crypto', CryptoPage],
    ['commodities', CommoditiesPage],
    ['news', NewsPage],
    ['notifications', NotificationsPage],
    ['predictionMarkets', PredictionMarketsPage],
    ['marketmindAI', MarketMindAIPage],
    ['gettingStarted', GettingStartedPage],
    ['calendar', MarketCalendarPage],
];

const LANDING_VISIBILITY_KEY = 'marketmind.hideLanding';

const shouldHideLandingByDefault = () => {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.localStorage.getItem(LANDING_VISIBILITY_KEY) === 'true';
};

function RouteLoading() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading page">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-mm-border border-t-mm-accent-primary" />
        </div>
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to={PAGE_PATHS.screener} replace />} />
            {APP_ROUTES.map(([page, PageComponent]) => (
                <Route key={page} path={PAGE_PATHS[page]} element={<PageComponent />} />
            ))}
            <Route path="*" element={<Navigate to={PAGE_PATHS.screener} replace />} />
        </Routes>
    );
}

function AppShell() {
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="app-shell flex h-screen overflow-hidden">
            <Sidebar
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed((previous) => !previous)}
            />
            <main className={`app-shell-main flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
                <RouteErrorBoundary key={location.pathname}>
                    <Suspense fallback={<RouteLoading />}>
                        <AppRoutes />
                    </Suspense>
                </RouteErrorBoundary>
            </main>
        </div>
    );
}

function App() {
    const { isLoaded, isSignedIn } = useAuth();
    const [showLanding, setShowLanding] = useState(() => !shouldHideLandingByDefault());

    useEffect(() => {
        if (!isLoaded || !isSignedIn || typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(LANDING_VISIBILITY_KEY, 'true');
        setShowLanding(false);
    }, [isLoaded, isSignedIn]);

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
                <NavigationProvider>
                    <AppShell />
                </NavigationProvider>
            </SignedIn>
        </>
    );
}

export default App;
