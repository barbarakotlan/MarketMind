import React, { useEffect, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title,
  Tooltip, Legend, TimeScale, Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip,
  Legend, TimeScale, Filler
);

const timeFrames = [
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y', value: '1y' },
    { label: 'All', value: 'all' },
];

function PredictionPortfolioChart() {
    const [history, setHistory] = useState(null);
    const [error, setError] = useState('');
    const [activePeriod, setActivePeriod] = useState('ytd');

    const fetchHistory = (period) => {
        setHistory(null);
        setError('');
        setActivePeriod(period);

        fetch(`http://127.0.0.1:5001/prediction-markets/portfolio/history?period=${period}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                if (!data.dates || data.dates.length === 0) {
                    throw new Error('No trading history yet. Make a trade to see your portfolio growth.');
                }
                setHistory(data);
            })
            .catch(err => setError(err.message));
    };

    useEffect(() => {
        fetchHistory(activePeriod);
    }, []);

    const chartConfig = useMemo(() => {
        if (!history) return null;

        const labels = history.dates.map(d => new Date(d));
        const values = history.values;
        const isUp = values[values.length - 1] >= values[0];

        const data = {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: values,
                fill: 'start',
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, isUp ? 'rgba(147, 51, 234, 0.4)' : 'rgba(239, 68, 68, 0.4)');
                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    return gradient;
                },
                borderColor: isUp ? '#9333EA' : '#EF4444',
                borderWidth: 2,
                tension: 0.1,
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { type: 'time', time: { unit: 'day' }, grid: { display: false }, ticks: { display: true, color: '#6B7280' } },
                y: { grid: { color: 'rgba(200, 200, 200, 0.1)' }, ticks: { display: true, color: '#6B7280' } }
            },
            interaction: { intersect: false, mode: 'index' },
            elements: { point: { radius: 0 } }
        };
        return { data, options };
    }, [history]);

    const summary = history?.summary;

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg animate-fade-in border border-gray-200 dark:border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Portfolio Performance</h2>
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg mb-4 max-w-max">
                {timeFrames.map((frame) => (
                    <button
                        key={frame.value}
                        onClick={() => fetchHistory(frame.value)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 ${
                            activePeriod === frame.value ? 'bg-purple-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {frame.label}
                    </button>
                ))}
            </div>

            {error && <div className="text-center p-8 text-gray-500 dark:text-gray-400">{error}</div>}
            {!history && !error && (
                <div className="h-64 flex items-center justify-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent"></div>
                </div>
            )}

            {history && summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Summary ({summary.period.toUpperCase()})</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{summary.start_date} to {summary.end_date}</p>
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Ending value</span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">${summary.end_value.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Wealth generated</span>
                                <span className={`text-sm font-semibold ${summary.wealth_generated >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {summary.wealth_generated >= 0 ? '+' : ''}${summary.wealth_generated.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Return</span>
                                <span className={`text-sm font-semibold ${summary.return_cumulative_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {summary.return_cumulative_pct.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 h-64">
                        <Line data={chartConfig.data} options={chartConfig.options} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default PredictionPortfolioChart;
