// File: supabase/functions/transactions-decline-bundle/index.ts
// TFV2-013C: Bundle decline — declines ALL pending offers in a single EF call.
// Input:  { trade_ids: string[] }
// Output: { success: true, trades: [...], errors: [...] }
//
// Processes all trades in parallel (true parallelism within one container).
// Push notifications are fire-and-forget (non-blocking) to avoid EF chaining.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.11.0';
import { logTradeEvent } from '../_shared/trade-events.ts';

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

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errResp(405, 'METHOD_NOT_ALLOWED', 'POST required');

  const supabaseUrl     = Deno.env.get('SUPABASE_URL');
  const supabaseSvcKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseSvcKey) {
    return errResp(500, 'CONFIG_ERROR', 'Server configuration error');
  }

  // Auth: verify seller JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) return errResp(401, 'UNAUTHORIZED', 'Invalid or missing auth token');

  const sellerId = user.id;

  let body: { trade_ids?: string[] };
  try { body = await req.json(); } catch { return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const { trade_ids } = body;
  if (!trade_ids || !Array.isArray(trade_ids) || trade_ids.length === 0) {
    return errResp(400, 'MISSING_TRADE_IDS', 'trade_ids array is required');
  }

  const svcClient = createClient(supabaseUrl, supabaseSvcKey);
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
  const stripe = stripeKey && stripeKey.startsWith('sk_') ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

  // Process each trade: cancel Stripe PI (if any), update DB, send notification
  async function declineSingleTrade(tradeId: string): Promise<{ trade_id: string; status: string } | { error: string; code: string }> {
    // Load trade
    const { data: trade, error: tradeErr } = await svcClient
      .from('trades')
      .select('id, status, seller_id, buyer_id, listing_id, stripe_payment_intent_id, cash_amount_cents')
      .eq('id', tradeId)
      .single();

    if (tradeErr || !trade) return { error: 'Trade not found', code: 'TRADE_NOT_FOUND' };
    if (trade.seller_id !== sellerId) return { error: 'Not your trade', code: 'FORBIDDEN' };
    const VALID_STATUSES = ['pending', 'in_progress'];
    if (!VALID_STATUSES.includes(trade.status)) {
      return { error: `Trade status is '${trade.status}'`, code: 'INVALID_STATE' };
    }

    // Cancel Stripe pre-auth hold (release authorization)
    if (trade.stripe_payment_intent_id && (trade.cash_amount_cents ?? 0) > 0) {
      if (stripe) {
        try {
          await stripe.paymentIntents.cancel(trade.stripe_payment_intent_id);
        } catch (cancelErr: unknown) {
          const msg = cancelErr instanceof Error ? cancelErr.message : 'Stripe cancel error';
          console.error(`[transactions-decline-bundle] Stripe cancel error for ${tradeId} (non-fatal):`, msg);
        }
      }
    }

    // TAX-STATUS-LIFECYCLE: Void tax on bundle decline
    try {
      await svcClient.rpc('rpc_void_tax_for_trade', {
        p_trade_id: tradeId,
        p_reason: 'seller_declined_bundle',
      });
    } catch (taxErr: unknown) {
      const msg = taxErr instanceof Error ? taxErr.message : 'Unknown error';
      console.error(`[transactions-decline-bundle] Tax void error for ${tradeId}:`, msg);
    }

    // Update trade to cancelled
    const now = new Date().toISOString();
    const { error: updateErr } = await svcClient
      .from('trades')
      .update({
        status: 'cancelled', cancellation_reason: 'seller_declined', cancelled_at: now, updated_at: now,
      })
      .eq('id', tradeId);

    if (updateErr) return { error: 'Failed to decline offer', code: 'UPDATE_FAILED' };

    // Log event (non-blocking)
    (async () => {
      try { await logTradeEvent(svcClient, tradeId, 'offer_cancelled', sellerId, { action: 'declined_by_seller' }); }
      catch { /* non-blocking */ }
    })();

    // In-app notification (non-blocking)
    (async () => {
      try {
        await svcClient.rpc('create_trade_notification', {
          p_user_id: trade.buyer_id,
          p_notification_type: 'offer_cancelled',
          p_title: 'Offer Declined',
          p_body: 'Your offer was declined by the seller.',
          p_data: JSON.stringify({ trade_id: tradeId, listing_id: trade.listing_id }),
        });
      } catch (e) {
        console.error(`[transactions-decline-bundle] Notification error for ${tradeId}:`, e);
      }
    })();

    return { trade_id: tradeId, status: 'cancelled' };
  }

  // Process all trades in parallel
  const results = await Promise.allSettled(trade_ids.map(id => declineSingleTrade(id)));

  const trades: Array<{ trade_id: string; status: string }> = [];
  const errors: Array<{ trade_id: string; error: string; code: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const tradeId = trade_ids[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      const value = result.value as any;
      if (value.trade_id) {
        trades.push(value);
      } else {
        errors.push({ trade_id: tradeId, error: value.error ?? 'Unknown error', code: value.code ?? 'UNKNOWN' });
        console.error(`[transactions-decline-bundle] trade ${tradeId} failed:`, value.error);
      }
    } else {
      errors.push({ trade_id: tradeId, error: result.reason?.message ?? 'Unexpected error', code: 'UNEXPECTED' });
      console.error(`[transactions-decline-bundle] trade ${tradeId} unexpected error:`, result.reason);
    }
  }

  console.log(`[transactions-decline-bundle] declined ${trades.length}/${trade_ids.length} trades`);

  return jsonOk({
    trades,
    errors: errors.length > 0 ? errors : undefined,
    declined_count: trades.length,
    failed_count: errors.length,
  });
});
