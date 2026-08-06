import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAgentWinRates,
  calculateWinRate,
  type AnalysisRecord,
} from "./history";

function record(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  return {
    id: "r1",
    stockCode: "000001",
    stockName: "Test Stock",
    analysisDate: "2026-08-01T00:00:00.000Z",
    analysisPrice: 100,
    currentPrice: null,
    priceUpdatedAt: null,
    agentStances: [],
    finalDecision: null,
    finalConfidence: 0.8,
    summary: "",
    ...overrides,
  };
}

test("empty history returns empty statistics", () => {
  const winRate = calculateWinRate([]);
  assert.equal(winRate.total, 0);
  assert.equal(winRate.buyCount, 0);
  assert.equal(winRate.sellCount, 0);
  assert.equal(winRate.holdCount, 0);
  assert.equal(winRate.winRate, null);
  assert.deepEqual(calculateAgentWinRates([]), []);
});

test("records without a current price are excluded from valid win rate", () => {
  const stats = calculateWinRate([
    record({ id: "pending", finalDecision: "BUY" }),
  ]);
  assert.equal(stats.total, 1);
  assert.equal(stats.buyCount, 1);
  assert.equal(stats.winRate, null);
});

test("BUY, SELL, and HOLD outcomes use the five percent threshold", () => {
  const stats = calculateWinRate([
    record({ id: "buy-win", currentPrice: 106, finalDecision: "BUY" }),
    record({ id: "buy-loss", currentPrice: 104, finalDecision: "BUY" }),
    record({ id: "sell-win", currentPrice: 94, finalDecision: "SELL" }),
    record({ id: "sell-loss", currentPrice: 104, finalDecision: "SELL" }),
    record({ id: "hold-win", currentPrice: 104, finalDecision: "HOLD" }),
    record({ id: "hold-loss", currentPrice: 90, finalDecision: "HOLD" }),
  ]);
  assert.equal(stats.total, 6);
  assert.equal(stats.buyCount, 2);
  assert.equal(stats.sellCount, 2);
  assert.equal(stats.holdCount, 2);
  assert.equal(stats.winRate, 50);
});

test("per-agent statistics count only priced predictions", () => {
  const rates = calculateAgentWinRates([
    record({
      id: "bullish",
      currentPrice: 106,
      finalDecision: "BUY",
      agentStances: [{ agentId: "a", name: "Analyst A", stance: "BULLISH", confidence: 0.8 }],
    }),
    record({
      id: "bearish",
      currentPrice: 94,
      finalDecision: "SELL",
      agentStances: [{ agentId: "a", name: "Analyst A", stance: "BEARISH", confidence: 0.7 }],
    }),
    record({
      id: "neutral",
      currentPrice: 104,
      finalDecision: "HOLD",
      agentStances: [{ agentId: "a", name: "Analyst A", stance: "NEUTRAL", confidence: 0.6 }],
    }),
    record({
      id: "unpriced",
      finalDecision: "BUY",
      agentStances: [{ agentId: "a", name: "Analyst A", stance: "BULLISH", confidence: 0.8 }],
    }),
  ]);

  assert.equal(rates.length, 1);
  const analyst = rates[0];
  assert.equal(analyst.agentId, "a");
  assert.equal(analyst.name, "Analyst A");
  assert.equal(analyst.totalPredictions, 3);
  assert.equal(analyst.correctPredictions, 3);
  assert.equal(analyst.winRate, 100);
  assert.equal(analyst.bullishCount, 1);
  assert.equal(analyst.bearishCount, 1);
  assert.equal(analyst.neutralCount, 1);
});

test("legacy records with missing optional fields still read safely", () => {
  const legacy = record({
    currentPrice: 106,
    finalDecision: "BUY",
    agentStances: [
      {
        agentId: "legacy-agent",
        name: "Legacy Agent",
        stance: "BULLISH",
        confidence: 0.8,
      },
    ],
  }) as AnalysisRecord;

  const rates = calculateAgentWinRates([legacy]);
  assert.equal(rates[0].agentId, "legacy-agent");
  assert.equal(rates[0].totalPredictions, 1);
  assert.equal(rates[0].correctPredictions, 1);
});
