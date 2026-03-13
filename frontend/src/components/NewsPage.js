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

    // Pre-defined categories for quick access
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

        const parsedDate = new Date(
            typeof rawTimestamp === 'number' ? rawTimestamp * 1000 : rawTimestamp
        );

        return Number.isNaN(parsedDate.getTime()) ? 'Recent' : parsedDate.toLocaleDateString();
    };

    // Helper to standardize API responses because /api/news and /news return different formats
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
            publishTime: formatPublishTime(article)
        };
    };

    const fetchNews = async (query = '', category = 'General') => {
        setLoading(true);
        setError('');
        setArticles([]);

        try {
            let data;
            
            // If searching or using a specific category filter, use the Search Endpoint
            if (query || (category !== 'General')) {
                const searchTerm = query || category; // Use category name if no manual query
                data = await apiRequest(API_ENDPOINTS.NEWS(searchTerm));
            } else {
                // Default to General News Endpoint
                data = await apiRequest(API_ENDPOINTS.NEWS());
            }
            
            // Handle cases where API returns different structures
            const rawArticles = Array.isArray(data) ? data : [];
            const normalized = rawArticles.map(normalizeArticle);
            
            setArticles(normalized);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchNews();
        // Intentionally load default feed once on mount.
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
        setSearchQuery(''); // Clear manual search when clicking a category
        fetchNews('', category.id);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* --- Header Section --- */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 space-y-4 md:space-y-0">
                <div className="text-center md:text-left">
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        <Globe className="w-10 h-10 text-blue-600" />
                        Market Intelligence
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Real-time news feed, sentiment analysis, and market movers.
                    </p>
                </div>

                {/* --- Search Bar --- */}
                <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
                    <input
                        type="text"
                        placeholder="Search tickers (e.g. NVDA) or topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
                    />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <button 
                        type="submit" 
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-md hover:bg-blue-200 transition-colors"
                    >
                        GO
                    </button>
                </form>
            </div>

            {/* --- Category Chips --- */}
            <div className="flex flex-wrap gap-3 mb-8 animate-fade-in">
                {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => handleCategoryClick(cat)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border ${
                                isActive 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* --- Content Area --- */}
            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl h-80 animate-pulse border border-gray-200 dark:border-gray-700">
                            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="text-center py-16 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                    <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Unable to Load News</h3>
                    <p className="text-red-500 dark:text-red-300 mb-6">{error}</p>
                    <button 
                        onClick={() => fetchNews('', 'General')}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
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
                                className="group flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 transform hover:-translate-y-1"
                            >
                                <div className="relative overflow-hidden h-48">
                                    <img 
                                        src={article.image} 
                                        alt={article.headline} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = NEWS_IMAGE_PLACEHOLDER;
                                        }}
                                    />
                                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md font-medium">
                                        {article.source}
                                    </div>
                                </div>
                                
                                <div className="p-6 flex flex-col flex-grow">
                                    <div className="flex items-center text-xs text-gray-400 mb-3 space-x-2">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                            {activeCategory === 'General' ? 'News' : activeCategory}
                                        </span>
                                        <span>•</span>
                                        <span>{article.publishTime}</span>
                                    </div>
                                    
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                                        {article.headline}
                                    </h2>
                                    
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3 flex-grow">
                                        {article.summary ? article.summary : "Click to read the full story..."}
                                    </p>
                                    
                                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center text-blue-600 dark:text-blue-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                                        Read Analysis <TrendingUp className="w-4 h-4 ml-2" />
                                    </div>
                                </div>
                            </a>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20">
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                <Search className="w-10 h-10 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">No Articles Found</h3>
                            <p className="text-gray-500">Try adjusting your search terms or selecting a different category.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NewsPage;
