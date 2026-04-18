import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewsPage from './NewsPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

// --- MOCKING ---
// Mock the API configuration and network request function.
// This isolates the NewsPage component, allowing us to simulate various
// API responses (like missing data or different data structures) without making real network calls.
jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        // Mock the endpoint builder to handle both global news and search queries
        NEWS: jest.fn((query = '') => (query ? `/news?q=${query}` : '/api/news')),
    },
    apiRequest: jest.fn(),
}));

describe('NewsPage', () => {
    // --- TEARDOWN ---
    // Ensure that mock call histories and resolved values are wiped clean after every test
    // to prevent state from leaking between test cases.
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('falls back to "Recent" when a news search result has no valid publish time', async () => {
        // 1. ARRANGE: Mock a payload where the publishTime is an unparseable string ('N/A')
        apiRequest.mockResolvedValue([
            {
                title: 'Fed holds rates steady',
                publisher: 'Reuters',
                publishTime: 'N/A',
                link: 'https://example.com/fed',
            },
        ]);

        // 2. ACT: Render the component
        render(<NewsPage />);

        // Wait for the initial data fetch to fire
        await waitFor(() => {
            expect(API_ENDPOINTS.NEWS).toHaveBeenCalledWith();
        });

        // 3. ASSERT: Verify the normalization logic handled the bad date
        expect(await screen.findByText('Fed holds rates steady')).toBeInTheDocument();
        expect(screen.getByText('Reuters')).toBeInTheDocument();
        
        // It should display 'Recent' instead of crashing or displaying 'Invalid Date'
        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    });

    test('normalizes source names and unix timestamps from the general news feed', async () => {
        // 1. ARRANGE: Mock a payload with an alternative structure (e.g., from a different news provider)
        // Uses 'headline' instead of 'title', a nested 'source' object, and a unix timestamp
        apiRequest.mockResolvedValue([
            {
                headline: 'Markets open higher',
                source: { name: 'Bloomberg' },
                datetime: 1710000000, 
                url: 'https://example.com/open',
            },
        ]);

        // 2. ACT: Render the component
        render(<NewsPage />);

        // 3. ASSERT: Verify the component successfully mapped these alternate fields to standard UI elements
        expect(await screen.findByText('Markets open higher')).toBeInTheDocument();
        expect(screen.getByText('Bloomberg')).toBeInTheDocument();
        expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    });

    test('uses an internal placeholder image instead of external fallback URLs', async () => {
        // 1. ARRANGE: Mock an article that completely omits the image property
        apiRequest.mockResolvedValue([
            {
                title: 'No image article',
                publisher: 'Reuters',
                publishTime: 'N/A',
                link: 'https://example.com/no-image',
            },
        ]);

        // 2. ACT: Render the component
        render(<NewsPage />);

        // 3. ASSERT: Verify the fallback image logic
        const image = await screen.findByAltText('No image article');
        
        // Ensure the source is our lightweight SVG data URI, not an external service that could go down or track users
        expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
        expect(image.getAttribute('src')).not.toContain('via.placeholder.com');
        expect(image.getAttribute('src')).not.toContain('images.unsplash.com');
    });

    test('swaps broken article images to the internal placeholder', async () => {
        // 1. ARRANGE: Mock an article that provides an image URL, but we will pretend it's broken
        apiRequest.mockResolvedValue([
            {
                title: 'Broken image article',
                publisher: 'Reuters',
                publishTime: 'N/A',
                image: 'https://example.com/broken-image.jpg',
                link: 'https://example.com/broken',
            },
        ]);

        // 2. ACT: Render and locate the image
        render(<NewsPage />);
        const image = await screen.findByAltText('Broken image article');
        
        // Simulate the browser firing an 'error' event on the <img> tag because the URL failed to load
        fireEvent.error(image);

        // 3. ASSERT: Verify the onError handler successfully swapped the src to the SVG placeholder
        expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
        expect(image.getAttribute('src')).not.toContain('images.unsplash.com');
    });

    test('renders sentiment badges when article sentiment is scored', async () => {
        // 1. ARRANGE: Mock an article that includes a sentiment analysis object
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

        // 2. ACT: Render the component
        render(<NewsPage />);

        // 3. ASSERT: Verify that the conditional logic recognizes the sentiment object and renders the badge
        expect(await screen.findByText('Constructive demand outlook')).toBeInTheDocument();
        
        // The utility function should have capitalized the label
        expect(screen.getByText('Positive')).toBeInTheDocument();
    });
});
