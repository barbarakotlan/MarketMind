import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketMindAIPage from './MarketMindAIPage';
import { API_ENDPOINTS, apiRequest } from '../config/api';

jest.mock('react-markdown', () => ({ children }) => <div>{children}</div>);
jest.mock('remark-gfm', () => () => null);

jest.mock('@clerk/clerk-react', () => ({
    useAuth: () => ({
        isLoaded: true,
        isSignedIn: true,
    }),
}));

jest.mock('../config/api', () => ({
    API_ENDPOINTS: {
        MARKETMIND_AI_BOOTSTRAP: '/marketmind-ai/bootstrap',
        MARKETMIND_AI_CHATS: '/marketmind-ai/chats',
        MARKETMIND_AI_CHAT_DETAIL: (chatId) => `/marketmind-ai/chats/${chatId}`,
        MARKETMIND_AI_CONTEXT: (ticker) => `/marketmind-ai/context?ticker=${ticker}`,
        MARKETMIND_AI_CHAT: '/marketmind-ai/chat',
        MARKETMIND_AI_ARTIFACT_PREFLIGHT: '/marketmind-ai/artifacts/preflight',
        MARKETMIND_AI_ARTIFACTS: '/marketmind-ai/artifacts',
        MARKETMIND_AI_ARTIFACT: (artifactId) => `/marketmind-ai/artifacts/${artifactId}`,
        MARKETMIND_AI_ARTIFACT_DOWNLOAD: (artifactId, versionId) =>
            `/marketmind-ai/artifacts/${artifactId}/versions/${versionId}/download`,
    },
    apiRequest: jest.fn(),
}));

const artifactDetailPayload = {
    artifact: {
        id: 'artifact-1',
        templateKey: 'investment_thesis_memo',
        ticker: 'AAPL',
        title: 'AAPL Investment Thesis Memo',
        latestVersion: 1,
        status: 'draft',
    },
    versions: [
        {
            id: 'version-1',
            version: 1,
            generationStatus: 'completed',
            hasArtifact: true,
            retrievedEvidence: [
                {
                    docType: 'sec_section',
                    title: '10-K · Risk Factors',
                    snippet: 'Supply chain disruption remains a material risk.',
                    source: 'sec',
                    sourceUrl: 'https://www.sec.gov/example-10k',
                    assetId: 'AAPL',
                    ticker: 'AAPL',
                },
            ],
            retrievalStatus: {
                enabled: true,
                available: true,
                used: true,
                rerankUsed: true,
            },
            structuredContent: {
                executive_summary: 'Generated memo preview',
                investment_thesis: 'The thesis is grounded in current context.',
            },
        },
    ],
};

