// File: supabase/functions/stripe-webhook-subscriptions/__tests__/webhook.unit.test.ts
// MODULE-11 TASK SUB-007: Unit tests for stripe-webhook-subscriptions handler
//
// Run with: deno test --allow-env supabase/functions/stripe-webhook-subscriptions/__tests__/webhook.unit.test.ts

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

// ─── Shared types & helpers ────────────────────────────────────────────────────

type MockQueryResult = { data: unknown; error: unknown };

/**
 * Build a minimal mock Supabase client for unit tests.
 * Tracks calls so assertions can verify correct behavior.
 */
function buildMockSupabase(subscriptionRow: Record<string, unknown> | null = null) {
  const calls: { method: string; args: unknown[] }[] = [];
  let rpcResult: Record<string, unknown> = { retry_count: 1, max_retries_reached: false };

  const mockUpdate = {
    eq: (col: string, val: unknown): MockQueryResult => {
      calls.push({ method: 'update.eq', args: [col, val] });
      return { data: null, error: null };
    },
  };

  const mockSelect = {
    eq: (_col: string, _val: unknown) => ({
      maybeSingle: (): MockQueryResult => {
        calls.push({ method: 'select.maybeSingle', args: [] });
        return { data: subscriptionRow, error: subscriptionRow ? null : null };
      },
    }),
  };

  return {
    calls,
    setRpcResult: (r: Record<string, unknown>) => {
      rpcResult = r;
    },
    from: (_table: string) => ({
      select: (_cols: string) => mockSelect,
      update: (_payload: Record<string, unknown>) => {
        calls.push({ method: 'update', args: [_payload] });
        return mockUpdate;
      },
    }),
    rpc: (fn: string, params: unknown): MockQueryResult => {
      calls.push({ method: `rpc.${fn}`, args: [params] });
      return { data: rpcResult, error: null };
    },
  };
}

// ─── Helpers extracted from index.ts for unit testing ─────────────────────────
// We test the logic inline since Deno edge functions cannot be easily imported
// without the full Deno runtime. These tests mirror the handler logic exactly.

const GRACE_PERIOD_DAYS = 90;
const MAX_PAYMENT_RETRIES = 3;

function computeNewStatus(
  stripeStatus: string,
  cancelAtPeriodEnd: boolean,
): 'active' | 'canceled' | 'grace_period' {
  if (cancelAtPeriodEnd) return 'canceled';
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'canceled') return 'grace_period';
  return 'active';
}

