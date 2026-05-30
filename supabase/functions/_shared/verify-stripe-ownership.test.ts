// File: supabase/functions/_shared/verify-stripe-ownership.test.ts
//
// PROD-005: Deno unit tests for verifyStripeAccountOwnership.
// Run with: cd supabase && deno test functions/_shared/verify-stripe-ownership.test.ts
//
// Uses a hand-rolled Supabase query-builder mock so we don't pull network deps.

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  ownershipDeniedResponse,
  verifyStripeAccountOwnership,
} from './verify-stripe-ownership.ts';

// deno-lint-ignore no-explicit-any
function mockSupabase(result: { data: any; error: any }) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
  };
  return { from: () => builder };
}

Deno.test('owned=true when user_id matches', async () => {
  const supa = mockSupabase({
    data: { id: 'method-1', user_id: 'user-A', stripe_account_id: 'acct_1' },
    error: null,
  });
  const r = await verifyStripeAccountOwnership(supa, 'user-A', 'acct_1');
  assertEquals(r.owned, true);
  assertEquals(r.methodId, 'method-1');
});

Deno.test('owned=false when user_id differs (cross-account attack)', async () => {
  const supa = mockSupabase({
    data: { id: 'method-1', user_id: 'user-B', stripe_account_id: 'acct_1' },
    error: null,
  });
  const r = await verifyStripeAccountOwnership(supa, 'user-A', 'acct_1');
  assertEquals(r.owned, false);
  assertExists(r.error);
});

Deno.test('owned=false when no row found', async () => {
  const supa = mockSupabase({ data: null, error: null });
  const r = await verifyStripeAccountOwnership(supa, 'user-A', 'acct_missing');
  assertEquals(r.owned, false);
  assertEquals(r.error, 'Stripe account not found');
});

Deno.test('owned=false when lookup errors', async () => {
  const supa = mockSupabase({ data: null, error: { message: 'db down' } });
  const r = await verifyStripeAccountOwnership(supa, 'user-A', 'acct_1');
  assertEquals(r.owned, false);
  assertEquals(r.error, 'Lookup failed');
});

Deno.test('owned=false when inputs missing', async () => {
  const supa = mockSupabase({ data: null, error: null });
  const r1 = await verifyStripeAccountOwnership(supa, '', 'acct_1');
  const r2 = await verifyStripeAccountOwnership(supa, 'user-A', '');
  assertEquals(r1.owned, false);
  assertEquals(r2.owned, false);
});

Deno.test('ownershipDeniedResponse returns 403 with structured error', async () => {
  const res = ownershipDeniedResponse('Not your account');
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error.code, 'STRIPE_ACCOUNT_OWNERSHIP_DENIED');
  assertEquals(body.error.details, 'Not your account');
});
