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
    .select('id, status, dispute_status, buyer_id, seller_id, stripe_payment_intent_id, sp_amount')
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

  const { error: resolveErr } = await svcClient
    .from('trades')
    .update({
      dispute_status:     'resolved',
      dispute_resolution: resolution,
      dispute_resolved_at: now,
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
