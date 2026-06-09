// File: supabase/functions/transactions-update/index.ts
// TFV2-013: Seller accepts or declines a pending offer.
// Input:  { trade_id, action: 'accept' | 'decline' }
// Output: { success: true, status, auto_complete_at? } | { error }
//
// Accept: pending → in_progress, sets auto_complete_at from admin_config, auto-declines competing offers
// Decline: pending → cancelled

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

  const supabaseUrl     = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseSvcKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSvcKey) {
    return errResp(500, 'CONFIG_ERROR', 'Server configuration error');
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return errResp(401, 'UNAUTHORIZED', 'Invalid or missing auth token');

  let body: { trade_id?: string; action?: string };
  try { body = await req.json(); } catch { return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const { trade_id, action } = body;
  if (!trade_id) return errResp(400, 'MISSING_TRADE_ID', 'trade_id is required');
  if (action !== 'accept' && action !== 'decline') {
    return errResp(400, 'INVALID_ACTION', "action must be 'accept' or 'decline'");
  }

  // Load trade — RLS allows seller to view
  const { data: trade, error: tradeErr } = await supabase
    .from('trades')
    .select('id, status, seller_id, buyer_id, listing_id, stripe_payment_intent_id, cash_amount_cents, auto_complete_at, sp_amount')
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) return errResp(404, 'TRADE_NOT_FOUND', 'Trade not found or access denied');
  if (trade.seller_id !== user.id) return errResp(403, 'FORBIDDEN', 'Only the seller can accept/decline offers');
  // D-30: Trade starts as in_progress (Stripe pre-auth held at submission)
  // Seller may only accept/decline before auto_complete_at is set
  // Accept both 'pending' (legacy) and 'in_progress' (D-30) for backward compatibility
  const VALID_DECLINE_STATUSES = ['pending', 'in_progress'];
  if (!VALID_DECLINE_STATUSES.includes(trade.status) || trade.auto_complete_at !== null) {
    return errResp(400, 'INVALID_STATE', `Trade status is '${trade.status}', expected one of: ${VALID_DECLINE_STATUSES.join(', ')} (not yet accepted)`);
  }

  const svcClient = createClient(supabaseUrl, supabaseSvcKey!);

  if (action === 'decline') {
    // D-30: Cancel the Stripe pre-auth hold (release authorization)
    if (trade.stripe_payment_intent_id && (trade.cash_amount_cents ?? 0) > 0) {
      const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
      if (stripeKey && stripeKey.startsWith('sk_')) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
          await stripe.paymentIntents.cancel(trade.stripe_payment_intent_id);
          console.log(`[transactions-update] PI ${trade.stripe_payment_intent_id} cancelled (decline)`);
        } catch (cancelErr: unknown) {
          const msg = cancelErr instanceof Error ? cancelErr.message : 'Stripe cancel error';
          console.error(`[transactions-update] Stripe PI cancel error (non-fatal):`, msg);
        }
      }
    }

    const { error: declineErr } = await svcClient
      .from('trades')
      .update({ status: 'cancelled', cancellation_reason: 'seller_declined', updated_at: new Date().toISOString() })
      .eq('id', trade_id);

    if (declineErr) {
      console.error('[transactions-update] Decline update failed:', declineErr.message);
      return errResp(500, 'UPDATE_FAILED', 'Failed to decline offer');
    }

    // Restore buyer's SP to available_balance (trigger will release reserved_sp automatically)
    const spAmount = trade.sp_amount ?? 0;
    if (spAmount > 0) {
      try {
        const { error: spErr } = await svcClient.rpc('credit_sp_for_cancelled_trade', {
          p_user_id: trade.buyer_id,
          p_trade_id: trade_id,
          p_points: spAmount
        });
        if (spErr) {
          console.error('[transactions-update] SP refund error:', spErr.message);
          // Continue with decline even if SP refund fails - buyer can contact support
        } else {
          console.log(`[transactions-update] Refunded ${spAmount} SP to buyer ${trade.buyer_id} for trade ${trade_id}`);
        }
      } catch (spErr: unknown) {
        const msg = spErr instanceof Error ? spErr.message : 'Unknown error';
        console.error('[transactions-update] SP refund error:', msg);
      }
    }

    // Log trade event (try/catch — non-fatal)
    try {
      await svcClient.from('trade_events').insert({
        trade_id, event_type: 'offer_cancelled', actor_id: user.id,
        metadata: { action: 'declined_by_seller' },
      });
    } catch (eventErr: unknown) {
      const msg = eventErr instanceof Error ? eventErr.message : 'Unknown error';
      console.error('[transactions-update] Trade event insert error:', msg);
    }

    // Notify buyer of decline
    try {
      await svcClient.rpc('create_trade_notification', {
        p_user_id:           trade.buyer_id,
        p_notification_type: 'offer_cancelled',
        p_title:             'Offer Declined',
        p_body:              'Your offer was declined by the seller.',
        p_data:              JSON.stringify({ trade_id, listing_id: trade.listing_id }),
      });
    } catch (notifErr: unknown) {
      const msg = notifErr instanceof Error ? notifErr.message : 'Unknown error';
      console.error(`[transactions-update] Decline notification error:`, msg);
    }

    return new Response(
      JSON.stringify({ success: true, status: 'cancelled' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // --- ACCEPT ---
  // D-30: Capture the Stripe pre-authorization (convert hold → charge)
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
  if (trade.stripe_payment_intent_id && (trade.cash_amount_cents ?? 0) > 0) {
    if (!stripeKey || !stripeKey.startsWith('sk_')) {
      return errResp(500, 'STRIPE_CONFIG_ERROR', 'Payment system not configured');
    }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    try {
      const captured = await stripe.paymentIntents.capture(trade.stripe_payment_intent_id);
      if (captured.status !== 'succeeded') {
        // Capture failed — cancel the trade
        await svcClient.from('trades').update({
          status: 'cancelled',
          cancellation_reason: 'payment_failed',
          updated_at: new Date().toISOString(),
        }).eq('id', trade_id);
        console.error(`[transactions-update] Stripe capture failed: status=${captured.status}`);
        return errResp(402, 'PAYMENT_FAILED', 'Payment capture failed. Trade cancelled.');
      }
      console.log(`[transactions-update] PI ${trade.stripe_payment_intent_id} captured`);
    } catch (captureErr: unknown) {
      const msg = captureErr instanceof Error ? captureErr.message : 'Stripe capture error';
      console.error(`[transactions-update] Stripe capture error:`, msg);
      return errResp(402, 'PAYMENT_FAILED', 'Payment capture failed. Please try again.');
    }
  }

  // Load auto_complete_hours from admin_config
  const { data: config, error: configErr } = await svcClient
    .from('admin_config')
    .select('auto_complete_hours')
    .single();

  if (configErr) {
    console.error('[transactions-update] Config fetch error:', configErr.message);
  }

  const autoCompleteHours = config?.auto_complete_hours ?? 72; // default 3 days
  const now = new Date();
  const autoCompleteAt = new Date(now.getTime() + autoCompleteHours * 60 * 60 * 1000);

  const { error: acceptErr } = await svcClient
    .from('trades')
    .update({
      status:          'in_progress',
      auto_complete_at: autoCompleteAt.toISOString(),
      updated_at:      now.toISOString(),
    })
    .eq('id', trade_id);

  if (acceptErr) return errResp(500, 'UPDATE_FAILED', 'Failed to accept offer');

  // TFV2-004: Auto-decline competing offers on the same listing
  // D-30: competing offers are also in_progress (without auto_complete_at)
  const { error: competingErr } = await svcClient
    .from('trades')
    .update({
      status:              'cancelled',
      cancellation_reason: 'offer_expired_competing',
      updated_at:          now.toISOString(),
    })
    .eq('listing_id', trade.listing_id)
    .eq('status', 'in_progress')
    .is('auto_complete_at', null)
    .neq('id', trade_id);

  if (competingErr) {
    console.error('[transactions-update] Competing offer decline error:', competingErr.message);
  }

  // Log event
  await svcClient.from('trade_events').insert({
    trade_id, event_type: 'offer_accepted', actor_id: user.id,
    metadata: { auto_complete_at: autoCompleteAt.toISOString() },
  });

  // TFV2-016: Notify the buyer that their offer was accepted
  // 1. In-app notification
  try {
    await svcClient.rpc('create_trade_notification', {
      p_user_id:           trade.buyer_id,
      p_notification_type: 'offer_accepted',
      p_title:             'Offer Accepted!',
      p_body:              'Your offer has been accepted. Arrange the meetup.',
      p_data:              JSON.stringify({ trade_id, listing_id: trade.listing_id, type: 'offer_accepted' }),
    });
  } catch (notifErr: unknown) {
    const msg = notifErr instanceof Error ? notifErr.message : 'Unknown error';
    console.error(`[transactions-update] In-app notification error:`, msg);
  }

  // 2. Push notification
  const efBaseUrl = `${supabaseUrl}/functions/v1`;
  try {
    await fetch(`${efBaseUrl}/send-trade-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseSvcKey}`,
      },
      body: JSON.stringify({
        trade_id,
        event_type: 'offer_accepted',
        recipient_user_id: trade.buyer_id,
      }),
    });
  } catch (notifErr: unknown) {
    const msg = notifErr instanceof Error ? notifErr.message : 'Unknown error';
    console.error(`[transactions-update] Push notification error:`, msg);
  }

  console.log(`[transactions-update] Trade ${trade_id} accepted by seller ${user.id}`);

  return new Response(
    JSON.stringify({
      success: true,
      status: 'in_progress',
      auto_complete_at: autoCompleteAt.toISOString(),
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
