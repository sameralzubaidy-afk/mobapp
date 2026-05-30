// File: supabase/functions/_shared/rate-limiter.ts
//
// PROD-003: Reusable in-memory rate limiter for Supabase Edge Functions.
//
// Design notes:
//   * Runs on Deno Deploy → no Node packages.
//   * In-memory Map, resets on cold start. This is acceptable for MVP because
//     a cold start naturally "expires" the limiter and the worst-case effect
//     is one extra burst of requests per warm window. Upgrade path is to swap
//     this for an Upstash Redis or a Postgres `rate_limit_buckets` table.
//   * Cleanup runs lazily on every call once per 5 min to bound memory.
//   * The module exports both a low-level `checkRateLimit` and convenience
//     helpers (`rateLimitResponse`, `addRateLimitHeaders`) so call sites stay
//     a 3-line pattern.

export interface RateLimitConfig {
  /** Max requests allowed inside the window. */
  maxRequests: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix-epoch seconds when the current window resets. */
  resetAt: number;
}

interface BucketEntry {
  count: number;
  /** Unix-epoch seconds when the bucket resets. */
  resetAt: number;
}

// Module-scoped store. NOT exported — callers must use the helpers below.
const store = new Map<string, BucketEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupMs = Date.now();

function cleanupExpired(nowMs: number): void {
  if (nowMs - lastCleanupMs < CLEANUP_INTERVAL_MS) return;
  lastCleanupMs = nowMs;
  const nowSec = Math.floor(nowMs / 1000);
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < nowSec) {
      store.delete(key);
    }
  }
}

/**
 * Check whether a request identified by `key` is allowed under `config`.
 * Side effect: increments the counter on allowed requests.
 *
 * @param key A stable identifier — typically `<scope>:<userId>` or `<scope>:<ip>`.
 * @param config Per-endpoint rate limit profile (see RATE_LIMITS).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const nowMs = Date.now();
  cleanupExpired(nowMs);

  const nowSec = Math.floor(nowMs / 1000);
  const entry = store.get(key);

  if (!entry || entry.resetAt < nowSec) {
    const resetAt = nowSec + config.windowSeconds;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count < config.maxRequests) {
    entry.count += 1;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  return { allowed: false, remaining: 0, resetAt: entry.resetAt };
}

/**
 * Pre-configured rate limit profiles. Numbers picked to match spec defaults.
 */
export const RATE_LIMITS = {
  /** Auth (signup/login/verify) — per-IP. */
  AUTH: { maxRequests: 5, windowSeconds: 60 },
  /** Write (create listing/trade) — per-user. */
  WRITE: { maxRequests: 10, windowSeconds: 60 },
  /** Read (search/feed) — per-user. */
  READ: { maxRequests: 30, windowSeconds: 60 },
  /** Messaging — per-user. */
  MESSAGING: { maxRequests: 20, windowSeconds: 60 },
  /** Sensitive (password reset, phone OTP). */
  SENSITIVE: { maxRequests: 3, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

/**
 * Build a 429 response with structured error + standard rate-limit headers.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  extraHeaders: HeadersInit = {},
): Response {
  const nowSec = Math.floor(Date.now() / 1000);
  const retryAfter = Math.max(0, result.resetAt - nowSec);
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter,
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
        'Retry-After': String(retryAfter),
        ...extraHeaders,
      },
    },
  );
}

/**
 * Mutate a Headers object to include standard rate-limit headers on a
 * successful response.
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult,
): void {
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));
}

/**
 * Extract a best-effort client IP from common proxy headers.
 * Falls back to "unknown" if nothing is present (e.g., local dev curl).
 */
export function clientIpFrom(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/**
 * TEST-ONLY helper — reset the in-memory store. Never call from production code.
 */
export function __resetRateLimiterForTests(): void {
  store.clear();
  lastCleanupMs = Date.now();
}
