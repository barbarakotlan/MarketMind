import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, ArrowLeftRight, TrendingUp, AlertCircle, Search, ChevronDown } from 'lucide-react';
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
                className="flex w-full items-center justify-between rounded-control border border-mm-border bg-mm-surface px-4 py-3 transition hover:border-mm-border-strong"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{selected.flag || '💵'}</span>
                    <div className="text-left">
                        <div className="font-semibold leading-tight text-mm-text-primary">{selected.code}</div>
                        <div className="max-w-[100px] truncate text-xs text-mm-text-tertiary">{selected.name}</div>
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
                                placeholder="Search currencies..."
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
                                key={opt.code}
                                onClick={() => {
                                    onSelect(opt);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                                    selected.code === opt.code ? 'bg-mm-accent-primary/10' : 'hover:bg-mm-surface-subtle'
                                }`}
                            >
                                <span className="text-xl">{opt.flag || '💵'}</span>
                                <div>
                                    <div className="font-semibold text-mm-text-primary">{opt.code}</div>
                                    <div className="text-xs text-mm-text-tertiary">{opt.name}</div>
                                </div>
                            </button>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="p-4 text-center text-sm text-mm-text-secondary">No currency found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ForexPage = () => {
    const [currencies, setCurrencies] = useState([]);
    const [fromCurrency, setFromCurrency] = useState({ code: 'USD', name: 'United States Dollar', flag: '🇺🇸' });
    const [toCurrency, setToCurrency] = useState({ code: 'EUR', name: 'Euro', flag: '🇪🇺' });
    const [amount, setAmount] = useState(1);
    const [exchangeData, setExchangeData] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTimeFrame, setActiveTimeFrame] = useState(timeFrames[2]);

    useEffect(() => {
        const init = async () => {
            try {
                const data = await apiRequest(API_ENDPOINTS.FOREX_CURRENCIES);
                setCurrencies(data);

                const usd = data.find((c) => c.code === 'USD');
                const eur = data.find((c) => c.code === 'EUR');
                if (usd) setFromCurrency(usd);
                if (eur) setToCurrency(eur);

                fetchData(usd || fromCurrency, eur || toCurrency, activeTimeFrame.value);
            } catch (err) {
                console.error('Failed to load currencies', err);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async (from, to, period) => {
        setLoading(true);
        try {
            setExchangeData(await apiRequest(API_ENDPOINTS.FOREX_CONVERT(from.code, to.code)));
            const ticker = `${from.code}${to.code}=X`;
            const cData = await apiRequest(API_ENDPOINTS.CHART(ticker, period));
            setChartData(Array.isArray(cData) && cData.length > 0 ? cData : null);
        } catch (err) {
            console.error(err);
            setChartData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSwap = () => {
        const temp = fromCurrency;
        setFromCurrency(toCurrency);
        setToCurrency(temp);
        fetchData(toCurrency, temp, activeTimeFrame.value);
    };

    const handleTimeFrameChange = (newTimeFrame) => {
        setActiveTimeFrame(newTimeFrame);
        fetchData(fromCurrency, toCurrency, newTimeFrame.value);
    };

    const handleQuickPair = (pairStr) => {
        const [fCode, tCode] = pairStr.split('/');
        const newFrom = currencies.find((c) => c.code === fCode) || { code: fCode, name: '', flag: '💱' };
        const newTo = currencies.find((c) => c.code === tCode) || { code: tCode, name: '', flag: '💱' };

        setFromCurrency(newFrom);
        setToCurrency(newTo);
        fetchData(newFrom, newTo, activeTimeFrame.value);
    };

    return (
        <div className="ui-page space-y-8">
            <div className="ui-page-header">
                <h1 className="ui-page-title flex items-center justify-start gap-3">
                    <DollarSign className="h-10 w-10 text-mm-accent-primary" />
                    Forex Command Center
                </h1>
            </div>

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-1">
                    <div className="ui-panel p-6">
                        <h2 className="mb-4 text-xl font-semibold text-mm-text-primary">Converter</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="ui-form-label">Amount</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="ui-input font-mono text-base"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2">
                                <AssetSelector
                                    label="From"
                                    selected={fromCurrency}
                                    options={currencies}
                                    onSelect={(c) => {
                                        setFromCurrency(c);
                                        fetchData(c, toCurrency, activeTimeFrame.value);
                                    }}
                                />

                                <div className="pb-3">
                                    <button
                                        onClick={handleSwap}
                                        className="rounded-pill border border-mm-border bg-mm-surface p-3 transition hover:border-mm-border-strong hover:bg-mm-surface-subtle"
                                    >
                                        <ArrowLeftRight className="h-5 w-5 text-mm-accent-primary" />
                                    </button>
                                </div>

                                <AssetSelector
                                    label="To"
                                    selected={toCurrency}
                                    options={currencies}
                                    onSelect={(c) => {
                                        setToCurrency(c);
                                        fetchData(fromCurrency, c, activeTimeFrame.value);
                                    }}
                                />
                            </div>

                            <div className="ui-panel-subtle rounded-card border px-4 py-4 text-center">
                                <span className="mb-1 block text-sm text-mm-text-secondary">Converted Value</span>
                                {loading && !exchangeData ? (
                                    <span className="animate-pulse text-xl text-mm-text-primary">Loading...</span>
                                ) : exchangeData ? (
                                    <span className="text-3xl font-bold text-mm-accent-primary">
                                        {(amount * exchangeData.exchange_rate).toFixed(2)} <span className="text-lg">{toCurrency.code}</span>
                                    </span>
                                ) : (
                                    <span className="text-mm-text-primary">---</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="ui-panel p-6">
                        <h3 className="ui-section-label mb-3">Quick Pairs</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['USD/EUR', 'GBP/USD', 'USD/JPY', 'USD/CAD'].map((pair) => (
                                <button
                                    key={pair}
                                    onClick={() => handleQuickPair(pair)}
                                    className="ui-button-secondary justify-center"
                                >
                                    {pair}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ui-panel min-h-[500px] p-6 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-mm-text-primary">
                            <TrendingUp className="h-5 w-5 text-mm-positive" />
                            {fromCurrency.code}/{toCurrency.code} Performance
                        </h2>
                    </div>

                    <div className="flex flex-grow flex-col">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-mm-accent-primary"></div>
                            </div>
                        ) : chartData ? (
                            <StockChart
                                chartData={chartData}
                                ticker={`${fromCurrency.code}/${toCurrency.code}`}
                                activeTimeFrame={activeTimeFrame}
                                onTimeFrameChange={handleTimeFrameChange}
                            />
                        ) : (
                            <div className="ui-empty-state h-full border-dashed">
                                <AlertCircle className="mb-2 h-10 w-10 text-mm-text-tertiary" />
                                <p>Chart data currently unavailable for this pair.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForexPage;
