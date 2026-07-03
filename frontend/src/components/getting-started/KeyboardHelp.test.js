import { fireEvent, render, screen } from '@testing-library/react';
import KeyboardHelp from './KeyboardHelp';

describe('KeyboardHelp', () => {
    test('lists the shortcuts and closes via the button', () => {
        const onClose = jest.fn();
        render(<KeyboardHelp onClose={onClose} />);

        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
        expect(screen.getByText('Previous chapter')).toBeInTheDocument();
        expect(screen.getByText('Mark chapter complete')).toBeInTheDocument();
        expect(screen.getByText('Open search')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
