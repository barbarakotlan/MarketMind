import { render, screen } from '@testing-library/react';
import GettingStartedPage from './GettingStartedPage';

describe('GettingStartedPage', () => {
    test('renders the learning center overview with modules', () => {
        render(<GettingStartedPage />);

        // Page title renders.
        expect(screen.getAllByText(/Learning Center/i).length).toBeGreaterThan(0);
        // The learning modules from data/content are listed (each card shows a chapter count).
        expect(screen.getAllByText(/Chapters/i).length).toBeGreaterThan(0);
    });
});
