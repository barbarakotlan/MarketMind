import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

let mockIsSignedIn = false;
let mockIsLoaded = true;

jest.mock('react-markdown', () => ({ children }) => <div>{children}</div>);
jest.mock('remark-gfm', () => () => null);

jest.mock('@clerk/clerk-react', () => ({
    SignedIn: ({ children }) => (mockIsSignedIn ? children : null),
    SignedOut: ({ children }) => (mockIsSignedIn ? null : children),
    useAuth: () => ({
        isLoaded: mockIsLoaded,
        isSignedIn: mockIsSignedIn,
    }),
    useUser: () => ({
        user: null,
    }),
}));

jest.mock('./components/LandingPage', () => ({ onEnterApp }) => (
    <div>
        <p>Landing Page</p>
        <button onClick={onEnterApp}>Enter App</button>
    </div>
));

jest.mock('./components/AuthPage', () => ({ onBack }) => (
    <div>
        <p>Auth Page</p>
        <button onClick={onBack}>Back</button>
    </div>
));

jest.mock('./components/AuthFetchBridge', () => () => <div data-testid="auth-fetch-bridge" />);

jest.mock('./components/Sidebar', () => ({ setActivePage }) => (
    <div>
        <p>Sidebar</p>
        <button onClick={() => setActivePage('dashboard')}>Go Dashboard</button>
        <button onClick={() => setActivePage('screener')}>Go Screener</button>
        <button onClick={() => setActivePage('search')}>Go Search</button>
    </div>
));

jest.mock('./components/PlanPage', () => () => <div>Plan Page</div>);
jest.mock('./components/DashboardPage', () => () => <div>Dashboard Page</div>);
jest.mock('./components/GettingStartedPage', () => () => <div>Getting Started Page</div>);
jest.mock('./components/WatchlistPage', () => () => <div>Watchlist Page</div>);
jest.mock('./components/PaperTradingPage', () => () => <div>Portfolio Page</div>);
jest.mock('./components/FundamentalsPage', () => () => <div>Fundamentals Page</div>);
jest.mock('./components/PredictionsPage', () => () => <div>Predictions Page</div>);
jest.mock('./components/ModelPerformancePage', () => () => <div>Model Performance Page</div>);
jest.mock('./components/OptionsPage', () => () => <div>Options Page</div>);
jest.mock('./components/ForexPage', () => () => <div>Forex Page</div>);
jest.mock('./components/CryptoPage', () => () => <div>Crypto Page</div>);
jest.mock('./components/CommoditiesPage', () => () => <div>Commodities Page</div>);
jest.mock('./components/NewsPage', () => () => <div>News Page</div>);
jest.mock('./components/NotificationsPage', () => () => <div>Notifications Page</div>);
jest.mock('./components/PredictionMarketsPage', () => () => <div>Prediction Markets Page</div>);
jest.mock('./components/MarketCalendarPage', () => () => <div>Market Calendar Page</div>);
jest.mock('./components/MacroPage', () => () => <div>Macro Page</div>);
jest.mock('./components/CheckoutPage', () => () => <div>Checkout Page</div>);
jest.mock('./components/MarketMindAIPage', () => () => <div>MarketMindAI Page</div>);

jest.mock('./components/ScreenerPage', () => ({ onSearchTicker }) => (
    <div>
        <p>Screener Page</p>
        <button onClick={() => onSearchTicker('AAPL')}>Pick AAPL</button>
    </div>
));

jest.mock('./components/SearchPage', () => ({ initialTicker }) => (
    <div>Search Page {initialTicker ? `for ${initialTicker}` : ''}</div>
));

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

    test('shows the signed-in shell on the screener front door when signed in', () => {
        mockIsSignedIn = true;
        render(<App />);

        expect(screen.getByText('Sidebar')).toBeInTheDocument();
        expect(screen.getByText('Screener Page')).toBeInTheDocument();
    });

    test('routes screener selections into the search page ticker state', () => {
        mockIsSignedIn = true;
        render(<App />);

        fireEvent.click(screen.getByText('Go Screener'));
        fireEvent.click(screen.getByText('Pick AAPL'));

        expect(screen.getByText('Search Page for AAPL')).toBeInTheDocument();
    });

    test('skips the landing page for signed-in users on refresh', () => {
        mockIsSignedIn = true;

        render(<App />);

        expect(screen.queryByText('Landing Page')).not.toBeInTheDocument();
        expect(screen.getByText('Sidebar')).toBeInTheDocument();
        expect(screen.getByText('Screener Page')).toBeInTheDocument();
    });

    test('persists app entry so refresh stays in the app shell', () => {
        render(<App />);

        fireEvent.click(screen.getByText('Enter App'));

        expect(window.localStorage.getItem('marketmind.hideLanding')).toBe('true');
    });
});
