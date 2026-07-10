import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../../auth';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';
import useMarketMindAIData from './useMarketMindAIData';

vi.mock('../../auth', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/NavigationContext', () => ({ useNavigation: vi.fn() }));
vi.mock('../../config/api', async () => ({
    ...(await vi.importActual('../../config/api')),
    apiRequest: vi.fn(),
}));

function route(url) {
    if (url === API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP) {
        return Promise.resolve({ starterPrompts: [{ id: 'p1', label: 'Analyze a stock' }], templates: [] });
    }
    if (url === API_ENDPOINTS.MARKETMIND_AI_CHAT) {
        return Promise.resolve({
            assistantMessage: { content: 'Hi there' },
            chat: { id: 'c1' },
            retrievedEvidence: [{ title: 'ev' }],
            retrievalStatus: 'ok',
        });
    }
    return Promise.resolve({});
}

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    useNavigation.mockReturnValue({ sharedAiPrompt: '', clearAiPrompt: vi.fn() });
    apiRequest.mockImplementation(route);
});

describe('useMarketMindAIData', () => {
    test('signed-in mount loads bootstrap starter prompts', async () => {
        const { result } = renderHook(() => useMarketMindAIData());
        await waitFor(() => expect(result.current.starterPrompts.length).toBe(1));
        expect(result.current.starterPrompts[0].label).toBe('Analyze a stock');
    });

    test('signed-out mount does not load bootstrap', () => {
        useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
        // The bootstrap effect early-returns synchronously when signed out.
        const { result } = renderHook(() => useMarketMindAIData());
        expect(result.current.starterPrompts).toEqual([]);
        expect(apiRequest).not.toHaveBeenCalledWith(API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP);
    });

    test('an incoming AI prompt seeds the composer and is consumed', async () => {
        const clearAiPrompt = vi.fn();
        useNavigation.mockReturnValue({ sharedAiPrompt: 'Analyze AAPL', clearAiPrompt });
        const { result } = renderHook(() => useMarketMindAIData());

        await waitFor(() => expect(result.current.composerValue).toBe('Analyze AAPL'));
        expect(clearAiPrompt).toHaveBeenCalled();
    });

    test('sendMessage appends the user + assistant turns and stores retrieved evidence', async () => {
        const { result } = renderHook(() => useMarketMindAIData());
        await waitFor(() => expect(result.current.starterPrompts.length).toBe(1));

        act(() => result.current.setComposerValue('Hello'));
        await act(async () => {
            await result.current.sendMessage();
        });

        expect(result.current.messages.map((m) => [m.role, m.content])).toEqual([
            ['user', 'Hello'],
            ['assistant', 'Hi there'],
        ]);
        expect(result.current.retrievedEvidence).toEqual([{ title: 'ev' }]);
        expect(result.current.chatLoading).toBe(false);
        expect(result.current.composerValue).toBe('');
    });

    test('sendMessage is a no-op for empty content', async () => {
        const { result } = renderHook(() => useMarketMindAIData());
        await waitFor(() => expect(result.current.starterPrompts.length).toBe(1));

        await act(async () => {
            await result.current.sendMessage('   ');
        });

        expect(result.current.messages).toEqual([]);
        expect(apiRequest).not.toHaveBeenCalledWith(API_ENDPOINTS.MARKETMIND_AI_CHAT, expect.anything());
    });

    test('resetWorkspace clears the conversation state', async () => {
        const { result } = renderHook(() => useMarketMindAIData());
        await waitFor(() => expect(result.current.starterPrompts.length).toBe(1));

        act(() => result.current.setComposerValue('Hello'));
        await act(async () => {
            await result.current.sendMessage();
        });
        expect(result.current.messages.length).toBe(2);

        act(() => result.current.resetWorkspace());
        expect(result.current.messages).toEqual([]);
        expect(result.current.composerValue).toBe('');
        expect(result.current.attachedTicker).toBe('');
    });

    test('showTickerContext derives from an attached ticker', async () => {
        const { result } = renderHook(() => useMarketMindAIData());
        await waitFor(() => expect(result.current.starterPrompts.length).toBe(1));

        expect(result.current.showTickerContext).toBe(false);
        act(() => result.current.setAttachedTicker('AAPL'));
        expect(result.current.showTickerContext).toBe(true);
    });
});
