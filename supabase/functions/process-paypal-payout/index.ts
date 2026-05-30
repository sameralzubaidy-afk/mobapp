/**
 * Edge Function: Process PayPal Payout
 * Submits PayPal/Venmo payouts and stores provider references
 * File: supabase/functions/process-paypal-payout/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')!;
const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!;
const paypalBaseUrl = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.sandbox.paypal.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface ProcessPayPalPayoutRequest {
  payoutId: string;
  idempotencyKey?: string;
}

interface ProcessPayPalPayoutResponse {
  success: boolean;
  payoutId: string;
  batchId: string;
  status: string;
}

interface PayPalAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalPayoutResponse {
  batch_header: {
    payout_batch_id: string;
    batch_status: string;
  };
}

/**
 * Get PayPal OAuth access token
 */
async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${paypalClientId}:${paypalClientSecret}`);
  
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.statusText}`);
  }

  const data: PayPalAuthResponse = await response.json();
  return data.access_token;
}

/**
 * Submit PayPal payout batch
 */
async function submitPayPalPayout(
  accessToken: string,
  recipient: string,
  amountCents: number,
  currency: string,
  idempotencyKey: string,
  recipientType: 'EMAIL' | 'PHONE' | 'PAYPAL_ID'
): Promise<PayPalPayoutResponse> {
  const response = await fetch(`${paypalBaseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': idempotencyKey
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: idempotencyKey,
        email_subject: 'You have received a payout from Kids Marketplace',
        email_message: 'You have received a payout! Thanks for using Kids Marketplace.'
      },
      items: [
        {
          recipient_type: recipientType,
          amount: {
            value: (amountCents / 100).toFixed(2),
            currency: currency.toUpperCase()
          },
          receiver: recipient,
          note: 'Payout from Kids Marketplace',
          sender_item_id: idempotencyKey.substring(0, 63)  // PayPal requires max 63 chars
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal payout failed: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

serve(async (req: Request): Promise<Response> => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase env not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paypalClientId || !paypalClientSecret) {
      return new Response(JSON.stringify({ success: false, error: 'PayPal env not configured (PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return new Response(JSON.stringify({ success: false, error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return new Response(JSON.stringify({ success: false, error: `Unauthorized: ${userErr?.message || 'No user'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request
    const body = await req.json();
    
    if (!body.payoutId || typeof body.payoutId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid payoutId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { payoutId, idempotencyKey } = body as ProcessPayPalPayoutRequest;

    // Get payout record
    const { data: payout, error: payoutError } = await supabase
      .from('seller_payouts')
      .select(`
        *,
        payout_method:seller_payout_methods(*)
      `)
      .eq('id', payoutId)
      .eq('user_id', user.id)
      .single();

    if (payoutError || !payout) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payout not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already submitted, return idempotent success
    if (payout.provider_reference_id) {
      const response: ProcessPayPalPayoutResponse = {
        success: true,
        payoutId: payout.id,
        batchId: payout.provider_reference_id,
        status: payout.status,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only pending payouts can be submitted
    if (payout.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: `Payout is not pending (status=${payout.status})` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveIdempotencyKey = idempotencyKey || payout.idempotency_key || `payout-${payoutId}`;

    // Check if already processed (idempotency)
    if (!payout.payout_method) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payout method not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const method = payout.payout_method;
    if (method.user_id !== user.id) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized payout method' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!method.is_verified) {
      return new Response(JSON.stringify({ success: false, error: 'Payout method is not verified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let recipient: string;
    let recipientType: 'EMAIL' | 'PHONE' | 'PAYPAL_ID';

    if (method.method_type === 'paypal') {
      if (!method.paypal_email) {
        return new Response(
          JSON.stringify({ success: false, error: 'PayPal email not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      recipient = method.paypal_email;
      recipientType = 'EMAIL';
    } else if (method.method_type === 'venmo') {
      // Venmo can use phone number (preferred) or handle
      if (method.venmo_phone_e164) {
        recipient = method.venmo_phone_e164;
        recipientType = 'PHONE';
      } else if (method.venmo_handle) {
        recipient = method.venmo_handle;
        recipientType = 'PAYPAL_ID'; // Venmo handle treated as PayPal ID
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Venmo phone/handle not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid payout method type for PayPal processing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const netAmountCents = payout.net_amount_cents;
    if (typeof netAmountCents !== 'number' || !Number.isFinite(netAmountCents) || netAmountCents <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid net_amount_cents for payout' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Submit payout
    const paypalResponse = await submitPayPalPayout(
      accessToken,
      recipient,
      netAmountCents,
      payout.currency,
      effectiveIdempotencyKey,
      recipientType
    );

    // Update payout record
    const { error: updateError } = await supabase
      .from('seller_payouts')
      .update({
        provider: 'paypal',
        provider_reference_id: paypalResponse.batch_header.payout_batch_id,
        status: 'processing',
        initiated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId);

    if (updateError) {
      console.error('Error updating payout:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update payout record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TFV2-018: sync trades.payout_status so the app can show live payout state
    if (payout.trade_id) {
      const { error: tradePayoutErr } = await supabase
        .from('trades')
        .update({ payout_status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', payout.trade_id);
      if (tradePayoutErr) {
        console.warn('[process-paypal-payout] Failed to sync trades.payout_status:', tradePayoutErr.message);
      }
    }

    const response: ProcessPayPalPayoutResponse = {
      success: true,
      payoutId,
      batchId: paypalResponse.batch_header.payout_batch_id,
      status: 'processing'
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error processing PayPal payout:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
