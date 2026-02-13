import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Droplets, Hammer, Wheat, AlertTriangle, Search, X } from 'lucide-react';
import StockChart from './charts/StockChart';

const timeFrames = [
    { label: '1M', value: '1mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
];

const CommoditiesPage = () => {
    const [commodities, setCommodities] = useState([]);
    const [selectedCommodity, setSelectedCommodity] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingChart, setLoadingChart] = useState(false);
    const [activeTimeFrame, setActiveTimeFrame] = useState(timeFrames[1]); 
    const [searchTerm, setSearchTerm] = useState('');

    const tickerMap = {
        'WTI Oil': 'CL=F', 'Brent Oil': 'BZ=F', 'Natural Gas': 'NG=F',
        'Gold': 'GC=F', 'Silver': 'SI=F', 'Copper': 'HG=F',
        'Corn': 'ZC=F', 'Wheat': 'ZW=F', 'Soybean': 'ZS=F',
        'Coffee': 'KC=F', 'Sugar': 'SB=F', 'Platinum': 'PL=F', 'Palladium': 'PA=F'
    };

    useEffect(() => {
        fetchCommodities();
    }, []);

    const fetchCommodities = async () => {
        try {
            const res = await fetch('http://localhost:5001/commodities/list');
            const data = await res.json();
            setCommodities(data);
            if (data.length > 0) loadCommodity(data[0].code);
        } catch (err) { console.error(err); } finally { setLoadingList(false); }
    };

    const loadCommodity = async (code) => {
        try {
            const res = await fetch(`http://localhost:5001/commodities/price/${code}`);
            const data = await res.json();
            if (!data.error) {
                setSelectedCommodity(data);
                fetchChart(data.name, activeTimeFrame.value);
            }
        } catch (err) { console.error(err); }
    };

    const fetchChart = async (commodityName, period) => {
        setLoadingChart(true);
        try {
            const mappedTicker = tickerMap[commodityName] || tickerMap[Object.keys(tickerMap).find(k => commodityName.includes(k))];
            
            if (mappedTicker) {
                const res = await fetch(`http://localhost:5001/chart/${mappedTicker}?period=${period}`);
                if (res.ok) {
                    setChartData(await res.json());
                } else {
                    setChartData(null);
                }
            } else {
                setChartData(null);
            }
        } catch (e) {
            setChartData(null);
        } finally {
            setLoadingChart(false);
        }
    };

    const handleTimeFrameChange = (newTimeFrame) => {
        setActiveTimeFrame(newTimeFrame);
        if (selectedCommodity) {
            fetchChart(selectedCommodity.name, newTimeFrame.value);
        }
    };

    const getCategoryIcon = (cat) => {
        if (cat === 'Energy') return <Droplets className="w-4 h-4 text-blue-500" />;
        if (cat === 'Metals') return <Hammer className="w-4 h-4 text-gray-500" />;
        return <Wheat className="w-4 h-4 text-yellow-500" />;
    };

    // Filter Logic
    const filteredCommodities = commodities.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <BarChart3 className="w-10 h-10 text-orange-600" /> Global Commodities
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[800px]">
                
                {/* Searchable Sidebar */}
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px] lg:h-full">
                    {/* Fixed Header with Search */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 space-y-3">
                        <div className="font-bold text-gray-700 dark:text-gray-200">Market List</div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Search markets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="overflow-y-auto flex-1">
                        {loadingList ? (
                            <div className="p-8 text-center text-gray-400">Loading assets...</div>
                        ) : filteredCommodities.length > 0 ? (
                            filteredCommodities.map((comm) => (
                                <button
                                    key={comm.code}
                                    onClick={() => loadCommodity(comm.code)}
                                    className={`w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex justify-between items-center group ${
                                        selectedCommodity?.code === comm.code 
                                            ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-500' 
                                            : 'border-l-4 border-l-transparent'
                                    }`}
                                >
                                    <div>
                                        <div className={`font-bold transition-colors ${
                                            selectedCommodity?.code === comm.code ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-white'
                                        }`}>
                                            {comm.name}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 group-hover:text-gray-600 dark:group-hover:text-gray-400">
                                            {getCategoryIcon(comm.category)} {comm.category}
                                        </div>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                No markets found
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-9 flex flex-col gap-6">
                    {selectedCommodity ? (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-t-4 border-orange-500">
                                    <div className="text-sm text-gray-500">Current Price</div>
                                    <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
                                        ${selectedCommodity.current_price?.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">Unit: {selectedCommodity.unit}</div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                    <div className="text-sm text-gray-500">Day Change</div>
                                    <div className={`text-2xl font-bold mt-1 ${
                                        (selectedCommodity.price_change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                        {(selectedCommodity.price_change || 0) >= 0 ? '+' : ''}{selectedCommodity.price_change}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                    <div className="text-sm text-gray-500">% Change</div>
                                    <div className={`text-2xl font-bold mt-1 ${
                                        (selectedCommodity.price_change_percent || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                        {(selectedCommodity.price_change_percent || 0) >= 0 ? '+' : ''}{selectedCommodity.price_change_percent}%
                                    </div>
                                </div>
                            </div>

                            {/* Chart Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 flex-1 min-h-[500px] flex flex-col">
                                {loadingChart ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                                    </div>
                                ) : chartData ? (
                                    <>
                                        <div className="flex items-center gap-2 mb-4 font-bold text-gray-700 dark:text-gray-200">
                                            <TrendingUp className="w-5 h-5" /> Futures Performance
                                        </div>
                                        <StockChart 
                                            chartData={chartData} 
                                            ticker={selectedCommodity.name} 
                                            activeTimeFrame={activeTimeFrame}
                                            onTimeFrameChange={handleTimeFrameChange}
                                        />
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-4">
                                            <AlertTriangle className="w-8 h-8 text-orange-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Chart Preview Unavailable</h3>
                                        <p className="text-gray-500 max-w-sm mt-2">
                                            Real-time charting for {selectedCommodity.name} is limited. Please refer to price cards.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow-lg text-gray-400">
                            Select a commodity to begin analysis
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommoditiesPage;