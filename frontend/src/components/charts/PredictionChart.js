import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PredictionChart = ({ predictionData }) => {
    if (!predictionData || !predictionData.predictions) return null;

    const dates = predictionData.predictions.map(p => {
        const date = new Date(p.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const predictedPrices = predictionData.predictions.map(p => p.predictedClose);

    // Add recent actual price as the starting point
    const allDates = [
        new Date(predictionData.recentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...dates
    ];
    const allPrices = [predictionData.recentClose, ...predictedPrices];

    const data = {
        labels: allDates,
        datasets: [
            {
                label: 'Predicted Price',
                data: allPrices,
                borderColor: 'rgb(147, 51, 234)', // Purple
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgb(147, 51, 234)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
            },
            {
                label: 'Current Price',
                data: [predictionData.recentClose, null, null, null, null, null, null],
                borderColor: 'rgb(34, 197, 94)', // Green
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 8,
                pointBackgroundColor: 'rgb(34, 197, 94)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                fill: false,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: {
                        size: 12,
                        weight: 'bold'
                    },
                    color: '#6b7280'
                }
            },
            title: {
                display: true,
                text: `${predictionData.symbol} - 7 Day Price Forecast`,
                font: {
                    size: 18,
                    weight: 'bold'
                },
                color: '#1f2937',
                padding: {
                    top: 10,
                    bottom: 20
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8,
                titleFont: {
                    size: 14,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 13
                },
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += '$' + context.parsed.y.toFixed(2);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    callback: function(value) {
                        return '$' + value.toFixed(2);
                    },
                    font: {
                        size: 11
                    },
                    color: '#6b7280'
                }
            },
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 11
                    },
                    color: '#6b7280',
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        }
    };

    // Dark mode adjustments
    if (document.documentElement.classList.contains('dark')) {
        options.plugins.title.color = '#f9fafb';
        options.plugins.legend.labels.color = '#d1d5db';
        options.scales.y.ticks.color = '#d1d5db';
        options.scales.x.ticks.color = '#d1d5db';
        options.scales.y.grid.color = 'rgba(255, 255, 255, 0.1)';
    }

    return (
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in transition-colors duration-200">
            <div style={{ height: '400px' }}>
                <Line data={data} options={options} />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                            <span className="text-gray-600 dark:text-gray-400">Current: ${predictionData.recentClose}</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-purple-600 mr-2"></div>
                            <span className="text-gray-600 dark:text-gray-400">
                                7-Day Target: ${predictedPrices[predictedPrices.length - 1].toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                        Change: {((predictedPrices[predictedPrices.length - 1] - predictionData.recentClose) / predictionData.recentClose * 100).toFixed(2)}%
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PredictionChart;
