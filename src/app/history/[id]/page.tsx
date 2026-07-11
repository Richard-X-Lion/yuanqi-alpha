'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadHistory, type AnalysisRecord } from '@/lib/history';
import { exportAsJSON, exportAsImage, exportAsPDF } from '@/lib/export';
import {
  StanceBadge,
  AgentStructuredView,
  ChangeIndicator,
  VoteBar,
  CollapsibleSection,
  stripCodeBlocks,
  AgentDetailModal,
  getDirectionTheme,
  getLeadingStance,
} from '@/components/analysis';
import type { AgentState } from '@/components/analysis';

// ============================================================
// Icons
// ============================================================

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
  );
}

// ============================================================
// Main Detail Page
// ============================================================

export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [detailModalAgent, setDetailModalAgent] = useState<AgentState | null>(null);

  useEffect(() => {
    const id = params.id as string;
    const records = loadHistory();
    const found = records.find((r) => r.id === id);
    if (found) {
      setRecord(found);
    } else {
      setNotFound(true);
    }
  }, [params.id]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">记录未找到</h1>
          <p className="text-sm text-terminal-muted mb-4">该分析记录不存在或已被删除</p>
          <button
            onClick={() => router.push('/history')}
            className="px-4 py-2 rounded-lg bg-gold/20 border border-gold/30 text-gold text-sm hover:bg-gold/30 transition"
          >
            返回历史战绩
          </button>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div className="flex items-center gap-2 text-terminal-muted">
          <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  const fa = record.fullAnalysis;
  const hasFullAnalysis = !!fa;

  const decisionColor = (action: string | null) => {
    return getDirectionTheme(action).text;
  };
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-terminal-bg grid-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-terminal-border/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/history')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition text-sm"
            >
              <ArrowLeftIcon />
              <span>返回历史</span>
            </button>
            <div className="w-px h-4 bg-border" />
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {record.stockName}
                <span className="text-terminal-muted font-normal ml-2 text-sm">({record.stockCode})</span>
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-gold/20 bg-gold/10 text-gold">{record.market === 'HK' ? '港股' : record.market === 'US' ? '美股' : 'A股'}</span>
              </h1>
              <p className="text-xs text-terminal-muted">
                分析日期: {new Date(record.analysisDate).toLocaleString('zh-CN')}
                {record.fullAnalysis?.isMockMode && <span className="ml-2 text-hold">[模拟模式]</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {record.finalDecision && (
              <div className={`text-2xl font-black font-mono ${decisionColor(record.finalDecision)}`}>
                {record.finalDecision}
              </div>
            )}
            {record.finalConfidence > 0 && (
              <div className="text-sm text-terminal-muted">
                置信度 <span className="font-mono text-gold">{record.finalConfidence}%</span>
              </div>
            )}
            {hasFullAnalysis && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const el = document.getElementById('history-analysis-report');
                    if (el) exportAsImage(el, { filename: `analysis_${record.stockCode}_${formatDate(record.analysisDate)}.png`, stockCode: record.stockCode, stockName: record.stockName });
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-terminal-muted hover:text-gold hover:bg-gold/10 border border-terminal-border hover:border-gold/20 transition"
                  title="导出图片"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  图片
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('history-analysis-report');
                    if (el) exportAsPDF(el, { filename: `analysis_${record.stockCode}_${formatDate(record.analysisDate)}.pdf`, title: `${record.stockCode} 投资分析报告`, stockCode: record.stockCode, stockName: record.stockName });
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-terminal-muted hover:text-gold hover:bg-gold/10 border border-terminal-border hover:border-gold/20 transition"
                  title="导出PDF"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF
                </button>
                <button
                  onClick={() => exportAsJSON(record, `analysis_${record.stockCode}_${formatDate(record.analysisDate)}.json`)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-terminal-muted hover:text-gold hover:bg-gold/10 border border-terminal-border hover:border-gold/20 transition"
                  title="导出JSON"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="history-analysis-report" className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 space-y-4">
        {!hasFullAnalysis && (
          <div className="p-4 rounded-lg border border-hold/30 bg-hold/5 text-center">
            <p className="text-sm text-hold">此记录创建于旧版本，仅包含最终决策摘要，无完整分析过程。</p>
          </div>
        )}

        {hasFullAnalysis && fa && (
          <>
            {/* Data Status */}
            <CollapsibleSection title="数据来源" icon="📡" accentColor="#3b82f6" defaultOpen={false}>
              <div className="flex flex-col gap-2 pt-2">
                <span className={`text-xs font-mono ${fa.isMockMode ? 'text-hold' : 'text-buy'}`}>
                  {fa.isMockMode ? '△ 平台模拟数据（非真实）' : '✓ 仅使用用户 MCP 数据'}
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(fa.dataStatus.mcpStatus?.sources || []).map((source, index) => (
                    <div key={`${source.serverName}-${source.toolName}-${source.kind}-${index}`} className="rounded border border-terminal-border/40 bg-terminal-bg/50 p-2">
                      <div className="text-xs font-medium text-foreground">{source.label}</div>
                      <div className="mt-1 text-[11px] text-terminal-muted">来源：{source.serverName} / {source.toolName}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            {/* News */}
            {fa.news.length > 0 && (
              <CollapsibleSection title={`实时资讯 (${fa.news.length}条)`} icon="📡" accentColor="#3b82f6" defaultOpen={false}>
                <div className="space-y-2 pt-2">
                  {fa.news.map((item, i) => (
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
            )}

            {/* Independent Analysis */}
            {fa.agents.length > 0 && (
              <CollapsibleSection title="独立分析" icon="🔍" accentColor="#3b82f6" defaultOpen={true}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-2">
                  {fa.agents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => setDetailModalAgent(agent as AgentState)}
                      className="rounded-lg border border-terminal-border/50 bg-terminal-bg/50 overflow-hidden hover:border-gold/30 cursor-pointer transition-all"
                    >
                      <div className="px-3 py-2 border-b border-terminal-border/30 flex items-center justify-between" style={{ backgroundColor: `${agent.color}08` }}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{agent.icon}</span>
                          <div className="text-xs font-bold text-foreground">{agent.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {agent.stance && <StanceBadge stance={agent.stance} />}
                          {agent.score > 0 && <span className="text-xs font-mono text-gold">{agent.score}/10</span>}
                        </div>
                      </div>
                      <div className="p-3 max-h-60 overflow-y-auto">
                        {agent.parsedResult ? (
                          <AgentStructuredView result={agent.parsedResult} />
                        ) : agent.content ? (
                          <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            {stripCodeBlocks(agent.content)}
                          </div>
                        ) : (
                          <div className="text-xs text-terminal-muted/50">无详细分析内容</div>
                        )}
                      </div>
                      <div className="px-3 py-1.5 border-t border-terminal-border/20 bg-terminal-border/5">
                        <span className="text-[10px] text-terminal-muted/60 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          点击查看完整分析
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Debate Rounds */}
            {fa.debateRounds.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm">⚔️</span>
                  <span className="text-sm font-bold text-foreground">轮询辩论</span>
                  <span className="text-xs text-terminal-muted font-mono">共{fa.debateRounds.length}轮</span>
                </div>
                {fa.debateRounds.map((round) => {
                  const chCnt = round.changedCount ?? 0;
                  const isDeadlockRound = fa.deadlockInfo && round.round === fa.deadlockInfo.round;
                  return (
                    <div key={round.round} className={`rounded-lg border overflow-hidden ${isDeadlockRound ? 'border-hold/30' : 'border-purple-500/20'}`}>
                      <div className="px-3 py-2 flex items-center justify-between bg-terminal-card">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-400">⚔️</span>
                          <span className={`text-xs font-bold ${isDeadlockRound ? 'text-hold' : 'text-purple-400'}`}>
                            第{round.round}轮 - {chCnt > 0 ? `${chCnt}人改变观点` : '无人改变'}
                          </span>
                        </div>
                      </div>
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
                              <span className="text-xs font-bold text-foreground">{agent.name}</span>
                              {agent.previousStance && agent.currentStance ? (
                                <ChangeIndicator previous={agent.previousStance} current={agent.currentStance} coreChangeReason={agent.coreChangeReason} />
                              ) : agent.currentStance ? (
                                <StanceBadge stance={agent.currentStance} />
                              ) : null}
                            </div>
                            {agent.response && (
                              <div className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed mt-1">
                                {stripCodeBlocks(agent.response)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {fa.deadlockInfo && (
                  <div className="p-3 rounded-lg border border-hold/30 bg-hold/5">
                    <div className="text-xs font-bold text-hold mb-1">辩论第{fa.deadlockInfo.round}轮出现死锁，进入最终观点投票</div>
                    <div className="flex gap-2 flex-wrap">
                      {fa.deadlockInfo.stances.map((s) => (
                        <span key={s.agentId} className="text-xs text-terminal-muted">
                          {s.name}: <StanceBadge stance={s.stance} /> ({s.confidence}/10)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 1v1 Communication */}
            {fa.oneOnOneRounds.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm">🤝</span>
                  <span className="text-sm font-bold text-foreground">主持人1对1沟通</span>
                  <span className="text-xs text-terminal-muted font-mono">共{fa.oneOnOneRounds.length}轮</span>
                </div>
                {fa.oneOnOneRounds.map((round) => {
                  const chCnt = round.agents.filter((a) => a.changed).length;
                  return (
                    <div key={round.round} className="rounded-lg border border-gold/20 overflow-hidden">
                      <div className="px-3 py-2 flex items-center justify-between bg-terminal-card">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gold">🤝</span>
                          <span className="text-xs font-bold text-gold">第{round.round}轮 - {chCnt > 0 ? `${chCnt}人调整` : '无人调整'}</span>
                        </div>
                      </div>
                      <div className="p-3 space-y-3 border-t border-gold/10">
                        {round.agents.map((agent) => (
                          <div key={agent.agentId} className="p-2 rounded border border-terminal-border/30 bg-terminal-bg/50">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-foreground">{agent.name}</span>
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
                            {agent.response && (
                              <div className="text-xs text-foreground/70 whitespace-pre-wrap">{stripCodeBlocks(agent.response)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Voting */}
            {fa.voteRounds.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm">🗳️</span>
                  <span className="text-sm font-bold text-foreground">投票表决</span>
                  <span className="text-xs text-terminal-muted font-mono">共{fa.voteRounds.length}轮</span>
                </div>
                {fa.voteRounds.map((vr) => {
                  const voteTheme = getDirectionTheme(getLeadingStance(vr.votes));
                  return (
                  <div key={vr.round} className={`rounded-lg border overflow-hidden ${voteTheme.borderSoft}`}>
                    <div className="px-3 py-2 flex items-center justify-between bg-terminal-card">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${voteTheme.text}`}>🗳️</span>
                        <span className="text-xs font-bold text-foreground">第{vr.round}轮 - {vr.type}</span>
                      </div>
                    </div>
                    <div className={`p-3 border-t ${voteTheme.divider}`}>
                      <div className="mb-2 text-[11px] text-terminal-muted">
                        使用辩论后的最终立场与置信度计算；不是独立分析阶段的原始置信度。
                      </div>
                      <VoteBar votes={vr.votes} threshold={vr.threshold} />
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        {vr.agentVotes.map((av) => (
                          <div key={av.agentId} className="rounded border border-terminal-border/30 bg-terminal-bg/40 p-2">
                            <div className="mb-1 flex items-center gap-1.5">
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
                  </div>
                  );
                })}
                {fa.arbitrationContent && (
                  <div className="p-3 rounded-lg border border-gold/30 bg-gold/5">
                    <div className="text-xs font-bold text-gold mb-1">⚖️ 主持人分歧整理</div>
                    <div className="text-xs text-foreground/80 whitespace-pre-wrap">{stripCodeBlocks(fa.arbitrationContent)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Consensus */}
            {fa.consensusInfo && (
              <div className={`p-3 rounded-lg border text-center ${getDirectionTheme(fa.consensusInfo.stance).border} ${getDirectionTheme(fa.consensusInfo.stance).background}`}>
                <span className={`text-sm font-bold ${getDirectionTheme(fa.consensusInfo.stance).text}`}>{fa.consensusInfo.message}</span>
              </div>
            )}

            {/* Final Decision */}
            {fa.decision.action && (
              <div className="rounded-xl border-2 p-6 text-center" style={{ borderColor: getDirectionTheme(fa.decision.action).hex }}>
                <div className={`text-6xl font-black font-mono tracking-widest ${decisionColor(fa.decision.action)}`}>
                  {fa.decision.action}
                </div>
                <div className="mt-2 flex items-center justify-center gap-4">
                  <span className="text-terminal-muted text-sm">置信度</span>
                  <span className={`text-2xl font-bold font-mono ${decisionColor(fa.decision.action)}`}>{fa.decision.confidence}%</span>
                </div>
                <div className="mt-2 w-full max-w-xs mx-auto bg-terminal-border/30 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{
                    width: `${fa.decision.confidence}%`,
                    backgroundColor: getDirectionTheme(fa.decision.action).hex,
                  }} />
                </div>
                {fa.finalOpinions.length > 0 && (
                  <div className="mt-4 flex justify-center gap-4">
                    {fa.finalOpinions.map((op) => (
                      <div key={op.agentId} className="flex items-center gap-1.5">
                        <span className="text-xs text-foreground/70">{op.name}</span>
                        <StanceBadge stance={op.stance} />
                        <span className="text-xs font-mono text-gold">{op.confidence}/10</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Moderator Summary */}
            {fa.moderatorContent && (
              <div className="rounded-lg border border-gold/30 bg-terminal-card overflow-hidden">
                <div className="px-4 py-3 border-b border-terminal-border/50 flex items-center gap-2" style={{ backgroundColor: 'rgba(212, 168, 67, 0.05)' }}>
                  <span className="text-lg">⚖️</span>
                  <span className="text-sm font-bold text-gold">主持人总结</span>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                    {stripCodeBlocks(fa.moderatorContent)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Summary for old records without fullAnalysis */}
        {!hasFullAnalysis && record.summary && (
          <div className="rounded-lg border border-gold/30 bg-terminal-card overflow-hidden">
            <div className="px-4 py-3 border-b border-terminal-border/50 flex items-center gap-2" style={{ backgroundColor: 'rgba(212, 168, 67, 0.05)' }}>
              <span className="text-lg">⚖️</span>
              <span className="text-sm font-bold text-gold">决策摘要</span>
            </div>
            <div className="p-4">
              <div className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                {stripCodeBlocks(record.summary)}
              </div>
            </div>
          </div>
        )}
      </main>

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
