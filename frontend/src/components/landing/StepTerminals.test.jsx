import { render, screen } from '@testing-library/react';
import StepTerminals from './StepTerminals';

// framer-motion's whileInView relies on IntersectionObserver (absent in jsdom),
// and the terminal typer runs timers; stub the observer and use fake timers so
// the static content renders deterministically.
beforeAll(() => {
    global.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
});

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('StepTerminals', () => {
    test('renders the three how-it-works step titles', () => {
        render(<StepTerminals />);
        expect(screen.getByText('Search Any Asset')).toBeInTheDocument();
        expect(screen.getByText('Analyze the AI Forecast')).toBeInTheDocument();
        expect(screen.getByText('Trade Risk-Free')).toBeInTheDocument();
    });
});
