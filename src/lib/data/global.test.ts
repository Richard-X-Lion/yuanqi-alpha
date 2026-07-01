import assert from "node:assert/strict";
import test from "node:test";
import { calculateGlobalMetrics, type PriceBar } from "./global";

test("calculates deterministic price and volume metrics", () => {
  const bars: PriceBar[] = Array.from({ length: 260 }, (_, index) => ({
    date: `2025-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
    close: 100 + index,
    volume: 1_000 + index * 10,
  }));
  const metrics = calculateGlobalMetrics(bars);
  assert.equal(metrics.observations, 260);
  assert.ok((metrics.return20d || 0) > 0);
  assert.ok((metrics.rsi14 || 0) >= 99);
  assert.ok((metrics.volumeRatio5To20 || 0) > 1);
  assert.equal(metrics.maxDrawdown, 0);
});

test("returns null metrics when history is insufficient", () => {
  const metrics = calculateGlobalMetrics([]);
  assert.equal(metrics.return20d, null);
  assert.equal(metrics.annualizedVolatility, null);
  assert.equal(metrics.periodEnd, null);
});

