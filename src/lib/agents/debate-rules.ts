export const MAX_DEBATE_ROUNDS = 10;
export const DEADLOCK_THRESHOLD = 3;

export function nextNoChangeStreak(currentStreak: number, changedCount: number): number {
  return changedCount > 0 ? 0 : currentStreak + 1;
}

export function hasDebateDeadlock(noChangeStreak: number): boolean {
  return noChangeStreak >= DEADLOCK_THRESHOLD;
}
