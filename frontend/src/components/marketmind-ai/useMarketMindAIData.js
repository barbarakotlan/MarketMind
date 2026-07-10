import { useState, useEffect, useMemo, useEffectEvent } from 'react';
import { useAuth } from '../../auth';
import { useNavigation } from '../../context/NavigationContext';
import { API_ENDPOINTS, apiRequest } from '../../config/api';

const TEMPLATE_KEY = 'investment_thesis_memo';

const formatActionError = (error, fallback) => {
    const message = error?.message || fallback;
    if (message === 'Failed to fetch') {
        return 'MarketMindAI could not reach the backend. Refresh after the backend is running and your signed-in session is settled.';
    }
    return message;
};

export default function useMarketMindAIData() {
    const { sharedAiPrompt: initialPrompt, clearAiPrompt: onConsumeInitialPrompt } = useNavigation();
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
    const [retrievedEvidence, setRetrievedEvidence] = useState([]);
    const [retrievalStatus, setRetrievalStatus] = useState(null);
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
            setRetrievedEvidence([]);
            setRetrievalStatus(null);
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

    useEffect(() => {
        const nextPrompt = String(initialPrompt || '').trim();
        if (!nextPrompt) return;
        setComposerValue(nextPrompt);
        if (onConsumeInitialPrompt) onConsumeInitialPrompt();
    }, [initialPrompt, onConsumeInitialPrompt]);

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
                setRetrievedEvidence([]);
                setRetrievalStatus(null);
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
        setRetrievedEvidence([]);
        setRetrievalStatus(null);
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
        setRetrievedEvidence([]);
        setRetrievalStatus(null);

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
            setRetrievedEvidence(payload.retrievedEvidence || []);
            setRetrievalStatus(payload.retrievalStatus || null);

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


    return {
        artifactLoading, artifactPanelOpen, attachedTicker, chatLoading,
        clearArtifactSelection, composerValue, contextData, contextLoading,
        generatingArtifact, handleDownloadVersion, internationalTickerContext, loadBootstrap,
        messages, pageError, preflight, resetWorkspace,
        retrievalStatus, retrievedEvidence, selectedArtifactDetail, selectedVersion,
        sendMessage, setAttachedTicker, setComposerValue, setContextData,
        setPreflight, setSelectedArtifactDetail, setSelectedArtifactId, setSelectedVersionId,
        showTickerContext, starterPrompts, workspaceNotice,
    };
}
