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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { verifyStripeAccountOwnership } from '../_shared/verify-stripe-ownership.ts';

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
      platform_fee_cents
    `)
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) return errResp(404, 'TRADE_NOT_FOUND', 'Trade not found');

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

  // Load seller's Stripe Connect account
  const { data: sellerProfile } = await svcClient
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('user_id', trade.seller_id)
    .single();

  if (!sellerProfile?.stripe_connect_account_id) {
    console.error(`[initiate-payout] Seller ${trade.seller_id} has no Stripe Connect account`);
    // Mark payout as failed
    await svcClient.from('trades').update({ payout_status: 'failed', updated_at: new Date().toISOString() }).eq('id', trade_id);
    return errResp(422, 'NO_CONNECT_ACCOUNT', 'Seller has not set up their payout account');
  }

  const ownership = await verifyStripeAccountOwnership(
    svcClient,
    trade.seller_id,
    sellerProfile.stripe_connect_account_id,
  );
  if (!ownership.owned) {
    console.error('[initiate-payout] Stripe ownership verification failed', {
      trade_id,
      seller_id: trade.seller_id,
      stripe_account_id: sellerProfile.stripe_connect_account_id,
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

  // Mark as processing (idempotency)
  await svcClient.from('trades').update({
    payout_status:        'processing',
    payout_initiated_at:  new Date().toISOString(),
    updated_at:           new Date().toISOString(),
  }).eq('id', trade_id);

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  try {
    const transfer = await stripe.transfers.create({
      amount:      payoutAmountCents,
      currency:    'usd',
      destination: sellerProfile.stripe_connect_account_id,
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

    return errResp(502, 'STRIPE_TRANSFER_FAILED', `Payout failed: ${msg}`);
  }
});
