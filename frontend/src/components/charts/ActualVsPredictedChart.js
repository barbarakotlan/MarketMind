import React from 'react';
import { Line } from 'react-chartjs-2';

const ActualVsPredictedChart = ({ evaluationData, selectedModel = 'ensemble' }) => {
    if (!evaluationData || !evaluationData.models) return null;

    const modelData = evaluationData.models[selectedModel];
    if (!modelData) return null;

    const data = {
        labels: evaluationData.dates,
        datasets: [
            {
                label: 'Actual Price',
                data: evaluationData.actuals,
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(34, 197, 94)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0.3,
                fill: false
            },
            {
                label: 'Predicted Price',
                data: modelData.predictions,
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                borderWidth: 3,
                borderDash: [5, 5],
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(147, 51, 234)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0.3,
                fill: false
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
                        size: 13,
                        weight: 'bold'
                    },
                    color: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#6b7280'
                }
            },
            title: {
                display: true,
                text: `Actual vs Predicted Prices - ${selectedModel.replace('_', ' ').toUpperCase()}`,
                font: {
                    size: 18,
                    weight: 'bold'
                },
                color: document.documentElement.classList.contains('dark') ? '#f9fafb' : '#1f2937',
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
                    },
                    afterBody: function(tooltipItems) {
                        if (tooltipItems.length === 2) {
                            const actual = tooltipItems[0].parsed.y;
                            const predicted = tooltipItems[1].parsed.y;
                            const error = Math.abs(actual - predicted);
                            const errorPct = ((error / actual) * 100).toFixed(2);
                            return [`Error: $${error.toFixed(2)} (${errorPct}%)`];
                        }
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: {
                    color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    callback: function(value) {
                        return '$' + value.toFixed(2);
                    },
                    font: {
                        size: 11
                    },
                    color: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#6b7280'
                }
            },
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 10
                    },
                    color: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#6b7280',
                    maxRotation: 45,
                    minRotation: 45,
                    maxTicksLimit: 15
                }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg transition-colors duration-200">
            <div style={{ height: '450px' }}>
                <Line data={data} options={options} />
            </div>
            
            {/* Metrics Summary */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">MAE</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                            ${modelData.metrics.mae}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">RMSE</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                            ${modelData.metrics.rmse}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">MAPE</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {modelData.metrics.mape}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">R²</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {modelData.metrics.r_squared}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Direction Acc</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {modelData.metrics.directional_accuracy}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActualVsPredictedChart;
