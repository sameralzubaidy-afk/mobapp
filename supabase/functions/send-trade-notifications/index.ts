// File: supabase/functions/send-trade-notifications/index.ts
// TFV2-016: Send a push notification for a specific trade event to a specific user.
// Called by other EFs after state changes (e.g., offer_accepted, trade_disputed).
//
// Input:  { trade_id, event_type, recipient_user_id, extra_data? }
// Output: { success: true } | { error }
//
// Internally delegates to send-push-notification EF.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Map event types to user-facing notification copy
const EVENT_COPY: Record<string, { title: string; body: (data?: Record<string, unknown>) => string }> = {
  offer_submitted:    { title: 'New Offer',          body: () => 'You have a new offer on your listing!' },
  offer_accepted:     { title: 'Offer Accepted!',    body: () => 'Your offer has been accepted. Arrange the meetup.' },
  offer_cancelled:    { title: 'Offer Declined',     body: () => 'Your offer was declined by the seller.' },
  offer_expired:      { title: 'Offer Expired',      body: (data) => `Your offer on "${data?.listing_title || 'this item'}" expired. The item is still available.` },
  offer_expired_seller: { title: 'Offer Expired',    body: (data) => `An unanswered offer on "${data?.listing_title || 'your listing'}" has expired.` },
  offer_reminder_6h:  { title: 'Offer Expiring Soon', body: (data) => `You have an offer on "${data?.listing_title || 'your listing'}" expiring in ${data?.hours_remaining || 6} hours.` },
  offer_reminder_1h:  { title: 'Offer Expiring Soon', body: (data) => `You have an offer on "${data?.listing_title || 'your listing'}" expiring in ${data?.hours_remaining || 1} hour.` },
  seller_ignore_prompt: { title: 'Listing Feedback', body: (data) => `You're receiving offers but not responding on "${data?.listing_title || 'your listing'}". Want to pause this listing?` },
  seller_cancelled:   { title: 'Trade Cancelled',    body: () => 'The seller cancelled this trade.' },
  trade_completed:    { title: 'Trade Complete!',    body: () => 'Your trade has been marked as complete.' },
  trade_disputed:     { title: 'Dispute Opened',     body: () => 'A dispute has been opened on this trade.' },
  payment_processing: { title: 'Payment Processing', body: () => 'Your payment is being processed.' }, /* D-30: deprecated, kept for legacy events */
  payment_captured:   { title: 'Payment Confirmed',  body: () => 'Payment confirmed for your trade.' },
  payment_failed:     { title: 'Payment Issue',      body: () => 'There was an issue with your payment.' },
  // D-31 (2026-07-18): Bundle checkout background hold failure — distinct from payment_failed
  // (which is used at accept-time capture) so copy can name the specific item and direct the
  // buyer to update their payment method.
  offer_payment_hold_failed: {
    title: 'Payment Issue',
    body: (data) => `Payment issue on "${data?.listing_title || 'an item'}" — update your payment method to retry.`,
  },
  payout_initiated:   { title: 'Payout Started',     body: () => 'Your seller payout has been initiated.' },
  payout_requires_action: {
    title: 'Payout Action Required',
    body: (data) => `Your ${data?.listing_title || 'item'} sold! Add a payout method to receive your $${((Number(data?.amount_cents) || 0) / 100).toFixed(2)}.`,
  },
  payout_sent:        { title: 'Payout Sent!',       body: () => 'Your earnings have been sent to your account.' },
  payout_failed:      { title: 'Payout Failed',      body: () => 'There was an issue sending your payout.' },
  dispute_resolved:   { title: 'Dispute Resolved',   body: () => 'An admin has resolved the dispute on your trade.' },
  ac_reminder_24h:    { title: 'Auto-Complete Soon', body: (data) => `Your trade for "${data?.listing_title || 'item'}" auto-completes in ${data?.hours_remaining || 24}h. Got it? Tap 'I Got It'.` },
  ac_reminder_2h:     { title: 'Auto-Complete Soon', body: (data) => `"${data?.listing_title || 'item'}" trade auto-completes in ${data?.hours_remaining || 2} hours.` },
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

  if (!supabaseUrl || !supabaseSvcKey) return errResp(500, 'CONFIG_ERROR', 'Server configuration error');

  const svcClient = createClient(supabaseUrl, supabaseSvcKey);

  let body: { trade_id?: string; event_type?: string; recipient_user_id?: string; extra_data?: Record<string, unknown> };
  try { body = await req.json(); } catch { return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const { trade_id, event_type, recipient_user_id, extra_data } = body;
  if (!trade_id)           return errResp(400, 'MISSING_TRADE_ID', 'trade_id is required');
  if (!event_type)         return errResp(400, 'MISSING_EVENT_TYPE', 'event_type is required');
  if (!recipient_user_id)  return errResp(400, 'MISSING_RECIPIENT', 'recipient_user_id is required');

  const copy = EVENT_COPY[event_type];
  if (!copy) {
    console.warn(`[send-trade-notifications] Unknown event_type: ${event_type}`);
    // Non-fatal — still try to send with generic copy
  }

  const title = copy?.title ?? 'Trade Update';
  const body_text = copy?.body(extra_data) ?? 'There is an update on your trade.';

  // Fetch push token(s) for the recipient
  const { data: tokens } = await svcClient
    .from('push_tokens')
    .select('token')
    .eq('user_id', recipient_user_id);

  if (!tokens || tokens.length === 0) {
    // No push tokens — not an error, user may not have notifications enabled
    console.log(`[send-trade-notifications] No push tokens for user ${recipient_user_id}`);
    return new Response(
      JSON.stringify({ success: true, sent: 0, reason: 'no_push_tokens' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delegate to send-push-notification EF for each token
  const efBaseUrl = `${supabaseUrl}/functions/v1`;
  let sent = 0;

  for (const { token } of tokens) {
    try {
      const resp = await fetch(`${efBaseUrl}/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseSvcKey}`,
        },
        body: JSON.stringify({
          token,
          title,
          body: body_text,
          data: { trade_id, event_type, type: event_type, ...(extra_data ?? {}) },
        }),
      });
      if (resp.ok) sent++;
      else console.error(`[send-trade-notifications] Push failed for token: ${await resp.text()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[send-trade-notifications] Push error:`, msg);
    }
  }

  return new Response(
    JSON.stringify({ success: true, sent, total_tokens: tokens.length }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
