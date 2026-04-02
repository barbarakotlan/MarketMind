import React, { useState } from 'react';
import {
    Building2,
    Search,
    TrendingUp,
    DollarSign,
    BarChart3,
    Target,
    Calendar,
    FileText,
    ExternalLink,
    ShieldAlert,
    Users,
    Activity,
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import {
    getMarketSessionLabel,
    getMarketSessionSummary,
    getMarketSessionToneClasses,
    getTimezoneLabel,
} from './ui/marketSessionUtils';

const US_TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'financials', label: 'Financials' },
    { key: 'filings', label: 'SEC Filings' },
];

const INTERNATIONAL_TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'research', label: 'Company Research' },
];

const MARKET_OPTIONS = [
    { value: 'us', label: 'US' },
    { value: 'hk', label: 'HK' },
    { value: 'cn', label: 'CN' },
];

const normalizeMarket = (market = 'us') => {
    const normalized = String(market || 'us').trim().toLowerCase();
    return MARKET_OPTIONS.some((option) => option.value === normalized) ? normalized : 'us';
};

const normalizeAssetInput = (input, fallbackMarket = 'us') => {
    const rawValue = String(input || '').trim();
    if (!rawValue) return null;

    const prefixed = rawValue.match(/^([A-Za-z]{2}):(.+)$/);
    const market = normalizeMarket(prefixed?.[1] || fallbackMarket);
    const rawSymbol = prefixed?.[2] || rawValue;
    const symbol = market === 'us'
        ? rawSymbol.trim().toUpperCase()
        : rawSymbol.replace(/\D/g, '').padStart(market === 'hk' ? 5 : 6, '0');

    if (!symbol) return null;

    return {
        symbol,
        market: market.toUpperCase(),
        assetId: market === 'us' ? `US:${symbol}` : `${market.toUpperCase()}:${symbol}`,
        displayLabel: market === 'us' ? symbol : `${market.toUpperCase()}:${symbol}`,
    };
};

const isUsAsset = (asset) => !asset || asset.market === 'US';

