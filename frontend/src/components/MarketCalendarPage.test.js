import { fireEvent, render, screen } from '@testing-library/react';
import MarketCalendarPage from './MarketCalendarPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// --- MOCKING ---
// We mock the API endpoints and the request function to prevent the test 
// from making real network calls. This ensures tests run quickly, 
// predictably, and independently of backend server status.
jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        ECONOMIC_CALENDAR: '/calendar/economic',
        MARKET_SESSIONS_CALENDAR: (market = 'us', days = 14) => `/calendar/market-sessions?market=${market}&days=${days}`,
    },
    apiRequest: jest.fn(), // Creates a mock function we can track and control
}));

describe('MarketCalendarPage', () => {
    // --- TEARDOWN ---
    // Clears the mock call history after each test so previous test runs 
    // don't interfere with the mock's state in subsequent tests.
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('switches into the market sessions view and renders HK session data', async () => {
        // --- ARRANGE (Setup Mock Responses) ---
        // Intercept API calls and return specific mock data based on the URL requested.
        apiRequest.mockImplementation((url) => {
            // 1. Initial component mount always fetches economic data first
            if (url === API_ENDPOINTS.ECONOMIC_CALENDAR) {
                return Promise.resolve([]);
            }
            
            // 2. When switching to the "sessions" tab, it defaults to 'US'
            if (url === API_ENDPOINTS.MARKET_SESSIONS_CALENDAR('us', 14)) {
                return Promise.resolve({
                    market: 'US',
                    marketLabel: 'United States',
                    exchange: 'US',
                    timezone: 'America/New_York',
                    today: {
                        status: 'open',
                        exchange: 'US',
                        timezone: 'America/New_York',
                        closesAt: '2026-04-02T16:00:00-04:00',
                    },
                    sessions: [],
                    upcomingHolidays: [],
                    specialSessions: [],
                });
            }
            
            // 3. When the user explicitly clicks the 'HK' chip, return Hong Kong data
            if (url === API_ENDPOINTS.MARKET_SESSIONS_CALENDAR('hk', 14)) {
                return Promise.resolve({
                    market: 'HK',
                    marketLabel: 'Hong Kong',
                    exchange: 'HKEX',
                    timezone: 'Asia/Hong_Kong',
                    // Testing a specific market state: "Lunch Break"
                    today: {
                        status: 'break',
                        exchange: 'HKEX',
                        timezone: 'Asia/Hong_Kong',
                        closesAt: '2026-04-02T16:00:00+08:00',
                        nextOpen: '2026-04-02T13:00:00+08:00',
                        reason: 'lunch_break',
                    },
                    sessions: [
                        {
                            market: 'HK',
                            sessionDate: '2026-04-02',
                            opensAt: '2026-04-02T09:30:00+08:00',
                            closesAt: '2026-04-02T16:00:00+08:00',
                            breakStart: '2026-04-02T12:00:00+08:00',
                            breakEnd: '2026-04-02T13:00:00+08:00',
                            hasBreak: true,
                            isEarlyClose: false,
                            exchange: 'HKEX',
                            timezone: 'Asia/Hong_Kong',
                        },
                    ],
                    upcomingHolidays: [{ date: '2026-04-06', label: 'Market holiday' }],
                    specialSessions: [],
                });
            }
            // Fail-safe to catch unexpected network requests during the test
            throw new Error(`Unhandled API request: ${url}`);
        });

        // Render the component into the virtual DOM
        render(<MarketCalendarPage />);

        // --- ACT (Simulate User Interaction) ---
        // 1. Find the 'Market Sessions' tab and click it. 
        // We use `await findByRole` because the initial render might be processing the economic fetch.
        fireEvent.click(await screen.findByRole('button', { name: 'Market Sessions' }));
        
        // 2. Find the 'HK' market filter chip and click it to trigger the HK data fetch.
        fireEvent.click(await screen.findByRole('button', { name: 'HK' }));

        // --- ASSERT (Verify UI State) ---
        // Verify that the UI correctly parsed and displayed the mocked HK payload
        
        // Checks that the main header updated to reflect the HK market
        expect(await screen.findByText('Hong Kong session today')).toBeInTheDocument();
        
        // Checks that the specific session state (Lunch Break) from `today.status` is rendered
        expect(screen.getByText('Lunch Break')).toBeInTheDocument();
        
        // Checks that the utility function properly formatted the `nextOpen` property
        expect(screen.getByText(/Reopens at/i)).toBeInTheDocument();
        
        // Checks that the sessions table/list header is rendered
        expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument();
        
        // Checks that the upcoming holiday date is correctly pulled from the payload and displayed
        expect(screen.getByText('2026-04-06')).toBeInTheDocument();
    });
});
