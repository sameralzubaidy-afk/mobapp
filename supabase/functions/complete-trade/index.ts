// File: supabase/functions/complete-trade/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Prefer anon key + user JWT; service role is optional.
  const supabaseKey = supabaseAnonKey || supabaseServiceKey;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Server configuration error: missing SUPABASE_URL or SUPABASE_ANON_KEY',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let supabaseClient: ReturnType<typeof createClient>;
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error('[complete-trade] Failed to create Supabase client:', e);
    return new Response(JSON.stringify({
      success: false,
      error: 'Server configuration error: failed to initialize Supabase client',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Get authenticated user
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tradeId = body?.tradeId ?? body?.trade_id;

    if (!tradeId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing tradeId (expected tradeId or trade_id)' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        status: 200,
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
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
