// ============================================================
// Shared Types for Analysis Components
// ============================================================

import type { MarketType } from '@/lib/markets/types';

export interface ParsedResult {
  stance?: string;
  confidence?: number;
  reasons?: string[];
  evidence?: string[] | Record<string, string>;
  reservation?: string;
  coreChangeReason?: string;
  analysis?: string;
  response?: string;
}

export interface AgentState {
  id: string;
  name: string;
  model: string;
  icon: string;
  color: string;
  content: string;
  stance: string;
  score: number;
  isActive: boolean;
  isComplete: boolean;
  parsedResult?: ParsedResult;
  status?: 'success' | 'fallback' | 'error';
  statusError?: string;
}

export interface DebateRoundAgent {
  agentId: string;
  name: string;
  previousStance: string;
  currentStance: string;
  changed: boolean;
  coreChangeReason: string | null;
  response?: string;
  confidence?: number;
  parsedResult?: ParsedResult;
}

export interface DebateRound {
  round: number;
  agents: DebateRoundAgent[];
  moderatorMsg?: string;
  changedCount?: number;
}

export interface OneOnOneRoundAgent {
  agentId: string;
  name: string;
  previousStance?: string;
  stance: string;
  changed: boolean;
  coreChangeReason: string | null;
  moderatorMsg?: string;
  response?: string;
  parsedResult?: ParsedResult;
}

export interface OneOnOneRound {
  round: number;
  agents: OneOnOneRoundAgent[];
}

export interface VoteRoundData {
  round: number;
  type: string;
  votes: Record<string, number>;
  totalVotes: number;
  threshold: number;
  agentVotes: Array<{
    agentId: string;
    name: string;
    initialStance?: string;
    initialConfidence?: number;
    stance: string;
    confidence?: number;
    changed?: boolean;
    weight: number;
  }>;
}

export interface DecisionState {
  action: 'BUY' | 'SELL' | 'HOLD' | null;
  confidence: number;
  summary: string;
}

export interface NewsItem {
  title: string;
  date: string;
  summary: string;
  source?: string;
}

export interface DataStatus {
  marketData: boolean;
  financialData: boolean;
  filingEvidenceCount?: number;
  financialSource?: string;
  newsCount: number;
  fundFlowData: boolean;
  priceHistoryData?: boolean;
  stockName?: string;
  prevClose?: number;
  market?: MarketType;
  marketLabel?: string;
  currency?: string;
  exchange?: string;
  framework?: string;
  mcpStatus?: {
    enabled: boolean;
    connected: number;
    failed: number;
    dataTypes: string[];
  };
}

export type Phase = 'idle' | 'data_fetch' | 'news' | 'analysis' | 'debate' | '1v1' | 'vote' | 'moderator' | 'done';

export const INITIAL_AGENTS: AgentState[] = [
  { id: 'fundamental', name: '基本面分析师', model: 'DeepSeek Chat', icon: '📊', color: '#3b82f6', content: '', stance: '', score: 0, isActive: false, isComplete: false },
  { id: 'sentiment', name: '情绪面分析师', model: 'Qwen Plus', icon: '🗣️', color: '#a855f7', content: '', stance: '', score: 0, isActive: false, isComplete: false },
  { id: 'capital', name: '资金面分析师', model: 'DeepSeek V4 Flash', icon: '💰', color: '#f59e0b', content: '', stance: '', score: 0, isActive: false, isComplete: false },
];

export const GLOBAL_INITIAL_AGENTS: AgentState[] = [
  { id: 'fundamental', name: 'Fundamental Agent', model: 'DeepSeek', icon: '📊', color: '#3b82f6', content: '', stance: '', score: 0, isActive: false, isComplete: false },
  { id: 'sentiment', name: 'Sentiment Agent', model: 'Qwen Plus', icon: '🗣️', color: '#a855f7', content: '', stance: '', score: 0, isActive: false, isComplete: false },
  { id: 'capital', name: 'Valuation Agent', model: 'DeepSeek', icon: '📈', color: '#f59e0b', content: '', stance: '', score: 0, isActive: false, isComplete: false },
];

export function getInitialAgents(market: MarketType): AgentState[] {
  return market === 'CN' ? INITIAL_AGENTS : GLOBAL_INITIAL_AGENTS;
}
