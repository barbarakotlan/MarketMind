import React, { useState } from 'react';
import { Building2, Search, TrendingUp, DollarSign, BarChart3, Target, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const FundamentalsPage = () => {
    const [ticker, setTicker] = useState('');
    const [fundamentals, setFundamentals] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        setLoading(true);
        setError('');
        setFundamentals(null);

        try {
            const response = await fetch(`http://localhost:5001/fundamentals/${ticker.toUpperCase()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch fundamentals');
            }

            const mappedData = {
                name: data.Name,
                symbol: data.Symbol,
                exchange: data.Exchange,
                currency: data.Currency,
                sector: data.Sector,
                industry: data.Industry,
                description: data.Description,
                market_cap: data.MarketCapitalization,
                pe_ratio: data.PERatio,
                forward_pe: data.ForwardPE,
                trailing_pe: data.TrailingPE,
                peg_ratio: data.PEGRatio,
                eps: data.EPS,
                beta: data.Beta,
                revenue_ttm: data.RevenueTTM,
                gross_profit_ttm: data.GrossProfitTTM,
                diluted_eps_ttm: data.DilutedEPSTTM,
                revenue_per_share_ttm: data.RevenuePerShareTTM,
                profit_margin: data.ProfitMargin,
                operating_margin_ttm: data.OperatingMarginTTM,
                return_on_assets_ttm: data.ReturnOnAssetsTTM,
                return_on_equity_ttm: data.ReturnOnEquityTTM,
                price_to_sales_ratio_ttm: data.PriceToSalesRatioTTM,
                price_to_book_ratio: data.PriceToBookRatio,
                ev_to_revenue: data.EVToRevenue,
                ev_to_ebitda: data.EVToEBITDA,
                week_52_high: data["52WeekHigh"],
                week_52_low: data["52WeekLow"],
                day_50_moving_average: data["50DayMovingAverage"],
                day_200_moving_average: data["200DayMovingAverage"],
                dividend_per_share: data.DividendPerShare,
                dividend_yield: data.DividendYield,
                dividend_date: data.DividendDate,
                ex_dividend_date: data.ExDividendDate,
                shares_outstanding: data.SharesOutstanding,
                book_value: data.BookValue,
                analyst_target_price: data.AnalystTargetPrice,
                country: data.Country,
            };

            setFundamentals(mappedData);
        } catch (err) {
            setError(err.message || 'Could not fetch company fundamentals');
            console.error('Fundamentals error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (value, prefix = '', suffix = '') => {
        if (value === 'N/A' || value === 'None' || !value) return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        
        if (Math.abs(num) >= 1e12) {
            return `${prefix}${(num / 1e12).toFixed(2)}T${suffix}`;
        } else if (Math.abs(num) >= 1e9) {
            return `${prefix}${(num / 1e9).toFixed(2)}B${suffix}`;
        } else if (Math.abs(num) >= 1e6) {
            return `${prefix}${(num / 1e6).toFixed(2)}M${suffix}`;
        } else {
            return `${prefix}${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}${suffix}`;
        }
    };

    const formatPercent = (value) => {
        if (value === 'N/A' || value === 'None' || !value) return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return `${(num * 100).toFixed(2)}%`;
    };

    const MetricCard = ({ title, value, icon: Icon, color = 'blue', format = 'default' }) => {
        let displayValue = value;
        
        if (format === 'currency') {
            displayValue = formatNumber(value, '$');
        } else if (format === 'percent') {
            displayValue = formatPercent(value);
        } else if (format === 'number') {
            displayValue = formatNumber(value);
        }

        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{title}</span>
                    {Icon && <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {displayValue}
                </p>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-6 py-8 max-w-7xl">
            {/* Header */}
            <div className="text-center mb-8 animate-fade-in">
                <div className="flex items-center justify-center mb-2">
                    <Building2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mr-3" />
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                        Company Fundamentals
                    </h1>
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

            {/* Loading State */}
            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading fundamentals...</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg mb-8">
                    {error}
                </div>
            )}

            {/* Fundamentals Data */}
            {fundamentals && !loading && (
                <div className="space-y-6 animate-fade-in">
                    {/* Company Overview */}
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
                            <MetricCard title="Market Cap" value={fundamentals.market_cap} icon={DollarSign} format="currency" color="green" />
                            <MetricCard title="P/E Ratio" value={fundamentals.pe_ratio} icon={Target} format="number" color="blue" />
                            <MetricCard title="EPS" value={fundamentals.eps} icon={TrendingUp} format="currency" color="purple" />
                            <MetricCard title="Beta" value={fundamentals.beta} icon={BarChart3} format="number" color="orange" />
                        </div>
                    </div>

                    {/* Valuation Metrics */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Valuation Metrics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <MetricCard title="Forward P/E" value={fundamentals.forward_pe} format="number" />
                            <MetricCard title="Trailing P/E" value={fundamentals.trailing_pe} format="number" />
                            <MetricCard title="PEG Ratio" value={fundamentals.peg_ratio} format="number" />
                            <MetricCard title="Price/Book" value={fundamentals.price_to_book_ratio} format="number" />
                            <MetricCard title="Price/Sales (TTM)" value={fundamentals.price_to_sales_ratio_ttm} format="number" />
                            <MetricCard title="EV/Revenue" value={fundamentals.ev_to_revenue} format="number" />
                        </div>
                    </div>

                    {/* Profitability */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Profitability</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard title="Profit Margin" value={fundamentals.profit_margin} format="percent" />
                            <MetricCard title="Operating Margin" value={fundamentals.operating_margin_ttm} format="percent" />
                            <MetricCard title="ROA (TTM)" value={fundamentals.return_on_assets_ttm} format="percent" />
                            <MetricCard title="ROE (TTM)" value={fundamentals.return_on_equity_ttm} format="percent" />
                        </div>
                    </div>

                    {/* Financial Performance */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Financial Performance</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <MetricCard title="Revenue (TTM)" value={fundamentals.revenue_ttm} format="currency" />
                            <MetricCard title="Gross Profit (TTM)" value={fundamentals.gross_profit_ttm} format="currency" />
                            <MetricCard title="Diluted EPS (TTM)" value={fundamentals.diluted_eps_ttm} format="currency" />
                            <MetricCard title="Revenue/Share (TTM)" value={fundamentals.revenue_per_share_ttm} format="currency" />
                            <MetricCard title="Quarterly Earnings Growth" value={fundamentals.quarterly_earnings_growth_yoy} format="percent" />
                            <MetricCard title="Quarterly Revenue Growth" value={fundamentals.quarterly_revenue_growth_yoy} format="percent" />
                        </div>
                    </div>

                    {/* Price & Technicals */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Price & Technicals</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard title="52-Week High" value={fundamentals.week_52_high} format="currency" />
                            <MetricCard title="52-Week Low" value={fundamentals.week_52_low} format="currency" />
                            <MetricCard title="50-Day MA" value={fundamentals.day_50_moving_average} format="currency" />
                            <MetricCard title="200-Day MA" value={fundamentals.day_200_moving_average} format="currency" />
                        </div>
                    </div>

                    {/* Dividend Information */}
                    {(fundamentals.dividend_per_share !== 'N/A' && fundamentals.dividend_per_share !== '0') && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                                <Calendar className="w-6 h-6 mr-2 text-green-600" />
                                Dividend Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard title="Dividend Per Share" value={fundamentals.dividend_per_share} format="currency" />
                                <MetricCard title="Dividend Yield" value={fundamentals.dividend_yield} format="percent" />
                                <MetricCard title="Dividend Date" value={fundamentals.dividend_date} />
                                <MetricCard title="Ex-Dividend Date" value={fundamentals.ex_dividend_date} />
                            </div>
                        </div>
                    )}

                    {/* Additional Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Additional Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <MetricCard title="Shares Outstanding" value={fundamentals.shares_outstanding} format="number" />
                            <MetricCard title="Book Value" value={fundamentals.book_value} format="currency" />
                            <MetricCard title="Analyst Target" value={fundamentals.analyst_target_price} format="currency" />
                            <MetricCard title="Country" value={fundamentals.country} />
                            <MetricCard title="EV/EBITDA" value={fundamentals.ev_to_ebitda} format="number" />
                        </div>
                    </div>
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
                        Enter a stock ticker to view detailed financial metrics and company information
                    </p>
                </div>
            )}
        </div>
    );
};

export default FundamentalsPage;
