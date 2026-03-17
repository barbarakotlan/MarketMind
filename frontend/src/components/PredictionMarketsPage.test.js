import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PredictionMarketsPage from './PredictionMarketsPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        PREDICTION_MARKETS: jest.fn(() => '/prediction-markets?exchange=polymarket&limit=50'),
        PREDICTION_PORTFOLIO: '/prediction-markets/portfolio',
        PREDICTION_HISTORY: '/prediction-markets/history',
        PREDICTION_BUY: '/prediction-markets/buy',
        PREDICTION_SELL: '/prediction-markets/sell',
        PREDICTION_RESET: '/prediction-markets/reset',
    },
    apiRequest: jest.fn(),
}));

describe('PredictionMarketsPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('shows the refreshed portfolio immediately after a successful buy', async () => {
        const marketQuestion = 'Will Bitcoin reach $180,000 by December 31, 2026?';
        const market = {
            id: 'btc-180k',
            question: marketQuestion,
            outcomes: ['Yes', 'No'],
            prices: { Yes: 0.65, No: 0.35 },
            volume: 120000,
            liquidity: 45000,
            is_open: true,
            description: 'A test prediction market.',
        };
        const emptyPortfolio = {
            cash: 10000,
            positions_value: 0,
            total_value: 10000,
            starting_value: 10000,
            total_pl: 0,
            total_return: 0,
            positions: [],
        };
        const filledPortfolio = {
            cash: 9999.35,
            positions_value: 0.65,
            total_value: 10000,
            starting_value: 10000,
            total_pl: 0,
            total_return: 0,
            positions: [
                {
                    position_key: 'btc-180k::Yes',
                    market_id: 'btc-180k',
                    question: marketQuestion,
                    outcome: 'Yes',
                    contracts: 1,
                    avg_cost: 0.65,
                    current_price: 0.65,
                    current_value: 0.65,
                    total_pl: 0,
                    total_pl_percent: 0,
                },
            ],
        };
        const filledHistory = [
            {
                type: 'BUY',
                market_id: 'btc-180k',
                question: marketQuestion,
                outcome: 'Yes',
                contracts: 1,
                price: 0.65,
                total: 0.65,
                timestamp: '2026-03-13T12:00:00',
            },
        ];

        let portfolioCalls = 0;
        let historyCalls = 0;

        apiRequest.mockImplementation((url) => {
            if (url === undefined || url === '/prediction-markets?exchange=polymarket&limit=50') {
                return Promise.resolve({ markets: [market] });
            }
            if (url === API_ENDPOINTS.PREDICTION_PORTFOLIO) {
                portfolioCalls += 1;
                return Promise.resolve(portfolioCalls === 1 ? emptyPortfolio : filledPortfolio);
            }
            if (url === API_ENDPOINTS.PREDICTION_HISTORY) {
                historyCalls += 1;
                return Promise.resolve(historyCalls === 1 ? [] : filledHistory);
            }
            if (url === API_ENDPOINTS.PREDICTION_BUY) {
                return Promise.resolve({
                    success: true,
                    message: "Bought 1 'Yes' contracts at $0.6500 each",
                });
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        render(<PredictionMarketsPage />);

        expect(API_ENDPOINTS.PREDICTION_MARKETS).toHaveBeenCalled();

        const marketHeading = await screen.findByText(marketQuestion);
        fireEvent.click(marketHeading.closest('button'));

        fireEvent.click(screen.getByRole('button', { name: 'Yes @ 65.0%' }));
        fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Buy Yes' }));

        expect(await screen.findByText("Bought 1 'Yes' contracts at $0.6500 each")).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Sell' })).toBeInTheDocument();
        });

        expect(screen.getByText(marketQuestion)).toBeInTheDocument();
        expect(screen.queryByText('No open positions.')).not.toBeInTheDocument();
        expect(portfolioCalls).toBeGreaterThanOrEqual(2);
        expect(historyCalls).toBeGreaterThanOrEqual(2);
    });
});
