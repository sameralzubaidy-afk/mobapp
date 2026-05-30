// File: supabase/functions/_shared/rate-limiter.test.ts
//
// PROD-003: Deno unit tests for the rate limiter.
// Run with: cd supabase && deno test functions/_shared/rate-limiter.test.ts
//
// These tests rely on real time progression for window expiry. We use the
// __resetRateLimiterForTests helper to avoid cross-test contamination.

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  __resetRateLimiterForTests,
  addRateLimitHeaders,
  checkRateLimit,
  clientIpFrom,
  RATE_LIMITS,
  rateLimitResponse,
} from './rate-limiter.ts';

Deno.test('AUTH profile: 5 allowed, 6th blocked', () => {
  __resetRateLimiterForTests();
  const key = 'auth:1.2.3.4';
  for (let i = 0; i < 5; i++) {
    const r = checkRateLimit(key, RATE_LIMITS.AUTH);
    assertEquals(r.allowed, true, `request ${i + 1} should be allowed`);
    assertEquals(r.remaining, 4 - i);
  }
  const blocked = checkRateLimit(key, RATE_LIMITS.AUTH);
  assertEquals(blocked.allowed, false);
  assertEquals(blocked.remaining, 0);
});

Deno.test('Different keys are isolated', () => {
  __resetRateLimiterForTests();
  for (let i = 0; i < 5; i++) checkRateLimit('auth:a', RATE_LIMITS.AUTH);
  const blockedA = checkRateLimit('auth:a', RATE_LIMITS.AUTH);
  const allowedB = checkRateLimit('auth:b', RATE_LIMITS.AUTH);
  assertEquals(blockedA.allowed, false);
  assertEquals(allowedB.allowed, true);
  assertEquals(allowedB.remaining, 4);
});

Deno.test('Window expiry resets counter', async () => {
  __resetRateLimiterForTests();
  const key = 'short:user';
  const cfg = { maxRequests: 2, windowSeconds: 1 };
  assertEquals(checkRateLimit(key, cfg).allowed, true);
  assertEquals(checkRateLimit(key, cfg).allowed, true);
  assertEquals(checkRateLimit(key, cfg).allowed, false);

  // Wait > 2 seconds to ensure nowSec passes resetAt (which is set to
  // floor(now/1000) + windowSeconds; reset condition is resetAt < nowSec).
  await new Promise((r) => setTimeout(r, 2100));
  const afterReset = checkRateLimit(key, cfg);
  assertEquals(afterReset.allowed, true, 'should reset after window');
  assertEquals(afterReset.remaining, 1);
});

Deno.test('rateLimitResponse returns 429 with required headers', () => {
  const resetAt = Math.floor(Date.now() / 1000) + 30;
  const res = rateLimitResponse({ allowed: false, remaining: 0, resetAt });
  assertEquals(res.status, 429);
  assertEquals(res.headers.get('X-RateLimit-Remaining'), '0');
  assertEquals(res.headers.get('X-RateLimit-Reset'), String(resetAt));
  assertExists(res.headers.get('Retry-After'));
});

Deno.test('rateLimitResponse body has structured error code', async () => {
  const resetAt = Math.floor(Date.now() / 1000) + 30;
  const res = rateLimitResponse({ allowed: false, remaining: 0, resetAt });
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error.code, 'RATE_LIMIT_EXCEEDED');
  assertExists(body.error.retryAfter);
});

Deno.test('addRateLimitHeaders mutates Headers correctly', () => {
  const h = new Headers();
  addRateLimitHeaders(h, { allowed: true, remaining: 7, resetAt: 12345 });
  assertEquals(h.get('X-RateLimit-Remaining'), '7');
  assertEquals(h.get('X-RateLimit-Reset'), '12345');
});

Deno.test('clientIpFrom prefers x-forwarded-for first hop', () => {
  const req = new Request('https://example.com/', {
    headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' },
  });
  assertEquals(clientIpFrom(req), '9.9.9.9');
});

Deno.test('clientIpFrom falls back to cf-connecting-ip then x-real-ip then unknown', () => {
  assertEquals(
    clientIpFrom(new Request('https://e.com/', { headers: { 'cf-connecting-ip': '1.1.1.1' } })),
    '1.1.1.1',
  );
  assertEquals(
    clientIpFrom(new Request('https://e.com/', { headers: { 'x-real-ip': '2.2.2.2' } })),
    '2.2.2.2',
  );
  assertEquals(clientIpFrom(new Request('https://e.com/')), 'unknown');
});
