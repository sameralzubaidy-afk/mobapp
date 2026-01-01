/**
 * Edge Function: PayPal Webhook Handler
 * Handles PayPal payout status updates (PAY-007)
 * File: supabase/functions/paypal-webhook/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { extractPayPalProviderReferenceId, mapPayPalEventToUpdate } from '../_shared/payouts/webhookReconcile.ts';
import {
  getPayPalEnv,
  hasAllPayPalVerifyHeaders,
  readPayPalVerifyHeaders,
  verifyPayPalWebhookSignature,
} from '../_shared/payouts/paypalVerify.ts';

serve(async (req: Request): Promise<Response> => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo'
      }
    });
  }

  try {
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
    const supabaseServiceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response('Server misconfigured: missing Supabase env', { status: 500 });
    }

    const body = await req.text();
    const event = JSON.parse(body);

    const verifyHeaders = readPayPalVerifyHeaders(req);
    if (!hasAllPayPalVerifyHeaders(verifyHeaders)) {
      console.error('[paypal-webhook] Missing PayPal signature headers');
      return new Response('Missing signature headers', { status: 401 });
    }

    const env = getPayPalEnv();
    const isValid = await verifyPayPalWebhookSignature({
      env,
      headers: verifyHeaders,
      webhookEvent: event,
    });

    if (!isValid) {
      console.error('[paypal-webhook] Signature verification failed');
      return new Response('Invalid signature', { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[paypal-webhook] Received event: ${event.event_type}`);
    const update = mapPayPalEventToUpdate(event.event_type, event.resource);
    if (!update) {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const providerReferenceId = extractPayPalProviderReferenceId(event.resource);
    if (!providerReferenceId) {
      console.error('[paypal-webhook] Could not extract provider_reference_id from event.resource');
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: sellerPayout } = await supabase
      .from('seller_payouts')
      .select('id, status')
      .eq('provider_reference_id', providerReferenceId)
      .maybeSingle();

    if (!sellerPayout) {
      console.log(`[paypal-webhook] No seller_payouts row found for provider_reference_id=${providerReferenceId}`);
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[paypal-webhook] Updating seller payout ${sellerPayout.id} status to ${update.status}`);
    await supabase
      .from('seller_payouts')
      .update(update)
      .eq('id', sellerPayout.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[paypal-webhook] Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
