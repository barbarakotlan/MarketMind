import { fireEvent, render, screen } from '@testing-library/react';
import {
    SectionLabel,
    StarterPromptButton,
    MessageBubble,
    ContextCard,
    EvidencePanel,
    ArtifactPreview,
} from './components';

// react-markdown / remark-gfm are ESM-only and aren't transformed by CRA's
// test config; render markdown as a passthrough so the suite can load (matches
// the existing MarketMindAIPage test).
vi.mock('react-markdown', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('remark-gfm', () => ({ default: () => null }));

describe('SectionLabel', () => {
    test('renders its children', () => {
        render(<SectionLabel>Overview</SectionLabel>);
        expect(screen.getByText('Overview')).toBeInTheDocument();
    });
});

describe('StarterPromptButton', () => {
    test('invokes onClick with the prompt text', () => {
        const onClick = vi.fn();
        render(<StarterPromptButton prompt="Analyze AAPL" onClick={onClick} />);
        fireEvent.click(screen.getByRole('button', { name: 'Analyze AAPL' }));
        expect(onClick).toHaveBeenCalledWith('Analyze AAPL');
    });
});

describe('MessageBubble', () => {
    test('renders a user message as plain text', () => {
        render(<MessageBubble role="user" content="What is the outlook?" />);
        expect(screen.getByText('What is the outlook?')).toBeInTheDocument();
    });

    test('routes assistant content through the markdown renderer', () => {
        render(<MessageBubble role="assistant" content="The outlook is positive." />);
        expect(screen.getByText('The outlook is positive.')).toBeInTheDocument();
    });

    test('normalizes bullet glyphs and <br> in assistant content before rendering', () => {
        const { container } = render(
            <MessageBubble role="assistant" content={'• first point<br>second line'} />,
        );
        // • -> "- " and <br> -> newline (our normalizeAssistantContent transform)
        expect(container.textContent).toContain('- first point');
        expect(container.textContent).toContain('second line');
        expect(container.textContent).not.toContain('•');
        expect(container.textContent).not.toContain('<br>');
    });
});

describe('ContextCard', () => {
    test('renders label, value and optional caption', () => {
        const { rerender } = render(<ContextCard label="Price" value="$182.50" />);
        expect(screen.getByText('Price')).toBeInTheDocument();
        expect(screen.getByText('$182.50')).toBeInTheDocument();

        rerender(<ContextCard label="Price" value="$182.50" caption="as of close" />);
        expect(screen.getByText('as of close')).toBeInTheDocument();
    });
});

describe('EvidencePanel', () => {
    test('renders nothing with no items and no status', () => {
        expect(render(<EvidencePanel items={[]} status={null} />).container).toBeEmptyDOMElement();
    });

    test('renders evidence items with title, snippet and doc type', () => {
        render(
            <EvidencePanel
                items={[{ title: '10-K excerpt', snippet: 'Revenue grew', docType: '10-K', ticker: 'AAPL' }]}
            />,
        );
        expect(screen.getByText('Retrieved evidence')).toBeInTheDocument();
        expect(screen.getByText('10-K excerpt')).toBeInTheDocument();
        expect(screen.getByText('Revenue grew')).toBeInTheDocument();
        expect(screen.getByText('10-K')).toBeInTheDocument();
    });

    test('shows an unavailable notice when retrieval is enabled but down', () => {
        render(<EvidencePanel items={[]} status={{ enabled: true, available: false }} />);
        expect(screen.getByText(/retrieval is temporarily unavailable/i)).toBeInTheDocument();
    });
});

describe('ArtifactPreview', () => {
    test('shows the empty placeholder without an artifact/version', () => {
        render(<ArtifactPreview artifact={null} version={null} />);
        expect(screen.getByText('Memo preview')).toBeInTheDocument();
    });

    test('renders the memo header and only the populated sections', () => {
        const artifact = { title: 'AAPL Thesis', ticker: 'AAPL' };
        const version = {
            version: 2,
            generationStatus: 'complete',
            structuredContent: {
                executive_summary: 'A concise summary.',
                risks: ['Supply chain', 'Valuation'],
            },
        };
        render(<ArtifactPreview artifact={artifact} version={version} />);

        expect(screen.getByRole('heading', { name: 'AAPL Thesis' })).toBeInTheDocument();
        expect(screen.getByText(/AAPL \| version 2 \| complete/)).toBeInTheDocument();
        expect(screen.getByText('Executive Summary')).toBeInTheDocument();
        expect(screen.getByText('A concise summary.')).toBeInTheDocument();
        expect(screen.getByText('Supply chain')).toBeInTheDocument();
        // a section absent from structuredContent is not rendered
        expect(screen.queryByText('Conclusion')).not.toBeInTheDocument();
    });
});
