// File: supabase/functions/admin-trade-action/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-api-key, x-admin-ui-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const adminUiSecret = Deno.env.get('ADMIN_UI_SECRET')?.trim();

  console.log('[admin-trade-action] Request received');

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('[admin-trade-action] Missing environment variables');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create a service role client for administrative actions
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Get authenticated user or check for service role bypass
    let user = null;
    const authHeader = (req.headers.get('Authorization') || '').trim();
    const apiKey = (req.headers.get('apikey') || '').trim();
    const adminApiKey = (req.headers.get('x-admin-api-key') || '').trim();
    const clientAdminSecret = (req.headers.get('x-admin-ui-secret') || '').trim();
    
    // Check for Service Role Key in any of the headers
    // We use a more robust comparison that handles potential Bearer prefix
    const cleanAuthHeader = authHeader.replace('Bearer ', '').trim();
    
    const hasServiceRoleInAuth = (supabaseServiceKey && cleanAuthHeader === supabaseServiceKey);
    const hasServiceRoleInApiKey = (supabaseServiceKey && apiKey === supabaseServiceKey);
    const hasServiceRoleInAdminKey = (supabaseServiceKey && adminApiKey === supabaseServiceKey);
    
    // Check for Admin UI Secret
    const hasValidAdminSecret = (adminUiSecret && clientAdminSecret === adminUiSecret);

    console.log(`[admin-trade-action] Auth Check: ServiceRoleAuth=${hasServiceRoleInAuth}, ServiceRoleApiKey=${hasServiceRoleInApiKey}, ServiceRoleAdminKey=${hasServiceRoleInAdminKey}, AdminSecret=${hasValidAdminSecret}`);
    console.log(`[admin-trade-action] Debug Keys: ReceivedSecretLength=${clientAdminSecret.length}, ExpectedSecretLength=${adminUiSecret?.length || 0}`);

    if (hasServiceRoleInAuth || hasServiceRoleInApiKey || hasServiceRoleInAdminKey || hasValidAdminSecret) {
      user = { 
        id: null, // Use null instead of fake UUID to avoid FK violations
        app_metadata: { role: 'admin' },
        user_metadata: { is_admin: true }
      };
      console.log(`[admin-trade-action] Authorized via ${hasValidAdminSecret ? 'Admin Secret' : 'Service Role'}`);
    } else {
      // ONLY if no admin credentials found, try standard user JWT
      console.log('[admin-trade-action] No admin credentials found, attempting user JWT verification');
      
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();

      if (authError || !authUser) {
        console.error('[admin-trade-action] Auth error:', authError?.message || 'No user found');
        return new Response(JSON.stringify({ 
          error: 'Unauthorized', 
          details: authError?.message || 'No active session found.',
          debug: { 
            hasAuth: !!authHeader, 
            hasApiKey: !!apiKey, 
            hasAdminKey: !!adminApiKey,
            hasSecret: !!clientAdminSecret
          }
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = authUser;
    }

    // Verify admin role
    const isAdmin = hasServiceRoleInAuth || hasServiceRoleInApiKey || hasServiceRoleInAdminKey || hasValidAdminSecret ||
                    user?.app_metadata?.role === 'admin' || 
                    user?.user_metadata?.role === 'admin' ||
                    user?.user_metadata?.is_admin === true;
                    
    if (!isAdmin) {
      console.warn(`[admin-trade-action] Forbidden: User ${user?.id} is not an admin`);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, tradeId, reason, issue_refund = true, adminId } = await req.json();

    // Use provided adminId if we are in service role/secret mode and it's provided
    const effectiveAdminId = (user.id === null && adminId) ? adminId : user.id;

    if (!tradeId || !action) {
      return new Response(JSON.stringify({ error: 'Missing tradeId or action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'force-cancel') {
      // 2. Call DB RPC for force-cancel (handles status and SP)
      const { data: dbResult, error: dbError } = await adminClient.rpc('admin_force_cancel_trade_db', {
        p_trade_id: tradeId,
        p_admin_user_id: effectiveAdminId,
        p_reason: reason || 'Admin force-cancel'
      });

      if (dbError) throw dbError;
      if (!dbResult.success) throw new Error(dbResult.error);

      // 3. Handle Stripe refund if requested and PI exists
      let stripeRefundId = null;
      if (issue_refund && dbResult.stripe_payment_intent_id) {
        try {
          // Check if the PaymentIntent is captured or uncaptured
          const paymentIntent = await stripe.paymentIntents.retrieve(
            dbResult.stripe_payment_intent_id
          );
          
          if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'processing') {
            // Uncaptured — cancel the PaymentIntent instead of refunding
            const cancelled = await stripe.paymentIntents.cancel(
              dbResult.stripe_payment_intent_id,
              { cancellation_reason: 'requested_by_customer' }
            );
            stripeRefundId = `cancelled_${cancelled.id}`;
          } else {
            // Captured — issue a refund
            const refund = await stripe.refunds.create({
              payment_intent: dbResult.stripe_payment_intent_id,
              reason: 'requested_by_customer',
              metadata: { 
                supabase_trade_id: tradeId,
                admin_action: 'force-cancel',
                admin_user_id: user.id
              },
            });
            stripeRefundId = refund.id;
          }
          
          // Update trade with refund/cancellation ID
          await adminClient.from('trades').update({ stripe_refund_id: stripeRefundId }).eq('id', tradeId);
          
          // Log refund/cancellation action
          await adminClient.from('admin_audit_logs').insert({
            actor_id: effectiveAdminId,
            action_type: 'manual_refund',
            entity_type: 'trade',
            entity_id: tradeId,
            reason: 'Stripe ' + (stripeRefundId?.startsWith('cancelled_') ? 'cancellation' : 'refund') + ' issued during force-cancel',
            payload: { stripe_refund_id: stripeRefundId }
          });
        } catch (stripeError: any) {
          console.error('[admin-trade-action] Stripe refund/cancel failed:', stripeError);
          return new Response(JSON.stringify({ 
            success: true, 
            tradeId, 
            warning: 'Trade cancelled in DB but Stripe refund/cancel failed: ' + stripeError.message 
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        tradeId, 
        sp_refunded: dbResult.sp_refunded,
        stripe_refund_id: stripeRefundId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Unsupported action: ' + action);

  } catch (error: any) {
    console.error('[admin-trade-action] error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
