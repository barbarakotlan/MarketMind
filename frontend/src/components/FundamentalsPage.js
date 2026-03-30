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
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'financials', label: 'Financials' },
    { key: 'filings', label: 'SEC Filings' },
];

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

const FundamentalsPage = () => {
    const [ticker, setTicker] = useState('');
    const [fundamentals, setFundamentals] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [filings, setFilings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        setLoading(true);
        setError('');
        setFundamentals(null);
        setFinancials(null);
        setFilings(null);
        setActiveTab('overview');

        const sym = ticker.toUpperCase().trim();
        const [overviewRes, financialsRes, filingsRes] = await Promise.allSettled([
            apiRequest(API_ENDPOINTS.FUNDAMENTALS(sym)),
            apiRequest(API_ENDPOINTS.FUNDAMENTALS_FINANCIALS(sym)),
            apiRequest(API_ENDPOINTS.FUNDAMENTALS_FILINGS(sym)),
        ]);

        setLoading(false);

        const ov = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
        if (!ov || ov.error) {
            setError(ov?.error || 'Failed to fetch fundamentals');
            return;
        }

        setFundamentals(ov);

        if (financialsRes.status === 'fulfilled' && !financialsRes.value?.error) {
            setFinancials(financialsRes.value);
        }
        if (filingsRes.status === 'fulfilled' && !filingsRes.value?.error) {
            setFilings(filingsRes.value);
        }
    };

    const formatNumber = (value, prefix = '', suffix = '') => {
        if (value === 'N/A' || value === 'None' || !value) return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T${suffix}`;
        if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B${suffix}`;
        if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M${suffix}`;
        return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
    };

    const formatPercent = (value) => {
        if (value === 'N/A' || value === 'None' || !value) return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return `${(num * 100).toFixed(2)}%`;
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
                            placeholder="Enter stock ticker (e.g., AAPL, TSLA, MSFT)"
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
                        {TABS.map((tab) => (
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
                                            <span className="font-semibold text-mm-text-primary">{fundamentals.symbol}</span>
                                            <span>•</span>
                                            <span>{fundamentals.exchange}</span>
                                            <span>•</span>
                                            <span>{fundamentals.currency}</span>
                                        </div>
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
                        <div>
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
                                                {filings.map((f, i) => (
                                                    <tr key={i} className="hover:bg-mm-surface-subtle/80">
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
                                                            {f.url ? (
                                                                <a
                                                                    href={f.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-mm-accent-primary hover:underline text-xs"
                                                                >
                                                                    View <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            ) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
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
