import assert from "node:assert/strict";
import test from "node:test";
import { DEADLOCK_THRESHOLD, hasDebateDeadlock, nextNoChangeStreak } from "./debate-rules";

test("requires three consecutive unchanged debate rounds before deadlock", () => {
  let streak = 0;
  streak = nextNoChangeStreak(streak, 0);
  assert.equal(hasDebateDeadlock(streak), false);
  streak = nextNoChangeStreak(streak, 0);
  assert.equal(hasDebateDeadlock(streak), false);
  streak = nextNoChangeStreak(streak, 0);
  assert.equal(streak, DEADLOCK_THRESHOLD);
  assert.equal(hasDebateDeadlock(streak), true);
});

test("a changed stance resets the deadlock streak", () => {
  let streak = 2;
  streak = nextNoChangeStreak(streak, 1);
  assert.equal(streak, 0);
  assert.equal(hasDebateDeadlock(streak), false);
});
