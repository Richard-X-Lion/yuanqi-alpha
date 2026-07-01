'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StanceBadge } from './StanceBadge';
import { stripCodeBlocks } from './utils';
import type { ParsedResult } from './types';

interface AgentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  model?: string;
  parsedResult?: ParsedResult;
  rawContent?: string;
  status?: 'success' | 'fallback' | 'error';
  statusError?: string;
}

export function AgentDetailModal({
  isOpen,
  onClose,
  agentName,
  agentIcon,
  agentColor,
  model,
  parsedResult,
  rawContent,
  status,
  statusError,
}: AgentDetailModalProps) {
  const hasStructuredData = parsedResult && parsedResult.stance;
  const displayContent = rawContent || parsedResult?.analysis || '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden bg-[#0a0e17] border border-terminal-border p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-terminal-border/50" style={{ backgroundColor: `${agentColor}10` }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{agentIcon}</span>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {agentName}
              </DialogTitle>
              {model && (
                <p className="text-xs text-terminal-muted mt-0.5">
                  {model}
                </p>
              )}
            </div>
            {parsedResult?.stance && (
              <div className="ml-auto">
                <StanceBadge stance={parsedResult.stance} size="md" />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {/* Status Badge */}
          {status && (
            <div className="mb-4">
              {status === 'success' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs">
                  ✓ 模型调用成功
                </span>
              )}
              {status === 'fallback' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 text-xs">
                  ⚠️ 模型调用降级{statusError ? `: ${statusError}` : ''}
                </span>
              )}
              {status === 'error' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs">
                  ❌ 模型调用失败: {statusError}
                </span>
              )}
            </div>
          )}

          {/* Confidence Score */}
          {parsedResult?.confidence != null && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-terminal-muted">信心度</span>
                <span className="text-lg font-mono font-bold" style={{ color: agentColor }}>
                  {parsedResult.confidence}/10
                </span>
              </div>
              <div className="w-full bg-terminal-border/20 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${parsedResult.confidence * 10}%`, backgroundColor: agentColor }}
                />
              </div>
            </div>
          )}

          {/* Structured Content */}
          {hasStructuredData && (
            <div className="space-y-5">
              {/* Reasons */}
              {parsedResult.reasons && parsedResult.reasons.length > 0 && (
                <section>
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full" style={{ backgroundColor: agentColor }} />
                    分析理由
                  </h4>
                  <ul className="space-y-2">
                    {parsedResult.reasons.map((r, i) => (
                      <li
                        key={i}
                        className="text-sm text-foreground/80 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gold/60"
                      >
                        {stripCodeBlocks(r)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Evidence */}
              {parsedResult.evidence &&
                (Array.isArray(parsedResult.evidence)
                  ? parsedResult.evidence.length > 0
                  : Object.keys(parsedResult.evidence).length > 0) && (
                <section>
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full" style={{ backgroundColor: agentColor }} />
                    数据证据
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.isArray(parsedResult.evidence)
                      ? parsedResult.evidence.map((v, i) => (
                          <div key={i} className="text-sm bg-terminal-border/10 rounded px-3 py-2">
                            <span className="text-foreground/90 font-mono">{stripCodeBlocks(String(v))}</span>
                          </div>
                        ))
                      : Object.entries(parsedResult.evidence as Record<string, string>).map(([k, v]) => (
                          <div key={k} className="text-sm bg-terminal-border/10 rounded px-3 py-2">
                            <span className="text-terminal-muted">{k}:</span>{' '}
                            <span className="text-foreground/90 font-mono">{stripCodeBlocks(String(v))}</span>
                          </div>
                        ))}
                  </div>
                </section>
              )}

              {/* Reservations */}
              {parsedResult.reservation && (
                <section>
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full" style={{ backgroundColor: agentColor }} />
                    保留意见
                  </h4>
                  <p className="text-sm text-foreground/60 bg-terminal-border/5 rounded px-3 py-2">
                    {stripCodeBlocks(parsedResult.reservation)}
                  </p>
                </section>
              )}

              {/* Detailed Analysis */}
              {parsedResult.analysis && (
                <section>
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full" style={{ backgroundColor: agentColor }} />
                    详细分析
                  </h4>
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed bg-terminal-border/5 rounded px-4 py-3">
                    {stripCodeBlocks(parsedResult.analysis)}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Raw Content (if no structured data or as fallback) */}
          {!hasStructuredData && displayContent && (
            <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {stripCodeBlocks(displayContent)}
            </div>
          )}

          {/* Empty State */}
          {!hasStructuredData && !displayContent && (
            <div className="text-center py-8 text-terminal-muted">
              <p>暂无分析内容</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
