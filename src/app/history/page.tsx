'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  loadHistory,
  deleteHistoryRecord,
  clearHistory,
  updateCurrentPrices,
  calculateWinRate,
  calculateAgentWinRates,
  type AnalysisRecord,
  type AgentWinRate,
} from '@/lib/history';
import { MARKET_OPTIONS, type MarketType } from '@/lib/markets/types';

// ============================================================
// Icons
// ============================================================

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}

function RefreshIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
  );
}

function ChartBarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
  );
}

// ============================================================
// Helpers
// ============================================================

function StanceBadge({ stance }: { stance: string }) {
  const config: Record<string, { text: string; color: string; bg: string }> = {
    BULLISH: { text: '看多', color: 'text-buy', bg: 'bg-buy/10' },
    BEARISH: { text: '看空', color: 'text-sell', bg: 'bg-sell/10' },
    NEUTRAL: { text: '中性', color: 'text-hold', bg: 'bg-hold/10' },
    BUY: { text: '买入', color: 'text-buy', bg: 'bg-buy/10' },
    SELL: { text: '卖出', color: 'text-sell', bg: 'bg-sell/10' },
    HOLD: { text: '持有', color: 'text-hold', bg: 'bg-hold/10' },
  };
  const c = config[stance] || { text: stance, color: 'text-terminal-muted', bg: 'bg-terminal-muted/10' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${c.color} ${c.bg}`}>{c.text}</span>;
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-xs text-terminal-muted">-</span>;
  const config: Record<string, { text: string; color: string; bg: string }> = {
    BUY: { text: 'BUY', color: 'text-buy', bg: 'bg-buy/10 border border-buy/20' },
    SELL: { text: 'SELL', color: 'text-sell', bg: 'bg-sell/10 border border-sell/20' },
    HOLD: { text: 'HOLD', color: 'text-hold', bg: 'bg-hold/10 border border-hold/20' },
  };
  const c = config[decision] || { text: decision, color: 'text-terminal-muted', bg: 'bg-terminal-muted/10' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${c.color} ${c.bg}`}>{c.text}</span>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '-';
  return price.toFixed(2);
}

// Agent color mapping
const AGENT_COLORS: Record<string, string> = {
  fundamental: '#3b82f6',
  sentiment: '#a855f7',
  capital: '#f59e0b',
};

// ============================================================
// Agent Win Rate Card
// ============================================================

