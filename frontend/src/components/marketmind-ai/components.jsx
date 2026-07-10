import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileOutput } from 'lucide-react';

const ARTIFACT_SECTIONS = [
    ['executive_summary', 'Executive Summary'],
    ['investment_thesis', 'Investment Thesis'],
    ['supporting_evidence', 'Supporting Evidence'],
    ['key_assumptions', 'Key Assumptions'],
    ['risks', 'Risks'],
    ['invalidation_conditions', 'Invalidation Conditions'],
    ['catalysts', 'Catalysts'],
    ['signals_and_market_context', 'Signals and Market Context'],
    ['linked_positioning', 'Linked Positioning'],
    ['what_would_change_my_mind', 'What Would Change My Mind'],
    ['conclusion', 'Conclusion'],
];

export const SectionLabel = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{children}</p>
);

export const StarterPromptButton = ({ prompt, onClick }) => (
    <button
        type="button"
        onClick={() => onClick(prompt)}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
    >
        {prompt}
    </button>
);

const normalizeAssistantContent = (content) =>
    String(content || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/^\s*•\s+/gm, '- ');

export const MessageBubble = ({ role, content }) => {
    const isAssistant = role === 'assistant';
    const normalizedContent = isAssistant ? normalizeAssistantContent(content) : content;
    return (
        <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
            <div
                className={`max-w-[82%] rounded-[24px] px-4 py-3 text-sm leading-7 ${
                    isAssistant
                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        : 'bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950'
                }`}
            >
                {isAssistant ? (
                    <div className="marketmind-ai-markdown overflow-x-auto">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({ node, ...props }) => <p className="whitespace-pre-wrap" {...props} />,
                                ul: ({ node, ...props }) => <ul className="ml-5 list-disc space-y-2" {...props} />,
                                ol: ({ node, ...props }) => <ol className="ml-5 list-decimal space-y-2" {...props} />,
                                li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                strong: ({ node, ...props }) => <strong className="font-semibold text-slate-950 dark:text-white" {...props} />,
                                code: ({ node, inline, className, children, ...props }) =>
                                    inline ? (
                                        <code
                                            className="rounded-md bg-slate-200 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    ),
                                pre: ({ node, ...props }) => (
                                    <pre
                                        className="overflow-x-auto rounded-2xl bg-slate-900 px-4 py-3 text-slate-100 dark:bg-slate-950"
                                        {...props}
                                    />
                                ),
                                table: ({ node, ...props }) => (
                                    <div className="my-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <table className="min-w-full border-collapse text-left text-sm" {...props} />
                                    </div>
                                ),
                                thead: ({ node, ...props }) => <thead className="bg-slate-200/80 dark:bg-slate-700/70" {...props} />,
                                tbody: ({ node, ...props }) => <tbody className="divide-y divide-slate-200 dark:divide-slate-700" {...props} />,
                                th: ({ node, ...props }) => (
                                    <th className="px-3 py-2 font-semibold text-slate-950 dark:text-white" {...props} />
                                ),
                                td: ({ node, ...props }) => (
                                    <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200" {...props} />
                                ),
                                blockquote: ({ node, ...props }) => (
                                    <blockquote
                                        className="border-l-4 border-slate-300 pl-4 italic text-slate-600 dark:border-slate-600 dark:text-slate-300"
                                        {...props}
                                    />
                                ),
                            }}
                        >
                            {normalizedContent}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap">{normalizedContent}</p>
                )}
            </div>
        </div>
    );
};

export const ContextCard = ({ label, value, caption }) => (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <SectionLabel>{label}</SectionLabel>
        <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{value}</p>
        {caption ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{caption}</p> : null}
    </div>
);

export const EvidencePanel = ({ title = 'Retrieved evidence', items = [], status = null }) => {
    const hasItems = Array.isArray(items) && items.length > 0;
    const unavailable = status && status.enabled && !status.available;
    const empty = status && status.available && !hasItems && status.reason === 'no_relevant_documents';

    if (!hasItems && !unavailable && !empty) {
        return null;
    }

    return (
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <SectionLabel>{title}</SectionLabel>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {hasItems
                            ? 'MarketMindAI used stored research evidence alongside the live ticker context.'
                            : unavailable
                            ? 'Research retrieval is temporarily unavailable, so MarketMindAI answered from the live context only.'
                            : 'No stored research evidence matched this request yet, so MarketMindAI answered from the live context only.'}
                    </p>
                </div>
                {status?.rerankUsed ? (
                    <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-slate-100 dark:text-slate-950">
                        reranked
                    </span>
                ) : null}
            </div>
            {hasItems ? (
                <div className="mt-4 space-y-3">
                    {items.map((item, index) => (
                        <div key={`${item.assetId || item.title || 'evidence'}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-wrap items-center gap-2">
                                {item.docType ? (
                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {item.docType}
                                    </span>
                                ) : null}
                                {item.ticker ? (
                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {item.ticker}
                                    </span>
                                ) : null}
                                {item.source ? <span className="text-xs text-slate-400 dark:text-slate-500">{item.source}</span> : null}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">{item.title || 'Untitled evidence'}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.snippet || 'No snippet available.'}</p>
                            {item.sourceUrl ? (
                                <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex text-sm font-medium text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
                                >
                                    Open source
                                </a>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export const ArtifactPreview = ({ artifact, version }) => {
    if (!artifact || !version) {
        return (
            <div className="flex min-h-[640px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-8 text-center dark:border-slate-700 dark:bg-slate-950/50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
                    <FileOutput className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-white">Memo preview</h3>
                <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500 dark:text-slate-400">
                    When a memo is created in this chat, it will show up here with version history and download.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-7 py-6 dark:border-slate-800">
                <SectionLabel>Investment Thesis Memo</SectionLabel>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{artifact.title}</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {artifact.ticker} | version {version.version} | {version.generationStatus}
                </p>
            </div>
            <div className="space-y-8 px-7 py-8">
                {ARTIFACT_SECTIONS.map(([key, label]) => {
                    const value = version.structuredContent?.[key];
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        return null;
                    }

                    return (
                        <section key={key}>
                            <SectionLabel>{label}</SectionLabel>
                            {Array.isArray(value) ? (
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                                    {value.map((item, index) => (
                                        <li key={`${key}-${index}`} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{value}</p>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};
