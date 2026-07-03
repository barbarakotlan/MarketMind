import React from 'react';
import {
    AlertCircle,
    Download,
    Plus,
    RefreshCcw,
    Send,
    Sparkles,
    X,
} from 'lucide-react';
import { SectionLabel, StarterPromptButton, MessageBubble, ContextCard, EvidencePanel, ArtifactPreview } from './marketmind-ai/components';
import useMarketMindAIData from './marketmind-ai/useMarketMindAIData';
import {
    getMarketSessionLabel,
    getMarketSessionSummary,
} from './ui/marketSessionUtils';
import {
    getSentimentSummaryCaption,
    getSentimentSummaryValue,
} from './ui/sentimentUtils';

const inputClassName =
    'w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-300';

const surfaceClassName = 'rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const noticeToneClassNames = {
    success:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    info:
        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
    warn:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
};

const getSentimentToneWord = (summary) => {
    const value = getSentimentSummaryValue(summary);
    return value ? value.replace(/^Overall\s+/i, '') : null;
};

const MarketMindAIPage = () => {
    const {
        artifactLoading, artifactPanelOpen, attachedTicker, chatLoading,
        clearArtifactSelection, composerValue, contextData, contextLoading,
        generatingArtifact, handleDownloadVersion, internationalTickerContext, loadBootstrap,
        messages, pageError, preflight, resetWorkspace,
        retrievalStatus, retrievedEvidence, selectedArtifactDetail, selectedVersion,
        sendMessage, setAttachedTicker, setComposerValue, setContextData,
        setPreflight, setSelectedArtifactDetail, setSelectedArtifactId, setSelectedVersionId,
        showTickerContext, starterPrompts, workspaceNotice,
    } = useMarketMindAIData();

    return (
        <div className="min-h-screen bg-slate-50 px-5 py-6 dark:bg-slate-950 md:px-7">
            <div className="mx-auto max-w-[1600px] space-y-5">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={resetWorkspace}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <Plus className="h-4 w-4" />
                        New chat
                    </button>
                </div>

                {pageError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                <span>{pageError}</span>
                            </div>
                            <button
                                type="button"
                                onClick={loadBootstrap}
                                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-900/40"
                            >
                                <RefreshCcw className="h-3.5 w-3.5" />
                                Retry
                            </button>
                        </div>
                    </div>
                ) : null}

                {workspaceNotice ? (
                    <div
                        className={`rounded-2xl border px-4 py-3 text-sm ${noticeToneClassNames[workspaceNotice.tone] || noticeToneClassNames.info}`}
                    >
                        {workspaceNotice.message}
                    </div>
                ) : null}

                <div className={`grid gap-5 ${artifactPanelOpen ? 'xl:grid-cols-[minmax(0,1fr)_540px]' : 'xl:grid-cols-[minmax(0,1fr)]'}`}>
                    <div className={`${surfaceClassName} min-h-[760px] overflow-hidden`}>
                        {showTickerContext ? (
                            <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white dark:bg-slate-100 dark:text-slate-950">
                                            {attachedTicker}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAttachedTicker('');
                                                setContextData(null);
                                                setPreflight(null);
                                                clearArtifactSelection();
                                            }}
                                            className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    {contextLoading ? (
                                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                            Loading MarketMind context...
                                        </div>
                                    ) : contextData ? (
                                        <>
                                            <ContextCard
                                                label={internationalTickerContext ? 'Research mode' : 'Prediction'}
                                                value={
                                                    internationalTickerContext
                                                        ? `${contextData.market} read-only`
                                                        : contextData.predictionSnapshot
                                                        ? `$${contextData.predictionSnapshot.recentPredicted}`
                                                        : 'Unavailable'
                                                }
                                                caption={
                                                    internationalTickerContext
                                                        ? 'Akshare-backed international context is available for research, while predictions and memo artifacts remain US-only in phase 1.'
                                                        : contextData.predictionSnapshot
                                                        ? `${contextData.predictionSnapshot.confidence}% confidence vs $${contextData.predictionSnapshot.recentClose} close`
                                                        : 'No prediction snapshot available right now.'
                                                }
                                            />
                                            <ContextCard
                                                label="Watchlist and alerts"
                                                value={`${contextData.watchlistMembership ? 'Tracked' : 'Not tracked'} · ${contextData.activeAlerts?.length || 0} alerts`}
                                                caption="Grounded in your current MarketMind state."
                                            />
                                            <ContextCard
                                                label="Fundamentals"
                                                value={contextData.fundamentalsSummary?.companyName || 'Unavailable'}
                                                caption={contextData.fundamentalsSummary?.sector || 'Sector unavailable'}
                                            />
                                            <ContextCard
                                                label="Recent news"
                                                value={`${contextData.recentNews?.length || 0} headlines`}
                                                caption={contextData.recentNews?.[0]?.title || 'No recent headlines available.'}
                                            />
                                            {contextData.sentimentSummary?.overall ? (
                                                <ContextCard
                                                    label="Sentiment"
                                                    value={getSentimentSummaryValue(contextData.sentimentSummary.overall)}
                                                    caption={[
                                                        getSentimentSummaryCaption(contextData.sentimentSummary.overall),
                                                        getSentimentToneWord(contextData.sentimentSummary.news)
                                                            ? `News ${getSentimentToneWord(contextData.sentimentSummary.news)}`
                                                            : null,
                                                        getSentimentToneWord(contextData.sentimentSummary.filings)
                                                            ? `Filings ${getSentimentToneWord(contextData.sentimentSummary.filings)}`
                                                            : null,
                                                        getSentimentToneWord(contextData.sentimentSummary.announcements)
                                                            ? `Announcements ${getSentimentToneWord(contextData.sentimentSummary.announcements)}`
                                                            : null,
                                                    ].filter(Boolean).join(' · ')}
                                                />
                                            ) : null}
                                            {contextData.marketSession ? (
                                                <ContextCard
                                                    label="Market session"
                                                    value={getMarketSessionLabel(contextData.marketSession)}
                                                    caption={getMarketSessionSummary(contextData.marketSession)}
                                                />
                                            ) : null}
                                        </>
                                    ) : (
                                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                            Context is still loading for {attachedTicker}.
                                        </div>
                                    )}
                                </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="flex min-h-[560px] flex-col px-5 py-5">
                            {messages.length === 0 ? (
                                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
                                        <Sparkles className="h-8 w-8" />
                                    </div>
                                    <h3 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-white">Start with a question</h3>
                                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                                        Ask a market question naturally. When your message points to a real ticker like AAPL or HK:00700, MarketMindAI will ground the session in MarketMind data automatically.
                                    </p>
                                    <div className="mt-8 grid w-full max-w-3xl gap-3 md:grid-cols-2">
                                        {starterPrompts.map((prompt) => (
                                            <StarterPromptButton key={prompt} prompt={prompt} onClick={sendMessage} />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                                    {messages.map((message) => (
                                        <MessageBubble key={message.id} role={message.role} content={message.content} />
                                    ))}
                                    {chatLoading ? (
                                        <div className="flex justify-start">
                                            <div className="rounded-[24px] bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                MarketMindAI is thinking...
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {preflight && preflight.status !== 'ready' ? (
                                <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <SectionLabel>Memo blockers</SectionLabel>
                                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                Resolve these items before a memo can be created from this chat.
                                            </p>
                                        </div>
                                        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                            {preflight.status}
                                        </span>
                                    </div>
                                    {preflight.requiredItems?.length ? (
                                        <div className="mt-4 space-y-2">
                                            {preflight.requiredItems.map((item, index) => (
                                                <div key={`${item.field}-${index}`} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                    {item.message}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="mt-4">
                                <EvidencePanel
                                    items={retrievedEvidence}
                                    status={retrievalStatus}
                                />
                            </div>

                            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                                    <div className="min-w-0 flex-1">
                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Message</label>
                                        <textarea
                                            rows={4}
                                            value={composerValue}
                                            onChange={(event) => setComposerValue(event.target.value)}
                                            placeholder="Ask MarketMindAI about a ticker, a thesis, a risk, or a market setup."
                                            className={`${inputClassName} py-3`}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => sendMessage()}
                                            disabled={chatLoading || generatingArtifact}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
                                        >
                                            <Send className="h-4 w-4" />
                                            {chatLoading ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {artifactPanelOpen ? (
                        <div className={`${surfaceClassName} min-h-[760px] overflow-hidden`}>
                            <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <SectionLabel>Memo</SectionLabel>
                                        <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                                            {selectedArtifactDetail?.artifact?.title || 'Investment Thesis Memo'}
                                        </h2>
                                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                            Review the latest draft, switch versions, or download the `.docx`.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedArtifactId(null);
                                            setSelectedArtifactDetail(null);
                                            setSelectedVersionId(null);
                                        }}
                                        className="rounded-full border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                                        aria-label="Close artifact panel"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {selectedArtifactDetail?.versions?.length ? (
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        {selectedArtifactDetail.versions.map((version) => (
                                            <button
                                                key={version.id}
                                                type="button"
                                                onClick={() => setSelectedVersionId(version.id)}
                                                className={`rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
                                                    selectedVersion?.id === version.id
                                                        ? 'bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                v{version.version}
                                            </button>
                                        ))}
                                        {selectedVersion?.hasArtifact ? (
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadVersion(selectedVersion)}
                                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download .docx
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>

                            <div className="px-5 py-5">
                                {selectedVersion?.retrievedEvidence?.length || selectedVersion?.retrievalStatus ? (
                                    <div className="mb-5">
                                        <EvidencePanel
                                            title="Memo evidence"
                                            items={selectedVersion?.retrievedEvidence || []}
                                            status={selectedVersion?.retrievalStatus || null}
                                        />
                                    </div>
                                ) : null}
                                {artifactLoading ? (
                                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                        Loading artifact...
                                    </div>
                                ) : (
                                    <ArtifactPreview artifact={selectedArtifactDetail?.artifact} version={selectedVersion} />
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default MarketMindAIPage;
