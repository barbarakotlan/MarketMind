import { fireEvent, render, screen } from '@testing-library/react';
import {
    StockOverviewCard,
    KeyMetricsCard,
    AnalystRatingsCard,
    StockNewsCard,
} from './StockCards';

describe('StockOverviewCard', () => {
    test('renders nothing without a summary', () => {
        const { container } = render(<StockOverviewCard summary={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('truncates a long summary and expands on Read More', () => {
        const summary = 'x'.repeat(500);
        render(<StockOverviewCard summary={summary} />);

        // Truncated: 350 chars + ellipsis, and a Read More affordance.
        const readMore = screen.getByRole('button', { name: /Read More/i });
        expect(readMore).toBeInTheDocument();

        fireEvent.click(readMore);
        // After expanding, the Read More button is gone (full text shown).
        expect(screen.queryByRole('button', { name: /Read More/i })).not.toBeInTheDocument();
    });

    test('shows quarterly financials only when revenue is present', () => {
        const { rerender } = render(<StockOverviewCard summary="short" financials={null} />);
        expect(screen.queryByText('Revenue')).not.toBeInTheDocument();

        rerender(
            <StockOverviewCard summary="short" financials={{ revenue: 2.84e12, netIncome: 1e9 }} />,
        );
        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('2.84T')).toBeInTheDocument();
        expect(screen.getByText('1.00B')).toBeInTheDocument();
    });
});

describe('KeyMetricsCard', () => {
    test('renders nothing without metrics', () => {
        const { container } = render(<KeyMetricsCard metrics={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing when every metric is N/A', () => {
        const { container } = render(<KeyMetricsCard metrics={{}} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('renders labels and formatted values when at least one metric exists', () => {
        render(<KeyMetricsCard metrics={{ beta: 1.23, dividendYield: 2.5 }} />);
        expect(screen.getByText('Beta (5Y)')).toBeInTheDocument();
        expect(screen.getByText('1.23')).toBeInTheDocument();
        // dividendYield is rendered as a percentage.
        expect(screen.getByText('2.50%')).toBeInTheDocument();
    });
});

describe('AnalystRatingsCard', () => {
    const base = { recommendationKey: 'buy', analystTargetPrice: 110, numberOfAnalystOpinions: 20 };

    test('renders nothing when rating or target is missing', () => {
        expect(render(<AnalystRatingsCard ratings={null} price={100} />).container).toBeEmptyDOMElement();
        expect(
            render(<AnalystRatingsCard ratings={{ recommendationKey: 'buy' }} price={100} />).container,
        ).toBeEmptyDOMElement();
    });

    test('shows the consensus, target and computed upside', () => {
        render(<AnalystRatingsCard ratings={base} price={100} />);
        expect(screen.getByText('buy')).toBeInTheDocument();
        expect(screen.getByText('$110.00')).toBeInTheDocument();
        expect(screen.getByText(/10\.00% Upside/)).toBeInTheDocument();
        expect(screen.getByText(/Based on 20 analysts/)).toBeInTheDocument();
    });

    test('labels a below-price target as Downside', () => {
        render(<AnalystRatingsCard ratings={{ ...base, analystTargetPrice: 90 }} price={100} />);
        expect(screen.getByText(/-10\.00% Downside/)).toBeInTheDocument();
    });
});

describe('StockNewsCard', () => {
    test('renders each article as a link with title and publisher', () => {
        const newsData = [
            { title: 'Fed holds rates', publisher: 'Reuters', link: 'https://ex.com/a', publishTime: '2024-01-15' },
            { title: 'AI rally continues', publisher: 'Bloomberg', link: 'https://ex.com/b', publishTime: '2024-01-16' },
        ];
        render(<StockNewsCard newsData={newsData} />);

        expect(screen.getByText('Fed holds rates')).toBeInTheDocument();
        expect(screen.getByText('AI rally continues')).toBeInTheDocument();
        expect(screen.getByText('Reuters')).toBeInTheDocument();
        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(2);
        expect(links[0]).toHaveAttribute('href', 'https://ex.com/a');
    });

    test('renders an empty grid for no articles', () => {
        render(<StockNewsCard newsData={[]} />);
        expect(screen.getByText('Recent News')).toBeInTheDocument();
        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
});
