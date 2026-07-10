import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
    MemoryRouter,
    useInRouterContext,
    useLocation,
    useNavigate,
} from 'react-router-dom';


const NavigationContext = createContext(null);

export const PAGE_PATHS = Object.freeze({
    screener: '/screener',
    dashboard: '/dashboard',
    search: '/search',
    macro: '/macro',
    watchlist: '/watchlist',
    portfolio: '/portfolio',
    fundamentals: '/fundamentals',
    predictions: '/predictions',
    performance: '/performance',
    options: '/options',
    forex: '/forex',
    crypto: '/crypto',
    commodities: '/commodities',
    news: '/news',
    notifications: '/notifications',
    predictionMarkets: '/prediction-markets',
    marketmindAI: '/marketmind-ai',
    gettingStarted: '/getting-started',
    calendar: '/calendar',
});

const PATH_PAGES = Object.freeze(
    Object.fromEntries(Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]))
);

export const pageForPath = (pathname) => {
    const normalized = pathname !== '/' ? String(pathname || '').replace(/\/+$/, '') : '/';
    return PATH_PAGES[normalized] || 'screener';
};

function RoutedNavigationProvider({ children }) {
    const location = useLocation();
    const routerNavigate = useNavigate();
    const activePage = pageForPath(location.pathname);
    const [sharedTicker, setSharedTicker] = useState(null);
    const [sharedCompareTicker, setSharedCompareTicker] = useState(null);
    const [sharedAiPrompt, setSharedAiPrompt] = useState('');

    const clearTicker = useCallback(() => setSharedTicker(null), []);
    const clearCompareTicker = useCallback(() => setSharedCompareTicker(null), []);
    const clearAiPrompt = useCallback(() => setSharedAiPrompt(''), []);

    const setActivePage = useCallback((page, options = {}) => {
        routerNavigate(PAGE_PATHS[page] || PAGE_PATHS.screener, options);
    }, [routerNavigate]);

    const navigate = useCallback((page, intent = {}) => {
        if ('ticker' in intent) setSharedTicker(intent.ticker);
        if ('compareTicker' in intent) setSharedCompareTicker(intent.compareTicker);
        if ('aiPrompt' in intent) setSharedAiPrompt(intent.aiPrompt);
        setActivePage(page);
    }, [setActivePage]);

    const screenerNav = useCallback((ticker) => {
        setSharedTicker(ticker);
        setSharedCompareTicker(null);
        setActivePage('search');
    }, [setActivePage]);

    const screenerAction = useCallback(({ action, ticker, compareTicker }) => {
        const normalizedTicker = String(ticker || '').trim().toUpperCase();
        const normalizedCompareTicker = String(compareTicker || '').trim().toUpperCase();
        if (!normalizedTicker) return;

        setSharedTicker(normalizedTicker);
        setSharedCompareTicker(null);
        setSharedAiPrompt('');

        if (action === 'predictions') {
            setActivePage('predictions');
            return;
        }
        if (action === 'fundamentals') {
            setActivePage('fundamentals');
            return;
        }
        if (action === 'paper') {
            setActivePage('portfolio');
            return;
        }
        if (action === 'ai') {
            setSharedAiPrompt(`Analyze ${normalizedTicker} from the Screener. Summarize why it surfaced, what to validate next, and what risks to check before acting.`);
            setActivePage('marketmindAI');
            return;
        }
        if (action === 'compare' && normalizedCompareTicker) {
            setSharedCompareTicker(normalizedCompareTicker);
            setActivePage('search');
            return;
        }

        setActivePage('search');
    }, [setActivePage]);

    const value = useMemo(
        () => ({
            activePage,
            activePath: location.pathname,
            setActivePage,
            navigate,
            sharedTicker,
            sharedCompareTicker,
            sharedAiPrompt,
            clearTicker,
            clearCompareTicker,
            clearAiPrompt,
            screenerNav,
            screenerAction,
        }),
        [
            activePage,
            location.pathname,
            setActivePage,
            navigate,
            sharedTicker,
            sharedCompareTicker,
            sharedAiPrompt,
            clearTicker,
            clearCompareTicker,
            clearAiPrompt,
            screenerNav,
            screenerAction,
        ]
    );

    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function NavigationProvider({ children }) {
    const inRouter = useInRouterContext();
    if (inRouter) {
        return <RoutedNavigationProvider>{children}</RoutedNavigationProvider>;
    }
    return (
        <MemoryRouter
            initialEntries={[PAGE_PATHS.screener]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <RoutedNavigationProvider>{children}</RoutedNavigationProvider>
        </MemoryRouter>
    );
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
}

export default NavigationContext;
