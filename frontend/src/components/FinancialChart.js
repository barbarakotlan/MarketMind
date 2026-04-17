import React from 'react';
import { ChartCanvas, Chart } from 'react-financial-charts';
import { XAxis, YAxis } from 'react-financial-charts';
import { discontinuousTimeScaleProvider } from 'react-financial-charts';
import { OHLCTooltip } from 'react-financial-charts';
import { CandlestickSeries } from 'react-financial-charts';
import { last } from 'react-financial-charts';
import { DrawingObjectSelector } from 'react-financial-charts';
import {
    TrendLine,
    FibonacciRetracement,
    EquidistantChannel,
    StandardDeviationChannel,
} from 'react-financial-charts';
import { format } from 'd3-format';

/**
 * Transforms raw API market data into the strict format expected by `react-financial-charts`.
 * Specifically maps string dates into Javascript Date objects.
 * 
 * @param {Array<{date: string, open: number, high: number, low: number, close: number, volume: number}>|null} chartData - The raw Open-High-Low-Close data array.
 * @returns {Array<{date: Date, open: number, high: number, low: number, close: number, volume: number}>} Formatted data array suitable for scale providers.
 */
const reformatData = (chartData) => {
    if (!chartData || chartData.length === 0) return [];
    
    return chartData.map(d => ({
        date: new Date(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
    }));
};

/**
 * FinancialChart Component
 * 
 * Renders an interactive candlestick financial chart using `react-financial-charts`.
 * It includes built-in panning, zooming, OHLC tooltips, and a selection of drawing tools.
 * 
 * Note: Width is conventionally provided by a wrapping `withSize` or responsive HOC,
 * but can be strictly defined through props as well.
 * 
 * @component
 * @param {Object} props - React props.
 * @param {Array<Object>} props.initialData - Time-series market data for mapping.
 * @param {string} props.ticker - Stock or asset ticker symbol used for naming tooltips and series.
 * @param {number} [props.ratio=1] - Device pixel ratio to handle high-DPI (Retina) display crispness.
 * @param {number} [props.width=700] - Explicit chart width in pixels.
 * @returns {JSX.Element} The rendered robust canvas-based chart.
 */
const FinancialChart = ({ initialData, ticker, ratio = 1, width = 700 }) => {
    // Early exit cleanly if data is not yet resolved, rendering a placeholder
    if (!initialData || initialData.length === 0) {
        return <div className="h-[500px] w-full flex items-center justify-center">Loading chart data...</div>;
    }

    // Prepare data strings into primitive values that d3 expects
    const data = reformatData(initialData);

    // Initialize an advanced scale provider that omits weekends and non-trading days 
    // to prevent visual gaps in the candlestick chart
    const xScaleProvider = discontinuousTimeScaleProvider.inputDateAccessor(d => d.date);
    
    // Extract calculated scaling functions and continuous data from the provider
    const {
        data: chartData,
        xScale,
        xAccessor,
        displayXAccessor,
    } = xScaleProvider(data);

    // Define the initial zoom viewport extents.
    // By standard, we focus on the last 100 periods/ticks to maintain readability.
    const xExtents = [
        xAccessor(last(chartData)),
        xAccessor(chartData[chartData.length - 100 < 0 ? 0 : chartData.length - 100]),
    ];

    return (
        <div className="mt-8">
            {/* The primary Canvas container encapsulating drawing context and pan/zoom states */}
            <ChartCanvas
                height={500}
                ratio={ratio}
                width={width} // Width managed contextually from upstream responsive containers
                margin={{ left: 50, right: 70, top: 10, bottom: 30 }}
                type="hybrid" // Optimized context type utilizing SVG overlapping a Canvas element
                seriesName={ticker}
                data={chartData}
                xScale={xScale}
                xAccessor={xAccessor}
                displayXAccessor={displayXAccessor}
                xExtents={xExtents}
                panEvent={true} // Enable canvas drag-to-pan feature
                zoomEvent={true} // Enable scroll/pinch to zoom feature
            >
                {/* Secondary wrapper managing localized limits and coordinate spaces */}
                <Chart id={1} yExtents={d => [d.high, d.low]}>
                    {/* Time Axis Configuration */}
                    <XAxis axisAt="bottom" orient="bottom" ticks={6} />
                    {/* Price Range Configuration */}
                    <YAxis axisAt="right" orient="right" ticks={5} />
                    
                    {/* Core visual representation: Candlesticks */}
                    <CandlestickSeries />
                    
                    {/* Floating heads-up display displaying discrete data metrics */}
                    <OHLCTooltip
                        origin={[-40, 0]}
                        ohlcFormat={format(".2f")} // Enforce conventional fiat 2-decimal trailing zeroes rounding
                    />

                    {/* Integrated drawing toolkit empowering user annotation across chart geometries */}
                    <DrawingObjectSelector
                        enabled
                        tools={[
                            TrendLine,
                            FibonacciRetracement,
                            EquidistantChannel,
                            StandardDeviationChannel,
                        ]}
                        onSelect={console.log} // Hook for handling drawing completion actions or storage
                    />
                </Chart>
            </ChartCanvas>
        </div>
    );
};

export default FinancialChart;