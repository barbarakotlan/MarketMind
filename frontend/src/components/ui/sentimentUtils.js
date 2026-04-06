export const getSentimentLabel = (sentiment) => {
    if (!sentiment || sentiment.status !== 'scored') {
        return null;
    }
    const label = String(sentiment.label || '').trim().toLowerCase();
    if (!label) {
        return null;
    }
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
};

export const getSentimentToneClasses = (sentiment) => {
    const label = String(sentiment?.label || '').trim().toLowerCase();
    if (label === 'positive') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (label === 'negative') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }
    return 'border-slate-200 bg-slate-100 text-slate-600';
};

export const getSentimentSummaryValue = (summary) => {
    const label = getSentimentLabel(summary);
    if (!label) {
        return null;
    }
    return `Overall ${label}`;
};

export const getSentimentSummaryCaption = (summary) => {
    if (!summary || summary.status !== 'scored') {
        return null;
    }
    const scoredCount = Number(summary.scoredCount || 0);
    const countPrefix = scoredCount > 0 ? `${scoredCount} scored item${scoredCount === 1 ? '' : 's'}` : 'Scored evidence';
    return countPrefix;
};
