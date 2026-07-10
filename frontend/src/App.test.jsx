import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

let mockIsSignedIn = false;
let mockIsLoaded = true;

vi.mock('react-markdown', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('remark-gfm', () => ({ default: () => null }));

vi.mock('./auth', () => ({
    SignedIn: ({ children }) => (mockIsSignedIn ? children : null),
    SignedOut: ({ children }) => (mockIsSignedIn ? null : children),
    useAuth: () => ({
        isLoaded: mockIsLoaded,
        isSignedIn: mockIsSignedIn,
    }),
}));

vi.mock('./components/LandingPage', () => ({
    default: ({ onEnterApp }) => (
        <div>
            <p>Landing Page</p>
            <button onClick={onEnterApp}>Enter App</button>
        </div>
    ),
}));

vi.mock('./components/AuthPage', () => ({
    default: ({ onBack }) => (
        <div>
            <p>Auth Page</p>
            <button onClick={onBack}>Back</button>
        </div>
    ),
}));

vi.mock('./components/AuthFetchBridge', () => ({
    default: () => <div data-testid="auth-fetch-bridge" />,
}));

vi.mock('./components/Sidebar', async () => {
    const { useNavigation } = await vi.importActual('./context/NavigationContext');
    return { default: function SidebarMock() {
        const { setActivePage } = useNavigation();
        return (
            <div>
                <p>Sidebar</p>
                <button onClick={() => setActivePage('dashboard')}>Go Dashboard</button>
                <button onClick={() => setActivePage('screener')}>Go Screener</button>
                <button onClick={() => setActivePage('search')}>Go Search</button>
            </div>
        );
    } };
});

vi.mock('./components/DashboardPage', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('./components/GettingStartedPage', () => ({ default: () => <div>Getting Started Page</div> }));
vi.mock('./components/WatchlistPage', () => ({ default: () => <div>Watchlist Page</div> }));
vi.mock('./components/PaperTradingPage', () => ({ default: () => <div>Portfolio Page</div> }));
vi.mock('./components/FundamentalsPage', () => ({ default: () => <div>Fundamentals Page</div> }));
vi.mock('./components/PredictionsPage', () => ({ default: () => <div>Predictions Page</div> }));
vi.mock('./components/ModelPerformancePage', () => ({ default: () => <div>Model Performance Page</div> }));
vi.mock('./components/OptionsPage', () => ({ default: () => <div>Options Page</div> }));
vi.mock('./components/ForexPage', () => ({ default: () => <div>Forex Page</div> }));
vi.mock('./components/CryptoPage', () => ({ default: () => <div>Crypto Page</div> }));
vi.mock('./components/CommoditiesPage', () => ({ default: () => <div>Commodities Page</div> }));
vi.mock('./components/NewsPage', () => ({ default: () => <div>News Page</div> }));
vi.mock('./components/NotificationsPage', () => ({ default: () => <div>Notifications Page</div> }));
vi.mock('./components/PredictionMarketsPage', () => ({ default: () => <div>Prediction Markets Page</div> }));
vi.mock('./components/MarketCalendarPage', () => ({ default: () => <div>Market Calendar Page</div> }));
vi.mock('./components/MacroPage', () => ({ default: () => <div>Macro Page</div> }));
vi.mock('./components/MarketMindAIPage', () => ({ default: () => <div>MarketMindAI Page</div> }));

vi.mock('./components/ScreenerPage', async () => {
    const { useNavigation } = await vi.importActual('./context/NavigationContext');
    return { default: function ScreenerMock() {
        const { screenerNav } = useNavigation();
        return (
            <div>
                <p>Screener Page</p>
                <button onClick={() => screenerNav('AAPL')}>Pick AAPL</button>
            </div>
        );
    } };
});

vi.mock('./components/SearchPage', async () => {
    const { useNavigation } = await vi.importActual('./context/NavigationContext');
    return { default: function SearchMock() {
        const { sharedTicker } = useNavigation();
        return <div>Search Page {sharedTicker ? `for ${sharedTicker}` : ''}</div>;
    } };
});

describe('App', () => {
    beforeEach(() => {
        mockIsSignedIn = false;
        mockIsLoaded = true;
        window.localStorage.clear();
    });

    test('shows the landing page first', () => {
        render(<App />);

        expect(screen.getByText('Landing Page')).toBeInTheDocument();
    });

    test('shows the auth page after entering the app when signed out', () => {
        render(<App />);

        fireEvent.click(screen.getByText('Enter App'));

        expect(screen.getByText('Auth Page')).toBeInTheDocument();
        expect(screen.getByTestId('auth-fetch-bridge')).toBeInTheDocument();
    });

    test('shows the signed-in shell on the screener front door when signed in', async () => {
        mockIsSignedIn = true;
        render(<App />);

        expect(screen.getByText('Sidebar')).toBeInTheDocument();
        expect(await screen.findByText('Screener Page')).toBeInTheDocument();
    });

    test('routes screener selections into the search page ticker state', async () => {
        mockIsSignedIn = true;
        render(<App />);

        fireEvent.click(screen.getByText('Go Screener'));
        fireEvent.click(await screen.findByText('Pick AAPL'));

        expect(await screen.findByText('Search Page for AAPL')).toBeInTheDocument();
    });

    test('skips the landing page for signed-in users on refresh', async () => {
        mockIsSignedIn = true;

        render(<App />);

        expect(screen.queryByText('Landing Page')).not.toBeInTheDocument();
        expect(screen.getByText('Sidebar')).toBeInTheDocument();
        expect(await screen.findByText('Screener Page')).toBeInTheDocument();
    });

    test('renders a signed-in deep link without resetting it to the screener', async () => {
        mockIsSignedIn = true;

        render(
            <MemoryRouter
                initialEntries={['/fundamentals']}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <App />
            </MemoryRouter>
        );

        expect(await screen.findByText('Fundamentals Page')).toBeInTheDocument();
    });

    test('persists app entry so refresh stays in the app shell', () => {
        render(<App />);

        fireEvent.click(screen.getByText('Enter App'));

        expect(window.localStorage.getItem('marketmind.hideLanding')).toBe('true');
    });
});
