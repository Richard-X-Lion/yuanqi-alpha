'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { addHistoryRecord } from '@/lib/history';
import type { FullAnalysisData } from '@/lib/history';
import { createSSEClient } from '@/lib/sse-client';
import { getEffectiveConfig } from '@/lib/api-config';

import {
  StanceBadge,
  AgentStructuredView,
  ChangeIndicator,
  VoteBar,
  CollapsibleSection,
  stripCodeBlocks,
  getInitialAgents,
  getDirectionTheme,
  getLeadingStance,
  AgentDetailModal,
} from '@/components/analysis';
import type {
  ParsedResult,
  AgentState,
  DebateRound,
  OneOnOneRound,
  VoteRoundData,
  DecisionState,
  NewsItem,
  DataStatus,
  Phase,
} from '@/components/analysis';
import {
  MARKET_DEFINITIONS,
  MARKET_OPTIONS,
  POPULAR_STOCKS_BY_MARKET,
  isDirectSecurityCode,
  isValidSecurityInput,
  normalizeSecurityInput,
  type MarketType,
} from '@/lib/markets/types';

function parseBatchCodes(value: string, market: MarketType): string[] {
  return [...new Set(value
    .split(/[\n,，;；]+/)
    .map((item) => normalizeSecurityInput(item, market))
    .filter((item) => isDirectSecurityCode(item, market))
  )];
}

type FinalOpinionView = {
  agentId: string;
  name: string;
  initialStance?: string;
  initialConfidence?: number;
  stance: string;
  confidence: number;
  changed?: boolean;
};

// ============================================================
// Main Page Component
// ============================================================

