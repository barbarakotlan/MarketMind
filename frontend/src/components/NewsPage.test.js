import { render, screen, waitFor } from '@testing-library/react';
import NewsPage from './NewsPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        NEWS: jest.fn((query = '') => (query ? `/news?q=${query}` : '/api/news')),
    },
    apiRequest: jest.fn(),
}));

describe('NewsPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('falls back to "Recent" when a news search result has no valid publish time', async () => {
        apiRequest.mockResolvedValue([
            {
                title: 'Fed holds rates steady',
                publisher: 'Reuters',
                publishTime: 'N/A',
                link: 'https://example.com/fed',
            },
        ]);

        render(<NewsPage />);

        await waitFor(() => {
            expect(API_ENDPOINTS.NEWS).toHaveBeenCalledWith();
        });

        expect(await screen.findByText('Fed holds rates steady')).toBeInTheDocument();
        expect(screen.getByText('Reuters')).toBeInTheDocument();
        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    });

    test('normalizes source names and unix timestamps from the general news feed', async () => {
        apiRequest.mockResolvedValue([
            {
                headline: 'Markets open higher',
                source: { name: 'Bloomberg' },
                datetime: 1710000000,
                url: 'https://example.com/open',
            },
        ]);

        render(<NewsPage />);

        expect(await screen.findByText('Markets open higher')).toBeInTheDocument();
        expect(screen.getByText('Bloomberg')).toBeInTheDocument();
        expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    });
});
