// Pure display formatters for search result cards.

export // --- Helpers for Jimmy's cards ---
const formatLargeNumber = (num) => {
    if (!num || isNaN(num)) return 'N/A';
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return Number(num).toLocaleString();
};

export const formatNum = (num, isPercent = false) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const val = Number(num);
    return isPercent ? `${val.toFixed(2)}%` : val.toFixed(2);
};

export const formatCurrency = (num) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return `$${Number(num).toFixed(2)}`;
};

export const formatSignedPercent = (num) => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const value = Number(num);
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};
