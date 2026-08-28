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
            // DEV-TASK-6 (2026-08-27): idempotency key (options arg, BP-65) so a
            // timeout-retry of the same force-cancel can never issue a duplicate
            // Stripe refund. Close the check-then-act gap: if the charge was ALREADY
            // refunded (refund made but DB update never landed on a prior attempt),
            // reconcile the existing refund id from Stripe instead of silently
            // dropping it — otherwise trades.stripe_refund_id stays null and the
            // reconciliation/tax-reversal gap persists.
            try {
              const refund = await stripe.refunds.create(
                {
                  payment_intent: dbResult.stripe_payment_intent_id,
                  reason: 'requested_by_customer',
                  metadata: {
                    supabase_trade_id: tradeId,
                    admin_action: 'force-cancel',
                    admin_user_id: user.id,
                  },
                },
                { idempotencyKey: `refund_${tradeId}` },
              );
              stripeRefundId = refund.id;
            } catch (refundErr: unknown) {
              const err = refundErr as { code?: string; message?: string };
              const alreadyRefunded =
                err?.code === 'charge_already_refunded' ||
                /already been refunded/i.test(err?.message ?? '');
              if (alreadyRefunded) {
                const existing = await stripe.refunds.list({
                  payment_intent: dbResult.stripe_payment_intent_id,
                  limit: 5,
                });
                const prior = existing?.data?.[0];
                if (!prior?.id) throw refundErr;
                stripeRefundId = prior.id;
                console.log(
                  `[admin-trade-action] Charge already refunded — reconciled existing refund ${prior.id} for trade ${tradeId}`,
                );
              } else {
                throw refundErr;
              }
            }
          }
          
          // Update trade with refund/cancellation ID
          await adminClient.from('trades').update({ stripe_refund_id: stripeRefundId }).eq('id', tradeId);
          
          // TAX-STATUS-LIFECYCLE: Void or refund tax based on Stripe action
          try {
            if (stripeRefundId?.startsWith('cancelled_')) {
              // PI was cancelled (uncaptured) — void the tax
              await adminClient.rpc('rpc_void_tax_for_trade', {
                p_trade_id: tradeId,
                p_reason: 'admin_force_cancel',
              });
            } else {
              // PI was refunded (captured) — record the refund via the idempotent RPC
              const { data: taxRecord } = await adminClient
                .from('tax_records')
                .select('tax_amount_cents')
                .eq('trade_id', tradeId)
                .maybeSingle();

              if (taxRecord && stripeRefundId && (taxRecord as { tax_amount_cents: number }).tax_amount_cents > 0) {
                await adminClient.rpc('rpc_record_stripe_refund', {
                  p_trade_id: tradeId,
                  p_stripe_refund_id: stripeRefundId,
                  p_refund_amount_cents: (taxRecord as { tax_amount_cents: number }).tax_amount_cents,
                  p_refund_status: 'succeeded',
                  p_refund_reason: 'admin_force_cancel',
                  p_initiating_actor: 'admin',
                });
              }
            }
          } catch (taxErr: unknown) {
            const msg = taxErr instanceof Error ? taxErr.message : 'Unknown error';
            console.error(`[admin-trade-action] Tax handling error (non-fatal): ${msg}`);
          }
          
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