describe('MarketMindAIPage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders as a chat-first workspace with starter prompts and no artifact panel by default', async () => {
        apiRequest.mockImplementation((url) => {
            if (url === API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP) {
                return Promise.resolve({
                    starterPrompts: ['What are the biggest risks to AAPL over the next two quarters?'],
                    templates: [{ key: 'investment_thesis_memo', label: 'Investment Thesis Memo' }],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHATS) {
                return Promise.resolve([]);
            }
            throw new Error(`Unhandled url ${url}`);
        });

        render(<MarketMindAIPage />);

        expect(await screen.findByRole('button', { name: /New chat/i })).toBeInTheDocument();
        expect(await screen.findByText(/What are the biggest risks to AAPL/i)).toBeInTheDocument();
        expect(screen.queryByText(/Memo preview/i)).not.toBeInTheDocument();
    });

    test('infers the intended ticker from natural prompts and opens artifact panel after memo generation', async () => {
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP) {
                return Promise.resolve({
                    starterPrompts: ['Summarize the current setup for NVDA using predictions, news, and fundamentals.'],
                    templates: [{ key: 'investment_thesis_memo', label: 'Investment Thesis Memo' }],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHATS && !options.method) {
                return Promise.resolve([]);
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CONTEXT('NVDA')) {
                return Promise.resolve({
                    ticker: 'NVDA',
                    watchlistMembership: true,
                    activeAlerts: [],
                    marketSession: {
                        status: 'open',
                        exchange: 'NASDAQ',
                        timezone: 'America/New_York',
                        closesAt: '2026-04-02T16:00:00-04:00',
                        reason: 'regular_hours',
                    },
                    predictionSnapshot: {
                        recentClose: 890,
                        recentPredicted: 905,
                        confidence: 81,
                    },
                    recentNews: [{ title: 'NVIDIA headline' }],
                    fundamentalsSummary: {
                        companyName: 'NVIDIA Corporation',
                        sector: 'Technology',
                    },
                    paperTradeHistory: [],
                    currentPaperPosition: {},
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHAT && options.method === 'POST') {
                return Promise.resolve({
                    assistantMessage: {
                        role: 'assistant',
                        content: [
                            'Here is a grounded reply.',
                            '',
                            '| Risk | Why it matters |',
                            '| --- | --- |',
                            '| Valuation | Premium multiple creates downside if growth slows. |',
                        ].join('\n'),
                    },
                    retrievedEvidence: [
                        {
                            docType: 'sec_section',
                            title: '10-K · Risk Factors',
                            snippet: 'Supply chain disruption remains a material risk.',
                            source: 'sec',
                            sourceUrl: 'https://www.sec.gov/example-10k',
                            assetId: 'NVDA',
                            ticker: 'NVDA',
                        },
                    ],
                    retrievalStatus: {
                        enabled: true,
                        available: true,
                        used: true,
                        rerankUsed: true,
                    },
                    suggestedActions: [],
                    artifactIntent: {
                        templateKey: 'investment_thesis_memo',
                        label: 'Investment Thesis Memo',
                        autoGenerate: true,
                    },
                    tickerResolution: {
                        resolvedTicker: 'NVDA',
                        previousTicker: null,
                        status: 'switched',
                    },
                    chat: {
                        id: 'chat-1',
                        title: 'Summarize the current setup for NVDA using predictions, news, and fundamentals.',
                        attachedTicker: 'NVDA',
                        lastMessagePreview: 'Here is a grounded reply.',
                        latestArtifactId: null,
                        updatedAt: '2026-03-22T13:00:00Z',
                    },
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_ARTIFACT_PREFLIGHT && options.method === 'POST') {
                return Promise.resolve({
                    status: 'ready',
                    requiredItems: [],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_ARTIFACTS && options.method === 'POST') {
                return Promise.resolve({
                    artifact: {
                        id: 'artifact-1',
                        ticker: 'NVDA',
                        title: 'NVDA Investment Thesis Memo',
                        latestVersion: 1,
                    },
                    chat: {
                        id: 'chat-1',
                        title: 'Summarize the current setup for NVDA using predictions, news, and fundamentals.',
                        attachedTicker: 'NVDA',
                        lastMessagePreview: 'Here is a grounded reply.',
                        latestArtifactId: 'artifact-1',
                        updatedAt: '2026-03-22T13:00:00Z',
                    },
                    version: {
                        id: 'version-1',
                        version: 1,
                        generationStatus: 'completed',
                        structuredContent: {
                            executive_summary: 'Generated memo preview',
                        },
                    },
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_ARTIFACT('artifact-1')) {
                return Promise.resolve(artifactDetailPayload);
            }
            throw new Error(`Unhandled url ${url}`);
        });

        render(<MarketMindAIPage />);

        fireEvent.change(screen.getByPlaceholderText(/Ask MarketMindAI about a ticker/i), {
            target: { value: 'Summarize the current setup for NVDA using predictions, news, and fundamentals.' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith(
                API_ENDPOINTS.MARKETMIND_AI_CHAT,
                expect.objectContaining({ method: 'POST' })
            );
        });

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith(API_ENDPOINTS.MARKETMIND_AI_CONTEXT('NVDA'));
        });

        expect((await screen.findAllByText(/Here is a grounded reply/i)).length).toBeGreaterThan(0);
        expect(await screen.findByText(/Valuation/i)).toBeInTheDocument();
        expect((await screen.findAllByText(/Summarize the current setup for NVDA using predictions, news, and fundamentals\./i)).length).toBeGreaterThan(0);
        expect(await screen.findByText('Market session')).toBeInTheDocument();
        expect(screen.getByText('Open')).toBeInTheDocument();
        expect(await screen.findByText(/Retrieved evidence/i)).toBeInTheDocument();
        expect((await screen.findAllByText(/10-K · Risk Factors/i)).length).toBeGreaterThan(0);

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith(
                API_ENDPOINTS.MARKETMIND_AI_ARTIFACTS,
                expect.objectContaining({ method: 'POST' })
            );
        });

        expect((await screen.findAllByText(/Investment Thesis Memo/i)).length).toBeGreaterThan(0);
        expect(await screen.findByText(/Generated memo preview/i)).toBeInTheDocument();
        expect(await screen.findByText(/Memo evidence/i)).toBeInTheDocument();
    });

    test('reconciles a stale saved ticker with the backend-resolved ticker and closes mismatched artifacts', async () => {
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP) {
                return Promise.resolve({
                    starterPrompts: ['What are the biggest risks to AAPL over the next two quarters?'],
                    templates: [{ key: 'investment_thesis_memo', label: 'Investment Thesis Memo' }],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHATS && !options.method) {
                return Promise.resolve([]);
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHAT_DETAIL('chat-good')) {
                return Promise.resolve({
                    chat: {
                        id: 'chat-good',
                        title: 'What do you think about GOOD right now?',
                        attachedTicker: 'GOOD',
                        latestArtifactId: 'artifact-good',
                    },
                    messages: [
                        { id: 'm1', role: 'user', content: 'What do you think about GOOD right now?' },
                        { id: 'm2', role: 'assistant', content: 'GOOD looks stable.' },
                    ],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CONTEXT('GOOD')) {
                return Promise.resolve({
                    ticker: 'GOOD',
                    watchlistMembership: false,
                    activeAlerts: [],
                    predictionSnapshot: {
                        recentClose: 11.7,
                        recentPredicted: 11.73,
                        confidence: 94.7,
                    },
                    recentNews: [{ title: 'GOOD headline' }],
                    fundamentalsSummary: {
                        companyName: 'Gladstone Commercial Corporation',
                        sector: 'Real Estate',
                    },
                    paperTradeHistory: [],
                    currentPaperPosition: {},
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_ARTIFACT('artifact-good')) {
                return Promise.resolve({
                    artifact: {
                        id: 'artifact-good',
                        templateKey: 'investment_thesis_memo',
                        ticker: 'GOOD',
                        title: 'GOOD Investment Thesis Memo',
                        latestVersion: 1,
                        status: 'draft',
                    },
                    versions: [
                        {
                            id: 'version-good',
                            version: 1,
                            generationStatus: 'completed',
                            hasArtifact: true,
                            structuredContent: {
                                executive_summary: 'Memo for GOOD',
                            },
                        },
                    ],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHAT && options.method === 'POST') {
                return Promise.resolve({
                    assistantMessage: {
                        role: 'assistant',
                        content: 'Here is the MSFT-specific breakdown.',
                    },
                    suggestedActions: [],
                    artifactIntent: null,
                    tickerResolution: {
                        resolvedTicker: 'MSFT',
                        previousTicker: 'GOOD',
                        status: 'switched',
                    },
                    chat: {
                        id: 'chat-good',
                        title: 'What would make a bullish thesis on MSFT break down?',
                        attachedTicker: 'MSFT',
                        latestArtifactId: null,
                    },
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CONTEXT('MSFT')) {
                return Promise.resolve({
                    ticker: 'MSFT',
                    watchlistMembership: true,
                    activeAlerts: [],
                    predictionSnapshot: {
                        recentClose: 382,
                        recentPredicted: 389,
                        confidence: 83,
                    },
                    recentNews: [{ title: 'MSFT headline' }],
                    fundamentalsSummary: {
                        companyName: 'Microsoft Corporation',
                        sector: 'Technology',
                    },
                    paperTradeHistory: [],
                    currentPaperPosition: {},
                });
            }
            throw new Error(`Unhandled url ${url}`);
        });

        render(<MarketMindAIPage />);

        window.dispatchEvent(new CustomEvent('marketmindai:select-chat', { detail: { chatId: 'chat-good' } }));

        expect(await screen.findByText(/^GOOD$/i)).toBeInTheDocument();
        expect((await screen.findAllByText(/GOOD Investment Thesis Memo/i)).length).toBeGreaterThan(0);

        fireEvent.change(screen.getByPlaceholderText(/Ask MarketMindAI about a ticker/i), {
            target: { value: 'What would make a bullish thesis on MSFT break down?' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith(API_ENDPOINTS.MARKETMIND_AI_CONTEXT('MSFT'));
        });

        expect(await screen.findByText(/^MSFT$/i)).toBeInTheDocument();
        expect(await screen.findByText(/Here is the MSFT-specific breakdown\./i)).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByText(/GOOD Investment Thesis Memo/i)).not.toBeInTheDocument();
        });
    });

    test('handles compare prompts without attaching a single ticker rail', async () => {
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP) {
                return Promise.resolve({
                    starterPrompts: ['Compare MSFT vs GOOGL using predictions, news, and fundamentals.'],
                    templates: [{ key: 'investment_thesis_memo', label: 'Investment Thesis Memo' }],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHAT && options.method === 'POST') {
                return Promise.resolve({
                    assistantMessage: {
                        role: 'assistant',
                        content: 'MSFT has the stronger prediction setup, while GOOGL looks cheaper on fundamentals.',
                    },
                    suggestedActions: [],
                    artifactIntent: null,
                    comparePair: ['MSFT', 'GOOGL'],
                    compareContextSummary: [
                        { ticker: 'MSFT', assetType: 'equity' },
                        { ticker: 'GOOGL', assetType: 'equity' },
                    ],
                    tickerResolution: {
                        resolvedTicker: null,
                        previousTicker: null,
                        status: 'compare',
                    },
                    chat: {
                        id: 'chat-compare',
                        title: 'Compare MSFT vs GOOGL using predictions, news, and fundamentals.',
                        attachedTicker: null,
                        lastMessagePreview: 'MSFT has the stronger prediction setup, while GOOGL looks cheaper on fundamentals.',
                        latestArtifactId: null,
                        updatedAt: '2026-03-22T13:00:00Z',
                    },
                });
            }
            throw new Error(`Unhandled url ${url}`);
        });

        render(<MarketMindAIPage />);

        fireEvent.change(screen.getByPlaceholderText(/Ask MarketMindAI about a ticker/i), {
            target: { value: 'Compare MSFT vs GOOGL using predictions, news, and fundamentals.' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

        expect(await screen.findByText(/Comparing MSFT vs GOOGL using current MarketMind context\./i)).toBeInTheDocument();
        expect(await screen.findByText(/MSFT has the stronger prediction setup/i)).toBeInTheDocument();
        expect(screen.queryByText(/^MSFT$/i)).not.toBeInTheDocument();
    });

    test('normalizes bullet-heavy assistant replies with html break tags', async () => {
        apiRequest.mockImplementation((url, options = {}) => {
            if (url === API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP) {
                return Promise.resolve({
                    starterPrompts: ['Tell me about GOOGL.'],
                    templates: [{ key: 'investment_thesis_memo', label: 'Investment Thesis Memo' }],
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CHAT && options.method === 'POST') {
                return Promise.resolve({
                    assistantMessage: {
                        role: 'assistant',
                        content: '• Company: Alphabet Inc.<br>• Sector: Communication Services',
                    },
                    suggestedActions: [],
                    artifactIntent: null,
                    tickerResolution: {
                        resolvedTicker: 'GOOGL',
                        previousTicker: null,
                        status: 'switched',
                    },
                    chat: {
                        id: 'chat-googl',
                        title: 'Tell me about GOOGL.',
                        attachedTicker: 'GOOGL',
                        lastMessagePreview: 'Alphabet setup',
                        latestArtifactId: null,
                        updatedAt: '2026-03-22T13:00:00Z',
                    },
                });
            }
            if (url === API_ENDPOINTS.MARKETMIND_AI_CONTEXT('GOOGL')) {
                return Promise.resolve({
                    ticker: 'GOOGL',
                    watchlistMembership: false,
                    activeAlerts: [],
                    predictionSnapshot: null,
                    recentNews: [],
                    fundamentalsSummary: {
                        companyName: 'Alphabet Inc.',
                        sector: 'Communication Services',
                    },
                    paperTradeHistory: [],
                    currentPaperPosition: {},
                });
            }
            throw new Error(`Unhandled url ${url}`);
        });

        render(<MarketMindAIPage />);

        fireEvent.change(screen.getByPlaceholderText(/Ask MarketMindAI about a ticker/i), {
            target: { value: 'Tell me about GOOGL.' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

        expect(await screen.findByText(/- Company: Alphabet Inc\./i)).toBeInTheDocument();
        expect(screen.queryByText(/<br>/i)).not.toBeInTheDocument();
    });
});
