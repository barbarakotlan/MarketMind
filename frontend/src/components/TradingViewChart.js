import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * Helper function to format API data for the lightweight-charts library.
 * Sorts data chronologically and normalizes date and value formats.
 * 
 * @param {Array<{date: string, close: string|number}>|null} data - Raw data array from the API.
 * @returns {Array<{time: string, value: number}>} Formatted data compatible with lightweight-charts, sorted by time.
 */
const formatChartData = (data) => {
    if (!data) return [];
    // Ensure data is sorted by time and 'close' is a valid number
    return data
        .map(item => ({
            time: item.date.split(' ')[0], // Lightweight charts requires 'YYYY-MM-DD' format for dates
            value: parseFloat(item.close), // Ensure value is strictly a continuous numerical type
        }))
        .filter(item => !isNaN(item.value)) // Remove any unparseable or bad data points
        .sort((a, b) => new Date(a.time) - new Date(b.time));
};

/**
 * Helper function to normalize time-series data for comparison.
 * Converts absolute values into percentage changes relative to the earliest data point.
 * 
 * @param {Array<{time: string, value: number}>|null} data - Formatted data array.
 * @returns {Array<{time: string, value: number}>} Normalized data where the first value dictates the 100% baseline.
 */
const normalizeData = (data) => {
    if (!data || data.length === 0) return [];
    const baseValue = data[0].value;
    return data.map(item => ({
        ...item,
        value: (item.value / baseValue) * 100, // Convert raw price to percentage relative to baseValue
    }));
};

/**
 * TradingViewChart Component
 * 
 * Renders a highly performant financial chart using the lightweight-charts library.
 * Supports rendering a single data series (price) or two data series simultaneously (comparative percentage scale).
 * Automatically handles window resizing and appropriate Y-axis scales.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Array<{date: string, close: string|number}>} props.mainData - Primary time-series data to display.
 * @param {string} props.mainTicker - Ticker symbol or name for the main data series.
 * @param {Array<{date: string, close: string|number}>} [props.comparisonData] - Optional secondary time-series data for comparison mapping.
 * @param {string} [props.comparisonTicker] - Ticker symbol or name for the comparison data series.
 * @returns {JSX.Element} A div container embedding the lightweight-cart canvas.
 */
const TradingViewChart = ({ mainData, mainTicker, comparisonData, comparisonTicker }) => {
    // Reference to the DOM element where the chart will be appended
    const chartContainerRef = useRef(null);
    // Reference keeping track of the current chart instance to avoid duplications and enable updates/cleanup
    const chart = useRef(null); 

    // Determine if we are rendering in comparison mode (two ticker mode)
    const isComparing = comparisonData && comparisonData.length > 0;

    useEffect(() => {
        // Prevent initialization if fundamental dependencies are missing
        if (!mainData || mainData.length === 0 || !chartContainerRef.current) return;

        // Format data for the chart's specific intake needs
        const formattedMainData = formatChartData(mainData);
        if (formattedMainData.length === 0) return; // Don't render if no workable payload remains

        // --- Chart Creation ---
        // Instantiate the charting object
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
            // --- Comparison Mode (Percentage Series) ---
            const normalizedMainData = normalizeData(formattedMainData);
            const formattedComparisonData = formatChartData(comparisonData);

            if (formattedComparisonData.length === 0) return; // Bail cleanly if comparison payload is bad

            const normalizedComparisonData = normalizeData(formattedComparisonData);

            // Set the Y-axis to show percentages rather than absolute price values for valid comparison
            chart.current.priceScale('right').applyOptions({
                mode: 2, // 2 corresponds to Percentage mode in lightweight-charts
                scaleMargins: { top: 0.1, bottom: 0.1 },
            });

            // Add the fundamental asset as a shaded area surface
            const mainSeries = chart.current.addAreaSeries({
                lineColor: '#22c55e', // Green
                topColor: 'rgba(34, 197, 94, 0.4)',
                bottomColor: 'rgba(34, 197, 94, 0.01)',
                lineWidth: 2,
                title: mainTicker,
            });
            mainSeries.setData(normalizedMainData);

            // Add the comparative asset as a strict line graph
            const comparisonSeries = chart.current.addLineSeries({
                color: '#8B5CF6', // Purple
                lineWidth: 2,
                title: comparisonTicker,
            });
            comparisonSeries.setData(normalizedComparisonData);

        } else {
            // --- Single Ticker Mode (Absolute Price Series) ---
            // Y-axis to dynamically frame price ranges based on extrema
            chart.current.priceScale('right').applyOptions({
                scaleMargins: { top: 0.1, bottom: 0.15 },
            });

            // Add the main asset as a shaded area surface
            const mainSeries = chart.current.addAreaSeries({
                lineColor: '#22c55e',
                topColor: 'rgba(34, 197, 94, 0.4)',
                bottomColor: 'rgba(34, 197, 94, 0.01)',
                lineWidth: 2,
                title: mainTicker,
            });
            mainSeries.setData(formattedMainData);
        }

        // Auto-scale limits horizontally to fit all available time points
        chart.current.timeScale().fitContent();

        // --- Responsive Resize Logic ---
        const handleResize = () => {
            if (chart.current && chartContainerRef.current) {
                chart.current.resize(chartContainerRef.current.clientWidth, 500);
            }
        };
        // Bind the active resize handler
        window.addEventListener('resize', handleResize);

        // --- Unmount Cleanup Phase ---
        return () => {
            window.removeEventListener('resize', handleResize);
            if (chart.current) {
                chart.current.remove(); // Unbind memory internally consumed by the canvas object
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