const fmtBig = (val, prefix = '') => {
    if (val === null || val === undefined || val === 'N/A' || val === 'None') return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '—';
    const abs = Math.abs(num);
    if (abs >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
    return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const currencyPrefix = (currency) => {
    switch (String(currency || '').toUpperCase()) {
    case 'HKD':
        return 'HK$';
    case 'CNY':
        return 'CN¥';
    case 'USD':
    default:
        return '$';
    }
};

const INCOME_ROWS = [
    { label: 'Revenue', key: 'revenue' },
    { label: 'Gross Profit', key: 'gross_profit' },
    { label: 'Operating Income', key: 'operating_income' },
    { label: 'Net Income', key: 'net_income' },
    { label: 'EBITDA', key: 'ebitda' },
    { label: 'EPS', key: 'eps', raw: true },
];

const BALANCE_ROWS = [
    { label: 'Total Assets', key: 'total_assets' },
    { label: 'Total Liabilities', key: 'total_liab' },
    { label: 'Total Equity', key: 'total_equity' },
    { label: 'Cash & Equivalents', key: 'cash' },
    { label: 'Total Debt', key: 'total_debt' },
    { label: 'Working Capital', key: 'working_capital' },
];

const CASHFLOW_ROWS = [
    { label: 'Operating Cash Flow', key: 'operating' },
    { label: 'Investing Cash Flow', key: 'investing' },
    { label: 'Financing Cash Flow', key: 'financing' },
    { label: 'Capital Expenditures', key: 'capex' },
    { label: 'Free Cash Flow', key: 'free_cf' },
];

const metricToneClass = {
    accent: 'text-mm-accent-primary',
    positive: 'text-mm-positive',
    warning: 'text-mm-warning',
    tertiary: 'text-mm-text-tertiary',
};

const sectionTitleClass = 'text-2xl font-semibold text-mm-text-primary mb-6';

const FinancialTable = ({ title, rows, data }) => {
    if (!data || data.length === 0) return null;
    const periods = data.map((d) => d.period);

    return (
        <div className="ui-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-mm-border">
                <h3 className="text-sm font-semibold text-mm-text-primary">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-mm-surface-subtle">
                        <tr>
                            <th className="px-5 py-2.5 text-left text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">Metric</th>
                            {periods.map((p) => (
                                <th key={p} className="px-5 py-2.5 text-right text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">
                                    {p}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-mm-border">
                        {rows.map(({ label, key, raw }) => (
                            <tr key={key} className="hover:bg-mm-surface-subtle/80">
                                <td className="px-5 py-2.5 text-mm-text-secondary font-medium">{label}</td>
                                {data.map((d) => (
                                    <td key={d.period} className="px-5 py-2.5 text-right text-mm-text-primary">
                                        {raw ? fmtBig(d[key]) : fmtBig(d[key], '$')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, icon: Icon, tone = 'accent' }) => (
    <div className="ui-panel-subtle p-4">
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-mm-text-secondary">{title}</span>
            {Icon && <Icon className={`w-4 h-4 ${metricToneClass[tone] || metricToneClass.accent}`} />}
        </div>
        <p className="text-xl font-semibold text-mm-text-primary">{value}</p>
    </div>
);

const TabButton = ({ active, children, onClick }) => (
    <button
        onClick={onClick}
        className={active
            ? 'rounded-control bg-mm-accent-primary px-5 py-2 text-sm font-semibold text-white shadow-card'
            : 'rounded-control border border-mm-border bg-mm-surface px-5 py-2 text-sm font-semibold text-mm-text-secondary transition hover:bg-mm-surface-subtle hover:text-mm-text-primary'}
    >
        {children}
    </button>
);

const ResearchProfileList = ({ items }) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        <div className="ui-panel p-6">
            <h3 className={sectionTitleClass}>Company Research</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="ui-panel-subtle p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mm-text-tertiary">{item.label}</p>
                        <p className="mt-2 text-sm leading-6 text-mm-text-primary break-words">{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AnnouncementsPanel = ({ items }) => {
    if (!Array.isArray(items) || items.length === 0) {
        return (
            <div className="ui-panel-subtle py-16 text-mm-text-secondary text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No company announcements were returned for this asset.</p>
            </div>
        );
    }

    return (
        <div className="ui-panel p-6">
            <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-mm-accent-primary" />
                <h3 className="text-lg font-semibold text-mm-text-primary">Company Announcements</h3>
            </div>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <a
                        key={`${item.link || item.title}-${index}`}
                        href={item.link || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-card border border-mm-border bg-mm-surface px-4 py-4 transition hover:bg-mm-surface-subtle"
                    >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-mm-text-tertiary">
                            <span className="rounded-pill border border-mm-border px-2 py-0.5 font-semibold uppercase tracking-[0.12em]">
                                {item.type || 'Announcement'}
                            </span>
                            {item.date ? <span>{item.date}</span> : null}
                            {item.publisher ? <span>• {item.publisher}</span> : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-mm-text-primary">{item.title || item.description || 'Company announcement'}</p>
                        {item.description && item.description !== item.title ? (
                            <p className="mt-2 text-sm leading-6 text-mm-text-secondary">{item.description}</p>
                        ) : null}
                        {item.link ? (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-mm-accent-primary">
                                Open source link <ExternalLink className="w-3 h-3" />
                            </span>
                        ) : null}
                    </a>
                ))}
            </div>
        </div>
    );
};

const FundamentalsPage = () => {
    const [ticker, setTicker] = useState('');
    const [selectedMarket, setSelectedMarket] = useState('us');
    const [resolvedAsset, setResolvedAsset] = useState(null);
    const [fundamentals, setFundamentals] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [filings, setFilings] = useState(null);
    const [secIntelligence, setSecIntelligence] = useState(null);
    const [secIntelligenceError, setSecIntelligenceError] = useState('');
    const [expandedFilingAccession, setExpandedFilingAccession] = useState(null);
    const [filingDetailState, setFilingDetailState] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const activeAsset = resolvedAsset || (fundamentals ? normalizeAssetInput(fundamentals.assetId || fundamentals.symbol, fundamentals.market || selectedMarket) : null);
    const internationalResearchMode = activeAsset && !isUsAsset(activeAsset);
    const tabs = internationalResearchMode ? INTERNATIONAL_TABS : US_TABS;
    const marketSession = fundamentals?.marketSession || null;

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        const asset = normalizeAssetInput(ticker, selectedMarket);
        if (!asset) {
            setError('Enter a valid ticker like AAPL, HK:00700, or CN:600519.');
            return;
        }

        setLoading(true);
        setError('');
        setTicker(asset.displayLabel);
        setSelectedMarket(asset.market.toLowerCase());
        setResolvedAsset(asset);
        setFundamentals(null);
        setFinancials(null);
        setFilings(null);
        setSecIntelligence(null);
        setSecIntelligenceError('');
        setExpandedFilingAccession(null);
        setFilingDetailState({});
        setActiveTab('overview');

        try {
            const overview = await apiRequest(API_ENDPOINTS.FUNDAMENTALS(asset.symbol, asset.market));
            setFundamentals(overview);
            setResolvedAsset(normalizeAssetInput(overview?.assetId || overview?.symbol || asset.symbol, overview?.market || asset.market) || asset);

            if (asset.market !== 'US') {
                return;
            }

            const [financialsRes, filingsRes, secIntelligenceRes] = await Promise.allSettled([
                apiRequest(API_ENDPOINTS.FUNDAMENTALS_FINANCIALS(asset.symbol)),
                apiRequest(API_ENDPOINTS.FUNDAMENTALS_FILINGS(asset.symbol, asset.market)),
                apiRequest(API_ENDPOINTS.FUNDAMENTALS_SEC_INTELLIGENCE(asset.symbol, asset.market)),
            ]);

            if (financialsRes.status === 'fulfilled' && !financialsRes.value?.error) {
                setFinancials(financialsRes.value);
            }
            if (filingsRes.status === 'fulfilled' && !filingsRes.value?.error) {
                setFilings(filingsRes.value);
            }
            if (secIntelligenceRes.status === 'fulfilled' && !secIntelligenceRes.value?.error) {
                setSecIntelligence(secIntelligenceRes.value);
            } else if (secIntelligenceRes.status === 'fulfilled' && secIntelligenceRes.value?.error) {
                setSecIntelligenceError(secIntelligenceRes.value.error);
            } else if (secIntelligenceRes.status === 'rejected') {
                setSecIntelligenceError(secIntelligenceRes.reason?.message || 'Failed to fetch SEC intelligence');
            }
        } catch (searchError) {
            setError(searchError?.message || 'Failed to fetch fundamentals');
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (value, prefix = '', suffix = '') => {
        if (value === 'N/A' || value === 'None' || value === null || value === undefined || value === '') return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T${suffix}`;
        if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B${suffix}`;
        if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M${suffix}`;
        return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
    };

    const formatPercent = (value) => {
        if (value === 'N/A' || value === 'None' || value === null || value === undefined || value === '') return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return `${(num * 100).toFixed(2)}%`;
    };

    const formatPercentValue = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        const num = parseFloat(value);
        return Number.isFinite(num) ? `${num.toFixed(1)}%` : '—';
    };

    const formatSignedInteger = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        const num = Number(value);
        if (!Number.isFinite(num)) return '—';
        return `${num > 0 ? '+' : ''}${Math.round(num).toLocaleString()}`;
    };

    const filingDetailEndpoint = (accessionNumber) => {
        const symbol = fundamentals?.symbol || activeAsset?.symbol || ticker.toUpperCase().trim();
        return API_ENDPOINTS.FUNDAMENTALS_FILING_DETAIL(symbol, accessionNumber);
    };

    const loadFilingDetail = async (filing, { expand = true } = {}) => {
        const accessionNumber = filing?.accessionNumber;
        if (!accessionNumber) return;

        if (expand) {
            setExpandedFilingAccession(accessionNumber);
        }

        setFilingDetailState((prev) => ({
            ...prev,
            [accessionNumber]: {
                status: 'loading',
                error: '',
                data: prev[accessionNumber]?.data || null,
                activeSectionKey: prev[accessionNumber]?.activeSectionKey || null,
            },
        }));

        try {
            const detail = await apiRequest(filingDetailEndpoint(accessionNumber));
            const normalizedDetail = detail || { sections: [] };
            setFilingDetailState((prev) => ({
                ...prev,
                [accessionNumber]: {
                    status: 'success',
                    error: '',
                    data: normalizedDetail,
                    activeSectionKey: normalizedDetail.sections?.[0]?.key || null,
                },
            }));
        } catch (detailError) {
            setFilingDetailState((prev) => ({
                ...prev,
                [accessionNumber]: {
                    status: 'error',
                    error: detailError?.message || 'Failed to load SEC filing detail.',
                    data: prev[accessionNumber]?.data || null,
                    activeSectionKey: prev[accessionNumber]?.activeSectionKey || null,
                },
            }));
        }
    };

    const handleToggleFilingDetail = async (filing) => {
        const accessionNumber = filing?.accessionNumber;
        if (!accessionNumber) return;

        if (expandedFilingAccession === accessionNumber) {
            setExpandedFilingAccession(null);
            return;
        }

        const existingState = filingDetailState[accessionNumber];
        setExpandedFilingAccession(accessionNumber);
        if (existingState?.status === 'success') {
            return;
        }
        await loadFilingDetail(filing, { expand: false });
    };

    const setActiveFilingSection = (accessionNumber, sectionKey) => {
        setFilingDetailState((prev) => ({
            ...prev,
            [accessionNumber]: {
                ...prev[accessionNumber],
                activeSectionKey: sectionKey,
            },
        }));
    };

    return (
        <div className="ui-page animate-fade-in space-y-8">
            <div className="ui-page-header text-center">
                <div className="flex items-center justify-center mb-3">
                    <div className="mr-3 inline-flex items-center justify-center rounded-control border border-mm-accent-primary/15 bg-mm-accent-primary/10 p-3">
                        <Building2 className="w-8 h-8 text-mm-accent-primary" />
                    </div>
                    <h1 className="ui-page-title">Company Fundamentals</h1>
                </div>
                <p className="ui-page-subtitle">
                    Comprehensive financial data and metrics for publicly traded companies
                </p>
            </div>

            <div className="ui-panel p-6">
                <form onSubmit={handleSearch} className="flex gap-4 flex-col md:flex-row">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-mm-text-tertiary" />
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            placeholder="Enter ticker (e.g., AAPL, HK:00700, CN:600519)"
                            className="ui-input pl-10"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !ticker.trim()}
                        className={`px-8 py-3 ${loading || !ticker.trim() ? 'ui-button-secondary cursor-not-allowed opacity-60' : 'ui-button-primary'}`}
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>
                <div className="mt-4 flex flex-wrap gap-2">
                    {MARKET_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedMarket(option.value)}
                            className={selectedMarket === option.value ? 'ui-chip bg-mm-accent-primary text-white border-mm-accent-primary' : 'ui-chip'}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-mm-accent-primary border-t-transparent"></div>
                    <p className="mt-4 text-mm-text-secondary">Loading fundamentals...</p>
                </div>
            )}

            {error && (
                <div className="rounded-card border border-mm-negative/20 bg-mm-negative/10 px-6 py-4 text-mm-negative">
                    {error}
                </div>
            )}

            {fundamentals && !loading && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => (
                            <TabButton
                                key={tab.key}
                                active={activeTab === tab.key}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                            </TabButton>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="ui-panel-elevated p-8">
                                <p className="ui-section-label mb-3">Company Snapshot</p>
                                <div className="flex items-start justify-between mb-4 gap-6 flex-col lg:flex-row">
                                    <div>
                                        <h2 className="text-3xl font-semibold text-mm-text-primary mb-2">
                                            {fundamentals.name}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-mm-text-secondary">
                                            <span className="font-semibold text-mm-text-primary">
                                                {internationalResearchMode ? activeAsset?.assetId || fundamentals.symbol : fundamentals.symbol}
                                            </span>
                                            <span>•</span>
                                            <span>{fundamentals.exchange}</span>
                                            <span>•</span>
                                            <span>{fundamentals.currency}</span>
                                        </div>
                                        {marketSession ? (
                                            <div className="mt-4 rounded-card border border-mm-border bg-mm-surface-subtle px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-mm-text-secondary">
                                                    <span className={`rounded-pill border px-2.5 py-1 font-semibold uppercase tracking-[0.12em] ${getMarketSessionToneClasses(marketSession)}`}>
                                                        {getMarketSessionLabel(marketSession)}
                                                    </span>
                                                    <span>{marketSession.exchange || fundamentals.exchange}</span>
                                                    {marketSession.timezone ? <span>• {getTimezoneLabel(marketSession.timezone)}</span> : null}
                                                </div>
                                                <p className="mt-2 text-sm text-mm-text-secondary">
                                                    {getMarketSessionSummary(marketSession)}
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="text-left lg:text-right">
                                        <p className="ui-section-label mb-2">Sector</p>
                                        <p className="text-lg font-semibold text-mm-text-primary">{fundamentals.sector}</p>
                                        <p className="text-sm text-mm-text-secondary mt-1">{fundamentals.industry}</p>
                                    </div>
                                </div>
                                {fundamentals.description !== 'N/A' && (
                                    <p className="text-mm-text-secondary leading-relaxed">
                                        {fundamentals.description}
                                    </p>
                                )}
                            </div>

                            {internationalResearchMode ? (
                                <>
                                    <div className="ui-panel-subtle p-5 text-sm text-mm-text-secondary">
                                        Akshare international mode is read-only in phase 1. You can inspect company context, technical levels, and announcement history here, while SEC, watchlist, prediction, and paper-trading flows remain US-only.
                                    </div>

                                    <div className="ui-panel p-6">
                                        <h3 className={`${sectionTitleClass} flex items-center`}>
                                            <BarChart3 className="w-6 h-6 mr-2 text-mm-accent-primary" />
                                            International Snapshot
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <MetricCard title="Market Cap" value={formatNumber(fundamentals.market_cap, currencyPrefix(fundamentals.currency))} icon={DollarSign} tone="accent" />
                                            <MetricCard title="P/E Ratio" value={formatNumber(fundamentals.pe_ratio)} icon={Target} tone="accent" />
                                            <MetricCard title="Price/Book" value={formatNumber(fundamentals.price_to_book_ratio)} icon={BarChart3} tone="warning" />
                                            <MetricCard title="Shares Outstanding" value={formatNumber(fundamentals.shares_outstanding)} icon={Users} tone="tertiary" />
                                        </div>
                                    </div>

                                    <div className="ui-panel p-6">
                                        <h3 className={sectionTitleClass}>Price & Technicals</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <MetricCard title="52-Week High" value={formatNumber(fundamentals.week_52_high, currencyPrefix(fundamentals.currency))} />
                                            <MetricCard title="52-Week Low" value={formatNumber(fundamentals.week_52_low, currencyPrefix(fundamentals.currency))} />
                                            <MetricCard title="50-Day MA" value={formatNumber(fundamentals.day_50_moving_average, currencyPrefix(fundamentals.currency))} />
                                            <MetricCard title="200-Day MA" value={formatNumber(fundamentals.day_200_moving_average, currencyPrefix(fundamentals.currency))} />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="ui-panel p-6">
                                        <h3 className={`${sectionTitleClass} flex items-center`}>
                                            <BarChart3 className="w-6 h-6 mr-2 text-mm-accent-primary" />
                                            Key Metrics
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <MetricCard title="Market Cap" value={formatNumber(fundamentals.market_cap, '$')} icon={DollarSign} tone="accent" />
                                            <MetricCard title="P/E Ratio" value={formatNumber(fundamentals.pe_ratio)} icon={Target} tone="accent" />
                                            <MetricCard title="EPS" value={formatNumber(fundamentals.eps, '$')} icon={TrendingUp} tone="accent" />
                                            <MetricCard title="Beta" value={formatNumber(fundamentals.beta)} icon={BarChart3} tone="warning" />
                                        </div>
                                    </div>

                                    <div className="ui-panel p-6">
                                        <h3 className={sectionTitleClass}>Valuation Metrics</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <MetricCard title="Forward P/E" value={formatNumber(fundamentals.forward_pe)} />
                                            <MetricCard title="Trailing P/E" value={formatNumber(fundamentals.trailing_pe)} />
                                            <MetricCard title="PEG Ratio" value={formatNumber(fundamentals.peg_ratio)} />
                                            <MetricCard title="Price/Book" value={formatNumber(fundamentals.price_to_book_ratio)} />
                                            <MetricCard title="Price/Sales (TTM)" value={formatNumber(fundamentals.price_to_sales_ratio_ttm)} />
                                            <MetricCard title="EV/Revenue" value={formatNumber(fundamentals.ev_to_revenue)} />
                                        </div>
                                    </div>

                                    <div className="ui-panel p-6">
                                        <h3 className={sectionTitleClass}>Profitability</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <MetricCard title="Profit Margin" value={formatPercent(fundamentals.profit_margin)} tone="positive" />
                                            <MetricCard title="Operating Margin" value={formatPercent(fundamentals.operating_margin_ttm)} tone="positive" />
                                            <MetricCard title="ROA (TTM)" value={formatPercent(fundamentals.return_on_assets_ttm)} tone="positive" />
                                            <MetricCard title="ROE (TTM)" value={formatPercent(fundamentals.return_on_equity_ttm)} tone="positive" />
                                        </div>
                                    </div>

                                    <div className="ui-panel p-6">
                                        <h3 className={sectionTitleClass}>Financial Performance</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <MetricCard title="Revenue (TTM)" value={formatNumber(fundamentals.revenue_ttm, '$')} />
                                            <MetricCard title="Gross Profit (TTM)" value={formatNumber(fundamentals.gross_profit_ttm, '$')} />
                                            <MetricCard title="Diluted EPS (TTM)" value={formatNumber(fundamentals.diluted_eps_ttm, '$')} />
                                            <MetricCard title="Revenue/Share (TTM)" value={formatNumber(fundamentals.revenue_per_share_ttm, '$')} />
                                            <MetricCard title="EV/EBITDA" value={formatNumber(fundamentals.ev_to_ebitda)} />
                                            <MetricCard title="Analyst Target" value={formatNumber(fundamentals.analyst_target_price, '$')} />
                                        </div>
                                    </div>

                                    <div className="ui-panel p-6">
                                        <h3 className={sectionTitleClass}>Price & Technicals</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <MetricCard title="52-Week High" value={formatNumber(fundamentals.week_52_high, '$')} />
                                            <MetricCard title="52-Week Low" value={formatNumber(fundamentals.week_52_low, '$')} />
                                            <MetricCard title="50-Day MA" value={formatNumber(fundamentals.day_50_moving_average, '$')} />
                                            <MetricCard title="200-Day MA" value={formatNumber(fundamentals.day_200_moving_average, '$')} />
                                        </div>
                                    </div>

                                    {fundamentals.dividend_per_share !== 'N/A' && fundamentals.dividend_per_share !== '0' && (
                                        <div className="ui-panel p-6">
                                            <h3 className={`${sectionTitleClass} flex items-center`}>
                                                <Calendar className="w-6 h-6 mr-2 text-mm-positive" />
                                                Dividend Information
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <MetricCard title="Dividend Per Share" value={formatNumber(fundamentals.dividend_per_share, '$')} tone="positive" />
                                                <MetricCard title="Dividend Yield" value={formatPercent(fundamentals.dividend_yield)} tone="positive" />
                                                <MetricCard title="Dividend Date" value={fundamentals.dividend_date || 'N/A'} tone="positive" />
                                                <MetricCard title="Ex-Dividend Date" value={fundamentals.ex_dividend_date || 'N/A'} tone="positive" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="ui-panel p-6">
                                        <h3 className={sectionTitleClass}>Additional Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <MetricCard title="Shares Outstanding" value={formatNumber(fundamentals.shares_outstanding)} />
                                            <MetricCard title="Book Value" value={formatNumber(fundamentals.book_value, '$')} />
                                            <MetricCard title="Country" value={fundamentals.country || 'N/A'} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'research' && (
                        <div className="space-y-6">
                            <ResearchProfileList items={fundamentals.researchProfile} />
                            <AnnouncementsPanel items={fundamentals.announcements} />
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6">
                            {financials ? (
                                <>
                                    <FinancialTable title="Income Statement" rows={INCOME_ROWS} data={financials.income_statement} />
                                    <FinancialTable title="Balance Sheet" rows={BALANCE_ROWS} data={financials.balance_sheet} />
                                    <FinancialTable title="Cash Flow Statement" rows={CASHFLOW_ROWS} data={financials.cash_flow} />
                                </>
                            ) : (
                                <div className="ui-panel-subtle py-16 text-mm-text-secondary text-center">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p>Financial statements not available for this ticker.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'filings' && (
                        <div className="space-y-6">
                            {(secIntelligence || secIntelligenceError) && (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                    <div className="ui-panel p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ShieldAlert className="w-4 h-4 text-mm-warning" />
                                            <h3 className="text-sm font-semibold text-mm-text-primary">Filing Change Watch</h3>
                                        </div>
                                        {secIntelligence?.filingChangeSummary?.comparisonForm ? (
                                            <div className="space-y-3">
                                                <div className="text-sm text-mm-text-secondary">
                                                    Comparing latest <span className="font-semibold text-mm-text-primary">{secIntelligence.filingChangeSummary.comparisonForm}</span>
                                                    {' '}on {secIntelligence.filingChangeSummary.currentFiling?.date || '—'}
                                                    {' '}vs {secIntelligence.filingChangeSummary.previousFiling?.date || '—'}.
                                                </div>
                                                {(secIntelligence.filingChangeSummary.sectionChanges || []).length > 0 ? (
                                                    <div className="space-y-3">
                                                        {secIntelligence.filingChangeSummary.sectionChanges.slice(0, 3).map((sectionChange) => (
                                                            <div key={sectionChange.key} className="rounded-card border border-mm-border bg-mm-surface-subtle px-3 py-3">
                                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                                    <h4 className="text-sm font-semibold text-mm-text-primary">{sectionChange.title}</h4>
                                                                    <span className="inline-flex items-center rounded-pill border border-mm-warning/20 bg-mm-warning/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-mm-warning">
                                                                        {sectionChange.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs leading-6 text-mm-text-secondary whitespace-pre-wrap">
                                                                    {sectionChange.currentExcerpt || sectionChange.previousExcerpt || 'No excerpt available.'}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-mm-text-secondary">No material section changes were detected between the latest comparable filings.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-mm-text-secondary">Comparable annual or quarterly filings are not available yet for change detection.</p>
                                        )}
                                    </div>

                                    <div className="ui-panel p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Activity className="w-4 h-4 text-mm-positive" />
                                            <h3 className="text-sm font-semibold text-mm-text-primary">Insider Activity</h3>
                                        </div>
                                        {(secIntelligence?.insiderActivity || []).length > 0 ? (
                                            <div className="space-y-3">
                                                {secIntelligence.insiderActivity.slice(0, 4).map((item) => (
                                                    <div key={item.accessionNumber || `${item.date}-${item.insiderName}`} className="rounded-card border border-mm-border bg-mm-surface-subtle px-3 py-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-mm-text-primary">{item.insiderName || 'Unspecified insider'}</h4>
                                                                <p className="text-xs text-mm-text-secondary">{item.position || item.type || 'Ownership filing'}</p>
                                                            </div>
                                                            <span className="text-[11px] uppercase tracking-[0.12em] text-mm-text-tertiary">{item.date || '—'}</span>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-mm-text-secondary">
                                                            {item.activity ? <span className="rounded-pill border border-mm-border px-2 py-0.5">{item.activity}</span> : null}
                                                            {item.netShares !== null && item.netShares !== undefined ? <span className="rounded-pill border border-mm-border px-2 py-0.5">{formatSignedInteger(item.netShares)} shares</span> : null}
                                                            {item.remainingShares !== null && item.remainingShares !== undefined ? <span className="rounded-pill border border-mm-border px-2 py-0.5">{Math.round(item.remainingShares).toLocaleString()} held after filing</span> : null}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-mm-text-secondary">No recent insider Form 4 / Form 5 activity was parsed for this ticker.</p>
                                        )}
                                    </div>

                                    <div className="ui-panel p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Users className="w-4 h-4 text-mm-accent-primary" />
                                            <h3 className="text-sm font-semibold text-mm-text-primary">Major Holders (13D/G)</h3>
                                        </div>
                                        {(secIntelligence?.beneficialOwnership || []).length > 0 ? (
                                            <div className="space-y-3">
                                                {secIntelligence.beneficialOwnership.slice(0, 4).map((item) => (
                                                    <div key={item.accessionNumber || `${item.date}-${(item.owners || []).join('-')}`} className="rounded-card border border-mm-border bg-mm-surface-subtle px-3 py-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-mm-text-primary">{(item.owners || []).join(', ') || 'Reporting holders unavailable'}</h4>
                                                                <p className="text-xs text-mm-text-secondary">{item.type || '13D/G filing'}</p>
                                                            </div>
                                                            <span className="text-[11px] uppercase tracking-[0.12em] text-mm-text-tertiary">{item.date || '—'}</span>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-mm-text-secondary">
                                                            {item.ownershipPercent !== null && item.ownershipPercent !== undefined ? <span className="rounded-pill border border-mm-border px-2 py-0.5">{formatPercentValue(item.ownershipPercent)}</span> : null}
                                                            {item.isPassive !== null && item.isPassive !== undefined ? <span className="rounded-pill border border-mm-border px-2 py-0.5">{item.isPassive ? 'Passive' : 'Active / activist'}</span> : null}
                                                        </div>
                                                        {item.purpose ? (
                                                            <p className="mt-3 text-xs leading-6 text-mm-text-secondary whitespace-pre-wrap">
                                                                {item.purpose}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-mm-text-secondary">No recent 13D/G beneficial ownership disclosures were parsed for this ticker.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {secIntelligenceError && (
                                <div className="rounded-card border border-mm-warning/20 bg-mm-warning/10 px-5 py-4 text-sm text-mm-warning">
                                    SEC intelligence is temporarily unavailable: {secIntelligenceError}
                                </div>
                            )}

                            {filings && filings.length > 0 ? (
                                <div className="ui-panel overflow-hidden">
                                    <div className="px-5 py-4 border-b border-mm-border flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-mm-accent-primary" />
                                        <h3 className="text-sm font-semibold text-mm-text-primary">
                                            SEC Filings — {fundamentals.symbol}
                                        </h3>
                                        <span className="ml-auto text-xs text-mm-text-tertiary">{filings.length} results</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-mm-surface-subtle">
                                                <tr>
                                                    <th className="px-5 py-2.5 text-left text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">Date</th>
                                                    <th className="px-5 py-2.5 text-left text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">Type</th>
                                                    <th className="px-5 py-2.5 text-left text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">Description</th>
                                                    <th className="px-5 py-2.5 text-center text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">Link</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-mm-border">
                                                {filings.map((f, i) => {
                                                    const accessionNumber = f.accessionNumber || `filing-${i}`;
                                                    const isExpanded = expandedFilingAccession === accessionNumber;
                                                    const detailState = filingDetailState[accessionNumber];
                                                    const detail = detailState?.data;
                                                    const sections = detail?.sections || [];
                                                    const activeSectionKey = detailState?.activeSectionKey || sections[0]?.key;
                                                    const activeSection = sections.find((section) => section.key === activeSectionKey) || sections[0];

                                                    return (
                                                        <React.Fragment key={accessionNumber}>
                                                            <tr className="hover:bg-mm-surface-subtle/80">
                                                                <td className="px-5 py-2.5 text-mm-text-secondary whitespace-nowrap">
                                                                    {f.date ? new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                                </td>
                                                                <td className="px-5 py-2.5">
                                                                    <span className="inline-flex items-center rounded-pill border border-mm-accent-primary/15 bg-mm-accent-primary/10 px-2 py-0.5 text-xs font-semibold text-mm-accent-primary">
                                                                        {f.type}
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-2.5 text-mm-text-secondary max-w-xs truncate">
                                                                    {f.description || '—'}
                                                                </td>
                                                                <td className="px-5 py-2.5 text-center">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        {f.url ? (
                                                                            <a
                                                                                href={f.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="inline-flex items-center gap-1 text-mm-accent-primary hover:underline text-xs"
                                                                            >
                                                                                View <ExternalLink className="w-3 h-3" />
                                                                            </a>
                                                                        ) : (
                                                                            <span>—</span>
                                                                        )}
                                                                        {f.hasKeySections && f.accessionNumber ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleToggleFilingDetail(f)}
                                                                                className="text-xs font-semibold text-mm-accent-primary hover:underline"
                                                                            >
                                                                                {isExpanded ? 'Hide key sections' : 'Read key sections'}
                                                                            </button>
                                                                        ) : null}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr>
                                                                    <td colSpan={4} className="px-5 py-4 bg-mm-surface-subtle/60">
                                                                        <div className="ui-panel-subtle p-4 space-y-4">
                                                                            <div className="flex flex-wrap items-center gap-3">
                                                                                <span className="inline-flex items-center rounded-pill border border-mm-accent-primary/15 bg-mm-accent-primary/10 px-2.5 py-0.5 text-xs font-semibold text-mm-accent-primary">
                                                                                    {f.type}
                                                                                </span>
                                                                                <span className="text-xs text-mm-text-secondary">
                                                                                    {f.date ? new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}
                                                                                </span>
                                                                                {detail?.url ? (
                                                                                    <a
                                                                                        href={detail.url}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="inline-flex items-center gap-1 text-xs text-mm-accent-primary hover:underline"
                                                                                    >
                                                                                        Open on EDGAR <ExternalLink className="w-3 h-3" />
                                                                                    </a>
                                                                                ) : null}
                                                                            </div>

                                                                            {detailState?.status === 'loading' && (
                                                                                <p className="text-sm text-mm-text-secondary">Loading key SEC filing sections...</p>
                                                                            )}

                                                                            {detailState?.status === 'error' && (
                                                                                <div className="flex flex-wrap items-center gap-3">
                                                                                    <p className="text-sm text-mm-negative">{detailState.error}</p>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => loadFilingDetail(f)}
                                                                                        className="text-xs font-semibold text-mm-accent-primary hover:underline"
                                                                                    >
                                                                                        Retry
                                                                                    </button>
                                                                                </div>
                                                                            )}

                                                                            {detailState?.status === 'success' && (
                                                                                <div className="space-y-4">
                                                                                    {sections.length > 0 ? (
                                                                                        <>
                                                                                            <div className="flex flex-wrap gap-2">
                                                                                                {sections.map((section) => (
                                                                                                    <button
                                                                                                        key={section.key}
                                                                                                        type="button"
                                                                                                        onClick={() => setActiveFilingSection(accessionNumber, section.key)}
                                                                                                        className={activeSection?.key === section.key
                                                                                                            ? 'rounded-control bg-mm-accent-primary px-3 py-1.5 text-xs font-semibold text-white'
                                                                                                            : 'rounded-control border border-mm-border bg-mm-surface px-3 py-1.5 text-xs font-semibold text-mm-text-secondary hover:bg-mm-surface'}
                                                                                                    >
                                                                                                        {section.title}
                                                                                                    </button>
                                                                                                ))}
                                                                                            </div>
                                                                                            {activeSection && (
                                                                                                <div className="rounded-card border border-mm-border bg-mm-surface px-4 py-4">
                                                                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                                                                        <h4 className="text-sm font-semibold text-mm-text-primary">{activeSection.title}</h4>
                                                                                                        {activeSection.truncated ? (
                                                                                                            <span className="text-[11px] uppercase tracking-[0.14em] text-mm-text-tertiary">Excerpt</span>
                                                                                                        ) : null}
                                                                                                    </div>
                                                                                                    <p className="text-sm leading-7 text-mm-text-secondary whitespace-pre-wrap">
                                                                                                        {activeSection.text}
                                                                                                    </p>
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    ) : (
                                                                                        <p className="text-sm text-mm-text-secondary">No key sections were parsed for this filing.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="ui-panel-subtle py-16 text-mm-text-secondary text-center">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p>SEC filings not available for this ticker.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!fundamentals && !loading && !error && (
                <div className="ui-panel-subtle py-12 text-center">
                    <Building2 className="w-24 h-24 mx-auto mb-4 text-mm-text-tertiary" />
                    <h3 className="text-xl font-semibold text-mm-text-secondary mb-2">
                        Search for Company Fundamentals
                    </h3>
                    <p className="text-mm-text-tertiary">
                        Enter a stock ticker to view detailed financial metrics, annual statements, and SEC filings
                    </p>
                </div>
            )}
        </div>
    );
};

export default FundamentalsPage;
