// File: supabase/functions/initiate-payout/index.ts
// TFV2-018: Initiate a Stripe Connect payout to the seller after trade completes.
// Called by payout_trigger DB trigger (or admin manually).
//
// Input:  { trade_id }
// Output: { success: true, transfer_id, payout_status } | { error }
//
// Uses Stripe Connect Transfers API (not direct charge).
// Idempotent: checks payout_status before creating transfer.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.1';
import Stripe from 'npm:stripe@12.0.0';

// ===========================================================================
// Inline copies of _shared/audit.ts + _shared/verify-stripe-ownership.ts.
// The Supabase MCP bundler cannot resolve `../_shared/*` parent-dir imports
// (see misc./PAY-004-005-DEPLOYMENT-FIX-APPLIED.md), so these helpers are
// inlined here to keep this function deployable as a single file. Keep in sync
// with the canonical `supabase/functions/_shared/` sources.
// ===========================================================================
export type FinancialMutationType =
  | 'offer_created'
  | 'payment_intent_created'
  | 'payment_captured'
  | 'payment_capture_failed'
  | 'payment_cancelled'
  | 'refund_issued'
  | 'refund_voided'
  | 'payout_initiated'
  | 'payout_paid'
  | 'payout_requires_action'
  | 'payout_failed'
  | 'payout_scheduled'
  | 'sp_reserved'
  | 'sp_restored'
  | 'sp_released'
  | 'sp_issued'
  | 'sp_deducted'
  | 'sp_frozen'
  | 'sp_unfrozen'
  | 'sp_expired'
  | 'buyer_fee_charged'
  | 'seller_fee_deducted'
  | 'tax_quoted'
  | 'tax_collected'
  | 'tax_voided'
  | 'tax_refunded'
  | 'trade_cancelled'
  | 'trade_completed';

// deno-lint-ignore no-explicit-any
type AuditClient = { rpc: (fn: string, args: Record<string, unknown>) => any };

async function logFinancialAudit(
  supabase: AuditClient,
  input: {
    mutationType: FinancialMutationType;
    entityType?: string;
    entityId?: string | null;
    actorId?: string | null;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    amountCents?: number | null;
    idempotencyKey?: string | null;
    nodeId?: string | null;
  },
): Promise<void> {
  try {
    const { error } = (await supabase.rpc('fn_log_financial_audit', {
      p_mutation_type: input.mutationType,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_actor_id: input.actorId ?? null,
      p_before_state: input.beforeState ?? {},
      p_after_state: input.afterState ?? {},
      p_amount_cents: input.amountCents ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_node_id: input.nodeId ?? null,
    })) ?? { error: null };
    if (error) {
      console.warn(
        `[logFinancialAudit] failed mutation=${input.mutationType} entity=${input.entityId}:`,
        error.message,
      );
    }
  } catch (err) {
    console.warn('[logFinancialAudit] unexpected error:', err);
  }
}

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

interface OwnershipCheck {
  owned: boolean;
  methodId?: string;
  error?: string;
}

