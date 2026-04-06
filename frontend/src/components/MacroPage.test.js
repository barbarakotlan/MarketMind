import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MacroPage from './MacroPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        MACRO_OVERVIEW: (region = 'us') => region === 'asia' ? '/macro/overview?region=asia' : '/macro/overview',
        ECONOMIC_CALENDAR: '/calendar/economic',
    },
    apiRequest: jest.fn(),
}));

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

const calendarPayload = [
    {
        id: 1,
        date: '2099-04-01',
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

describe('MacroPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders restored macro indicators and the next macro events panel', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.MACRO_OVERVIEW()) {
                return Promise.resolve(macroPayload);
            }
            if (url === API_ENDPOINTS.ECONOMIC_CALENDAR) {
                return Promise.resolve(calendarPayload);
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        render(<MacroPage />);

        expect(await screen.findByText('Unemployment Rate')).toBeInTheDocument();
        expect(screen.getByText('10-Year Treasury Yield')).toBeInTheDocument();
        expect(screen.getByText('Next Macro Events')).toBeInTheDocument();
        expect(screen.getByText('Non-Farm Payrolls')).toBeInTheDocument();
        expect(screen.getByText('Fed Chair Speaks')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Unemployment Rate'));

        await waitFor(() => {
            expect(screen.getByText('Unemployment Rate — Recent History')).toBeInTheDocument();
        });
    });

    test('keeps macro cards visible when the calendar preview fails', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.MACRO_OVERVIEW()) {
                return Promise.resolve(macroPayload);
            }
            if (url === API_ENDPOINTS.ECONOMIC_CALENDAR) {
                return Promise.reject(new Error('calendar down'));
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        render(<MacroPage />);

        expect(await screen.findByText('Unemployment Rate')).toBeInTheDocument();
        expect(screen.getByText('Economic calendar is temporarily unavailable.')).toBeInTheDocument();
    });

    test('switches into the Asia macro lane and renders Akshare market signals', async () => {
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

        render(<MacroPage />);

        expect(await screen.findByText('Unemployment Rate')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Asia' }));

        expect(await screen.findByText('China CPI YoY')).toBeInTheDocument();
        expect(screen.getByText('Asia Market Signals')).toBeInTheDocument();
        expect(screen.getByText('USD/CNH')).toBeInTheDocument();
        expect(screen.getByText('Copper')).toBeInTheDocument();
        expect(screen.queryByText('Next Macro Events')).not.toBeInTheDocument();
    });
});
