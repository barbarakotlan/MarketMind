import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsPage from './NotificationsPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// --- MOCKING ---
// Mock the API configuration and the network request fetcher.
// This allows us to simulate backend responses (successes, errors, specific payloads)
// without making real HTTP requests during our unit tests.
jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        NOTIFICATIONS: '/notifications',
        NOTIFICATIONS_SMART: '/notifications/smart',
        NOTIFICATION: jest.fn((id) => `/notifications/${id}`),
        NOTIFICATION_TRIGGERED: jest.fn((id) => `/notifications/triggered/${id}`),
        // Mock the query parameter builder for fetching triggered alerts
        NOTIFICATIONS_TRIGGERED: jest.fn((all = false) =>
            all ? '/notifications/triggered?all=true' : '/notifications/triggered'
        ),
    },
    apiRequest: jest.fn(),
}));

describe('NotificationsPage', () => {
    // --- SETUP & TEARDOWN ---
    
    beforeEach(() => {
        // Re-establish the mock implementation for the endpoint builder before each test
        API_ENDPOINTS.NOTIFICATIONS_TRIGGERED.mockImplementation((all = false) =>
            all ? '/notifications/triggered?all=true' : '/notifications/triggered'
        );

        // Set up a default routing mechanism for our mocked apiRequest.
        // This acts as a fake backend server, responding differently based on the URL and HTTP method.
        apiRequest.mockImplementation((url, options = {}) => {
            // Default response for active alerts: empty array
            if (url === API_ENDPOINTS.NOTIFICATIONS) {
                return Promise.resolve([]);
            }

            // Default response for fetching all triggered alerts: one simulated alert
            if (url === '/notifications/triggered?all=true') {
                return Promise.resolve([
                    {
                        id: 'alert-1',
                        message: 'AAPL crossed above $200',
                        timestamp: '2026-03-12T10:00:00Z',
                    },
                ]);
            }

            // Default response for the "Clear All" deletion request
            if (url === '/notifications/triggered' && options.method === 'DELETE') {
                return Promise.resolve({ message: 'Triggered alerts cleared' });
            }

            // Catch-all fallback
            return Promise.resolve([]);
        });
    });

    afterEach(() => {
        // Clear mock invocation history to prevent state leakage between tests
        jest.clearAllMocks();
    });

    // --- TEST CASES ---

    test('clears triggered alerts even when no onClearAlerts prop is provided', async () => {
        // 1. ARRANGE: Render the component without passing the optional `onClearAlerts` prop
        render(<NotificationsPage />);

        // Verify that our mocked triggered alert is initially rendered in the UI
        expect(await screen.findByText('AAPL crossed above $200')).toBeInTheDocument();

        // 2. ACT: Simulate the user clicking the "Clear All" button
        fireEvent.click(screen.getByText('Clear All'));

        // 3. ASSERT: Verify the API was called with the correct method
        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith('/notifications/triggered', { method: 'DELETE' });
        });

        // Verify the UI updates optimistically to remove the cleared alert and show the empty state
        expect(screen.queryByText('AAPL crossed above $200')).not.toBeInTheDocument();
        expect(screen.getByText('No recent notifications')).toBeInTheDocument();
    });

    test('shows the backend success message for smart alerts', async () => {
        // 1. ARRANGE: Override the default mock to specifically handle the SMART notifications POST request
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.NOTIFICATIONS) return Promise.resolve([]);
            if (url === '/notifications/triggered?all=true') return Promise.resolve([]);

            // Simulate a successful AI prompt parsing from the backend
            if (url === API_ENDPOINTS.NOTIFICATIONS_SMART && options.method === 'POST') {
                return Promise.resolve({ message: 'Watching MSFT for above events.' });
            }
            return Promise.resolve([]);
        });

        render(<NotificationsPage />);

        // 2. ACT: Switch to the AI tab, fill out the prompt, and submit
        fireEvent.click(screen.getByRole('button', { name: /AI Smart Alert/i }));
        fireEvent.change(screen.getByPlaceholderText(/Notify me when Apple releases earnings/i), {
            target: { value: 'Notify me when Microsoft rises above 500' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Generate Smart Alert/i }));

        // 3. ASSERT: Verify the dynamic success message generated by the backend is displayed
        expect(await screen.findByText('Watching MSFT for above events.')).toBeInTheDocument();
    });

    test('surfaces the real smart alert validation error', async () => {
        // 1. ARRANGE: Override the mock to simulate an AI processing failure (e.g., ambiguous prompt)
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.NOTIFICATIONS) return Promise.resolve([]);
            if (url === '/notifications/triggered?all=true') return Promise.resolve([]);

            // Simulate the backend rejecting the prompt because it lacks context
            if (url === API_ENDPOINTS.NOTIFICATIONS_SMART && options.method === 'POST') {
                return Promise.reject(new Error('Could not identify a specific stock or asset.'));
            }
            return Promise.resolve([]);
        });

        render(<NotificationsPage />);

        // 2. ACT: Submit a vague AI prompt
        fireEvent.click(screen.getByRole('button', { name: /AI Smart Alert/i }));
        fireEvent.change(screen.getByPlaceholderText(/Notify me when Apple releases earnings/i), {
            target: { value: 'Tell me when something big happens' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Generate Smart Alert/i }));

        // 3. ASSERT: Verify the exact error string from the backend is caught and rendered in the FormNotification banner
        expect(await screen.findByText('Could not identify a specific stock or asset.')).toBeInTheDocument();
        // Ensure we aren't showing a generic fallback error
        expect(screen.queryByText(/AI Backend not connected/i)).not.toBeInTheDocument();
    });
});
