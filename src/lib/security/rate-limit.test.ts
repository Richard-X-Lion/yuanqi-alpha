import assert from "node:assert/strict";
import test from "node:test";
import { rateLimitTestUtils } from "./rate-limit";

test("memory limiter blocks the eleventh request in a ten minute window", () => {
  rateLimitTestUtils.resetMemory();
  const now = 1_000_000;
  for (let index = 0; index < 10; index++) {
    assert.equal(rateLimitTestUtils.consumeMemoryQuota("client", now).allowed, true);
  }
  const blocked = rateLimitTestUtils.consumeMemoryQuota("client", now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 600);
});

test("distributed limiter uses one atomic Redis EVAL command", async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  let command: unknown;
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    command = JSON.parse(String(init?.body || "null")) as unknown;
    return Response.json({ result: [11, 90_000] });
  }) as typeof fetch;
  try {
    const result = await rateLimitTestUtils.consumeDistributedQuota("203.0.113.10", fetchImpl);
    assert.equal(result.mode, "distributed");
    assert.equal(result.allowed, false);
    assert.equal(result.retryAfterSeconds, 90);
    assert.equal(Array.isArray(command), true);
    assert.equal((command as unknown[])[0], "EVAL");
    assert.equal((command as unknown[])[2], "1");
    assert.match(String((command as unknown[])[3]), /^yuanqi:analysis:[a-f0-9]{32}$/);
  } finally {
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});
