// File: supabase/functions/resolve-dispute/index.ts
// TFV2-017: Admin resolves a reported dispute.
// Input:  { trade_id, action: 'mark_under_review' | 'resolve_complete' | 'resolve_refund', notes? }
// Output: { success: true, dispute_status } | { error }
//
// mark_under_review: reported → under_review
// resolve_complete:  under_review → resolved (release seller payment, SP released normally)
// resolve_refund:    under_review → resolved (cancel Stripe PI, refund buyer, return SP)
//
// SECURITY: Requires admin role — validated via profiles.role = 'admin'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.11.0';

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
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseSvcKey) {
    return errResp(500, 'CONFIG_ERROR', 'Server configuration error');
  }

  // Auth: validate user is admin
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  const anonClient = createClient(supabaseUrl, supabaseAnonKey || supabaseSvcKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return errResp(401, 'UNAUTHORIZED', 'Invalid or missing auth token');

  // Service role client for DB writes
  const svcClient = createClient(supabaseUrl, supabaseSvcKey);

  // Verify admin role
  const { data: profile } = await svcClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return errResp(403, 'FORBIDDEN', 'Admin access required');
  }

  let body: { trade_id?: string; action?: string; notes?: string };
  try { body = await req.json(); } catch { return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const { trade_id, action, notes } = body;
  if (!trade_id) return errResp(400, 'MISSING_TRADE_ID', 'trade_id is required');

  const validActions = ['mark_under_review', 'resolve_complete', 'resolve_refund'];
  if (!action || !validActions.includes(action)) {
    return errResp(400, 'INVALID_ACTION', `action must be one of: ${validActions.join(', ')}`);
  }

  // Load trade
  const { data: trade, error: tradeErr } = await svcClient
    .from('trades')
    .select('id, status, dispute_status, buyer_id, seller_id, stripe_payment_intent_id, sp_amount, cash_amount_cents, stripe_refund_id')
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) return errResp(404, 'TRADE_NOT_FOUND', 'Trade not found');
  if (!trade.dispute_status || trade.dispute_status === 'none') {
    return errResp(400, 'NO_DISPUTE', 'Trade has no active dispute');
  }

  const now = new Date().toISOString();

  if (action === 'mark_under_review') {
    if (trade.dispute_status !== 'reported') {
      return errResp(400, 'INVALID_STATE', `Expected dispute_status 'reported', got '${trade.dispute_status}'`);
    }
    await svcClient.from('trades').update({ dispute_status: 'under_review', updated_at: now }).eq('id', trade_id);

    await svcClient.from('trade_events').insert({
      trade_id, event_type: 'trade_disputed', actor_id: user.id,
      metadata: { action: 'marked_under_review', admin_id: user.id },
    });

    // DEV-TASK-62 (Item 1): record the acting admin in the audit trail.
    await svcClient.from('admin_audit_logs').insert({
      actor_id: user.id,
      action_type: 'dispute_marked_under_review',
      entity_type: 'trade',
      entity_id: trade_id,
      payload: { action: 'mark_under_review', previous_status: 'reported', admin_id: user.id },
      reason: notes?.substring(0, 500) ?? null,
    });

    return new Response(
      JSON.stringify({ success: true, dispute_status: 'under_review' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // resolve_complete or resolve_refund — must be under_review (or reported)
  if (!['reported', 'under_review'].includes(trade.dispute_status)) {
    return errResp(400, 'ALREADY_RESOLVED', 'Dispute is already resolved');
  }

  // NOTE: dispute_resolution CHECK constraint only allows: NULL, 'open', 'resolved_buyer', 'resolved_seller', 'rejected'
  const resolution = action === 'resolve_complete' ? 'resolved_seller' : 'resolved_buyer';

  // DEV-TASK-85 (QA Task 18 R10 money-flow gap — HIGH): complete_trade_v2 is a
  // DB-only RPC — it assumes the CALLER already captured the buyer's Stripe
  // authorization hold (the normal completion EFs capture FIRST, then call the
  // complete RPC). resolve_complete previously skipped the capture leg: it
  // completed the trade + created the seller_payouts row + scheduled a Connect
  // transfer against an UNCAPTURED hold (buyer never charged; auth auto-expires
  // after ~7d). Capture here, BEFORE any dispute/completion mutation, so a
  // payout can never be scheduled against an uncaptured hold. Mirror the
  // resolve_refund branch's status-aware Stripe handling below.
  const piForComplete = (trade as { stripe_payment_intent_id?: string | null }).stripe_payment_intent_id ?? null;
  const cashForComplete = Number((trade as { cash_amount_cents?: number }).cash_amount_cents ?? 0);
  const refundIdForComplete = (trade as { stripe_refund_id?: string | null }).stripe_refund_id ?? null;
  const tradeStatusForComplete = (trade as { status?: string }).status ?? '';

  if (
    action === 'resolve_complete' &&
    piForComplete &&
    cashForComplete > 0 &&
    !refundIdForComplete &&
    tradeStatusForComplete !== 'completed'
  ) {
    const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
    if (stripeKey && stripeKey.startsWith('sk_')) {
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      try {
        const pi = await stripe.paymentIntents.retrieve(piForComplete);
        if (pi.status === 'requires_capture') {
          // Uncaptured authorization hold → capture it (actually charge the buyer).
          const captured = await stripe.paymentIntents.capture(piForComplete);
          if (captured.status !== 'succeeded') {
            console.error(`[resolve-dispute] PI capture returned status ${captured.status} for trade ${trade_id}`);
            return errResp(502, 'CAPTURE_FAILED', 'We could not charge the buyer for this trade, so it was not completed. No payout was created.');
          }
          const chargeId = captured.latest_charge ?? null;
          console.log(`[resolve-dispute] PI ${piForComplete} captured (charge ${chargeId}) for dispute-complete trade ${trade_id}`);

          // Mark tax as collected (idempotent — mirrors the complete-trade EF).
          try {
            await svcClient.rpc('rpc_mark_tax_collected', {
              p_trade_id: trade_id,
              p_stripe_capture_id: chargeId,
            });
          } catch (taxErr: unknown) {
            const msg = taxErr instanceof Error ? taxErr.message : 'Unknown error';
            console.error(`[resolve-dispute] rpc_mark_tax_collected error (non-fatal): ${msg}`);
          }

          // N2 — Idempotency & Audit: record payment_captured (parity with the
          // complete-trade EF; idempotency key dedupes retries).
          try {
            await svcClient.rpc('fn_log_financial_audit', {
              p_mutation_type: 'payment_captured',
              p_entity_type: 'trade',
              p_entity_id: trade_id,
              p_actor_id: user.id,
              p_before_state: { stripe_payment_intent_id: piForComplete },
              p_after_state: { stripe_payment_intent_id: piForComplete, stripe_charge_id: chargeId, source: 'dispute_resolve_complete' },
              p_amount_cents: cashForComplete,
              p_idempotency_key: `capture_${trade_id}`,
              p_node_id: null,
            });
          } catch (auditErr: unknown) {
            const msg = auditErr instanceof Error ? auditErr.message : 'Unknown error';
            console.error(`[resolve-dispute] payment_captured audit error (non-fatal): ${msg}`);
          }
        } else if (pi.status === 'succeeded') {
          // Already captured (e.g. a completed-then-disputed edge) — nothing to do.
          console.log(`[resolve-dispute] PI ${piForComplete} already captured — skipping capture for trade ${trade_id}`);
        } else {
          // canceled / requires_payment_method / etc — money can never be collected.
          return errResp(
            409,
            'PI_NOT_CAPTURABLE',
            `The buyer's payment (${pi.status}) can't be captured, so this trade was not completed. No payout was created — resolve with a refund instead.`,
          );
        }
      } catch (captureErr: unknown) {
        const msg = captureErr instanceof Error ? captureErr.message : 'Stripe capture error';
        console.error(`[resolve-dispute] Stripe capture error for trade ${trade_id}: ${msg}`);
        return errResp(502, 'STRIPE_CAPTURE_ERROR', `We couldn't capture the buyer's payment. No payout was created.`);
      }
    } else {
      console.error('[resolve-dispute] STRIPE_SECRET_KEY not configured — refusing to complete against an uncaptured hold');
      return errResp(500, 'STRIPE_CONFIG_ERROR', 'Payment system not configured — cannot capture the buyer hold before completing.');
    }
  }

  const { error: resolveErr } = await svcClient
    .from('trades')
    .update({
      dispute_status:     'resolved',
      dispute_resolution: resolution,
      dispute_resolved_at: now,
      dispute_resolved_by: user.id,   // DEV-TASK-62 (Item 1): who resolved it
      updated_at:         now,
      // resolve_complete: status/completed_at are delegated to complete_trade_v2 below
      //                   (DEV-TASK-48: writing status='completed' directly here skipped
      //                   the payout math and left payout_amount_cents NULL → $0 payout);
      //                   resolve_refund: cancelled (refund path unchanged).
      ...(action === 'resolve_refund'
        ? { status: 'cancelled', cancellation_reason: 'dispute_resolved_refund' }
        : {}),
    })
    .eq('id', trade_id);

  if (resolveErr) {
    console.error('[resolve-dispute] Resolve error:', resolveErr);
    return errResp(500, 'UPDATE_FAILED', 'Failed to resolve dispute');
  }

  // DEV-TASK-48 (P1): resolve_complete must run the SAME canonical completion money
  // path as normal buyer completion — complete_trade_v2 computes
  // payout_amount_cents = GREATEST(0, cash − seller_fee), marks the item sold and
  // creates the seller_payouts row. Previously resolve_complete skipped all of this,
  // so initiate-payout read NULL → processed $0.
  if (action === 'resolve_complete') {
    const { data: completion, error: completeErr } = await svcClient.rpc('complete_trade_v2', {
      p_trade_id: trade_id,
      p_user_id:  trade.buyer_id,
    });
    if (completeErr) {
      console.error('[resolve-dispute] complete_trade_v2 error:', completeErr);
      return errResp(500, 'COMPLETE_FAILED', 'Failed to finalize trade completion');
    }
    if (completion && completion.success === false) {
      console.error('[resolve-dispute] complete_trade_v2 returned failure:', completion);
      return errResp(500, 'COMPLETE_FAILED', completion.error ?? 'Failed to finalize trade completion');
    }
  }

  // TAX-STATUS-LIFECYCLE: On refund path, cancel the Stripe PI and void/refund tax
  if (action === 'resolve_refund') {
    // Cancel PI (for in_progress trades where PI was captured, issue a refund)
    if (trade.stripe_payment_intent_id) {
      const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
      if (stripeKey && stripeKey.startsWith('sk_')) {
        const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
        try {
          // Check if already refunded (idempotency)
          const { data: existingRefund } = await svcClient
            .from('trades')
            .select('stripe_refund_id')
            .eq('id', trade_id)
            .single();

          if (!existingRefund?.stripe_refund_id) {
            // TAX-STATUS-LIFECYCLE (2026-07-23): An in_progress trade's PI is usually an
            // UNCAPTURED authorization hold (capture happens only at buyer completion).
            // Stripe does NOT allow refunds on uncaptured PIs — they must be CANCELLED.
            // Previously this branch unconditionally refunded, which failed on uncaptured
            // PIs and left the Stripe transaction stuck as "uncaptured" (TC-O3-C07).
            const pi = await stripe.paymentIntents.retrieve(trade.stripe_payment_intent_id);

            if (pi.status === 'requires_capture' || pi.status === 'processing') {
              // Uncaptured authorization hold — cancel it (can't be refunded).
              const cancelled = await stripe.paymentIntents.cancel(trade.stripe_payment_intent_id, {
                cancellation_reason: 'requested_by_customer',
              });
              console.log(`[resolve-dispute] PI ${pi.id} cancelled (uncaptured) for trade ${trade_id}`);
              await svcClient.from('trades').update({ stripe_refund_id: `cancelled_${cancelled.id}` }).eq('id', trade_id);
              // Tax is voided below via rpc_void_tax_for_trade (quoted → voided). No
              // rpc_record_stripe_refund here — nothing was captured to refund.
            } else if (pi.status === 'succeeded') {
              // Captured payment — issue a refund
              console.log(`[resolve-dispute] Issuing Stripe refund for PI: ${trade.stripe_payment_intent_id}`);
              // DEV-TASK-6 (2026-08-27): idempotency key (options arg, BP-65) so a
              // timeout-retry of the same dispute refund can never issue a duplicate
              // Stripe refund. Close the check-then-act gap: if the charge was ALREADY
              // refunded by a prior attempt, reconcile the existing refund id from
              // Stripe instead of silently leaving trades.stripe_refund_id null.
              let refundId: string;
              let refundStatus = 'succeeded';
              try {
                const refund = await stripe.refunds.create(
                  {
                    payment_intent: trade.stripe_payment_intent_id,
                    reason: 'requested_by_customer',
                    metadata: { supabase_trade_id: trade_id, admin_action: 'resolve_dispute_refund' },
                  },
                  { idempotencyKey: `refund_${trade_id}` },
                );
                refundId = refund.id;
                refundStatus = refund.status;
              } catch (refundErr: unknown) {
                const err = refundErr as { code?: string; message?: string };
                const alreadyRefunded =
                  err?.code === 'charge_already_refunded' ||
                  /already been refunded/i.test(err?.message ?? '');
                if (!alreadyRefunded) throw refundErr;
                const existing = await stripe.refunds.list({
                  payment_intent: trade.stripe_payment_intent_id,
                  limit: 5,
                });
                const prior = existing?.data?.[0];
                if (!prior?.id) throw refundErr;
                refundId = prior.id;
                refundStatus = prior.status ?? 'succeeded';
                console.log(
                  `[resolve-dispute] Charge already refunded — reconciled existing refund ${refundId} for trade ${trade_id}`,
                );
              }

              await svcClient.from('trades').update({ stripe_refund_id: refundId }).eq('id', trade_id);

              // TAX-REFUND-INTEGRITY (2026-07-24): Use the new rpc_record_stripe_refund
              // which is idempotent and only reverses tax after Stripe confirms the refund.
              try {
                const { data: taxRecord } = await svcClient
                  .from('tax_records')
                  .select('tax_amount_cents')
                  .eq('trade_id', trade_id)
                  .maybeSingle();

                if (taxRecord && (taxRecord as { tax_amount_cents: number }).tax_amount_cents > 0) {
                  await svcClient.rpc('rpc_record_stripe_refund', {
                    p_trade_id: trade_id,
                    p_stripe_refund_id: refundId,
                    p_refund_amount_cents: (taxRecord as { tax_amount_cents: number }).tax_amount_cents,
                    p_refund_status: refundStatus,
                    p_refund_reason: 'dispute_resolved_refund',
                    p_initiating_actor: 'admin',
                  });
                }
              } catch (taxRefundErr: unknown) {
                const msg = taxRefundErr instanceof Error ? taxRefundErr.message : 'Unknown error';
                console.error(`[resolve-dispute] Tax refund error: ${msg}`);
              }
            } else {
              // canceled / requires_payment_method / etc — nothing to refund or cancel
              console.log(`[resolve-dispute] PI ${pi.id} status is ${pi.status} — no refund/cancel issued`);
            }
          } else {
            console.log(`[resolve-dispute] Refund already exists (${existingRefund.stripe_refund_id}), skipping Stripe refund`);
          }
        } catch (stripeErr: unknown) {
          const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
          console.error(`[resolve-dispute] Stripe refund error (non-fatal): ${msg}`);
        }
      }
    }

    // Void tax if not already refunded (fallback for zero-cash trades or tax-only refund failure)
    try {
      await svcClient.rpc('rpc_void_tax_for_trade', {
        p_trade_id: trade_id,
        p_reason: 'dispute_resolved_refund',
      });
    } catch (voidTaxErr: unknown) {
      const msg = voidTaxErr instanceof Error ? voidTaxErr.message : 'Unknown error';
      console.error(`[resolve-dispute] Tax void error (non-fatal): ${msg}`);
    }

    // SP release
    if (trade.sp_amount && trade.sp_amount > 0) {
      await svcClient.rpc('fn_release_sp_on_cancel', { p_trade_id: trade_id }).then(({ error }) => {
        if (error) console.error('[resolve-dispute] SP release error:', error.message);
      });
    }
  }

  // Log event
  await svcClient.from('trade_events').insert({
    trade_id, event_type: action === 'resolve_complete' ? 'trade_completed' : 'offer_cancelled',
    actor_id: user.id,
    metadata: { resolution, notes: notes?.substring(0, 500), admin_id: user.id },
  });

  // DEV-TASK-62 (Item 1): record the resolution + the acting admin in the
  // audit trail (admin_audit_logs — the money/trade trail).
  await svcClient.from('admin_audit_logs').insert({
    actor_id: user.id,
    action_type: 'dispute_resolved',
    entity_type: 'trade',
    entity_id: trade_id,
    payload: { action, resolution, notes: notes?.substring(0, 500), admin_id: user.id },
    reason: notes?.substring(0, 500) ?? null,
  });

  // Notify buyer + seller (non-blocking)
  const notifPayload = { trade_id, resolution, action };
  await svcClient.from('notification_log').insert([
    { user_id: trade.buyer_id,  notification_type: 'dispute_resolved', payload: notifPayload, sent_at: now },
    { user_id: trade.seller_id, notification_type: 'dispute_resolved', payload: notifPayload, sent_at: now },
  ]).then(({ error }) => {
    if (error) console.error('[resolve-dispute] Notif log error:', error.message);
  });

  console.log(`[resolve-dispute] Trade ${trade_id} dispute resolved: ${resolution} by admin ${user.id}`);

  return new Response(
    JSON.stringify({ success: true, dispute_status: 'resolved', resolution }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
