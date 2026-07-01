'use client';

import { StanceBadge } from './StanceBadge';
import { stripCodeBlocks } from './utils';
import type { ParsedResult } from './types';

interface AgentStructuredViewProps {
  result: ParsedResult;
}

export function AgentStructuredView({ result }: AgentStructuredViewProps) {
  return (
    <div className="space-y-2">
      {result.stance && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-terminal-muted">立场:</span>
          <StanceBadge stance={result.stance} />
          {result.confidence != null && (
            <span className="text-xs text-terminal-muted">
              信心度:
              <span className="ml-1 font-mono text-gold">{result.confidence}/10</span>
            </span>
          )}
        </div>
      )}
      {result.confidence != null && (
        <div className="w-full bg-terminal-border/20 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gold/70 transition-all"
            style={{ width: `${result.confidence * 10}%` }}
          />
        </div>
      )}
      {result.reasons && result.reasons.length > 0 && (
        <div>
          <span className="text-xs text-terminal-muted font-bold">分析理由:</span>
          <ul className="mt-1 space-y-1">
            {result.reasons.map((r, i) => (
              <li
                key={i}
                className="text-xs text-foreground/80 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gold/60"
              >
                {stripCodeBlocks(r)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.evidence &&
        (Array.isArray(result.evidence)
          ? result.evidence.length > 0
          : Object.keys(result.evidence).length > 0) && (
        <div>
          <span className="text-xs text-terminal-muted font-bold">数据证据:</span>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {Array.isArray(result.evidence)
              ? result.evidence.map((v, i) => (
                  <div key={i} className="text-xs bg-terminal-border/10 rounded px-2 py-1">
                    <span className="text-foreground/90 font-mono">{stripCodeBlocks(String(v))}</span>
                  </div>
                ))
              : Object.entries(result.evidence as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="text-xs bg-terminal-border/10 rounded px-2 py-1">
                    <span className="text-terminal-muted">{k}:</span>{' '}
                    <span className="text-foreground/90 font-mono">{stripCodeBlocks(String(v))}</span>
                  </div>
                ))}
          </div>
        </div>
      )}
      {result.reservation && (
        <div>
          <span className="text-xs text-terminal-muted font-bold">保留意见:</span>
          <p className="text-xs text-foreground/60 mt-0.5">{stripCodeBlocks(result.reservation)}</p>
        </div>
      )}
      {result.analysis && (
        <div>
          <span className="text-xs text-terminal-muted font-bold">详细分析:</span>
          <p className="text-xs text-foreground/80 mt-0.5 whitespace-pre-wrap leading-relaxed">
            {stripCodeBlocks(result.analysis)}
          </p>
        </div>
      )}
    </div>
  );
}
