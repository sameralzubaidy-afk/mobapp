// File: supabase/functions/release-payment/index.ts
// TFV2-006: Cancel a Stripe PaymentIntent pre-auth hold for a PENDING trade.
// Called when a trade is cancelled BEFORE the offer is accepted (pre-auth only, no capture).
// D-30: Stripe hold was placed at offer submission (create-trade-offer EF).
// This EF is idempotent: safe to call even if PI is already cancelled.
//
// Input:  { trade_id }
// Output: { success: true, stripe_status } | { error }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

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

  // Service role — this EF is called internally / by cancel-trade EF
  const svcClient = createClient(supabaseUrl, supabaseSvcKey);

  // Auth: support both user JWT and service-to-service calls
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  // Validate caller is authenticated (user or service)
  let callerUserId: string | null = null;
  if (token) {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (anonKey) {
      const tempClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await tempClient.auth.getUser(token);
      callerUserId = user?.id ?? null;
    }
  }

  let body: { trade_id?: string };
  try { body = await req.json(); } catch { return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const { trade_id } = body;
  if (!trade_id) return errResp(400, 'MISSING_TRADE_ID', 'trade_id is required');

  // Load trade
  const { data: trade, error: tradeErr } = await svcClient
    .from('trades')
    .select('id, status, stripe_payment_intent_id, buyer_id')
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) return errResp(404, 'TRADE_NOT_FOUND', 'Trade not found');

  // Caller must be buyer or service
  if (callerUserId && callerUserId !== trade.buyer_id) {
    return errResp(403, 'FORBIDDEN', 'Only the buyer can release payment');
  }

  // Only pending trades have uncaptured pre-auth holds
  if (trade.status !== 'pending' && trade.status !== 'cancelled') {
    return errResp(400, 'INVALID_STATE', `Cannot release payment for trade in status: ${trade.status}`);
  }

  if (!trade.stripe_payment_intent_id) {
    // No PI — nothing to release (cash-only or SP-only trade)
    console.log(`[release-payment] Trade ${trade_id} has no PI, nothing to release`);
    return new Response(
      JSON.stringify({ success: true, stripe_status: 'no_payment_intent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!stripeKey) {
    console.error('[release-payment] STRIPE_SECRET_KEY not configured');
    return errResp(500, 'STRIPE_NOT_CONFIGURED', 'Payment provider not configured');
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  // Idempotency: check current PI status before cancelling
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(trade.stripe_payment_intent_id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[release-payment] Stripe retrieve error:', msg);
    return errResp(502, 'STRIPE_ERROR', `Stripe retrieve failed: ${msg}`);
  }

  let stripeStatus = pi.status;

  if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation' ||
      pi.status === 'requires_action' || pi.status === 'requires_capture') {
    try {
      const cancelled = await stripe.paymentIntents.cancel(trade.stripe_payment_intent_id);
      stripeStatus = cancelled.status;
      console.log(`[release-payment] PI ${trade.stripe_payment_intent_id} cancelled for trade ${trade_id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[release-payment] Stripe cancel error:', msg);
      return errResp(502, 'STRIPE_CANCEL_FAILED', `Stripe cancel failed: ${msg}`);
    }
  } else if (pi.status === 'canceled') {
    // Already cancelled — idempotent OK
    console.log(`[release-payment] PI ${trade.stripe_payment_intent_id} already cancelled`);
  } else {
    // PI is succeeded/processing — cannot cancel
    return errResp(400, 'PI_NOT_CANCELLABLE', `PaymentIntent in status '${pi.status}' cannot be cancelled`);
  }

  // Update trade to mark payment released
  await svcClient.from('trades').update({
    stripe_payment_released_at: new Date().toISOString(),
    updated_at:                 new Date().toISOString(),
  }).eq('id', trade_id);

  await svcClient.from('trade_events').insert({
    trade_id, event_type: 'payment_failed', actor_id: callerUserId ?? trade.buyer_id,
    metadata: { stripe_pi: trade.stripe_payment_intent_id, stripe_status: stripeStatus, action: 'pre_auth_released' },
  }).then(({ error }) => {
    if (error) console.error('[release-payment] Event log error:', error.message);
  });

  return new Response(
    JSON.stringify({ success: true, stripe_status: stripeStatus }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
