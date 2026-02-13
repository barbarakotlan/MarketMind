import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, ArrowLeftRight, TrendingUp, AlertCircle, Search, ChevronDown } from 'lucide-react';
import StockChart from './charts/StockChart';

const timeFrames = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

// --- Custom Searchable Asset Selector (Ported from CryptoPage) ---
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
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
        opt.code.toLowerCase().includes(search.toLowerCase()) || 
        opt.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                {label}
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 transition-all hover:border-blue-500"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{selected.flag || '💵'}</span>
                    <div className="text-left">
                        <div className="font-bold text-gray-900 dark:text-white leading-tight">{selected.code}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{selected.name}</div>
                    </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-fade-in-up">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search currencies..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left ${
                                    selected.code === opt.code ? 'bg-blue-100 dark:bg-blue-900/40' : ''
                                }`}
                            >
                                <span className="text-xl">{opt.flag || '💵'}</span>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{opt.code}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{opt.name}</div>
                                </div>
                            </button>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-500">No currency found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ForexPage = () => {
    const [currencies, setCurrencies] = useState([]);
    
    // Using objects for state to support the AssetSelector
    const [fromCurrency, setFromCurrency] = useState({ code: 'USD', name: 'United States Dollar', flag: '🇺🇸' });
    const [toCurrency, setToCurrency] = useState({ code: 'EUR', name: 'Euro', flag: '🇪🇺' });
    
    const [amount, setAmount] = useState(1);
    const [exchangeData, setExchangeData] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTimeFrame, setActiveTimeFrame] = useState(timeFrames[2]); // Default 1M

    useEffect(() => {
        const init = async () => {
            try {
                const res = await fetch('http://localhost:5001/forex/currencies');
                const data = await res.json();
                setCurrencies(data);
                
                // Hydrate initial state with full objects if available
                const usd = data.find(c => c.code === 'USD');
                const eur = data.find(c => c.code === 'EUR');
                if (usd) setFromCurrency(usd);
                if (eur) setToCurrency(eur);

                fetchData(usd || fromCurrency, eur || toCurrency, activeTimeFrame.value);
            } catch (err) { console.error("Failed to load currencies", err); }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Consolidated Data Fetcher (Removes redundant function calls)
    const fetchData = async (from, to, period) => {
        setLoading(true);
        try {
            // 1. Fetch Conversion
            const convertRes = await fetch(`http://localhost:5001/forex/convert?from=${from.code}&to=${to.code}`);
            if (convertRes.ok) {
                setExchangeData(await convertRes.json());
            }

            // 2. Fetch Chart (Parallel or sequential doesn't matter much here, keeping sequential for simplicity)
            const ticker = `${from.code}${to.code}=X`;
            const chartRes = await fetch(`http://localhost:5001/chart/${ticker}?period=${period}`);
            if (chartRes.ok) {
                const cData = await chartRes.json();
                setChartData(Array.isArray(cData) && cData.length > 0 ? cData : null);
            } else {
                setChartData(null);
            }
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
        const newFrom = currencies.find(c => c.code === fCode) || { code: fCode, name: '', flag: '💱' };
        const newTo = currencies.find(c => c.code === tCode) || { code: tCode, name: '', flag: '💱' };
        
        setFromCurrency(newFrom);
        setToCurrency(newTo);
        fetchData(newFrom, newTo, activeTimeFrame.value);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-3">
                    <DollarSign className="w-10 h-10 text-blue-600" /> Forex Command Center
                </h1>
            </div>

            {/* Changed items-center to items-start to pull the graph up */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Left Column: Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Converter</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Amount</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none text-lg font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
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
                                    <button onClick={handleSwap} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-transform hover:rotate-180">
                                        <ArrowLeftRight className="w-5 h-5 text-blue-500" />
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

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center border border-blue-100 dark:border-blue-800">
                                <span className="block text-sm text-blue-600 dark:text-blue-300 mb-1">Converted Value</span>
                                {loading && !exchangeData ? (
                                    <span className="animate-pulse text-xl">Loading...</span>
                                ) : exchangeData ? (
                                    <span className="text-3xl font-bold text-blue-700 dark:text-blue-200">
                                        {(amount * exchangeData.exchange_rate).toFixed(2)} <span className="text-lg">{toCurrency.code}</span>
                                    </span>
                                ) : (
                                    <span>---</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase tracking-wider">Quick Pairs</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['USD/EUR', 'GBP/USD', 'USD/JPY', 'USD/CAD'].map(pair => (
                                <button
                                    key={pair}
                                    onClick={() => handleQuickPair(pair)}
                                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-all"
                                >
                                    {pair}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Chart Area */}
                {/* Removed 'h-[500px]' fixed height restriction to allow it to fit content naturally if needed, or keep min-h */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 min-h-[500px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            {fromCurrency.code}/{toCurrency.code} Performance
                        </h2>
                    </div>
                    
                    <div className="flex-grow flex flex-col">
                         {loading ? (
                             <div className="h-full flex items-center justify-center">
                                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                             </div>
                         ) : chartData ? (
                             <StockChart 
                                chartData={chartData} 
                                ticker={`${fromCurrency.code}/${toCurrency.code}`} 
                                activeTimeFrame={activeTimeFrame}
                                onTimeFrameChange={handleTimeFrameChange}
                             />
                         ) : (
                             <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                                 <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
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