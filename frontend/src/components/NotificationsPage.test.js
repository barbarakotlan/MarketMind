import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsPage from './NotificationsPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        NOTIFICATIONS: '/notifications',
        NOTIFICATIONS_SMART: '/notifications/smart',
        NOTIFICATION: jest.fn((id) => `/notifications/${id}`),
        NOTIFICATION_TRIGGERED: jest.fn((id) => `/notifications/triggered/${id}`),
        NOTIFICATIONS_TRIGGERED: jest.fn((all = false) =>
            all ? '/notifications/triggered?all=true' : '/notifications/triggered'
        ),
    },
    apiRequest: jest.fn(),
}));

describe('NotificationsPage', () => {
    beforeEach(() => {
        API_ENDPOINTS.NOTIFICATIONS_TRIGGERED.mockImplementation((all = false) =>
            all ? '/notifications/triggered?all=true' : '/notifications/triggered'
        );

        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.NOTIFICATIONS) {
                return Promise.resolve([]);
            }

            if (url === '/notifications/triggered?all=true') {
                return Promise.resolve([
                    {
                        id: 'alert-1',
                        message: 'AAPL crossed above $200',
                        timestamp: '2026-03-12T10:00:00Z',
                    },
                ]);
            }

            if (url === '/notifications/triggered' && options.method === 'DELETE') {
                return Promise.resolve({ message: 'Triggered alerts cleared' });
            }

            return Promise.resolve([]);
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('clears triggered alerts even when no onClearAlerts prop is provided', async () => {
        render(<NotificationsPage />);

        expect(await screen.findByText('AAPL crossed above $200')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Clear All'));

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith('/notifications/triggered', { method: 'DELETE' });
        });

        expect(screen.queryByText('AAPL crossed above $200')).not.toBeInTheDocument();
        expect(screen.getByText('No recent notifications')).toBeInTheDocument();
    });

    test('shows the backend success message for smart alerts', async () => {
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.NOTIFICATIONS) {
                return Promise.resolve([]);
            }

            if (url === '/notifications/triggered?all=true') {
                return Promise.resolve([]);
            }

            if (url === API_ENDPOINTS.NOTIFICATIONS_SMART && options.method === 'POST') {
                return Promise.resolve({ message: 'Watching MSFT for above events.' });
            }

            return Promise.resolve([]);
        });

        render(<NotificationsPage />);

        fireEvent.click(screen.getByRole('button', { name: /AI Smart Alert/i }));
        fireEvent.change(screen.getByPlaceholderText(/Notify me when Apple releases earnings/i), {
            target: { value: 'Notify me when Microsoft rises above 500' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Generate Smart Alert/i }));

        expect(await screen.findByText('Watching MSFT for above events.')).toBeInTheDocument();
    });

    test('surfaces the real smart alert validation error', async () => {
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.NOTIFICATIONS) {
                return Promise.resolve([]);
            }

            if (url === '/notifications/triggered?all=true') {
                return Promise.resolve([]);
            }

            if (url === API_ENDPOINTS.NOTIFICATIONS_SMART && options.method === 'POST') {
                return Promise.reject(new Error('Could not identify a specific stock or asset.'));
            }

            return Promise.resolve([]);
        });

        render(<NotificationsPage />);

        fireEvent.click(screen.getByRole('button', { name: /AI Smart Alert/i }));
        fireEvent.change(screen.getByPlaceholderText(/Notify me when Apple releases earnings/i), {
            target: { value: 'Tell me when something big happens' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Generate Smart Alert/i }));

        expect(await screen.findByText('Could not identify a specific stock or asset.')).toBeInTheDocument();
        expect(screen.queryByText(/AI Backend not connected/i)).not.toBeInTheDocument();
    });
});
