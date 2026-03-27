import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SearchPage from './SearchPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('./ui/StockDataCard', () => ({ data }) => (
    <div data-testid="stock-data">{`Stock Data: ${data.companyName} (${data.symbol})`}</div>
));

jest.mock('./charts/StockChart', () => ({ ticker, chartData, comparisonData }) => (
    <div data-testid="stock-chart">
        {`Chart: ${ticker} - ${chartData?.label || 'none'} - ${comparisonData?.ticker || 'no comparison'}`}
    </div>
));

jest.mock('./ui/PredictionPreviewCard', () => ({ predictionData }) => (
    <div data-testid="prediction-preview">{`Prediction: ${predictionData.label}`}</div>
));

jest.mock('../config/api', () => {
    const actual = jest.requireActual('../config/api');
    return {
        ...actual,
        apiRequest: jest.fn(),
    };
});

const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const buildStock = (symbol, companyName) => ({
    symbol,
    companyName,
    price: 100,
    change: 1,
    changePercent: 1,
    fundamentals: {
        overview: `${companyName} overview`,
        recommendationKey: 'buy',
        analystTargetPrice: 120,
    },
    financials: {},
});

const buildNews = (title) => ([
    {
        title,
        link: `https://example.com/${encodeURIComponent(title)}`,
        publisher: 'Reuters',
        publishTime: '2026-03-13T12:00:00Z',
    },
]);

