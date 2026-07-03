import { render, screen } from '@testing-library/react';
import { apiRequest } from '../../config/api';
import PortfolioGrowthChart from './PortfolioGrowthChart';

// chart.js / react-chartjs-2 don't render meaningfully in jsdom; stub them
// (matches the existing PaperTradingPage test).
jest.mock('react-chartjs-2', () => ({ Line: () => <div data-testid="line-chart" /> }));
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
jest.mock('../../config/api', () => ({
    ...jest.requireActual('../../config/api'),
    apiRequest: jest.fn(),
}));

describe('PortfolioGrowthChart', () => {
    test('renders the performance panel and chart once history loads', async () => {
        apiRequest.mockResolvedValue({
            dates: ['2024-01-01', '2024-01-02', '2024-01-03'],
            values: [100000, 105000, 110000],
        });
        render(<PortfolioGrowthChart totalValue={110000} />);

        expect(await screen.findByText('Portfolio Performance')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument();
    });

    test('falls back to a projected (simulated) view when history fetch fails', async () => {
        apiRequest.mockRejectedValue(new Error('backend down'));
        render(<PortfolioGrowthChart totalValue={110000} />);

        expect(await screen.findByText('Portfolio Performance')).toBeInTheDocument();
        expect(screen.getByText('Projected View')).toBeInTheDocument();
    });
});
