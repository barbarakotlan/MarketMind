// Shared currency/number/percent formatters for paper trading.

// --- HELPER FUNCTIONS ---
export const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export const formatNum = (num, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    const parsed = parseFloat(num);
    return isNaN(parsed) ? '0.00' : parsed.toFixed(digits);
};

export const formatPercent = (num, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00%';
    return `${formatNum(Number(num) * 100, digits)}%`;
};
