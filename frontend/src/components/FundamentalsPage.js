import React, { useState } from 'react';
import { Building2, Search, TrendingUp, DollarSign, BarChart3, Target, Calendar, FileText, ExternalLink } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const TABS = [
    { key: 'overview',   label: 'Overview' },
    { key: 'financials', label: 'Financials' },
    { key: 'filings',    label: 'SEC Filings' },
];

const fmtBig = (val, prefix = '') => {
    if (val === null || val === undefined || val === 'N/A' || val === 'None') return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '—';
    const abs = Math.abs(num);
    if (abs >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `${prefix}${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6)  return `${prefix}${(num / 1e6).toFixed(2)}M`;
    return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const INCOME_ROWS = [
    { label: 'Revenue',          key: 'revenue' },
    { label: 'Gross Profit',     key: 'gross_profit' },
    { label: 'Operating Income', key: 'operating_income' },
    { label: 'Net Income',       key: 'net_income' },
    { label: 'EBITDA',           key: 'ebitda' },
    { label: 'EPS',              key: 'eps', raw: true },
];

const BALANCE_ROWS = [
    { label: 'Total Assets',       key: 'total_assets' },
    { label: 'Total Liabilities',  key: 'total_liab' },
    { label: 'Total Equity',       key: 'total_equity' },
    { label: 'Cash & Equivalents', key: 'cash' },
    { label: 'Total Debt',         key: 'total_debt' },
    { label: 'Working Capital',    key: 'working_capital' },
];

const CASHFLOW_ROWS = [
    { label: 'Operating Cash Flow',  key: 'operating' },
    { label: 'Investing Cash Flow',  key: 'investing' },
    { label: 'Financing Cash Flow',  key: 'financing' },
    { label: 'Capital Expenditures', key: 'capex' },
    { label: 'Free Cash Flow',       key: 'free_cf' },
];

const FinancialTable = ({ title, rows, data }) => {
    if (!data || data.length === 0) return null;
    const periods = data.map(d => d.period);
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-5 py-2.5 text-left text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Metric</th>
                            {periods.map(p => (
                                <th key={p} className="px-5 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">{p}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rows.map(({ label, key, raw }) => (
                            <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-5 py-2.5 text-gray-700 dark:text-gray-300 font-medium">{label}</td>
                                {data.map(d => (
                                    <td key={d.period} className="px-5 py-2.5 text-right text-gray-900 dark:text-white">
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

const MetricCard = ({ title, value, icon: Icon, color = 'blue' }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{title}</span>
            {Icon && <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />}
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
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

        // Backend already returns snake_case keys — use directly
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
        else if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B${suffix}`;
        else if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M${suffix}`;
        return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
    };

    const formatPercent = (value) => {
        if (value === 'N/A' || value === 'None' || !value) return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return `${(num * 100).toFixed(2)}%`;
    };

    return (
        <div className="container mx-auto px-6 py-8 max-w-7xl">
            {/* Header */}
            <div className="text-center mb-8 animate-fade-in">
                <div className="flex items-center justify-center mb-2">
                    <Building2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mr-3" />
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Company Fundamentals</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    Comprehensive financial data and metrics for publicly traded companies
                </p>
            </div>

            {/* Search Box */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 animate-fade-in">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            placeholder="Enter stock ticker (e.g., AAPL, TSLA, MSFT)"
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !ticker.trim()}
                        className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                            loading || !ticker.trim()
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                        }`}
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>
            </div>

            {/* Loading */}
            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading fundamentals...</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg mb-8">
                    {error}
                </div>
            )}

            {/* Data view */}
            {fundamentals && !loading && (
                <div className="space-y-6 animate-fade-in">
                    {/* Tab bar */}
                    <div className="flex gap-2">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    activeTab === tab.key
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Overview tab ── */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Company Header */}
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl p-8 border border-indigo-100 dark:border-indigo-800">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                            {fundamentals.name}
                                        </h2>
                                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                            <span className="font-semibold">{fundamentals.symbol}</span>
                                            <span>•</span>
                                            <span>{fundamentals.exchange}</span>
                                            <span>•</span>
                                            <span>{fundamentals.currency}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Sector</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{fundamentals.sector}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{fundamentals.industry}</p>
                                    </div>
                                </div>
                                {fundamentals.description !== 'N/A' && (
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                        {fundamentals.description}
                                    </p>
                                )}
                            </div>

                            {/* Key Metrics */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                                    <BarChart3 className="w-6 h-6 mr-2 text-indigo-600" />
                                    Key Metrics
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MetricCard title="Market Cap" value={formatNumber(fundamentals.market_cap, '$')} icon={DollarSign} color="green" />
                                    <MetricCard title="P/E Ratio" value={formatNumber(fundamentals.pe_ratio)} icon={Target} color="blue" />
                                    <MetricCard title="EPS" value={formatNumber(fundamentals.eps, '$')} icon={TrendingUp} color="purple" />
                                    <MetricCard title="Beta" value={formatNumber(fundamentals.beta)} icon={BarChart3} color="orange" />
                                </div>
                            </div>

                            {/* Valuation */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Valuation Metrics</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <MetricCard title="Forward P/E" value={formatNumber(fundamentals.forward_pe)} />
                                    <MetricCard title="Trailing P/E" value={formatNumber(fundamentals.trailing_pe)} />
                                    <MetricCard title="PEG Ratio" value={formatNumber(fundamentals.peg_ratio)} />
                                    <MetricCard title="Price/Book" value={formatNumber(fundamentals.price_to_book_ratio)} />
                                    <MetricCard title="Price/Sales (TTM)" value={formatNumber(fundamentals.price_to_sales_ratio_ttm)} />
                                    <MetricCard title="EV/Revenue" value={formatNumber(fundamentals.ev_to_revenue)} />
                                </div>
                            </div>

                            {/* Profitability */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Profitability</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MetricCard title="Profit Margin" value={formatPercent(fundamentals.profit_margin)} />
                                    <MetricCard title="Operating Margin" value={formatPercent(fundamentals.operating_margin_ttm)} />
                                    <MetricCard title="ROA (TTM)" value={formatPercent(fundamentals.return_on_assets_ttm)} />
                                    <MetricCard title="ROE (TTM)" value={formatPercent(fundamentals.return_on_equity_ttm)} />
                                </div>
                            </div>

                            {/* Financial Performance */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Financial Performance</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <MetricCard title="Revenue (TTM)" value={formatNumber(fundamentals.revenue_ttm, '$')} />
                                    <MetricCard title="Gross Profit (TTM)" value={formatNumber(fundamentals.gross_profit_ttm, '$')} />
                                    <MetricCard title="Diluted EPS (TTM)" value={formatNumber(fundamentals.diluted_eps_ttm, '$')} />
                                    <MetricCard title="Revenue/Share (TTM)" value={formatNumber(fundamentals.revenue_per_share_ttm, '$')} />
                                    <MetricCard title="EV/EBITDA" value={formatNumber(fundamentals.ev_to_ebitda)} />
                                    <MetricCard title="Analyst Target" value={formatNumber(fundamentals.analyst_target_price, '$')} />
                                </div>
                            </div>

                            {/* Price & Technicals */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Price & Technicals</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MetricCard title="52-Week High" value={formatNumber(fundamentals.week_52_high, '$')} />
                                    <MetricCard title="52-Week Low" value={formatNumber(fundamentals.week_52_low, '$')} />
                                    <MetricCard title="50-Day MA" value={formatNumber(fundamentals.day_50_moving_average, '$')} />
                                    <MetricCard title="200-Day MA" value={formatNumber(fundamentals.day_200_moving_average, '$')} />
                                </div>
                            </div>

                            {/* Dividends */}
                            {fundamentals.dividend_per_share !== 'N/A' && fundamentals.dividend_per_share !== '0' && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                                        <Calendar className="w-6 h-6 mr-2 text-green-600" />
                                        Dividend Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <MetricCard title="Dividend Per Share" value={formatNumber(fundamentals.dividend_per_share, '$')} />
                                        <MetricCard title="Dividend Yield" value={formatPercent(fundamentals.dividend_yield)} />
                                        <MetricCard title="Dividend Date" value={fundamentals.dividend_date || 'N/A'} />
                                        <MetricCard title="Ex-Dividend Date" value={fundamentals.ex_dividend_date || 'N/A'} />
                                    </div>
                                </div>
                            )}

                            {/* Additional */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Additional Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <MetricCard title="Shares Outstanding" value={formatNumber(fundamentals.shares_outstanding)} />
                                    <MetricCard title="Book Value" value={formatNumber(fundamentals.book_value, '$')} />
                                    <MetricCard title="Country" value={fundamentals.country || 'N/A'} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Financials tab ── */}
                    {activeTab === 'financials' && (
                        <div className="space-y-6">
                            {financials ? (
                                <>
                                    <FinancialTable title="Income Statement" rows={INCOME_ROWS} data={financials.income_statement} />
                                    <FinancialTable title="Balance Sheet" rows={BALANCE_ROWS} data={financials.balance_sheet} />
                                    <FinancialTable title="Cash Flow Statement" rows={CASHFLOW_ROWS} data={financials.cash_flow} />
                                </>
                            ) : (
                                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p>Financial statements not available for this ticker.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── SEC Filings tab ── */}
                    {activeTab === 'filings' && (
                        <div>
                            {filings && filings.length > 0 ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-indigo-500" />
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                            SEC Filings — {fundamentals.symbol}
                                        </h3>
                                        <span className="ml-auto text-xs text-gray-400">{filings.length} results</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                <tr>
                                                    <th className="px-5 py-2.5 text-left text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Date</th>
                                                    <th className="px-5 py-2.5 text-left text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Type</th>
                                                    <th className="px-5 py-2.5 text-left text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Description</th>
                                                    <th className="px-5 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Link</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {filings.map((f, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                        <td className="px-5 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                            {f.date ? new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                        </td>
                                                        <td className="px-5 py-2.5">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                                                                {f.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-2.5 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                                            {f.description || '—'}
                                                        </td>
                                                        <td className="px-5 py-2.5 text-center">
                                                            {f.url ? (
                                                                <a
                                                                    href={f.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs"
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
                                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p>SEC filings not available for this ticker.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!fundamentals && !loading && !error && (
                <div className="text-center py-12">
                    <Building2 className="w-24 h-24 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                        Search for Company Fundamentals
                    </h3>
                    <p className="text-gray-500 dark:text-gray-500">
                        Enter a stock ticker to view detailed financial metrics, annual statements, and SEC filings
                    </p>
                </div>
            )}
        </div>
    );
};

export default FundamentalsPage;
