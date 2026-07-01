import assert from "node:assert/strict";
import test from "node:test";
import { confidenceToVoteWeight, resolveWeightedConsensus, stanceToAction } from "./decision";
import type { AgentOpinion } from "./types";

function opinion(stance: AgentOpinion["stance"], confidence: number, valid = true): AgentOpinion {
  return { stance, confidence, valid, reasons: [], evidence: [], reservations: "", analysis: "" };
}

test("accepts a direction only when weighted confidence reaches two thirds", () => {
  const result = resolveWeightedConsensus([
    opinion("BULLISH", 9),
    opinion("BULLISH", 8),
    opinion("BEARISH", 5),
  ]);
  assert.equal(result.stance, "BULLISH");
  assert.equal(stanceToAction(result.stance), "BUY");
});

test("keeps HOLD when no direction reaches the threshold", () => {
  const result = resolveWeightedConsensus([
    opinion("BULLISH", 7),
    opinion("BEARISH", 7),
    opinion("NEUTRAL", 7),
  ]);
  assert.equal(result.stance, null);
  assert.equal(stanceToAction(result.stance), "HOLD");
});

test("invalid agent output has no voting weight", () => {
  const result = resolveWeightedConsensus([
    opinion("BULLISH", 10, false),
    opinion("BEARISH", 8),
    opinion("BEARISH", 7),
  ]);
  assert.equal(result.stance, "BEARISH");
});

test("uses the same clamped confidence-to-vote conversion for calculation and display", () => {
  assert.equal(confidenceToVoteWeight(8), 0.8);
  assert.equal(confidenceToVoteWeight(12), 1);
  assert.equal(confidenceToVoteWeight(0), 0.1);
});
