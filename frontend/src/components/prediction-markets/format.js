// Currency/percent/probability formatters for prediction markets.

export const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export const formatPercent = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0.00%';
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
};

export const formatProbability = (price) => `${((price || 0) * 100).toFixed(1)}%`;

export const formatProbabilityDelta = (delta) => `${delta >= 0 ? '+' : ''}${((delta || 0) * 100).toFixed(1)} pts`;
