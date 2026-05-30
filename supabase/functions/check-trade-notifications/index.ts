// File: supabase/functions/check-trade-notifications/index.ts
// TFV2-016: Cron EF — scans notification_log for pending trade notifications and delivers them.
// Scheduled by 20260528000008_notification_cron.sql — runs every 5 minutes.
//
// Logic:
//   1. Find pending entries in notification_log for trade events
//   2. For each, call send-trade-notifications EF
//   3. Mark notification_log entries as delivered
//
// Service role only. No user JWT needed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const supabaseSvcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseSvcKey) {
    return new Response(JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const svcClient = createClient(supabaseUrl, supabaseSvcKey);
  const efBaseUrl = `${supabaseUrl}/functions/v1`;

  // Fetch pending notifications created in last 24 hours that haven't been delivered yet
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pending, error: queryErr } = await svcClient
    .from('notification_log')
    .select('id, user_id, notification_type, payload, created_at')
    .gte('created_at', oneDayAgo)
    .is('delivered_at', null)
    .limit(100); // Process max 100 per cron run

  if (queryErr) {
    console.error('[check-trade-notifications] Query error:', queryErr);
    return new Response(JSON.stringify({ success: false, error: { code: 'QUERY_FAILED' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const notifications = pending ?? [];
  console.log(`[check-trade-notifications] Processing ${notifications.length} pending notifications`);

  let delivered = 0;
  const failedIds: string[] = [];

  for (const notif of notifications) {
    const { payload } = notif;
    const tradeId = payload?.trade_id as string | undefined;

    if (!tradeId) {
      // Not a trade notification — mark as delivered to avoid re-processing
      await svcClient.from('notification_log').update({ delivered_at: new Date().toISOString() }).eq('id', notif.id);
      continue;
    }

    // Map notification_type to trade event_type
    const eventType = NOTIF_TYPE_TO_EVENT[notif.notification_type] ?? notif.notification_type;

    try {
      const resp = await fetch(`${efBaseUrl}/send-trade-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseSvcKey}`,
        },
        body: JSON.stringify({
          trade_id:           tradeId,
          event_type:         eventType,
          recipient_user_id:  notif.user_id,
          extra_data:         payload,
        }),
      });

      if (resp.ok) {
        await svcClient.from('notification_log')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', notif.id);
        delivered++;
      } else {
        const err = await resp.text();
        console.error(`[check-trade-notifications] Delivery failed for notif ${notif.id}:`, err);
        failedIds.push(notif.id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[check-trade-notifications] Error for notif ${notif.id}:`, msg);
      failedIds.push(notif.id);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed: notifications.length,
      delivered,
      failed: failedIds.length,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

const NOTIF_TYPE_TO_EVENT: Record<string, string> = {
  trade_dispute_opened: 'trade_disputed',
  dispute_resolved:     'dispute_resolved',
  offer_received:       'offer_submitted',
  offer_accepted:       'offer_accepted',
  offer_declined:       'offer_cancelled',
  trade_complete:       'trade_completed',
  payout_sent:          'payout_sent',
  payout_failed:        'payout_failed',
};