async function verifyStripeAccountOwnership(
  supabase: SupabaseLike,
  userId: string,
  stripeAccountId: string,
): Promise<OwnershipCheck> {
  if (!userId || !stripeAccountId) {
    return { owned: false, error: 'Missing userId or stripeAccountId' };
  }
  const { data, error } = await supabase
    .from('seller_payout_methods')
    .select('id, user_id, stripe_account_id')
    .eq('stripe_account_id', stripeAccountId)
    .eq('method_type', 'stripe_connect')
    .maybeSingle();
  if (error) {
    console.error('[verify-stripe-ownership] Lookup failed:', { userId, stripeAccountId, error: error.message });
    return { owned: false, error: 'Lookup failed' };
  }
  if (!data) {
    console.warn('[verify-stripe-ownership] OWNERSHIP MISMATCH (no row):', { userId, stripeAccountId });
    return { owned: false, error: 'Stripe account not found' };
  }
  if (data.user_id !== userId) {
    console.warn('[verify-stripe-ownership] OWNERSHIP MISMATCH:', { requestedBy: userId, stripeAccountId, actualOwner: data.user_id });
    return { owned: false, error: 'Stripe account does not belong to this user' };
  }
  return { owned: true, methodId: data.id };
}
// ===========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function errResp(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errResp(405, 'METHOD_NOT_ALLOWED', 'POST required');

  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const supabaseSvcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey      = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !supabaseSvcKey) return errResp(500, 'CONFIG_ERROR', 'Server configuration error');

  const svcClient = createClient(supabaseUrl, supabaseSvcKey);

  let body: { trade_id?: string };
  try { body = await req.json(); } catch { return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const { trade_id } = body;
  if (!trade_id) return errResp(400, 'MISSING_TRADE_ID', 'trade_id is required');

  // Load trade with seller payout info
  const { data: trade, error: tradeErr } = await svcClient
    .from('trades')
    .select(`
      id, status, payout_status, payout_amount_cents,
      seller_id, buyer_id, stripe_payment_intent_id,
      completed_at, payout_release_at
    `)
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) {
    console.error(`[initiate-payout] Trade query failed for ${trade_id}:`, tradeErr ? JSON.stringify(tradeErr) : 'no rows returned');
    return errResp(404, 'TRADE_NOT_FOUND', tradeErr ? tradeErr.message : 'Trade not found');
  }

  if (trade.status !== 'completed') {
    return errResp(400, 'INVALID_STATE', `Trade must be completed, current status: ${trade.status}`);
  }

  // Idempotency: check if payout already processed
  if (trade.payout_status === 'paid') {
    return new Response(
      JSON.stringify({ success: true, payout_status: 'paid', already_processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (trade.payout_status === 'processing') {
    return new Response(
      JSON.stringify({ success: true, payout_status: 'processing', already_processing: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // requires_action: payout was created by complete_trade_v2 but seller has no
  // payout method. Send BOTH an in-app and push notification and return — do NOT
  // attempt Stripe transfer. (§6.3.3)
  if (trade.payout_status === 'requires_action') {
    console.log(`[initiate-payout] Trade ${trade_id} has requires_action — sending notifications`);
    const efBaseUrl = `${supabaseUrl}/functions/v1`;
    let listingTitle = 'your item';
    let amountCents = trade.payout_amount_cents ?? 0;
    try {
      const { data: t } = await svcClient.from('trades').select('listing_id').eq('id', trade_id).single();
      if (t?.listing_id) {
        const { data: item } = await svcClient.from('items').select('title').eq('id', t.listing_id).maybeSingle();
        if (item?.title) listingTitle = item.title;
      }
    } catch { /* non-fatal */ }

    // 1. Create in-app notification via create_trade_notification RPC
    try {
      await svcClient.rpc('create_trade_notification', {
        p_user_id: trade.seller_id,
        p_notification_type: 'payout_requires_action',
        p_title: 'Payout Action Required',
        p_body: `Your ${listingTitle} sold! Add a payout method to receive your $${(amountCents / 100).toFixed(2)}.`,
        p_data: JSON.stringify({ trade_id, deep_link: '/payout-settings' }),
      });
      console.log(`[initiate-payout] In-app notification created for seller ${trade.seller_id}`);
    } catch (notifErr: unknown) {
      const msg = notifErr instanceof Error ? notifErr.message : 'Unknown error';
      console.error(`[initiate-payout] Failed to create in-app notification: ${msg}`);
    }

    // 2. Send push notification directly via send-push-notification (same proven
    //    path used by create_trade_notification — bypasses send-trade-notifications
    //    which silently returns sent=0 for reasons unknown)
    try {
      const pushResp = await fetch(`${efBaseUrl}/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseSvcKey}` },
        body: JSON.stringify({
          userId: trade.seller_id,
          title: 'Payout Action Required',
          body: `Your ${listingTitle} sold! Add a payout method to receive your $${(amountCents / 100).toFixed(2)}.`,
          data: {
            trade_id,
            type: 'payout_requires_action',
            event_type: 'payout_requires_action',
            deep_link: '/payout-settings',
            listing_title: listingTitle,
            amount_cents: amountCents,
          },
        }),
      });
      const pushBody = await pushResp.text();
      console.log(`[initiate-payout] Push notification responded: status=${pushResp.status} body=${pushBody}`);
    } catch (pushErr) {
      console.error(`[initiate-payout] Failed to send push notification:`, pushErr);
    }

    return new Response(
      JSON.stringify({ success: true, payout_status: 'requires_action', requires_action: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Load seller's Stripe Connect account.
  // Canonical source: seller_payout_methods.stripe_account_id (BP-73).
  // NOTE: profiles.stripe_connect_account_id DOES NOT EXIST (42703 on staging) —
  // this previously fell through to the requires_action path and the transfer
  // could never dispatch, so the Connect payout chain was unreachable.
  const { data: sellerPayoutMethod, error: pmError } = await svcClient
    .from('seller_payout_methods')
    .select('id, user_id, stripe_account_id')
    .eq('user_id', trade.seller_id)
    .eq('method_type', 'stripe_connect')
    .eq('is_primary', true)
    .maybeSingle();

  const connectAccountId = sellerPayoutMethod?.stripe_account_id ?? null;

  if (pmError) {
    console.error(`[initiate-payout] Seller payout method query failed:`, pmError);
  }

  if (!connectAccountId) {
    console.error(`[initiate-payout] Seller ${trade.seller_id} has no Stripe Connect account`);
    // Set requires_action so seller sees "Action Required" in payout UI (§6.3.3)
    // Also attempt to create the seller_payouts record if it doesn't exist yet.
    // (complete_trade_v2 should have done this, but handle the trigger-only path too.)
    const { data: existingPayout } = await svcClient
      .from('seller_payouts')
      .select('status')
      .eq('trade_id', trade_id)
      .maybeSingle();

    if (!existingPayout) {
      // Trigger-only path: complete_trade_v2 didn't create the payout record.
      // Call the RPC to create it with requires_action status.
      await svcClient.rpc('create_seller_payout_on_trade_completion', {
        p_trade_id: trade_id,
        p_seller_id: trade.seller_id,
        p_gross_amount_cents: trade.payout_amount_cents ?? 0,
      });
    } else {
      // Payout record already exists (set by complete_trade_v2). Just ensure status is correct.
      await svcClient
        .from('trades')
        .update({ payout_status: 'requires_action', updated_at: new Date().toISOString() })
        .eq('id', trade_id);
    }

    // N2 — Idempotency & Audit: payout requires action (no connect account).
    logFinancialAudit(svcClient, {
      mutationType: 'payout_requires_action',
      entityType: 'trade',
      entityId: trade_id,
      actorId: trade.seller_id,
      afterState: { payout_status: 'requires_action', reason: 'no_connect_account' },
      idempotencyKey: `payout_requires_action_${trade_id}`,
    });

    // Send BOTH in-app and push notification to seller directly
    // (bypasses send-trade-notifications which was silently returning sent=0)
    const efBaseUrl = `${supabaseUrl}/functions/v1`;
    let listingTitle = 'your item';
    let amountCents = trade.payout_amount_cents ?? 0;
    try {
      const { data: t } = await svcClient.from('trades').select('listing_id').eq('id', trade_id).single();
      if (t?.listing_id) {
        const { data: item } = await svcClient.from('items').select('title').eq('id', t.listing_id).maybeSingle();
        if (item?.title) listingTitle = item.title;
      }
    } catch { /* non-fatal */ }

    // 1. In-app notification
    try {
      await svcClient.rpc('create_trade_notification', {
        p_user_id: trade.seller_id,
        p_notification_type: 'payout_requires_action',
        p_title: 'Payout Action Required',
        p_body: `Your ${listingTitle} sold! Add a payout method to receive your $${(amountCents / 100).toFixed(2)}.`,
        p_data: JSON.stringify({ trade_id, deep_link: '/payout-settings' }),
      });
    } catch { /* non-fatal */ }

    // 2. Push notification
    try {
      const pushResp = await fetch(`${efBaseUrl}/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseSvcKey}` },
        body: JSON.stringify({
          userId: trade.seller_id,
          title: 'Payout Action Required',
          body: `Your ${listingTitle} sold! Add a payout method to receive your $${(amountCents / 100).toFixed(2)}.`,
          data: {
            trade_id,
            type: 'payout_requires_action',
            event_type: 'payout_requires_action',
            deep_link: '/payout-settings',
            listing_title: listingTitle,
            amount_cents: amountCents,
          },
        }),
      });
      const pushBody = await pushResp.text();
      console.log(`[initiate-payout] Path B push responded: status=${pushResp.status} body=${pushBody}`);
    } catch (pushErr) {
      console.error(`[initiate-payout] Path B push failed:`, pushErr);
    }

    return errResp(422, 'NO_CONNECT_ACCOUNT', 'Seller has not set up their payout account');
  }

  const ownership = await verifyStripeAccountOwnership(
    svcClient,
    trade.seller_id,
    connectAccountId,
  );
  if (!ownership.owned) {
    console.error('[initiate-payout] Stripe ownership verification failed', {
      trade_id,
      seller_id: trade.seller_id,
      stripe_account_id: connectAccountId,
      reason: ownership.error,
    });
    await svcClient
      .from('trades')
      .update({ payout_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', trade_id);
    return errResp(403, 'STRIPE_ACCOUNT_OWNERSHIP_DENIED', ownership.error || 'Seller Stripe ownership check failed');
  }

  if (!stripeKey) {
    return errResp(500, 'STRIPE_NOT_CONFIGURED', 'Payment provider not configured');
  }

  const payoutAmountCents = trade.payout_amount_cents ?? 0;
  if (payoutAmountCents <= 0) {
    console.log(`[initiate-payout] Trade ${trade_id} has zero payout (donate or cash-hold), marking paid`);
    await svcClient.from('trades').update({ payout_status: 'paid', payout_initiated_at: new Date().toISOString() }).eq('id', trade_id);
    return new Response(
      JSON.stringify({ success: true, payout_status: 'paid', amount_cents: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // R3 — Delayed Seller Payout + Buffer (defense-in-depth gate).
  // Even if this EF is invoked before the release date (a stray trigger call,
  // an admin retry, or a manual test), never dispatch before payout_release_at.
  // The release date is keyed off the ACTUAL completion timestamp
  // (trades.completed_at) + the buffer value in effect, read live from
  // admin_config (BP-28 — no hardcoded fallback beyond config default 0, which
  // preserves pre-feature immediate behavior).
  let releaseAt: Date | null = trade.payout_release_at ? new Date(trade.payout_release_at) : null;
  if (!releaseAt || Number.isNaN(releaseAt.getTime())) {
    let bufferDays = 0;
    try {
      const { data: bufferData } = await svcClient.rpc('fn_admin_config_int', {
        p_key: 'payout_buffer_days',
        p_default: 0,
      });
      bufferDays = Math.max(0, Math.min(30, Number(bufferData) || 0));
    } catch (cfgErr) {
      // Non-fatal: missing config ⇒ immediate release (backward compatible).
      console.error('[initiate-payout] Failed to read payout_buffer_days config:', cfgErr);
      bufferDays = 0;
    }
    const completedAt = trade.completed_at ? new Date(trade.completed_at) : new Date();
    releaseAt = new Date(completedAt.getTime() + bufferDays * 86400000);

    const releaseIso = releaseAt.toISOString();
    await svcClient.from('trades').update({
      payout_release_at: releaseIso,
      updated_at: new Date().toISOString(),
    }).eq('id', trade_id);
    await svcClient.from('seller_payouts').update({
      payout_release_at: releaseIso,
      updated_at: new Date().toISOString(),
    }).eq('trade_id', trade_id);
  }

  if (releaseAt.getTime() > Date.now()) {
    console.log(`[initiate-payout] Trade ${trade_id} payout scheduled until ${releaseAt.toISOString()} — not dispatching yet`);
    await svcClient.from('trade_events').insert({
      trade_id,
      event_name: 'payout_scheduled',
      user_id: trade.seller_id,
      metadata: {
        payout_release_at: releaseAt.toISOString(),
        amount_cents: payoutAmountCents,
      },
    });
    // N2 — Idempotency & Audit: payout scheduled (not yet dispatched).
    logFinancialAudit(svcClient, {
      mutationType: 'payout_scheduled',
      entityType: 'trade',
      entityId: trade_id,
      actorId: trade.seller_id,
      afterState: { payout_status: 'pending', payout_release_at: releaseAt.toISOString(), amount_cents: payoutAmountCents },
      amountCents: payoutAmountCents,
      idempotencyKey: `payout_scheduled_${trade_id}`,
    });
    return new Response(
      JSON.stringify({ success: true, payout_status: 'pending', scheduled_for: releaseAt.toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Mark as processing (idempotency)
  await svcClient.from('trades').update({
    payout_status:        'processing',
    payout_initiated_at:  new Date().toISOString(),
    updated_at:           new Date().toISOString(),
  }).eq('id', trade_id);

  // N2 — Idempotency & Audit: payout initiated.
  logFinancialAudit(svcClient, {
    mutationType: 'payout_initiated',
    entityType: 'trade',
    entityId: trade_id,
    actorId: trade.seller_id,
    afterState: { payout_status: 'processing', amount_cents: payoutAmountCents },
    amountCents: payoutAmountCents,
    idempotencyKey: `payout_${trade_id}`,
  });

  // The pinned stripe@12.0.0 SDK types only expose '2022-11-15' as its latest
  // API version literal, but this function intentionally pins '2023-10-16'
  // (the deployed behavior). Cast through unknown to keep the deployed API
  // version while satisfying the strict SDK type (BP-25 gate).
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as unknown as '2022-11-15' });

  try {
    const transfer = await stripe.transfers.create({
      amount:      payoutAmountCents,
      currency:    'usd',
      destination: connectAccountId,
      metadata:    {
        trade_id,
        seller_id: trade.seller_id,
        buyer_id:  trade.buyer_id,
      },
      // Idempotency key prevents double-transfer
    }, {
      idempotencyKey: `payout-${trade_id}`,
    });

    // Mark payout as paid
    await svcClient.from('trades').update({
      payout_status:    'paid',
      stripe_transfer_id: transfer.id,
      payout_paid_at:   new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }).eq('id', trade_id);

    await svcClient.from('trade_events').insert({
      trade_id, event_type: 'payout_sent', actor_id: trade.seller_id,
      metadata: { transfer_id: transfer.id, amount_cents: payoutAmountCents },
    });

    // N2 — Idempotency & Audit: payout paid.
    logFinancialAudit(svcClient, {
      mutationType: 'payout_paid',
      entityType: 'trade',
      entityId: trade_id,
      actorId: trade.seller_id,
      afterState: { stripe_transfer_id: transfer.id, amount_cents: payoutAmountCents, payout_status: 'paid' },
      amountCents: payoutAmountCents,
      idempotencyKey: `payout_${trade_id}`,
    });

    // Notify seller
    await svcClient.from('notification_log').insert({
      user_id:           trade.seller_id,
      notification_type: 'payout_sent',
      payload:           { trade_id, transfer_id: transfer.id, amount_cents: payoutAmountCents },
      sent_at:           new Date().toISOString(),
    });

    console.log(`[initiate-payout] Transfer ${transfer.id} sent for trade ${trade_id}, amount: ${payoutAmountCents} cents`);

    return new Response(
      JSON.stringify({ success: true, transfer_id: transfer.id, payout_status: 'paid', amount_cents: payoutAmountCents }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[initiate-payout] Stripe transfer error:', msg);

    await svcClient.from('trades').update({
      payout_status: 'failed',
      updated_at:    new Date().toISOString(),
    }).eq('id', trade_id);

    await svcClient.from('trade_events').insert({
      trade_id, event_type: 'payout_failed', actor_id: trade.seller_id,
      metadata: { error: msg },
    });

    // N2 — Idempotency & Audit: payout failed.
    logFinancialAudit(svcClient, {
      mutationType: 'payout_failed',
      entityType: 'trade',
      entityId: trade_id,
      actorId: trade.seller_id,
      afterState: { payout_status: 'failed', error: msg },
      idempotencyKey: `payout_failed_${trade_id}`,
    });

    return errResp(502, 'STRIPE_TRANSFER_FAILED', `Payout failed: ${msg}`);
  }
});
