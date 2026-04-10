import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    RefreshCw,
    SlidersHorizontal,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const PRIMARY_PRESETS = [
    { key: 'gainers', label: 'Top Gainers', icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
    { key: 'losers', label: 'Top Losers', icon: TrendingDown, color: 'text-red-600 dark:text-red-400' },
    { key: 'active', label: 'Most Active', icon: Activity, color: 'text-blue-600 dark:text-blue-400' },
];

const DEFAULT_SCAN_LIMIT = 25;

const formatCompactNumber = (value, prefix = '', suffix = '') => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value);
    const abs = Math.abs(numeric);
    if (abs >= 1e12) return `${prefix}${(numeric / 1e12).toFixed(2)}T${suffix}`;
    if (abs >= 1e9) return `${prefix}${(numeric / 1e9).toFixed(2)}B${suffix}`;
    if (abs >= 1e6) return `${prefix}${(numeric / 1e6).toFixed(2)}M${suffix}`;
    return `${prefix}${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
};

const formatPercent = (value, scale = 1) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${(Number(value) * scale).toFixed(2)}%`;
};

const formatDateTime = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch (_error) {
        return value;
    }
};

const blankFilters = {
    query: '',
    priceMin: '',
    priceMax: '',
    marketCapMin: '',
    avgDollarVolumeMin: '',
    sector: '',
};

const columns = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'price', label: 'Price' },
    { key: 'percent_change', label: 'Change %', isPercent: true, scale: 100 },
    { key: 'market_cap', label: 'Mkt Cap', formatter: (value) => formatCompactNumber(value, '$') },
    { key: 'avg_dollar_volume_30d', label: 'Avg $ Vol', formatter: (value) => formatCompactNumber(value, '$') },
    { key: 'relative_volume_20d', label: 'Rel Vol', formatter: (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(2)) },
    { key: 'momentum_3m', label: '3M', isPercent: true, scale: 100 },
    { key: 'pe_forward', label: 'Fwd P/E', formatter: (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(1)) },
    { key: 'year_high', label: '52W High', formatter: (value) => (value === null || value === undefined ? '—' : `$${Number(value).toFixed(2)}`) },
    { key: 'year_low', label: '52W Low', formatter: (value) => (value === null || value === undefined ? '—' : `$${Number(value).toFixed(2)}`) },
];

