// File: supabase/functions/transactions-accept-bundle/index.ts
// TFV2-013B: Bundle accept — accepts ALL pending offers in a single EF call.
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

  // Load auto_complete_hours from admin_config (cached once, shared by all trades)
  const { data: config } = await svcClient
    .from('admin_config')
    .select('auto_complete_hours')
    .limit(1)
    .maybeSingle();
  const autoCompleteHours = (config as { auto_complete_hours?: number } | null)?.auto_complete_hours ?? 72;

  // Process each trade: capture Stripe PI, update DB, send notification
  async function acceptSingleTrade(tradeId: string): Promise<{ trade_id: string; status: string; auto_complete_at?: string } | { error: string; code: string }> {
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

    // D-31 (2026-07-18): Bundle offers created via create-trade-offer's background-processing
    // path can briefly have cash_amount_cents > 0 with no stripe_payment_intent_id yet — the
    // pre-auth hold is still being created in the background. Accepting in that window would
    // skip the capture step below entirely and let the trade proceed without ever charging the
    // buyer. Block it with a clear, retryable error instead (other items in the same Accept-All
    // batch are unaffected — each trade is processed independently).
    if ((trade.cash_amount_cents ?? 0) > 0 && !trade.stripe_payment_intent_id) {
      return { error: 'This offer is still being processed. Please try again in a few seconds.', code: 'PAYMENT_PROCESSING' };
    }

    const now = new Date();
    const autoCompleteAt = new Date(now.getTime() + autoCompleteHours * 60 * 60 * 1000);

    // TAX-STATUS-LIFECYCLE (2026-07-23): PI capture is DEFERRED to buyer completion or
    // auto-complete. At bundle accept, we only transition the trade to in_progress.
    // The authorization hold stays on the buyer's card as an uncaptured hold.
    console.log(`[transactions-accept-bundle] PI ${trade.stripe_payment_intent_id} authorization hold preserved (not captured) on bundle accept`);

    // Update trade to in_progress
    const { error: updateErr } = await svcClient
      .from('trades')
      .update({
        status: 'in_progress',
        auto_complete_at: autoCompleteAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', tradeId);

    if (updateErr) return { error: 'Failed to update trade', code: 'UPDATE_FAILED' };

    // Auto-decline competing offers on the same listing (non-blocking)
    (async () => {
      try { await svcClient.from('trades').update({ status: 'cancelled', cancellation_reason: 'offer_expired_competing', updated_at: now.toISOString() }).eq('listing_id', trade.listing_id).eq('status', 'pending').is('auto_complete_at', null).neq('id', tradeId); }
      catch { /* non-blocking */ }
    })();

    // Log event (non-blocking)
    (async () => {
      try { await logTradeEvent(svcClient, tradeId, 'offer_accepted', sellerId, { auto_complete_at: autoCompleteAt.toISOString() }); }
      catch { /* non-blocking */ }
    })();

    // In-app notification (non-blocking)
    (async () => {
      try {
        await svcClient.rpc('create_trade_notification', {
          p_user_id: trade.buyer_id,
          p_notification_type: 'offer_accepted',
          p_title: 'Offer Accepted!',
          p_body: 'Your offer has been accepted. Arrange the meetup.',
          p_data: JSON.stringify({ trade_id: tradeId, listing_id: trade.listing_id, type: 'offer_accepted' }),
        });
      } catch (e) {
        console.error(`[transactions-accept-bundle] Notification error for ${tradeId}:`, e);
      }
    })();

    return { trade_id: tradeId, status: 'in_progress', auto_complete_at: autoCompleteAt.toISOString() };
  }

  // Process all trades in parallel
  const results = await Promise.allSettled(trade_ids.map(id => acceptSingleTrade(id)));

  const trades: Array<{ trade_id: string; status: string; auto_complete_at?: string }> = [];
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
        console.error(`[transactions-accept-bundle] trade ${tradeId} failed:`, value.error);
      }
    } else {
      errors.push({ trade_id: tradeId, error: result.reason?.message ?? 'Unexpected error', code: 'UNEXPECTED' });
      console.error(`[transactions-accept-bundle] trade ${tradeId} unexpected error:`, result.reason);
    }
  }

  console.log(`[transactions-accept-bundle] accepted ${trades.length}/${trade_ids.length} trades`);

  return jsonOk({
    trades,
    errors: errors.length > 0 ? errors : undefined,
    accepted_count: trades.length,
    failed_count: errors.length,
  });
});
