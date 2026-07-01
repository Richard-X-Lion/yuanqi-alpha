import { createHash } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;

interface RateEntry {
  count: number;
  resetAt: number;
}

export interface QuotaResult {
  allowed: boolean;
  retryAfterSeconds: number;
  unavailable?: boolean;
  mode: "distributed" | "memory" | "unavailable";
}

const globalForRateLimit = globalThis as typeof globalThis & {
  yuanqiAnalysisRateLimit?: Map<string, RateEntry>;
};

const entries = globalForRateLimit.yuanqiAnalysisRateLimit ?? new Map<string, RateEntry>();
globalForRateLimit.yuanqiAnalysisRateLimit = entries;

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function consumeMemoryQuota(clientId: string, now = Date.now()): QuotaResult {
  const current = entries.get(clientId);
  if (!current || current.resetAt <= now) {
    entries.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0, mode: "memory" };
  }
  if (current.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      mode: "memory",
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0, mode: "memory" };
}

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`.trim();

async function consumeDistributedQuota(clientId: string, fetchImpl: typeof fetch = fetch): Promise<QuotaResult> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) {
    return { allowed: false, retryAfterSeconds: 60, unavailable: true, mode: "unavailable" };
  }
  try {
    const key = `yuanqi:analysis:${hashIdentifier(clientId)}`;
    const response = await fetchImpl(baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", INCREMENT_SCRIPT, "1", key, String(WINDOW_MS)]),
      signal: AbortSignal.timeout(3_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Redis rate limit failed (${response.status})`);
    const payload = await response.json() as { result?: [number | string, number | string] };
    const count = Number(payload.result?.[0]);
    const ttlMs = Number(payload.result?.[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) throw new Error("Redis rate limit response invalid");
    return {
      allowed: count <= MAX_REQUESTS,
      retryAfterSeconds: count <= MAX_REQUESTS ? 0 : Math.max(1, Math.ceil(ttlMs / 1000)),
      mode: "distributed",
    };
  } catch {
    return { allowed: false, retryAfterSeconds: 60, unavailable: true, mode: "unavailable" };
  }
}

export async function consumeAnalysisQuota(clientId: string, now = Date.now()): Promise<QuotaResult> {
  const hasDistributedConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (hasDistributedConfig) return consumeDistributedQuota(clientId);

  const memoryAllowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_IN_MEMORY_RATE_LIMIT === "true";
  if (memoryAllowed) return consumeMemoryQuota(clientId, now);
  return { allowed: false, retryAfterSeconds: 60, unavailable: true, mode: "unavailable" };
}

export function getClientId(headers: Headers): string {
  const configuredHeader = (process.env.TRUSTED_CLIENT_IP_HEADER || "x-forwarded-for").toLowerCase();
  const raw = headers.get(configuredHeader);
  const first = raw?.split(",")[0]?.trim();
  if (first) return first.slice(0, 128);
  return "unknown";
}

export const rateLimitTestUtils = {
  consumeMemoryQuota,
  consumeDistributedQuota,
  hashIdentifier,
  resetMemory: () => entries.clear(),
};
