// Shared pure helpers for the search page and its data hook.

export const MARKET_OPTIONS = [
    { value: 'us', label: 'US' },
    { value: 'hk', label: 'HK' },
    { value: 'cn', label: 'CN' },
    { value: 'all', label: 'All' },
];

export const isUsAsset = (asset) => !asset || asset.market === 'US';
