import React, { useState, useMemo } from 'react';
import { Chart } from 'react-chartjs-2';

// --- THIS IS THE FIX ---
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale, // The Time scale
  Filler,
} from 'chart.js';

// --- Import Candlestick from the correct package ---
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns'; // This teaches Chart.js how to read dates
// --- END OF FIX ---


// Now we register them all
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale, // Register the Time scale
  Filler,
  CandlestickController, // Register the Candlestick controller
  CandlestickElement // Register the Candlestick element
);


const timeFrames = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '14D', value: '14d' },
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

// Helper function to normalize data for comparison
const normalizeData = (data) => {
    if (!data || data.length === 0) return [];
    const baseValue = data[0].close;
    return data.map(d => ({
        x: new Date(d.date),
        y: (d.close / baseValue - 1) * 100 // Convert to percentage change
    }));
};

const StockChart = ({ chartData, ticker, onTimeFrameChange, activeTimeFrame, comparisonData }) => {
    const [chartType, setChartType] = useState('line');

    const chartConfig = useMemo(() => {
        if (!chartData || chartData.length === 0) return null;

        const isComparing = comparisonData && comparisonData.data.length > 0;
        const chartComponentType = chartType === 'candlestick' && !isComparing ? 'candlestick' : 'line';
        
        const firstValidClose = chartData.find(d => d.close !== null && d.close !== undefined)?.close;
        const lastValidClose = [...chartData].reverse().find(d => d.close !== null && d.close !== undefined)?.close;
        const isUp = (lastValidClose ?? 0) >= (firstValidClose ?? 0);

        const datasets = [];

        // 1. Main Ticker Dataset
        if (isComparing) {
            // Comparison Mode: Use Normalized % Data
            datasets.push({
                type: 'line',
                label: ticker,
                data: normalizeData(chartData),
                borderColor: '#22c55e', // Green
                borderWidth: 2,
                fill: false,
            });
        } else {
            // Single Ticker Mode: Use Price Data
            if (chartType === 'line') {
                datasets.push({
                    type: 'line', label: ticker,
                    data: chartData.map(d => ({ x: new Date(d.date), y: d.close })),
                    fill: 'start',
                    backgroundColor: (context) => {
                        const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 400);
                        gradient.addColorStop(0, isUp ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)');
                        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        return gradient;
                    },
                    borderColor: isUp ? '#10B981' : '#EF4444',
                    borderWidth: 2,
                });
            } else { // Candlestick
                datasets.push({
                    type: 'candlestick', label: ticker,
                    data: chartData.map(d => ({ x: new Date(d.date).valueOf(), o: d.open, h: d.high, l: d.low, c: d.close })),
                });
            }
        }
        
        // 2. Comparison Ticker Dataset
        if (isComparing) {
            datasets.push({
                type: 'line',
                label: comparisonData.ticker,
                data: normalizeData(comparisonData.data),
                borderColor: '#8B5CF6', // Purple
                borderWidth: 2,
                fill: false,
            });
        }

        const data = { datasets };
        const options = {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: isComparing, // Only show legend if comparing
                    position: 'top',
                },
                title: { display: true, text: `${ticker} Price History (${activeTimeFrame?.label || ''})`, font: { size: 18 }, padding: { top: 10, bottom: 20 } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += isComparing ? context.parsed.y.toFixed(2) + '%' : '$' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    type: 'time', // <-- This requires the TimeScale and adapter
                    time: { unit: activeTimeFrame?.value === '1d' ? 'hour' : 'day' }, 
                    grid: { display: false } 
                },
                y: { 
                    grid: { color: 'rgba(200, 200, 200, 0.1)' },
                    ticks: {
                        callback: function(value) {
                            return isComparing ? value + '%' : '$' + value;
                        }
                    }
                }
            },
            interaction: { intersect: false, mode: 'index' },
            elements: { point: { radius: 0 } }
        };
        return { type: chartComponentType, options, data };
    }, [chartData, chartType, ticker, activeTimeFrame, comparisonData]);

    if (!chartConfig) return null;

    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    {timeFrames.map((frame) => (
                        <button key={frame.value} onClick={() => onTimeFrameChange(frame)} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 ${ activeTimeFrame?.value === frame.value ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' }`}>{frame.label}</button>
                    ))}
                </div>
                <select 
                    value={chartType} 
                    onChange={(e) => setChartType(e.target.value)} 
                    disabled={comparisonData && comparisonData.data.length > 0}
                    className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <option value="line">Line Chart</option>
                    <option value="candlestick" disabled={comparisonData && comparisonData.data.length > 0}>Candlestick</option>
                </select>
            </div>
            <div className="h-96">
                <Chart type={chartConfig.type} options={chartConfig.options} data={chartConfig.data} />
            </div>
        </div>
    );
};

export default StockChart;