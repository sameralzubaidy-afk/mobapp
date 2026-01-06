/**
 * Edge Function: cleanup-messages
 * Module: MODULE-07 MSG-004 (Message Expiration)
 * 
 * Purpose: Scheduled job to automatically mark expired messages as deleted.
 * Runs daily via Supabase cron or manual invocation.
 * 
 * Expiration rule: Messages are soft deleted X days after trade completion,
 * where X is configurable via admin_config.message_expiration_days (default: 30).
 * 
 * Invocation:
 * - Scheduled: Configure in Supabase Dashboard → Database → Cron Jobs
 * - Manual: POST to https://<project>.supabase.co/functions/v1/cleanup-messages
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Only allow POST or GET methods
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
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

    // Log execution start
    console.log('[cleanup-messages] Starting message cleanup job...');

    // Call the mark_expired_messages() RPC function
    const { data, error } = await supabase.rpc('mark_expired_messages');

    if (error) {
      console.error('[cleanup-messages] RPC error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          hint: error.hint,
          details: error.details
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const deletedCount = data || 0;

    console.log(`[cleanup-messages] Successfully marked ${deletedCount} messages as expired`);

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        deleted_count: deletedCount,
        timestamp: new Date().toISOString(),
        message: `Marked ${deletedCount} messages as expired`
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
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
