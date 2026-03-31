import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PredictionMarketsPage from './PredictionMarketsPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

let mockAuthState = {
    isLoaded: true,
    isSignedIn: true,
};

jest.mock('@clerk/clerk-react', () => ({
    useAuth: () => mockAuthState,
}));

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        PREDICTION_MARKETS: jest.fn(() => '/prediction-markets?exchange=polymarket&limit=50'),
        PREDICTION_ANALYZE: '/prediction-markets/analyze',
        PREDICTION_PORTFOLIO: '/prediction-markets/portfolio',
        PREDICTION_HISTORY: '/prediction-markets/history',
        PREDICTION_BUY: '/prediction-markets/buy',
        PREDICTION_SELL: '/prediction-markets/sell',
        PREDICTION_RESET: '/prediction-markets/reset',
    },
    apiRequest: jest.fn(),
}));

const baseMarket = {
    id: 'btc-180k',
    question: 'Will Bitcoin reach $180,000 by December 31, 2026?',
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

describe('PredictionMarketsPage', () => {
    beforeEach(() => {
        mockAuthState = {
            isLoaded: true,
            isSignedIn: true,
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('shows the refreshed portfolio immediately after a successful buy', async () => {
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
                    question: baseMarket.question,
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
                question: baseMarket.question,
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
                return Promise.resolve({ markets: [baseMarket] });
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

        const marketHeading = await screen.findByText(baseMarket.question);
        fireEvent.click(marketHeading.closest('button'));

        fireEvent.click(screen.getByRole('button', { name: 'Yes @ 65.0%' }));
        fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Buy Yes' }));

        expect(await screen.findByText("Bought 1 'Yes' contracts at $0.6500 each")).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Sell' })).toBeInTheDocument();
        });

        expect(screen.getByText(baseMarket.question)).toBeInTheDocument();
        expect(screen.queryByText('No open positions.')).not.toBeInTheDocument();
        expect(portfolioCalls).toBeGreaterThanOrEqual(2);
        expect(historyCalls).toBeGreaterThanOrEqual(2);
    });

    test('analyze market renders the compact market-vs-model brief inline', async () => {
        apiRequest.mockImplementation((url, options) => {
            if (url === undefined || url === '/prediction-markets?exchange=polymarket&limit=50') {
                return Promise.resolve({ markets: [baseMarket] });
            }
            if (url === API_ENDPOINTS.PREDICTION_PORTFOLIO) {
                return Promise.resolve(emptyPortfolio);
            }
            if (url === API_ENDPOINTS.PREDICTION_HISTORY) {
                return Promise.resolve([]);
            }
            if (url === API_ENDPOINTS.PREDICTION_ANALYZE) {
                expect(options.method).toBe('POST');
                expect(JSON.parse(options.body)).toEqual({
                    market_id: 'btc-180k',
                    exchange: 'polymarket',
                });
                return Promise.resolve({
                    market: {
                        id: 'btc-180k',
                        exchange: 'polymarket',
                        question: baseMarket.question,
                        event_title: 'Bitcoin 2026',
                        current_probability: 0.65,
                        end_date: '2026-12-31T23:59:59Z',
                        source_url: 'https://polymarket.com/event/btc-180k',
                    },
                    claims: [
                        {
                            claim: 'The market already prices a strong yes lean.',
                            rationale: '65% is comfortably above a coin flip.',
                        },
                        {
                            claim: 'Depth is good enough to take the odds seriously.',
                            rationale: 'The listed volume and liquidity are both healthy.',
                        },
                        {
                            claim: 'There is still room for repricing before expiry.',
                            rationale: 'The market does not resolve immediately.',
                        },
                    ],
                    analysis: {
                        model_probability: 0.6,
                        delta: -0.05,
                        stance: 'aligned',
                        brief: 'The model is a little more cautious than the market, but still broadly constructive.',
                        risk_notes: [
                            'Late macro headlines can still move the setup.',
                            'The question can reprice quickly if conviction fades.',
                        ],
                    },
                    generated_at: '2026-03-30T14:00:00+00:00',
                });
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        render(<PredictionMarketsPage />);

        const marketHeading = await screen.findByText(baseMarket.question);
        fireEvent.click(marketHeading.closest('button'));
        fireEvent.click(screen.getByRole('button', { name: 'Analyze market' }));

        expect(await screen.findByText('The model is a little more cautious than the market, but still broadly constructive.')).toBeInTheDocument();
        expect(screen.getByText(/Bitcoin 2026/)).toBeInTheDocument();
        expect(screen.getByText('Aligned')).toBeInTheDocument();
        expect(screen.getByText('The market already prices a strong yes lean.')).toBeInTheDocument();
        expect(screen.getByText('Late macro headlines can still move the setup.')).toBeInTheDocument();
    });

    test('analyze market shows live staged progress while loading', async () => {
        jest.useFakeTimers();

        let resolveAnalysis;
        const pendingAnalysis = new Promise((resolve) => {
            resolveAnalysis = resolve;
        });

        apiRequest.mockImplementation((url) => {
            if (url === undefined || url === '/prediction-markets?exchange=polymarket&limit=50') {
                return Promise.resolve({ markets: [baseMarket] });
            }
            if (url === API_ENDPOINTS.PREDICTION_PORTFOLIO) {
                return Promise.resolve(emptyPortfolio);
            }
            if (url === API_ENDPOINTS.PREDICTION_HISTORY) {
                return Promise.resolve([]);
            }
            if (url === API_ENDPOINTS.PREDICTION_ANALYZE) {
                return pendingAnalysis;
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        render(<PredictionMarketsPage />);

        const marketHeading = await screen.findByText(baseMarket.question);
        fireEvent.click(marketHeading.closest('button'));
        fireEvent.click(screen.getByRole('button', { name: 'Analyze market' }));

        expect(await screen.findByText('Working through the market analysis...')).toBeInTheDocument();
        expect(screen.getByText('Resolving market context')).toBeInTheDocument();
        expect(screen.getByText('Starting now...')).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(600);
        });

        expect(screen.getByText('Elapsed: 1s')).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(1700);
        });

        expect(screen.getByText('Reading pricing and liquidity')).toBeInTheDocument();

        act(() => {
            resolveAnalysis({
                market: {
                    id: 'btc-180k',
                    exchange: 'polymarket',
                    question: baseMarket.question,
                    event_title: 'Bitcoin 2026',
                    current_probability: 0.65,
                    end_date: '2026-12-31T23:59:59Z',
                    source_url: 'https://polymarket.com/event/btc-180k',
                },
                claims: [
                    { claim: 'Claim 1', rationale: 'Rationale 1' },
                    { claim: 'Claim 2', rationale: 'Rationale 2' },
                    { claim: 'Claim 3', rationale: 'Rationale 3' },
                ],
                analysis: {
                    model_probability: 0.6,
                    delta: -0.05,
                    stance: 'aligned',
                    brief: 'Finished analysis.',
                    risk_notes: ['Risk 1', 'Risk 2'],
                },
                generated_at: '2026-03-30T14:00:00+00:00',
            });
        });

        expect(await screen.findByText('Finished analysis.')).toBeInTheDocument();

        jest.useRealTimers();
    });

    test('analyze market shows a retryable error state when the API fails', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === undefined || url === '/prediction-markets?exchange=polymarket&limit=50') {
                return Promise.resolve({ markets: [baseMarket] });
            }
            if (url === API_ENDPOINTS.PREDICTION_PORTFOLIO) {
                return Promise.resolve(emptyPortfolio);
            }
            if (url === API_ENDPOINTS.PREDICTION_HISTORY) {
                return Promise.resolve([]);
            }
            if (url === API_ENDPOINTS.PREDICTION_ANALYZE) {
                return Promise.reject(new Error('Prediction market not found'));
            }
            throw new Error(`Unhandled API request: ${url}`);
        });

        render(<PredictionMarketsPage />);

        const marketHeading = await screen.findByText(baseMarket.question);
        fireEvent.click(marketHeading.closest('button'));
        fireEvent.click(screen.getByRole('button', { name: 'Analyze market' }));

        expect(await screen.findByText('Analysis failed')).toBeInTheDocument();
        expect(screen.getByText('Prediction market not found')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Analyze market' })).toBeInTheDocument();
    });

    test('signed-out users see analysis disabled without fetching portfolio state', async () => {
        mockAuthState = {
            isLoaded: true,
            isSignedIn: false,
        };

        apiRequest.mockImplementation((url) => {
            if (url === undefined || url === '/prediction-markets?exchange=polymarket&limit=50') {
                return Promise.resolve({ markets: [baseMarket] });
            }
            throw new Error(`Unexpected API request while signed out: ${url}`);
        });

        render(<PredictionMarketsPage />);

        const marketHeading = await screen.findByText(baseMarket.question);
        fireEvent.click(marketHeading.closest('button'));

        const analyzeButton = screen.getByRole('button', { name: 'Analyze market' });
        expect(analyzeButton).toBeDisabled();
        expect(screen.getByText('Sign in to generate Market vs Model analysis.')).toBeInTheDocument();
    });
});
