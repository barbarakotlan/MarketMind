import { fireEvent, render, screen } from '@testing-library/react';
import { ProbabilityBar, AnalysisPanel, MarketCard } from './components';

describe('ProbabilityBar', () => {
    test('renders each outcome with its formatted probability', () => {
        render(<ProbabilityBar outcomes={['Yes', 'No']} prices={{ Yes: 0.62, No: 0.38 }} />);
        expect(screen.getByText('Yes: 62.0%')).toBeInTheDocument();
        expect(screen.getByText('No: 38.0%')).toBeInTheDocument();
    });
});

describe('AnalysisPanel', () => {
    const market = { id: 'm1' };

    test('idle: enabled analyze button fires onAnalyze', () => {
        const onAnalyze = vi.fn();
        render(<AnalysisPanel market={market} analysisEnabled onAnalyze={onAnalyze} analysisState={undefined} />);
        const button = screen.getByRole('button', { name: 'Analyze market' });
        fireEvent.click(button);
        expect(onAnalyze).toHaveBeenCalledTimes(1);
    });

    test('disabled + sign-in prompt when analysis is not enabled', () => {
        render(<AnalysisPanel market={market} analysisEnabled={false} onAnalyze={() => {}} />);
        expect(screen.getByRole('button', { name: 'Analyze market' })).toBeDisabled();
        expect(screen.getByText(/Sign in to generate Market vs Model/i)).toBeInTheDocument();
    });

    test('loading: shows the analyzing label and working panel', () => {
        render(<AnalysisPanel market={market} analysisEnabled onAnalyze={() => {}} analysisState={{ status: 'loading' }} />);
        expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();
        expect(screen.getByText(/Working through the market analysis/i)).toBeInTheDocument();
    });

    test('error: shows the failure message', () => {
        render(
            <AnalysisPanel
                market={market}
                analysisEnabled
                onAnalyze={() => {}}
                analysisState={{ status: 'error', error: 'model timeout' }}
            />,
        );
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
        expect(screen.getByText('model timeout')).toBeInTheDocument();
    });

    test('success: renders market/model odds, stance and brief', () => {
        const analysisState = {
            status: 'success',
            data: {
                market: { current_probability: 0.6 },
                analysis: { model_probability: 0.7, stance: 'lean_yes', delta: 0.1, brief: 'Edge to Yes.' },
                claims: [{ claim: 'Momentum', rationale: 'Recent polling' }],
            },
        };
        render(<AnalysisPanel market={market} analysisEnabled onAnalyze={() => {}} analysisState={analysisState} />);

        expect(screen.getByText('60.0%')).toBeInTheDocument(); // market odds
        expect(screen.getByText('70.0%')).toBeInTheDocument(); // model odds
        expect(screen.getByText('Lean Yes')).toBeInTheDocument();
        expect(screen.getByText('Edge to Yes.')).toBeInTheDocument();
        expect(screen.getByText('Momentum')).toBeInTheDocument();
        // 'Refresh analysis' once a result exists
        expect(screen.getByRole('button', { name: 'Refresh analysis' })).toBeInTheDocument();
    });
});

describe('MarketCard', () => {
    const baseMarket = {
        id: 'm1',
        question: 'Will X happen?',
        outcomes: ['Yes', 'No'],
        prices: { Yes: 0.6, No: 0.4 },
        volume: 1000,
        is_open: true,
        description: 'A market about X.',
    };
    const common = { onTradeComplete: vi.fn(), onAnalyze: vi.fn(), analysisEnabled: false };

    test('collapsed: shows the question and fires onToggle, hides the buy form', () => {
        const onToggle = vi.fn();
        render(<MarketCard market={baseMarket} isExpanded={false} onToggle={onToggle} {...common} />);

        expect(screen.getByRole('heading', { name: 'Will X happen?' })).toBeInTheDocument();
        expect(screen.queryByText('Contracts')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Will X happen/ }));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    test('expanded + open: selecting an outcome reveals the contracts input and cost', () => {
        render(<MarketCard market={baseMarket} isExpanded onToggle={() => {}} {...common} />);

        fireEvent.click(screen.getByRole('button', { name: /Yes @ 60\.0%/ }));
        expect(screen.getByText('Contracts')).toBeInTheDocument();
        expect(screen.getByText('$0.00')).toBeInTheDocument(); // est. cost before entering contracts
    });

    test('expanded + closed: shows a closed-for-trading notice instead of the form', () => {
        render(<MarketCard market={{ ...baseMarket, is_open: false }} isExpanded onToggle={() => {}} {...common} />);
        expect(screen.getByText(/closed for trading/i)).toBeInTheDocument();
    });
});
