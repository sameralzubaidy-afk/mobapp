/**
 * Edge Function: cleanup-messages
 * Module: MODULE-07 MSG-005 (Message Expiration)
 * 
 * Purpose: Scheduled job to automatically mark expired messages as deleted.
 * Follows the pattern of auto-complete-trades:
 * 1. Calls scheduled_message_cleanup() RPC (DB wrapper).
 * 2. DB wrapper logs results to message_cleanup_runs audit table.
 * 
 * Invocation:
 * - External Scheduler (GitHub Actions, etc.)
 * - Supabase Dashboard → Edge Functions → Invoke
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[cleanup-messages] Missing environment variables');
    return new Response(
      JSON.stringify({ 
        error: 'Server configuration error',
        details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Only allow POST or GET (for easy manual testing/triggering)
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[cleanup-messages] Starting message cleanup job...');

    // 2. Call the scheduled wrapper RPC.
    // The DB wrapper is responsible for writing to public.message_cleanup_runs.
    const { data: result, error: rpcError } = await supabase.rpc('scheduled_message_cleanup', {
      p_invoked_by: 'edge_function',
      p_job_payload: { action: 'cleanup-messages', method: req.method },
    });

    if (rpcError) {
      console.error('[cleanup-messages] RPC error:', rpcError);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rpcError.message,
          details: rpcError.details
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const count = typeof result?.processed_count === 'number' ? result.processed_count : 0;
    console.log(`[cleanup-messages] Cleanup completed. processed_count=${count}`);

    // 4. Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        deleted_count: count,
        timestamp: new Date().toISOString(),
        message: `Marked ${count} messages as expired`,
        result,
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[cleanup-messages] Unexpected error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
