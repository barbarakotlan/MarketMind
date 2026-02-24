import React, { useState, useEffect } from 'react';
import {
    Search, Star, Briefcase, Building2, TrendingUp, Target,
    DollarSign, Newspaper, Bell, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const MARKET_TICKERS = [
    { ticker: 'SPY', label: 'S&P 500' },
    { ticker: 'QQQ', label: 'NASDAQ' },
    { ticker: 'DIA', label: 'Dow Jones' },
    { ticker: 'BTC-USD', label: 'Bitcoin' },
    { ticker: 'GLD', label: 'Gold' },
];

const QUICK_ACCESS = [
    { page: 'search', icon: Search, label: 'Search', color: 'text-blue-600', bg: 'bg-blue-50' },
    { page: 'watchlist', icon: Star, label: 'Watchlist', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { page: 'portfolio', icon: Briefcase, label: 'Portfolio', color: 'text-green-600', bg: 'bg-green-50' },
    { page: 'fundamentals', icon: Building2, label: 'Fundamentals', color: 'text-purple-600', bg: 'bg-purple-50' },
    { page: 'predictions', icon: TrendingUp, label: 'Predictions', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { page: 'performance', icon: Target, label: 'Evaluate', color: 'text-orange-600', bg: 'bg-orange-50' },
    { page: 'forex', icon: DollarSign, label: 'Forex', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { page: 'news', icon: Newspaper, label: 'News', color: 'text-rose-600', bg: 'bg-rose-50' },
];

// Upgraded base card style for a softer, more modern look
const cardClass = 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300';
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
        <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" /> Market Pulse
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {MARKET_TICKERS.map(({ ticker, label }) => {
                    const stock = data[ticker];
                    const change = stock?.changePercent || stock?.change_percent; // Adjusted to catch both camelCase and snake_case
                    const isPos = change > 0;
                    const isNeg = change < 0;

                    return (
                        <div key={ticker} className={`${cardClass} p-4 flex flex-col justify-between`}>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>

                            {loading || !stock ? (
                                <div className="mt-2">
                                    <div className={`${skeletonClass} h-6 w-20 mb-2`}></div>
                                    <div className={`${skeletonClass} h-4 w-12`}></div>
                                </div>
                            ) : (
                                <div className="mt-2">
                                    <span className="text-xl font-bold text-gray-900 dark:text-white block">
                                        ${stock.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                                    </span>
                                    <div className={`flex items-center mt-1 text-sm font-semibold ${isPos ? 'text-green-500' : isNeg ? 'text-red-500' : 'text-gray-500'}`}>
                                        {isPos ? <ArrowUpRight className="w-4 h-4 mr-1" /> : isNeg ? <ArrowDownRight className="w-4 h-4 mr-1" /> : null}
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
        fetch('http://127.0.0.1:5001/paper/portfolio')
            .then(r => r.json())
            .then(d => { setPortfolio(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const hasPositions = portfolio?.positions?.length > 0;
    const totalValue = portfolio?.total_value;
    const pnl = portfolio?.total_pl; // Fixed from total_pnl to match your backend
    const pnlPos = pnl > 0;

    return (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white h-full flex flex-col justify-center">
            <h2 className="text-sm font-medium text-blue-100 uppercase tracking-wider mb-4 flex items-center">
                <Briefcase className="w-4 h-4 mr-2" /> Your Portfolio
            </h2>

            {loading ? (
                <div className="space-y-3">
                    <div className="animate-pulse bg-blue-500/50 rounded h-10 w-40"></div>
                    <div className="animate-pulse bg-blue-500/50 rounded h-5 w-24"></div>
                </div>
            ) : !hasPositions ? (
                <div className="text-center py-4 bg-white/10 rounded-xl backdrop-blur-sm">
                    <p className="text-blue-100 mb-4">No active positions</p>
                    <button
                        onClick={() => setActivePage('portfolio')}
                        className="px-6 py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
                    >
                        Start Trading
                    </button>
                </div>
            ) : (
                <div>
                    <p className="text-4xl font-bold tracking-tight">
                        ${totalValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                    </p>
                    <div className="flex items-center mt-2">
                        <span className={`px-2 py-1 rounded text-sm font-bold flex items-center ${pnlPos ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                            {pnlPos ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                            ${Math.abs(pnl)?.toFixed(2) ?? '0.00'} P&L
                        </span>
                    </div>
                    <button
                        onClick={() => setActivePage('portfolio')}
                        className="mt-6 text-sm font-medium text-blue-100 hover:text-white flex items-center transition-colors"
                    >
                        View Full Details <ArrowUpRight className="w-4 h-4 ml-1" />
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
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-4 shadow-sm mt-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
                        <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Action Required</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">{count} triggered alert{count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <button
                    onClick={() => setActivePage('notifications')}
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline bg-white dark:bg-gray-800 px-3 py-1.5 rounded-md shadow-sm"
                >
                    Review
                </button>
            </div>
        </div>
    );
}

function QuickAccessGrid({ setActivePage }) {
    return (
        <div className={`${cardClass} p-6 h-full`}>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6 flex items-center">
                <Target className="w-4 h-4 mr-2" /> Quick Access
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {QUICK_ACCESS.map(({ page, icon: Icon, label, color, bg }) => (
                    <button
                        key={page}
                        onClick={() => setActivePage(page)}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md transition-all group"
                    >
                        <div className={`p-3 rounded-full ${bg} dark:bg-gray-700 mb-3 group-hover:scale-110 transition-transform duration-300`}>
                            <Icon className={`w-6 h-6 ${color}`} />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
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
        fetch('http://127.0.0.1:5001/api/news?category=general&limit=4')
            .then(r => r.json())
            .then(d => {
                const items = Array.isArray(d) ? d : (d.articles ?? d.news ?? []);
                setArticles(items.slice(0, 4)); // Bumped to 4 articles
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className={`${cardClass} p-0 overflow-hidden mt-8`}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <Newspaper className="w-4 h-4 mr-2" /> Top Headlines
                </h2>
                <button
                    onClick={() => setActivePage('news')}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center"
                >
                    View All News <ArrowUpRight className="w-4 h-4 ml-1" />
                </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                    <div className="p-6 space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className={`${skeletonClass} h-12 w-full`}></div>)}
                    </div>
                ) : articles.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No news available at the moment.</div>
                ) : (
                    articles.map((article, i) => (
                        <a
                            key={i}
                            href={article.url ?? article.link ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2 leading-tight">
                                        {article.headline ?? article.title ?? 'Untitled Article'}
                                    </p>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
        <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-2 animate-fade-in">
            {/* Header Area */}
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-2">Welcome back. Here's your market intelligence overview.</p>
            </div>

            {/* Pulse */}
            <MarketPulseStrip />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Portfolio & Alerts */}
                <div className="lg:col-span-1 flex flex-col">
                    <div className="flex-1">
                        <PortfolioSummaryCard setActivePage={setActivePage} />
                    </div>
                    <AlertsBadgeCard setActivePage={setActivePage} />
                </div>

                {/* Right Column: Quick Access */}
                <div className="lg:col-span-2">
                    <QuickAccessGrid setActivePage={setActivePage} />
                </div>
            </div>

            {/* Bottom Row */}
            <TopNewsSection setActivePage={setActivePage} />
        </div>
    );
};

export default DashboardPage;