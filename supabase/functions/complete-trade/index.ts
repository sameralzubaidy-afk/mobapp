// File: supabase/functions/complete-trade/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logTradeEvent } from '../_shared/trade-events.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabaseKey = supabaseAnonKey || supabaseServiceKey;
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Server configuration error: missing SUPABASE_URL or SUPABASE_ANON_KEY',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Extract auth token BEFORE creating client (needed for RLS headers)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Create client with user's JWT so RLS policies apply to subsequent queries
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tradeId = body?.tradeId ?? body?.trade_id;

    if (!tradeId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing tradeId (expected tradeId or trade_id)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: trade, error: tradeError } = await supabaseClient
      .from('trades')
      .select('id, buyer_id, seller_id, status, disputed_at, dispute_resolution')
      .eq('id', tradeId)
      .maybeSingle();

    if (tradeError || !trade) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Trade not found',
          code: 'TRADE_NOT_FOUND',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.buyer_id !== user.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Only the buyer can complete this trade',
          code: 'BUYER_ONLY_COMPLETION',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.status === 'completed') {
      return new Response(
        JSON.stringify({
          success: true,
          tradeId: trade.id,
          status: 'completed',
          message: 'Trade already completed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.status !== 'in_progress') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Trade is not in_progress (current status: ${trade.status})`,
          code: 'INVALID_TRADE_STATE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.disputed_at && !trade.dispute_resolution) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Trade has an unresolved dispute and cannot be completed',
          code: 'UNRESOLVED_DISPUTE',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Call the RPC to complete the trade
    // The RPC handles status checks, authorization (buyer/seller), item status update, and SP earning.
    // complete_trade_v2 expects (p_trade_id UUID, p_user_id UUID)
    const { data, error: rpcError } = await supabaseClient.rpc('complete_trade_v2', {
      p_trade_id: tradeId,
      p_user_id: user.id
    });

    if (rpcError) {
      console.error('[complete-trade] RPC error:', rpcError);
      console.error('[complete-trade] RPC error details:', {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details
      });
      return new Response(JSON.stringify({ 
        success: false,
        error: rpcError.message,
        details: rpcError.details 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data?.success) {
      console.error('[complete-trade] RPC returned error:', data);
      return new Response(JSON.stringify({ 
        success: false,
        error: data?.error || 'Unknown error completing trade',
        details: data?.details
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TFV2-019: log trade_completed event
    await logTradeEvent(supabaseClient, tradeId, 'trade_completed', user.id, {
      final_status: data.status,
    });

    // Notify seller that the buyer confirmed receipt
    try {
      await supabaseClient.rpc('create_trade_notification', {
        p_user_id:           trade.seller_id,
        p_notification_type: 'trade_completed',
        p_title:             'Trade Complete!',
        p_body:              'The buyer confirmed receipt. Your payout has been initiated.',
        p_data:              JSON.stringify({ trade_id: tradeId }),
      });
    } catch (notifErr: unknown) {
      const msg = notifErr instanceof Error ? notifErr.message : 'Unknown error';
      console.error('[complete-trade] Seller notification error:', msg);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      tradeId: data.trade_id,
      status: data.status,
      message: data.message 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[complete-trade] error:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
