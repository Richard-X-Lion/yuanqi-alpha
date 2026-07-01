// History record types and localStorage utilities

import type { MarketType } from "@/lib/markets/types";

export interface AgentStanceRecord {
  agentId: string;
  name: string;
  initialStance?: string;
  initialConfidence?: number;
  stance: string;
  confidence: number;
  changed?: boolean;
}

// ============================================================
// Full Analysis Data (for detail view)
// ============================================================

export interface FullAgentAnalysis {
  id: string;
  name: string;
  model: string;
  icon: string;
  color: string;
  content: string;
  stance: string;
  score: number;
  parsedResult?: {
    stance?: string;
    confidence?: number;
    reasons?: string[];
    evidence?: string[] | Record<string, string>;
    reservation?: string;
    coreChangeReason?: string;
    analysis?: string;
    response?: string;
  };
  status?: 'success' | 'fallback' | 'error';
  statusError?: string;
}

export interface FullDebateRoundAgent {
  agentId: string;
  name: string;
  previousStance: string;
  currentStance: string;
  changed: boolean;
  coreChangeReason: string | null;
  response?: string;
  confidence?: number;
  parsedResult?: FullAgentAnalysis['parsedResult'];
}

export interface FullDebateRound {
  round: number;
  agents: FullDebateRoundAgent[];
  moderatorMsg?: string;
  changedCount?: number;
}

export interface FullOneOnOneRoundAgent {
  agentId: string;
  name: string;
  previousStance?: string;
  stance: string;
  changed: boolean;
  coreChangeReason: string | null;
  moderatorMsg?: string;
  response?: string;
  parsedResult?: FullAgentAnalysis['parsedResult'];
}

export interface FullOneOnOneRound {
  round: number;
  agents: FullOneOnOneRoundAgent[];
}

export interface FullVoteRound {
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

export interface FullNewsItem {
  title: string;
  date: string;
  summary: string;
  source?: string;
}

export interface FullDataStatus {
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

export interface FullAnalysisData {
  market?: MarketType;
  agents: FullAgentAnalysis[];
  debateRounds: FullDebateRound[];
  oneOnOneRounds: FullOneOnOneRound[];
  voteRounds: FullVoteRound[];
  moderatorContent: string;
  decision: {
    action: 'BUY' | 'SELL' | 'HOLD' | null;
    confidence: number;
    summary: string;
  };
  finalOpinions: AgentStanceRecord[];
  news: FullNewsItem[];
  dataStatus: FullDataStatus;
  isMockMode: boolean;
  consensusInfo?: { stance: string; message: string } | null;
  deadlockInfo?: { round: number; stances: Array<{ agentId: string; name: string; stance: string; confidence: number }> } | null;
  arbitrationContent?: string;
}

export interface AnalysisRecord {
  id: string;
  stockCode: string;
  stockName: string;
  market?: MarketType;
  currency?: string;
  exchange?: string;
  framework?: string;
  analysisDate: string;
  /** 昨日收盘价 */
  analysisPrice: number;
  currentPrice: number | null;
  priceUpdatedAt: string | null;
  agentStances: AgentStanceRecord[];
  finalDecision: 'BUY' | 'SELL' | 'HOLD' | null;
  finalConfidence: number;
  summary: string;
  fullAnalysis?: FullAnalysisData; // 完整分析过程（可选，兼容旧数据）
}

const HISTORY_STORAGE_KEY = "yuanqi_alpha_history";

export function loadHistory(): AnalysisRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalysisRecord[];
  } catch {
    return [];
  }
}

export function saveHistory(records: AnalysisRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records));
}

export function addHistoryRecord(record: AnalysisRecord): void {
  const history = loadHistory();
  const recordDay = record.analysisDate.slice(0, 10);
  // Prevent duplicates: check if same stock on same day already exists
  const sameDayRecord = history.find(
    (r) => (r.market || "CN") === (record.market || "CN") && r.stockCode === record.stockCode && r.analysisDate.slice(0, 10) === recordDay
  );
  if (sameDayRecord) {
    // Replace existing record for same day
    const updated = history.map((r) =>
      (r.market || "CN") === (record.market || "CN") && r.stockCode === record.stockCode && r.analysisDate.slice(0, 10) === recordDay ? record : r
    );
    saveHistory(updated);
  } else {
    saveHistory([record, ...history]);
  }
}

export function deleteHistoryRecord(id: string): void {
  const history = loadHistory();
  saveHistory(history.filter((r) => r.id !== id));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
}

