import { fireEvent, render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

jest.mock('../context/DarkModeContext', () => ({
    useDarkMode: () => ({ isDarkMode: false, toggleDarkMode: jest.fn() }),
}));

// jsdom doesn't implement IntersectionObserver, which framer-motion's
// whileInView relies on. A no-op stub lets the page render.
beforeAll(() => {
    global.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
});

describe('LandingPage', () => {
    test('renders the nav and hero and triggers onEnterApp from the CTA', () => {
        const onEnterApp = jest.fn();
        render(<LandingPage onEnterApp={onEnterApp} />);

        // Nav links render (may appear more than once across sections).
        expect(screen.getAllByRole('button', { name: /Features/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: /How it works/i }).length).toBeGreaterThan(0);

        // A "Launch App" CTA is present and wired to onEnterApp.
        const launchButtons = screen.getAllByRole('button', { name: /Launch App/i });
        expect(launchButtons.length).toBeGreaterThan(0);
        fireEvent.click(launchButtons[0]);
        expect(onEnterApp).toHaveBeenCalledTimes(1);
    });
});
