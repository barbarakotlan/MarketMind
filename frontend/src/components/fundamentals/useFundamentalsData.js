import { useState, useEffect } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';
import { MARKET_OPTIONS } from './fundamentalsUtils';

const US_TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'financials', label: 'Financials' },
    { key: 'filings', label: 'SEC Filings' },
];

const INTERNATIONAL_TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'research', label: 'Company Research' },
];

const normalizeMarket = (market = 'us') => {
    const normalized = String(market || 'us').trim().toLowerCase();
    return MARKET_OPTIONS.some((option) => option.value === normalized) ? normalized : 'us';
};

const normalizeAssetInput = (input, fallbackMarket = 'us') => {
    const rawValue = String(input || '').trim();
    if (!rawValue) return null;

    const prefixed = rawValue.match(/^([A-Za-z]{2}):(.+)$/);
    const market = normalizeMarket(prefixed?.[1] || fallbackMarket);
    const rawSymbol = prefixed?.[2] || rawValue;
    const symbol = market === 'us'
        ? rawSymbol.trim().toUpperCase()
        : rawSymbol.replace(/\D/g, '').padStart(market === 'hk' ? 5 : 6, '0');

    if (!symbol) return null;

    return {
        symbol,
        market: market.toUpperCase(),
        assetId: market === 'us' ? `US:${symbol}` : `${market.toUpperCase()}:${symbol}`,
        displayLabel: market === 'us' ? symbol : `${market.toUpperCase()}:${symbol}`,
    };
};

const isUsAsset = (asset) => !asset || asset.market === 'US';

