import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import NavigationContext from '../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const renderDashboard = () =>
    render(
        <NavigationContext.Provider value={{ setActivePage: () => {} }}>
            <DashboardPage />
        </NavigationContext.Provider>
    );

vi.mock('../config/api', () => ({
    API_ENDPOINTS: {
        PORTFOLIO: 'http://localhost:5001/paper/portfolio',
        NEWS: () => 'http://localhost:5001/api/news',
        NOTIFICATIONS_TRIGGERED: (all = false) =>
            all
                ? 'http://localhost:5001/notifications/triggered?all=true'
                : 'http://localhost:5001/notifications/triggered',
        STOCK: (ticker) => `http://localhost:5001/stock/${ticker}`,
    },
    apiRequest: vi.fn(),
}));

const mockApiRequest = apiRequest;

describe('DashboardPage portfolio summary', () => {
    beforeEach(() => {
        mockApiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.PORTFOLIO) {
                return Promise.resolve({
                    cash: 99500,
                    total_value: 100250,
                    total_pl: 250,
                    positions: [],
                    options_positions: [{ ticker: 'AAPL250117C00100000' }],
                });
            }

            if (url.startsWith('http://localhost:5001/stock/')) {
                return Promise.resolve({
                    price: 100,
                    changePercent: 1.23,
                });
            }

            if (url === API_ENDPOINTS.NOTIFICATIONS_TRIGGERED(true)) {
                return Promise.resolve([]);
            }

            if (url.startsWith('http://localhost:5001/api/news')) {
                return Promise.resolve([]);
            }

            return Promise.resolve([]);
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test('treats options positions as active positions in the portfolio summary card', async () => {
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText('$100,250.00')).toBeInTheDocument();
        });

        expect(screen.queryByText('No active positions')).not.toBeInTheDocument();
        expect(screen.getByText(/P&L/)).toBeInTheDocument();
    });

    test('shows the empty state when there are no stock or options positions', async () => {
        mockApiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.PORTFOLIO) {
                return Promise.resolve({
                    cash: 100000,
                    total_value: 100000,
                    total_pl: 0,
                    positions: [],
                    options_positions: [],
                });
            }

            if (url.startsWith('http://localhost:5001/stock/')) {
                return Promise.resolve({
                    price: 100,
                    changePercent: 1.23,
                });
            }

            if (url === API_ENDPOINTS.NOTIFICATIONS_TRIGGERED(true)) {
                return Promise.resolve([]);
            }

            if (url.startsWith('http://localhost:5001/api/news')) {
                return Promise.resolve([]);
            }

            return Promise.resolve([]);
        });

        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText('No active positions')).toBeInTheDocument();
        });
    });
});
