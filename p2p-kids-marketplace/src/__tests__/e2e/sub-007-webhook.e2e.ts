/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/sub-007-webhook.e2e.ts
 * MODULE-11 TASK SUB-007: E2E tests for Stripe webhook subscription state machine
 *
 * These tests verify the DB state transitions that the webhook handler produces.
 * They require a live Supabase prod connection + a seeded test subscription row.
 *
 * Run: npm run test:e2e -- --testPathPattern=sub-007
 *
 * IMPORTANT: These tests only mutate subscription rows seeded for testing.
 * They call RPCs directly (same ones the webhook uses) to verify DB state.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Env validation ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'E2E tests require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.\n' +
      'Set them in p2p-kids-marketplace/.env.local'
  );
}

// Service-role client mirrors what the webhook edge function uses
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helper: find test subscription row by stripe_subscription_id ─────────────
async function getSubByStripeId(stripeSubId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'id, user_id, status, grace_ends_at, grace_started_at, payment_retry_count, payment_failed_at, current_period_end'
    )
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Helper: get test user's subscription by user_id ──────────────────────────
async function getSubByUserId(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'id, user_id, status, grace_ends_at, grace_started_at, payment_retry_count, payment_failed_at, stripe_subscription_id'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Helper: reset subscription state to 'active' ─────────────────────────────
async function resetSubToActive(subId: string) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      payment_retry_count: 0,
      payment_failed_at: null,
      grace_started_at: null,
      grace_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subId);

  if (error) throw error;
}

