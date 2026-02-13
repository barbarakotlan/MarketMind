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

// Helper to format the data for the new library
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

// --- MODIFIED: Removed 'withSize' and 'fitWidth' ---
const FinancialChart = ({ initialData, ticker, ratio = 1, width = 700 }) => {
    if (!initialData || initialData.length === 0) {
        return <div className="h-[500px] w-full flex items-center justify-center">Loading chart data...</div>;
    }

    const data = reformatData(initialData);

    const xScaleProvider = discontinuousTimeScaleProvider.inputDateAccessor(d => d.date);
    const {
        data: chartData,
        xScale,
        xAccessor,
        displayXAccessor,
    } = xScaleProvider(data);

    // Set the visible data range (e.g., last 100 data points)
    const xExtents = [
        xAccessor(last(chartData)),
        xAccessor(chartData[chartData.length - 100 < 0 ? 0 : chartData.length - 100]),
    ];

    return (
        <div className="mt-8">
            <ChartCanvas
                height={500}
                ratio={ratio}
                width={width} // This width will come from the responsive wrapper
                margin={{ left: 50, right: 70, top: 10, bottom: 30 }}
                type="hybrid"
                seriesName={ticker}
                data={chartData}
                xScale={xScale}
                xAccessor={xAccessor}
                displayXAccessor={displayXAccessor}
                xExtents={xExtents}
                panEvent={true} // Enable panning
                zoomEvent={true} // Enable zooming
            >
                <Chart id={1} yExtents={d => [d.high, d.low]}>
                    <XAxis axisAt="bottom" orient="bottom" ticks={6} />
                    <YAxis axisAt="right" orient="right" ticks={5} />
                    
                    <CandlestickSeries />
                    
                    <OHLCTooltip
                        origin={[-40, 0]}
                        ohlcFormat={format(".2f")}
                    />

                    {/* --- THIS IS YOUR DRAWING TOOLBAR --- */}
                    <DrawingObjectSelector
                        enabled
                        tools={[
                            TrendLine,
                            FibonacciRetracement,
                            EquidistantChannel,
                            StandardDeviationChannel,
                        ]}
                        onSelect={console.log}
                    />
                </Chart>
            </ChartCanvas>
        </div>
    );
};

export default FinancialChart;