import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommoditiesPage from './CommoditiesPage';
import CryptoPage from './CryptoPage';
import ForexPage from './ForexPage';
import OptionsPage from './OptionsPage';
import WatchlistPage from './WatchlistPage';
import { apiRequest } from '../config/api';

vi.mock('./charts/StockChart', () => ({
    default: ({ ticker }) => <div data-testid="stock-chart">{ticker}</div>,
}));

vi.mock('../config/api', () => ({
    API_ENDPOINTS: {
        CHART: (ticker, period) => `chart:${ticker}:${period}`,
        COMMODITIES_LIST: 'commodities:list',
        COMMODITIES_PRICE: (code) => `commodities:price:${code}`,
        CRYPTO_CONVERT: (from, to) => `crypto:convert:${from}:${to}`,
        CRYPTO_CURRENCIES: 'crypto:currencies',
        CRYPTO_LIST: 'crypto:list',
        FOREX_CONVERT: (from, to) => `forex:convert:${from}:${to}`,
        FOREX_CURRENCIES: 'forex:currencies',
        OPTIONS: (ticker) => `options:${ticker}`,
        OPTIONS_CHAIN: (ticker, date) => `options:chain:${ticker}:${date}`,
        OPTIONS_SUGGEST: (ticker) => `options:suggest:${ticker}`,
        PAPER_OPTIONS_BUY: 'paper:options:buy',
        PAPER_OPTIONS_SELL: 'paper:options:sell',
        PORTFOLIO: 'portfolio',
        STOCK: (ticker) => `stock:${ticker}`,
        WATCHLIST: 'watchlist',
        WATCHLIST_ITEM: (ticker) => `watchlist:${ticker}`,
    },
    apiRequest: vi.fn(),
}));

const chart = [{ date: '2026-07-01', open: 100, high: 102, low: 99, close: 101 }];

describe('market pages', () => {
    beforeEach(() => {
        apiRequest.mockReset();
    });

    test('loads the forex conversion and chart', async () => {
        apiRequest.mockImplementation((endpoint) => {
            if (endpoint === 'forex:currencies') {
                return Promise.resolve([
                    { code: 'USD', name: 'US Dollar', flag: '$' },
                    { code: 'EUR', name: 'Euro', flag: 'E' },
                ]);
            }
            if (endpoint === 'forex:convert:USD:EUR') return Promise.resolve({ exchange_rate: 0.92 });
            if (endpoint.startsWith('chart:')) return Promise.resolve(chart);
            throw new Error(`Unhandled endpoint: ${endpoint}`);
        });

        render(<ForexPage />);

        expect(await screen.findByText(/0\.92/)).toBeInTheDocument();
        expect(screen.getByTestId('stock-chart')).toHaveTextContent('USD/EUR');
    });

    test('loads crypto assets, conversion, and chart data', async () => {
        apiRequest.mockImplementation((endpoint) => {
            if (endpoint === 'crypto:list') return Promise.resolve([{ code: 'BTC', name: 'Bitcoin', icon: 'BTC' }]);
            if (endpoint === 'crypto:currencies') return Promise.resolve([{ code: 'USD', name: 'US Dollar', flag: '$' }]);
            if (endpoint === 'crypto:convert:BTC:USD') {
                return Promise.resolve({ exchange_rate: 65000, ask_price: 65010, bid_price: 64990 });
            }
            if (endpoint.startsWith('chart:')) return Promise.resolve(chart);
            throw new Error(`Unhandled endpoint: ${endpoint}`);
        });

        render(<CryptoPage />);

        expect(await screen.findByText('65,000')).toBeInTheDocument();
        expect(screen.getByTestId('stock-chart')).toHaveTextContent('BTC-USD');
    });

    test('loads the first commodity and supports filtering', async () => {
        apiRequest.mockImplementation((endpoint) => {
            if (endpoint === 'commodities:list') {
                return Promise.resolve([{ code: 'GC', name: 'Gold', category: 'Metals' }]);
            }
            if (endpoint === 'commodities:price:GC') {
                return Promise.resolve({
                    code: 'GC',
                    name: 'Gold',
                    category: 'Metals',
                    current_price: 2400,
                    price_change: 5,
                    price_change_percent: 0.2,
                    unit: 'oz',
                });
            }
            if (endpoint.startsWith('chart:')) return Promise.resolve(chart);
            throw new Error(`Unhandled endpoint: ${endpoint}`);
        });

        render(<CommoditiesPage />);

        expect(await screen.findByText('$2,400')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Search markets...'), { target: { value: 'oil' } });
        expect(screen.getByText('No markets found')).toBeInTheDocument();
    });

    test('renders detailed watchlist data and removes an item', async () => {
        apiRequest.mockImplementation((endpoint, options = {}) => {
            if (endpoint === 'watchlist') return Promise.resolve(['AAPL']);
            if (endpoint === 'stock:AAPL') {
                return Promise.resolve({
                    symbol: 'AAPL',
                    price: 200,
                    change: 2,
                    changePercent: 1,
                    marketCap: '3T',
                    fundamentals: {},
                });
            }
            if (endpoint === 'watchlist:AAPL' && options.method === 'DELETE') return Promise.resolve({ success: true });
            throw new Error(`Unhandled endpoint: ${endpoint}`);
        });

        render(<WatchlistPage />);

        expect(await screen.findByText('AAPL')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        await waitFor(() => expect(screen.getByText(/watchlist is empty/i)).toBeInTheDocument());
    });

    test('analyzes an option ticker and renders the returned chain state', async () => {
        apiRequest.mockImplementation((endpoint) => {
            if (endpoint === 'options:suggest:AAPL') return Promise.resolve({ suggestion: 'Hold', reason: 'No clear edge.' });
            if (endpoint === 'portfolio') return Promise.resolve({ options_positions: [] });
            if (endpoint === 'options:AAPL') return Promise.resolve(['2026-08-21']);
            if (endpoint === 'options:chain:AAPL:2026-08-21') {
                return Promise.resolve({ stock_price: 200, calls: [], puts: [] });
            }
            throw new Error(`Unhandled endpoint: ${endpoint}`);
        });

        render(<OptionsPage />);
        fireEvent.change(screen.getByPlaceholderText(/Search ticker/i), { target: { value: 'AAPL' } });
        fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

        expect(await screen.findByText('No clear edge.')).toBeInTheDocument();
        expect(screen.getByText('$200.00')).toBeInTheDocument();
    });
});
