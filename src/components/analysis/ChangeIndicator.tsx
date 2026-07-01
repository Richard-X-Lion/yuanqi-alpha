'use client';

import { StanceBadge } from './StanceBadge';

interface ChangeIndicatorProps {
  previous: string;
  current: string;
  coreChangeReason: string | null;
}

export function ChangeIndicator({ previous, current, coreChangeReason }: ChangeIndicatorProps) {
  const isChanged = previous !== current;
  const stanceShort: Record<string, string> = {
    BULLISH: '看多',
    BEARISH: '看空',
    NEUTRAL: '中性',
  };

  if (!isChanged) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-terminal-muted/10 text-terminal-muted font-mono">
          坚持
        </span>
        <StanceBadge stance={current} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span className="text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold font-mono font-bold">
        {stanceShort[previous] || previous} → {stanceShort[current] || current}
      </span>
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-mono">改变</span>
      {coreChangeReason && (
        <span className="block w-full mt-1">
          <div className="mt-1.5 p-2 rounded border border-gold/30 bg-gold/5">
            <span className="text-xs font-bold text-gold">⚡ 核心转变原因：</span>
            <span className="text-xs text-foreground/80 ml-1">{coreChangeReason}</span>
          </div>
        </span>
      )}
    </span>
  );
}
