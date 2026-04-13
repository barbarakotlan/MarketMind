import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScreenerPage from './ScreenerPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('../config/api', () => {
    const actual = jest.requireActual('../config/api');
    return {
        ...actual,
        apiRequest: jest.fn(),
    };
});

const presetsPayload = {
    presets: [
        { key: 'gainers', label: 'Top Gainers', description: 'Daily movers', defaultSort: 'percent_change', defaultDir: 'desc' },
        { key: 'losers', label: 'Top Losers', description: 'Daily decliners', defaultSort: 'percent_change', defaultDir: 'asc' },
        { key: 'active', label: 'Most Active', description: 'Relative volume leaders', defaultSort: 'relative_volume_20d', defaultDir: 'desc' },
        { key: 'momentum_leaders', label: 'Momentum Leaders', description: 'Positive 3M trend', defaultSort: 'momentum_3m', defaultDir: 'desc' },
    ],
    sectors: ['Technology', 'Financials'],
};

const gainersPayload = {
    rows: [
        {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            price: 210.5,
            percent_change: 0.021,
            market_cap: 3100000000000,
            avg_dollar_volume_30d: 9500000000,
            relative_volume_20d: 1.18,
            momentum_3m: 0.12,
            pe_forward: 28.1,
            year_high: 220.0,
            year_low: 165.0,
            sector: 'Technology',
        },
    ],
    meta: {
        total: 1,
        limit: 25,
        offset: 0,
        lastRefresh: '2026-04-03T13:00:00+00:00',
        snapshotStatus: 'fresh',
        warnings: [],
    },
    filters: {
        availableSectors: ['Technology', 'Financials'],
    },
};

const momentumPayload = {
    rows: [
        {
            symbol: 'MSFT',
            name: 'Microsoft Corporation',
            price: 425.2,
            percent_change: 0.014,
            market_cap: 3200000000000,
            avg_dollar_volume_30d: 8700000000,
            relative_volume_20d: 1.09,
            momentum_3m: 0.16,
            pe_forward: 31.4,
            year_high: 430.0,
            year_low: 330.0,
            sector: 'Technology',
        },
    ],
    meta: {
        total: 1,
        limit: 25,
        offset: 0,
        lastRefresh: '2026-04-03T13:00:00+00:00',
        snapshotStatus: 'stale',
        warnings: ['Showing the last good screener snapshot while fresh data reloads.'],
    },
    filters: {
        availableSectors: ['Technology', 'Financials'],
    },
};

describe('ScreenerPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders presets, scan results, and routes row clicks into Search', async () => {
        const onSearchTicker = jest.fn();
        const onScreenerAction = jest.fn();
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.SCREENER_PRESETS) {
                return Promise.resolve(presetsPayload);
            }
            if (url.includes('/screener/scan?preset=gainers')) {
                return Promise.resolve(gainersPayload);
            }
            if (url.includes('/screener/scan?preset=momentum_leaders')) {
                return Promise.resolve(momentumPayload);
            }
            if (url.includes('/watchlist/AAPL')) {
                return Promise.resolve({ message: 'AAPL added to watchlist.' });
            }
            throw new Error(`Unhandled request: ${url}`);
        });

        render(<ScreenerPage onSearchTicker={onSearchTicker} onScreenerAction={onScreenerAction} />);

        expect(await screen.findByText('Apple Inc.')).toBeInTheDocument();
        expect(screen.getByText('Momentum Leaders')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Apple Inc.'));
        expect(onSearchTicker).toHaveBeenCalledWith('AAPL');

        fireEvent.click(screen.getByRole('button', { name: 'Predict' }));
        expect(onScreenerAction).toHaveBeenCalledWith(expect.objectContaining({
            action: 'predictions',
            ticker: 'AAPL',
        }));

        fireEvent.click(screen.getByRole('button', { name: 'Watchlist' }));
        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('/watchlist/AAPL'), { method: 'POST' });
        });
        expect(await screen.findByText('AAPL added to watchlist.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
        expect(await screen.findByText(/AAPL set as compare base/i)).toBeInTheDocument();

        fireEvent.click(screen.getByText('Momentum Leaders'));

        expect(await screen.findByText('Microsoft Corporation')).toBeInTheDocument();
        expect(screen.getAllByText('Showing the last good screener snapshot while fresh data reloads.').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
        expect(onScreenerAction).toHaveBeenCalledWith(expect.objectContaining({
            action: 'compare',
            ticker: 'AAPL',
            compareTicker: 'MSFT',
        }));
    });

    test('applies screener filters through the scan endpoint', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.SCREENER_PRESETS) {
                return Promise.resolve(presetsPayload);
            }
            if (url.includes('/screener/scan?preset=gainers')) {
                return Promise.resolve(gainersPayload);
            }
            throw new Error(`Unhandled request: ${url}`);
        });

        render(<ScreenerPage />);

        await screen.findByText('Apple Inc.');

        fireEvent.change(screen.getByPlaceholderText('Min market cap'), { target: { value: '1000000000' } });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Technology' } });
        fireEvent.click(screen.getByText('Apply Filters'));

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith(
                expect.stringContaining('market_cap_min=1000000000'),
            );
        });
        expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('sector=Technology'));
    });
});