export default function useFundamentalsData() {
    const { sharedTicker: initialTicker, clearTicker: onConsumeInitialTicker } = useNavigation();
    const [ticker, setTicker] = useState('');
    const [selectedMarket, setSelectedMarket] = useState('us');
    const [resolvedAsset, setResolvedAsset] = useState(null);
    const [fundamentals, setFundamentals] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [filings, setFilings] = useState(null);
    const [secIntelligence, setSecIntelligence] = useState(null);
    const [secIntelligenceError, setSecIntelligenceError] = useState('');
    const [expandedFilingAccession, setExpandedFilingAccession] = useState(null);
    const [filingDetailState, setFilingDetailState] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const activeAsset = resolvedAsset || (fundamentals ? normalizeAssetInput(fundamentals.assetId || fundamentals.symbol, fundamentals.market || selectedMarket) : null);
    const internationalResearchMode = activeAsset && !isUsAsset(activeAsset);
    const tabs = internationalResearchMode ? INTERNATIONAL_TABS : US_TABS;
    const marketSession = fundamentals?.marketSession || null;

    const loadFundamentals = async (rawTicker, marketOverride = selectedMarket) => {
        if (!String(rawTicker || '').trim()) return;

        const asset = normalizeAssetInput(rawTicker, marketOverride);
        if (!asset) {
            setError('Enter a valid ticker like AAPL, HK:00700, or CN:600519.');
            return;
        }

        setLoading(true);
        setError('');
        setTicker(asset.displayLabel);
        setSelectedMarket(asset.market.toLowerCase());
        setResolvedAsset(asset);
        setFundamentals(null);
        setFinancials(null);
        setFilings(null);
        setSecIntelligence(null);
        setSecIntelligenceError('');
        setExpandedFilingAccession(null);
        setFilingDetailState({});
        setActiveTab('overview');

        try {
            const overview = await apiRequest(API_ENDPOINTS.FUNDAMENTALS(asset.symbol, asset.market));
            setFundamentals(overview);
            setResolvedAsset(normalizeAssetInput(overview?.assetId || overview?.symbol || asset.symbol, overview?.market || asset.market) || asset);

            if (asset.market !== 'US') {
                return;
            }

            const [financialsRes, filingsRes, secIntelligenceRes] = await Promise.allSettled([
                apiRequest(API_ENDPOINTS.FUNDAMENTALS_FINANCIALS(asset.symbol)),
                apiRequest(API_ENDPOINTS.FUNDAMENTALS_FILINGS(asset.symbol, asset.market)),
                apiRequest(API_ENDPOINTS.FUNDAMENTALS_SEC_INTELLIGENCE(asset.symbol, asset.market)),
            ]);

            if (financialsRes.status === 'fulfilled' && !financialsRes.value?.error) {
                setFinancials(financialsRes.value);
            }
            if (filingsRes.status === 'fulfilled' && !filingsRes.value?.error) {
                setFilings(filingsRes.value);
            }
            if (secIntelligenceRes.status === 'fulfilled' && !secIntelligenceRes.value?.error) {
                setSecIntelligence(secIntelligenceRes.value);
            } else if (secIntelligenceRes.status === 'fulfilled' && secIntelligenceRes.value?.error) {
                setSecIntelligenceError(secIntelligenceRes.value.error);
            } else if (secIntelligenceRes.status === 'rejected') {
                setSecIntelligenceError(secIntelligenceRes.reason?.message || 'Failed to fetch SEC intelligence');
            }
        } catch (searchError) {
            setError(searchError?.message || 'Failed to fetch fundamentals');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        await loadFundamentals(ticker, selectedMarket);
    };

    useEffect(() => {
        if (!initialTicker) return;
        loadFundamentals(initialTicker, 'us');
        if (onConsumeInitialTicker) onConsumeInitialTicker();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTicker]);

    const formatNumber = (value, prefix = '', suffix = '') => {
        if (value === 'N/A' || value === 'None' || value === null || value === undefined || value === '') return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T${suffix}`;
        if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B${suffix}`;
        if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M${suffix}`;
        return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
    };

    const formatPercent = (value) => {
        if (value === 'N/A' || value === 'None' || value === null || value === undefined || value === '') return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return `${(num * 100).toFixed(2)}%`;
    };

    const formatPercentValue = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        const num = parseFloat(value);
        return Number.isFinite(num) ? `${num.toFixed(1)}%` : '—';
    };

    const formatSignedInteger = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        const num = Number(value);
        if (!Number.isFinite(num)) return '—';
        return `${num > 0 ? '+' : ''}${Math.round(num).toLocaleString()}`;
    };

    const filingDetailEndpoint = (accessionNumber) => {
        const symbol = fundamentals?.symbol || activeAsset?.symbol || ticker.toUpperCase().trim();
        return API_ENDPOINTS.FUNDAMENTALS_FILING_DETAIL(symbol, accessionNumber);
    };

    const loadFilingDetail = async (filing, { expand = true } = {}) => {
        const accessionNumber = filing?.accessionNumber;
        if (!accessionNumber) return;

        if (expand) {
            setExpandedFilingAccession(accessionNumber);
        }

        setFilingDetailState((prev) => ({
            ...prev,
            [accessionNumber]: {
                status: 'loading',
                error: '',
                data: prev[accessionNumber]?.data || null,
                activeSectionKey: prev[accessionNumber]?.activeSectionKey || null,
            },
        }));

        try {
            const detail = await apiRequest(filingDetailEndpoint(accessionNumber));
            const normalizedDetail = detail || { sections: [] };
            setFilingDetailState((prev) => ({
                ...prev,
                [accessionNumber]: {
                    status: 'success',
                    error: '',
                    data: normalizedDetail,
                    activeSectionKey: normalizedDetail.sections?.[0]?.key || null,
                },
            }));
        } catch (detailError) {
            setFilingDetailState((prev) => ({
                ...prev,
                [accessionNumber]: {
                    status: 'error',
                    error: detailError?.message || 'Failed to load SEC filing detail.',
                    data: prev[accessionNumber]?.data || null,
                    activeSectionKey: prev[accessionNumber]?.activeSectionKey || null,
                },
            }));
        }
    };

    const handleToggleFilingDetail = async (filing) => {
        const accessionNumber = filing?.accessionNumber;
        if (!accessionNumber) return;

        if (expandedFilingAccession === accessionNumber) {
            setExpandedFilingAccession(null);
            return;
        }

        const existingState = filingDetailState[accessionNumber];
        setExpandedFilingAccession(accessionNumber);
        if (existingState?.status === 'success') {
            return;
        }
        await loadFilingDetail(filing, { expand: false });
    };

    const setActiveFilingSection = (accessionNumber, sectionKey) => {
        setFilingDetailState((prev) => ({
            ...prev,
            [accessionNumber]: {
                ...prev[accessionNumber],
                activeSectionKey: sectionKey,
            },
        }));
    };


    return {
        activeAsset, activeTab, error, expandedFilingAccession,
        filingDetailState, filings, financials, formatNumber,
        formatPercent, formatPercentValue, formatSignedInteger, fundamentals,
        handleSearch, handleToggleFilingDetail, internationalResearchMode, loadFilingDetail,
        loading, marketSession, secIntelligence, secIntelligenceError,
        selectedMarket, setActiveFilingSection, setActiveTab, setSelectedMarket,
        setTicker, tabs, ticker,
    };
}
