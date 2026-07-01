import assert from "node:assert/strict";
import test from "node:test";
import { extractStance, parseAgentResponse } from "./parser";

test("parses a valid structured opinion", () => {
  const result = parseAgentResponse(JSON.stringify({
    stance: "BULLISH",
    confidence: 8,
    reasons: ["盈利增长"],
    evidence: ["利润同比增长20%"],
    reservations: "估值偏高",
    analysis: "基于已提供数据。",
  }));

  assert.equal(result.valid, true);
  assert.equal(result.stance, "BULLISH");
  assert.equal(result.confidence, 8);
});

test("does not turn malformed output into a neutral vote", () => {
  const result = parseAgentResponse("调用失败");
  assert.equal(result.valid, false);
  assert.equal(result.stance, "UNKNOWN");
  assert.equal(result.confidence, 0);
});

test("rejects ambiguous fallback prose", () => {
  const prose = "这段材料同时讨论看多和看空两种可能，但没有给出明确的最终立场，因此不应被系统当作有效投票。".repeat(2);
  assert.equal(extractStance(prose), "UNKNOWN");
  assert.equal(parseAgentResponse(prose).valid, false);
});

test("parses a structured response with null reason and trailing braces", () => {
  const result = parseAgentResponse(`{
    "stance": "BEARISH",
    "confidence": 8,
    "coreChangeReason": null,
    "response": "维持看空立场，资金面压力尚未缓解。"
  }{}\n{}`);

  assert.equal(result.valid, true);
  assert.equal(result.stance, "BEARISH");
  assert.equal(result.response, "维持看空立场，资金面压力尚未缓解。");
  assert.equal(result.analysis, "维持看空立场，资金面压力尚未缓解。");
});
