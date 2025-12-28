// File: supabase/functions/monitor-mid-trade-subscription-changes/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-admin-token, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[monitor] Missing Supabase environment variables');
    return new Response(JSON.stringify({ error: 'Server configuration error: Supabase keys missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  // Optional: require an admin trigger secret header for extra safety
  const ADMIN_TRIGGER_SECRET = Deno.env.get('ADMIN_TRIGGER_SECRET');
  if (ADMIN_TRIGGER_SECRET) {
    const token = (req.headers.get('x-admin-token') || '').toString();
    if (token !== ADMIN_TRIGGER_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // 1. Find trades in_progress where buyer subscription status has changed
    // We join trades with subscriptions to compare snapshot vs current
    // Note: We use the service role key to bypass RLS and see all trades/subscriptions
    // Fetch trades in the relevant statuses (no join) and then fetch current subscriptions separately
    const { data: trades, error: tradesError } = await supabaseClient
      .from('trades')
      .select('id, buyer_id, buyer_subscription_status, status, metadata')
      .in('status', ['pending', 'payment_processing', 'in_progress']);

    if (tradesError) {
      console.error('[monitor] Error fetching trades:', tradesError);
      throw tradesError;
    }

    // Build unique buyer id list and fetch their current subscription statuses in a single query
    const buyerIds = Array.from(new Set((trades || []).map((t: any) => t.buyer_id).filter(Boolean)));
    const subsByUser: Record<string, string | null> = {};

    if (buyerIds.length > 0) {
      const { data: subs, error: subsError } = await supabaseClient
        .from('subscriptions')
        .select('user_id, status')
        .in('user_id', buyerIds);

      if (subsError) {
        console.warn('[monitor] Error fetching subscriptions for buyers:', subsError);
      } else {
        for (const s of subs || []) {
          subsByUser[s.user_id] = s.status;
        }
      }
    }

    const changes = (trades || []).filter((t: any) => {
      const currentStatus = subsByUser[t.buyer_id] ?? null;
      const snapshotStatus = t.buyer_subscription_status ?? null;
      
      // 1. Basic change detection: current status differs from the snapshot taken at trade start
      const isDifferentFromSnapshot = currentStatus && snapshotStatus && currentStatus !== snapshotStatus;
      if (!isDifferentFromSnapshot) return false;

      // 2. Duplicate prevention: check if we already recorded THIS specific current status in metadata
      // This prevents multiple logs for the same status change if the monitor runs multiple times.
      // We only want to alert again if the status changes to something ELSE.
      const alreadyDetectedThisStatus = t.metadata?.buyer_subscription_status_current === currentStatus;
      
      return !alreadyDetectedThisStatus;
    });

    console.log(`[monitor] Checked ${trades?.length || 0} in_progress trades. Found ${changes.length} with subscription changes.`);

    // 2. Log/Alert for each change
    const alerts = [];
    const errors = [];
    for (const trade of changes) {
      const currentStatus = subsByUser[trade.buyer_id] ?? null;

      console.warn(`[ALERT] Trade ${trade.id}: Buyer ${trade.buyer_id} subscription changed from ${trade.buyer_subscription_status} to ${currentStatus} mid-trade.`);

      // Update metadata for admin visibility
      const detectionTimestamp = new Date().toISOString();

      const updatedMetadata = {
        ...(trade.metadata || {}),
        mid_trade_sub_change: true,
        buyer_subscription_status_at_initiation: trade.buyer_subscription_status,
        buyer_subscription_status_current: currentStatus,
        detection_timestamp: detectionTimestamp,
      };

      const { error: updateError } = await supabaseClient
        .from('trades')
        .update({ metadata: updatedMetadata })
        .eq('id', trade.id);

      if (updateError) {
        console.error(`[monitor] Failed to update metadata for trade ${trade.id}:`, updateError);
        errors.push({ trade_id: trade.id, type: 'update_metadata', error: updateError });
      }

      // Insert an admin monitoring log for UI and auditability
      const logPayload = {
        trade_id: trade.id,
        buyer_id: trade.buyer_id,
        from: trade.buyer_subscription_status,
        to: currentStatus,
        detection_timestamp: detectionTimestamp,
        metadata_snapshot: updatedMetadata,
      };

      const { error: insertLogError } = await supabaseClient
        .from('admin_monitoring_logs')
        .insert([{ trade_id: trade.id, payload: logPayload, buyer_id: trade.buyer_id }]);

      if (insertLogError) {
        console.error(`[monitor] Failed to insert admin_monitoring_logs for trade ${trade.id}:`, insertLogError);
        errors.push({ trade_id: trade.id, type: 'insert_log', error: insertLogError });
      }

      alerts.push({
        trade_id: trade.id,
        buyer_id: trade.buyer_id,
        from: trade.buyer_subscription_status,
        to: currentStatus
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      checked_count: trades?.length || 0,
      alert_count: changes.length,
      alerts,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[monitor] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
