import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, BellRing, X, Sparkles, TrendingUp } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

/**
 * FormNotification Component
 * A reusable UI banner used to display inline success or error messages
 * after form submissions (like creating or deleting an alert).
 */
const FormNotification = ({ message, onDismiss }) => {
    if (!message) return null;

    // Determine banner styling based on whether the message is a success or error
    const toneClass = message.type === 'success' ? 'ui-banner ui-banner-success' : 'ui-banner ui-banner-error';

    return (
        <div className={`mt-4 ${toneClass}`}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{message.text}</span>
                <button onClick={onDismiss} className="rounded-pill p-1 transition hover:bg-black/5 dark:hover:bg-white/5">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

/**
 * NotificationsPage Component
 * The main dashboard for managing user alerts. It allows users to set standard price targets,
 * generate AI-driven smart alerts, and view/manage both active monitors and recently triggered notifications.
 */
const NotificationsPage = ({ onClearAlerts }) => {
    // --- State Management ---
    
    // Alert Data State
    const [activeAlerts, setActiveAlerts] = useState([]); // Alerts currently monitoring the market
    const [triggeredAlerts, setTriggeredAlerts] = useState([]); // Alerts that have hit their conditions
    const [loading, setLoading] = useState(true); // Initial data fetching state
    const [message, setMessage] = useState(null); // Feedback message for UI operations
    
    // Form & UI State
    const [activeTab, setActiveTab] = useState('price'); // Toggles between 'price' and 'ai' alert creation forms
    
    // Price Alert Form State
    const [ticker, setTicker] = useState('');
    const [condition, setCondition] = useState('below'); // 'below' or 'above'
    const [price, setPrice] = useState('');
    
    // AI Smart Alert Form State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false); // Controls loading state specifically for the AI generation button

    // --- Data Fetching ---

    /**
     * Fetches both active and triggered alerts concurrently.
     */
    const fetchAllAlerts = async () => {
        setLoading(true);
        try {
            // Execute both API calls in parallel to reduce loading time
            const [activeData, triggeredDataRaw] = await Promise.all([
                apiRequest(API_ENDPOINTS.NOTIFICATIONS),
                // Fail gracefully to an empty array if the triggered alerts endpoint errors out
                apiRequest(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED(true)).catch(() => []), 
            ]);
            
            // Ensure triggered data is safely iterable
            const triggeredData = Array.isArray(triggeredDataRaw) ? triggeredDataRaw : [];

            setActiveAlerts(activeData);
            setTriggeredAlerts(triggeredData);

            // Optional callback passed from parent (e.g., to clear a notification badge in a nav bar)
            if (onClearAlerts) {
                onClearAlerts();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load alerts immediately when the component mounts
    useEffect(() => {
        fetchAllAlerts();
        // Intentionally load alerts once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Action Handlers ---

    /**
     * Handles the creation of a standard price target alert.
     */
    const handleCreateNotification = async (e) => {
        e.preventDefault();
        setMessage(null);
        try {
            await apiRequest(API_ENDPOINTS.NOTIFICATIONS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    condition,
                    target_price: parseFloat(price),
                    type: 'price',
                }),
            });

            // On success, show a message, clear the form, and refresh the data
            setMessage({ type: 'success', text: `Alert set for ${ticker.toUpperCase()}` });
            setTicker('');
            setPrice('');
            fetchAllAlerts();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    /**
     * Handles the creation of an AI-driven smart alert.
     */
    const handleCreateSmartNotification = async (e) => {
        e.preventDefault();
        setMessage(null);
        setIsAiLoading(true); // Lock the submit button while the AI processes the natural language prompt

        try {
            const response = await apiRequest(API_ENDPOINTS.NOTIFICATIONS_SMART, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    type: 'ai',
                }),
            });

            setMessage({ type: 'success', text: response.message || 'Smart alert created successfully.' });
            setAiPrompt('');
            fetchAllAlerts();
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to create smart alert.' });
        } finally {
            setIsAiLoading(false);
        }
    };

    /**
     * Deletes a specific alert by its ID.
     * Handles both active and triggered alerts by checking the 'type' parameter.
     */
    const handleDelete = async (id, type) => {
        const endpoint = type === 'active'
            ? API_ENDPOINTS.NOTIFICATION(id)
            : API_ENDPOINTS.NOTIFICATION_TRIGGERED(id);

        try {
            await apiRequest(endpoint, { method: 'DELETE' });
            fetchAllAlerts(); // Refresh the lists after successful deletion
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    /**
     * Clears all previously triggered alerts from the user's history.
     */
    const handleClearTriggeredAlerts = async () => {
        setMessage(null);

        try {
            await apiRequest(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED(), { method: 'DELETE' });
            setTriggeredAlerts([]); // Optimistically clear the UI

            if (onClearAlerts) {
                onClearAlerts(); // Update parent state if necessary
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    // Helper function to handle active/inactive tab styling
    const tabClass = (tab) => (
        activeTab === tab
            ? 'ui-tab ui-tab-active flex-1 justify-center gap-2'
            : 'ui-tab flex-1 justify-center gap-2'
    );

    return (
        <div className="ui-page animate-fade-in space-y-8">
            
            {/* --- Header --- */}
            <div className="ui-page-header text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-pill border border-mm-border bg-mm-surface shadow-card">
                    <Bell className="h-8 w-8 text-mm-accent-primary" />
                </div>
                <h1 className="ui-page-title mb-2">Alert Center</h1>
                <p className="ui-page-subtitle">Monitor markets and get notified instantly.</p>
            </div>

            {/* --- Alert Creation Panel --- */}
            <div className="ui-panel overflow-hidden">
                {/* Tab Navigation */}
                <div className="border-b border-mm-border px-6 pt-6">
                    <div className="ui-tab-group flex w-full">
                        <button onClick={() => setActiveTab('price')} className={tabClass('price')}>
                            <TrendingUp className="h-4 w-4" />
                            Price Target
                        </button>
                        <button onClick={() => setActiveTab('ai')} className={tabClass('ai')}>
                            <Sparkles className="h-4 w-4" />
                            AI Smart Alert
                        </button>
                    </div>
                </div>

                {/* Form Content Area */}
                <div className="p-6">
                    {activeTab === 'price' ? (
                        // Standard Price Target Form
                        <form onSubmit={handleCreateNotification} className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                <div>
                                    <label className="ui-form-label">Ticker</label>
                                    <input
                                        type="text"
                                        value={ticker}
                                        onChange={(e) => setTicker(e.target.value)}
                                        className="ui-input"
                                        placeholder="e.g. TSLA"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="ui-form-label">Condition</label>
                                    <select
                                        value={condition}
                                        onChange={(e) => setCondition(e.target.value)}
                                        className="ui-input"
                                    >
                                        <option value="below">Falls Below</option>
                                        <option value="above">Rises Above</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="ui-form-label">Target Price</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        className="ui-input"
                                        placeholder="0.00"
                                        min="0.01"
                                        step="0.01"
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" className="ui-button-primary w-full gap-2 py-3">
                                <Plus className="h-5 w-5" />
                                Create Alert
                            </button>
                        </form>
                    ) : (
                        // AI Smart Alert Form
                        <form onSubmit={handleCreateSmartNotification} className="space-y-6 animate-fade-in">
                            <div>
                                <label className="ui-form-label flex items-center gap-2">
                                    <Sparkles className="h-3 w-3" />
                                    AI Assistant
                                </label>
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    className="ui-input min-h-[140px] resize-none"
                                    placeholder={`Examples:\n- Notify me when Apple releases earnings\n- Alert me if Tesla drops 5% in a day\n- Tell me when there is breaking news about NVDA`}
                                    required
                                />
                            </div>

                            {/* Quick-insert tags to help users format prompts */}
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {['AAPL Earnings', 'TSLA News', 'BTC > 100k'].map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setAiPrompt((prev) => prev + (prev ? ' ' : '') + `Notify me when ${tag}`)}
                                        className="ui-chip whitespace-nowrap"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={isAiLoading}
                                className="ui-button-primary w-full gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isAiLoading ? (
                                    <>
                                        <Sparkles className="h-5 w-5 animate-spin" />
                                        Analyzing Request...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5" />
                                        Generate Smart Alert
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Displays success/error messages resulting from form actions */}
                    <FormNotification message={message} onDismiss={() => setMessage(null)} />
                </div>
            </div>

            {/* --- Alert Management Grid --- */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                
                {/* Left Column: Active Monitors */}
                <div className="ui-panel p-6">
                    <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-mm-text-primary">
                        <span className="h-2 w-2 rounded-pill bg-mm-positive"></span>
                        Active Monitors
                    </h2>

                    {loading && <p className="py-8 text-center font-medium text-mm-text-secondary">Loading...</p>}

                    {!loading && activeAlerts.length === 0 && (
                        <div className="ui-empty-state border-dashed py-12">
                            <Bell className="mb-2 h-8 w-8 text-mm-text-tertiary" />
                            <p className="font-medium">No alerts running</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {activeAlerts.map((alert) => (
                            <div key={alert.id} className="ui-panel-subtle flex items-center justify-between gap-4 p-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-pill border border-mm-border bg-mm-surface text-xs font-semibold text-mm-accent-primary">
                                        {alert.ticker.substring(0, 4)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-mm-text-primary">{alert.ticker}</p>
                                        <p className="text-xs uppercase tracking-wide text-mm-text-tertiary">
                                            {alert.condition === 'below' ? 'Drop Below' : 'Rise Above'} ${alert.target_price.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(alert.id, 'active')}
                                    className="rounded-control p-2 text-mm-text-secondary transition hover:bg-mm-surface hover:text-mm-negative"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Recent Notifications (Triggered) */}
                <div className="ui-panel p-6">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-mm-text-primary">
                            <span className="h-2 w-2 rounded-pill bg-mm-negative"></span>
                            Recent Notifications
                        </h2>
                        {/* Only show "Clear All" if there are alerts to clear */}
                        {triggeredAlerts.length > 0 && (
                            <button onClick={handleClearTriggeredAlerts} className="text-xs font-semibold text-mm-accent-primary hover:underline">
                                Clear All
                            </button>
                        )}
                    </div>

                    {!loading && triggeredAlerts.length === 0 && (
                        <div className="ui-empty-state border-dashed py-12">
                            <p className="font-medium">No recent notifications</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {triggeredAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                className="flex items-start gap-3 rounded-card border px-4 py-4"
                                style={{
                                    backgroundColor: 'rgb(var(--mm-negative) / 0.06)',
                                    borderColor: 'rgb(var(--mm-negative) / 0.18)',
                                }}
                            >
                                <div className="mt-1">
                                    <BellRing className="h-4 w-4 text-mm-negative" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold leading-tight text-mm-text-primary">{alert.message}</p>
                                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-mm-text-tertiary">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(alert.id, 'triggered')}
                                    className="rounded-control p-1 text-mm-text-secondary transition hover:bg-mm-surface hover:text-mm-negative"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;
