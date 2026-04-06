import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    test('uses an internal placeholder image instead of external fallback URLs', async () => {
        apiRequest.mockResolvedValue([
            {
                title: 'No image article',
                publisher: 'Reuters',
                publishTime: 'N/A',
                link: 'https://example.com/no-image',
            },
        ]);

        render(<NewsPage />);

        const image = await screen.findByAltText('No image article');
        expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
        expect(image.getAttribute('src')).not.toContain('via.placeholder.com');
        expect(image.getAttribute('src')).not.toContain('images.unsplash.com');
    });

    test('swaps broken article images to the internal placeholder', async () => {
        apiRequest.mockResolvedValue([
            {
                title: 'Broken image article',
                publisher: 'Reuters',
                publishTime: 'N/A',
                image: 'https://example.com/broken-image.jpg',
                link: 'https://example.com/broken',
            },
        ]);

        render(<NewsPage />);

        const image = await screen.findByAltText('Broken image article');
        fireEvent.error(image);

        expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
        expect(image.getAttribute('src')).not.toContain('images.unsplash.com');
    });

    test('renders sentiment badges when article sentiment is scored', async () => {
        apiRequest.mockResolvedValue([
            {
                title: 'Constructive demand outlook',
                publisher: 'Reuters',
                publishTime: '2026-04-02T10:00:00Z',
                link: 'https://example.com/constructive',
                sentiment: {
                    status: 'scored',
                    label: 'positive',
                    confidence: 0.82,
                },
            },
        ]);

        render(<NewsPage />);

        expect(await screen.findByText('Constructive demand outlook')).toBeInTheDocument();
        expect(screen.getByText('Positive')).toBeInTheDocument();
    });
});
