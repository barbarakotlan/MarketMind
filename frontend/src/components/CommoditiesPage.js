import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Droplets, Hammer, Wheat, AlertTriangle, Search, X } from 'lucide-react';
import StockChart from './charts/StockChart';
import { API_ENDPOINTS, apiRequest } from '../config/api';

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
        Gold: 'GC=F', Silver: 'SI=F', Copper: 'HG=F',
        Corn: 'ZC=F', Wheat: 'ZW=F', Soybean: 'ZS=F',
        Coffee: 'KC=F', Sugar: 'SB=F', Platinum: 'PL=F', Palladium: 'PA=F',
    };

    useEffect(() => {
        fetchCommodities();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCommodities = async () => {
        try {
            const data = await apiRequest(API_ENDPOINTS.COMMODITIES_LIST);
            setCommodities(data);
            if (data.length > 0) loadCommodity(data[0].code);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingList(false);
        }
    };

    const loadCommodity = async (code) => {
        try {
            const data = await apiRequest(API_ENDPOINTS.COMMODITIES_PRICE(code));
            if (!data.error) {
                setSelectedCommodity(data);
                fetchChart(data.name, activeTimeFrame.value);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchChart = async (commodityName, period) => {
        setLoadingChart(true);
        try {
            const mappedTicker = tickerMap[commodityName] || tickerMap[Object.keys(tickerMap).find((k) => commodityName.includes(k))];
            if (mappedTicker) {
                setChartData(await apiRequest(API_ENDPOINTS.CHART(mappedTicker, period)));
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
        if (cat === 'Energy') return <Droplets className="h-4 w-4 text-mm-accent-primary" />;
        if (cat === 'Metals') return <Hammer className="h-4 w-4 text-mm-text-secondary" />;
        return <Wheat className="h-4 w-4 text-mm-warning" />;
    };

    const filteredCommodities = commodities.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="ui-page space-y-8">
            <div className="ui-page-header">
                <h1 className="ui-page-title flex items-center gap-3">
                    <BarChart3 className="h-10 w-10 text-mm-warning" />
                    Global Commodities
                </h1>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:h-[800px]">
                <div className="ui-panel flex h-[600px] flex-col overflow-hidden lg:col-span-3 lg:h-full">
                    <div className="space-y-3 border-b border-mm-border bg-mm-surface-subtle p-4">
                        <div className="font-semibold text-mm-text-primary">Market List</div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mm-text-tertiary" />
                            <input
                                type="text"
                                placeholder="Search markets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ui-input py-2 pl-9 pr-8 text-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-mm-text-tertiary hover:text-mm-text-primary"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loadingList ? (
                            <div className="p-8 text-center text-mm-text-secondary">Loading assets...</div>
                        ) : filteredCommodities.length > 0 ? (
                            filteredCommodities.map((comm) => (
                                <button
                                    key={comm.code}
                                    onClick={() => loadCommodity(comm.code)}
                                    className={`w-full border-b border-mm-border px-4 py-4 text-left transition hover:bg-mm-surface-subtle ${
                                        selectedCommodity?.code === comm.code ? 'bg-mm-accent-primary/10' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className={`font-semibold ${selectedCommodity?.code === comm.code ? 'text-mm-accent-primary' : 'text-mm-text-primary'}`}>
                                                {comm.name}
                                            </div>
                                            <div className="mt-1 flex items-center gap-1 text-xs text-mm-text-secondary">
                                                {getCategoryIcon(comm.category)} {comm.category}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center text-mm-text-secondary">
                                <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                No markets found
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-6 lg:col-span-9">
                    {selectedCommodity ? (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="ui-panel-elevated p-6">
                                    <div className="text-sm text-mm-text-secondary">Current Price</div>
                                    <div className="mt-1 text-3xl font-semibold text-mm-text-primary">
                                        ${selectedCommodity.current_price?.toLocaleString()}
                                    </div>
                                    <div className="mt-1 text-xs text-mm-text-tertiary">Unit: {selectedCommodity.unit}</div>
                                </div>
                                <div className="ui-panel p-6">
                                    <div className="text-sm text-mm-text-secondary">Day Change</div>
                                    <div className={`mt-1 text-2xl font-semibold ${(selectedCommodity.price_change || 0) >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                        {(selectedCommodity.price_change || 0) >= 0 ? '+' : ''}{selectedCommodity.price_change}
                                    </div>
                                </div>
                                <div className="ui-panel p-6">
                                    <div className="text-sm text-mm-text-secondary">% Change</div>
                                    <div className={`mt-1 text-2xl font-semibold ${(selectedCommodity.price_change_percent || 0) >= 0 ? 'text-mm-positive' : 'text-mm-negative'}`}>
                                        {(selectedCommodity.price_change_percent || 0) >= 0 ? '+' : ''}{selectedCommodity.price_change_percent}%
                                    </div>
                                </div>
                            </div>

                            <div className="ui-panel flex min-h-[500px] flex-1 flex-col p-6">
                                {loadingChart ? (
                                    <div className="flex flex-1 items-center justify-center">
                                        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-mm-warning"></div>
                                    </div>
                                ) : chartData ? (
                                    <>
                                        <div className="mb-4 flex items-center gap-2 font-semibold text-mm-text-primary">
                                            <TrendingUp className="h-5 w-5 text-mm-accent-primary" /> Futures Performance
                                        </div>
                                        <StockChart
                                            chartData={chartData}
                                            ticker={selectedCommodity.name}
                                            activeTimeFrame={activeTimeFrame}
                                            onTimeFrameChange={handleTimeFrameChange}
                                        />
                                    </>
                                ) : (
                                    <div className="ui-empty-state flex-1">
                                        <div className="mb-4 rounded-pill border border-mm-border bg-mm-surface p-4">
                                            <AlertTriangle className="h-8 w-8 text-mm-warning" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-mm-text-primary">Chart Preview Unavailable</h3>
                                        <p className="mt-2 max-w-sm">
                                            Real-time charting for {selectedCommodity.name} is limited. Please refer to the price cards.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="ui-empty-state flex-1">Select a commodity to begin analysis.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommoditiesPage;
