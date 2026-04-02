import { fireEvent, render, screen } from '@testing-library/react';
import MarketCalendarPage from './MarketCalendarPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        ECONOMIC_CALENDAR: '/calendar/economic',
        MARKET_SESSIONS_CALENDAR: (market = 'us', days = 14) => `/calendar/market-sessions?market=${market}&days=${days}`,
    },
    apiRequest: jest.fn(),
}));

describe('MarketCalendarPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('switches into the market sessions view and renders HK session data', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.ECONOMIC_CALENDAR) {
                return Promise.resolve([]);
            }
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
            if (url === API_ENDPOINTS.MARKET_SESSIONS_CALENDAR('hk', 14)) {
                return Promise.resolve({
                    market: 'HK',
                    marketLabel: 'Hong Kong',
                    exchange: 'HKEX',
                    timezone: 'Asia/Hong_Kong',
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
            throw new Error(`Unhandled API request: ${url}`);
        });

        render(<MarketCalendarPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Market Sessions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'HK' }));

        expect(await screen.findByText('Hong Kong session today')).toBeInTheDocument();
        expect(screen.getByText('Lunch Break')).toBeInTheDocument();
        expect(screen.getByText(/Reopens at/i)).toBeInTheDocument();
        expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument();
        expect(screen.getByText('2026-04-06')).toBeInTheDocument();
    });
});