function AgentWinRateCard({ agent }: { agent: AgentWinRate }) {
  const color = AGENT_COLORS[agent.agentId] || '#6b7280';
  const winRate = agent.winRate ?? 0;

  return (
    <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-foreground">{agent.name}</span>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-2xl font-bold ${winRate >= 50 ? 'text-buy' : 'text-sell'}`}>
          {agent.winRate !== null ? `${agent.winRate}%` : '-'}
        </span>
        <span className="text-[11px] text-terminal-muted">胜率</span>
      </div>

      <div className="text-[11px] text-terminal-muted mb-1.5">
        {agent.correctPredictions}/{agent.totalPredictions} 次正确
      </div>

      {/* Stance distribution bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-terminal-border/30">
        {agent.bullishCount > 0 && (
          <div
            className="bg-buy"
            style={{ width: `${(agent.bullishCount / agent.totalPredictions) * 100}%` }}
          />
        )}
        {agent.bearishCount > 0 && (
          <div
            className="bg-sell"
            style={{ width: `${(agent.bearishCount / agent.totalPredictions) * 100}%` }}
          />
        )}
        {agent.neutralCount > 0 && (
          <div
            className="bg-hold"
            style={{ width: `${(agent.neutralCount / agent.totalPredictions) * 100}%` }}
          />
        )}
      </div>
      <div className="flex gap-2 mt-1">
        {agent.bullishCount > 0 && (
          <span className="text-[10px] text-buy">看多 {agent.bullishCount}</span>
        )}
        {agent.bearishCount > 0 && (
          <span className="text-[10px] text-sell">看空 {agent.bearishCount}</span>
        )}
        {agent.neutralCount > 0 && (
          <span className="text-[10px] text-hold">中性 {agent.neutralCount}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function HistoryPage() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [marketFilter, setMarketFilter] = useState<'ALL' | MarketType>('ALL');

  useEffect(() => {
    setRecords(loadHistory());
  }, []);

  const filteredRecords = marketFilter === 'ALL'
    ? records
    : records.filter((record) => (record.market || 'CN') === marketFilter);
  const stats = calculateWinRate(filteredRecords);
  const agentWinRates = calculateAgentWinRates(filteredRecords);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('确定删除这条记录？')) return;
    deleteHistoryRecord(id);
    setRecords(loadHistory());
  }, []);

  const handleClear = useCallback(() => {
    if (!confirm('确定清空所有历史记录？此操作不可恢复。')) return;
    clearHistory();
    setRecords([]);
  }, []);

  const handleUpdatePrices = useCallback(async () => {
    setIsUpdating(true);
    try {
      const history = loadHistory();
      const needUpdate = history.filter((r) => r.analysisPrice > 0);
      if (needUpdate.length === 0) {
        alert('暂无可更新价格的有效记录');
        return;
      }

      // Fetch current prices from API
      const updates: Array<{ id: string; currentPrice: number }> = [];
      for (const record of needUpdate) {
        try {
          const res = await fetch(`/api/stock/price?market=${record.market || 'CN'}&code=${encodeURIComponent(record.stockCode)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.price) {
              updates.push({ id: record.id, currentPrice: data.price });
            }
          }
        } catch {
          // Skip failed updates
        }
      }

      if (updates.length > 0) {
        updateCurrentPrices(updates);
        setRecords(loadHistory());
      }
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition text-sm"
            >
              <ArrowLeftIcon />
              <span>返回首页</span>
            </Link>
            <div className="w-px h-4 bg-border" />
            <h1 className="text-sm font-semibold text-foreground">历史战绩</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUpdatePrices}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
            >
              <RefreshIcon />
              {isUpdating ? '更新中...' : '更新价格'}
            </button>
            {records.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-sell hover:border-sell/30 transition"
              >
                <TrashIcon />
                清空
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            type="button"
            onClick={() => setMarketFilter('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs border transition ${marketFilter === 'ALL' ? 'border-gold/40 bg-gold/15 text-gold' : 'border-border text-muted-foreground'}`}
          >
            全部市场
          </button>
          {MARKET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMarketFilter(option.id)}
              className={`px-3 py-1.5 rounded-md text-xs border transition ${marketFilter === option.id ? 'border-gold/40 bg-gold/15 text-gold' : 'border-border text-muted-foreground'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Overall Stats Cards */}
        {filteredRecords.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
              <div className="text-[11px] text-terminal-muted mb-1">总分析次数</div>
              <div className="text-xl font-bold text-foreground">{stats.total}</div>
            </div>
            <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
              <div className="text-[11px] text-terminal-muted mb-1">决策胜率</div>
              <div className={`text-xl font-bold ${stats.winRate !== null ? (stats.winRate >= 50 ? 'text-buy' : 'text-sell') : 'text-terminal-muted'}`}>
                {stats.winRate !== null ? `${stats.winRate}%` : '-'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
              <div className="text-[11px] text-terminal-muted mb-1">BUY / SELL / HOLD</div>
              <div className="text-sm font-bold text-foreground">
                <span className="text-buy">{stats.buyCount}</span>
                <span className="text-terminal-muted mx-1">/</span>
                <span className="text-sell">{stats.sellCount}</span>
                <span className="text-terminal-muted mx-1">/</span>
                <span className="text-hold">{stats.holdCount}</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-terminal-card border border-terminal-border/50">
              <div className="text-[11px] text-terminal-muted mb-1">涨跌分布</div>
              <div className="text-sm font-bold text-foreground">
                <span className="text-buy">{stats.priceUpCount}↑</span>
                <span className="text-terminal-muted mx-1">/</span>
                <span className="text-sell">{stats.priceDownCount}↓</span>
              </div>
            </div>
          </div>
        )}

        {/* Agent Win Rates */}
        {agentWinRates.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ChartBarIcon />
              <h2 className="text-sm font-semibold text-foreground">分析师胜率</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {agentWinRates.map((agent) => (
                <AgentWinRateCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {/* Records Table */}
        {filteredRecords.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-xl bg-terminal-card border border-terminal-border flex items-center justify-center mb-4">
              <TrendingUpIcon />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">暂无历史记录</h3>
            <p className="text-xs text-terminal-muted">
              完成股票分析后，记录将自动保存到这里
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition"
            >
              去分析股票
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
              const priceChange = record.currentPrice !== null
                ? record.currentPrice - record.analysisPrice
                : null;
              const priceChangePct = priceChange !== null && record.analysisPrice > 0
                ? (priceChange / record.analysisPrice) * 100
                : null;

              return (
                <div
                  key={record.id}
                  className="p-4 rounded-lg bg-terminal-card border border-terminal-border/50 hover:border-terminal-border transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {record.stockName}
                          <span className="text-terminal-muted font-normal ml-1">({record.stockCode})</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-gold/20 bg-gold/10 text-gold">{record.market === 'HK' ? '港股' : record.market === 'US' ? '美股' : 'A股'}</span>
                        </div>
                        <div className="text-[11px] text-terminal-muted mt-0.5">
                          分析日期: {formatDate(record.analysisDate)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DecisionBadge decision={record.finalDecision} />
                      <Link
                        href={`/history/${record.id}`}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-terminal-muted hover:text-gold hover:bg-gold/10 border border-transparent hover:border-gold/20 transition"
                        title="查看完整分析"
                      >
                        <EyeIcon />
                        <span className="hidden sm:inline">详情</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(record.id)}
                        className="p-1 rounded text-terminal-muted hover:text-sell transition"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {/* Agent Stances */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {record.agentStances.map((agent) => (
                      <div key={agent.agentId} className="flex items-center gap-1">
                        <span className="text-[11px] text-terminal-muted">{agent.name}:</span>
                        <StanceBadge stance={agent.stance} />
                        <span className="text-[10px] text-terminal-muted font-mono">{agent.confidence}/10</span>
                      </div>
                    ))}
                  </div>

                  {/* Price Info */}
                  <div className="flex items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="text-terminal-muted">昨日收盘价:</span>
                      <span className="font-mono text-foreground">¥{formatPrice(record.analysisPrice)}</span>
                    </div>
                    {record.currentPrice !== null ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-terminal-muted">当前价格:</span>
                          <span className="font-mono text-foreground">¥{formatPrice(record.currentPrice)}</span>
                        </div>
                        {priceChangePct !== null && (
                          <div className={`font-mono font-bold ${priceChangePct >= 0 ? 'text-buy' : 'text-sell'}`}>
                            {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-terminal-muted">当前价格: 未更新</span>
                    )}
                  </div>

                  {/* Summary */}
                  {record.summary && (
                    <div className="mt-2 text-[11px] text-terminal-muted line-clamp-2">
                      {record.summary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
