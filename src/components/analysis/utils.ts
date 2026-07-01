// ============================================================
// Shared Utilities for Analysis Components
// ============================================================

import type { ParsedResult } from './types';
import { extractBalancedJsonObjects } from '@/lib/json';

export function stripCodeBlocks(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/```(?:json|javascript|js|python|py|text|markdown|md|html|css|bash|sh|sql|typescript|ts|yaml|yml|toml|xml|java|c|cpp|go|rs|rb|php)?\s*\n?/gi, '')
    .replace(/```/g, '');

  for (const jsonObject of extractBalancedJsonObjects(cleaned)) {
    try {
      const parsed = JSON.parse(jsonObject);
      const readable =
        parsed.response ||
        parsed.analysis ||
        (parsed.reasons && Array.isArray(parsed.reasons) ? parsed.reasons.join('\n') : '') ||
        (parsed.evidence && Array.isArray(parsed.evidence) ? parsed.evidence.join('\n') : '') ||
        cleaned;
      if (readable && typeof readable === 'string' && readable.length > 10) {
        cleaned = readable;
        break;
      }
    } catch {
      // Try the next balanced JSON object.
    }
  }

  const lines = cleaned.split('\n');
  const deduped: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !deduped.some((d) => d.trim() === trimmed)) {
      deduped.push(line);
    }
  }

  return deduped.join('\n').trim();
}

export function buildReadableSummary(result: ParsedResult): string {
  const stanceMap: Record<string, string> = {
    BULLISH: '看多',
    BEARISH: '看空',
    NEUTRAL: '中性',
    BUY: '看多',
    SELL: '看空',
    HOLD: '持有',
  };
  const lines: string[] = [];
  lines.push(
    `【立场】${stanceMap[result.stance ?? ''] || result.stance || '未知'} | 信心度 ${result.confidence ?? '?'}/10`
  );
  if (result.reasons && result.reasons.length > 0) {
    lines.push('');
    lines.push('【核心理由】');
    result.reasons.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  if (result.evidence) {
    const evEntries = Object.entries(result.evidence).filter(([, v]) => v);
    if (evEntries.length > 0) {
      lines.push('');
      lines.push('【数据支撑】');
      evEntries.forEach(([k, v]) => lines.push(`  - ${k}: ${v}`));
    }
  }
  if (result.reservation) {
    lines.push('');
    lines.push(`【保留意见】${result.reservation}`);
  }
  if (result.analysis) {
    lines.push('');
    lines.push('【详细分析】');
    lines.push(result.analysis);
  }
  return lines.join('\n');
}
