'use client';

import { getDirectionTheme } from './direction-theme';

interface VoteBarProps {
  votes: Record<string, number>;
  threshold: number;
}

export function VoteBar({ votes, threshold }: VoteBarProps) {
  const maxVote = Math.max(...Object.values(votes), threshold);
  const stanceConfig: Record<string, { label: string; color: string }> = {
    BULLISH: { label: '看多', color: getDirectionTheme('BULLISH').hex },
    BEARISH: { label: '看空', color: getDirectionTheme('BEARISH').hex },
    NEUTRAL: { label: '中性', color: getDirectionTheme('NEUTRAL').hex },
  };

  return (
    <div className="space-y-1.5">
      {Object.entries(votes).map(([stance, vote]) => {
        const cfg = stanceConfig[stance] || { label: stance, color: '#888' };
        const pct = maxVote > 0 ? (vote / maxVote) * 100 : 0;
        const thresholdPct = maxVote > 0 ? (threshold / maxVote) * 100 : 0;
        return (
          <div key={stance} className="relative">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono font-bold" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
              <span className="text-xs text-terminal-muted font-mono">{vote.toFixed(1)}票</span>
            </div>
            <div className="relative h-5 bg-terminal-border/10 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: 0.7 }}
              />
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/50" style={{ left: `${thresholdPct}%` }} />
              <div className="absolute top-0 h-full flex items-center" style={{ left: `${thresholdPct + 1}%` }}>
                <span className="text-[9px] text-white/40 whitespace-nowrap">2/3线</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