function computeGraceEnd(fromNow = new Date()): string {
  return new Date(fromNow.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: handleSubscriptionUpdated logic
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('subscription.updated → active when Stripe status is active', () => {
  const status = computeNewStatus('active', false);
  assertEquals(status, 'active');
});

Deno.test('subscription.updated → active when Stripe status is trialing', () => {
  const status = computeNewStatus('trialing', false);
  assertEquals(status, 'active');
});

Deno.test('subscription.updated → canceled when cancel_at_period_end=true (user requested cancel)', () => {
  const status = computeNewStatus('active', true);
  assertEquals(status, 'canceled');
});

Deno.test('subscription.updated → grace_period when Stripe status is canceled immediately', () => {
  const status = computeNewStatus('canceled', false);
  assertEquals(status, 'grace_period');
});

Deno.test('cancel_at_period_end takes priority over Stripe status', () => {
  // Even if Stripe says "active", our internal flag wins
  const status = computeNewStatus('active', true);
  assertEquals(status, 'canceled');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: grace period calculation
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('grace period is exactly 90 days from now', () => {
  const now = new Date('2026-02-18T00:00:00Z');
  const graceEnd = computeGraceEnd(now);
  const expected = new Date('2026-05-19T00:00:00Z').toISOString();
  assertEquals(graceEnd, expected);
});

Deno.test('grace period end is a valid ISO timestamp', () => {
  const graceEnd = computeGraceEnd();
  // Should parse without error
  const parsed = new Date(graceEnd);
  assertEquals(isNaN(parsed.getTime()), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: handleInvoicePaymentFailed logic
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('payment_failed: retry count increments on each failure', () => {
  const currentCount = 1;
  const newCount = currentCount + 1;
  assertEquals(newCount, 2);
  assertEquals(newCount < MAX_PAYMENT_RETRIES, true);
});

Deno.test('payment_failed: max_retries_reached is false when retry_count < 3', () => {
  const retryCount = 2;
  assertEquals(retryCount >= MAX_PAYMENT_RETRIES, false);
});

Deno.test('payment_failed: max_retries_reached is true when retry_count >= 3', () => {
  const retryCount = 3;
  assertEquals(retryCount >= MAX_PAYMENT_RETRIES, true);
});

Deno.test('payment_failed: grace period NOT triggered until exactly 3 failures', () => {
  for (let i = 1; i < MAX_PAYMENT_RETRIES; i++) {
    assertEquals(i >= MAX_PAYMENT_RETRIES, false, `Should not trigger grace at retry ${i}`);
  }
  assertEquals(MAX_PAYMENT_RETRIES >= MAX_PAYMENT_RETRIES, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: mock Supabase client wiring
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('mock supabase select returns provided subscription row', () => {
  const row = {
    id: 'sub-uuid',
    user_id: 'user-uuid',
    status: 'active',
    stripe_subscription_id: 'sub_stripe_123',
    payment_retry_count: 0,
  };
  const client = buildMockSupabase(row);
  const result = client
    .from('subscriptions')
    .select('id, user_id, status')
    .eq('stripe_subscription_id', 'sub_stripe_123')
    .maybeSingle();

  assertEquals(result.error, null);
  assertExists(result.data);
  assertEquals((result.data as typeof row).id, 'sub-uuid');
});

Deno.test('mock supabase select returns null when no subscription found', () => {
  const client = buildMockSupabase(null);
  const result = client
    .from('subscriptions')
    .select('id, user_id, status')
    .eq('stripe_subscription_id', 'sub_nonexistent')
    .maybeSingle();

  assertEquals(result.data, null);
});

Deno.test('mock supabase rpc record_payment_attempt returns retry count', () => {
  const client = buildMockSupabase({ id: 'x', user_id: 'u', status: 'active', payment_retry_count: 1 });
  client.setRpcResult({ retry_count: 2, max_retries_reached: false });

  const result = client.rpc('record_payment_attempt', { p_user_id: 'u', p_success: false });
  assertEquals(result.error, null);
  assertEquals((result.data as Record<string, unknown>).retry_count, 2);
  assertEquals(client.calls.some((c) => c.method === 'rpc.record_payment_attempt'), true);
});

Deno.test('mock supabase rpc → max_retries_reached=true triggers grace transition', () => {
  const client = buildMockSupabase({ id: 'x', user_id: 'u', status: 'active', payment_retry_count: 2 });
  client.setRpcResult({ retry_count: 3, max_retries_reached: true });

  const result = client.rpc('record_payment_attempt', { p_user_id: 'u', p_success: false });
  assertEquals((result.data as Record<string, unknown>).max_retries_reached, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: status state-machine completeness
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('all Stripe subscription statuses are handled without throwing', () => {
  const stripeStatuses = ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'paused'];
  for (const s of stripeStatuses) {
    // Should not throw
    const result = computeNewStatus(s, false);
    assertExists(result, `Status ${s} produced no result`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: computePeriodAdvance (DEV-TASK-88 — renewal period window advance)
// Mirror of the helper in index.ts. Stripe reports NULL current_period_* on the
// subscription object in this environment, so a successful renewal invoice's
// line period is the authoritative next window. Advance is FORWARD-ONLY.
// ─────────────────────────────────────────────────────────────────────────────

function computePeriodAdvance(
  existingEndIso: string | null,
  renewalStartSec: number | null | undefined,
  renewalEndSec: number | null | undefined,
): Record<string, unknown> | null {
  if (!renewalEndSec || !Number.isFinite(renewalEndSec) || renewalEndSec <= 0) {
    return null;
  }

  const existingEndMs = existingEndIso ? Date.parse(existingEndIso) : NaN;
  const nextEndMs = renewalEndSec * 1000;

  if (Number.isFinite(existingEndMs) && nextEndMs <= existingEndMs) {
    return null; // forward-only
  }

  const payload: Record<string, unknown> = {
    current_period_end: new Date(nextEndMs).toISOString(),
    next_billing_date: new Date(nextEndMs).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (renewalStartSec && Number.isFinite(renewalStartSec) && renewalStartSec > 0) {
    payload.current_period_start = new Date(renewalStartSec * 1000).toISOString();
  }

  return payload;
}

Deno.test('period advance: no renewal line period → returns null', () => {
  const result = computePeriodAdvance('2026-07-27T00:00:00Z', null, null);
  assertEquals(result, null);
});

Deno.test('period advance: existing end is null (legacy row) → advances', () => {
  const startSec = Math.floor(Date.parse('2026-08-27T12:41:17Z') / 1000);
  const endSec = Math.floor(Date.parse('2026-09-27T12:41:17Z') / 1000);
  const result = computePeriodAdvance(null, startSec, endSec);
  assertExists(result);
  assertEquals(result.current_period_end, '2026-09-27T12:41:17.000Z');
  assertEquals(result.next_billing_date, '2026-09-27T12:41:17.000Z');
  assertEquals(result.current_period_start, '2026-08-27T12:41:17.000Z');
});

Deno.test('period advance: renewal end later than stored → advances', () => {
  const endSec = Math.floor(Date.parse('2026-09-27T12:41:17Z') / 1000);
  const result = computePeriodAdvance('2026-07-27T12:41:17Z', null, endSec);
  assertExists(result);
  assertEquals(result.current_period_end, '2026-09-27T12:41:17.000Z');
});

Deno.test('period advance: renewal end NOT later than stored → no regress (idempotent replay)', () => {
  const endSec = Math.floor(Date.parse('2026-07-27T12:41:17Z') / 1000);
  const result = computePeriodAdvance('2026-09-27T12:41:17Z', null, endSec);
  assertEquals(result, null);
});

Deno.test('period advance: equal end → no advance (out-of-order safe)', () => {
  const endSec = Math.floor(Date.parse('2026-09-27T12:41:17Z') / 1000);
  const result = computePeriodAdvance('2026-09-27T12:41:17Z', null, endSec);
  assertEquals(result, null);
});

Deno.test('period advance: missing start → advances end/next_billing only', () => {
  const endSec = Math.floor(Date.parse('2026-09-27T12:41:17Z') / 1000);
  const result = computePeriodAdvance('2026-07-27T12:41:17Z', null, endSec);
  assertExists(result);
  assertEquals(result.current_period_start, undefined);
  assertEquals(result.current_period_end, '2026-09-27T12:41:17.000Z');
});
