// File: supabase/functions/open-dispute/index.ts
// TFV2-011: Open a dispute on an in-progress trade.
// D-26: Disputes are overlay columns on `trades` — NOT new state machine states.
// Input:  { trade_id, reason, description }
// Output: { success: true } | { error: { code, message } }

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

  const supabaseUrl      = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey  = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseSvcKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSvcKey) {
    return errResp(500, 'CONFIG_ERROR', 'Server configuration error');
  }

  // Auth: user JWT via anon key → RLS applies
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return errResp(401, 'UNAUTHORIZED', 'Invalid or missing auth token');

  let body: { trade_id?: string; reason?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }

  const { trade_id, reason, description } = body;

  if (!trade_id) return errResp(400, 'MISSING_TRADE_ID', 'trade_id is required');
  if (!reason)   return errResp(400, 'MISSING_REASON', 'reason is required');

  // Load the trade — RLS ensures only buyer/seller can see it
  const { data: trade, error: tradeErr } = await supabase
    .from('trades')
    .select('id, status, buyer_id, seller_id, dispute_status, listing_id')
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) return errResp(404, 'TRADE_NOT_FOUND', 'Trade not found or access denied');

  // Only buyer can open a dispute
  if (trade.buyer_id !== user.id) {
    return errResp(403, 'FORBIDDEN', 'Only the buyer can open a dispute');
  }

  // Only in_progress trades can be disputed
  if (trade.status !== 'in_progress') {
    return errResp(400, 'INVALID_STATE', `Cannot open dispute on trade with status: ${trade.status}`);
  }

  // No double-disputes
  if (trade.dispute_status && trade.dispute_status !== 'none') {
    return errResp(409, 'DISPUTE_EXISTS', 'A dispute already exists for this trade');
  }

  // D-26: Set dispute overlay columns — trade status REMAINS in_progress
  // NOTE: Column names match the actual trades table schema:
  //   dispute_status, dispute_reason, dispute_notes, dispute_opened_at
  const svcClient = createClient(supabaseUrl, supabaseSvcKey);
  const { error: updateErr } = await svcClient
    .from('trades')
    .update({
      dispute_status:      'reported',
      dispute_reason:      reason.substring(0, 500),
      dispute_notes:       description ? description.substring(0, 2000) : null,
      dispute_opened_at:   new Date().toISOString(),
    })
    .eq('id', trade_id);

  if (updateErr) {
    console.error('[open-dispute] Update error:', updateErr);
    return errResp(500, 'UPDATE_FAILED', 'Failed to open dispute');
  }

  // Log trade event (non-blocking)
  await svcClient.from('trade_events').insert({
    trade_id,
    event_type: 'trade_disputed',
    actor_id:   user.id,
    metadata:   { reason, description_length: description?.length ?? 0 },
  }).then(({ error }) => {
    if (error) console.error('[open-dispute] Event log error:', error.message);
  });

  // Send notification to seller (non-blocking)
  svcClient.from('trade_notification_log').insert({
    trade_id,
    user_id:           trade.seller_id,
    notification_type: 'trade_dispute_opened',
    sent_at:           new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error('[open-dispute] Notif log error:', error.message);
  });

  console.log(`[open-dispute] Dispute opened on trade ${trade_id} by user ${user.id}`);

  return new Response(
    JSON.stringify({ success: true, trade_id, dispute_status: 'reported' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
