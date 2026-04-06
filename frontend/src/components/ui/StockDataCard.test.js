import { render, screen } from '@testing-library/react';
import StockDataCard from './StockDataCard';

describe('StockDataCard', () => {
    test('renders market session status and timing context when available', () => {
        render(
            <StockDataCard
                data={{
                    symbol: '00700',
                    companyName: 'Tencent Holdings',
                    market: 'HK',
                    exchange: 'HKEX',
                    currency: 'HKD',
                    price: 320.5,
                    change: 4.8,
                    changePercent: 1.52,
                    marketCap: 'N/A',
                    fundamentals: {},
                    marketSession: {
                        status: 'break',
                        exchange: 'HKEX',
                        timezone: 'Asia/Hong_Kong',
                        closesAt: '2026-04-02T16:00:00+08:00',
                        nextOpen: '2026-04-02T13:00:00+08:00',
                        reason: 'lunch_break',
                    },
                }}
                onAddToWatchlist={jest.fn()}
                canAddToWatchlist={false}
            />
        );

        expect(screen.getByText('Lunch Break')).toBeInTheDocument();
        expect(screen.getByText(/Hong Kong/i)).toBeInTheDocument();
        expect(screen.getByText(/Reopens at/i)).toBeInTheDocument();
    });
});