describe('SearchPage', () => {
    beforeEach(() => {
        localStorage.clear();
        global.alert = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('keeps only the latest search results when an older search resolves later', async () => {
        const aaplDeferred = createDeferred();
        const msftDeferred = createDeferred();

        apiRequest.mockImplementation((url) => {
            switch (url) {
                case API_ENDPOINTS.SCREENER():
                    return Promise.resolve({
                        gainers: [{ symbol: 'AAPL', name: 'Apple', percent_change: 0.02, volume: 1000 }],
                        losers: [{ symbol: 'MSFT', name: 'Microsoft', percent_change: -0.01, volume: 1000 }],
                        active: [],
                    });
                case API_ENDPOINTS.STOCK('AAPL'):
                    return aaplDeferred.promise;
                case API_ENDPOINTS.STOCK('MSFT'):
                    return msftDeferred.promise;
                case API_ENDPOINTS.CHART('AAPL', '14d'):
                    return Promise.resolve({ label: 'AAPL chart' });
                case API_ENDPOINTS.CHART('MSFT', '14d'):
                    return Promise.resolve({ label: 'MSFT chart' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('AAPL'):
                    return Promise.resolve({ label: 'AAPL prediction' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('MSFT'):
                    return Promise.resolve({ label: 'MSFT prediction' });
                case API_ENDPOINTS.NEWS('Apple'):
                    return Promise.resolve(buildNews('Apple news'));
                case API_ENDPOINTS.NEWS('Microsoft'):
                    return Promise.resolve(buildNews('Microsoft news'));
                default:
                    if (url === API_ENDPOINTS.SEARCH_SYMBOLS('AA') || url === API_ENDPOINTS.SEARCH_SYMBOLS('AAP') || url === API_ENDPOINTS.SEARCH_SYMBOLS('AAPL') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MS') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MSF') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MSFT')) {
                        return Promise.resolve([]);
                    }
                    throw new Error(`Unhandled API request: ${url}`);
            }
        });

        render(<SearchPage />);

        fireEvent.click(await screen.findByRole('button', { name: /AAPL/i }));
        fireEvent.click(screen.getByRole('button', { name: /MSFT/i }));

        await act(async () => {
            msftDeferred.resolve(buildStock('MSFT', 'Microsoft'));
        });

        expect(await screen.findByTestId('stock-data')).toHaveTextContent('Microsoft (MSFT)');
        expect(screen.getByTestId('stock-chart')).toHaveTextContent('MSFT chart');
        expect(screen.getByTestId('prediction-preview')).toHaveTextContent('MSFT prediction');
        expect(await screen.findByText('Microsoft news')).toBeInTheDocument();

        await act(async () => {
            aaplDeferred.resolve(buildStock('AAPL', 'Apple'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('stock-data')).toHaveTextContent('Microsoft (MSFT)');
        });
        expect(screen.queryByText('Apple news')).not.toBeInTheDocument();
        expect(screen.getByTestId('prediction-preview')).toHaveTextContent('MSFT prediction');
    });

    test('ignores stale errors from an older search after a newer search succeeds', async () => {
        const aaplDeferred = createDeferred();
        const msftDeferred = createDeferred();

        apiRequest.mockImplementation((url) => {
            switch (url) {
                case API_ENDPOINTS.SCREENER():
                    return Promise.resolve({
                        gainers: [{ symbol: 'AAPL', name: 'Apple', percent_change: 0.02, volume: 1000 }],
                        losers: [{ symbol: 'MSFT', name: 'Microsoft', percent_change: -0.01, volume: 1000 }],
                        active: [],
                    });
                case API_ENDPOINTS.STOCK('AAPL'):
                    return aaplDeferred.promise;
                case API_ENDPOINTS.STOCK('MSFT'):
                    return msftDeferred.promise;
                case API_ENDPOINTS.CHART('MSFT', '14d'):
                    return Promise.resolve({ label: 'MSFT chart' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('MSFT'):
                    return Promise.resolve({ label: 'MSFT prediction' });
                case API_ENDPOINTS.NEWS('Microsoft'):
                    return Promise.resolve(buildNews('Microsoft follow-up'));
                default:
                    if (url === API_ENDPOINTS.SEARCH_SYMBOLS('AA') || url === API_ENDPOINTS.SEARCH_SYMBOLS('AAP') || url === API_ENDPOINTS.SEARCH_SYMBOLS('AAPL') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MS') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MSF') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MSFT')) {
                        return Promise.resolve([]);
                    }
                    throw new Error(`Unhandled API request: ${url}`);
            }
        });

        render(<SearchPage />);

        fireEvent.click(await screen.findByRole('button', { name: /AAPL/i }));
        fireEvent.click(screen.getByRole('button', { name: /MSFT/i }));

        await act(async () => {
            msftDeferred.resolve(buildStock('MSFT', 'Microsoft'));
        });

        expect(await screen.findByTestId('stock-data')).toHaveTextContent('Microsoft (MSFT)');

        await act(async () => {
            aaplDeferred.reject(new Error('AAPL lookup failed'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('stock-data')).toHaveTextContent('Microsoft (MSFT)');
        });

        expect(screen.queryByText('AAPL lookup failed')).not.toBeInTheDocument();
        expect(screen.getByTestId('prediction-preview')).toHaveTextContent('MSFT prediction');
    });

    test('runs the canonical search path when selecting an autocomplete suggestion', async () => {
        apiRequest.mockImplementation((url) => {
            switch (url) {
                case API_ENDPOINTS.SCREENER():
                    return Promise.resolve({ gainers: [], losers: [], active: [] });
                case API_ENDPOINTS.SEARCH_SYMBOLS('NV'):
                    return Promise.resolve([{ symbol: 'NVDA', name: 'NVIDIA' }]);
                case API_ENDPOINTS.STOCK('NVDA'):
                    return Promise.resolve(buildStock('NVDA', 'NVIDIA'));
                case API_ENDPOINTS.CHART('NVDA', '14d'):
                    return Promise.resolve({ label: 'NVDA chart' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('NVDA'):
                    return Promise.resolve({ label: 'NVDA prediction' });
                case API_ENDPOINTS.NEWS('NVIDIA'):
                    return Promise.resolve(buildNews('NVIDIA news'));
                default:
                    throw new Error(`Unhandled API request: ${url}`);
            }
        });

        render(<SearchPage />);

        fireEvent.change(screen.getByPlaceholderText('e.g., AAPL or Apple'), { target: { value: 'nv' } });
        fireEvent.mouseDown(await screen.findByText('NVDA'));

        expect(await screen.findByTestId('stock-data')).toHaveTextContent('NVIDIA (NVDA)');
        expect(screen.getByTestId('stock-chart')).toHaveTextContent('NVDA chart');
        expect(screen.getByTestId('prediction-preview')).toHaveTextContent('NVDA prediction');
        expect(await screen.findByText('NVIDIA news')).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'NVDA' })).toBeInTheDocument();
    });

    test('uses the same search runner for recent-search and trending suggestion clicks', async () => {
        localStorage.setItem('recentSearches', JSON.stringify(['TSLA']));

        apiRequest.mockImplementation((url) => {
            switch (url) {
                case API_ENDPOINTS.SCREENER():
                    return Promise.resolve({
                        gainers: [{ symbol: 'MSFT', name: 'Microsoft', percent_change: 0.01, volume: 1000 }],
                        losers: [],
                        active: [],
                    });
                case API_ENDPOINTS.STOCK('TSLA'):
                    return Promise.resolve(buildStock('TSLA', 'Tesla'));
                case API_ENDPOINTS.CHART('TSLA', '14d'):
                    return Promise.resolve({ label: 'TSLA chart' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('TSLA'):
                    return Promise.resolve({ label: 'TSLA prediction' });
                case API_ENDPOINTS.NEWS('Tesla'):
                    return Promise.resolve(buildNews('Tesla news'));
                case API_ENDPOINTS.STOCK('MSFT'):
                    return Promise.resolve(buildStock('MSFT', 'Microsoft'));
                case API_ENDPOINTS.CHART('MSFT', '14d'):
                    return Promise.resolve({ label: 'MSFT chart' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('MSFT'):
                    return Promise.resolve({ label: 'MSFT prediction' });
                case API_ENDPOINTS.NEWS('Microsoft'):
                    return Promise.resolve(buildNews('Microsoft latest'));
                default:
                    if (url === API_ENDPOINTS.SEARCH_SYMBOLS('TS') || url === API_ENDPOINTS.SEARCH_SYMBOLS('TSL') || url === API_ENDPOINTS.SEARCH_SYMBOLS('TSLA') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MS') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MSF') || url === API_ENDPOINTS.SEARCH_SYMBOLS('MSFT')) {
                        return Promise.resolve([]);
                    }
                    throw new Error(`Unhandled API request: ${url}`);
            }
        });

        render(<SearchPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'TSLA' }));
        expect(await screen.findByTestId('stock-data')).toHaveTextContent('Tesla (TSLA)');
        expect(await screen.findByText('Tesla news')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /MSFT/i }));
        expect(await screen.findByTestId('stock-data')).toHaveTextContent('Microsoft (MSFT)');
        expect(await screen.findByText('Microsoft latest')).toBeInTheDocument();
    });

    test('adds a side-by-side comparison bundle on the search page', async () => {
        apiRequest.mockImplementation((url) => {
            switch (url) {
                case API_ENDPOINTS.SCREENER():
                    return Promise.resolve({ gainers: [], losers: [], active: [] });
                case API_ENDPOINTS.STOCK('NVDA'):
                    return Promise.resolve(buildStock('NVDA', 'NVIDIA'));
                case API_ENDPOINTS.CHART('NVDA', '14d'):
                    return Promise.resolve({ label: 'NVDA chart' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('NVDA'):
                    return Promise.resolve({ label: 'NVDA prediction', recentClose: 100, recentPredicted: 110, predictions: [] });
                case API_ENDPOINTS.NEWS('NVIDIA'):
                    return Promise.resolve(buildNews('NVIDIA news'));
                case API_ENDPOINTS.STOCK('AMD'):
                    return Promise.resolve(buildStock('AMD', 'Advanced Micro Devices'));
                case API_ENDPOINTS.CHART('AMD', '14d'):
                    return Promise.resolve({ label: 'AMD chart' });
                case API_ENDPOINTS.PREDICT_ENSEMBLE('AMD'):
                    return Promise.resolve({ label: 'AMD prediction', recentClose: 100, recentPredicted: 108, predictions: [] });
                case API_ENDPOINTS.NEWS('Advanced Micro Devices'):
                    return Promise.resolve(buildNews('AMD news'));
                default:
                    if (url === API_ENDPOINTS.SEARCH_SYMBOLS('NV') || url === API_ENDPOINTS.SEARCH_SYMBOLS('NVD') || url === API_ENDPOINTS.SEARCH_SYMBOLS('NVDA') || url === API_ENDPOINTS.SEARCH_SYMBOLS('AM') || url === API_ENDPOINTS.SEARCH_SYMBOLS('AMD')) {
                        return Promise.resolve([]);
                    }
                    throw new Error(`Unhandled API request: ${url}`);
            }
        });

        render(<SearchPage />);

        fireEvent.change(screen.getByPlaceholderText('e.g., AAPL or Apple'), { target: { value: 'NVDA' } });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));

        expect(await screen.findByTestId('stock-data')).toHaveTextContent('NVIDIA (NVDA)');

        fireEvent.change(screen.getByPlaceholderText('Compare (e.g., MSFT)'), { target: { value: 'AMD' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(await screen.findByText(/NVDA vs AMD/i)).toBeInTheDocument();
        expect(await screen.findByText(/Advanced Micro Devices/i)).toBeInTheDocument();
        expect(screen.getByTestId('stock-chart')).toHaveTextContent('AMD');
    });
});
