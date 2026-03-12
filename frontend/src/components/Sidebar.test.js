import { render, waitFor } from '@testing-library/react';
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
    });
});
