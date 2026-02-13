import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

// Helper function to format your API data for this library
const formatChartData = (data) => {
    if (!data) return [];
    // Ensure data is sorted by time and 'close' is a number
    return data
        .map(item => ({
            time: item.date.split(' ')[0], // Needs 'YYYY-MM-DD'
            value: parseFloat(item.close), // Ensure it's a number
        }))
        .filter(item => !isNaN(item.value)) // Remove any bad data
        .sort((a, b) => new Date(a.time) - new Date(b.time));
};

// Helper to normalize data for comparison
const normalizeData = (data) => {
    if (!data || data.length === 0) return [];
    const baseValue = data[0].value;
    return data.map(item => ({
        ...item,
        value: (item.value / baseValue) * 100, // Convert to %
    }));
};

const TradingViewChart = ({ mainData, mainTicker, comparisonData, comparisonTicker }) => {
    const chartContainerRef = useRef(null);
    const chart = useRef(null); // Use refs to hold chart and series instances

    // Determine if we are in comparison mode
    const isComparing = comparisonData && comparisonData.length > 0;

    useEffect(() => {
        if (!mainData || mainData.length === 0 || !chartContainerRef.current) return;

        // Format data for the chart
        const formattedMainData = formatChartData(mainData);
        if (formattedMainData.length === 0) return; // Don't render if no valid data

        // --- Chart Creation ---
        chart.current = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 500,
            layout: {
                background: { color: 'transparent' },
                textColor: '#333',
            },
            grid: {
                vertLines: { color: 'rgba(230, 230, 230, 1)' },
                horzLines: { color: 'rgba(230, 230, 230, 1)' },
            },
            timeScale: {
                timeVisible: true,
                borderColor: '#D1D5DB',
            },
            rightPriceScale: {
                borderColor: '#D1D5DB',
            },
        });

        // --- Series Creation ---
        if (isComparing) {
            // --- Comparison Mode (Percentage) ---
            const normalizedMainData = normalizeData(formattedMainData);
            const formattedComparisonData = formatChartData(comparisonData);

            if (formattedComparisonData.length === 0) return; // Don't add comparison if data is bad

            const normalizedComparisonData = normalizeData(formattedComparisonData);

            // Set the Y-axis to show percentages
            chart.current.priceScale('right').applyOptions({
                mode: 2, // Percentage mode
                scaleMargins: { top: 0.1, bottom: 0.1 },
            });

            // --- Correct function name is addAreaSeries ---
            const mainSeries = chart.current.addAreaSeries({
                lineColor: '#22c55e', // Green
                topColor: 'rgba(34, 197, 94, 0.4)',
                bottomColor: 'rgba(34, 197, 94, 0.01)',
                lineWidth: 2,
                title: mainTicker,
            });
            mainSeries.setData(normalizedMainData);

            const comparisonSeries = chart.current.addLineSeries({
                color: '#8B5CF6', // Purple
                lineWidth: 2,
                title: comparisonTicker,
            });
            comparisonSeries.setData(normalizedComparisonData);

        } else {
            // --- Single Ticker Mode (Price) ---
            // Set Y-axis to show price
            chart.current.priceScale('right').applyOptions({
                scaleMargins: { top: 0.1, bottom: 0.15 },
            });

            // --- Correct function name is addAreaSeries ---
            const mainSeries = chart.current.addAreaSeries({
                lineColor: '#22c55e',
                topColor: 'rgba(34, 197, 94, 0.4)',
                bottomColor: 'rgba(34, 197, 94, 0.01)',
                lineWidth: 2,
                title: mainTicker,
            });
            mainSeries.setData(formattedMainData);
        }

        chart.current.timeScale().fitContent();

        // --- Responsive Resize ---
        const handleResize = () => {
            if (chart.current && chartContainerRef.current) {
                chart.current.resize(chartContainerRef.current.clientWidth, 500);
            }
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (chart.current) {
                chart.current.remove();
            }
        };

    }, [mainData, mainTicker, comparisonData, comparisonTicker, isComparing]);


    return (
        <div 
            ref={chartContainerRef} 
            className="w-full mt-8"
        />
    );
};

export default TradingViewChart;