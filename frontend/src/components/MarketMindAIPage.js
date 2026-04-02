import React, { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    AlertCircle,
    Download,
    FileOutput,
    Plus,
    RefreshCcw,
    Send,
    Sparkles,
    X,
} from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api';

const TEMPLATE_KEY = 'investment_thesis_memo';

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

const formatActionError = (error, fallback) => {
    const message = error?.message || fallback;
    if (message === 'Failed to fetch') {
        return 'MarketMindAI could not reach the backend. Refresh after the backend is running and your signed-in session is settled.';
    }
    return message;
};

const SectionLabel = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{children}</p>
);

const StarterPromptButton = ({ prompt, onClick }) => (
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

const MessageBubble = ({ role, content }) => {
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

const ContextCard = ({ label, value, caption }) => (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <SectionLabel>{label}</SectionLabel>
        <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{value}</p>
        {caption ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{caption}</p> : null}
    </div>
);

const ArtifactPreview = ({ artifact, version }) => {
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

const MarketMindAIPage = () => {
    const { isLoaded, isSignedIn } = useAuth();
    const [bootstrap, setBootstrap] = useState({ starterPrompts: [], templates: [] });
    const [activeChatId, setActiveChatId] = useState(null);
    const [selectedArtifactId, setSelectedArtifactId] = useState(null);
    const [selectedArtifactDetail, setSelectedArtifactDetail] = useState(null);
    const [selectedVersionId, setSelectedVersionId] = useState(null);
    const [artifactLoading, setArtifactLoading] = useState(false);
    const [attachedTicker, setAttachedTicker] = useState('');
    const [contextData, setContextData] = useState(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [composerValue, setComposerValue] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [generatingArtifact, setGeneratingArtifact] = useState(false);
    const [preflight, setPreflight] = useState(null);
    const [pageError, setPageError] = useState('');
    const [workspaceNotice, setWorkspaceNotice] = useState(null);

    const selectedVersion = useMemo(() => {
        if (!selectedArtifactDetail?.versions?.length) {
            return null;
        }
        return selectedArtifactDetail.versions.find((version) => version.id === selectedVersionId) || selectedArtifactDetail.versions[0];
    }, [selectedArtifactDetail, selectedVersionId]);

    const starterPrompts = bootstrap?.starterPrompts || [];
    const artifactPanelOpen = Boolean(selectedArtifactDetail || artifactLoading);
    const showTickerContext = Boolean(attachedTicker);
    const internationalTickerContext = contextData?.assetType === 'equity' && contextData?.market && contextData.market !== 'US';

    const clearArtifactSelection = () => {
        setSelectedArtifactId(null);
        setSelectedArtifactDetail(null);
        setSelectedVersionId(null);
    };

    const showNotice = (message, tone = 'info') => {
        if (!message) {
            setWorkspaceNotice(null);
            return;
        }
        setWorkspaceNotice({ message, tone });
    };

    const loadBootstrap = async () => {
        setPageError('');
        try {
            const bootstrapPayload = await apiRequest(API_ENDPOINTS.MARKETMIND_AI_BOOTSTRAP);
            setBootstrap(bootstrapPayload || { starterPrompts: [], templates: [] });
        } catch (error) {
            setPageError(formatActionError(error, 'Failed to load MarketMindAI.'));
        }
    };

    const announceHistoryUpdated = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('marketmindai:history-updated'));
        }
    };

    const loadAttachedTickerContext = async (ticker) => {
        if (!ticker) {
            setContextData(null);
            return;
        }
        setContextLoading(true);
        try {
            const payload = await apiRequest(API_ENDPOINTS.MARKETMIND_AI_CONTEXT(ticker));
            setContextData(payload);
        } catch (error) {
            setContextData(null);
            setPageError(formatActionError(error, 'Failed to load MarketMind context.'));
        } finally {
            setContextLoading(false);
        }
    };

    const loadArtifactDetail = async (artifactId) => {
        if (!artifactId) {
            setSelectedArtifactDetail(null);
            setSelectedVersionId(null);
            return;
        }
        setArtifactLoading(true);
        setPageError('');
        try {
            const payload = await apiRequest(API_ENDPOINTS.MARKETMIND_AI_ARTIFACT(artifactId));
            setSelectedArtifactDetail(payload);
            setSelectedVersionId(payload.versions?.[0]?.id || null);
        } catch (error) {
            setPageError(formatActionError(error, 'Failed to load the selected artifact.'));
        } finally {
            setArtifactLoading(false);
        }
    };

    const loadChatDetail = async (chatId) => {
        if (!chatId) {
            return;
        }
        setPageError('');
        try {
            const payload = await apiRequest(API_ENDPOINTS.MARKETMIND_AI_CHAT_DETAIL(chatId));
            setActiveChatId(payload.chat?.id || chatId);
            setMessages(
                (payload.messages || []).map((message, index) => ({
                    id: message.id || `${message.role}-${index}`,
                    role: message.role,
                    content: message.content,
                }))
            );
            setComposerValue('');
            setWorkspaceNotice(null);
            setPreflight(null);
            const nextTicker = payload.chat?.attachedTicker || '';
            setAttachedTicker(nextTicker);
            if (nextTicker) {
                await loadAttachedTickerContext(nextTicker);
            } else {
                setContextData(null);
            }
            if (payload.chat?.latestArtifactId) {
                setSelectedArtifactId(payload.chat.latestArtifactId);
                await loadArtifactDetail(payload.chat.latestArtifactId);
            } else {
                clearArtifactSelection();
            }
            announceHistoryUpdated();
        } catch (error) {
            setPageError(formatActionError(error, 'Failed to load the selected chat.'));
        }
    };

    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            return;
        }
        loadBootstrap();
    }, [isLoaded, isSignedIn]);

    const handleExternalChatSelection = useEffectEvent((chatId) => {
        if (chatId) {
            loadChatDetail(chatId);
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('marketmindai:active-chat-changed', { detail: { chatId: activeChatId } }));
        }
    }, [activeChatId]);

    useEffect(() => {
        const handleSelectChat = (event) => {
            const chatId = event?.detail?.chatId;
            if (chatId) {
                if (typeof window !== 'undefined') {
                    window.sessionStorage.removeItem('marketmindai:selectedChatId');
                }
                handleExternalChatSelection(chatId);
            }
        };
        window.addEventListener('marketmindai:select-chat', handleSelectChat);
        return () => window.removeEventListener('marketmindai:select-chat', handleSelectChat);
    }, [handleExternalChatSelection]);

    useEffect(() => {
        const handleDeletedChat = (event) => {
            const deletedChatId = event?.detail?.chatId;
            if (deletedChatId && deletedChatId === activeChatId) {
                setActiveChatId(null);
                setMessages([]);
                setComposerValue('');
                setAttachedTicker('');
                setContextData(null);
                setPreflight(null);
                setWorkspaceNotice(null);
                setPageError('');
                setSelectedArtifactId(null);
                setSelectedArtifactDetail(null);
                setSelectedVersionId(null);
            }
        };
        const handleNotice = (event) => {
            const message = event?.detail?.message;
            const tone = event?.detail?.tone || 'info';
            if (message) {
                showNotice(message, tone);
            }
        };
        window.addEventListener('marketmindai:chat-deleted', handleDeletedChat);
        window.addEventListener('marketmindai:notice', handleNotice);
        return () => {
            window.removeEventListener('marketmindai:chat-deleted', handleDeletedChat);
            window.removeEventListener('marketmindai:notice', handleNotice);
        };
    }, [activeChatId]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const pendingChatId = window.sessionStorage.getItem('marketmindai:selectedChatId');
        if (pendingChatId) {
            window.sessionStorage.removeItem('marketmindai:selectedChatId');
            handleExternalChatSelection(pendingChatId);
        }
    }, [handleExternalChatSelection]);

    function resetWorkspace() {
        setActiveChatId(null);
        setMessages([]);
        setComposerValue('');
        setAttachedTicker('');
        setContextData(null);
        setPreflight(null);
        setWorkspaceNotice(null);
        setPageError('');
        clearArtifactSelection();
    }

    const handleGenerateArtifact = async ({ messageSnapshot, tickerOverride, chatIdOverride, artifactIdOverride } = {}) => {
        const finalMessages = (messageSnapshot || messages).map(({ role, content }) => ({ role, content }));
        const finalTicker = tickerOverride || attachedTicker;
        const finalChatId = chatIdOverride || activeChatId;
        const finalArtifactId = artifactIdOverride === undefined ? selectedArtifactId : artifactIdOverride;
        setWorkspaceNotice(null);
        setPageError('');
        if (!finalMessages.length) {
            return;
        }
        setGeneratingArtifact(true);
        try {
            const preflightPayload = await apiRequest(API_ENDPOINTS.MARKETMIND_AI_ARTIFACT_PREFLIGHT, {
                method: 'POST',
                body: JSON.stringify({
                    templateKey: TEMPLATE_KEY,
                    messages: finalMessages,
                    attachedTicker: finalTicker || undefined,
                }),
            });
            setPreflight(preflightPayload);
            if (preflightPayload.status !== 'ready') {
                showNotice('Need a clear ticker and enough context before a memo can be created.', 'warn');
                return;
            }

            const artifactPayload = await apiRequest(API_ENDPOINTS.MARKETMIND_AI_ARTIFACTS, {
                method: 'POST',
                body: JSON.stringify({
                    templateKey: TEMPLATE_KEY,
                    messages: finalMessages,
                    attachedTicker: finalTicker || undefined,
                    chatId: finalChatId || undefined,
                    artifactId: finalArtifactId || undefined,
                }),
            });
            setSelectedArtifactId(artifactPayload.artifact?.id || null);
            if (artifactPayload.chat?.id) {
                setActiveChatId(artifactPayload.chat.id);
                announceHistoryUpdated();
            }
            showNotice('Memo created.', 'success');
            if (artifactPayload.artifact?.id) {
                await loadArtifactDetail(artifactPayload.artifact.id);
            }
        } catch (error) {
            setPageError(formatActionError(error, 'Failed to generate the memo artifact.'));
        } finally {
            setGeneratingArtifact(false);
        }
    };

    const sendMessage = async (promptOverride) => {
        const nextContent = String(promptOverride ?? composerValue).trim();
        if (!nextContent) {
            return;
        }

        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: nextContent,
        };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setComposerValue('');
        setChatLoading(true);
        setWorkspaceNotice(null);
        setPageError('');
        setPreflight(null);

        try {
            const payload = await apiRequest(API_ENDPOINTS.MARKETMIND_AI_CHAT, {
                method: 'POST',
                body: JSON.stringify({
                    messages: nextMessages.map(({ role, content }) => ({ role, content })),
                    attachedTicker: attachedTicker || undefined,
                    chatId: activeChatId || undefined,
                }),
            });

            const assistantMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: payload.assistantMessage?.content || 'No response returned.',
            };
            const updatedConversation = [...nextMessages, assistantMessage];
            setMessages(updatedConversation);
            if (payload.chat?.id) {
                setActiveChatId(payload.chat.id);
                announceHistoryUpdated();
            }

            const resolution = payload.tickerResolution || {};
            const comparePair = Array.isArray(payload.comparePair) ? payload.comparePair : [];
            const resolvedTicker = payload.chat?.attachedTicker || resolution.resolvedTicker || '';
            const resolutionStatus = resolution.status || (resolvedTicker ? 'kept' : 'detached');
            const shouldClearArtifact =
                !resolvedTicker ||
                resolutionStatus === 'compare' ||
                resolutionStatus === 'ambiguous' ||
                resolutionStatus === 'detached' ||
                (selectedArtifactDetail?.artifact?.ticker && selectedArtifactDetail.artifact.ticker !== resolvedTicker);

            if (shouldClearArtifact) {
                clearArtifactSelection();
            }

            setAttachedTicker(resolvedTicker);
            if (resolvedTicker) {
                await loadAttachedTickerContext(resolvedTicker);
            } else {
                setContextData(null);
            }

            if (resolutionStatus === 'switched' && resolvedTicker) {
                showNotice(`Using ${resolvedTicker} for MarketMind context.`, 'info');
            } else if (resolutionStatus === 'compare' && comparePair.length === 2) {
                showNotice(`Comparing ${comparePair[0]} vs ${comparePair[1]} using current MarketMind context.`, 'info');
            } else if (resolutionStatus === 'ambiguous') {
                showNotice('Multiple tickers were detected. Ask again with one ticker to ground MarketMind context.', 'warn');
            } else if (resolutionStatus === 'detached' && attachedTicker && !resolvedTicker) {
                showNotice('Ticker context cleared for this chat.', 'info');
            }

            if (payload.artifactIntent?.autoGenerate && resolvedTicker) {
                await handleGenerateArtifact({
                    messageSnapshot: updatedConversation,
                    tickerOverride: resolvedTicker,
                    chatIdOverride: payload.chat?.id || undefined,
                    artifactIdOverride: shouldClearArtifact ? null : selectedArtifactId,
                });
            }
        } catch (error) {
            setPageError(formatActionError(error, 'Failed to send your MarketMindAI message.'));
        } finally {
            setChatLoading(false);
        }
    };

    const handleDownloadVersion = async (version) => {
        if (!selectedArtifactDetail?.artifact?.id || !version?.id) {
            return;
        }
        try {
            const response = await fetch(
                API_ENDPOINTS.MARKETMIND_AI_ARTIFACT_DOWNLOAD(selectedArtifactDetail.artifact.id, version.id)
            );
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to download artifact.' }));
                throw new Error(error.error || 'Failed to download artifact.');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${selectedArtifactDetail.artifact.ticker.toLowerCase()}-memo-v${version.version}.docx`;
            link.click();
            window.URL.revokeObjectURL(url);
            showNotice('Memo downloaded.', 'success');
        } catch (error) {
            setPageError(formatActionError(error, 'Failed to download the memo artifact.'));
        }
    };

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
