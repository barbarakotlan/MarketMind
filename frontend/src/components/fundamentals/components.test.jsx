import { fireEvent, render, screen } from '@testing-library/react';
import {
    FinancialTable,
    MetricCard,
    TabButton,
    SentimentBadge,
    ResearchProfileList,
    AnnouncementsPanel,
} from './components';

describe('FinancialTable', () => {
    test('renders nothing without data', () => {
        expect(render(<FinancialTable title="Income" rows={[]} data={null} />).container).toBeEmptyDOMElement();
        expect(render(<FinancialTable title="Income" rows={[]} data={[]} />).container).toBeEmptyDOMElement();
    });

    test('renders period headers and formats values ($ unless raw)', () => {
        const rows = [
            { label: 'Revenue', key: 'revenue' },
            { label: 'EPS', key: 'eps', raw: true },
        ];
        const data = [
            { period: 'Q1', revenue: 1e9, eps: 5 },
            { period: 'Q2', revenue: 2e9, eps: 6 },
        ];
        render(<FinancialTable title="Income Statement" rows={rows} data={data} />);

        expect(screen.getByText('Income Statement')).toBeInTheDocument();
        expect(screen.getByText('Q1')).toBeInTheDocument();
        expect(screen.getByText('Q2')).toBeInTheDocument();
        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('$1.00B')).toBeInTheDocument(); // non-raw gets $
        expect(screen.getByText('5.00')).toBeInTheDocument(); // raw, no $
    });
});

describe('MetricCard', () => {
    test('renders the title and value', () => {
        render(<MetricCard title="Market Cap" value="$2.84T" />);
        expect(screen.getByText('Market Cap')).toBeInTheDocument();
        expect(screen.getByText('$2.84T')).toBeInTheDocument();
    });

    test('renders the optional icon when provided', () => {
        const Icon = (props) => <svg data-testid="metric-icon" {...props} />;
        render(<MetricCard title="Beta" value="1.2" icon={Icon} />);
        expect(screen.getByTestId('metric-icon')).toBeInTheDocument();
    });
});

describe('TabButton', () => {
    test('renders children and fires onClick', () => {
        const onClick = vi.fn();
        render(<TabButton active={false} onClick={onClick}>Overview</TabButton>);
        const button = screen.getByRole('button', { name: 'Overview' });
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('applies the active style class', () => {
        render(<TabButton active onClick={() => {}}>Financials</TabButton>);
        expect(screen.getByRole('button', { name: 'Financials' }).className).toMatch(/bg-mm-accent-primary/);
    });
});

describe('SentimentBadge', () => {
    test('renders nothing for unscored/absent sentiment', () => {
        expect(render(<SentimentBadge sentiment={null} />).container).toBeEmptyDOMElement();
        expect(render(<SentimentBadge sentiment={{ status: 'pending' }} />).container).toBeEmptyDOMElement();
    });

    test('renders the capitalized label, with an optional prefix', () => {
        const scored = { status: 'scored', label: 'positive' };
        const { rerender } = render(<SentimentBadge sentiment={scored} />);
        expect(screen.getByText('Positive')).toBeInTheDocument();

        rerender(<SentimentBadge sentiment={scored} prefix="Sentiment" />);
        expect(screen.getByText('Sentiment: Positive')).toBeInTheDocument();
    });
});

describe('ResearchProfileList', () => {
    test('renders nothing for an empty or non-array list', () => {
        expect(render(<ResearchProfileList items={[]} />).container).toBeEmptyDOMElement();
        expect(render(<ResearchProfileList items={null} />).container).toBeEmptyDOMElement();
    });

    test('renders each label/value item', () => {
        render(<ResearchProfileList items={[{ label: 'Sector', value: 'Technology' }]} />);
        expect(screen.getByText('Sector')).toBeInTheDocument();
        expect(screen.getByText('Technology')).toBeInTheDocument();
    });
});

describe('AnnouncementsPanel', () => {
    test('shows an empty state when there are no items', () => {
        render(<AnnouncementsPanel items={[]} />);
        expect(screen.getByText(/No company announcements/i)).toBeInTheDocument();
        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    test('renders announcements as links with title and type', () => {
        const items = [
            { title: 'Q4 results', type: '10-K', link: 'https://ex.com/a', date: '2024-01-10' },
        ];
        render(<AnnouncementsPanel items={items} />);
        expect(screen.getByText('Q4 results')).toBeInTheDocument();
        expect(screen.getByText('10-K')).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveAttribute('href', 'https://ex.com/a');
    });
});
