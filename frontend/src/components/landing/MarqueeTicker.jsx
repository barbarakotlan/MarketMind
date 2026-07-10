import React, { useState, useEffect, useMemo } from 'react';

// Live-ticker strip beneath the landing navbar: interleaves mock quotes and
// headlines into a seamless CSS marquee that pauses on hover.
function MarqueeTicker() {
    const [stocks, setStocks] = useState([]);
    const [news,   setNews]   = useState([]);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        // Mock stock data
        const mockStocks = [
            { type: 'stock', label: 'S&P 500', price: 452.38, change: 0.72 },
            { type: 'stock', label: 'NASDAQ', price: 398.42, change: 1.24 },
            { type: 'stock', label: 'Dow Jones', price: 389.15, change: -0.34 },
            { type: 'stock', label: 'AAPL', price: 182.52, change: 1.45 },
            { type: 'stock', label: 'MSFT', price: 415.26, change: 0.89 },
            { type: 'stock', label: 'NVDA', price: 875.28, change: 2.34 },
            { type: 'stock', label: 'TSLA', price: 175.34, change: -1.23 },
            { type: 'stock', label: 'GOOGL', price: 141.80, change: 0.56 },
            { type: 'stock', label: 'AMZN', price: 178.25, change: 0.91 },
            { type: 'stock', label: 'BTC', price: 51234.67, change: 3.45 },
            { type: 'stock', label: 'ETH', price: 2987.43, change: 2.12 },
            { type: 'stock', label: 'Gold', price: 2034.80, change: -0.15 },
        ];

        // Mock news headlines
        const mockNews = [
            { type: 'news', text: 'Fed signals potential rate cuts in coming months', source: 'Reuters' },
            { type: 'news', text: 'Tech stocks rally on strong AI earnings', source: 'Bloomberg' },
            { type: 'news', text: 'Oil prices stabilize amid Middle East tensions', source: 'CNBC' },
        ];

        setStocks(mockStocks);
        setNews(mockNews);
    }, []);

    // Interleave news into stock items then duplicate for seamless loop
    const combined = useMemo(() => {
        if (stocks.length === 0) return [];
        if (news.length === 0) return stocks;
        const out = [];
        const step = Math.max(2, Math.floor(stocks.length / (news.length + 1)));
        let ni = 0;
        stocks.forEach((s, i) => {
            out.push(s);
            if ((i + 1) % step === 0 && ni < news.length) {
                out.push(news[ni++]);
            }
        });
        return out;
    }, [stocks, news]);

    const looped = useMemo(() => [...combined, ...combined], [combined]);

    if (combined.length === 0) {
        // Loading skeleton
        return (
            <div className="bg-gray-900/90 border-b border-gray-700/50 h-10 flex items-center px-6 gap-8">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex gap-2 items-center flex-shrink-0">
                        <div className="h-3 w-12 bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-14 bg-gray-700 rounded animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    const duration = combined.length * 3.5; // seconds — 3.5s per item

    return (
        <div
            className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-700/50 overflow-hidden relative select-none"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* LIVE badge — fixed left */}
            <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-2 pl-3 pr-4 bg-gray-900 border-r border-gray-700/60">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Live</span>
            </div>

            {/* Scrolling strip */}
            <div className="overflow-hidden ml-[72px]">
                <div
                    className="flex items-stretch whitespace-nowrap"
                    style={{
                        animation: `marquee ${duration}s linear infinite`,
                        animationPlayState: paused ? 'paused' : 'running',
                        willChange: 'transform',
                    }}
                >
                    {looped.map((item, i) =>
                        item.type === 'stock' ? (
                            <div
                                key={i}
                                className="inline-flex items-center gap-2.5 px-5 py-2.5 border-r border-gray-700/40 flex-shrink-0"
                            >
                                <span className="text-xs font-bold text-white">{item.label}</span>
                                <span className="text-xs text-gray-400">
                                    ${typeof item.price === 'number' ? item.price.toFixed(2) : '—'}
                                </span>
                                <span className={`text-xs font-semibold ${item.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {item.change > 0 ? '▲' : '▼'} {Math.abs(item.change ?? 0).toFixed(2)}%
                                </span>
                            </div>
                        ) : (
                            <div
                                key={i}
                                className="inline-flex items-center gap-2 px-5 py-2.5 border-r border-gray-700/40 flex-shrink-0 max-w-xs"
                            >
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex-shrink-0">
                                    News
                                </span>
                                <span className="text-xs text-gray-300 truncate">{item.text}</span>
                                {item.source && (
                                    <span className="text-xs text-gray-600 flex-shrink-0">— {item.source}</span>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

export default MarqueeTicker;