const ScreenerPage = ({ onSearchTicker }) => {
    const [presets, setPresets] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [activePreset, setActivePreset] = useState('gainers');
    const [sortConfig, setSortConfig] = useState({ key: 'percent_change', dir: 'desc' });
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draftFilters, setDraftFilters] = useState(blankFilters);
    const [appliedFilters, setAppliedFilters] = useState(blankFilters);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const loadPresets = async () => {
            try {
                const payload = await apiRequest(API_ENDPOINTS.SCREENER_PRESETS);
                if (cancelled) return;
                setPresets(payload?.presets || []);
                setSectors(payload?.sectors || []);
            } catch (requestError) {
                if (cancelled) return;
                console.error('Failed to load screener presets:', requestError);
                setPresets([]);
                setSectors([]);
            }
        };

        loadPresets();
        return () => {
            cancelled = true;
        };
    }, []);

    const presetMap = useMemo(
        () => Object.fromEntries((presets || []).map((preset) => [preset.key, preset])),
        [presets],
    );

    useEffect(() => {
        let cancelled = false;

        const loadScan = async () => {
            setLoading(true);
            setError('');
            try {
                const payload = await apiRequest(API_ENDPOINTS.SCREENER_SCAN({
                    preset: activePreset,
                    query: appliedFilters.query,
                    price_min: appliedFilters.priceMin,
                    price_max: appliedFilters.priceMax,
                    market_cap_min: appliedFilters.marketCapMin,
                    avg_dollar_volume_min: appliedFilters.avgDollarVolumeMin,
                    sector: appliedFilters.sector,
                    sort: sortConfig.key,
                    dir: sortConfig.dir,
                    limit: DEFAULT_SCAN_LIMIT,
                    offset,
                }));
                if (cancelled) return;
                setRows(payload?.rows || []);
                setMeta(payload?.meta || {});
                if (Array.isArray(payload?.filters?.availableSectors) && payload.filters.availableSectors.length) {
                    setSectors(payload.filters.availableSectors);
                }
            } catch (requestError) {
                if (cancelled) return;
                console.error('Failed to load screener scan:', requestError);
                setRows([]);
                setMeta({});
                setError('Failed to load screener data.');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadScan();
        return () => {
            cancelled = true;
        };
    }, [activePreset, appliedFilters, sortConfig, offset]);

    const secondaryPresets = presets.filter((preset) => !PRIMARY_PRESETS.some((item) => item.key === preset.key));
    const total = Number(meta?.total || 0);
    const currentPage = Math.floor(offset / DEFAULT_SCAN_LIMIT) + 1;
    const totalPages = Math.max(1, Math.ceil(total / DEFAULT_SCAN_LIMIT));

    const applyFilters = () => {
        setOffset(0);
        setAppliedFilters(draftFilters);
    };

    const clearFilters = () => {
        setDraftFilters(blankFilters);
        setAppliedFilters(blankFilters);
        setOffset(0);
    };

    const handlePresetChange = (presetKey) => {
        const preset = presetMap[presetKey];
        setActivePreset(presetKey);
        setOffset(0);
        setSortConfig({
            key: preset?.defaultSort || (presetKey === 'active' ? 'relative_volume_20d' : 'percent_change'),
            dir: preset?.defaultDir || (presetKey === 'losers' ? 'asc' : 'desc'),
        });
    };

    const requestSort = (key) => {
        setOffset(0);
        setSortConfig((current) => ({
            key,
            dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc',
        }));
    };

    const SortTh = ({ label, sortKey, className = '' }) => {
        const active = sortConfig.key === sortKey;
        return (
            <th
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer text-mm-text-secondary hover:text-mm-text-primary select-none ${className}`}
                onClick={() => requestSort(sortKey)}
            >
                <span className="flex items-center gap-1">
                    {label}
                    <ArrowUpDown className={`w-3 h-3 ${active ? 'text-mm-accent-primary' : 'opacity-40'}`} />
                </span>
            </th>
        );
    };

    return (
        <div className="ui-page animate-fade-in">
            <div className="ui-page-header">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="ui-page-title">Stock Screener</h1>
                        <p className="ui-page-subtitle mt-1">
                            Internal U.S. equity discovery with cached market movers, momentum, and liquidity screens.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="ui-button-secondary flex items-center gap-2"
                        onClick={() => {
                            setOffset(0);
                            setAppliedFilters((current) => ({ ...current }));
                        }}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {PRIMARY_PRESETS.map(({ key, label, icon: Icon, color }) => (
                    <button
                        key={key}
                        onClick={() => handlePresetChange(key)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                            activePreset === key ? 'ui-button-primary' : 'ui-button-secondary'
                        }`}
                    >
                        <Icon className={`w-4 h-4 ${activePreset === key ? 'text-white' : color}`} />
                        {label}
                    </button>
                ))}
            </div>

            {secondaryPresets.length > 0 && (
                <div className="ui-panel p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <SlidersHorizontal className="w-4 h-4 text-mm-accent-primary" />
                        <p className="ui-section-label mb-0">Discovery Presets</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {secondaryPresets.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                className={`px-3 py-2 rounded-control text-sm border transition-colors ${
                                    activePreset === preset.key
                                        ? 'border-mm-accent-primary bg-mm-accent-primary/10 text-mm-accent-primary'
                                        : 'border-mm-border bg-mm-surface-subtle text-mm-text-secondary hover:text-mm-text-primary'
                                }`}
                                onClick={() => handlePresetChange(preset.key)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="ui-panel p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                    <input
                        className="ui-input"
                        placeholder="Search symbol or company"
                        value={draftFilters.query}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, query: event.target.value }))}
                    />
                    <input
                        className="ui-input"
                        inputMode="decimal"
                        placeholder="Min price"
                        value={draftFilters.priceMin}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, priceMin: event.target.value }))}
                    />
                    <input
                        className="ui-input"
                        inputMode="decimal"
                        placeholder="Max price"
                        value={draftFilters.priceMax}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, priceMax: event.target.value }))}
                    />
                    <input
                        className="ui-input"
                        inputMode="decimal"
                        placeholder="Min market cap"
                        value={draftFilters.marketCapMin}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, marketCapMin: event.target.value }))}
                    />
                    <input
                        className="ui-input"
                        inputMode="decimal"
                        placeholder="Min avg $ volume"
                        value={draftFilters.avgDollarVolumeMin}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, avgDollarVolumeMin: event.target.value }))}
                    />
                    <select
                        className="ui-input"
                        value={draftFilters.sector}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, sector: event.target.value }))}
                    >
                        <option value="">All sectors</option>
                        {sectors.map((sector) => (
                            <option key={sector} value={sector}>
                                {sector}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2 mt-3">
                    <button type="button" className="ui-button-primary" onClick={applyFilters}>
                        Apply Filters
                    </button>
                    <button type="button" className="ui-button-secondary" onClick={clearFilters}>
                        Clear
                    </button>
                </div>
            </div>

            {meta?.snapshotStatus === 'stale' && (
                <div className="ui-banner ui-banner-warning mb-4">
                    Showing the last good screener snapshot while fresh data reloads.
                </div>
            )}

            {meta?.lastRefresh && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm text-mm-text-secondary">
                    <span>
                        {presetMap[activePreset]?.description || 'Liquid U.S. equity discovery view.'}
                    </span>
                    <span>
                        Last refresh: {formatDateTime(meta.lastRefresh)}
                    </span>
                </div>
            )}

            <div className="ui-panel overflow-hidden">
                {loading && (
                    <div className="p-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-mm-accent-primary border-t-transparent mb-3"></div>
                        <p className="text-mm-text-secondary">Loading screener snapshot…</p>
                    </div>
                )}
                {error && !loading && (
                    <div className="ui-banner ui-banner-error m-6 text-center">{error}</div>
                )}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-mm-surface-subtle border-b border-mm-border">
                                <tr>
                                    <SortTh label="Symbol" sortKey="symbol" />
                                    {columns.slice(1).map((column) => (
                                        <SortTh key={column.key} label={column.label} sortKey={column.key} />
                                    ))}
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-mm-text-secondary">Sector</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-mm-border">
                                {rows.map((stock) => {
                                    const positiveMove = Number(stock.percent_change || 0) >= 0;
                                    return (
                                        <tr
                                            key={`${stock.symbol}-${stock.index_membership || ''}`}
                                            className="hover:bg-mm-surface-subtle transition-colors cursor-pointer group"
                                            onClick={() => onSearchTicker && onSearchTicker(stock.symbol)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-mm-text-primary">{stock.symbol}</div>
                                                <div className="text-xs text-mm-text-secondary truncate max-w-[180px]">{stock.name}</div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-mm-text-primary">
                                                {stock.price !== null && stock.price !== undefined ? `$${Number(stock.price).toFixed(2)}` : '—'}
                                            </td>
                                            <td className={`px-4 py-3 font-semibold ${positiveMove ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                                {positiveMove ? '+' : ''}{formatPercent(stock.percent_change, 100)}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">{formatCompactNumber(stock.market_cap, '$')}</td>
                                            <td className="px-4 py-3 text-mm-text-secondary">{formatCompactNumber(stock.avg_dollar_volume_30d, '$')}</td>
                                            <td className="px-4 py-3 text-mm-text-secondary">
                                                {stock.relative_volume_20d !== null && stock.relative_volume_20d !== undefined ? Number(stock.relative_volume_20d).toFixed(2) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">{formatPercent(stock.momentum_3m, 100)}</td>
                                            <td className="px-4 py-3 text-mm-text-secondary">
                                                {stock.pe_forward !== null && stock.pe_forward !== undefined ? Number(stock.pe_forward).toFixed(1) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">
                                                {stock.year_high !== null && stock.year_high !== undefined ? `$${Number(stock.year_high).toFixed(2)}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">
                                                {stock.year_low !== null && stock.year_low !== undefined ? `$${Number(stock.year_low).toFixed(2)}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-mm-text-secondary">{stock.sector || '—'}</td>
                                            <td className="px-4 py-3">
                                                <ExternalLink className="w-4 h-4 text-mm-accent-primary opacity-0 group-hover:opacity-100" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {rows.length === 0 && (
                            <p className="py-8 text-center text-mm-text-secondary">No screener matches found for the current filters.</p>
                        )}
                    </div>
                )}
            </div>

            {!loading && !error && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-mm-text-secondary">
                    <span>
                        Showing {rows.length ? offset + 1 : 0}-{Math.min(offset + rows.length, total)} of {total.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="ui-button-secondary flex items-center gap-1"
                            disabled={offset === 0}
                            onClick={() => setOffset((current) => Math.max(0, current - DEFAULT_SCAN_LIMIT))}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Prev
                        </button>
                        <span>Page {currentPage} / {totalPages}</span>
                        <button
                            type="button"
                            className="ui-button-secondary flex items-center gap-1"
                            disabled={offset + DEFAULT_SCAN_LIMIT >= total}
                            onClick={() => setOffset((current) => current + DEFAULT_SCAN_LIMIT)}
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {Array.isArray(meta?.warnings) && meta.warnings.length > 0 && (
                <div className="mt-3 text-xs text-mm-text-tertiary">
                    {meta.warnings[0]}
                </div>
            )}
        </div>
    );
};

export default ScreenerPage;
