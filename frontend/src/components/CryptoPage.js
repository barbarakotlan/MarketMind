import React, { useState, useEffect, useRef } from 'react';
import { Bitcoin, Activity, ChevronDown, Search, ArrowRightLeft } from 'lucide-react';
import StockChart from './charts/StockChart';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const timeFrames = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

const AssetSelector = ({ selected, options, onSelect, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) =>
        opt.code.toLowerCase().includes(search.toLowerCase()) ||
        opt.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="ui-form-label">{label}</label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between rounded-control border border-mm-border bg-mm-surface px-4 py-3 text-left transition hover:border-mm-border-strong"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{selected.icon || (selected.type === 'crypto' ? '🪙' : '💵')}</span>
                    <div>
                        <div className="font-semibold text-mm-text-primary leading-tight">{selected.code}</div>
                        <div className="max-w-[120px] truncate text-xs text-mm-text-tertiary">{selected.name}</div>
                    </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-mm-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-card border border-mm-border bg-mm-surface shadow-elevated animate-fade-in">
                    <div className="border-b border-mm-border p-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mm-text-tertiary" />
                            <input
                                type="text"
                                placeholder="Search assets..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                className="ui-input py-2 pl-9 text-sm"
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.map((opt) => (
                            <button
                                key={`${opt.type}-${opt.code}`}
                                onClick={() => {
                                    onSelect(opt);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                                    selected.code === opt.code
                                        ? 'bg-mm-accent-primary/10'
                                        : 'hover:bg-mm-surface-subtle'
                                }`}
                            >
                                <span className="text-xl">{opt.icon || (opt.type === 'crypto' ? '🪙' : '💵')}</span>
                                <div>
                                    <div className="font-semibold text-mm-text-primary">{opt.code}</div>
                                    <div className="text-xs text-mm-text-tertiary">{opt.name}</div>
                                </div>
                            </button>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="p-4 text-center text-sm text-mm-text-secondary">No assets found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CryptoPage = () => {
    const [allAssets, setAllAssets] = useState([]);
    const [fromAsset, setFromAsset] = useState({ code: 'BTC', name: 'Bitcoin', type: 'crypto', icon: '₿' });
    const [toAsset, setToAsset] = useState({ code: 'USD', name: 'United States Dollar', type: 'fiat', icon: '🇺🇸' });
    const [amount, setAmount] = useState(1);
    const [exchangeData, setExchangeData] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingChart, setLoadingChart] = useState(false);
    const [activeTimeFrame, setActiveTimeFrame] = useState(timeFrames[2]);

    useEffect(() => {
        const init = async () => {
            const [cryptos, currencies] = await Promise.all([fetchCryptos(), fetchCurrencies()]);

            const cryptoList = cryptos.map((c) => ({ ...c, type: 'crypto' }));
            const currencyList = currencies.map((c) => ({ ...c, type: 'fiat', icon: c.flag }));
            const merged = [...cryptoList, ...currencyList];
            setAllAssets(merged);

            const btc = merged.find((a) => a.code === 'BTC');
            const usd = merged.find((a) => a.code === 'USD');
            if (btc) setFromAsset(btc);
            if (usd) setToAsset(usd);

            fetchData(btc || fromAsset, usd || toAsset, activeTimeFrame.value);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCryptos = async () => {
        try {
            return await apiRequest(API_ENDPOINTS.CRYPTO_LIST);
        } catch (e) {
            return [];
        }
    };

    const fetchCurrencies = async () => {
        try {
            return await apiRequest(API_ENDPOINTS.CRYPTO_CURRENCIES);
        } catch (e) {
            return [];
        }
    };

    const fetchData = (from, to, period) => {
        if (!from || !to) return;
        fetchConversionData(from, to);
        fetchChartData(from, to, period);
    };

    const fetchConversionData = async (from, to) => {
        setLoadingData(true);
        try {
            setExchangeData(await apiRequest(API_ENDPOINTS.CRYPTO_CONVERT(from.code, to.code)));
        } catch (err) {
            console.error(err);
            setExchangeData(null);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchChartData = async (from, to, period) => {
        setLoadingChart(true);
        try {
            const ticker = `${from.code}-${to.code}`;
            setChartData(await apiRequest(API_ENDPOINTS.CHART(ticker, period)));
        } catch (err) {
            setChartData(null);
        } finally {
            setLoadingChart(false);
        }
    };

    const handleSwap = () => {
        const temp = fromAsset;
        setFromAsset(toAsset);
        setToAsset(temp);
        fetchData(toAsset, temp, activeTimeFrame.value);
    };

    return (
        <div className="ui-page space-y-8">
            <div className="ui-page-header">
                <h1 className="ui-page-title flex items-center gap-3">
                    <Bitcoin className="h-10 w-10 text-mm-accent-primary" />
                    Crypto Command
                </h1>
                <p className="ui-page-subtitle">Swap, analyze, and track digital assets and currencies.</p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-1">
                    <div className="ui-panel-elevated p-6">
                        <div className="space-y-6">
                            <div>
                                <label className="ui-form-label">You Send</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full border-0 bg-transparent text-5xl font-bold tracking-tight text-mm-text-primary outline-none placeholder:text-mm-text-tertiary"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2">
                                <AssetSelector
                                    label="From"
                                    selected={fromAsset}
                                    options={allAssets}
                                    onSelect={(a) => {
                                        setFromAsset(a);
                                        fetchData(a, toAsset, activeTimeFrame.value);
                                    }}
                                />

                                <div className="pb-3">
                                    <button
                                        onClick={handleSwap}
                                        className="rounded-pill border border-mm-border bg-mm-surface p-3 transition hover:border-mm-border-strong hover:bg-mm-surface-subtle"
                                    >
                                        <ArrowRightLeft className="h-5 w-5 text-mm-accent-primary" />
                                    </button>
                                </div>

                                <AssetSelector
                                    label="To"
                                    selected={toAsset}
                                    options={allAssets}
                                    onSelect={(a) => {
                                        setToAsset(a);
                                        fetchData(fromAsset, a, activeTimeFrame.value);
                                    }}
                                />
                            </div>

                            <div className="border-t border-mm-border pt-6">
                                <label className="ui-form-label">Estimated Receive</label>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-bold tracking-tight text-mm-text-primary">
                                        {loadingData ? '...' : exchangeData
                                            ? (amount * exchangeData.exchange_rate).toLocaleString(undefined, { maximumFractionDigits: 5 })
                                            : '---'}
                                    </span>
                                    <span className="text-xl font-medium text-mm-text-secondary">{toAsset.code}</span>
                                </div>
                                <div className="mt-2 text-xs text-mm-text-tertiary">
                                    1 {fromAsset.code} ≈ {exchangeData ? exchangeData.exchange_rate.toFixed(5) : '...'} {toAsset.code}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 lg:col-span-2">
                    <div className="ui-panel p-6 min-h-[500px] flex flex-col">
                        {chartData ? (
                            <>
                                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-mm-text-primary flex items-center gap-2">
                                            {fromAsset.icon} {fromAsset.code} <span className="text-mm-text-tertiary">/</span> {toAsset.icon} {toAsset.code}
                                        </h2>
                                        <p className="text-sm text-mm-text-secondary">Historical Price Action</p>
                                    </div>
                                    {exchangeData && (
                                        <div className="flex gap-4">
                                            <div className="ui-panel-subtle px-4 py-3">
                                                <div className="text-xs text-mm-text-tertiary">Ask</div>
                                                <div className="font-semibold text-mm-text-primary">{parseFloat(exchangeData.ask_price).toFixed(2)}</div>
                                            </div>
                                            <div className="ui-panel-subtle px-4 py-3">
                                                <div className="text-xs text-mm-text-tertiary">Bid</div>
                                                <div className="font-semibold text-mm-text-primary">{parseFloat(exchangeData.bid_price).toFixed(2)}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <StockChart
                                        chartData={chartData}
                                        ticker={`${fromAsset.code}-${toAsset.code}`}
                                        activeTimeFrame={activeTimeFrame}
                                        onTimeFrameChange={(tf) => {
                                            setActiveTimeFrame(tf);
                                            fetchChartData(fromAsset, toAsset, tf.value);
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="ui-empty-state h-full flex-1">
                                {loadingChart ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-mm-accent-primary border-t-transparent"></div>
                                        <p>Loading chart data…</p>
                                    </div>
                                ) : (
                                    <>
                                        <Activity className="mb-4 h-16 w-16 text-mm-text-tertiary" />
                                        <p>Select assets to view analysis</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CryptoPage;
