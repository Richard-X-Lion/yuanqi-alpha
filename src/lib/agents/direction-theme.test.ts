import assert from "node:assert/strict";
import test from "node:test";
import { getDirectionTheme, getLeadingStance } from "../../components/analysis/direction-theme";

test("uses A-share red for bullish and green for bearish directions", () => {
  assert.equal(getDirectionTheme("BUY").hex, "#ff1744");
  assert.equal(getDirectionTheme("BULLISH").hex, "#ff1744");
  assert.equal(getDirectionTheme("SELL").hex, "#00c853");
  assert.equal(getDirectionTheme("BEARISH").hex, "#00c853");
});

test("derives the vote panel color from the leading stance", () => {
  assert.equal(getLeadingStance({ BULLISH: 0.6, BEARISH: 1.7, NEUTRAL: 0 }), "BEARISH");
  assert.equal(getLeadingStance({ BULLISH: 1, BEARISH: 1, NEUTRAL: 0 }), "NEUTRAL");
});
