// Pure formatters, tone map, and shared section heading style for fundamentals.

export const fmtBig = (val, prefix = '') => {
    if (val === null || val === undefined || val === 'N/A' || val === 'None') return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '—';
    const abs = Math.abs(num);
    if (abs >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
    return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const currencyPrefix = (currency) => {
    switch (String(currency || '').toUpperCase()) {
    case 'HKD':
        return 'HK$';
    case 'CNY':
        return 'CN¥';
    case 'USD':
    default:
        return '$';
    }
};

export const metricToneClass = {
    accent: 'text-mm-accent-primary',
    positive: 'text-mm-positive',
    warning: 'text-mm-warning',
    tertiary: 'text-mm-text-tertiary',
};

export const sectionTitleClass = 'text-2xl font-semibold text-mm-text-primary mb-6';
