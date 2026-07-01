'use client';

interface FlowAgent {
  id: string;
  name: string;
  icon: string;
  color: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  stance?: string;
  score?: number;
}

interface FlowPhase {
  key: string;
  label: string;
  status: 'pending' | 'active' | 'complete';
}

interface AnalysisFlowProps {
  agents: FlowAgent[];
  currentPhase: string;
  debateRound?: number;
  hasDeadlock?: boolean;
  hasConsensus?: boolean;
  isComplete?: boolean;
}

export function AnalysisFlow({
  agents,
  currentPhase,
  debateRound = 0,
  hasDeadlock = false,
  hasConsensus = false,
  isComplete = false,
}: AnalysisFlowProps) {
  const phases: FlowPhase[] = [
    { key: 'data_fetch', label: '数据获取', status: getPhaseStatus('data_fetch', currentPhase, isComplete) },
    { key: 'analysis', label: '独立分析', status: getPhaseStatus('analysis', currentPhase, isComplete) },
    { key: 'debate', label: '轮询辩论', status: getPhaseStatus('debate', currentPhase, isComplete) },
    { key: 'vote', label: '投票表决', status: getPhaseStatus('vote', currentPhase, isComplete) },
    { key: 'moderator', label: '主持汇总', status: getPhaseStatus('moderator', currentPhase, isComplete) },
  ];

  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🌊</span>
        <span className="text-xs font-bold text-foreground">分析流程可视化</span>
        {isComplete && <span className="text-[10px] text-buy ml-auto">✓ 已完成</span>}
      </div>

      {/* Phase Timeline */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between">
          {phases.map((phase, idx) => {
            const isActive = phase.status === 'active';
            const isDone = phase.status === 'complete';
            return (
              <div key={phase.key} className="flex-1 flex flex-col items-center relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div
                    className="absolute top-3 left-0 w-full h-0.5 -translate-x-1/2"
                    style={{
                      background: isDone || isActive
                        ? 'linear-gradient(to right, #d4a843, #d4a843)'
                        : 'rgba(75, 85, 99, 0.3)',
                    }}
                  />
                )}

                {/* Phase dot */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all duration-500 ${
                    isActive
                      ? 'bg-gold text-terminal-bg animate-pulse ring-2 ring-gold/30'
                      : isDone
                      ? 'bg-gold/80 text-terminal-bg'
                      : 'bg-terminal-border text-terminal-muted'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>

                {/* Phase label */}
                <span
                  className={`text-[10px] mt-1 font-mono transition-colors ${
                    isActive ? 'text-gold' : isDone ? 'text-gold/70' : 'text-terminal-muted/50'
                  }`}
                >
                  {phase.label}
                </span>

                {/* Extra info */}
                {phase.key === 'debate' && debateRound > 0 && (
                  <span className="text-[9px] text-terminal-muted mt-0.5">
                    {debateRound}轮{hasDeadlock ? '(死锁)' : hasConsensus ? '(共识)' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Status Grid */}
      <div className="grid grid-cols-3 gap-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`p-2 rounded border transition-all duration-300 ${
              agent.status === 'active'
                ? 'border-gold/40 bg-gold/5'
                : agent.status === 'complete'
                ? agent.stance === 'BUY'
                  ? 'border-buy/30 bg-buy/5'
                  : agent.stance === 'SELL'
                  ? 'border-sell/30 bg-sell/5'
                  : 'border-hold/30 bg-hold/5'
                : agent.status === 'error'
                ? 'border-sell/20 bg-sell/5'
                : 'border-terminal-border/20 bg-terminal-bg/20'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{agent.icon}</span>
              <span className="text-[10px] font-bold text-foreground">{agent.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {agent.status === 'pending' && (
                <span className="text-[10px] text-terminal-muted/50">等待中</span>
              )}
              {agent.status === 'active' && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                  <span className="text-[10px] text-gold">分析中</span>
                </>
              )}
              {agent.status === 'complete' && agent.stance && (
                <>
                  <span
                    className={`text-[10px] font-bold ${
                      agent.stance === 'BUY'
                        ? 'text-buy'
                        : agent.stance === 'SELL'
                        ? 'text-sell'
                        : 'text-hold'
                    }`}
                  >
                    {agent.stance}
                  </span>
                  {agent.score !== undefined && agent.score > 0 && (
                    <span className="text-[10px] text-gold">{agent.score}/10</span>
                  )}
                </>
              )}
              {agent.status === 'error' && (
                <span className="text-[10px] text-sell">失败</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPhaseStatus(phaseKey: string, currentPhase: string, isComplete: boolean): 'pending' | 'active' | 'complete' {
  const phaseOrder = ['data_fetch', 'analysis', 'debate', 'vote', 'moderator'];
  const currentIdx = phaseOrder.indexOf(currentPhase);
  const phaseIdx = phaseOrder.indexOf(phaseKey);

  if (isComplete) return 'complete';
  if (phaseIdx === currentIdx) return 'active';
  if (phaseIdx < currentIdx) return 'complete';
  return 'pending';
}