export default function HomePage() {
  const [market, setMarket] = useState<MarketType>('CN');
  const [stockCode, setStockCode] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [debateRounds, setDebateRounds] = useState<DebateRound[]>([]);
  const [currentDebateRound, setCurrentDebateRound] = useState(0);
  const [oneOnOneRounds, setOneOnOneRounds] = useState<OneOnOneRound[]>([]);
  const [current1v1Round, setCurrent1v1Round] = useState(0);
  const [voteRounds, setVoteRounds] = useState<VoteRoundData[]>([]);
  const [arbitrationContent, setArbitrationContent] = useState('');
  const [deadlockInfo, setDeadlockInfo] = useState<{ round: number; stances: Array<{ agentId: string; name: string; stance: string; confidence: number }> } | null>(null);
  const [consensusInfo, setConsensusInfo] = useState<{ stance: string; message: string } | null>(null);
  const [moderatorContent, setModeratorContent] = useState('');
  const [decision, setDecision] = useState<DecisionState>({ action: null, confidence: 0, summary: '' });
  const [finalOpinions, setFinalOpinions] = useState<FinalOpinionView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [expandedDebateRounds, setExpandedDebateRounds] = useState<Set<number>>(new Set());
  const [expanded1v1Rounds, setExpanded1v1Rounds] = useState<Set<number>>(new Set());
  const [expandedVoteRounds, setExpandedVoteRounds] = useState<Set<number>>(new Set());
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [showAlphaDialog, setShowAlphaDialog] = useState(false);
  const [detailModalAgent, setDetailModalAgent] = useState<AgentState | null>(null);
  // Loading & timing state
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Batch analysis state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchCodes, setBatchCodes] = useState('');
  const [batchResults, setBatchResults] = useState<Array<{
    code: string;
    name: string;
    decision: string | null;
    confidence: number;
    status: 'pending' | 'analyzing' | 'done' | 'error';
    error?: string;
  }>>([]);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const batchAbortRef = useRef<boolean>(false);

  // 阶段守卫：所有独立分析Agent完成后才显示后续阶段
  const allAgentsComplete = agents.length > 0 && agents.every(a => a.isComplete);

  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fullAnalysisRef = useRef<FullAnalysisData | null>(null);

  // Auto-expand latest round
  useEffect(() => {
    if (currentDebateRound > 0) {
      setExpandedDebateRounds((prev) => new Set([...prev, currentDebateRound]));
    }
  }, [currentDebateRound]);

  useEffect(() => {
    if (current1v1Round > 0) {
      setExpanded1v1Rounds((prev) => new Set([...prev, current1v1Round]));
    }
  }, [current1v1Round]);

  useEffect(() => {
    if (current1v1Round > 0) {
      setExpanded1v1Rounds((prev) => new Set([...prev, current1v1Round]));
    }
  }, [current1v1Round]);

  // Elapsed time timer
  useEffect(() => {
    if (!analysisStartTime || phase === 'idle' || phase === 'done') {
      if (phase === 'done') return;
      setElapsedTime(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - analysisStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [analysisStartTime, phase]);

  // Scroll to section
  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ============================================================
  // State Management
  // ============================================================

  const resetState = useCallback(() => {
    setAgents([]); setNews([]); setDataStatus(null);
    setDebateRounds([]); setCurrentDebateRound(0);
    setOneOnOneRounds([]); setCurrent1v1Round(0);
    setVoteRounds([]); setArbitrationContent('');
    setDeadlockInfo(null); setConsensusInfo(null);
    setModeratorContent(''); setDecision({ action: null, confidence: 0, summary: '' });
    setFinalOpinions([]); setError(null); setIsMockMode(false);
    setExpandedDebateRounds(new Set()); setExpanded1v1Rounds(new Set()); setExpandedVoteRounds(new Set());
    setStepsExpanded(false);
    fullAnalysisRef.current = null;
  }, []);

  const resetBatchState = useCallback(() => {
    setBatchResults([]);
    batchAbortRef.current = false;
  }, []);

  const updateAgent = useCallback((agentId: string, updates: Partial<AgentState>) => {
    setAgents((prev) => {
      const exists = prev.find((a) => a.id === agentId);
      if (exists) return prev.map((a) => (a.id === agentId ? { ...a, ...updates } : a));
      const template = getInitialAgents(market).find((a) => a.id === agentId);
      if (template) return [...prev, { ...template, ...updates }];
      return prev;
    });
  }, [market]);

  // ============================================================
  // Core SSE Analysis (extracted for reuse in single & batch)
  // ============================================================

  const runSingleAnalysis = useCallback(async (
    code: string,
    options: {
      onDecision?: (decision: { action: string | null; confidence: number; summary: string }, stockName: string) => void;
      onError?: (message: string) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<void> => {
    const { onDecision, onError } = options;

    const userApiConfig = getEffectiveConfig();

    let localDataStatus: DataStatus | null = null;
    let localMockMode = false;

    return new Promise((resolve, reject) => {
      const client = createSSEClient({
        url: '/api/analyze',
        body: { market, stockCode: code.trim(), userApiConfig },
        timeoutMs: 120000,
        heartbeatIntervalMs: 30000,
        maxRetries: 0,
        onConnect: () => {
          // Connection established
        },
        onDisconnect: () => {
          resolve();
        },
        onError: (err) => {
          if (onError) onError(err.message);
          reject(err);
        },
        onEvent: (event, data) => {
          try {
            const payload = data as Record<string, unknown>;

            switch (event) {
              case 'info':
                if (payload.mockMode === true) {
                  localMockMode = true;
                  setIsMockMode(true);
                  if (fullAnalysisRef.current) fullAnalysisRef.current.isMockMode = true;
                }
                break;

              case 'phase':
                setPhase((payload.phase as Phase) || 'analysis');
                break;

              case 'data_loaded':
                localDataStatus = payload as unknown as DataStatus;
                setDataStatus(payload as unknown as DataStatus);
                  fullAnalysisRef.current = {
                  market,
                  agents: [], debateRounds: [], oneOnOneRounds: [], voteRounds: [],
                  moderatorContent: '', decision: { action: null, confidence: 0, summary: '' },
                  finalOpinions: [], news: [], dataStatus: payload as unknown as DataStatus,
                  isMockMode: localMockMode,
                };
                break;

              case 'news_loaded': {
                const newsData = (payload.news as NewsItem[]) || [];
                setNews(newsData);
                if (fullAnalysisRef.current) {
                  fullAnalysisRef.current.news = newsData;
                }
                break;
              }

              case 'agent_start':
                updateAgent(payload.agent as string, { isActive: true, model: String(payload.model || '') });
                break;

              case 'agent_chunk':
                setAgents((prev) =>
                  prev.map((a) =>
                    a.id === payload.agent ? { ...a, content: a.content + (payload.content as string) } : a
                  )
                );
                break;

              case 'agent_status': {
                const statusData = payload as unknown as { agent: string; model: string; status: string; error?: string };
                setAgents(prev => prev.map(a => a.id === statusData.agent ? { ...a, status: statusData.status as 'success'|'fallback'|'error', statusError: statusData.error || undefined } : a));
                break;
              }

              case 'agent_complete': {
                const acPayload = payload as Record<string, unknown>;
                const agentId = String(acPayload.agent || '');
                updateAgent(agentId, {
                  isActive: false, isComplete: true,
                  stance: acPayload.stance as string, score: acPayload.score as number,
                  parsedResult: acPayload.parsedResult as ParsedResult || undefined,
                });
                // Sync to fullAnalysisRef
                if (fullAnalysisRef.current) {
                  const existingIdx = fullAnalysisRef.current.agents.findIndex((a) => a.id === agentId);
                  const agentData = {
                    id: agentId,
                    name: String(acPayload.name || ''),
                    model: String(acPayload.model || ''),
                    icon: String(acPayload.icon || ''),
                    color: String(acPayload.color || ''),
                    content: String(acPayload.content || acPayload.analysis || ''),
                    stance: String(acPayload.stance || ''),
                    score: Number(acPayload.score || 0),
                    parsedResult: acPayload.parsedResult as ParsedResult || undefined,
                    status: acPayload.status as 'success' | 'fallback' | 'error' | undefined,
                    statusError: acPayload.statusError as string | undefined,
                  };
                  if (existingIdx >= 0) {
                    fullAnalysisRef.current.agents[existingIdx] = agentData;
                  } else {
                    fullAnalysisRef.current.agents.push(agentData);
                  }
                }
                break;
              }

              case 'debate_round':
                setCurrentDebateRound(payload.round as number);
                setAgents((prev) => prev.map((a) => a.isComplete ? a : { ...a, isComplete: true, isActive: false }));
                break;

              case 'debate_moderator': {
                setDebateRounds((prev) => {
                  const updated = [...prev];
                  const roundIdx = updated.findIndex((r) => r.round === payload.round);
                  if (roundIdx === -1) {
                    updated.push({
                      round: payload.round as number,
                      moderatorMsg: payload.content as string,
                      agents: [],
                    });
                  } else {
                    updated[roundIdx].moderatorMsg = payload.content as string;
                  }
                  if (fullAnalysisRef.current) {
                    const existingRoundIdx = fullAnalysisRef.current.debateRounds.findIndex((r) => r.round === payload.round);
                    if (existingRoundIdx >= 0) {
                      fullAnalysisRef.current.debateRounds[existingRoundIdx].moderatorMsg = payload.content as string;
                    } else {
                      fullAnalysisRef.current.debateRounds.push({
                        round: payload.round as number,
                        moderatorMsg: payload.content as string,
                        agents: [],
                      });
                    }
                  }
                  return updated;
                });
                break;
              }

              case 'debate_start':
                break;

              case 'debate_chunk':
                setDebateRounds((prev) => {
                  const updated = [...prev];
                  const roundIdx = updated.findIndex((r) => r.round === payload.round);
                  if (roundIdx === -1) {
                    updated.push({
                      round: payload.round as number,
                      agents: [{
                        agentId: payload.agent as string, name: '', previousStance: '', currentStance: '',
                        changed: false, coreChangeReason: null, response: payload.content as string,
                      }],
                    });
                  } else {
                    const agentIdx = updated[roundIdx].agents.findIndex((a) => a.agentId === payload.agent);
                    if (agentIdx === -1) {
                      updated[roundIdx].agents.push({
                        agentId: payload.agent as string, name: '', previousStance: '', currentStance: '',
                        changed: false, coreChangeReason: null, response: payload.content as string,
                      });
                    } else {
                      updated[roundIdx].agents[agentIdx].response =
                        (updated[roundIdx].agents[agentIdx].response || '') + (payload.content as string);
                    }
                  }
                  return updated;
                });
                break;

              case 'debate_complete': {
                const { agent: dAgent, round: dRound, stance: dStance, changed, coreChangeReason, previousStance, parsedResult: debateParsed } = payload;
                // Always use the parsed clean response as the final text, replacing any streamed chunks
                const finalResponse = (debateParsed as ParsedResult)?.response || (debateParsed as ParsedResult)?.analysis || '';
                const debateAgentData = {
                  agentId: dAgent as string,
                  name: (payload.name as string) || '',
                  previousStance: (previousStance as string) || '',
                  currentStance: dStance as string,
                  changed: (changed as boolean) || false,
                  coreChangeReason: (coreChangeReason as string | null) || null,
                  response: finalResponse,
                  parsedResult: debateParsed as ParsedResult || undefined,
                };
                setDebateRounds((prev) => {
                  const updated = [...prev];
                  const roundIdx = updated.findIndex((r) => r.round === dRound);
                  if (roundIdx !== -1) {
                    const agentIdx = updated[roundIdx].agents.findIndex((a) => a.agentId === dAgent);
                    if (agentIdx !== -1) {
                      const ag = updated[roundIdx].agents[agentIdx];
                      ag.name = debateAgentData.name || ag.name;
                      ag.previousStance = debateAgentData.previousStance || ag.previousStance;
                      ag.currentStance = debateAgentData.currentStance;
                      ag.changed = debateAgentData.changed;
                      ag.coreChangeReason = debateAgentData.coreChangeReason;
                      if (debateAgentData.parsedResult) ag.parsedResult = debateAgentData.parsedResult;
                      // Always replace streamed content with the final parsed response to avoid duplication
                      if (finalResponse) ag.response = finalResponse;
                    } else {
                      updated[roundIdx].agents.push(debateAgentData);
                    }
                    updated[roundIdx].changedCount = updated[roundIdx].agents.filter((a) => a.changed).length;
                  } else {
                    updated.push({
                      round: dRound as number,
                      agents: [debateAgentData],
                      changedCount: debateAgentData.changed ? 1 : 0,
                    });
                  }
                  // Sync to fullAnalysisRef immediately while we have the data
                  if (fullAnalysisRef.current) {
                    const existingRoundIdx = fullAnalysisRef.current.debateRounds.findIndex((r) => r.round === dRound);
                    const roundDataForRef = {
                      round: dRound as number,
                      moderatorMsg: updated.find((r) => r.round === dRound)?.moderatorMsg,
                      agents: updated.find((r) => r.round === dRound)?.agents.map((a) => ({
                        agentId: a.agentId,
                        name: a.name,
                        previousStance: a.previousStance,
                        currentStance: a.currentStance,
                        changed: a.changed,
                        coreChangeReason: a.coreChangeReason,
                        response: a.response,
                        confidence: a.parsedResult?.confidence,
                        parsedResult: a.parsedResult,
                      })) || [],
                      changedCount: updated.find((r) => r.round === dRound)?.changedCount || 0,
                    };
                    if (existingRoundIdx >= 0) {
                      fullAnalysisRef.current.debateRounds[existingRoundIdx] = roundDataForRef;
                    } else {
                      fullAnalysisRef.current.debateRounds.push(roundDataForRef);
                    }
                  }
                  return updated;
                });
                if (changed) updateAgent(dAgent as string, { stance: dStance as string });
                break;
              }

              case 'deadlock': {
                const deadlockData = { round: payload.round as number, stances: payload.stances as Array<{ agentId: string; name: string; stance: string; confidence: number }> };
                setDeadlockInfo(deadlockData);
                if (fullAnalysisRef.current) {
                  fullAnalysisRef.current.deadlockInfo = deadlockData;
                }
                break;
              }

              case 'consensus': {
                const consensusData = { stance: payload.stance as string, message: payload.message as string };
                setConsensusInfo(consensusData);
                if (fullAnalysisRef.current) {
                  fullAnalysisRef.current.consensusInfo = consensusData;
                }
                break;
              }

              case '1v1_round':
                setCurrent1v1Round(payload.round as number);
                break;

              case '1v1_start':
                break;

              case '1v1_moderator':
                setOneOnOneRounds((prev) => {
                  const updated = [...prev];
                  const roundIdx = updated.findIndex((r) => r.round === payload.round);
                  if (roundIdx === -1) {
                    updated.push({
                      round: payload.round as number,
                      agents: [{
                        agentId: payload.agent as string, name: '', stance: '', previousStance: '',
                        changed: false, coreChangeReason: null, moderatorMsg: payload.content as string,
                      }],
                    });
                  } else {
                    const agentIdx = updated[roundIdx].agents.findIndex((a) => a.agentId === payload.agent);
                    if (agentIdx === -1) {
                      updated[roundIdx].agents.push({
                        agentId: payload.agent as string, name: '', stance: '', previousStance: '',
                        changed: false, coreChangeReason: null, moderatorMsg: payload.content as string,
                      });
                    } else {
                      updated[roundIdx].agents[agentIdx].moderatorMsg = payload.content as string;
                    }
                  }
                  return updated;
                });
                break;

              case '1v1_chunk':
                setOneOnOneRounds((prev) => {
                  const updated = [...prev];
                  const roundIdx = updated.findIndex((r) => r.round === payload.round);
                  if (roundIdx !== -1) {
                    const agentIdx = updated[roundIdx].agents.findIndex((a) => a.agentId === payload.agent);
                    if (agentIdx !== -1) {
                      updated[roundIdx].agents[agentIdx].response =
                        (updated[roundIdx].agents[agentIdx].response || '') + (payload.content as string);
                    }
                  }
                  return updated;
                });
                break;

              case '1v1_complete': {
                const { agent: v1Agent, round: v1Round, stance: v1Stance, changed: v1Changed, coreChangeReason: v1Reason, previousStance: v1Prev, parsedResult: v1Parsed } = payload;
                const v1AgentData = {
                  agentId: v1Agent as string,
                  name: (payload.name as string) || '',
                  previousStance: (v1Prev as string) || '',
                  stance: v1Stance as string,
                  changed: (v1Changed as boolean) || false,
                  coreChangeReason: (v1Reason as string | null) || null,
                  parsedResult: v1Parsed as ParsedResult || undefined,
                };
                setOneOnOneRounds((prev) => {
                  const updated = [...prev];
                  const roundIdx = updated.findIndex((r) => r.round === v1Round);
                  if (roundIdx !== -1) {
                    const agentIdx = updated[roundIdx].agents.findIndex((a) => a.agentId === v1Agent);
                    if (agentIdx !== -1) {
                      const ag = updated[roundIdx].agents[agentIdx];
                      ag.name = v1AgentData.name || ag.name;
                      ag.previousStance = v1AgentData.previousStance || ag.previousStance;
                      ag.stance = v1AgentData.stance;
                      ag.changed = v1AgentData.changed;
                      ag.coreChangeReason = v1AgentData.coreChangeReason;
                      if (v1AgentData.parsedResult) ag.parsedResult = v1AgentData.parsedResult;
                    } else {
                      updated[roundIdx].agents.push(v1AgentData);
                    }
                  } else {
                    updated.push({
                      round: v1Round as number,
                      agents: [v1AgentData],
                    });
                  }
                  // Sync to fullAnalysisRef immediately while we have the data
                  if (fullAnalysisRef.current) {
                    const existingRoundIdx = fullAnalysisRef.current.oneOnOneRounds.findIndex((r) => r.round === v1Round);
                    const roundDataForRef = {
                      round: v1Round as number,
                      agents: updated.find((r) => r.round === v1Round)?.agents.map((a) => ({
                        agentId: a.agentId,
                        name: a.name,
                        previousStance: a.previousStance || '',
                        stance: a.stance,
                        changed: a.changed,
                        coreChangeReason: a.coreChangeReason,
                        moderatorMsg: a.moderatorMsg,
                        response: a.response,
                        parsedResult: a.parsedResult,
                      })) || [],
                    };
                    if (existingRoundIdx >= 0) {
                      fullAnalysisRef.current.oneOnOneRounds[existingRoundIdx] = roundDataForRef;
                    } else {
                      fullAnalysisRef.current.oneOnOneRounds.push(roundDataForRef);
                    }
                  }
                  return updated;
                });
                if (v1Changed) updateAgent(v1Agent as string, { stance: v1Stance as string });
                break;
              }

              case 'arbitration_start':
                setArbitrationContent('');
                break;

              case 'arbitration': {
                const arbContent = payload.content as string;
                setArbitrationContent(arbContent);
                if (fullAnalysisRef.current) {
                  fullAnalysisRef.current.arbitrationContent = arbContent;
                }
                break;
              }

              case 'vote_result': {
                const voteData = {
                  round: payload.round as number,
                  type: payload.type as string,
                  votes: payload.votes as Record<string, number>,
                  totalVotes: payload.totalVotes as number,
                  threshold: payload.threshold as number,
                  agentVotes: payload.agentVotes as VoteRoundData['agentVotes'],
                };
                setVoteRounds((prev) => [...prev, voteData]);
                if (fullAnalysisRef.current) {
                  fullAnalysisRef.current.voteRounds.push(voteData);
                }
                break;
              }

              case 'moderator_start':
                setPhase('moderator');
                break;

              case 'moderator_chunk': {
                const modChunk = payload.content as string;
                setModeratorContent((prev) => prev + modChunk);
                if (fullAnalysisRef.current) {
                  fullAnalysisRef.current.moderatorContent += modChunk;
                }
                break;
              }

              case 'decision': {
                const decisionAction = (payload.action as 'BUY' | 'SELL' | 'HOLD') || null;
                const decisionSummary = String(payload.summary || '');
                setDecision({ action: decisionAction, confidence: payload.confidence as number, summary: decisionSummary });
                if (decisionSummary) {
                  setModeratorContent(decisionSummary);
                  if (fullAnalysisRef.current) fullAnalysisRef.current.moderatorContent = decisionSummary;
                }
                setFinalOpinions((payload.finalOpinions as FinalOpinionView[]) || []);
                setPhase('done');
                if (onDecision) {
                  onDecision(
                    { action: decisionAction, confidence: payload.confidence as number, summary: payload.summary as string },
                    (payload.stockName as string) || localDataStatus?.stockName || code.trim()
                  );
                }
                try {
                  const stockName = (payload.stockName as string) || localDataStatus?.stockName || code.trim();
                  const resolvedCode = String(payload.stockCode || code.trim());
                  const analysisPrice = (payload.analysisPrice as number) || localDataStatus?.prevClose || 0;
                  const agentStances = ((payload.finalOpinions as Array<Record<string, unknown>>) || []).map((op) => ({
                    agentId: String(op.agentId || ''),
                    name: String(op.name || ''),
                    initialStance: typeof op.initialStance === 'string' ? op.initialStance : undefined,
                    initialConfidence: op.initialConfidence == null ? undefined : Number(op.initialConfidence),
                    stance: String(op.stance || ''),
                    confidence: Number(op.confidence || 0),
                    changed: Boolean(op.changed),
                  }));
                  const fullAnalysis: FullAnalysisData | undefined = fullAnalysisRef.current ? {
                    ...fullAnalysisRef.current,
                    decision: { action: decisionAction, confidence: (payload.confidence as number) || 0, summary: (payload.summary as string) || '' },
                    finalOpinions: agentStances,
                    isMockMode: fullAnalysisRef.current.isMockMode,
                  } : undefined;
                  addHistoryRecord({
                    id: `${market}_${resolvedCode}_${Date.now()}`,
                    stockCode: resolvedCode,
                    stockName,
                    market,
                    currency: localDataStatus?.currency,
                    exchange: localDataStatus?.exchange,
                    framework: localDataStatus?.framework,
                    analysisDate: new Date().toISOString(),
                    analysisPrice,
                    currentPrice: null,
                    priceUpdatedAt: null,
                    agentStances,
                    finalDecision: decisionAction,
                    finalConfidence: (payload.confidence as number) || 0,
                    summary: (payload.summary as string) || '',
                    fullAnalysis,
                  });
                } catch (e) {
                  console.error('Failed to save history:', e);
                }
                break;
              }

              case 'error':
                if (onError) onError(payload.message as string);
                else setError(payload.message as string);
                break;

              case 'done':
                break;
            }
          } catch { /* skip */ }
        },
      });

      // Allow external abort via signal
      if (options.signal) {
        const abortHandler = () => {
          client.abort();
          reject(new DOMException('Aborted', 'AbortError'));
        };
        if (options.signal.aborted) {
          abortHandler();
        } else {
          options.signal.addEventListener('abort', abortHandler);
        }
      }
    });
  }, [market, updateAgent]);

  // ============================================================
  // Single Analysis Handler
  // ============================================================

  const handleAnalyze = useCallback(async () => {
    if (!isValidSecurityInput(stockCode)) return;
    resetState();
    setPhase('data_fetch');
    setAnalysisStartTime(Date.now());
    setRetryCount(0);
    setIsRetrying(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await runSingleAnalysis(stockCode.trim(), { signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '分析失败，请重试');
      setPhase('idle');
      setAnalysisStartTime(null);
    }
  }, [stockCode, resetState, runSingleAnalysis]);

  // ============================================================
  // Batch Analysis Handler
  // ============================================================

  const runBatchAnalysis = useCallback(async (
    code: string,
    index: number,
    onResult: (index: number, result: { name: string; decision: string | null; confidence: number; status: 'done' | 'error'; error?: string }) => void
  ): Promise<void> => {
    const userApiConfig = getEffectiveConfig();

    return new Promise((resolve) => {
      if (batchAbortRef.current) {
        resolve();
        return;
      }

      let localDataStatus: DataStatus | null = null;
      let stockName = code.trim();
      let finalDecision: string | null = null;
      let finalConfidence = 0;
      let fullAnalysisData: FullAnalysisData | undefined;
      let localMockMode = false;

      createSSEClient({
        url: '/api/analyze',
        body: { market, stockCode: code.trim(), userApiConfig },
        timeoutMs: 120000,
        heartbeatIntervalMs: 30000,
        maxRetries: 0,
        onConnect: () => {},
        onDisconnect: () => {
          onResult(index, { name: stockName, decision: finalDecision, confidence: finalConfidence, status: 'done' });
          resolve();
        },
        onError: (err) => {
          onResult(index, { name: stockName, decision: null, confidence: 0, status: 'error', error: err.message });
          resolve();
        },
        onEvent: (event, data) => {
          try {
            const payload = data as Record<string, unknown>;
            switch (event) {
              case 'info':
                localMockMode = payload.mockMode === true;
                if (fullAnalysisData) fullAnalysisData.isMockMode = localMockMode;
                break;
              case 'data_loaded':
                localDataStatus = payload as unknown as DataStatus;
                stockName = localDataStatus?.stockName || code.trim();
                fullAnalysisData = {
                  market,
                  agents: [], debateRounds: [], oneOnOneRounds: [], voteRounds: [],
                  moderatorContent: '', decision: { action: null, confidence: 0, summary: '' },
                  finalOpinions: [], news: [], dataStatus: localDataStatus,
                  isMockMode: false,
                };
                break;
              case 'news_loaded':
                if (fullAnalysisData) fullAnalysisData.news = (payload.news as NewsItem[]) || [];
                break;
              case 'agent_complete':
                if (fullAnalysisData) {
                  fullAnalysisData.agents.push({
                    id: String(payload.agent || ''),
                    name: String(payload.name || ''),
                    model: '', icon: '', color: '', content: '',
                    stance: String(payload.stance || ''),
                    score: Number(payload.score || 0),
                    parsedResult: payload.parsedResult as ParsedResult || undefined,
                  });
                }
                break;
              case 'debate_moderator':
                if (fullAnalysisData) {
                  const existingRound = fullAnalysisData.debateRounds.find((r) => r.round === payload.round);
                  if (existingRound) {
                    existingRound.moderatorMsg = String(payload.content || '');
                  } else {
                    fullAnalysisData.debateRounds.push({
                      round: payload.round as number,
                      moderatorMsg: String(payload.content || ''),
                      agents: [],
                    });
                  }
                }
                break;
              case 'debate_complete':
                if (fullAnalysisData) {
                  const existingRound = fullAnalysisData.debateRounds.find((r) => r.round === payload.round);
                  const agentData = {
                    agentId: payload.agent as string,
                    name: String(payload.name || ''),
                    previousStance: String(payload.previousStance || ''),
                    currentStance: String(payload.stance || ''),
                    changed: Boolean(payload.changed),
                    coreChangeReason: (payload.coreChangeReason as string) || null,
                    response: ((payload.parsedResult as ParsedResult)?.response) || '',
                    parsedResult: payload.parsedResult as ParsedResult,
                  };
                  if (!existingRound) {
                    fullAnalysisData.debateRounds.push({
                      round: payload.round as number,
                      agents: [agentData],
                      changedCount: payload.changed ? 1 : 0,
                    });
                  } else {
                    const agentIdx = existingRound.agents.findIndex((a) => a.agentId === payload.agent);
                    if (agentIdx >= 0) {
                      existingRound.agents[agentIdx] = agentData;
                    } else {
                      existingRound.agents.push(agentData);
                    }
                    existingRound.changedCount = existingRound.agents.filter((a) => a.changed).length;
                  }
                }
                break;
              case '1v1_complete':
                if (fullAnalysisData) {
                  const existingRound = fullAnalysisData.oneOnOneRounds.find((r) => r.round === payload.round);
                  if (!existingRound) {
                    fullAnalysisData.oneOnOneRounds.push({
                      round: payload.round as number,
                      agents: [{
                        agentId: payload.agent as string,
                        name: String(payload.name || ''),
                        previousStance: String(payload.previousStance || ''),
                        stance: String(payload.stance || ''),
                        changed: Boolean(payload.changed),
                        coreChangeReason: (payload.coreChangeReason as string) || null,
                        moderatorMsg: '',
                        response: ((payload.parsedResult as ParsedResult)?.response) || '',
                        parsedResult: payload.parsedResult as ParsedResult,
                      }],
                    });
                  }
                }
                break;
              case 'vote_result':
                if (fullAnalysisData) {
                  fullAnalysisData.voteRounds.push({
                    round: payload.round as number,
                    type: payload.type as string,
                    votes: payload.votes as Record<string, number>,
                    totalVotes: payload.totalVotes as number,
                    threshold: payload.threshold as number,
                    agentVotes: payload.agentVotes as VoteRoundData['agentVotes'],
                  });
                }
                break;
              case 'moderator_chunk':
                if (fullAnalysisData) {
                  fullAnalysisData.moderatorContent += (payload.content as string) || '';
                }
                break;
              case 'decision': {
                const decisionAction = (payload.action as 'BUY' | 'SELL' | 'HOLD') || null;
                finalDecision = decisionAction;
                finalConfidence = (payload.confidence as number) || 0;
                stockName = (payload.stockName as string) || localDataStatus?.stockName || stockName;
                const resolvedCode = String(payload.stockCode || code.trim());
                if (fullAnalysisData) {
                  fullAnalysisData.decision = { action: decisionAction, confidence: finalConfidence, summary: (payload.summary as string) || '' };
                  fullAnalysisData.finalOpinions = ((payload.finalOpinions as Array<Record<string, unknown>>) || []).map((op) => ({
                    agentId: String(op.agentId || ''),
                    name: String(op.name || ''),
                    initialStance: typeof op.initialStance === 'string' ? op.initialStance : undefined,
                    initialConfidence: op.initialConfidence == null ? undefined : Number(op.initialConfidence),
                    stance: String(op.stance || ''),
                    confidence: Number(op.confidence || 0),
                    changed: Boolean(op.changed),
                  }));
                }
                try {
                  const analysisPrice = (payload.analysisPrice as number) || localDataStatus?.prevClose || 0;
                  const agentStances = fullAnalysisData?.finalOpinions || [];
                  addHistoryRecord({
                    id: `${market}_${resolvedCode}_${Date.now()}`,
                    stockCode: resolvedCode,
                    stockName,
                    market,
                    currency: localDataStatus?.currency,
                    exchange: localDataStatus?.exchange,
                    framework: localDataStatus?.framework,
                    analysisDate: new Date().toISOString(),
                    analysisPrice,
                    currentPrice: null,
                    priceUpdatedAt: null,
                    agentStances,
                    finalDecision: decisionAction,
                    finalConfidence,
                    summary: (payload.summary as string) || '',
                    fullAnalysis: fullAnalysisData ? { ...fullAnalysisData, isMockMode: localMockMode } : undefined,
                  });
                } catch (e) {
                  console.error('Failed to save history:', e);
                }
                break;
              }
              case 'error':
                onResult(index, { name: stockName, decision: null, confidence: 0, status: 'error', error: payload.message as string });
                resolve();
                break;
              case 'done':
                break;
            }
          } catch { /* skip */ }
        },
      });
    });
  }, [market]);

  const handleBatchAnalyze = useCallback(async () => {
    const codes = parseBatchCodes(batchCodes, market);

    if (codes.length === 0) {
      setError('请输入有效的股票代码（每行一个或逗号分隔）');
      return;
    }

    if (codes.length > 5) {
      setError('批量分析最多支持5只股票');
      return;
    }

    resetBatchState();
    setShowBatchPanel(true);
    batchAbortRef.current = false;
    setAnalysisStartTime(Date.now());
    setRetryCount(0);
    setIsRetrying(false);

    const initialResults = codes.map((code) => ({
      code,
      name: code,
      decision: null as string | null,
      confidence: 0,
      status: 'pending' as const,
    }));
    setBatchResults(initialResults);

    // Run all analyses in parallel - each uses its own isolated SSE connection
    const analysisPromises = codes.map((code, index) => {
      return new Promise<void>((resolve) => {
        if (batchAbortRef.current) {
          resolve();
          return;
        }

        setBatchResults((prev) =>
          prev.map((r, idx) => (idx === index ? { ...r, status: 'analyzing' as const } : r))
        );

        runBatchAnalysis(code, index, (idx, result) => {
          setBatchResults((prev) =>
            prev.map((r, i) =>
              i === idx
                ? { ...r, name: result.name, decision: result.decision, confidence: result.confidence, status: result.status, error: result.error }
                : r
            )
          );
          resolve();
        }).catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            resolve();
            return;
          }
          setBatchResults((prev) =>
            prev.map((r, idx) =>
              idx === index ? { ...r, status: 'error' as const, error: err instanceof Error ? err.message : '分析失败' } : r
            )
          );
          resolve();
        });
      });
    });

    await Promise.all(analysisPromises);
  }, [batchCodes, market, resetBatchState, runBatchAnalysis]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    batchAbortRef.current = true;
    setPhase('idle');
    setAnalysisStartTime(null);
    setIsRetrying(false);
  }, []);

  const handleRetry = useCallback(async () => {
    if (retryCount >= 2) {
      setError('已达到最大重试次数，请检查网络或API配置后重试');
      return;
    }
    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);
    setError(null);
    if (isBatchMode) {
      await handleBatchAnalyze();
    } else {
      await handleAnalyze();
    }
    setIsRetrying(false);
  }, [retryCount, isBatchMode, handleAnalyze, handleBatchAnalyze]);

  // ============================================================
  // Progress Steps with scroll-to
  // ============================================================

  interface StepItem {
    key: string; label: string; icon: string; sectionId: string;
    done: boolean; active: boolean; extra?: string; isEllipsis?: boolean;
  }

  const getProgressSteps = (): StepItem[] => {
    const steps: StepItem[] = [
      { key: 'data_fetch', label: '数据获取', icon: '📡', sectionId: 'section-data', done: !['idle', 'data_fetch'].includes(phase), active: phase === 'data_fetch' },
      { key: 'analysis', label: '独立分析', icon: '🔍', sectionId: 'section-analysis', done: ['debate', '1v1', 'vote', 'moderator', 'done'].includes(phase), active: phase === 'analysis' },
    ];

    // Debate steps - show individual rounds if > 0
    if (debateRounds.length > 0) {
      const showAll = stepsExpanded || debateRounds.length <= 5;
      if (showAll) {
        for (let i = 1; i <= debateRounds.length; i++) {
          const rd = debateRounds[i - 1];
          const chCnt = rd.changedCount ?? 0;
          const isDeadlock = deadlockInfo && i === deadlockInfo.round;
          steps.push({
            key: `debate-${i}`, label: `辩论${i}`, icon: '⚔️',
            sectionId: `section-debate-${i}`,
            done: currentDebateRound > i || ['1v1', 'vote', 'moderator', 'done'].includes(phase),
            active: phase === 'debate' && currentDebateRound === i,
            extra: chCnt > 0 ? `${chCnt}人改变` : isDeadlock ? '死锁' : '无人改变',
          });
        }
      } else {
        steps.push({ key: 'debate-first', label: '辩论1', icon: '⚔️', sectionId: 'section-debate-1', done: true, active: false });
        steps.push({ key: 'debate-ellipsis', label: '...', icon: '···', sectionId: '', done: false, active: false, isEllipsis: true });
        const last3 = debateRounds.slice(-3);
        for (const rd of last3) {
          const chCnt = rd.changedCount ?? 0;
          steps.push({
            key: `debate-last-${rd.round}`, label: `辩论${rd.round}`, icon: '⚔️',
            sectionId: `section-debate-${rd.round}`,
            done: currentDebateRound > rd.round || ['1v1', 'vote', 'moderator', 'done'].includes(phase),
            active: phase === 'debate' && currentDebateRound === rd.round,
            extra: chCnt > 0 ? `${chCnt}人改变` : '',
          });
        }
      }
    } else {
      steps.push({
        key: 'debate', label: `轮询辩论${currentDebateRound > 0 ? `(${currentDebateRound}轮)` : ''}`,
        icon: '⚔️', sectionId: 'section-debate',
        done: ['1v1', 'vote', 'moderator', 'done'].includes(phase), active: phase === 'debate',
      });
    }

    if (phase === '1v1' || oneOnOneRounds.length > 0) {
      steps.push({ key: '1v1', label: `1对1沟通${current1v1Round > 0 ? `(${current1v1Round}轮)` : ''}`, icon: '🤝', sectionId: 'section-1v1', done: ['vote', 'moderator', 'done'].includes(phase), active: phase === '1v1' });
    }

    if (deadlockInfo || ['vote', 'moderator', 'done'].includes(phase) || voteRounds.length > 0) {
      steps.push({ key: 'vote', label: '投票表决', icon: '🗳️', sectionId: 'section-vote', done: ['moderator', 'done'].includes(phase), active: phase === 'vote' });
    }

    steps.push(
      { key: 'moderator', label: '主持汇总', icon: '⚖️', sectionId: 'section-decision', done: phase === 'done', active: phase === 'moderator' }
    );

    return steps;
  };

  // ============================================================
  // Render helpers
  // ============================================================

  const decisionColor = (action: string | null) => {
    return getDirectionTheme(action).text;
  };
  const decisionGlow = (action: string | null) => {
    return getDirectionTheme(action).glow;
  };
  const agentTemplates = getInitialAgents(market);
  const getAgentName = (agentId: string) => agentTemplates.find((a) => a.id === agentId)?.name || agentId;
  const getAgentIcon = (agentId: string) => agentTemplates.find((a) => a.id === agentId)?.icon || '🤖';
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };
  const validBatchCount = (() => {
    if (!batchCodes || !batchCodes.trim()) return 0;
    return parseBatchCodes(batchCodes, market).length;
  })();

  const marketDefinition = MARKET_DEFINITIONS[market];
  const popularStocks = POPULAR_STOCKS_BY_MARKET[market];

  const progressSteps = getProgressSteps();

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-terminal-bg grid-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-terminal-border/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
                <span className="text-terminal-bg font-bold text-lg font-mono">α</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gold tracking-wider">元启Alpha</h1>
                <p className="text-xs text-terminal-muted">Multi-Agent Investment Decision System</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isMockMode && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-hold/10 border border-hold/20">
                <div className="w-2 h-2 rounded-full bg-hold" />
                <span className="text-xs text-hold font-mono">模拟模式</span>
              </div>
            )}
            <Link
              href="/history"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-mono">历史战绩</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-mono">API配置</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col gap-5">
        {/* Input Section */}
        <div className="flex flex-col gap-2">
          {/* Market Framework Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-terminal-muted mr-1">市场与框架</span>
            {MARKET_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={phase !== 'idle' && phase !== 'done'}
                onClick={() => {
                  if (option.id === market) return;
                  resetState();
                  resetBatchState();
                  setMarket(option.id);
                  setStockCode('');
                  setBatchCodes('');
                  setShowBatchPanel(false);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40 ${market === option.id ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-terminal-card text-terminal-muted border border-terminal-border hover:text-foreground'}`}
              >
                {option.label}
                <span className="ml-1 text-[9px] opacity-60">{option.framework === 'alpha-agents' ? 'AlphaAgents' : 'A股框架'}</span>
              </button>
            ))}
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsBatchMode(false); setShowBatchPanel(false); }}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${!isBatchMode ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-terminal-card text-terminal-muted border border-terminal-border hover:text-foreground'}`}
            >
              单股分析
            </button>
            <button
              onClick={() => setIsBatchMode(true)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${isBatchMode ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-terminal-card text-terminal-muted border border-terminal-border hover:text-foreground'}`}
            >
              批量分析
            </button>
          </div>

          {/* Single Input */}
          {!isBatchMode && (
            <div className="flex gap-3 items-center">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gold font-mono text-sm">{marketDefinition.shortLabel}</div>
                <input
                  type="text" value={stockCode}
                  onChange={(e) => setStockCode(e.target.value.slice(0, 40))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder={marketDefinition.placeholder}
                  disabled={phase !== 'idle' && phase !== 'done'}
                  className="w-full h-12 pl-14 pr-4 bg-terminal-card border border-terminal-border rounded-lg text-foreground font-mono text-lg placeholder:text-terminal-muted/50 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 disabled:opacity-50 transition-all"
                />
              </div>
              {phase !== 'idle' && phase !== 'done' ? (
                <button onClick={handleStop} className="h-12 px-6 bg-sell/20 border border-sell/30 text-sell rounded-lg font-medium hover:bg-sell/30 transition-all">终止</button>
              ) : (
                <button onClick={handleAnalyze} disabled={!isValidSecurityInput(stockCode)} className="h-12 px-6 bg-gold/20 border border-gold/30 text-gold rounded-lg font-medium hover:bg-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all">启动分析</button>
              )}
            </div>
          )}

          {/* Batch Input */}
          {isBatchMode && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <textarea
                    value={batchCodes}
                    onChange={(e) => setBatchCodes(e.target.value)}
                    placeholder={`批量模式仅支持代码/Ticker，每行一个或逗号分隔\n如：\n${popularStocks.slice(0, 3).map((item) => item.code).join('\n')}`}
                    disabled={phase !== 'idle' && phase !== 'done'}
                    rows={4}
                    className="w-full p-3 bg-terminal-card border border-terminal-border rounded-lg text-foreground font-mono text-sm placeholder:text-terminal-muted/50 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 disabled:opacity-50 transition-all resize-none"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs font-medium ${validBatchCount > 5 ? 'text-sell' : validBatchCount > 0 ? 'text-gold' : 'text-terminal-muted'}`}>
                      {validBatchCount > 5 ? `已输入 ${validBatchCount} 只，超出限制！` : `${validBatchCount} / 5 只`}
                    </span>
                    {batchResults.length > 0 && (
                      <button
                        onClick={() => setShowBatchPanel(!showBatchPanel)}
                        className="text-[10px] text-gold hover:text-gold/80 transition"
                      >
                        {showBatchPanel ? '隐藏' : '显示'}结果面板
                      </button>
                    )}
                  </div>
                </div>
                {phase !== 'idle' && phase !== 'done' ? (
                  <button onClick={handleStop} className="h-12 px-6 bg-sell/20 border border-sell/30 text-sell rounded-lg font-medium hover:bg-sell/30 transition-all">终止</button>
                ) : (
                  <button
                    onClick={handleBatchAnalyze}
                    disabled={validBatchCount === 0 || validBatchCount > 5}
                    className="h-12 px-6 bg-gold/20 border border-gold/30 text-gold rounded-lg font-medium hover:bg-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    批量分析
                  </button>
                )}
              </div>
              {validBatchCount > 5 && (
                <div className="text-xs text-sell bg-sell/10 border border-sell/20 rounded px-3 py-2">
                  批量分析最多支持 5 只股票，请删除多余的代码
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Select Stocks */}
        <div className="flex flex-wrap gap-2 items-center">
          {popularStocks.map((stock) => (
            <button key={stock.code} onClick={() => { setStockCode(stock.code); setIsBatchMode(false); }} disabled={phase !== 'idle' && phase !== 'done'}
              className="px-3 py-1 text-xs font-mono bg-terminal-card border border-terminal-border rounded-md text-terminal-muted hover:text-gold hover:border-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              {stock.code} {stock.name}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs text-terminal-muted">
          真实分析只读取您在 API 配置中启用的 MCP 数据，并逐项显示 MCP 服务与工具来源；未配置完整模型或 MCP 时仅运行模拟模式。
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-sell/10 border border-sell/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-sell" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sell text-sm font-medium">{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetry}
                disabled={isRetrying || retryCount >= 2}
                className="px-3 py-1 rounded bg-sell/20 border border-sell/30 text-sell text-xs hover:bg-sell/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                {isRetrying ? (
                  <>
                    <div className="w-3 h-3 border border-sell/30 border-t-sell rounded-full animate-spin" />
                    重试中...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重试{retryCount > 0 ? `(${retryCount}/2)` : ''}
                  </>
                )}
              </button>
              {retryCount >= 2 && (
                <span className="text-[10px] text-terminal-muted">已达到最大重试次数</span>
              )}
            </div>
          </div>
        )}

        {/* Batch Results Panel */}
        {showBatchPanel && batchResults.length > 0 && (
          <div className="rounded-lg border border-terminal-border bg-terminal-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground">批量分析结果</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-terminal-muted">
                  {batchResults.filter(r => r.status === 'done').length}/{batchResults.length} 完成
                </span>
                <button onClick={() => setShowBatchPanel(false)} className="text-xs text-terminal-muted hover:text-foreground">关闭</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {batchResults.map((result, idx) => (
                <div
                  key={`${result.code}-${idx}`}
                  onClick={() => {
                    if (result.status === 'done') {
                      setStockCode(result.code);
                      setIsBatchMode(false);
                    }
                  }}
                  className={`p-2 rounded border text-center transition-all ${
                    result.status === 'analyzing'
                      ? 'border-gold/30 bg-gold/5'
                      : result.status === 'done'
                      ? result.decision === 'BUY'
                        ? 'border-buy/30 bg-buy/5 cursor-pointer hover:bg-buy/10'
                        : result.decision === 'SELL'
                        ? 'border-sell/30 bg-sell/5 cursor-pointer hover:bg-sell/10'
                        : 'border-hold/30 bg-hold/5 cursor-pointer hover:bg-hold/10'
                      : result.status === 'error'
                      ? 'border-sell/20 bg-sell/5'
                      : 'border-terminal-border/30 bg-terminal-bg/30'
                  }`}
                >
                  <div className="text-xs font-mono font-bold text-foreground">{result.code}</div>
                  <div className="text-[10px] text-terminal-muted truncate">{result.name}</div>
                  {result.status === 'analyzing' && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <div className="w-2 h-2 border border-gold/30 border-t-gold rounded-full animate-spin" />
                      <span className="text-[10px] text-gold">分析中</span>
                    </div>
                  )}
                  {result.status === 'done' && result.decision && (
                    <div className="mt-1">
                      <span className={`text-xs font-bold font-mono ${
                        result.decision === 'BUY' ? 'text-buy' :
                        result.decision === 'SELL' ? 'text-sell' : 'text-hold'
                      }`}>{result.decision}</span>
                      <span className="text-[10px] text-terminal-muted ml-1">{result.confidence}%</span>
                    </div>
                  )}
                  {result.status === 'error' && (
                    <div className="text-[10px] text-sell mt-1 truncate" title={result.error}>失败</div>
                  )}
                  {result.status === 'pending' && (
                    <div className="text-[10px] text-terminal-muted/50 mt-1">等待中</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Steps - Clickable */}
        {phase !== 'idle' && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {elapsedTime > 0 && (
              <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-terminal-border bg-terminal-card text-xs font-mono text-terminal-muted whitespace-nowrap mr-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatElapsedTime(elapsedTime)}</span>
              </div>
            )}
            {progressSteps.map((step, i) => {
              const isEllipsis = step.isEllipsis;
              if (isEllipsis) {
                return (
                  <button key={step.key} onClick={() => setStepsExpanded(true)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap bg-terminal-card border-terminal-border text-terminal-muted hover:text-gold hover:border-gold/30 cursor-pointer transition-all">
                    <span>···</span>
                  </button>
                );
              }
              return (
                <div key={step.key} className="flex items-center">
                  <button
                    onClick={() => step.sectionId && scrollToSection(step.sectionId)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap transition-all ${
                      step.active ? 'bg-gold/15 border-gold/40 text-gold cursor-pointer' :
                      step.done ? 'bg-buy/10 border-buy/30 text-buy cursor-pointer hover:bg-buy/15' :
                      'bg-terminal-card border-terminal-border text-terminal-muted/50 cursor-default'
                    }`}
                  >
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                    {step.extra && <span className="text-terminal-muted text-[10px]">({step.extra})</span>}
                    {step.active && <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
                    {step.done && !step.active && <span>✓</span>}
                  </button>
                  {i < progressSteps.length - 1 && <span className="text-terminal-muted/30 mx-0.5">→</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable Content Area */}
        {(dataStatus || agents.length > 0 || moderatorContent || news.length > 0) && (
          <div ref={contentRef} className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: 'calc(100vh - 320px)' }}>

            {/* ===== Data Fetch Status ===== */}
            {dataStatus && (
              <div id="section-data" className="p-3 rounded-lg border border-terminal-border/30 bg-terminal-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">📡</span>
                  <span className="text-xs font-bold text-foreground">数据来源与获取状态</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-3 text-xs font-mono">
                    <span className={isMockMode ? 'text-hold' : 'text-buy'}>
                      {isMockMode ? '△ 模拟数据（非真实市场）' : '✓ 仅使用用户 MCP 数据'}
                    </span>
                    {dataStatus.mcpStatus && !isMockMode ? (
                      <span className="text-muted-foreground">
                        已连接 {dataStatus.mcpStatus.connected}/{dataStatus.mcpStatus.configured} 个 MCP
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-terminal-muted">
                    平台不提供或背书行情、新闻、财报和研报；真实分析中的每项资料均来自下列用户 MCP 服务。
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(dataStatus.mcpStatus?.sources || []).map((source, index) => (
                      <div key={`${source.serverName}-${source.toolName}-${source.kind}-${index}`} className="rounded border border-terminal-border/40 bg-terminal-bg/50 p-2">
                        <div className="text-xs font-medium text-foreground">{source.label}</div>
                        <div className="mt-1 text-[11px] text-terminal-muted">
                          来源：{source.serverName} / {source.toolName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== News Section ===== */}
            {news.length > 0 && (
              <div id="section-news">
                <CollapsibleSection title={`实时资讯 (${news.length}条)`} icon="📡" accentColor="#3b82f6" defaultOpen={false}>
                  <div className="space-y-2 pt-2">
                  {news.map((item, i) => (
                    <div key={i} className="p-2 rounded border border-terminal-border/30 bg-terminal-bg/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gold/70">{item.date}</span>
                        {item.source && <span className="text-[10px] text-terminal-muted/50">{item.source}</span>}
                      </div>
                      <div className="text-sm text-foreground/90">{item.title}</div>
                      {item.summary && <div className="text-xs text-terminal-muted mt-1">{item.summary}</div>}
                    </div>
                  ))}
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {/* ===== Analysis Section ===== */}
            {agents.length > 0 && agents.some((a) => a.isComplete || a.isActive || a.content) && (
              <div id="section-analysis">
                <CollapsibleSection title="独立分析" icon="🔍" accentColor="#3b82f6" defaultOpen={true}
                  badge={phase === 'analysis' && <span className="text-xs text-terminal-muted animate-pulse ml-2">进行中</span>}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-2">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => agent.isComplete && setDetailModalAgent(agent)}
                      className={`rounded-lg border bg-terminal-bg/50 overflow-hidden transition-all ${agent.isActive ? 'border-gold/50' : agent.isComplete ? 'border-terminal-border/50 hover:border-gold/30 cursor-pointer' : 'border-terminal-border/30'}`}
                    >
                      <div className="px-3 py-2 border-b border-terminal-border/30 flex items-center justify-between" style={{ backgroundColor: `${agent.color}08` }}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{agent.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-foreground">{agent.name}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {agent.isActive && <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />}
                          {agent.isComplete && agent.stance && <StanceBadge stance={agent.stance} />}
                          {agent.isComplete && agent.score > 0 && <span className="text-xs font-mono text-gold">{agent.score}/10</span>}
                        </div>
                      </div>
                      <div className="p-3 max-h-60 overflow-y-auto">
                        {agent.isComplete && agent.parsedResult && agent.parsedResult.stance ? (
                          <AgentStructuredView result={agent.parsedResult} />
                        ) : agent.isActive ? (
                          <div className="flex items-center gap-2 text-terminal-muted">
                            <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                            <span className="text-xs">正在分析中，请稍候...</span>
                          </div>
                        ) : agent.isComplete && agent.content ? (
                          <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            {stripCodeBlocks(agent.content)}
                          </div>
                        ) : (
                          <div className="text-xs text-terminal-muted/50">等待分析...</div>
                        )}
                        {agent.status === 'success' && <div className="mt-1 text-xs text-green-400">✓ 模型调用成功</div>}
                        {agent.status === 'fallback' && <div className="mt-1 text-xs text-yellow-500">⚠️ 模型调用降级{agent.statusError ? `: ${agent.statusError}` : ''}</div>}
                        {agent.status === 'error' && <div className="mt-1 text-xs text-red-400">❌ 模型调用失败: {agent.statusError}</div>}
                      </div>
                      {agent.isComplete && (
                        <div className="px-3 py-1.5 border-t border-terminal-border/20 bg-terminal-border/5">
                          <span className="text-[10px] text-terminal-muted/60 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                            点击查看完整分析
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                </CollapsibleSection>
              </div>
            )}

            {/* ===== Debate Rounds (Each independently collapsible) ===== */}
            {debateRounds.length > 0 && allAgentsComplete && (
              <div id="section-debate" className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm">⚔️</span>
                  <span className="text-sm font-bold text-foreground">轮询辩论</span>
                  <span className="text-xs text-terminal-muted font-mono">共{debateRounds.length}轮</span>
                  {phase === 'debate' && <span className="text-xs text-terminal-muted animate-pulse ml-2">第{currentDebateRound}轮进行中</span>}
                </div>

                {debateRounds.map((round) => {
                  const isExpanded = expandedDebateRounds.has(round.round);
                  const chCnt = round.changedCount ?? 0;
                  const isDeadlockRound = deadlockInfo && round.round === deadlockInfo.round;
                  const roundTitle = isDeadlockRound
                    ? `第${round.round}轮 - 死锁，进入投票`
                    : chCnt > 0
                    ? `第${round.round}轮 - ${chCnt}人改变观点`
                    : `第${round.round}轮 - 无人改变`;

                  return (
                    <div key={round.round} id={`section-debate-${round.round}`} className={`rounded-lg border overflow-hidden ${isDeadlockRound ? 'border-hold/30' : 'border-purple-500/20'}`}>
                      <button
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-terminal-border/5 transition-colors"
                        onClick={() => setExpandedDebateRounds((prev) => {
                          const next = new Set(prev);
                          if (next.has(round.round)) next.delete(round.round); else next.add(round.round);
                          return next;
                        })}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-400">⚔️</span>
                          <span className={`text-xs font-bold ${isDeadlockRound ? 'text-hold' : 'text-purple-400'}`}>{roundTitle}</span>
                        </div>
                        <span className="text-xs text-terminal-muted">{isExpanded ? '▼' : '▶'}</span>
                      </button>
                      {isExpanded && (
                        <div className="p-3 space-y-2 border-t border-terminal-border/20">
                          {round.moderatorMsg && (
                            <div className="p-2 rounded border border-gold/20 bg-gold/5">
                              <span className="text-xs font-bold text-gold">⚖️ 主持人本轮提示：</span>
                              <span className="text-xs text-foreground/80 ml-1 whitespace-pre-wrap">{stripCodeBlocks(round.moderatorMsg)}</span>
                            </div>
                          )}
                          {round.agents.map((agent) => (
                            <div key={agent.agentId} className="p-2 rounded border border-terminal-border/20 bg-terminal-bg/30">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm">{getAgentIcon(agent.agentId)}</span>
                                <span className="text-xs font-bold text-foreground">{agent.name || getAgentName(agent.agentId)}</span>
                                {agent.previousStance && agent.currentStance ? (
                                  <ChangeIndicator previous={agent.previousStance} current={agent.currentStance} coreChangeReason={agent.coreChangeReason} />
                                ) : agent.currentStance ? (
                                  <StanceBadge stance={agent.currentStance} />
                                ) : null}
                              </div>
                              {(() => {
                                // Prefer parsed response (clean text) over raw streamed content (may contain JSON)
                                const displayText = agent.parsedResult?.response || agent.response;
                                return displayText ? (
                                  <div className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed mt-1">
                                    {stripCodeBlocks(displayText)}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Deadlock Notice */}
                {deadlockInfo && (
                  <div className="p-3 rounded-lg border border-hold/30 bg-hold/5">
                    <div className="text-xs font-bold text-hold mb-1">辩论第{deadlockInfo.round}轮出现死锁 - 连续3轮无人修改观点，进入最终观点投票</div>
                    <div className="flex gap-2 flex-wrap">
                      {deadlockInfo.stances.map((s) => (
                        <span key={s.agentId} className="text-xs text-terminal-muted">
                          {s.name}: <StanceBadge stance={s.stance} /> ({s.confidence}/10)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== 1v1 Communication (Each round independently collapsible) ===== */}
            {oneOnOneRounds.length > 0 && allAgentsComplete && (
              <div id="section-1v1" className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm">🤝</span>
                  <span className="text-sm font-bold text-foreground">主持人1对1沟通</span>
                  <span className="text-xs text-terminal-muted font-mono">共{oneOnOneRounds.length}轮</span>
                  {phase === '1v1' && <span className="text-xs text-terminal-muted animate-pulse ml-2">第{current1v1Round}轮进行中</span>}
                </div>

                {oneOnOneRounds.map((round) => {
                  const isExpanded = expanded1v1Rounds.has(round.round);
                  const chCnt = round.agents.filter((a) => a.changed).length;
                  return (
                    <div key={round.round} className="rounded-lg border border-gold/20 overflow-hidden">
                      <button
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-terminal-border/5 transition-colors"
                        onClick={() => setExpanded1v1Rounds((prev) => {
                          const next = new Set(prev);
                          if (next.has(round.round)) next.delete(round.round); else next.add(round.round);
                          return next;
                        })}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gold">🤝</span>
                          <span className="text-xs font-bold text-gold">第{round.round}轮 - {chCnt > 0 ? `${chCnt}人调整` : '无人调整'}</span>
                        </div>
                        <span className="text-xs text-terminal-muted">{isExpanded ? '▼' : '▶'}</span>
                      </button>
                      {isExpanded && (
                        <div className="p-3 space-y-3 border-t border-gold/10">
                          {round.agents.map((agent) => (
                            <div key={agent.agentId} className="p-2 rounded border border-terminal-border/30 bg-terminal-bg/50">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">{getAgentIcon(agent.agentId)}</span>
                                <span className="text-xs font-bold text-foreground">{agent.name || getAgentName(agent.agentId)}</span>
                                {agent.previousStance && agent.stance ? (
                                  <ChangeIndicator previous={agent.previousStance} current={agent.stance} coreChangeReason={agent.coreChangeReason} />
                                ) : agent.stance ? (
                                  <StanceBadge stance={agent.stance} />
                                ) : null}
                              </div>
                              {agent.moderatorMsg && (
                                <div className="mb-2 p-2 rounded bg-gold/5 border border-gold/10">
                                  <span className="text-xs font-bold text-gold">⚖️ 主持人：</span>
                                  <span className="text-xs text-foreground/80 ml-1">{stripCodeBlocks(agent.moderatorMsg)}</span>
                                </div>
                              )}
                              {(() => {
                                const displayText = agent.parsedResult?.response || agent.response;
                                return displayText ? (
                                  <div className="text-xs text-foreground/70 whitespace-pre-wrap">{stripCodeBlocks(displayText)}</div>
                                ) : null;
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ===== Voting (Each round independently collapsible) ===== */}
            {voteRounds.length > 0 && allAgentsComplete && (
              <div id="section-vote" className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm">🗳️</span>
                  <span className="text-sm font-bold text-foreground">投票表决</span>
                  <span className="text-xs text-terminal-muted font-mono">共{voteRounds.length}轮</span>
                  {phase === 'vote' && <span className="text-xs text-terminal-muted animate-pulse ml-2">进行中</span>}
                </div>

                {voteRounds.map((vr) => {
                  const isExpanded = expandedVoteRounds.has(vr.round);
                  const voteTheme = getDirectionTheme(getLeadingStance(vr.votes));
                  return (
                    <div key={vr.round} className={`rounded-lg border overflow-hidden ${voteTheme.borderSoft}`}>
                      <button
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-terminal-border/5 transition-colors"
                        onClick={() => setExpandedVoteRounds((prev) => {
                          const next = new Set(prev);
                          if (next.has(vr.round)) next.delete(vr.round); else next.add(vr.round);
                          return next;
                        })}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${voteTheme.text}`}>🗳️</span>
                          <span className="text-xs font-bold text-foreground">第{vr.round}轮 - {vr.type}</span>
                        </div>
                        <span className="text-xs text-terminal-muted">{isExpanded ? '▼' : '▶'}</span>
                      </button>
                      {isExpanded && (
                        <div className={`p-3 border-t ${voteTheme.divider}`}>
                          <div className="mb-2 text-[11px] text-terminal-muted">
                            使用辩论后的最终立场与置信度计算；不是独立分析阶段的原始置信度。
                          </div>
                          <VoteBar votes={vr.votes} threshold={vr.threshold} />
                          <div className="mt-3 grid gap-2 md:grid-cols-3">
                            {vr.agentVotes.map((av) => (
                              <div key={av.agentId} className="rounded border border-terminal-border/30 bg-terminal-bg/40 p-2">
                                <div className="mb-1 flex items-center gap-1.5">
                                  <span className="text-sm">{getAgentIcon(av.agentId)}</span>
                                  <span className="text-xs font-bold text-foreground">{av.name}</span>
                                  {av.changed && <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold">已调整</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-terminal-muted">
                                  <span>初始</span>
                                  {av.initialStance ? <StanceBadge stance={av.initialStance} /> : <span>-</span>}
                                  <span className="font-mono">{av.initialConfidence != null ? `${av.initialConfidence}/10` : '-'}</span>
                                  <span>→</span>
                                  <span>最终</span>
                                  <StanceBadge stance={av.stance} />
                                  <span className="font-mono text-gold">{av.confidence != null ? `${av.confidence}/10` : '-'}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-terminal-muted">
                                  投票权重 <span className="font-mono text-foreground">{av.weight.toFixed(1)}票</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Arbitration */}
                {arbitrationContent && (
                  <div className="p-3 rounded-lg border border-gold/30 bg-gold/5">
                    <div className="text-xs font-bold text-gold mb-1">⚖️ 主持人分歧整理</div>
                    <div className="text-xs text-foreground/80 whitespace-pre-wrap">{stripCodeBlocks(arbitrationContent)}</div>
                  </div>
                )}
              </div>
            )}

            {/* ===== Consensus Notice ===== */}
            {consensusInfo && (
              <div className={`p-3 rounded-lg border text-center ${getDirectionTheme(consensusInfo.stance).border} ${getDirectionTheme(consensusInfo.stance).background}`}>
                <span className={`text-sm font-bold ${getDirectionTheme(consensusInfo.stance).text}`}>{consensusInfo.message}</span>
              </div>
            )}

            {/* ===== Final Decision ===== */}
            {(moderatorContent || decision.action) && allAgentsComplete && (
              <div id="section-decision" className="animate-fade-in-up">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 bg-gold rounded-full" />
                  <h2 className="text-sm font-bold text-gold tracking-wider uppercase">最终决策</h2>
                  {phase === 'moderator' && <span className="text-xs text-terminal-muted animate-pulse">进行中</span>}
                </div>

                <div id="analysis-report">
                  {decision.action && (
                    <div className={`mb-4 rounded-xl border-2 p-6 text-center decision-reveal ${decisionGlow(decision.action)}`}
                      style={{ borderColor: getDirectionTheme(decision.action).hex }}>
                      <div className={`text-6xl font-black font-mono tracking-widest ${decisionColor(decision.action)}`}>{decision.action}</div>
                      <div className="mt-2 flex items-center justify-center gap-4">
                        <span className="text-terminal-muted text-sm">置信度</span>
                        <span className={`text-2xl font-bold font-mono ${decisionColor(decision.action)}`}>{decision.confidence}%</span>
                      </div>
                      <div className="mt-2 w-full max-w-xs mx-auto bg-terminal-border/30 rounded-full h-2">
                        <div className="h-2 rounded-full progress-fill" style={{
                          width: `${decision.confidence}%`,
                          backgroundColor: getDirectionTheme(decision.action).hex,
                        }} />
                      </div>
                      {finalOpinions.length > 0 && (
                        <div className="mt-4 flex justify-center gap-4">
                          {finalOpinions.map((op) => (
                            <div key={op.agentId} className="flex items-center gap-1.5">
                              <span className="text-sm">{getAgentIcon(op.agentId)}</span>
                              <span className="text-xs text-foreground/70">{op.name}</span>
                              <StanceBadge stance={op.stance} />
                              <span className="text-xs font-mono text-gold">{op.confidence}/10</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border border-gold/30 bg-terminal-card overflow-hidden glow-gold">
                    <div className="px-4 py-3 border-b border-terminal-border/50 flex items-center gap-2" style={{ backgroundColor: 'rgba(212, 168, 67, 0.05)' }}>
                      <span className="text-lg">⚖️</span>
                      <span className="text-sm font-bold text-gold">主持人总结</span>
                      {phase === 'moderator' && <div className="w-2 h-2 rounded-full bg-gold animate-pulse ml-auto" />}
                    </div>
                    <div className="p-4 max-h-96 overflow-y-auto">
                      <div className={`text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed ${phase === 'moderator' ? 'typing-cursor' : ''}`}>
                        {stripCodeBlocks(moderatorContent)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {agents.length === 0 && !moderatorContent && !error && phase === 'idle' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-5">
              <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center">
                <span className="text-5xl font-bold text-gold font-mono">α</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">元启Alpha</h2>
                <p className="text-terminal-muted max-w-md mx-auto">
                  多智能体投资决策系统，融合{market === 'CN' ? '基本面、消息面、资金面' : '基本面、情绪面、估值面'}三维分析，
                  通过AI Agent辩论协商机制，输出精准投资决策。
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="px-2 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[11px] font-medium">灵感源自贝莱德 AlphaAgents</span>
                <button
                  type="button"
                  onClick={() => setShowAlphaDialog(true)}
                  className="px-2 py-1 rounded-full bg-terminal-card border border-terminal-border text-terminal-muted text-[11px] hover:text-foreground hover:border-foreground/30 transition"
                >
                  了解 AlphaAgents →
                </button>
              </div>
              <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
                  <div className="text-lg mb-1">📊</div>
                  <h3 className="text-xs font-bold text-foreground mb-1">三维独立分析</h3>
                  <p className="text-[11px] text-terminal-muted leading-relaxed">
                    {market === 'CN'
                      ? '基本面、消息面、资金面三位分析师独立研判，适配 A 股市场特性'
                      : '基本面、情绪面、估值面三位分析师独立研判，复刻 AlphaAgents 框架'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
                  <div className="text-lg mb-1">⚔️</div>
                  <h3 className="text-xs font-bold text-foreground mb-1">AI 辩论协商</h3>
                  <p className="text-[11px] text-terminal-muted leading-relaxed">
                    多轮观点交锋与主持人分歧提示，充分暴露分歧、修正偏差、达成共识
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
                  <div className="text-lg mb-1">🎯</div>
                  <h3 className="text-xs font-bold text-foreground mb-1">综合决策输出</h3>
                  <p className="text-[11px] text-terminal-muted leading-relaxed">
                    共识算法确定 BUY/SELL/HOLD；主持人核对证据、保留分歧并汇总风险报告
                  </p>
                </div>
              </div>
              <div className="max-w-2xl mx-auto p-3 rounded-lg bg-terminal-card border border-gold/10">
                <h3 className="text-xs font-bold text-gold mb-2">使用流程</h3>
                <div className="flex items-center justify-center gap-2 text-[11px] text-terminal-muted flex-wrap">
                  <span className="px-2 py-1 rounded bg-terminal-bg">输入股票代码</span>
                  <span className="text-gold">→</span>
                  <span className="px-2 py-1 rounded bg-terminal-bg">获取实时数据</span>
                  <span className="text-gold">→</span>
                  <span className="px-2 py-1 rounded bg-terminal-bg">AI 分析辩论</span>
                  <span className="text-gold">→</span>
                  <span className="px-2 py-1 rounded bg-terminal-bg">输出决策</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 pb-4 text-center text-[10px] leading-relaxed text-terminal-muted/70">
        AI 分析与免费数据仅供研究参考，不构成投资建议或交易要约；请以交易所、监管机构及发行人原始披露为准。
      </footer>

      {/* AlphaAgents Dialog */}
      <Dialog open={showAlphaDialog} onOpenChange={setShowAlphaDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0a0e17] border border-terminal-border">
          <DialogHeader>
            <DialogTitle className="text-gold text-lg">关于 AlphaAgents</DialogTitle>
            <DialogDescription className="text-terminal-muted text-xs">
              贝莱德研究人员发表的多智能体投研研究
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-foreground/80">
            <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
              <h3 className="text-xs font-bold text-foreground mb-2">什么是 AlphaAgents？</h3>
              <p className="text-[11px] text-terminal-muted leading-relaxed">
                AlphaAgents 是贝莱德研究人员发表的多智能体股票研究框架，核心理念是通过<strong>专业分工、协作与对抗式讨论</strong>提升观点质量。
                论文明确说明相关观点属于作者，不代表贝莱德官方立场；其输出可作为均值方差或 Black-Litterman 等组合优化方法的输入。
              </p>
            </div>

            <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
              <h3 className="text-xs font-bold text-foreground mb-2">核心架构</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-gold mt-0.5">①</span>
                  <div>
                    <span className="text-[11px] font-bold text-foreground">LLM 认知与推理层</span>
                    <p className="text-[11px] text-terminal-muted">多智能体辩论框架（Multi-Agent Debate），各 Agent 独立分析后通过观点交锋修正偏差</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold mt-0.5">②</span>
                  <div>
                    <span className="text-[11px] font-bold text-foreground">实时数据支撑层</span>
                    <p className="text-[11px] text-terminal-muted">外部 API 与 RAG 提供市场数据、财报、新闻等实时信息注入</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold mt-0.5">③</span>
                  <div>
                    <span className="text-[11px] font-bold text-foreground">数值优化执行层</span>
                    <p className="text-[11px] text-terminal-muted">数值优化器完成资产配权计算，将定性分析转化为定量决策</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
              <h3 className="text-xs font-bold text-foreground mb-2">元启Alpha 的设计灵感</h3>
              <p className="text-[11px] text-terminal-muted leading-relaxed">
                元启Alpha 借鉴了 AlphaAgents 的<strong>多智能体辩论</strong>思想，并按市场启用两套分析框架：
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-terminal-muted">
                <li className="flex items-start gap-1.5">
                  <span className="text-gold">•</span>
                  <span>A 股：基本面/消息面/资金面，保留本土市场的政策与资金特性</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-gold">•</span>
                  <span>港美股：Fundamental/Sentiment/Valuation，按 AlphaAgents 角色框架运行</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-gold">•</span>
                  <span>多轮辩论 + 主持人证据核对机制，模拟真实投研团队的讨论过程</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-gold">•</span>
                  <span>主持人协调讨论、核对证据并汇总报告，不作为第四个投票者</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-gold">•</span>
                  <span>接入东方财富等实时数据源，确保分析基于最新市场信息</span>
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-gold/5 border border-gold/20">
              <p className="text-[11px] text-gold leading-relaxed">
                <strong>注：</strong>元启Alpha 是一个开源学习项目，与贝莱德（BlackRock）无官方关联。
                我们致力于将国际前沿的 AI 投研理念引入 A 股市场，为投资者提供创新的分析工具。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Agent Detail Modal */}
      {detailModalAgent && (
        <AgentDetailModal
          isOpen={!!detailModalAgent}
          onClose={() => setDetailModalAgent(null)}
          agentName={detailModalAgent.name}
          agentIcon={detailModalAgent.icon}
          agentColor={detailModalAgent.color}
          model={detailModalAgent.model}
          parsedResult={detailModalAgent.parsedResult}
          rawContent={detailModalAgent.content}
          status={detailModalAgent.status}
          statusError={detailModalAgent.statusError}
        />
      )}
    </div>
  );
}
