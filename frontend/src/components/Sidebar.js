import React, { useState, useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { useDarkMode } from '../context/DarkModeContext';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import {
    LayoutDashboard, Crown, Search, Star, Briefcase, Building2,
    TrendingUp, Target, BarChart3, DollarSign, Bitcoin,
    Layers, Newspaper, Bell, BookOpen, Sun, Moon,
    ChevronLeft, ChevronRight, Boxes, Calendar, SlidersHorizontal, Globe, Bot, Trash2
} from 'lucide-react';

/**
 * Hardcoded navigation hierarchy dictating the layout, labels, 
 * target pages, and associated iconography for the sidebar menu.
 * 
 * @type {Array<{label: string, items: Array<{page: string, icon: Object, label: string}>}>}
 */
const NAV_GROUPS = [
    {
        label: 'Home',
        items: [
            { page: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        ],
    },
    {
        label: 'Research',
        items: [
            { page: 'search', icon: Search, label: 'Search' },
            { page: 'screener', icon: SlidersHorizontal, label: 'Screener' },
            { page: 'fundamentals', icon: Building2, label: 'Fundamentals' },
            { page: 'predictions', icon: TrendingUp, label: 'Predictions' },
            { page: 'performance', icon: Target, label: 'Evaluate' },
            { page: 'options', icon: BarChart3, label: 'Options' },
            { page: 'marketmindAI', icon: Bot, label: 'MarketMindAI' },
        ],
    },
    {
        label: 'Portfolio',
        items: [
            { page: 'watchlist', icon: Star, label: 'Watchlist' },
            { page: 'portfolio', icon: Briefcase, label: 'Portfolio' },
            { page: 'notifications', icon: Bell, label: 'Alerts' },
        ],
    },
    {
        label: 'Markets',
        items: [
            { page: 'predictionMarkets', icon: Layers, label: 'Prediction Markets' },
            { page: 'forex', icon: DollarSign, label: 'Forex' },
            { page: 'crypto', icon: Bitcoin, label: 'Crypto' },
            { page: 'commodities', icon: Boxes, label: 'Commodities' },
        ],
    },
    {
        label: 'Macro',
        items: [
            { page: 'macro', icon: Globe, label: 'Macro' },
            { page: 'calendar', icon: Calendar, label: 'Calendar' },
            { page: 'news', icon: Newspaper, label: 'News' },
        ],
    },
    {
        label: 'Learn',
        items: [
            { page: 'gettingStarted', icon: BookOpen, label: 'Learn' },
            { page: 'plan', icon: Crown, label: 'Upgrade Plan' },
        ],
    },
];

/**
 * Sidebar Component
 * 
 * Main application navigation rail providing access to all core pages and features.
 * Features collapsible states, notification polling, and integrated AI chat history functionality.
 *
 * @component
 * @param {Object} props - React props.
 * @param {string} props.activePage - Currently active navigation state.
 * @param {Function} props.setActivePage - Callback dispatcher to change the global active page context.
 * @param {boolean} props.isCollapsed - Visual state defining if the sidebar is minimized.
 * @param {Function} props.onToggleCollapse - Callback to mutate the sidebar collapse state.
 * @returns {JSX.Element} The persistent side navigation bar.
 */
const Sidebar = ({ activePage, setActivePage, isCollapsed, onToggleCollapse }) => {
    // Context hook fetching global light/dark theme variables
    const { isDarkMode, toggleDarkMode } = useDarkMode();
    
    // Local ephemeral states for badge displays and inline contextual panels
    const [newAlertCount, setNewAlertCount] = useState(0);
    const [plan, setPlan] = useState(null);
    const [recentAiChats, setRecentAiChats] = useState([]);
    const [activeAiChatId, setActiveAiChatId] = useState(null);

    /**
     * Polls the backend API for unread or newly triggered notifications.
     */
    const checkAlerts = () => {
        apiRequest(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED(true))
            .then(data => {
                setNewAlertCount(data.length);
            })
            .catch(err => console.error("Error fetching alerts:", err));
    };

    /**
     * Hydrates the secondary navigation list with the user's localized AI chat history.
     */
    const loadRecentAiChats = () => {
        apiRequest(API_ENDPOINTS.MARKETMIND_AI_CHATS)
            .then(data => {
                // Keep the subset trimmed to the 6 most recent sessions for UI cleanliness
                setRecentAiChats(Array.isArray(data) ? data.slice(0, 6) : []);
            })
            .catch(err => console.error("Error fetching MarketMindAI chats:", err));
    };

    // Effect: Mount a 15-second polling interval strictly dedicated to alert badges
    useEffect(() => {
        checkAlerts();
        const interval = setInterval(checkAlerts, 15000);
        return () => clearInterval(interval);
    }, []);

    // Effect: Attempt to resolve the user's active billing plan for UI adjustments upon mount
    useEffect(() => {
        apiRequest(API_ENDPOINTS.CHECKOUT_PLAN_STATUS)
            .then(data => setPlan(data.plan))
            .catch(() => {});
    }, []);

    // Effect: Register global document event listeners acting as an internal pub/sub system for AI modules
    useEffect(() => {
        loadRecentAiChats();
        
        // Listeners updating sidebar state asynchronously avoiding heavy context re-renders
        const handleHistoryUpdated = () => loadRecentAiChats();
        const handleActiveChatChanged = (event) => {
            setActiveAiChatId(event?.detail?.chatId || null);
        };
        
        window.addEventListener('marketmindai:history-updated', handleHistoryUpdated);
        window.addEventListener('marketmindai:active-chat-changed', handleActiveChatChanged);
        
        // Cleanup global event scopes tightly coupled to this component instance
        return () => {
            window.removeEventListener('marketmindai:history-updated', handleHistoryUpdated);
            window.removeEventListener('marketmindai:active-chat-changed', handleActiveChatChanged);
        };
    }, []);

    /**
     * Top-level handler abstracting generic navigation operations.
     * Side-effects include clearing specific notification states.
     * 
     * @param {string} pageName - The identifier routing parameter.
     */
    const handleNavClick = (pageName) => {
        if (pageName === 'notifications') {
            setNewAlertCount(0); // Assume click implies marking as read locally
        }
        setActivePage(pageName);
    };

    /**
     * Navigation trigger explicitly dedicated to reviving saved conversational states via custom events.
     * 
     * @param {string} chatId - Target conversation UUID.
     */
    const handleRecentAiChatClick = (chatId) => {
        // Hydrate sessionStorage prior to dispatching route to ensure synchronous behavior across listeners
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('marketmindai:selectedChatId', chatId);
        }
        setActivePage('marketmindAI');
        window.dispatchEvent(new CustomEvent('marketmindai:select-chat', { detail: { chatId } }));
    };

    /**
     * Remote deletion logic firing a DELETE request while defensively mutating UI state prior to confirmation.
     * 
     * @param {Event} event - Browser DOM interaction event.
     * @param {string} chatId - Target conversation UUID to purge.
     */
    const handleRecentAiChatDelete = async (event, chatId) => {
        event.preventDefault();
        event.stopPropagation(); // Halt parent click interactions to prevent accidental navigational swaps
        try {
            await apiRequest(API_ENDPOINTS.MARKETMIND_AI_CHAT_DELETE(chatId), { method: 'DELETE' });
            
            // Optimistically clean the local context array
            setRecentAiChats((current) => current.filter((chat) => chat.id !== chatId));
            
            // Handle the case where the deleted chat is presently focused and active
            if (activeAiChatId === chatId) {
                setActiveAiChatId(null);
                window.dispatchEvent(new CustomEvent('marketmindai:active-chat-changed', { detail: { chatId: null } }));
                window.dispatchEvent(new CustomEvent('marketmindai:chat-deleted', { detail: { chatId } }));
            }
            window.dispatchEvent(new CustomEvent('marketmindai:notice', { detail: { message: 'Chat deleted.', tone: 'success' } }));
            window.dispatchEvent(new CustomEvent('marketmindai:history-updated'));
        } catch (err) {
            console.error("Error deleting MarketMindAI chat:", err);
            window.dispatchEvent(new CustomEvent('marketmindai:notice', { detail: { message: 'Could not delete that chat.', tone: 'warn' } }));
        }
    };

    return (
        <aside
            className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-mm-border bg-mm-surface text-mm-text-primary shadow-card transition-all duration-300 ${
                isCollapsed ? 'w-16' : 'w-56'
            }`}
        >
            {/* Brand bar and Collapse action */}
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-mm-border px-3">
                {!isCollapsed && (
                    <img
                        src={isDarkMode ? 'marketmindtransparent.png' : 'marketmindtransparentdark.png'}
                        alt="MarketMind"
                        className="h-9 w-auto object-contain"
                    />
                )}
                {isCollapsed && (
                    <span className="mx-auto text-lg font-bold text-mm-text-primary">M</span>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="flex-shrink-0 rounded-md p-1 text-mm-text-secondary transition-colors hover:bg-mm-surface-subtle hover:text-mm-text-primary"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Main Navigation Wrapper Container */}
            <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-3 space-y-1">
                {NAV_GROUPS.map((group, gi) => (
                    <div key={gi}>
                        {group.label && (
                            isCollapsed
                                ? <hr className="mx-1 my-2 border-mm-border" />
                                : <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-mm-text-tertiary">{group.label}</p>
                        )}
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activePage === item.page;
                            const isAlerts = item.page === 'notifications';
                            
                            return (
                                <div key={item.page}>
                                    <button
                                        onClick={() => handleNavClick(item.page)}
                                        title={isCollapsed ? item.label : undefined}
                                        className={`relative w-full flex items-center rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-150 ${
                                            isCollapsed ? 'justify-center' : 'justify-start space-x-3'
                                        } ${
                                            isActive
                                                ? 'bg-mm-accent-primary text-white shadow-card'
                                                : 'text-mm-text-secondary hover:bg-mm-surface-subtle hover:text-mm-text-primary'
                                        }`}
                                    >
                                        <Icon className="w-5 h-5 flex-shrink-0" />
                                        {!isCollapsed && <span>{item.label}</span>}
                                        {/* Inject animated notification dot upon dynamic boolean */}
                                        {isAlerts && newAlertCount > 0 && (
                                            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                                                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-mm-negative"></span>
                                            </span>
                                        )}
                                    </button>

                                    {/* Sidebar Extension: Recent AI Chats (Hidden when collapsed intentionally for UI parity) */}
                                    {!isCollapsed && item.page === 'marketmindAI' && recentAiChats.length > 0 && (
                                        <div className="mt-2 ml-4 space-y-1 border-l border-mm-border pl-3">
                                            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-mm-text-tertiary">
                                                Recent
                                            </p>
                                            {recentAiChats.map((chat) => {
                                                const isChatActive = activePage === 'marketmindAI' && chat.id === activeAiChatId;
                                                return (
                                                    <div
                                                        key={chat.id}
                                                        className={`w-full rounded-lg px-2 py-2 text-left text-xs transition ${
                                                            isChatActive
                                                                ? 'border border-mm-accent-primary/20 bg-mm-accent-primary/10 text-mm-accent-primary'
                                                                : 'text-mm-text-secondary hover:bg-mm-surface-subtle hover:text-mm-text-primary'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRecentAiChatClick(chat.id)}
                                                                className="min-w-0 flex-1 text-left"
                                                            >
                                                                <div className="truncate font-medium">{chat.title}</div>
                                                                {/* Optional context indicating analysis target */}
                                                                {chat.attachedTicker && (
                                                                    <div className="mt-0.5 truncate uppercase tracking-[0.16em] text-[10px] opacity-70">
                                                                        {chat.attachedTicker}
                                                                    </div>
                                                                )}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(event) => handleRecentAiChatDelete(event, chat.id)}
                                                                className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-mm-text-tertiary transition hover:bg-mm-surface-subtle hover:text-mm-text-primary"
                                                                aria-label={`Delete chat ${chat.title}`}
                                                                title="Delete chat"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer: Clerk User Profile Button + Contextual Display Elements */}
            <div className="flex-shrink-0 border-t border-mm-border p-3">
                <div className={`w-full flex ${isCollapsed ? 'flex-col items-center gap-4' : 'items-center justify-between'}`}>
                    <UserButton afterSignOutUrl="/" />
                  
                    {/* Hide plan badge when collapsed so it doesn't break fixed pixel widths layout */}
                    {!isCollapsed && plan && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            plan === 'pro' 
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                            {plan === 'pro' ? '⚡ Pro' : 'Free'}
                        </span>
                    )}

                    <button
                        onClick={toggleDarkMode}
                        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-mm-text-secondary transition-colors duration-150 hover:bg-mm-surface-subtle hover:text-mm-text-primary"
                        aria-label="Toggle dark mode"
                        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                        {isDarkMode ? (
                            <Sun className="w-4 h-4 text-yellow-400" />
                        ) : (
                            <Moon className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;