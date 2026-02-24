import React, { useState, useEffect } from 'react';
import {
    Search, Star, Briefcase, Building2, TrendingUp, Target,
    DollarSign, Bitcoin, Newspaper, Bell, BookOpen, BarChart3
} from 'lucide-react';

const MARKET_TICKERS = [
    { ticker: 'SPY', label: 'S&P 500' },
    { ticker: 'QQQ', label: 'NASDAQ' },
    { ticker: 'DIA', label: 'Dow Jones' },
    { ticker: 'BTC-USD', label: 'Bitcoin' },
    { ticker: 'GLD', label: 'Gold' },
];

const QUICK_ACCESS = [
    { page: 'search', icon: Search, label: 'Search', color: 'text-blue-500' },
    { page: 'watchlist', icon: Star, label: 'Watchlist', color: 'text-yellow-500' },
    { page: 'portfolio', icon: Briefcase, label: 'Portfolio', color: 'text-green-500' },
    { page: 'fundamentals', icon: Building2, label: 'Fundamentals', color: 'text-purple-500' },
    { page: 'predictions', icon: TrendingUp, label: 'Predictions', color: 'text-blue-400' },
    { page: 'performance', icon: Target, label: 'Evaluate', color: 'text-orange-500' },
    { page: 'forex', icon: DollarSign, label: 'Forex', color: 'text-emerald-500' },
    { page: 'news', icon: Newspaper, label: 'News', color: 'text-red-400' },
];

const cardClass = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm';
const skeletonClass = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

function MarketPulseStrip() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.allSettled(
            MARKET_TICKERS.map(({ ticker }) =>
                fetch(`http://127.0.0.1:5001/stock/${ticker}`).then(r => r.json())
            )
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
        <div className={`${cardClass} p-4`}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Market Pulse</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {MARKET_TICKERS.map(({ ticker, label }) => {
                    const stock = data[ticker];
                    const change = stock?.change_percent;
                    const isPos = change > 0;
                    const isNeg = change < 0;
                    return (
                        <div key={ticker} className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                            {loading || !stock ? (
                                <>
                                    <div className={`${skeletonClass} h-5 w-20 mt-1`}></div>
                                    <div className={`${skeletonClass} h-4 w-12 mt-1`}></div>
                                </>
                            ) : (
                                <>
                                    <span className="text-base font-semibold text-gray-900 dark:text-white">
                                        ${stock.price?.toFixed(2) ?? '—'}
                                    </span>
                                    <span className={`text-xs font-medium ${isPos ? 'text-green-500' : isNeg ? 'text-red-500' : 'text-gray-500'}`}>
                                        {isPos ? '+' : ''}{change?.toFixed(2) ?? '0.00'}%
                                    </span>
                                </>
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
        fetch('http://127.0.0.1:5001/paper/portfolio')
            .then(r => r.json())
            .then(d => { setPortfolio(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const hasPositions = portfolio?.positions?.length > 0;
    const totalValue = portfolio?.total_value;
    const pnl = portfolio?.total_pnl;
    const pnlPos = pnl > 0;

    return (
        <div className={`${cardClass} p-4`}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Portfolio</h2>
            {loading ? (
                <div className="space-y-2">
                    <div className={`${skeletonClass} h-7 w-32`}></div>
                    <div className={`${skeletonClass} h-4 w-24`}></div>
                </div>
            ) : !hasPositions ? (
                <div className="text-center py-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No positions yet</p>
                    <button
                        onClick={() => setActivePage('portfolio')}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Start Trading
                    </button>
                </div>
            ) : (
                <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${totalValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                    </p>
                    <p className={`text-sm font-medium mt-1 ${pnlPos ? 'text-green-500' : 'text-red-500'}`}>
                        {pnlPos ? '+' : ''}${pnl?.toFixed(2) ?? '0.00'} P&L
                    </p>
                    <button
                        onClick={() => setActivePage('portfolio')}
                        className="mt-3 text-xs text-blue-500 hover:underline"
                    >
                        Go to Portfolio →
                    </button>
                </div>
            )}
        </div>
    );
}

function AlertsBadgeCard({ setActivePage }) {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://127.0.0.1:5001/notifications/triggered')
            .then(r => r.json())
            .then(d => { setCount(d.length); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading || count === 0) return null;

    return (
        <div className={`${cardClass} p-4 border-amber-400 dark:border-amber-500`}>
            <div className="flex items-start space-x-3">
                <Bell className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {count} triggered alert{count !== 1 ? 's' : ''}
                    </p>
                    <button
                        onClick={() => setActivePage('notifications')}
                        className="mt-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    >
                        View Alerts →
                    </button>
                </div>
            </div>
        </div>
    );
}

function QuickAccessGrid({ setActivePage }) {
    return (
        <div className={`${cardClass} p-4`}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Quick Access</h2>
            <div className="grid grid-cols-4 gap-3">
                {QUICK_ACCESS.map(({ page, icon: Icon, label, color }) => (
                    <button
                        key={page}
                        onClick={() => setActivePage(page)}
                        className="flex flex-col items-center justify-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
                    >
                        <Icon className={`w-6 h-6 ${color} mb-1.5 group-hover:scale-110 transition-transform`} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
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
        fetch('http://127.0.0.1:5001/api/news?category=general&limit=3')
            .then(r => r.json())
            .then(d => {
                const items = Array.isArray(d) ? d : (d.articles ?? d.news ?? []);
                setArticles(items.slice(0, 3));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Top News</h2>
                <button
                    onClick={() => setActivePage('news')}
                    className="text-xs text-blue-500 hover:underline"
                >
                    See all →
                </button>
            </div>
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className={`${skeletonClass} h-12 w-full`}></div>)}
                </div>
            ) : articles.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No news available</p>
            ) : (
                <div className="space-y-3">
                    {articles.map((article, i) => (
                        <a
                            key={i}
                            href={article.url ?? article.link ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                        >
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-500 line-clamp-2 leading-snug">
                                {article.headline ?? article.title ?? 'Untitled'}
                            </p>
                            {article.source && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{article.source}</p>
                            )}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

const DashboardPage = ({ setActivePage }) => {
    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your market intelligence hub</p>
            </div>
            <MarketPulseStrip />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                    <PortfolioSummaryCard setActivePage={setActivePage} />
                    <AlertsBadgeCard setActivePage={setActivePage} />
                </div>
                <div className="col-span-2">
                    <QuickAccessGrid setActivePage={setActivePage} />
                </div>
            </div>
            <TopNewsSection setActivePage={setActivePage} />
        </div>
    );
};

export default DashboardPage;
