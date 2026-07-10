import React from 'react';
import { Line } from 'react-chartjs-2';

const ActualVsPredictedChart = ({ evaluationData, selectedModel = 'ensemble' }) => {
    if (!evaluationData || !evaluationData.models) return null;
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const chartTextColor = isDarkMode ? '#CBD5E1' : '#64748B';
    const chartTitleColor = isDarkMode ? '#F1F5F9' : '#0F172A';
    const chartGridColor = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.14)';
    const tooltipBackground = isDarkMode ? '#020617' : '#0F172A';

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
                borderColor: '#2563EB',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                borderDash: [5, 5],
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#2563EB',
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
                    color: chartTextColor
                }
            },
            title: {
                display: true,
                text: `Actual vs Predicted Prices - ${selectedModel.replace('_', ' ').toUpperCase()}`,
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
                        size: 10
                    },
                    color: chartTextColor,
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
        <div className="ui-panel p-6 transition-colors duration-200">
            <div style={{ height: '450px' }}>
                <Line data={data} options={options} />
            </div>
            
            {/* Metrics Summary */}
            <div className="mt-6 pt-6 border-t border-mm-border">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                        <p className="text-xs text-mm-text-tertiary mb-1">MAE</p>
                        <p className="text-lg font-bold text-mm-text-primary">
                            ${modelData.metrics.mae}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-mm-text-tertiary mb-1">RMSE</p>
                        <p className="text-lg font-bold text-mm-text-primary">
                            ${modelData.metrics.rmse}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-mm-text-tertiary mb-1">MAPE</p>
                        <p className="text-lg font-bold text-mm-warning">
                            {modelData.metrics.mape}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-mm-text-tertiary mb-1">R²</p>
                        <p className="text-lg font-bold text-mm-positive">
                            {modelData.metrics.r_squared}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-mm-text-tertiary mb-1">Direction Acc</p>
                        <p className="text-lg font-bold text-mm-accent-primary">
                            {modelData.metrics.directional_accuracy}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActualVsPredictedChart;
