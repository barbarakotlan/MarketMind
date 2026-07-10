import { fireEvent, render, screen } from '@testing-library/react';
import RouteErrorBoundary from './RouteErrorBoundary';


function BrokenView() {
    throw new Error('render failed');
}

describe('RouteErrorBoundary', () => {
    test('contains a page render failure and offers recovery', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const onRetry = vi.fn();

        render(
            <RouteErrorBoundary onRetry={onRetry}>
                <BrokenView />
            </RouteErrorBoundary>
        );

        expect(screen.getByText('This view could not be loaded')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
    });
});
