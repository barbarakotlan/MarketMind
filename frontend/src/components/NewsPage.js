import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Zap, Globe, RefreshCw, Filter } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const NEWS_IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="#e5e7eb"/>
  <rect x="32" y="32" width="736" height="336" rx="24" fill="#dbeafe"/>
  <text x="50%" y="46%" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#1d4ed8">
    MarketMind
  </text>
  <text x="50%" y="58%" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#334155">
    News image unavailable
  </text>
</svg>
`)}`;

const NewsPage = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('General');

    const categories = [
        { id: 'General', label: 'Top Stories', icon: Globe },
        { id: 'Market Movers', label: 'Market Movers', icon: TrendingUp },
        { id: 'Earnings', label: 'Earnings', icon: Zap },
        { id: 'Crypto', label: 'Crypto', icon: RefreshCw },
        { id: 'IPO', label: 'IPOs', icon: Filter },
        { id: 'Mergers', label: 'Mergers & Acquisitions', icon: Filter },
    ];

    const formatPublishTime = (article) => {
        const rawTimestamp = article.publishTime ?? article.datetime;

        if (rawTimestamp === undefined || rawTimestamp === null || rawTimestamp === '' || rawTimestamp === 'N/A') {
            return 'Recent';
        }

        const parsedDate = new Date(typeof rawTimestamp === 'number' ? rawTimestamp * 1000 : rawTimestamp);
        return Number.isNaN(parsedDate.getTime()) ? 'Recent' : parsedDate.toLocaleDateString();
    };

    const normalizeArticle = (article) => {
        const headline = article.headline || article.title || 'No Headline';
        const source = article.source?.name || article.source || article.publisher || 'Unknown Source';
        const stableId = article.id || article.url || article.link || `${headline}-${source}`;
        const image = typeof article.image === 'string' && article.image.trim()
            ? article.image
            : typeof article.thumbnail_url === 'string' && article.thumbnail_url.trim()
                ? article.thumbnail_url
                : NEWS_IMAGE_PLACEHOLDER;

        return {
            id: stableId,
            headline,
            source,
            url: article.url || article.link || '#',
            summary: article.summary || article.description || '',
            image,
            publishTime: formatPublishTime(article),
        };
    };

    const fetchNews = async (query = '', category = 'General') => {
        setLoading(true);
        setError('');
        setArticles([]);

        try {
            let data;
            if (query || category !== 'General') {
                const searchTerm = query || category;
                data = await apiRequest(API_ENDPOINTS.NEWS(searchTerm));
            } else {
                data = await apiRequest(API_ENDPOINTS.NEWS());
            }

            const rawArticles = Array.isArray(data) ? data : [];
            setArticles(rawArticles.map(normalizeArticle));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setActiveCategory('Search');
        fetchNews(searchQuery, 'Search');
    };

    const handleCategoryClick = (category) => {
        setActiveCategory(category.id);
        setSearchQuery('');
        fetchNews('', category.id);
    };

    return (
        <div className="ui-page space-y-8">
            <div className="ui-page-header flex flex-col items-center justify-between gap-4 md:flex-row">
                <div className="text-center md:text-left">
                    <h1 className="ui-page-title flex items-center justify-center gap-3 md:justify-start">
                        <Globe className="h-10 w-10 text-mm-accent-primary" />
                        Market Intelligence
                    </h1>
                    <p className="ui-page-subtitle">
                        Real-time news feed, sentiment analysis, and market movers.
                    </p>
                </div>

                <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
                    <input
                        type="text"
                        placeholder="Search tickers (e.g. NVDA) or topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="ui-input py-3 pl-12 pr-16"
                    />
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mm-text-tertiary" />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-control bg-mm-accent-primary px-3 py-1 text-xs font-semibold text-white">
                        GO
                    </button>
                </form>
            </div>

            <div className="flex flex-wrap gap-3 animate-fade-in">
                {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => handleCategoryClick(cat)}
                            className={isActive ? 'ui-button-primary gap-2 px-5 py-2.5' : 'ui-button-secondary gap-2 px-5 py-2.5'}
                        >
                            <Icon className="h-4 w-4" />
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="ui-panel h-80 animate-pulse p-6">
                            <div className="mb-4 h-40 rounded-control bg-mm-surface-subtle"></div>
                            <div className="mb-2 h-4 w-3/4 rounded-control bg-mm-surface-subtle"></div>
                            <div className="h-4 w-1/2 rounded-control bg-mm-surface-subtle"></div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="ui-banner ui-banner-error py-10 text-center">
                    <h3 className="mb-2 text-xl font-semibold">Unable to Load News</h3>
                    <p className="mb-6">{error}</p>
                    <button onClick={() => fetchNews('', 'General')} className="ui-button-primary">
                        Retry Connection
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {articles.length > 0 ? (
                        articles.map((article) => (
                            <a
                                href={article.url}
                                key={article.id}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ui-panel flex h-full flex-col overflow-hidden transition hover:border-mm-border-strong hover:shadow-elevated"
                            >
                                <div className="relative h-48 overflow-hidden">
                                    <img
                                        src={article.image}
                                        alt={article.headline}
                                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = NEWS_IMAGE_PLACEHOLDER;
                                        }}
                                    />
                                    <div className="absolute right-3 top-3 rounded-control bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                                        {article.source}
                                    </div>
                                </div>

                                <div className="flex flex-grow flex-col p-6">
                                    <div className="mb-3 flex items-center space-x-2 text-xs text-mm-text-tertiary">
                                        <span className="font-semibold uppercase tracking-wider text-mm-accent-primary">
                                            {activeCategory === 'General' ? 'News' : activeCategory}
                                        </span>
                                        <span>•</span>
                                        <span>{article.publishTime}</span>
                                    </div>

                                    <h2 className="mb-3 line-clamp-2 text-lg font-semibold leading-snug text-mm-text-primary transition hover:text-mm-accent-primary">
                                        {article.headline}
                                    </h2>

                                    <p className="mb-4 line-clamp-3 flex-grow text-sm text-mm-text-secondary">
                                        {article.summary || 'Click to read the full story...'}
                                    </p>

                                    <div className="mt-auto flex items-center border-t border-mm-border pt-4 text-sm font-semibold text-mm-accent-primary">
                                        Read Analysis <TrendingUp className="ml-2 h-4 w-4" />
                                    </div>
                                </div>
                            </a>
                        ))
                    ) : (
                        <div className="col-span-full">
                            <div className="ui-empty-state py-20">
                                <div className="mb-4 rounded-pill border border-mm-border bg-mm-surface p-5">
                                    <Search className="h-10 w-10 text-mm-text-tertiary" />
                                </div>
                                <h3 className="text-xl font-semibold text-mm-text-primary">No Articles Found</h3>
                                <p>Try adjusting your search terms or selecting a different category.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NewsPage;
