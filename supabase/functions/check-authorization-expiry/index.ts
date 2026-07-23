// File: supabase/functions/check-authorization-expiry/index.ts
// D-30: Cron EF — auto-cancels expired Stripe pre-auth holds.
// Triggered every 30 minutes by pg_cron (or HTTP).
// Finds all pending trades where authorization_expires_at < NOW() and cancels their PI.
//
// Service role only — no user JWT needed.
// Input:  {} (no body required)
// Output: { success: true, processed: number, cancelled: number }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const supabaseSvcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey      = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !supabaseSvcKey) {
    return new Response(JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const svcClient = createClient(supabaseUrl, supabaseSvcKey);

  // Find pending trades with expired authorization
  const { data: expiredTrades, error: queryErr } = await svcClient
    .from('trades')
    .select('id, buyer_id, stripe_payment_intent_id, authorization_expires_at')
    .eq('status', 'pending')
    .not('stripe_payment_intent_id', 'is', null)
    .lt('authorization_expires_at', new Date().toISOString());

  if (queryErr) {
    console.error('[check-authorization-expiry] Query error:', queryErr);
    return new Response(JSON.stringify({ success: false, error: { code: 'QUERY_FAILED' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const trades = expiredTrades ?? [];
  console.log(`[check-authorization-expiry] Found ${trades.length} expired authorizations`);

  let cancelled = 0;

  if (trades.length > 0 && stripeKey) {
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    const now = new Date().toISOString();

    for (const trade of trades) {
      try {
        // Cancel the PI
        const pi = await stripe.paymentIntents.retrieve(trade.stripe_payment_intent_id);
        if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture'].includes(pi.status)) {
          await stripe.paymentIntents.cancel(trade.stripe_payment_intent_id);
        }

        // Cancel the trade
        await svcClient.from('trades').update({
          status:               'cancelled',
          cancellation_reason:  'authorization_expired',
          updated_at:           now,
        }).eq('id', trade.id);

        // Log event
        await svcClient.from('trade_events').insert({
          trade_id:   trade.id,
          event_type: 'payment_failed',
          actor_id:   trade.buyer_id,
          metadata:   {
            reason:        'authorization_expired',
            stripe_pi:     trade.stripe_payment_intent_id,
            expires_at:    trade.authorization_expires_at,
          },
        });

        // TAX-STATUS-LIFECYCLE: Void the tax record for this expired authorization
        try {
          await svcClient.rpc('rpc_void_tax_for_trade', {
            p_trade_id: trade.id,
            p_reason: 'authorization_expired',
          });
        } catch (taxErr: unknown) {
          const msg = taxErr instanceof Error ? taxErr.message : 'Unknown error';
          console.error(`[check-authorization-expiry] Tax void error for trade ${trade.id}:`, msg);
        }

        cancelled++;
        console.log(`[check-authorization-expiry] Cancelled expired trade ${trade.id}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[check-authorization-expiry] Error on trade ${trade.id}:`, msg);
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, processed: trades.length, cancelled }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
