/**
 * Edge Function: PayPal Webhook Handler
 * Handles PayPal payout status updates (PAY-007)
 * File: supabase/functions/paypal-webhook/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const paypalWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')!;

/**
 * Verify PayPal webhook signature
 * https://developer.paypal.com/api/rest/webhooks/
 */
function verifyPayPalSignature(
  transmissionId: string,
  timestamp: string,
  webhookId: string,
  eventBody: string,
  certUrl: string,
  transmissionSig: string,
  actualSig: string
): boolean {
  // In production, you should:
  // 1. Download cert from certUrl and cache it
  // 2. Verify signature using cert public key
  // 3. Check timestamp is recent (within 5 minutes)
  
  // For MVP, we'll do basic validation
  // TODO: Implement full certificate verification
  return transmissionId && timestamp && actualSig;
}

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
    const body = await req.text();
    const event = JSON.parse(body);

    // Get PayPal webhook verification headers
    const transmissionId = req.headers.get('paypal-transmission-id') || '';
    const timestamp = req.headers.get('paypal-transmission-time') || '';
    const transmissionSig = req.headers.get('paypal-transmission-sig') || '';
    const certUrl = req.headers.get('paypal-cert-url') || '';
    const authAlgo = req.headers.get('paypal-auth-algo') || '';

    // Verify signature
    const isValid = verifyPayPalSignature(
      transmissionId,
      timestamp,
      paypalWebhookId,
      body,
      certUrl,
      transmissionSig,
      authAlgo
    );

    if (!isValid) {
      console.error('[paypal-webhook] Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[paypal-webhook] Received event: ${event.event_type}`);

    switch (event.event_type) {
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED': {
        // Payout item succeeded
        const payoutItem = event.resource;
        const batchId = payoutItem.payout_batch_id;
        const itemId = payoutItem.payout_item_id;

        // Find seller payout by batch ID
        const { data: sellerPayout, error: payoutError } = await supabase
          .from('seller_payouts')
          .select('*')
          .eq('provider_reference_id', batchId)
          .maybeSingle();

        if (sellerPayout) {
          console.log(`[paypal-webhook] Marking payout ${sellerPayout.id} as completed`);
          await supabase
            .from('seller_payouts')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', sellerPayout.id);
        }
        break;
      }

      case 'PAYMENT.PAYOUTS-ITEM.FAILED': {
        // Payout item failed
        const payoutItem = event.resource;
        const batchId = payoutItem.payout_batch_id;
        const errors = payoutItem.errors || [];
        const failureReason = errors.map((e: any) => e.message).join('; ') || 'Payout failed';

        // Find seller payout by batch ID
        const { data: sellerPayout, error: payoutError } = await supabase
          .from('seller_payouts')
          .select('*')
          .eq('provider_reference_id', batchId)
          .maybeSingle();

        if (sellerPayout) {
          console.log(`[paypal-webhook] Marking payout ${sellerPayout.id} as failed: ${failureReason}`);
          await supabase
            .from('seller_payouts')
            .update({
              status: 'failed',
              failure_reason: failureReason,
              updated_at: new Date().toISOString()
            })
            .eq('id', sellerPayout.id);
        }
        break;
      }

      case 'PAYMENT.PAYOUTS-ITEM.BLOCKED':
      case 'PAYMENT.PAYOUTS-ITEM.CANCELED':
      case 'PAYMENT.PAYOUTS-ITEM.DENIED':
      case 'PAYMENT.PAYOUTS-ITEM.RETURNED':
      case 'PAYMENT.PAYOUTS-ITEM.HELD': {
        // Handle other failure states
        const payoutItem = event.resource;
        const batchId = payoutItem.payout_batch_id;
        const failureReason = `${event.event_type}: ${payoutItem.transaction_status || 'Unknown'}`;

        const { data: sellerPayout } = await supabase
          .from('seller_payouts')
          .select('*')
          .eq('provider_reference_id', batchId)
          .maybeSingle();

        if (sellerPayout) {
          console.log(`[paypal-webhook] Marking payout ${sellerPayout.id} as failed: ${failureReason}`);
          await supabase
            .from('seller_payouts')
            .update({
              status: 'failed',
              failure_reason: failureReason,
              updated_at: new Date().toISOString()
            })
            .eq('id', sellerPayout.id);
        }
        break;
      }

      default:
        console.log(`[paypal-webhook] Unhandled event type: ${event.event_type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[paypal-webhook] Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
