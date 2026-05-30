// File: supabase/functions/transactions-update/index.ts
// TFV2-013: Seller accepts or declines a pending offer.
// Input:  { trade_id, action: 'accept' | 'decline' }
// Output: { success: true, status, auto_complete_at? } | { error }
//
// Accept: pending → in_progress, sets auto_complete_at from admin_config, auto-declines competing offers
// Decline: pending → cancelled

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  if (!supabaseUrl || !supabaseAnonKey) {
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
    .select('id, status, seller_id, buyer_id, listing_id')
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) return errResp(404, 'TRADE_NOT_FOUND', 'Trade not found or access denied');
  if (trade.seller_id !== user.id) return errResp(403, 'FORBIDDEN', 'Only the seller can accept/decline offers');
  if (trade.status !== 'pending') return errResp(400, 'INVALID_STATE', `Trade status is '${trade.status}', expected 'pending'`);

  const svcClient = createClient(supabaseUrl, supabaseSvcKey!);

  if (action === 'decline') {
    const { error: declineErr } = await svcClient
      .from('trades')
      .update({ status: 'cancelled', cancellation_reason: 'seller_declined', updated_at: new Date().toISOString() })
      .eq('id', trade_id);

    if (declineErr) return errResp(500, 'UPDATE_FAILED', 'Failed to decline offer');

    // Release SP hold
    await svcClient.rpc('fn_release_sp_on_cancel', { p_trade_id: trade_id }).then(({ error }) => {
      if (error) console.error('[transactions-update] SP release error:', error.message);
    });

    await svcClient.from('trade_events').insert({
      trade_id, event_type: 'offer_cancelled', actor_id: user.id,
      metadata: { action: 'declined_by_seller' },
    });

    return new Response(
      JSON.stringify({ success: true, status: 'cancelled' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // --- ACCEPT ---
  // Load auto_complete_hours from admin_config
  const { data: config } = await svcClient
    .from('admin_config')
    .select('auto_complete_hours')
    .single();

  const autoCompleteHours = config?.auto_complete_hours ?? 72; // default 3 days
  const now = new Date();
  const autoCompleteAt = new Date(now.getTime() + autoCompleteHours * 60 * 60 * 1000);

  const { error: acceptErr } = await svcClient
    .from('trades')
    .update({
      status:          'in_progress',
      auto_complete_at: autoCompleteAt.toISOString(),
      accepted_at:     now.toISOString(),
      updated_at:      now.toISOString(),
    })
    .eq('id', trade_id);

  if (acceptErr) return errResp(500, 'UPDATE_FAILED', 'Failed to accept offer');

  // TFV2-004: Auto-decline competing offers on the same listing
  const { error: competingErr } = await svcClient
    .from('trades')
    .update({
      status:              'cancelled',
      cancellation_reason: 'offer_expired_competing',
      updated_at:          now.toISOString(),
    })
    .eq('listing_id', trade.listing_id)
    .eq('status', 'pending')
    .neq('id', trade_id);

  if (competingErr) {
    console.error('[transactions-update] Competing offer decline error:', competingErr.message);
  }

  // Log event
  await svcClient.from('trade_events').insert({
    trade_id, event_type: 'offer_accepted', actor_id: user.id,
    metadata: { auto_complete_at: autoCompleteAt.toISOString() },
  });

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
