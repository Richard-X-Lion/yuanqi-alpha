export interface DirectionTheme {
  text: string;
  background: string;
  border: string;
  borderSoft: string;
  divider: string;
  glow: string;
  hex: string;
}

const BUY_THEME: DirectionTheme = {
  text: 'text-buy', background: 'bg-buy/5', border: 'border-buy/30', borderSoft: 'border-buy/20',
  divider: 'border-buy/10', glow: 'glow-buy', hex: '#ff1744',
};
const SELL_THEME: DirectionTheme = {
  text: 'text-sell', background: 'bg-sell/5', border: 'border-sell/30', borderSoft: 'border-sell/20',
  divider: 'border-sell/10', glow: 'glow-sell', hex: '#00c853',
};
const HOLD_THEME: DirectionTheme = {
  text: 'text-hold', background: 'bg-hold/5', border: 'border-hold/30', borderSoft: 'border-hold/20',
  divider: 'border-hold/10', glow: 'glow-hold', hex: '#ffc107',
};

export function getDirectionTheme(direction: string | null | undefined): DirectionTheme {
  if (direction === 'BUY' || direction === 'BULLISH') return BUY_THEME;
  if (direction === 'SELL' || direction === 'BEARISH') return SELL_THEME;
  return HOLD_THEME;
}

export function getLeadingStance(votes: Record<string, number>): string {
  const sorted = Object.entries(votes).sort((left, right) => right[1] - left[1]);
  if (!sorted.length || (sorted[1] && sorted[0][1] === sorted[1][1])) return 'NEUTRAL';
  return sorted[0][0];
}
