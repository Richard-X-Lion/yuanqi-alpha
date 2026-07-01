import assert from "node:assert/strict";
import test from "node:test";
import { isDirectSecurityCode, isValidSecurityInput, normalizeSecurityInput } from "./types";

test("normalizes market-specific security codes", () => {
  assert.equal(normalizeSecurityInput("700", "HK"), "00700");
  assert.equal(normalizeSecurityInput("aapl", "US"), "AAPL");
  assert.equal(normalizeSecurityInput("600519", "CN"), "600519");
});

test("validates direct codes without rejecting exact company names", () => {
  assert.equal(isDirectSecurityCode("00700", "HK"), true);
  assert.equal(isDirectSecurityCode("BRK.B", "US"), true);
  assert.equal(isValidSecurityInput("贵州茅台"), true);
  assert.equal(isValidSecurityInput(""), false);
});

