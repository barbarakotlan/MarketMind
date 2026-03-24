import React from 'react';

const AssetCompareCard = ({ eyebrow, ticker, title, subtitle, metrics = [], accent = 'slate' }) => {
    const accentClassMap = {
        blue: 'border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/30',
        violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-900/60 dark:bg-violet-950/30',
        slate: 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/30',
    };

    return (
        <div className={`rounded-3xl border p-5 ${accentClassMap[accent] || accentClassMap.slate}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {eyebrow ? (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
                    ) : null}
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{ticker}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{title || 'Unknown asset'}</p>
                    {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {metrics.map((metric) => (
                    <div key={`${ticker}-${metric.label}`} className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{metric.value}</p>
                        {metric.caption ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{metric.caption}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AssetCompareCard;
