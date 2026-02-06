import React, { useEffect, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title,
  Tooltip, Legend, Filler,
} from 'chart.js';

// Register all Chart.js components and controllers
// Removed TimeScale and the adapter to prevent build errors
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip,
  Legend, Filler
);

// Define the time frames for the portfolio chart
const portfolioTimeFrames = [
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y', value: '1y' },
    { label: 'All', value: 'all' },
];

function PortfolioGrowthChart({ onDataFetched }) {
    const [history, setHistory] = useState(null);
    const [error, setError] = useState('');
    const [activePeriod, setActivePeriod] = useState('ytd');

    const fetchHistory = (period) => {
        setHistory(null); // Clear old data, show loading
        setError('');
        setActivePeriod(period);

        // Fetch data from the endpoint we built in api.py
        fetch(`http://127.0.0.1:5001/paper/history?period=${period}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                if (!data.dates || data.dates.length === 0) {
                    throw new Error('No trading history found. Make a trade to see your portfolio growth.');
                }
                setHistory(data);
                if (onDataFetched) {
                    onDataFetched(data.summary); // Send summary data up to parent
                }
            })
            .catch(err => setError(err.message));
    };

    // Fetch data on component mount
    useEffect(() => {
        fetchHistory(activePeriod);
    }, []);

    // Memoize chart configuration
    const chartConfig = useMemo(() => {
        if (!history) return null;

        // Format dates manually since we aren't using the time adapter
        const labels = history.dates.map(d => {
            const date = new Date(d);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });

        const values = history.values;
        const isUp = values.length > 0 && values[values.length - 1] >= values[0];

        const data = {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: values,
                fill: 'start', // This creates the area chart
                backgroundColor: (context) => { // Gradient logic
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, isUp ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'); // Green/Red
                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    return gradient;
                },
                borderColor: isUp ? '#22C55E' : '#EF4444', // Green/Red
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 0, // Hide points by default
                pointHoverRadius: 4, // Show points on hover
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        display: true,
                        color: '#6B7280',
                        maxTicksLimit: 6, // Limit x-axis labels to prevent overcrowding
                        maxRotation: 0
                    }
                },
                y: {
                    grid: { color: 'rgba(200, 200, 200, 0.1)' },
                    ticks: {
                        display: true,
                        color: '#6B7280',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            },
            interaction: { intersect: false, mode: 'nearest', axis: 'x' },
        };
        return { data, options };
    }, [history]);

    const summary = history?.summary;

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg animate-fade-in border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Portfolio Performance</h2>
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg mb-4 max-w-max">
                {portfolioTimeFrames.map((frame) => (
                    <button
                        key={frame.value}
                        onClick={() => fetchHistory(frame.value)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 ${
                            activePeriod === frame.value ? 'bg-green-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {frame.label}
                    </button>
                ))}
            </div>

            {error && <div className="text-center p-8 text-gray-500 dark:text-gray-400">{error}</div>}
            {!history && !error && (
                <div className="h-80 flex items-center justify-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent"></div>
                </div>
            )}

            {history && summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Summary Card */}
                    <div className="md:col-span-1 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Summary ({summary.period.toUpperCase()})</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{summary.start_date} to {summary.end_date}</p>
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Ending market value</span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">${summary.end_value.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Wealth generated</span>
                                <span className={`text-sm font-semibold ${summary.wealth_generated >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {summary.wealth_generated >= 0 ? '+' : ''}${summary.wealth_generated.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Return (cumulative)</span>
                                <span className={`text-sm font-semibold ${summary.return_cumulative_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {summary.return_cumulative_pct.toFixed(2)}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Return (annualized)</span>
                                <span className={`text-sm font-semibold ${summary.return_annualized_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {summary.return_annualized_pct.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="md:col-span-2 h-80">
                        {chartConfig && <Line data={chartConfig.data} options={chartConfig.options} />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioGrowthChart;