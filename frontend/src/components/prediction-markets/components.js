import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Clock, ExternalLink } from 'lucide-react';
import { formatCurrency, formatProbability, formatProbabilityDelta } from './format';
import { API_ENDPOINTS, apiRequest } from '../../config/api';

const DEFAULT_ANALYSIS_STATE = {
    status: 'idle',
    data: null,
    error: '',
};

const STANCE_META = {
    aligned: {
        label: 'Aligned',
        classes: 'ui-status-chip bg-mm-accent-primary/10 text-mm-accent-primary',
    },
    lean_yes: {
        label: 'Lean Yes',
        classes: 'ui-status-chip ui-status-chip--positive',
    },
    lean_no: {
        label: 'Lean No',
        classes: 'ui-status-chip ui-status-chip--negative',
    },
    uncertain: {
        label: 'Uncertain',
        classes: 'ui-status-chip bg-mm-warning/10 text-mm-warning',
    },
};

const ANALYSIS_LOADING_STEPS = [
    'Resolving market context',
    'Reading pricing and liquidity',
    'Drafting structured claims',
    'Writing the Market vs Model brief',
];

const getAnalysisState = (analysisState) => analysisState || DEFAULT_ANALYSIS_STATE;

export const ProbabilityBar = ({ outcomes, prices }) => {
    const colors = [
        'bg-mm-positive', 'bg-mm-negative', 'bg-mm-accent-primary',
        'bg-mm-warning', 'bg-slate-500',
    ];

    return (
        <div className="w-full">
            <div className="flex h-3 overflow-hidden rounded-pill bg-mm-surface-subtle">
                {outcomes.map((outcome, i) => {
                    const p = prices[outcome] || 0;
                    return (
                        <div
                            key={outcome}
                            className={`${colors[i % colors.length]} transition-all duration-300`}
                            style={{ width: `${p * 100}%` }}
                        />
                    );
                })}
            </div>
            <div className="mt-1 flex justify-between">
                {outcomes.map((outcome) => (
                    <span key={outcome} className="text-xs text-mm-text-secondary">
                        {outcome}: {formatProbability(prices[outcome] || 0)}
                    </span>
                ))}
            </div>
        </div>
    );
};

export const AnalysisLoadingPanel = () => {
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        const startedAt = Date.now();
        const intervalId = window.setInterval(() => {
            const elapsedMs = Date.now() - startedAt;
            const nextElapsedSeconds = Math.max(1, Math.floor(elapsedMs / 1000));
            const nextStepIndex = Math.min(
                ANALYSIS_LOADING_STEPS.length - 1,
                Math.floor(elapsedMs / 1600)
            );

            setElapsedSeconds(nextElapsedSeconds);
            setActiveStepIndex(nextStepIndex);
        }, 500);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    return (
        <div className="mt-4 rounded-control border border-mm-border bg-mm-surface p-4">
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-mm-accent-primary" />
                <p className="text-sm font-medium text-mm-text-primary">
                    Working through the market analysis...
                </p>
            </div>

            <div className="mt-3 space-y-2">
                {ANALYSIS_LOADING_STEPS.map((step, index) => {
                    const isComplete = index < activeStepIndex;
                    const isActive = index === activeStepIndex;

                    return (
                        <div key={step} className="flex items-center gap-2 text-xs">
                            {isComplete ? (
                                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-mm-positive" />
                            ) : isActive ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-mm-accent-primary" />
                            ) : (
                                <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-mm-border bg-mm-surface-subtle" />
                            )}
                            <span className={isActive ? 'font-medium text-mm-text-primary' : 'text-mm-text-secondary'}>
                                {step}
                            </span>
                        </div>
                    );
                })}
            </div>

            <p className="mt-3 text-xs text-mm-text-tertiary">
                {elapsedSeconds > 0
                    ? `Elapsed: ${elapsedSeconds}s`
                    : 'Starting now...'}
            </p>
        </div>
    );
};

export const AnalysisPanel = ({ market, analysisState, analysisEnabled, onAnalyze }) => {
    const { status, data, error } = getAnalysisState(analysisState);
    const marketSummary = data?.market || {};
    const analysis = data?.analysis || {};
    const stanceMeta = STANCE_META[analysis.stance] || STANCE_META.uncertain;

    return (
        <div className="mb-5 rounded-2xl border border-mm-border bg-mm-surface-subtle p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="ui-section-label mb-1">Market vs Model</p>
                    <p className="text-xs text-mm-text-secondary">
                        Generate a compact probability brief grounded in the current market setup.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onAnalyze}
                    disabled={!analysisEnabled || status === 'loading'}
                    className="ui-button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {status === 'loading'
                        ? 'Analyzing...'
                        : status === 'success'
                            ? 'Refresh analysis'
                            : 'Analyze market'
                    }
                </button>
            </div>

            {!analysisEnabled && (
                <p className="mt-3 text-xs font-medium text-mm-text-tertiary">
                    Sign in to generate Market vs Model analysis.
                </p>
            )}

            {status === 'loading' && (
                <AnalysisLoadingPanel />
            )}

            {status === 'error' && (
                <div className="mt-4 rounded-control border border-mm-negative/20 bg-mm-negative/5 p-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-mm-negative" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-mm-negative">Analysis failed</p>
                            <p className="mt-1 text-xs text-mm-text-secondary">{error || 'Please try again.'}</p>
                        </div>
                    </div>
                </div>
            )}

            {status === 'success' && data && (
                <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-control border border-mm-border bg-mm-surface p-3">
                            <p className="ui-section-label mb-1">Market Odds</p>
                            <p className="text-xl font-semibold text-mm-text-primary">
                                {formatProbability(marketSummary.current_probability)}
                            </p>
                            <p className="text-xs text-mm-text-secondary">Current implied probability</p>
                        </div>
                        <div className="rounded-control border border-mm-border bg-mm-surface p-3">
                            <p className="ui-section-label mb-1">Model Odds</p>
                            <p className="text-xl font-semibold text-mm-text-primary">
                                {formatProbability(analysis.model_probability)}
                            </p>
                            <p className="text-xs text-mm-text-secondary">Structured analysis output</p>
                        </div>
                        <div className="rounded-control border border-mm-border bg-mm-surface p-3">
                            <p className="ui-section-label mb-1">Stance</p>
                            <div className="flex items-center gap-2">
                                <span className={stanceMeta.classes}>{stanceMeta.label}</span>
                                <span className="text-sm font-semibold text-mm-text-primary">
                                    {formatProbabilityDelta(analysis.delta)}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-mm-text-secondary">Model minus market</p>
                        </div>
                    </div>

                    {(marketSummary.event_title || marketSummary.end_date || marketSummary.source_url) && (
                        <div className="flex flex-wrap gap-4 text-xs text-mm-text-tertiary">
                            {marketSummary.event_title && <span>Event: {marketSummary.event_title}</span>}
                            {marketSummary.end_date && (
                                <span>
                                    Ends: {new Date(marketSummary.end_date).toLocaleString()}
                                </span>
                            )}
                            {marketSummary.source_url && (
                                <a
                                    href={marketSummary.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-mm-accent-primary transition-opacity hover:opacity-80"
                                >
                                    View source
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                    )}

                    <div className="rounded-control border border-mm-border bg-mm-surface p-4">
                        <p className="ui-section-label mb-2">Brief</p>
                        <p className="text-sm leading-relaxed text-mm-text-primary">{analysis.brief}</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
                        <div className="rounded-control border border-mm-border bg-mm-surface p-4">
                            <p className="ui-section-label mb-3">Claims</p>
                            <div className="space-y-3">
                                {(data.claims || []).map((claim, index) => (
                                    <div key={`${market.id}-claim-${index}`} className="rounded-control bg-mm-surface-subtle p-3">
                                        <p className="text-sm font-semibold text-mm-text-primary">{claim.claim}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-mm-text-secondary">{claim.rationale}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-control border border-mm-border bg-mm-surface p-4">
                            <p className="ui-section-label mb-3">Risk Notes</p>
                            <div className="space-y-2">
                                {(analysis.risk_notes || []).map((note, index) => (
                                    <div key={`${market.id}-risk-${index}`} className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mm-warning" />
                                        <p className="text-xs leading-relaxed text-mm-text-secondary">{note}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const MarketCard = ({
    market,
    isExpanded,
    onToggle,
    onTradeComplete,
    onAnalyze,
    analysisState,
    analysisEnabled,
}) => {
    const [buyOutcome, setBuyOutcome] = useState(null);
    const [contracts, setContracts] = useState('');
    const [tradeLoading, setTradeLoading] = useState(false);
    const [tradeError, setTradeError] = useState('');
    const [tradeSuccess, setTradeSuccess] = useState('');

    const handleBuy = async (e) => {
        e.preventDefault();
        if (!buyOutcome || !contracts) return;
        setTradeLoading(true);
        setTradeError('');
        setTradeSuccess('');
        try {
            const data = await apiRequest(API_ENDPOINTS.PREDICTION_BUY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market_id: market.id,
                    outcome: buyOutcome,
                    contracts: parseFloat(contracts),
                }),
            });
            setTradeSuccess(data.message);
            setContracts('');
            setBuyOutcome(null);
            await onTradeComplete(data.message);
        } catch (err) {
            setTradeError(err.message || 'Failed to execute trade');
        } finally {
            setTradeLoading(false);
        }
    };

    const price = buyOutcome ? (market.prices[buyOutcome] || 0) : 0;
    const totalCost = price * (parseFloat(contracts) || 0);

    return (
        <div className="ui-panel overflow-hidden transition-all">
            <button onClick={onToggle} className="flex w-full items-start gap-4 p-5 text-left">
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug text-mm-text-primary">
                        {market.question}
                    </h3>
                    <div className="mt-3">
                        <ProbabilityBar outcomes={market.outcomes} prices={market.prices} />
                    </div>
                </div>
                <div className="shrink-0 space-y-1 text-right">
                    {market.volume > 0 && (
                        <div className="text-xs text-mm-text-tertiary">Vol: ${market.volume?.toLocaleString()}</div>
                    )}
                    {market.liquidity > 0 && (
                        <div className="text-xs text-mm-text-tertiary">Liq: ${market.liquidity?.toLocaleString()}</div>
                    )}
                    {isExpanded
                        ? <ChevronUp className="ml-auto h-4 w-4 text-mm-text-tertiary" />
                        : <ChevronDown className="ml-auto h-4 w-4 text-mm-text-tertiary" />
                    }
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-mm-border px-5 pb-5 pt-4">
                    {market.description && (
                        <p className="mb-4 text-xs leading-relaxed text-mm-text-secondary">
                            {market.description.slice(0, 300)}{market.description.length > 300 ? '...' : ''}
                        </p>
                    )}
                    <div className="mb-4 flex gap-4 text-xs text-mm-text-tertiary">
                        {market.spread != null && <span>Spread: {(market.spread * 100).toFixed(1)}%</span>}
                        {market.close_time && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Closes: {new Date(market.close_time).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    <AnalysisPanel
                        market={market}
                        analysisState={analysisState}
                        analysisEnabled={analysisEnabled}
                        onAnalyze={() => onAnalyze(market)}
                    />

                    {market.is_open ? (
                        <form onSubmit={handleBuy}>
                            <div className="mb-3 flex flex-wrap gap-2">
                                {market.outcomes.map((o) => (
                                    <button
                                        key={o}
                                        type="button"
                                        onClick={() => setBuyOutcome(buyOutcome === o ? null : o)}
                                        className={buyOutcome === o ? 'ui-button-primary px-4 py-2 text-sm' : 'ui-button-secondary px-4 py-2 text-sm'}
                                    >
                                        {o} @ {formatProbability(market.prices[o] || 0)}
                                    </button>
                                ))}
                            </div>
                            {buyOutcome && (
                                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
                                    <div className="flex-1">
                                        <label className="ui-form-label">Contracts</label>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={contracts}
                                            onChange={(e) => setContracts(e.target.value)}
                                            placeholder="10"
                                            required
                                            className="ui-input py-2 text-sm"
                                        />
                                    </div>
                                    <div className="min-w-[100px] text-right">
                                        <p className="text-xs text-mm-text-tertiary">Est. Cost</p>
                                        <p className="text-lg font-semibold text-mm-text-primary">{formatCurrency(totalCost)}</p>
                                    </div>
                                    <button type="submit" disabled={tradeLoading || !contracts} className="ui-button-primary px-6 py-2.5 text-sm disabled:opacity-50">
                                        {tradeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Buy ${buyOutcome}`}
                                    </button>
                                </div>
                            )}
                            {tradeError && <p className="mt-2 text-xs font-medium text-mm-negative">{tradeError}</p>}
                            {tradeSuccess && <p className="mt-2 text-xs font-medium text-mm-positive">{tradeSuccess}</p>}
                        </form>
                    ) : (
                        <p className="text-xs font-medium text-mm-warning">This market is closed for trading.</p>
                    )}
                </div>
            )}
        </div>
    );
};
