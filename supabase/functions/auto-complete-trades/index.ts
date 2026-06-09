// File: supabase/functions/auto-complete-trades/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Find trades in_progress for > 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { data: trades, error: fetchError } = await supabaseClient
      .from('trades')
      .select('id, created_at, last_status_change_at, seller_marked_completed_at, dispute_status, disputed_at')
      .eq('status', 'in_progress');

    if (fetchError) {
      throw fetchError;
    }

    // Filter trades where the reference timestamp is older than cutoff.
    // Reference timestamp order: seller_marked_completed_at -> last_status_change_at -> created_at
    // Skip any trade with an UNRESOLVED dispute (dispute_status = reported/under_review OR disputed_at is set)
    const candidates = (trades || []).filter((t: any) => {
      // Skip disputed trades with no resolution
      const hasActiveDispute =
        (t.dispute_status && !['none', 'resolved'].includes(t.dispute_status)) ||
        (t.disputed_at && !t.dispute_resolution);
      if (hasActiveDispute) return false;

      const refTs = t.seller_marked_completed_at || t.last_status_change_at || t.created_at;
      if (!refTs) return false;
      const refDate = new Date(refTs);
      return refDate < cutoff;
    });

    console.log(`[auto-complete-trades] Found ${candidates.length || 0} trades to auto-complete (out of ${trades?.length || 0} in_progress)`);

    const results: any[] = [];

    // 2. Complete each candidate trade
    for (const trade of candidates) {
      try {
        const { data, error: rpcError } = await supabaseClient.rpc('complete_trade_v2', {
          p_trade_id: trade.id,
          p_user_id: null // System action
        });

        if (rpcError) {
          console.error(`[auto-complete-trades] Error completing trade ${trade.id}:`, rpcError);
          results.push({ tradeId: trade.id, success: false, error: rpcError.message });
        } else {
          results.push({ tradeId: trade.id, success: data?.success ?? false, error: data?.error ?? null });
        }
      } catch (err) {
        console.error(`[auto-complete-trades] Unexpected error completing trade ${trade.id}:`, err);
        results.push({ tradeId: trade.id, success: false, error: err?.message ?? String(err) });
      }
    }

    // Create audit/log entry for this run
    const processedCount = results.length;
    const errorsCount = results.filter((r: any) => !r.success).length;
    try {
      const { error: insertErr } = await supabaseClient.from('auto_complete_runs').insert({
        invoked_by: 'edge_function',
        job_payload: { cutoff_days: 7, schedule: '12h' },
        result: { processed_count: processedCount, errors_count: errorsCount, results },
        processed_count: processedCount,
        errors_count: errorsCount,
      });
      if (insertErr) console.error('[auto-complete-trades] Failed to write run log:', insertErr);
      else console.log('[auto-complete-trades] Run log written');
    } catch (err) {
      console.error('[auto-complete-trades] Unexpected error writing run log:', err);
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[auto-complete-trades] error:', error);

    // Attempt to write an error run log
    try {
      const { error: insertErr } = await supabaseClient.from('auto_complete_runs').insert({
        invoked_by: 'edge_function',
        job_payload: { cutoff_days: 7, schedule: '12h' },
        result: { processed_count: 0, errors_count: 1, results: [], error: error?.message ?? String(error) },
        processed_count: 0,
        errors_count: 1,
        error: error?.message ?? String(error),
      });
      if (insertErr) console.error('[auto-complete-trades] Failed to write error run log:', insertErr);
      else console.log('[auto-complete-trades] Error run log written');
    } catch (err) {
      console.error('[auto-complete-trades] Unexpected error writing error run log:', err);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
