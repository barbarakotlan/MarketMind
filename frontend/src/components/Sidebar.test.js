import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Sidebar from './Sidebar';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('@clerk/clerk-react', () => ({
    UserButton: () => <div>User Button</div>,
}));

jest.mock('../context/DarkModeContext', () => ({
    useDarkMode: () => ({
        isDarkMode: false,
        toggleDarkMode: jest.fn(),
    }),
}));

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        MARKETMIND_AI_CHATS: '/marketmind-ai/chats',
        MARKETMIND_AI_CHAT_DELETE: jest.fn((chatId) => `/marketmind-ai/chats/${chatId}`),
        NOTIFICATIONS_TRIGGERED: jest.fn((all = false) =>
            all ? '/notifications/triggered?all=true' : '/notifications/triggered'
        ),
    },
    apiRequest: jest.fn(),
}));

describe('Sidebar alert badge polling', () => {
    beforeEach(() => {
        API_ENDPOINTS.NOTIFICATIONS_TRIGGERED.mockImplementation((all = false) =>
            all ? '/notifications/triggered?all=true' : '/notifications/triggered'
        );
        API_ENDPOINTS.MARKETMIND_AI_CHAT_DELETE.mockImplementation((chatId) => `/marketmind-ai/chats/${chatId}`);
        apiRequest.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('checks triggered alerts with the non-destructive all=true query', async () => {
        render(
            <Sidebar
                activePage="dashboard"
                setActivePage={jest.fn()}
                isCollapsed={false}
                onToggleCollapse={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED).toHaveBeenCalledWith(true);
        });
        expect(apiRequest).toHaveBeenCalledWith('/notifications/triggered?all=true');
        expect(apiRequest).toHaveBeenCalledWith('/marketmind-ai/chats');
    });

    test('renders the workflow-first navigation groups', async () => {
        render(
            <Sidebar
                activePage="dashboard"
                setActivePage={jest.fn()}
                isCollapsed={false}
                onToggleCollapse={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Research')).toBeInTheDocument();
        });

        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.getAllByText('Portfolio').length).toBeGreaterThan(0);
        expect(screen.getByText('Markets')).toBeInTheDocument();
        expect(screen.getAllByText('Macro').length).toBeGreaterThan(0);
        expect(screen.getByText('Prediction Markets')).toBeInTheDocument();
        expect(screen.getAllByText('Learn').length).toBeGreaterThan(0);
    });

    test('deletes a recent MarketMindAI chat from the sidebar via trash icon', async () => {
        let chats = [{ id: 'chat-1', title: 'Analyze AAPL', attachedTicker: 'AAPL' }];
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === '/notifications/triggered?all=true') {
                return Promise.resolve([]);
            }
            if (url === '/marketmind-ai/chats' && !options.method) {
                return Promise.resolve(chats);
            }
            if (url === '/marketmind-ai/chats/chat-1' && options.method === 'DELETE') {
                chats = [];
                return Promise.resolve({ deleted: true, chatId: 'chat-1' });
            }
            throw new Error(`Unhandled url ${url}`);
        });

        render(
            <Sidebar
                activePage="marketmindAI"
                setActivePage={jest.fn()}
                isCollapsed={false}
                onToggleCollapse={jest.fn()}
            />
        );

        expect(await screen.findByText(/Analyze AAPL/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Delete chat Analyze AAPL/i }));

        await waitFor(() => {
            expect(API_ENDPOINTS.MARKETMIND_AI_CHAT_DELETE).toHaveBeenCalledWith('chat-1');
        });
        expect(apiRequest).toHaveBeenCalledWith('/marketmind-ai/chats/chat-1', { method: 'DELETE' });
        await waitFor(() => {
            expect(screen.queryByText(/Analyze AAPL/i)).not.toBeInTheDocument();
        });
    });
});
