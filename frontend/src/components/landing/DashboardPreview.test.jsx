import { render, screen } from '@testing-library/react';
import DashboardPreview from './DashboardPreview';

describe('DashboardPreview', () => {
    test('renders the mock dashboard sections', () => {
        render(<DashboardPreview />);
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText(/AI Forecast/)).toBeInTheDocument();
        expect(screen.getByText('Paper Portfolio')).toBeInTheDocument();
    });
});