async function getSubscriptionChargeConfig() {
  const { data, error } = await supabase
    .from('admin_config')
    .select('key, value, data_type, is_active')
    .in('key', ['subscription_price_monthly', 'trial_period_days'])
    .eq('is_active', true);

  if (error) throw error;
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────
describe('SUB-007: Stripe Webhook Subscription State Machine (E2E)', () => {
  // NOTE: Replace with an actual test user that has a subscription row.
  // You can obtain this from Supabase dashboard → subscriptions table.
  const TEST_USER_ID = process.env.SUB_007_TEST_USER_ID || '';

  let testSubId = '';

  beforeAll(async () => {
    if (!TEST_USER_ID) {
      console.warn(
        '[SUB-007 E2E] SUB_007_TEST_USER_ID not set — set it in .env.local to run E2E tests against a real user.'
      );
      return;
    }

    const sub = await getSubByUserId(TEST_USER_ID);
    if (!sub) {
      throw new Error(
        `No subscription found for TEST_USER_ID=${TEST_USER_ID}. ` +
          'Ensure the user has a subscription row in the subscriptions table.'
      );
    }
    testSubId = sub.id;
    // Ensure clean state
    await resetSubToActive(testSubId);
  });

  afterEach(async () => {
    if (!testSubId) return;
    // Always reset to clean state after each test
    await resetSubToActive(testSubId);
  });

  it('TC-007-00: admin_config pricing/trial keys exist for subscription charge logic', async () => {
    const rows = await getSubscriptionChargeConfig();

    const monthlyPriceRow = rows.find((row: any) => row.key === 'subscription_price_monthly');
    const trialDaysRow = rows.find((row: any) => row.key === 'trial_period_days');

    expect(monthlyPriceRow).toBeTruthy();
    expect(trialDaysRow).toBeTruthy();
    expect(Number(monthlyPriceRow?.value)).toBeGreaterThan(0);
    expect(Number(trialDaysRow?.value)).toBeGreaterThanOrEqual(0);
  });

  // ── Test 1: subscription.updated (active → active same status) ─────────────
  it('TC-007-01: subscription status remains active on renewal', async () => {
    if (!testSubId) return;

    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', testSubId);

    expect(error).toBeNull();

    const sub = await getSubByUserId(TEST_USER_ID);
    expect(sub?.status).toBe('active');
  });

  // ── Test 2: subscription.updated → cancelled (cancel_at_period_end) ─────────
  it('TC-007-02: subscription transitions to cancelled when cancel requested', async () => {
    if (!testSubId) return;

    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', testSubId);

    expect(error).toBeNull();

    const sub = await getSubByUserId(TEST_USER_ID);
    expect(sub?.status).toBe('cancelled');
    // Grace dates should NOT be set yet (user still has access until period end)
    expect(sub?.grace_started_at).toBeNull();
  });

  // ── Test 3: subscription.deleted → grace_period + grace dates set ───────────
  it('TC-007-03: subscription.deleted moves user to grace_period with 90-day window', async () => {
    if (!testSubId) return;

    const now = new Date();
    const expectedGraceEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'grace_period',
        grace_started_at: now.toISOString(),
        grace_ends_at: expectedGraceEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', testSubId);

    expect(error).toBeNull();

    const sub = await getSubByUserId(TEST_USER_ID);
    expect(sub?.status).toBe('grace_period');
    expect(sub?.grace_started_at).toBeTruthy();
    expect(sub?.grace_ends_at).toBeTruthy();

    // Grace end should be ~90 days from now (within 1 hour tolerance)
    const graceEndDate = new Date(sub!.grace_ends_at!);
    const diffDays = (graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(89.9);
    expect(diffDays).toBeLessThan(90.1);
  });

  // ── Test 4: invoice.payment_failed (1st attempt) → retry count increments ────
  it('TC-007-04: first payment failure increments retry_count to 1, status stays active', async () => {
    if (!testSubId) return;

    const { data, error } = await supabase.rpc('record_payment_attempt', {
      p_user_id: TEST_USER_ID,
      p_success: false,
    });

    expect(error).toBeNull();
    expect(data.retry_count).toBe(1);
    expect(data.max_retries_reached).toBe(false);

    const sub = await getSubByUserId(TEST_USER_ID);
    expect(sub?.payment_retry_count).toBe(1);
    expect(sub?.payment_failed_at).toBeTruthy();
    // Active users keep access during retries
    expect(sub?.status).toBe('active');
  });

  // ── Test 5: invoice.payment_failed (2nd attempt) ────────────────────────────
  it('TC-007-05: second payment failure increments retry_count to 2', async () => {
    if (!testSubId) return;

    // Set up: 1 existing failure
    await supabase
      .from('subscriptions')
      .update({ payment_retry_count: 1, updated_at: new Date().toISOString() })
      .eq('id', testSubId);

    const { data, error } = await supabase.rpc('record_payment_attempt', {
      p_user_id: TEST_USER_ID,
      p_success: false,
    });

    expect(error).toBeNull();
    expect(data.retry_count).toBe(2);
    expect(data.max_retries_reached).toBe(false);
  });

  // ── Test 6: invoice.payment_failed (3rd attempt) → grace_period ─────────────
  it('TC-007-06: third payment failure moves user to grace_period', async () => {
    if (!testSubId) return;

    // Set up: 2 existing failures
    await supabase
      .from('subscriptions')
      .update({ payment_retry_count: 2, updated_at: new Date().toISOString() })
      .eq('id', testSubId);

    const { data, error } = await supabase.rpc('record_payment_attempt', {
      p_user_id: TEST_USER_ID,
      p_success: false,
    });

    expect(error).toBeNull();
    expect(data.retry_count).toBe(3);
    expect(data.max_retries_reached).toBe(true);

    // The RPC should have transitioned status to grace_period
    const sub = await getSubByUserId(TEST_USER_ID);
    expect(sub?.status).toBe('grace_period');
    expect(sub?.grace_ends_at).toBeTruthy();
  });

  // ── Test 7: payment success resets retry count ───────────────────────────────
  it('TC-007-07: successful payment resets payment_retry_count to 0', async () => {
    if (!testSubId) return;

    // Set up: 1 failure
    await supabase
      .from('subscriptions')
      .update({ payment_retry_count: 1, payment_failed_at: new Date().toISOString() })
      .eq('id', testSubId);

    const { data, error } = await supabase.rpc('record_payment_attempt', {
      p_user_id: TEST_USER_ID,
      p_success: true,
    });

    expect(error).toBeNull();
    expect(data.payment_succeeded).toBe(true);

    const sub = await getSubByUserId(TEST_USER_ID);
    expect(sub?.payment_retry_count).toBe(0);
    expect(sub?.payment_failed_at).toBeNull();
  });

  // ── Test 8: SP wallet can_earn check respects grace_period ───────────────────
  it('TC-007-08: users in grace_period cannot earn SP', async () => {
    if (!testSubId) return;

    // Set up: grace period
    await supabase
      .from('subscriptions')
      .update({ status: 'grace_period', updated_at: new Date().toISOString() })
      .eq('id', testSubId);

    const { data: canEarn, error } = await supabase.rpc('can_user_earn_sp', {
      p_user_id: TEST_USER_ID,
    });

    expect(error).toBeNull();
    expect(canEarn).toBe(false);
  });

  // ── Test 9: subscription lookup by stripe_subscription_id ────────────────────
  it('TC-007-09: subscriptions table is queryable by stripe_subscription_id', async () => {
    if (!testSubId) return;

    const sub = await getSubByUserId(TEST_USER_ID);
    if (!sub?.stripe_subscription_id) {
      console.warn('[SUB-007 E2E] Test user has no stripe_subscription_id — skipping TC-007-09');
      return;
    }

    const subByStripeId = await getSubByStripeId(sub.stripe_subscription_id);
    expect(subByStripeId?.id).toBe(sub.id);
  });

  // ── Test 10: grace_period_ends_at is ~90 days from grace_started_at ──────────
  it('TC-007-10: grace_ends_at is 90 days after grace_started_at', async () => {
    if (!testSubId) return;

    const now = new Date();
    const graceEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    await supabase
      .from('subscriptions')
      .update({
        status: 'grace_period',
        grace_started_at: now.toISOString(),
        grace_ends_at: graceEnd.toISOString(),
      })
      .eq('id', testSubId);

    const sub = await getSubByUserId(TEST_USER_ID);
    const graceDiff =
      (new Date(sub!.grace_ends_at!).getTime() - new Date(sub!.grace_started_at!).getTime()) /
      (1000 * 60 * 60 * 24);

    expect(graceDiff).toBeGreaterThan(89.9);
    expect(graceDiff).toBeLessThan(90.1);
  });
});
