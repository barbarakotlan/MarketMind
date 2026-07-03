import { render, screen } from '@testing-library/react';
import MarqueeTicker from './MarqueeTicker';

describe('MarqueeTicker', () => {
    test('renders the live badge and mock ticker items after mount', () => {
        render(<MarqueeTicker />);
        expect(screen.getByText('Live')).toBeInTheDocument();
        // Items are duplicated for the seamless marquee loop.
        expect(screen.getAllByText('S&P 500').length).toBeGreaterThan(0);
        expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
        expect(screen.getAllByText('BTC').length).toBeGreaterThan(0);
    });
});
