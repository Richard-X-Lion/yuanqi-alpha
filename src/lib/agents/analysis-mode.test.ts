import assert from "node:assert/strict";
import test from "node:test";
import { resolveAnalysisMode } from "./analysis-mode";

test("requires a user MCP for real analysis", () => {
  const result = resolveAnalysisMode([], 0);
  assert.equal(result.isMockMode, true);
  assert.match(result.reasons.join(" "), /MCP/);
});

test("uses real mode only with all models and an enabled MCP", () => {
  assert.deepEqual(resolveAnalysisMode([], 1), { isMockMode: false, reasons: [] });
});

test("keeps mock mode when any model role is missing", () => {
  const result = resolveAnalysisMode(["主持人"], 1);
  assert.equal(result.isMockMode, true);
  assert.match(result.reasons.join(" "), /主持人/);
});
