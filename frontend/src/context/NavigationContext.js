import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * NavigationContext centralizes app navigation and the one-shot "navigation
 * intent" (a ticker / compare-ticker / AI prompt) that a destination page reads
 * once on arrival. This replaces threading `activePage`/`setActivePage` and the
 * `initialTicker` + `onConsumeInitialTicker` prop dance through App into every
 * page.
 *
 * Pages read `activePage` and their intent (`sharedTicker`, etc.) via
 * `useNavigation()`, and clear the intent with `clearTicker()` /
 * `clearCompareTicker()` / `clearAiPrompt()` once consumed — the same
 * read-once-then-clear semantics as before, now expressed in one place.
 */
const NavigationContext = createContext(null);

const INITIAL_PAGE = 'screener';

export function NavigationProvider({ children }) {
    const [activePage, setActivePage] = useState(INITIAL_PAGE);
    const [sharedTicker, setSharedTicker] = useState(null);
    const [sharedCompareTicker, setSharedCompareTicker] = useState(null);
    const [sharedAiPrompt, setSharedAiPrompt] = useState('');

    const clearTicker = useCallback(() => setSharedTicker(null), []);
    const clearCompareTicker = useCallback(() => setSharedCompareTicker(null), []);
    const clearAiPrompt = useCallback(() => setSharedAiPrompt(''), []);

    // Navigate to a page, optionally seeding the intent the destination reads.
    const navigate = useCallback((page, intent = {}) => {
        if ('ticker' in intent) setSharedTicker(intent.ticker);
        if ('compareTicker' in intent) setSharedCompareTicker(intent.compareTicker);
        if ('aiPrompt' in intent) setSharedAiPrompt(intent.aiPrompt);
        setActivePage(page);
    }, []);

    // Screener "open ticker in search" — moved verbatim from App.handleScreenerNav.
    const screenerNav = useCallback((ticker) => {
        setSharedTicker(ticker);
        setSharedCompareTicker(null);
        setActivePage('search');
    }, []);

    // Screener action buttons — moved verbatim from App.handleScreenerAction.
    const screenerAction = useCallback(({ action, ticker, compareTicker }) => {
        const normalizedTicker = String(ticker || '').trim().toUpperCase();
        const normalizedCompareTicker = String(compareTicker || '').trim().toUpperCase();
        if (!normalizedTicker) return;

        setSharedTicker(normalizedTicker);
        setSharedCompareTicker(null);
        setSharedAiPrompt('');

        if (action === 'predictions') {
            setActivePage('predictions');
            return;
        }
        if (action === 'fundamentals') {
            setActivePage('fundamentals');
            return;
        }
        if (action === 'paper') {
            setActivePage('portfolio');
            return;
        }
        if (action === 'ai') {
            setSharedAiPrompt(`Analyze ${normalizedTicker} from the Screener. Summarize why it surfaced, what to validate next, and what risks to check before acting.`);
            setActivePage('marketmindAI');
            return;
        }
        if (action === 'compare' && normalizedCompareTicker) {
            setSharedCompareTicker(normalizedCompareTicker);
            setActivePage('search');
            return;
        }

        setActivePage('search');
    }, []);

    const value = useMemo(
        () => ({
            activePage,
            setActivePage,
            navigate,
            sharedTicker,
            sharedCompareTicker,
            sharedAiPrompt,
            clearTicker,
            clearCompareTicker,
            clearAiPrompt,
            screenerNav,
            screenerAction,
        }),
        [
            activePage,
            sharedTicker,
            sharedCompareTicker,
            sharedAiPrompt,
            navigate,
            clearTicker,
            clearCompareTicker,
            clearAiPrompt,
            screenerNav,
            screenerAction,
        ]
    );

    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
    const ctx = useContext(NavigationContext);
    if (!ctx) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return ctx;
}

export default NavigationContext;
