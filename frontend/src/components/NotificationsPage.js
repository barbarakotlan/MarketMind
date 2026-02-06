import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, BellRing, X, Sparkles, TrendingUp } from 'lucide-react';

// Reusable Notification Component
const FormNotification = ({ message, onDismiss }) => {
    if (!message) return null;

    const baseStyle = "px-4 py-3 rounded-lg text-white font-semibold animate-fade-in text-center flex justify-between items-center text-sm";
    const successStyle = "bg-green-500 shadow-lg shadow-green-500/20";
    const errorStyle = "bg-red-500 shadow-lg shadow-red-500/20";

    return (
        <div className={`mt-4 ${baseStyle} ${message.type === 'success' ? successStyle : errorStyle}`}>
            <span>{message.text}</span>
            <button onClick={onDismiss} className="text-white hover:bg-black/10 p-1 rounded-full transition-colors">
                <X size={16} />
            </button>
        </div>
    );
};

const NotificationsPage = ({ onClearAlerts }) => {
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [triggeredAlerts, setTriggeredAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    // UI State
    const [activeTab, setActiveTab] = useState('price'); // 'price' or 'ai'

    // Standard Form State
    const [ticker, setTicker] = useState('');
    const [condition, setCondition] = useState('below');
    const [price, setPrice] = useState('');

    // AI Form State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const fetchAllAlerts = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch both active and triggered alerts
            // Note: Ensure your backend supports these endpoints
            const [activeRes, triggeredRes] = await Promise.all([
                fetch('http://127.0.0.1:5001/notifications'),
                fetch('http://127.0.0.1:5001/notifications/triggered?all=true')
            ]);

            if (!activeRes.ok) throw new Error('Failed to fetch active alerts.');

            // Handle cases where triggered endpoint might not exist yet gracefully
            let triggeredData = [];
            if (triggeredRes.ok) {
                triggeredData = await triggeredRes.json();
            }

            const activeData = await activeRes.json();

            setActiveAlerts(activeData);
            setTriggeredAlerts(triggeredData);

            if (onClearAlerts) {
                onClearAlerts();
            }

        } catch (err) {
            console.error(err);
            // Don't block the UI on error, just show empty states
            setLoading(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllAlerts();
    }, []);

    const handleCreateNotification = async (e) => {
        e.preventDefault();
        setMessage(null);
        try {
            const response = await fetch('http://127.0.0.1:5001/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    condition: condition,
                    target_price: parseFloat(price),
                    type: 'price' // Tag as standard price alert
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create notification.');

            setMessage({ type: 'success', text: `Alert set for ${ticker.toUpperCase()}` });
            setTicker('');
            setPrice('');
            fetchAllAlerts();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const handleCreateSmartNotification = async (e) => {
        e.preventDefault();
        setMessage(null);
        setIsAiLoading(true);

        try {
            // This endpoint needs to be implemented in your backend
            // It should parse the natural language and return a structured alert
            const response = await fetch('http://127.0.0.1:5001/notifications/smart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    type: 'ai'
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'AI could not process this request.');

            setMessage({ type: 'success', text: 'Smart Alert created successfully!' });
            setAiPrompt('');
            fetchAllAlerts();
        } catch (err) {
            // Fallback for demo purposes if backend endpoint doesn't exist yet
            console.warn("Backend /notifications/smart might not be implemented yet.");
            setMessage({ type: 'error', text: "AI Backend not connected: " + err.message });
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleDelete = async (id, type) => {
        const endpoint = type === 'active'
            ? `http://127.0.0.1:5001/notifications/${id}`
            : `http://127.0.0.1:5001/notifications/triggered/${id}`;

        try {
            const response = await fetch(endpoint, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete.');

            fetchAllAlerts();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
            {/* Header */}
            <div className="flex flex-col items-center justify-center mb-10">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-2xl mb-4">
                    <Bell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                    Alert Center
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Monitor markets and get notified instantly.</p>
            </div>

            {/* --- Creation Card --- */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-12">
                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('price')}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'price' ? 'bg-gray-50 dark:bg-gray-700/50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                    >
                        <TrendingUp className="w-4 h-4" /> Price Target
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'ai' ? 'bg-blue-50 dark:bg-blue-900/20 text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                    >
                        <Sparkles className="w-4 h-4" /> AI Smart Alert
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'price' ? (
                        <form onSubmit={handleCreateNotification} className="animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ticker</label>
                                    <input
                                        type="text"
                                        value={ticker}
                                        onChange={(e) => setTicker(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. TSLA"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Condition</label>
                                    <select
                                        value={condition}
                                        onChange={(e) => setCondition(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="below">Falls Below</option>
                                        <option value="above">Rises Above</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Price</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                        min="0.01"
                                        step="0.01"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Create Alert
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleCreateSmartNotification} className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3" /> AI Assistant
                                </label>
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    className="w-full h-32 px-5 py-4 bg-purple-50 dark:bg-gray-900 border border-purple-100 dark:border-gray-700 rounded-xl font-medium focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                    placeholder="Examples:&#10;- Notify me when Apple releases earnings&#10;- Alert me if Tesla drops 5% in a day&#10;- Tell me when there is breaking news about NVDA"
                                    required
                                />
                            </div>

                            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                                {["AAPL Earnings", "TSLA News", "BTC > 100k"].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setAiPrompt(prev => prev + (prev ? " " : "") + `Notify me when ${tag}`)}
                                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap hover:bg-purple-100 hover:text-purple-700 transition-colors"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={isAiLoading}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isAiLoading ? (
                                    <>
                                        <Sparkles className="w-5 h-5 animate-spin" /> Analyzing Request...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" /> Generate Smart Alert
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                    <FormNotification message={message} onDismiss={() => setMessage(null)} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* --- Active Alerts --- */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div> Active Monitors
                    </h2>

                    {loading && <p className="text-center py-8 text-gray-400 font-medium">Loading...</p>}
                    {!loading && activeAlerts.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-2xl">
                            <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 font-medium">No alerts running</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {activeAlerts.map((alert) => (
                            <div key={alert.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-black text-xs">
                                        {alert.ticker.substring(0, 4)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{alert.ticker}</p>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                            {alert.condition === 'below' ? 'Drop Below' : 'Rise Above'} ${alert.target_price.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(alert.id, 'active')}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- Triggered History --- */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div> Recent Notifications
                        </h2>
                        {triggeredAlerts.length > 0 && (
                            <button onClick={onClearAlerts} className="text-xs font-bold text-blue-600 hover:underline">Clear All</button>
                        )}
                    </div>

                    {!loading && triggeredAlerts.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-2xl">
                            <p className="text-gray-400 font-medium">No recent notifications</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {triggeredAlerts.map((alert) => (
                            <div key={alert.id} className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                                <div className="mt-1">
                                    <BellRing className="w-4 h-4 text-red-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">{alert.message}</p>
                                    <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                                </div>
                                <button
                                    onClick={() => handleDelete(alert.id, 'triggered')}
                                    className="text-gray-400 hover:text-red-500"
                                >
                                    <X className="w-4 h-4" />
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