'use client';

interface StanceBadgeProps {
  stance: string;
  size?: 'sm' | 'md';
}

export function StanceBadge({ stance, size = 'sm' }: StanceBadgeProps) {
  const config: Record<string, { text: string; color: string; bg: string }> = {
    BULLISH: { text: '看多', color: 'text-buy', bg: 'bg-buy/10' },
    BEARISH: { text: '看空', color: 'text-sell', bg: 'bg-sell/10' },
    NEUTRAL: { text: '中性', color: 'text-hold', bg: 'bg-hold/10' },
    BUY: { text: 'BUY', color: 'text-buy', bg: 'bg-buy/10' },
    SELL: { text: 'SELL', color: 'text-sell', bg: 'bg-sell/10' },
    HOLD: { text: 'HOLD', color: 'text-hold', bg: 'bg-hold/10' },
  };
  const c = config[stance] || { text: stance, color: 'text-terminal-muted', bg: 'bg-terminal-muted/10' };
  const sizeClass = size === 'md' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';
  return <span className={`${sizeClass} rounded-full font-mono font-bold ${c.color} ${c.bg}`}>{c.text}</span>;
}
