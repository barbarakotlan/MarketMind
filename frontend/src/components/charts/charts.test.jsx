import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ActualVsPredictedChart from './ActualVsPredictedChart';
import PortfolioGrowthChart from './PortfolioGrowthChart';
import PredictionChart from './PredictionChart';
import StockChart from './StockChart';
import { apiRequest } from '../../config/api';

vi.mock('react-chartjs-2', () => ({
    Chart: ({ type, data }) => <div data-testid="chart">{type}:{data.datasets.length}</div>,
    Line: ({ data }) => <div data-testid="line-chart">{data.datasets.length}</div>,
}));

vi.mock('chart.js', () => ({
    Chart: { register: vi.fn() },
    CategoryScale: {},
    Filler: {},
    Legend: {},
    LinearScale: {},
    LineElement: {},
    PointElement: {},
    TimeScale: {},
    Title: {},
    Tooltip: {},
}));

vi.mock('chartjs-chart-financial', () => ({
    CandlestickController: {},
    CandlestickElement: {},
}));

vi.mock('chartjs-adapter-date-fns', () => ({}));

vi.mock('../../config/api', async () => ({
    ...(await vi.importActual('../../config/api')),
    apiRequest: vi.fn(),
}));

const prices = [
    { date: '2026-07-01', open: 100, high: 104, low: 99, close: 102 },
    { date: '2026-07-02', open: 102, high: 106, low: 101, close: 105 },
];

describe('chart components', () => {
    beforeEach(() => {
        apiRequest.mockReset();
    });

    test('StockChart switches time frames and chart types', () => {
        const onTimeFrameChange = vi.fn();
        render(
            <StockChart
                chartData={prices}
                ticker="AAPL"
                activeTimeFrame={{ label: '6M', value: '6mo' }}
                onTimeFrameChange={onTimeFrameChange}
            />
        );

        expect(screen.getByTestId('chart')).toHaveTextContent('line:1');
        fireEvent.click(screen.getByRole('button', { name: '1Y' }));
        expect(onTimeFrameChange).toHaveBeenCalledWith({ label: '1Y', value: '1y' });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'candlestick' } });
        expect(screen.getByTestId('chart')).toHaveTextContent('candlestick:1');
    });

    test('prediction and evaluation charts map API data into two datasets', () => {
        const { rerender } = render(
            <PredictionChart
                predictionData={{
                    symbol: 'AAPL',
                    recentDate: '2026-07-01',
                    recentClose: 200,
                    predictions: [{ date: '2026-07-02', predictedClose: 202 }],
                }}
            />
        );
        expect(screen.getByTestId('line-chart')).toHaveTextContent('2');

        rerender(
            <ActualVsPredictedChart
                evaluationData={{
                    dates: ['2026-07-01'],
                    actuals: [200],
                    models: {
                        ensemble: {
                            predictions: [201],
                            metrics: {
                                mae: 1,
                                rmse: 1,
                                mape: 0.5,
                                r_squared: 0.9,
                                directional_accuracy: 100,
                            },
                        },
                    },
                }}
            />
        );
        expect(screen.getByTestId('line-chart')).toHaveTextContent('2');
    });

    test('portfolio chart loads history and reports its summary', async () => {
        const onDataFetched = vi.fn();
        apiRequest.mockResolvedValue({
            dates: ['2026-07-01', '2026-07-02'],
            values: [10000, 10100],
            summary: {
                period: 'ytd',
                start_date: '2026-07-01',
                end_date: '2026-07-02',
                end_value: 10100,
                wealth_generated: 100,
                return_cumulative_pct: 1,
                return_annualized_pct: 12,
            },
        });

        render(<PortfolioGrowthChart onDataFetched={onDataFetched} />);

        expect(await screen.findByTestId('line-chart')).toBeInTheDocument();
        await waitFor(() => expect(onDataFetched).toHaveBeenCalledWith(expect.objectContaining({ period: 'ytd' })));
    });
});