export function updateCurrentPrices(
  updates: Array<{ id: string; currentPrice: number }>
): void {
  const history = loadHistory();
  const updated = history.map((r) => {
    const update = updates.find((u) => u.id === r.id);
    if (update) {
      return {
        ...r,
        currentPrice: update.currentPrice,
        priceUpdatedAt: new Date().toISOString(),
      };
    }
    return r;
  });
  saveHistory(updated);
}

// ============================================================
// Overall Win Rate (based on final decision)
// ============================================================

export function calculateWinRate(records: AnalysisRecord[]): {
  total: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  priceUpCount: number;
  priceDownCount: number;
  winRate: number | null;
} {
  const completed = records.filter((r) => r.currentPrice !== null && r.finalDecision !== null);

  let winCount = 0;
  let totalValid = 0;

  for (const r of completed) {
    const priceChange = r.currentPrice! - r.analysisPrice;
    const priceChangePct = r.analysisPrice > 0 ? priceChange / r.analysisPrice : 0;

    if (r.finalDecision === 'BUY') {
      totalValid++;
      if (priceChangePct > 0.05) winCount++;
    } else if (r.finalDecision === 'SELL') {
      totalValid++;
      if (priceChangePct < -0.05) winCount++;
    } else if (r.finalDecision === 'HOLD') {
      totalValid++;
      if (Math.abs(priceChangePct) <= 0.05) winCount++;
    }
  }

  return {
    total: records.length,
    buyCount: records.filter((r) => r.finalDecision === 'BUY').length,
    sellCount: records.filter((r) => r.finalDecision === 'SELL').length,
    holdCount: records.filter((r) => r.finalDecision === 'HOLD').length,
    priceUpCount: completed.filter((r) => r.currentPrice! > r.analysisPrice).length,
    priceDownCount: completed.filter((r) => r.currentPrice! < r.analysisPrice).length,
    winRate: totalValid > 0 ? Math.round((winCount / totalValid) * 100) : null,
  };
}

// ============================================================
// Per-Agent Win Rate
// ============================================================

export interface AgentWinRate {
  agentId: string;
  name: string;
  totalPredictions: number;
  correctPredictions: number;
  winRate: number | null;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}

/**
 * Calculate win rate for each individual analyst.
 *
 * Rules (with 5% threshold):
 * - BULLISH = predict price goes up (win if priceChangePct > +5%)
 * - BEARISH = predict price goes down (win if priceChangePct < -5%)
 * - NEUTRAL = predict price stays flat (win if |priceChangePct| <= 5%)
 */
export function calculateAgentWinRates(records: AnalysisRecord[]): AgentWinRate[] {
  if (records.length === 0) return [];

  // Collect stats per agent
  const stats: Record<string, {
    name: string;
    total: number;
    correct: number;
    bullish: number;
    bearish: number;
    neutral: number;
  }> = {};

  for (const r of records) {
    // Only calculate win/loss if we have current price and analysis price
    const hasPrice = r.currentPrice !== null && r.analysisPrice > 0;
    const priceChangePct = hasPrice ? (r.currentPrice! - r.analysisPrice) / r.analysisPrice : 0;

    for (const agent of r.agentStances) {
      if (!stats[agent.agentId]) {
        stats[agent.agentId] = {
          name: agent.name,
          total: 0,
          correct: 0,
          bullish: 0,
          bearish: 0,
          neutral: 0,
        };
      }

      const s = stats[agent.agentId];
      if (!hasPrice) continue;
      s.total++;

      const stance = agent.stance.toUpperCase();
      if (stance === 'BULLISH') {
        s.bullish++;
        if (hasPrice && priceChangePct > 0.05) s.correct++;
      } else if (stance === 'BEARISH') {
        s.bearish++;
        if (hasPrice && priceChangePct < -0.05) s.correct++;
      } else {
        // NEUTRAL or HOLD — correct if within ±5%
        s.neutral++;
        if (hasPrice && Math.abs(priceChangePct) <= 0.05) s.correct++;
      }
    }
  }

  return Object.entries(stats).map(([agentId, s]) => ({
    agentId,
    name: s.name,
    totalPredictions: s.total,
    correctPredictions: s.correct,
    winRate: s.total > 0 ? Math.round((s.correct / s.total) * 100) : null,
    bullishCount: s.bullish,
    bearishCount: s.bearish,
    neutralCount: s.neutral,
  }));
}
