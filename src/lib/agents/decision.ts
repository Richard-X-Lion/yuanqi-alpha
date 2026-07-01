import type { AgentOpinion } from "./types";

export type DecidableStance = "BULLISH" | "BEARISH" | "NEUTRAL";
export type DecisionAction = "BUY" | "SELL" | "HOLD";

export function stanceToAction(stance: DecidableStance | null): DecisionAction {
  if (stance === "BULLISH") return "BUY";
  if (stance === "BEARISH") return "SELL";
  return "HOLD";
}

export function confidenceToVoteWeight(confidence: number): number {
  return Math.min(10, Math.max(1, confidence)) / 10;
}

export function resolveWeightedConsensus(
  opinions: AgentOpinion[],
  thresholdRatio = 2 / 3,
): {
  stance: DecidableStance | null;
  votes: Record<DecidableStance, number>;
  totalVotes: number;
  threshold: number;
} {
  const votes: Record<DecidableStance, number> = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };

  for (const opinion of opinions) {
    if (!opinion.valid || opinion.stance === "UNKNOWN") continue;
    votes[opinion.stance] += confidenceToVoteWeight(opinion.confidence);
  }

  const totalVotes = Object.values(votes).reduce((sum, vote) => sum + vote, 0);
  const threshold = totalVotes * thresholdRatio;
  const winners = Object.entries(votes)
    .filter(([, vote]) => vote >= threshold && vote > 0)
    .sort(([, left], [, right]) => right - left);

  return {
    stance: (winners[0]?.[0] as DecidableStance | undefined) ?? null,
    votes,
    totalVotes,
    threshold,
  };
}
