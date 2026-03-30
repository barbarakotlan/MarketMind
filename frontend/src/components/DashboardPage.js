import React, { useState, useEffect } from 'react';
import {
    Search, Star, Briefcase, Building2, TrendingUp, Target,
    DollarSign, Newspaper, Bell, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const MARKET_TICKERS = [
    { ticker: 'SPY', label: 'S&P 500' },
    { ticker: 'QQQ', label: 'NASDAQ' },
    { ticker: 'DIA', label: 'Dow Jones' },
    { ticker: 'BTC-USD', label: 'Bitcoin' },
    { ticker: 'GLD', label: 'Gold' },
];

const QUICK_ACCESS = [
    { page: 'search', icon: Search, label: 'Search' },
    { page: 'watchlist', icon: Star, label: 'Watchlist' },
    { page: 'portfolio', icon: Briefcase, label: 'Portfolio' },
    { page: 'fundamentals', icon: Building2, label: 'Fundamentals' },
    { page: 'predictions', icon: TrendingUp, label: 'Predictions' },
    { page: 'performance', icon: Target, label: 'Evaluate' },
    { page: 'forex', icon: DollarSign, label: 'Forex' },
    { page: 'news', icon: Newspaper, label: 'News' },
];

const cardClass = 'ui-panel transition-shadow duration-200 hover:shadow-elevated';
const skeletonClass = 'animate-pulse rounded-control bg-mm-surface-subtle';

function MarketPulseStrip() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.allSettled(
            MARKET_TICKERS.map(({ ticker }) => apiRequest(API_ENDPOINTS.STOCK(ticker)))
        ).then(results => {
            const map = {};
            results.forEach((r, i) => {
                if (r.status === 'fulfilled' && !r.value.error) {
                    map[MARKET_TICKERS[i].ticker] = r.value;
                }
            });
            setData(map);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    return (
        <div className="mb-8">
            <h2 className="ui-section-label mb-4 flex items-center">
                <TrendingUp className="mr-2 h-4 w-4 text-mm-accent-primary" /> Market Pulse
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {MARKET_TICKERS.map(({ ticker, label }) => {
                    const stock = data[ticker];
                    const change = stock?.changePercent || stock?.change_percent;
                    const isPos = change > 0;
                    const isNeg = change < 0;

                    return (
                        <div key={ticker} className={`${cardClass} p-4`}>
                            <span className="text-sm font-medium text-mm-text-secondary">{label}</span>

                            {loading || !stock ? (
                                <div className="mt-2">
                                    <div className={`${skeletonClass} mb-2 h-6 w-20`}></div>
                                    <div className={`${skeletonClass} h-4 w-12`}></div>
                                </div>
                            ) : (
                                <div className="mt-2">
                                    <span className="block text-xl font-semibold text-mm-text-primary">
                                        ${stock.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                                    </span>
                                    <div className={`mt-1 flex items-center text-sm font-semibold ${isPos ? 'text-mm-positive' : isNeg ? 'text-mm-negative' : 'text-mm-text-secondary'}`}>
                                        {isPos ? <ArrowUpRight className="mr-1 h-4 w-4" /> : isNeg ? <ArrowDownRight className="mr-1 h-4 w-4" /> : null}
                                        <span>{isPos ? '+' : ''}{change?.toFixed(2) ?? '0.00'}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PortfolioSummaryCard({ setActivePage }) {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiRequest(API_ENDPOINTS.PORTFOLIO)
            .then(d => { setPortfolio(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const stockPositionsCount = portfolio?.positions?.length || 0;
    const optionsPositionsCount = portfolio?.options_positions?.length || 0;
    const hasPositions = stockPositionsCount + optionsPositionsCount > 0;
    const totalValue = portfolio?.total_value;
    const pnl = portfolio?.total_pl;
    const pnlPos = pnl > 0;

    return (
        <div className="ui-panel-elevated h-full p-6">
            <div className="flex h-full flex-col justify-center">
                <h2 className="ui-section-label mb-4 flex items-center">
                    <Briefcase className="mr-2 h-4 w-4 text-mm-accent-primary" /> Portfolio Summary
                </h2>

                {loading ? (
                    <div className="space-y-3">
                        <div className={`${skeletonClass} h-10 w-40`}></div>
                        <div className={`${skeletonClass} h-5 w-24`}></div>
                    </div>
                ) : !hasPositions ? (
                    <div className="ui-panel-subtle py-5 text-center">
                        <p className="mb-4 text-mm-text-secondary">No active positions</p>
                        <button
                            onClick={() => setActivePage('portfolio')}
                            className="ui-button-primary"
                        >
                            Start Trading
                        </button>
                    </div>
                ) : (
                    <div>
                        <p className="text-4xl font-bold tracking-tight text-mm-text-primary">
                            ${totalValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                        </p>
                        <div className="mt-3 flex items-center">
                            <span className={`ui-status-chip ${pnlPos ? 'ui-status-chip--positive' : 'ui-status-chip--negative'}`}>
                                {pnlPos ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                ${Math.abs(pnl)?.toFixed(2) ?? '0.00'} P&L
                            </span>
                        </div>
                        <button
                            onClick={() => setActivePage('portfolio')}
                            className="mt-6 inline-flex items-center text-sm font-semibold text-mm-accent-primary hover:underline"
                        >
                            View Full Details <ArrowUpRight className="ml-1 h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function AlertsBadgeCard({ setActivePage }) {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiRequest(API_ENDPOINTS.NOTIFICATIONS_TRIGGERED(true))
            .then(d => { setCount(d.length); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading || count === 0) return null;

    return (
        <div className="mt-6 rounded-card border p-4 shadow-card" style={{
            backgroundColor: 'rgb(var(--mm-warning) / 0.08)',
            borderColor: 'rgb(var(--mm-warning) / 0.18)',
        }}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="rounded-control p-2" style={{ backgroundColor: 'rgb(var(--mm-warning) / 0.12)' }}>
                        <Bell className="h-5 w-5 text-mm-warning" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-mm-text-primary">Action Required</p>
                        <p className="text-xs text-mm-text-secondary">{count} triggered alert{count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <button
                    onClick={() => setActivePage('notifications')}
                    className="ui-button-secondary px-3 py-1.5 text-xs"
                >
                    Review
                </button>
            </div>
        </div>
    );
}

function QuickAccessGrid({ setActivePage }) {
    return (
        <div className="ui-panel p-6 h-full">
            <h2 className="ui-section-label mb-6 flex items-center">
                <Target className="mr-2 h-4 w-4 text-mm-accent-primary" /> Quick Access
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {QUICK_ACCESS.map(({ page, icon: Icon, label }) => (
                    <button
                        key={page}
                        onClick={() => setActivePage(page)}
                        className="ui-panel-subtle flex flex-col items-center justify-center p-4 transition-all duration-200 hover:border-mm-border-strong hover:shadow-card"
                    >
                        <div className="mb-3 rounded-pill p-3" style={{ backgroundColor: 'rgb(var(--mm-accent-primary) / 0.10)' }}>
                            <Icon className="h-6 w-6 text-mm-accent-primary" />
                        </div>
                        <span className="text-sm font-semibold text-mm-text-primary">{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function TopNewsSection({ setActivePage }) {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiRequest(`${API_ENDPOINTS.NEWS()}?category=general&limit=4`)
            .then(d => {
                const items = Array.isArray(d) ? d : (d.articles ?? d.news ?? []);
                setArticles(items.slice(0, 4));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className="ui-panel overflow-hidden mt-8">
            <div className="flex items-center justify-between border-b border-mm-border bg-mm-surface-subtle px-6 py-5">
                <h2 className="ui-section-label mb-0 flex items-center">
                    <Newspaper className="mr-2 h-4 w-4 text-mm-accent-primary" /> Top Headlines
                </h2>
                <button
                    onClick={() => setActivePage('news')}
                    className="inline-flex items-center text-sm font-semibold text-mm-accent-primary hover:underline"
                >
                    View All News <ArrowUpRight className="ml-1 h-4 w-4" />
                </button>
            </div>

            <div className="divide-y divide-mm-border">
                {loading ? (
                    <div className="space-y-4 p-6">
                        {[1, 2, 3].map(i => <div key={i} className={`${skeletonClass} h-12 w-full`}></div>)}
                    </div>
                ) : articles.length === 0 ? (
                    <div className="p-6 text-center text-mm-text-secondary">No news available at the moment.</div>
                ) : (
                    articles.map((article, i) => (
                        <a
                            key={i}
                            href={article.url ?? article.link ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block p-6 transition-colors hover:bg-mm-surface-subtle"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="mb-2 text-base font-semibold leading-tight text-mm-text-primary group-hover:text-mm-accent-primary">
                                        {article.headline ?? article.title ?? 'Untitled Article'}
                                    </p>
                                    <p className="text-xs font-medium uppercase tracking-wide text-mm-text-tertiary">
                                        {article.source?.name ?? article.source ?? article.publisher ?? 'Market News'}
                                    </p>
                                </div>
                            </div>
                        </a>
                    ))
                )}
            </div>
        </div>
    );
}

const DashboardPage = ({ setActivePage }) => {
    return (
        <div className="ui-page animate-fade-in space-y-2">
            <div className="ui-page-header">
                <h1 className="ui-page-title">Dashboard</h1>
                <p className="ui-page-subtitle">Welcome back. Here's your market intelligence overview.</p>
            </div>

            <MarketPulseStrip />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 flex flex-col">
                    <div className="flex-1">
                        <PortfolioSummaryCard setActivePage={setActivePage} />
                    </div>
                    <AlertsBadgeCard setActivePage={setActivePage} />
                </div>

                <div className="lg:col-span-2">
                    <QuickAccessGrid setActivePage={setActivePage} />
                </div>
            </div>

            <TopNewsSection setActivePage={setActivePage} />
        </div>
    );
};

export default DashboardPage;
