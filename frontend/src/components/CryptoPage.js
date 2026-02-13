import React, { useState, useEffect, useRef } from 'react';
import { Bitcoin, Zap, Activity, ChevronDown, Search, ArrowRightLeft } from 'lucide-react';
import StockChart from './charts/StockChart';

const timeFrames = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

// --- Custom Searchable Asset Selector Component ---
const AssetSelector = ({ selected, options, onSelect, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
        opt.code.toLowerCase().includes(search.toLowerCase()) || 
        opt.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-1 block">
                {label}
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-4 py-3 transition-all"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{selected.icon || (selected.type === 'crypto' ? '🪙' : '💵')}</span>
                    <div className="text-left">
                        <div className="font-bold text-white leading-tight">{selected.code}</div>
                        <div className="text-xs text-purple-200 opacity-70 truncate max-w-[100px]">{selected.name}</div>
                    </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-purple-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-fade-in-up">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search assets..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
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
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left ${
                                    selected.code === opt.code ? 'bg-purple-100 dark:bg-purple-900/40' : ''
                                }`}
                            >
                                <span className="text-xl">{opt.icon || (opt.type === 'crypto' ? '🪙' : '💵')}</span>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{opt.code}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{opt.name}</div>
                                </div>
                            </button>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-500">No assets found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CryptoPage = () => {
    // We combine lists into a unified "assets" state for interchangeable swapping
    const [allAssets, setAllAssets] = useState([]);
    
    // Selection State
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
            
            // Normalize and merge lists
            const cryptoList = cryptos.map(c => ({ ...c, type: 'crypto' }));
            const currencyList = currencies.map(c => ({ ...c, type: 'fiat', icon: c.flag })); // Ensure icon key matches
            
            const merged = [...cryptoList, ...currencyList];
            setAllAssets(merged);

            // Set initial defaults from the loaded list to ensure we have full object data
            const btc = merged.find(a => a.code === 'BTC');
            const usd = merged.find(a => a.code === 'USD');
            if (btc) setFromAsset(btc);
            if (usd) setToAsset(usd);

            fetchData(btc || fromAsset, usd || toAsset, activeTimeFrame.value);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCryptos = async () => {
        try { return await (await fetch('http://localhost:5001/crypto/list')).json(); } catch (e) { return []; }
    };

    const fetchCurrencies = async () => {
        try { return await (await fetch('http://localhost:5001/crypto/currencies')).json(); } catch (e) { return []; }
    };

    const fetchData = (from, to, period) => {
        if (!from || !to) return;
        fetchConversionData(from, to);
        fetchChartData(from, to, period);
    };

    const fetchConversionData = async (from, to) => {
        setLoadingData(true);
        try {
            // Note: The backend endpoint is named /crypto/convert but often supports any pair 
            // supported by the underlying provider (AlphaVantage). 
            const res = await fetch(`http://localhost:5001/crypto/convert?from=${from.code}&to=${to.code}`);
            if (!res.ok) throw new Error('Conversion failed');
            setExchangeData(await res.json());
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
            // Construct ticker. 
            // If Crypto -> Fiat: BTC-USD
            // If Fiat -> Crypto: USD-BTC (Yahoo/AV might need specific formatting, but we try standard first)
            // If Crypto -> Crypto: BTC-ETH
            let ticker;
            if (to.type === 'fiat' && from.type === 'crypto') ticker = `${from.code}-${to.code}`;
            else if (from.type === 'fiat' && to.type === 'crypto') ticker = `${from.code}-${to.code}`; // Yahoo often supports EUR-BTC=X reverse pairs
            else ticker = `${from.code}-${to.code}`;

            const res = await fetch(`http://localhost:5001/chart/${ticker}?period=${period}`);
            if (res.ok) setChartData(await res.json());
            else setChartData(null);
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
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    <Bitcoin className="w-10 h-10 text-purple-600" /> Crypto Command
                </h1>
                <p className="text-gray-500 mt-2">Swap, analyze, and track digital assets and currencies.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Interactive Converter Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white rounded-3xl shadow-2xl p-6 relative overflow-visible">
                        
                        {/* Input Section */}
                        <div className="relative z-10">
                            <label className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-2 block">
                                You Send
                            </label>
                            <div className="flex items-center gap-4 mb-6">
                                <input 
                                    type="number" 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value)}
                                    className="bg-transparent text-5xl font-bold outline-none w-full placeholder-purple-300/30 font-mono tracking-tight"
                                />
                            </div>
                            
                            <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end mb-8">
                                <AssetSelector 
                                    label="From" 
                                    selected={fromAsset} 
                                    options={allAssets} 
                                    onSelect={(a) => { setFromAsset(a); fetchData(a, toAsset, activeTimeFrame.value); }} 
                                />
                                
                                <div className="pb-3">
                                    <button 
                                        onClick={handleSwap}
                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all hover:rotate-180"
                                    >
                                        <ArrowRightLeft className="w-5 h-5 text-purple-200" />
                                    </button>
                                </div>

                                <AssetSelector 
                                    label="To" 
                                    selected={toAsset} 
                                    options={allAssets} 
                                    onSelect={(a) => { setToAsset(a); fetchData(fromAsset, a, activeTimeFrame.value); }} 
                                />
                            </div>

                            <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent my-6"></div>

                            {/* Result Section */}
                            <div>
                                <label className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-1 block">
                                    Estimated Receive
                                </label>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-bold tracking-tight">
                                        {loadingData ? (
                                            <span className="animate-pulse">...</span>
                                        ) : exchangeData ? (
                                            (amount * exchangeData.exchange_rate).toLocaleString(undefined, {maximumFractionDigits: 5})
                                        ) : (
                                            '---'
                                        )}
                                    </span>
                                    <span className="text-xl font-medium text-purple-300">{toAsset.code}</span>
                                </div>
                                <div className="text-xs text-purple-300/70 mt-2">
                                    1 {fromAsset.code} ≈ {exchangeData ? exchangeData.exchange_rate.toFixed(5) : '...'} {toAsset.code}
                                </div>
                            </div>
                        </div>

                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Bitcoin size={200} />
                        </div>
                    </div>
                </div>

                {/* Right: Chart & Stats */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 min-h-[500px] flex flex-col">
                         {chartData ? (
                             <>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            {fromAsset.icon} {fromAsset.code} <span className="text-gray-400">/</span> {toAsset.icon} {toAsset.code}
                                        </h2>
                                        <p className="text-sm text-gray-500">Historical Price Action</p>
                                    </div>
                                    {exchangeData && (
                                        <div className="flex gap-4">
                                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                <div className="text-xs text-gray-500">Ask</div>
                                                <div className="font-bold dark:text-white">{parseFloat(exchangeData.ask_price).toFixed(2)}</div>
                                            </div>
                                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                <div className="text-xs text-gray-500">Bid</div>
                                                <div className="font-bold dark:text-white">{parseFloat(exchangeData.bid_price).toFixed(2)}</div>
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
                             <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                 {loadingChart ? (
                                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                                 ) : (
                                     <>
                                        <Activity className="w-16 h-16 mb-4 opacity-20" />
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