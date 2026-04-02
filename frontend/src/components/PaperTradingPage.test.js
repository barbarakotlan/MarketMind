import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaperTradingPage from './PaperTradingPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('react-chartjs-2', () => ({
    Line: () => <div data-testid="portfolio-line-chart" />,
}));

jest.mock('chart.js', () => ({
    Chart: { register: jest.fn() },
    CategoryScale: {},
    LinearScale: {},
    PointElement: {},
    LineElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
    Filler: {},
}));

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        PORTFOLIO: '/paper/portfolio',
        PORTFOLIO_OPTIMIZE: '/paper/portfolio/optimize',
        PORTFOLIO_HISTORY: (period) => `/paper/history?period=${period}`,
        PORTFOLIO_RESET: '/paper/reset',
        PAPER_BUY: '/paper/buy',
        PAPER_SELL: '/paper/sell',
        PAPER_OPTIONS_SELL: '/paper/options/sell',
    },
    apiRequest: jest.fn(),
}));

const basePortfolio = {
    cash: 12000,
    positions_value: 88000,
    options_value: 750,
    total_value: 100750,
    total_pl: 750,
    total_return: 0.75,
    positions: [
        {
            ticker: 'AAPL',
            company_name: 'Apple Inc.',
            shares: 10,
            avg_cost: 180,
            current_price: 200,
            current_value: 2000,
            total_pl: 200,
        },
        {
            ticker: 'MSFT',
            company_name: 'Microsoft',
            shares: 15,
            avg_cost: 300,
            current_price: 340,
            current_value: 5100,
            total_pl: 600,
        },
    ],
    options_positions: [
        {
            ticker: 'AAPL260116C00200000',
            shares: 1,
            avg_cost: 7.5,
            current_price: 8.0,
            current_value: 800,
            total_pl: 50,
        },
    ],
};

const historyPayload = {
    dates: ['2026-03-01', '2026-03-02', '2026-03-03'],
    values: [100000, 100250, 100750],
};

const blackLittermanPayload = {
    investableValue: 19100,
    cashPosition: {
        currentValue: 12000,
        currentWeight: 0.6283,
        targetValue: 2500,
        targetWeight: 0.1309,
        deltaValue: -9500,
    },
    excludedHoldings: [
        {
            symbol: 'AAPL260116C00200000',
            assetClass: 'option',
            reason: 'Option positions are excluded from portfolio optimization v1.',
        },
    ],
    portfolioMetrics: {
        expectedAnnualReturn: 0.124,
        annualVolatility: 0.182,
        sharpeRatio: 0.57,
    },
    recommendedAllocations: [
        {
            ticker: 'MSFT',
            companyName: 'Microsoft',
            currentWeight: 0.267,
            targetWeight: 0.35,
            currentValue: 5100,
            targetValue: 6685,
            deltaValue: 1585,
            estimatedSharesDelta: 4.66,
            currentPrice: 340,
        },
        {
            ticker: 'AAPL',
            companyName: 'Apple Inc.',
            currentWeight: 0.105,
            targetWeight: 0.30,
            currentValue: 2000,
            targetValue: 5730,
            deltaValue: 3730,
            estimatedSharesDelta: 18.65,
            currentPrice: 200,
        },
    ],
    rebalanceActions: [
        { ticker: 'MSFT', action: 'buy', currentWeight: 0.267, targetWeight: 0.35, deltaValue: 1585, estimatedSharesDelta: 4.66 },
        { ticker: 'AAPL', action: 'buy', currentWeight: 0.105, targetWeight: 0.30, deltaValue: 3730, estimatedSharesDelta: 18.65 },
    ],
    warnings: ['13.1% of the portfolio remains in cash under the current guardrails.'],
};

const hrpPayload = {
    ...blackLittermanPayload,
    portfolioMetrics: {
        expectedAnnualReturn: 0.102,
        annualVolatility: 0.144,
        sharpeRatio: 0.55,
    },
    warnings: ['HRP emphasized diversification and retained a modest cash buffer.'],
};

describe('PaperTradingPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders portfolio optimization recommendations and refetches when the method changes', async () => {
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.PORTFOLIO) {
                return Promise.resolve(basePortfolio);
            }
            if (url === API_ENDPOINTS.PORTFOLIO_HISTORY('1m')) {
                return Promise.resolve(historyPayload);
            }
            if (url === API_ENDPOINTS.PORTFOLIO_OPTIMIZE) {
                const body = JSON.parse(options.body || '{}');
                return Promise.resolve(body.method === 'hrp' ? hrpPayload : blackLittermanPayload);
            }
            throw new Error(`Unhandled request: ${url}`);
        });

        render(<PaperTradingPage />);

        expect(await screen.findByText('Rebalance Suggestions')).toBeInTheDocument();
        expect(await screen.findByText('Option positions are excluded from portfolio optimization v1.')).toBeInTheDocument();
        expect(screen.getByText('13.1% of the portfolio remains in cash under the current guardrails.')).toBeInTheDocument();
        expect(screen.getAllByText('buy').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'HRP' }));

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith(
                API_ENDPOINTS.PORTFOLIO_OPTIMIZE,
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"method":"hrp"'),
                }),
            );
        });
        expect(await screen.findByText('HRP emphasized diversification and retained a modest cash buffer.')).toBeInTheDocument();
    });

    test('shows the local helper state instead of requesting optimization for a single holding', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.PORTFOLIO) {
                return Promise.resolve({
                    ...basePortfolio,
                    positions: [basePortfolio.positions[0]],
                    options_positions: [],
                });
            }
            if (url === API_ENDPOINTS.PORTFOLIO_HISTORY('1m')) {
                return Promise.resolve(historyPayload);
            }
            throw new Error(`Unhandled request: ${url}`);
        });

        render(<PaperTradingPage />);

        expect(await screen.findByText('Rebalance Suggestions')).toBeInTheDocument();
        expect(screen.getByText('Add at least two U.S. stock holdings to generate a portfolio rebalance plan.')).toBeInTheDocument();

        const optimizeCalls = apiRequest.mock.calls.filter(([url]) => url === API_ENDPOINTS.PORTFOLIO_OPTIMIZE);
        expect(optimizeCalls).toHaveLength(0);
    });
});
