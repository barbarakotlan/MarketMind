import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { fmtBig, metricToneClass, sectionTitleClass } from './format';
import { getSentimentLabel, getSentimentToneClasses } from '../ui/sentimentUtils';

export const FinancialTable = ({ title, rows, data }) => {
    if (!data || data.length === 0) return null;
    const periods = data.map((d) => d.period);

    return (
        <div className="ui-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-mm-border">
                <h3 className="text-sm font-semibold text-mm-text-primary">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-mm-surface-subtle">
                        <tr>
                            <th className="px-5 py-2.5 text-left text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">Metric</th>
                            {periods.map((p) => (
                                <th key={p} className="px-5 py-2.5 text-right text-xs text-mm-text-tertiary font-semibold uppercase tracking-[0.14em]">
                                    {p}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-mm-border">
                        {rows.map(({ label, key, raw }) => (
                            <tr key={key} className="hover:bg-mm-surface-subtle/80">
                                <td className="px-5 py-2.5 text-mm-text-secondary font-medium">{label}</td>
                                {data.map((d) => (
                                    <td key={d.period} className="px-5 py-2.5 text-right text-mm-text-primary">
                                        {raw ? fmtBig(d[key]) : fmtBig(d[key], '$')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const MetricCard = ({ title, value, icon: Icon, tone = 'accent' }) => (
    <div className="ui-panel-subtle p-4">
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-mm-text-secondary">{title}</span>
            {Icon && <Icon className={`w-4 h-4 ${metricToneClass[tone] || metricToneClass.accent}`} />}
        </div>
        <p className="text-xl font-semibold text-mm-text-primary">{value}</p>
    </div>
);

export const TabButton = ({ active, children, onClick }) => (
    <button
        onClick={onClick}
        className={active
            ? 'rounded-control bg-mm-accent-primary px-5 py-2 text-sm font-semibold text-white shadow-card'
            : 'rounded-control border border-mm-border bg-mm-surface px-5 py-2 text-sm font-semibold text-mm-text-secondary transition hover:bg-mm-surface-subtle hover:text-mm-text-primary'}
    >
        {children}
    </button>
);

export const SentimentBadge = ({ sentiment, prefix = '' }) => {
    const label = getSentimentLabel(sentiment);
    if (!label) {
        return null;
    }
    return (
        <span className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${getSentimentToneClasses(sentiment)}`}>
            {prefix ? `${prefix}: ${label}` : label}
        </span>
    );
};

export const ResearchProfileList = ({ items }) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        <div className="ui-panel p-6">
            <h3 className={sectionTitleClass}>Company Research</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="ui-panel-subtle p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mm-text-tertiary">{item.label}</p>
                        <p className="mt-2 text-sm leading-6 text-mm-text-primary break-words">{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AnnouncementsPanel = ({ items }) => {
    if (!Array.isArray(items) || items.length === 0) {
        return (
            <div className="ui-panel-subtle py-16 text-mm-text-secondary text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No company announcements were returned for this asset.</p>
            </div>
        );
    }

    return (
        <div className="ui-panel p-6">
            <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-mm-accent-primary" />
                <h3 className="text-lg font-semibold text-mm-text-primary">Company Announcements</h3>
            </div>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <a
                        key={`${item.link || item.title}-${index}`}
                        href={item.link || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-card border border-mm-border bg-mm-surface px-4 py-4 transition hover:bg-mm-surface-subtle"
                    >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-mm-text-tertiary">
                            <span className="rounded-pill border border-mm-border px-2 py-0.5 font-semibold uppercase tracking-[0.12em]">
                                {item.type || 'Announcement'}
                            </span>
                            {item.date ? <span>{item.date}</span> : null}
                            {item.publisher ? <span>• {item.publisher}</span> : null}
                            <SentimentBadge sentiment={item.sentiment} />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-mm-text-primary">{item.title || item.description || 'Company announcement'}</p>
                        {item.description && item.description !== item.title ? (
                            <p className="mt-2 text-sm leading-6 text-mm-text-secondary">{item.description}</p>
                        ) : null}
                        {item.link ? (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-mm-accent-primary">
                                Open source link <ExternalLink className="w-3 h-3" />
                            </span>
                        ) : null}
                    </a>
                ))}
            </div>
        </div>
    );
};
