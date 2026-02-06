import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, BellRing, X } from 'lucide-react';

// Reusable Notification Component for this page
const FormNotification = ({ message, onDismiss }) => {
    if (!message) return null;

    const baseStyle = "px-4 py-3 rounded-lg text-white font-semibold animate-fade-in text-center flex justify-between items-center";
    const successStyle = "bg-green-500";
    const errorStyle = "bg-red-500";

    return (
        <div className={`mt-4 ${baseStyle} ${message.type === 'success' ? successStyle : errorStyle}`}>
            <span>{message.text}</span>
            <button onClick={onDismiss} className="text-white hover:bg-black/10 p-1 rounded-full">
                <X size={18} />
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

    // Form state
    const [ticker, setTicker] = useState('');
    const [condition, setCondition] = useState('below');
    const [price, setPrice] = useState('');

    const fetchAllAlerts = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch both active and triggered alerts
            const [activeRes, triggeredRes] = await Promise.all([
                fetch('http://127.0.0.1:5001/notifications'),
                fetch('http://127.0.0.1:5001/notifications/triggered?all=true') // Get all triggered
            ]);

            if (!activeRes.ok) throw new Error('Failed to fetch active alerts.');
            if (!triggeredRes.ok) throw new Error('Failed to fetch triggered alerts.');

            const activeData = await activeRes.json();
            const triggeredData = await triggeredRes.json();

            setActiveAlerts(activeData);
            setTriggeredAlerts(triggeredData);

            // Clear the header bell count
            if (onClearAlerts) {
                onClearAlerts();
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Load all data when the page opens
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
                    target_price: parseFloat(price)
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create notification.');

            setMessage({ type: 'success', text: 'Notification created successfully!' });
            setTicker('');
            setPrice('');
            fetchAllAlerts(); // Refresh both lists
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const handleDelete = async (id, type) => {
        const endpoint = type === 'active'
            ? `http://127.0.0.1:5001/notifications/${id}`
            : `http://127.0.0.1:5001/notifications/triggered/${id}`;

        try {
            const response = await fetch(endpoint, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to delete.');

            setMessage({ type: 'success', text: data.message });
            fetchAllAlerts(); // Refresh both lists
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    return (
        <div className="container mx-auto px-6 py-8 max-w-4xl animate-fade-in">
            <div className="flex items-center justify-center mb-6">
                <Bell className="w-10 h-10 text-blue-600 dark:text-blue-400 mr-3" />
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                    Price Alerts
                </h1>
            </div>

            {/* --- Create Notification Form --- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create New Alert</h2>
                <form onSubmit={handleCreateNotification}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stock Ticker</label>
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="AAPL"
                                required
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alert me when price is...</label>
                            <select
                                value={condition}
                                onChange={(e) => setCondition(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            >
                                <option value="below">Below</option>
                                <option value="above">Above</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Price</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="170.00"
                                min="0.01"
                                step="0.01"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="mt-6 w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center space-x-2"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create Notification</span>
                    </button>
                    <FormNotification message={message} onDismiss={() => setMessage(null)} />
                </form>
            </div>

            {/* --- Triggered Alerts List --- */}
            {triggeredAlerts.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-blue-200 dark:border-blue-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Alerts That Fired</h2>
                    <div className="space-y-3">
                        {triggeredAlerts.map((alert) => (
                            <div key={alert.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <div className="flex items-center">
                                    <BellRing className="w-5 h-5 text-blue-500 mr-3" />
                                    <span className="text-gray-700 dark:text-gray-200">{alert.message}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(alert.id, 'triggered')}
                                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 p-2 rounded-lg transition-all"
                                    title="Dismiss Alert"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- Active Alerts List --- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your Active Alerts</h2>
                {loading && <p className="text-gray-600 dark:text-gray-400">Loading alerts...</p>}
                {error && !loading && <p className="text-red-600 dark:text-red-400">{error}</p>}
                {!loading && activeAlerts.length === 0 && (
                    <p className="text-gray-600 dark:text-gray-400">You have no active price alerts.</p>
                )}
                {activeAlerts.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Stock</th>
                                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Condition</th>
                                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeAlerts.map((alert) => (
                                    <tr key={alert.id} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">{alert.ticker}</td>
                                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                            {alert.condition === 'below' ? 'Below' : 'Above'} ${alert.target_price.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => handleDelete(alert.id, 'active')}
                                                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-all"
                                                title="Delete Alert"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
