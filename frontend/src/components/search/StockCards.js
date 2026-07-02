import React, { useState } from 'react';
import { formatLargeNumber, formatNum } from './format';

// Expandable company overview + quarterly financials
export const StockOverviewCard = ({ summary, financials }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!summary) return null;
    const truncated = isExpanded ? summary : `${summary.slice(0, 350)}...`;
    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Company Overview</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Overview</h2>
            <p className="mb-4 leading-relaxed text-mm-text-secondary">
                {truncated}
                {!isExpanded && (
                    <button onClick={() => setIsExpanded(true)} className="ml-1 font-medium text-mm-accent-primary hover:underline">
                        Read More
                    </button>
                )}
            </p>
            {financials && financials.revenue && (
                <div>
                    <h3 className="mb-3 text-lg font-semibold text-mm-text-primary">
                        Quarterly Financials {financials.quarterendDate && `(as of ${financials.quarterendDate})`}
                    </h3>
                    <div className="flex gap-4">
                        <div className="ui-panel-subtle flex-1 p-4">
                            <h4 className="text-sm text-mm-text-secondary">Revenue</h4>
                            <p className="mt-1 text-xl font-semibold text-mm-text-primary">{formatLargeNumber(financials.revenue)}</p>
                        </div>
                        <div className="ui-panel-subtle flex-1 p-4">
                            <h4 className="text-sm text-mm-text-secondary">Net Income</h4>
                            <p className="mt-1 text-xl font-semibold text-mm-text-primary">{formatLargeNumber(financials.netIncome)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 5-metric key metrics grid
export const KeyMetricsCard = ({ metrics }) => {
    if (!metrics) return null;
    const items = [
        { label: 'Beta (5Y)', value: formatNum(metrics.beta) },
        { label: 'Forward P/E', value: formatNum(metrics.forwardPE) },
        { label: 'PEG Ratio', value: formatNum(metrics.pegRatio) },
        { label: 'Price/Book', value: formatNum(metrics.priceToBook) },
        { label: 'Dividend Yield', value: formatNum(metrics.dividendYield, true) },
    ];
    const hasAny = items.some(i => i.value !== 'N/A');
    if (!hasAny) return null;
    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Core Metrics</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Key Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {items.map(item => (
                    <div key={item.label} className="ui-panel-subtle p-4 text-center">
                        <h4 className="text-sm font-medium text-mm-text-secondary">{item.label}</h4>
                        <p className="mt-1 text-2xl font-semibold text-mm-text-primary">{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Analyst rating badge + mean price target + upside %
export const AnalystRatingsCard = ({ ratings, price }) => {
    if (!ratings || !ratings.recommendationKey || !ratings.analystTargetPrice) return null;
    const { recommendationKey, analystTargetPrice, numberOfAnalystOpinions } = ratings;
    const upsidePercent = ((analystTargetPrice - price) / price) * 100;
    const key = recommendationKey.toLowerCase();
    let ratingColor = 'text-mm-text-secondary';
    if (key.includes('buy')) ratingColor = 'text-mm-positive';
    if (key.includes('sell')) ratingColor = 'text-mm-negative';
    if (key.includes('hold')) ratingColor = 'text-mm-warning';
    return (
        <div className="ui-panel mt-8 animate-fade-in p-6">
            <p className="ui-section-label mb-3">Street View</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Analyst Ratings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="ui-panel-subtle flex flex-col items-center justify-center p-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-mm-text-secondary">Consensus Rating</h3>
                    <p className={`text-5xl font-bold capitalize mt-2 ${ratingColor}`}>{recommendationKey}</p>
                    {numberOfAnalystOpinions && (
                        <p className="mt-1 text-sm text-mm-text-secondary">Based on {numberOfAnalystOpinions} analysts</p>
                    )}
                </div>
                <div className="ui-panel-subtle flex flex-col items-center justify-center p-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-mm-text-secondary">Mean Price Target</h3>
                    <p className="mt-2 text-5xl font-bold text-mm-text-primary">${formatNum(analystTargetPrice)}</p>
                    <p className={`mt-1 text-lg font-semibold ${upsidePercent >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
                        {formatNum(upsidePercent)}% {upsidePercent >= 0 ? 'Upside' : 'Downside'}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Recent news articles for the searched stock
export const StockNewsCard = ({ newsData }) => {
    const formatDate = (dateString) => {
        try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch (e) { return ''; }
    };
    return (
        <div className="ui-panel mt-8 animate-fade-in p-4 sm:p-6">
            <p className="ui-section-label mb-3">Catalysts</p>
            <h2 className="mb-4 text-2xl font-semibold text-mm-text-primary">Recent News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {newsData.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                       className="flex flex-col rounded-control border border-mm-border p-4 transition-colors hover:bg-mm-surface-subtle">
                        <h3 className="mb-2 line-clamp-3 text-sm font-semibold leading-snug text-mm-text-primary">{item.title}</h3>
                        {item.thumbnail_url && (
                            <img src={item.thumbnail_url} alt={item.title} className="w-full h-36 object-cover rounded-md my-2" />
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-mm-text-secondary">
                            <span className="font-medium truncate pr-4">{item.publisher}</span>
                            <span className="flex-shrink-0">{formatDate(item.publishTime)}</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};
