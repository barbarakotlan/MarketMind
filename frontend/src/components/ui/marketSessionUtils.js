const safeDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getMarketSessionLabel = (session) => {
    if (!session) return 'Closed';
    switch (session.status) {
    case 'open':
        return 'Open';
    case 'break':
        return 'Lunch Break';
    case 'holiday':
        return 'Holiday';
    default:
        return 'Closed';
    }
};

export const getMarketSessionTone = (session) => {
    if (!session) return 'slate';
    switch (session.status) {
    case 'open':
        return 'positive';
    case 'break':
        return 'warning';
    case 'holiday':
        return 'negative';
    default:
        return 'slate';
    }
};

export const getMarketSessionToneClasses = (session) => {
    switch (getMarketSessionTone(session)) {
    case 'positive':
        return 'border-mm-positive/20 bg-mm-positive/10 text-mm-positive';
    case 'warning':
        return 'border-mm-warning/20 bg-mm-warning/10 text-mm-warning';
    case 'negative':
        return 'border-mm-negative/20 bg-mm-negative/10 text-mm-negative';
    default:
        return 'border-mm-border bg-mm-surface-subtle text-mm-text-secondary';
    }
};

export const formatMarketSessionTime = (value, timezone, options = {}) => {
    const parsed = safeDate(value);
    if (!parsed) return null;
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone || 'UTC',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
            ...options,
        }).format(parsed);
    } catch (error) {
        return parsed.toISOString();
    }
};

export const formatMarketSessionDateTime = (value, timezone) => {
    const parsed = safeDate(value);
    if (!parsed) return null;
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone || 'UTC',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
        }).format(parsed);
    } catch (error) {
        return parsed.toISOString();
    }
};

export const getMarketSessionSummary = (session) => {
    if (!session) {
        return 'Session timing unavailable.';
    }
    const timezone = session.timezone;
    if (session.status === 'open') {
        return session.closesAt
            ? `Closes at ${formatMarketSessionTime(session.closesAt, timezone)}`
            : 'Market is in its regular trading session.';
    }
    if (session.status === 'break') {
        const nextOpen = formatMarketSessionTime(session.nextOpen, timezone);
        const closeTime = formatMarketSessionTime(session.closesAt, timezone);
        if (nextOpen && closeTime) {
            return `Reopens at ${nextOpen}; closes at ${closeTime}`;
        }
        return 'Market is currently paused for lunch.';
    }
    if (session.reason === 'weekend') {
        return session.nextOpen
            ? `Weekend. Next open ${formatMarketSessionDateTime(session.nextOpen, timezone)}`
            : 'Weekend. Next session unavailable.';
    }
    if (session.status === 'holiday' || session.reason === 'holiday') {
        return session.nextOpen
            ? `Holiday. Next open ${formatMarketSessionDateTime(session.nextOpen, timezone)}`
            : 'Market holiday.';
    }
    if (session.nextOpen) {
        return `Next open ${formatMarketSessionDateTime(session.nextOpen, timezone)}`;
    }
    return 'Outside regular hours.';
};

export const getTimezoneLabel = (timezone) => String(timezone || '').replace(/_/g, ' ');
