import React from 'react';

const AssetCompareCard = ({ eyebrow, ticker, title, subtitle, metrics = [], accent = 'slate' }) => {
    const accentClassMap = {
        blue: 'border-mm-accent-primary/20 bg-mm-accent-primary/5',
        violet: 'border-mm-border bg-mm-surface-subtle',
        slate: 'border-mm-border bg-mm-surface-subtle',
    };

    return (
        <div className={`rounded-card border p-5 shadow-card ${accentClassMap[accent] || accentClassMap.slate}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {eyebrow ? (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mm-text-tertiary">{eyebrow}</p>
                    ) : null}
                    <h3 className="mt-2 text-2xl font-semibold text-mm-text-primary">{ticker}</h3>
                    <p className="mt-1 text-sm font-medium text-mm-text-primary">{title || 'Unknown asset'}</p>
                    {subtitle ? <p className="mt-1 text-sm text-mm-text-secondary">{subtitle}</p> : null}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {metrics.map((metric) => (
                    <div key={`${ticker}-${metric.label}`} className="rounded-control border border-mm-border bg-mm-surface px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-mm-text-tertiary">{metric.label}</p>
                        <p className="mt-2 text-lg font-semibold text-mm-text-primary">{metric.value}</p>
                        {metric.caption ? (
                            <p className="mt-1 text-xs leading-5 text-mm-text-secondary">{metric.caption}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AssetCompareCard;
