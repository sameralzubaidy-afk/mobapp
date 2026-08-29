/**
 * FILE: supabase/functions/get-payment-method/index.ts
 * MODULE-11 TASK SUB-017: Get Payment Method Details
 * 
 * Edge Function to retrieve saved payment method details from Stripe.
 * Returns formatted payment method info (last 4 digits, brand, expiry).
 * 
 * Response:
 * - payment_method: { id, brand, last4, exp_month, exp_year } | null
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  try {
    // Parse optional force_card (QA forced-card toggle, Dev Task 44). Test-only:
    // the mobile client only sends this when the `payment_card` QA toggle is
    // armed in a dev/test build. Harmless in production — an absent/invalid
    // body is simply ignored and the normal DT41 selection runs.
    let forceCard: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.force_card === 'string' && body.force_card) {
        forceCard = body.force_card;
      }
    } catch {
      // No body (plain GET or empty POST) — force_card stays null.
    }

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const user_id = user.id;

    console.log('[get-payment-method] Fetching payment method for user:', user_id);

    // Fetch from canonical subscriptions table first, then fallback to legacy user_subscriptions.
    let paymentMethodId: string | null = null;
    let customerId: string | null = null;

    const { data: subscriptionRow, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('stripe_payment_method_id, stripe_customer_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (subscriptionError) {
      console.warn('[get-payment-method] subscriptions lookup failed, falling back:', subscriptionError?.message ?? subscriptionError);
    }

    if (subscriptionRow?.stripe_payment_method_id) {
      paymentMethodId = subscriptionRow.stripe_payment_method_id;
    }
    if (subscriptionRow?.stripe_customer_id) {
      customerId = subscriptionRow.stripe_customer_id;
    }

    if (!paymentMethodId || !customerId) {
      const { data: legacyRow, error: legacyError } = await supabaseClient
        .from('user_subscriptions')
        .select('stripe_payment_method_id, stripe_customer_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (legacyError) {
        console.warn('[get-payment-method] user_subscriptions fallback lookup failed:', legacyError?.message ?? legacyError);
      }

      paymentMethodId = legacyRow?.stripe_payment_method_id ?? paymentMethodId;
      customerId = legacyRow?.stripe_customer_id ?? customerId;
    }

    // ── Dev Task 41 item 10: deterministic saved-card selection ─────────────
    // The stored stripe_payment_method_id can point at an invalid/expired card
    // (intermittent 400 "Payment method is invalid or expired" on offer submit).
    // When we have a Stripe customer, list their saved cards, drop expired ones,
    // and pick a STABLE default: the stored id if still present+valid, else the
    // customer's default / most recently created card. Persist the choice back so
    // the selection is deterministic across loads, not a per-request coin flip.
    if (customerId) {
      try {
        const { data: pmList } = await stripe.customers.listPaymentMethods(customerId, {
          type: 'card',
          limit: 20,
        });
        const nowYear = new Date().getFullYear();
        const nowMonth = new Date().getMonth() + 1;
        const cards = (pmList?.data ?? []).filter((pm: any) => {
          const expYear = pm.card?.exp_year ?? 0;
          const expMonth = pm.card?.exp_month ?? 0;
          if (expYear < nowYear) return false;
          if (expYear === nowYear && expMonth < nowMonth) return false;
          return true;
        });
        console.log(
          `[get-payment-method] deterministic selection — stored=${paymentMethodId} customer=${customerId} listed=${(pmList?.data ?? []).length} valid_cards=${cards.length}`
        );

        // listPaymentMethods returns the default payment method first, then by
        // created_at DESC (most recently used/added first).
        let selected: string | null = null;
        if (forceCard) {
          // QA forced-card selection (Dev Task 44): match the armed preference —
          // a raw `pm_...` id or a `brand_last4` short name (e.g. mastercard_4444)
          // — against the customer's valid cards. If it resolves, use it;
          // otherwise fail-closed to the DT41 default below (never break a
          // normal request because a QA preference can't be found).
          const forced = cards.find((pm: any) => {
            if (pm.id === forceCard) return true;
            if (!forceCard.includes('_')) return false; // short names carry '_'
            const brand = String(pm.card?.brand ?? '').toLowerCase().replace(/[\s-]/g, '');
            const last4 = String(pm.card?.last4 ?? '');
            return `${brand}_${last4}` === forceCard;
          });
          if (forced) {
            selected = forced.id;
            console.log(
              `[get-payment-method] QA force_card "${forceCard}" → ${forced.id} (${forced.card?.brand} •••• ${forced.card?.last4})`
            );
          } else {
            console.warn(
              `[get-payment-method] QA force_card "${forceCard}" not found among ${cards.length} valid card(s); falling back to DT41 default`
            );
            selected = null;
          }
        }
        if (!selected) {
          if (paymentMethodId && cards.some((pm: any) => pm.id === paymentMethodId)) {
            // Stored card still present and valid — keep it (deterministic).
            selected = paymentMethodId;
          } else if (cards.length > 0) {
            // Stored card is gone/expired — fall back to the customer's default /
            // most recently created valid card.
            selected = cards[0]?.id ?? null;
          } else {
            // No cards returned for this customer from this Stripe account —
            // NEVER discard the stored id (the retrieve below decides). This
            // preserves the pre-DT41 behavior if the list call is empty/quirky.
            selected = paymentMethodId;
          }
        }

        if (selected && selected !== paymentMethodId) {
          // Best-effort persist so future calls are deterministic. If the user's
          // RLS blocks the write, selection still resolves the same way every call.
          try {
            await supabaseClient
              .from('subscriptions')
              .update({ stripe_payment_method_id: selected })
              .eq('user_id', user_id);
          } catch (persistError: any) {
            console.warn(
              '[get-payment-method] could not persist deterministic card choice:',
              persistError?.message || persistError
            );
          }
        }
        paymentMethodId = selected;
      } catch (listError: any) {
        console.warn(
          '[get-payment-method] listPaymentMethods failed, using stored id:',
          listError?.message || listError
        );
      }
    }

    if (!paymentMethodId) {
      return new Response(
        JSON.stringify({ payment_method: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Fetch payment method from Stripe
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      const result = {
        payment_method: {
          id: paymentMethod.id,
          brand: paymentMethod.card?.brand || 'unknown',
          last4: paymentMethod.card?.last4 || '****',
          exp_month: paymentMethod.card?.exp_month || 0,
          exp_year: paymentMethod.card?.exp_year || 0,
        },
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (stripeError: any) {
      console.error('[get-payment-method] Stripe error:', stripeError);

      // Payment method might be deleted/detached, return null
      return new Response(
        JSON.stringify({ payment_method: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }
  } catch (error: any) {
    console.error('[get-payment-method] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
