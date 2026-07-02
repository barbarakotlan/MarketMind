import { API_ENDPOINTS, apiRequest } from '../../config/api';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { formatCurrency } from './format';

// --- REGISTER CHARTJS COMPONENTS ---
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip,
  Legend, Filler
);

// --- ROBUST PORTFOLIO GRAPH COMPONENT ---
const portfolioTimeFrames = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y', value: '1y' },
];

const PortfolioGrowthChart = ({ totalValue }) => {
    const [history, setHistory] = useState(null);
    const [activePeriod, setActivePeriod] = useState('1m');
    const [isSimulated, setIsSimulated] = useState(false);
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const chartTextColor = isDarkMode ? '#CBD5E1' : '#64748B';
    const chartGridColor = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.14)';
    const tooltipBackground = isDarkMode ? '#020617' : 'rgba(15, 23, 42, 0.9)';

    // --- MOCK DATA GENERATOR ---
    const generateMockHistory = useCallback((period) => {
        const pointsMap = { '1d': 24, '1w': 7, '1m': 30, '3m': 90, 'ytd': 120, '1y': 365 };
        const points = pointsMap[period] || 30;
        const now = new Date();
        const dates = [];
        const values = [];

        // ANCHOR LOGIC:
        const endPrice = totalValue || 100000;
        let startPrice = 100000;

        // For short term, start near current. For long term, start at 100k factory reset.
        if (period === '1d') {
            startPrice = endPrice * (1 + (Math.random() * 0.01 - 0.005));
        } else if (period === '1w') {
            startPrice = endPrice * (1 + (Math.random() * 0.04 - 0.02));
        } else {
            startPrice = 100000;
        }

        // Generate Bridge
        for (let i = 0; i <= points; i++) {
            const date = new Date(now);
            if (period === '1d') date.setHours(date.getHours() - (points - i));
            else date.setDate(date.getDate() - (points - i));
            dates.push(date.toISOString());

            // Brownian Bridge Interpolation
            const progress = i / points;
            const linearTrend = startPrice + (endPrice - startPrice) * progress;
            const noiseMagnitude = (endPrice * 0.02);
            const noise = (Math.random() - 0.5) * noiseMagnitude * Math.sin(progress * Math.PI);

            values.push(linearTrend + noise);
        }

        // Force precise endpoints
        values[0] = startPrice;
        values[values.length - 1] = endPrice;

        return { dates, values };
    }, [totalValue]);

    // Effect to fetch data whenever activePeriod or totalValue changes
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const data = await apiRequest(API_ENDPOINTS.PORTFOLIO_HISTORY(activePeriod));

                if (isMounted) {
                    if (!data.error && data.dates && data.dates.length > 2) {
                        setHistory({ dates: data.dates, values: data.values });
                        setIsSimulated(false);
                    } else {
                        setHistory(generateMockHistory(activePeriod));
                        setIsSimulated(true);
                    }
                }
            } catch (error) {
                if (isMounted) {
                    setHistory(generateMockHistory(activePeriod));
                    setIsSimulated(true);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [activePeriod, totalValue, generateMockHistory]);

    const chartConfig = useMemo(() => {
        if (!history) return null;

        const labels = history.dates.map(d => {
            const date = new Date(d);
            return activePeriod === '1d'
                ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        });

        const data = {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: history.values,
                borderColor: '#16a34a',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                fill: {
                    target: 'origin',
                    above: 'rgba(22, 163, 74, 0.1)',
                }
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
                    backgroundColor: tooltipBackground,
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y) }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: chartTextColor, font: { size: 10, weight: 'bold' } } },
                y: { position: 'right', grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 10 }, callback: (val) => '$' + val.toLocaleString() } }
            },
            interaction: { intersect: false, mode: 'index' },
        };

        return { data, options };
    }, [activePeriod, chartGridColor, chartTextColor, history, tooltipBackground]);

    if (!history) return <div className="h-64 flex items-center justify-center text-mm-text-secondary">Loading Chart...</div>;

    // --- RE-CALCULATE METRICS ON FRONTEND ---
    const startVal = history.values[0];
    const endVal = history.values[history.values.length - 1];
    const valChange = endVal - startVal;
    const pctChange = startVal !== 0 ? (valChange / startVal) * 100 : 0;
    const isPositive = valChange >= 0;

    return (
        <div className="ui-panel p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <p className="ui-section-label mb-2">Performance</p>
                    <h2 className="text-lg font-semibold text-mm-text-primary">Portfolio Performance</h2>
                    {isSimulated && (
                        <span className="ui-status-chip mt-3 border border-mm-accent-primary/15 bg-mm-accent-primary/10 text-mm-accent-primary">
                            Projected View
                        </span>
                    )}
                </div>
                {/* Timeframe Selector */}
                <div className="flex rounded-control border border-mm-border bg-mm-surface-subtle p-1">
                    {portfolioTimeFrames.map((frame) => (
                        <button
                            key={frame.value}
                            onClick={() => setActivePeriod(frame.value)}
                            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                activePeriod === frame.value 
                                ? 'bg-mm-accent-primary text-white shadow-card' 
                                : 'text-mm-text-secondary hover:bg-mm-surface hover:text-mm-text-primary'
                            }`}
                        >
                            {frame.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Bar - Calculated from displayed data */}
            <div className={`flex justify-between items-center px-4 py-2 rounded-control mb-3 ${isPositive ? 'bg-mm-positive/12 text-mm-positive' : 'bg-mm-negative/12 text-mm-negative'}`}>
                <span className="text-xs font-semibold">
                    {history.dates.length > 0 ? new Date(history.dates[0]).toLocaleDateString() : ''} - Today
                </span>
                <span className="text-xs font-semibold">
                    {isPositive ? '+' : ''}{formatCurrency(valChange)} ({pctChange.toFixed(2)}%)
                </span>
            </div>

            {/* Chart Canvas */}
            <div className="h-72 w-full rounded-control border border-mm-border bg-mm-surface-subtle p-2">
                {chartConfig && <Line data={chartConfig.data} options={chartConfig.options} />}
            </div>
        </div>
    );
};

/**
 * TradeModal: Handles buying/selling logic for options and stocks
 */

export default PortfolioGrowthChart;
