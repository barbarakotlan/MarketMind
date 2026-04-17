import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MacroPage from './MacroPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the API configuration and request functions to prevent actual network calls 
// during testing. This allows us to control the data returned and simulate errors.
jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        // Return different URLs based on the provided region parameter
        MACRO_OVERVIEW: (region = 'us') => region === 'asia' ? '/macro/overview?region=asia' : '/macro/overview',
        ECONOMIC_CALENDAR: '/calendar/economic',
    },
    // Replace the actual apiRequest function with a Jest mock function so we can 
    // spy on it and provide custom mock implementations per test.
    apiRequest: jest.fn(),
}));

// ============================================================================
// MOCK DATA PAYLOADS
// ============================================================================

// Standard US macroeconomic data response
const macroPayload = [
    {
        symbol: 'URATE',
        name: 'Unemployment Rate',
        unit: '%',
        value: 4.2,
        prev: 4.1,
        date: '2026-02-01',
        sparkline: [
            { date: '2026-01-01', value: 4.1 },
            { date: '2026-02-01', value: 4.2 },
        ],
    },
    {
        symbol: 'TNX',
        name: '10-Year Treasury Yield',
        unit: '%',
        value: 4.34,
        prev: 4.29,
        date: '2026-03-01',
        sparkline: [
            { date: '2026-02-01', value: 4.29 },
            { date: '2026-03-01', value: 4.34 },
        ],
    },
];

// Standard US economic calendar events response
const calendarPayload = [
    {
        id: 1,
        date: '2099-04-01', // Future date ensures it shows up as "upcoming" in the UI logic
        time: '8:30 AM',
        type: 'report',
        event: 'Non-Farm Payrolls',
        impact: 'High',
        actual: '-',
        forecast: '190K',
        previous: '175K',
    },
    {
        id: 2,
        date: '2099-04-02',
        time: '2:00 PM',
        type: 'speaker',
        event: 'Fed Chair Speaks',
        impact: 'Medium',
        actual: '-',
        forecast: '-',
        previous: '-',
    },
];

// Asia-specific macroeconomic data response (Note the different structure 
// containing top-level metadata, indicators, and marketSignals)
const asiaMacroPayload = {
    region: 'asia',
    title: 'Asia Macro Dashboard',
    description: 'China and Hong Kong macro indicators with selected FX and commodity signals.',
    sourceNote: 'Data via Akshare',
    indicators: [
        {
            symbol: 'CN_CPI',
            name: 'China CPI YoY',
            unit: '%',
            value: 0.7,
            prev: 0.5,
            date: '2026-02-01',
            sparkline: [
                { date: '2026-01-01', value: 0.5 },
                { date: '2026-02-01', value: 0.7 },
            ],
        },
        {
            symbol: 'HK_URATE',
            name: 'Hong Kong Unemployment Rate',
            unit: '%',
            value: 3.1,
            prev: 3.2,
            date: '2026-02-18',
            sparkline: [
                { date: '2026-01-18', value: 3.2 },
                { date: '2026-02-18', value: 3.1 },
            ],
        },
    ],
    marketSignals: [
        {
            symbol: 'USDCNH',
            name: 'USD/CNH',
            category: 'FX',
            value: 7.2145,
            changePercent: 0.22,
            date: '2026-04-02',
        },
        {
            symbol: 'COPPER',
            name: 'Copper',
            category: 'Commodity',
            value: 4.58,
            changePercent: -0.84,
            date: '2026-04-02',
        },
    ],
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('MacroPage', () => {
    // Clean up mock usage data after every test to prevent state leakage
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders restored macro indicators and the next macro events panel', async () => {
        // Arrange: Setup mock API to successfully return US data and Calendar data
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.MACRO_OVERVIEW()) {
                return Promise.resolve(macroPayload);
            }
            if (url === API_ENDPOINTS.ECONOMIC_CALENDAR) {
                return Promise.resolve(calendarPayload);
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        // Act: Render the component
        render(<MacroPage />);

        // Assert: Verify core US elements rendered correctly
        // We use findByText for the first element to wait for the async API load to resolve
        expect(await screen.findByText('Unemployment Rate')).toBeInTheDocument();
        expect(screen.getByText('10-Year Treasury Yield')).toBeInTheDocument();
        
        // Assert: Verify calendar events rendered correctly
        expect(screen.getByText('Next Macro Events')).toBeInTheDocument();
        expect(screen.getByText('Non-Farm Payrolls')).toBeInTheDocument();
        expect(screen.getByText('Fed Chair Speaks')).toBeInTheDocument();

        // Act: Simulate a user clicking the Unemployment Rate card
        fireEvent.click(screen.getByText('Unemployment Rate'));

        // Assert: Verify the expanded History Table appears after clicking
        await waitFor(() => {
            expect(screen.getByText('Unemployment Rate — Recent History')).toBeInTheDocument();
        });
    });

    test('keeps macro cards visible when the calendar preview fails', async () => {
        // Arrange: Setup mock API where Macro data succeeds, but Calendar data fails
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.MACRO_OVERVIEW()) {
                return Promise.resolve(macroPayload);
            }
            if (url === API_ENDPOINTS.ECONOMIC_CALENDAR) {
                return Promise.reject(new Error('calendar down'));
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        // Act: Render the component
        render(<MacroPage />);

        // Assert: Verify macro cards still render despite the secondary API failing
        expect(await screen.findByText('Unemployment Rate')).toBeInTheDocument();
        
        // Assert: Verify the fallback error message for the calendar panel is shown
        expect(screen.getByText('Economic calendar is temporarily unavailable.')).toBeInTheDocument();
    });

    test('switches into the Asia macro lane and renders Akshare market signals', async () => {
        // Arrange: Setup mock API to handle both US and Asia requests
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.MACRO_OVERVIEW()) {
                return Promise.resolve(macroPayload);
            }
            if (url === API_ENDPOINTS.MACRO_OVERVIEW('asia')) {
                return Promise.resolve(asiaMacroPayload);
            }
            if (url === API_ENDPOINTS.ECONOMIC_CALENDAR) {
                return Promise.resolve(calendarPayload);
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        // Act: Render component (defaults to US view initially)
        render(<MacroPage />);

        // Wait for initial US data to load
        expect(await screen.findByText('Unemployment Rate')).toBeInTheDocument();

        // Act: Simulate user clicking the "Asia" region toggle button
        fireEvent.click(screen.getByRole('button', { name: 'Asia' }));

        // Assert: Verify UI swaps to Asia data
        expect(await screen.findByText('China CPI YoY')).toBeInTheDocument();
        expect(screen.getByText('Asia Market Signals')).toBeInTheDocument();
        expect(screen.getByText('USD/CNH')).toBeInTheDocument();
        expect(screen.getByText('Copper')).toBeInTheDocument();
        
        // Assert: Verify US-only elements (like the economic calendar) are hidden
        expect(screen.queryByText('Next Macro Events')).not.toBeInTheDocument();
    });
});
