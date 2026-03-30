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
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const chartTextColor = isDarkMode ? '#CBD5E1' : '#64748B';
    const chartTitleColor = isDarkMode ? '#F1F5F9' : '#0F172A';
    const chartGridColor = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.14)';
    const tooltipBackground = isDarkMode ? '#020617' : '#0F172A';

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
                borderColor: '#2563EB',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#2563EB',
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
                    color: chartTextColor
                }
            },
            title: {
                display: true,
                text: `${predictionData.symbol} - 7 Day Price Forecast`,
                font: {
                    size: 18,
                    weight: 'bold'
                },
                color: chartTitleColor,
                padding: {
                    top: 10,
                    bottom: 20
                }
            },
            tooltip: {
                backgroundColor: tooltipBackground,
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
                    color: chartGridColor,
                    drawBorder: false
                },
                ticks: {
                    callback: function(value) {
                        return '$' + value.toFixed(2);
                    },
                    font: {
                        size: 11
                    },
                    color: chartTextColor
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
                    color: chartTextColor,
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

    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <div style={{ height: '400px' }}>
                <Line data={data} options={options} />
            </div>
            <div className="mt-4 pt-4 border-t border-mm-border">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                            <span className="text-mm-text-secondary">Current: ${predictionData.recentClose}</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-mm-accent-primary mr-2"></div>
                            <span className="text-mm-text-secondary">
                                7-Day Target: ${predictedPrices[predictedPrices.length - 1].toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div className="text-mm-text-tertiary">
                        Change: {((predictedPrices[predictedPrices.length - 1] - predictionData.recentClose) / predictionData.recentClose * 100).toFixed(2)}%
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PredictionChart;
