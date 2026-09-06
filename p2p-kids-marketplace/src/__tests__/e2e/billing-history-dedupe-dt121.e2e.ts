/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/billing-history-dedupe-dt121.e2e.ts
 * DT-121 (2026-09-06): one billing_history row per Stripe invoice.
 *
 * Regression guard for the duplicate-row bug: a single renewal could produce TWO
 * billing_history rows for the same invoice — `renew-subscription` (app EF) wrote
 * keyed to the real `ch_…` charge while the webhook's `invoice.payment_succeeded`
 * fallback wrote a second row keyed to `in_…` (different charge_id), and the old
 * `UNIQUE(charge_id)` could not catch the pair.
 *
 * Fix under test: every billing_history writer upserts with
 * `{ onConflict: 'stripe_invoice_id', ignoreDuplicates: true }` and a plain unique
 * index `uq_billing_history_stripe_invoice_id` enforces one row per invoice at the
 * DB (a non-converted writer now fails loudly instead of silently duplicating).
 *
 * Service-role client mirrors what the Edge Functions use (they bypass RLS).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loaded from .env/.env.staging
 * by jest.setup.ts). Gated by RUN_SUPABASE_E2E=true (npm run test:e2e).
 *
 * Mutations are disposable + fully cleaned (BP-70: delete profiles by user_id,
 * then admin.deleteUser).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error(
    'billing-history-dedupe-dt121 e2e requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (loaded from .env by jest.setup.ts).'
  );
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe('DT-121 E2E: billing_history dedupe (one row per invoice)', () => {
  const email = `qa.dt121.dedupe.${Date.now()}@kidsmarketplace.test`;
  const password = 'TestPass123!';
  let userId: string | null = null;
  let subscriptionId: string | null = null;
  const createdChargeIds: string[] = [];
  const createdInvoiceId = `in_dt121_${Date.now()}`;

  const cleanup = async () => {
    try {
      if (subscriptionId) {
        await admin.from('billing_history').delete().eq('subscription_id', subscriptionId);
      }
      if (userId) {
        await admin.from('billing_history').delete().eq('user_id', userId);
        // BP-70: profiles.id !== user_id — delete profiles by user_id
        await admin.from('profiles').delete().eq('user_id', userId);
        await admin.auth.admin.deleteUser(userId);
      }
    } catch (e) {
      console.warn('[dt121-dedupe] cleanup err', (e as Error).message);
    }
  };

  beforeAll(async () => {
    // Disposable user (signup trigger creates the profile + subscriptions row).
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'DT121 Dedupe Fixture' },
    });
    if (error) throw new Error(`admin.createUser: ${error.message}`);
    userId = data.user?.id ?? null;

    const { data: sub, error: subErr } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (subErr || !sub?.id) {
      // No trigger-created row — create a minimal one so the FK is satisfiable.
      const { data: created, error: insErr } = await admin
        .from('subscriptions')
        .insert({ user_id: userId, status: 'active' })
        .select('id')
        .single();
      if (insErr) throw new Error(`subscriptions insert: ${insErr.message}`);
      subscriptionId = created?.id ?? null;
    } else {
      subscriptionId = sub.id;
    }
  });

  afterAll(async () => {
    await cleanup();
  });

  // NOTE: index presence is proven behaviorally by the two tests below, not by a
  // pg_indexes SELECT (pg_catalog tables are not exposed via PostgREST):
  //  - the `onConflict: 'stripe_invoice_id'` upsert only succeeds if that unique
  //    index exists (otherwise PostgREST errors on the conflict target), and
  //  - the naive second insert must be rejected with 23505 by that same index.

  it('collapses the two-writer race to a single row (EF + webhook on the same invoice)', async () => {
    expect(userId).not.toBeNull();
    expect(subscriptionId).not.toBeNull();

    // Writer A — renew-subscription EF: real detached charge `ch_…`.
    const chargeA = `ch_dt121_a_${Date.now()}`;
    createdChargeIds.push(chargeA);
    const { error: insA } = await admin.from('billing_history').insert({
      user_id: userId,
      subscription_id: subscriptionId,
      charge_id: chargeA,
      stripe_invoice_id: createdInvoiceId,
      amount: 599,
      currency: 'usd',
      status: 'succeeded',
    });
    expect(insA).toBeNull();

    // Writer B — webhook invoice.payment_succeeded, FIXED behavior: same invoice,
    // a different (fallback) charge_id, upsert idempotent on stripe_invoice_id.
    const chargeB = `in_${createdInvoiceId.split('_').pop()}`; // fallback-style id, differs from A
    const { error: upsB } = await admin.from('billing_history').upsert(
      {
        user_id: userId,
        subscription_id: subscriptionId,
        charge_id: chargeB,
        stripe_invoice_id: createdInvoiceId,
        amount: 599,
        currency: 'usd',
        status: 'succeeded',
      },
      { onConflict: 'stripe_invoice_id', ignoreDuplicates: true },
    );
    expect(upsB).toBeNull();

    const { data: rows, error: qErr } = await admin
      .from('billing_history')
      .select('charge_id, stripe_invoice_id')
      .eq('stripe_invoice_id', createdInvoiceId);
    expect(qErr).toBeNull();
    // Exactly one row for the invoice, and it is writer A's real charge row.
    expect(rows?.length).toBe(1);
    expect(rows?.[0]?.charge_id).toBe(chargeA);
  });

  it('DB backstop rejects a NON-converted writer that still tries to insert a second row for the same invoice', async () => {
    // Simulate a writer that did NOT migrate to the stripe_invoice_id conflict
    // target (the old buggy behavior): a plain insert with yet another charge_id
    // for the SAME invoice must now fail loudly on the unique index (23505) —
    // never silently create a second row.
    const { error } = await admin.from('billing_history').insert({
      user_id: userId,
      subscription_id: subscriptionId,
      charge_id: `ch_dt121_naive_${Date.now()}`,
      stripe_invoice_id: createdInvoiceId,
      amount: 599,
      currency: 'usd',
      status: 'succeeded',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505'); // unique_violation
  });
});
