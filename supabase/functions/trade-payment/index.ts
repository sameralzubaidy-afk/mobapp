// File: supabase/functions/trade-payment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[trade-payment] Missing Supabase environment variables');
    return new Response(JSON.stringify({ error: 'Server configuration error: Supabase keys missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log('[trade-payment] Request body:', body);
    const { tradeId, paymentMethodId } = body;

    if (!tradeId || !paymentMethodId) {
      return new Response(JSON.stringify({ error: 'Missing tradeId or paymentMethodId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('[trade-payment] STRIPE_SECRET_KEY is not set');
      return new Response(JSON.stringify({ error: 'Server configuration error: Stripe key missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Load trade info
    console.log('[trade-payment] Fetching trade:', tradeId);
    const { data: trade, error: tradeError } = await supabaseClient
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      console.error('[trade-payment] Trade not found:', tradeError);
      return new Response(JSON.stringify({ error: 'Trade not found', details: tradeError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[trade-payment] Trade found:', { 
      id: trade.id, 
      status: trade.status, 
      cash_amount_cents: trade.cash_amount_cents,
      buyer_id: trade.buyer_id 
    });

    if (trade.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Trade is not in pending state (current: ${trade.status})` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Load buyer info (email) from auth.admin
    console.log('[trade-payment] Fetching buyer info for:', trade.buyer_id);
    const { data: { user: buyer }, error: buyerError } = await supabaseClient.auth.admin.getUserById(trade.buyer_id);
    
    if (buyerError || !buyer) {
      console.error('[trade-payment] Buyer not found in auth:', buyerError);
      return new Response(JSON.stringify({ error: 'Buyer not found in authentication system', details: buyerError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Load subscription info (stripe_customer_id)
    console.log('[trade-payment] Fetching subscription for:', trade.buyer_id);
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', trade.buyer_id)
      .maybeSingle();

    if (subError) {
      console.error('[trade-payment] Subscription fetch error:', subError);
      // We don't throw here, we'll just create a customer if needed
    }

    const cashAmountCents = trade.cash_amount_cents;

    // 4) Create or reuse Stripe customer
    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      console.log('[trade-payment] Creating new Stripe customer for buyer:', buyer.id);
      try {
        const customer = await stripe.customers.create({
          email: buyer.email,
          metadata: { supabase_user_id: buyer.id },
        });

        customerId = customer.id;

        // Update subscription record with customer ID
        const { error: upsertError } = await supabaseClient
          .from('subscriptions')
          .upsert({ 
            user_id: buyer.id,
            stripe_customer_id: customerId,
            status: 'free', 
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
          
        if (upsertError) {
          console.error('[trade-payment] Failed to upsert subscription:', upsertError);
          // Continue anyway, we have the customerId
        }
      } catch (stripeError: any) {
        console.error('[trade-payment] Stripe customer creation failed:', stripeError);

        // Mark trade as payment_failed so failure is visible in Test Case 2
        try {
          await supabaseClient
            .from('trades')
            .update({ status: 'payment_failed', last_status_change_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', trade.id);
        } catch (upErr: any) {
          console.error('[trade-payment] Failed to mark trade as payment_failed after customer creation failure:', upErr);
        }

        return new Response(JSON.stringify({ error: 'Failed to create Stripe customer', details: stripeError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 5) Attach payment method and set as default
    console.log('[trade-payment] Attaching payment method:', paymentMethodId, 'to customer:', customerId);
    try {
      // Basic validation: expect a PaymentMethod id
      if (typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
        console.error('[trade-payment] Invalid paymentMethodId format:', paymentMethodId);

        // Mark trade as payment_failed for visibility
        try {
          await supabaseClient
            .from('trades')
            .update({ status: 'payment_failed', last_status_change_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', trade.id);
        } catch (upErr: any) {
          console.error('[trade-payment] Failed to mark trade as payment_failed after invalid PM format:', upErr);
        }

        return new Response(JSON.stringify({ error: 'Invalid paymentMethodId format', details: 'Expected a Stripe PaymentMethod id (pm_...)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Retrieve the payment method to inspect its attachment
      let pm;
      try {
        pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      } catch (retrieveErr: any) {
        console.error('[trade-payment] Failed to retrieve payment method:', retrieveErr);

        // Mark trade as payment_failed so Test Case 2 shows failed payment
        try {
          await supabaseClient
            .from('trades')
            .update({ status: 'payment_failed', last_status_change_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', trade.id);
        } catch (upErr: any) {
          console.error('[trade-payment] Failed to mark trade as payment_failed after retrieve failure:', upErr);
        }

        return new Response(JSON.stringify({ error: 'Failed to retrieve payment method', details: retrieveErr.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If attached to another customer, try to detach first
      if (pm.customer && pm.customer !== customerId) {
        console.log('[trade-payment] Payment method attached to another customer:', pm.customer, 'Attempting detach');
        try {
          await stripe.paymentMethods.detach(paymentMethodId);
          console.log('[trade-payment] Detached payment method from other customer:', pm.customer);
        } catch (detachErr: any) {
          console.error('[trade-payment] Failed to detach PM from other customer:', detachErr);

          // Mark trade as payment_failed
          try {
            await supabaseClient
              .from('trades')
              .update({ status: 'payment_failed', last_status_change_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', trade.id);
          } catch (upErr: any) {
            console.error('[trade-payment] Failed to mark trade as payment_failed after detach failure:', upErr);
          }

          return new Response(JSON.stringify({ error: 'Payment method is attached to a different customer and could not be detached', details: detachErr.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Attach if not already attached to our customer
      if (!pm.customer || pm.customer !== customerId) {
        try {
          await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        } catch (attachErr: any) {
          console.error('[trade-payment] Stripe paymentMethods.attach failed:', attachErr);

          // Mark trade as payment_failed for visibility
          try {
            await supabaseClient
              .from('trades')
              .update({ status: 'payment_failed', last_status_change_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', trade.id);
          } catch (upErr: any) {
            console.error('[trade-payment] Failed to mark trade as payment_failed after attach failure:', upErr);
          }

          // Include more stripe error details for debugging
          const attachDetails = {
            message: attachErr?.message,
            type: attachErr?.type,
            code: attachErr?.code,
            param: attachErr?.param,
          };
          // If Stripe returned a card error, map to 402 and include details for client
          const statusCode = (attachErr && attachErr.code === 'card_declined') ? 402 : 400;
          const responseBody = {
            error: 'Failed to attach payment method',
            details: attachDetails,
            stripe: {
              code: attachErr?.code,
              decline_code: attachErr?.raw?.decline_code,
              request_id: attachErr?.raw?.requestId ?? attachErr?.requestId ?? attachErr?.raw?.request_id
            }
          };

          return new Response(JSON.stringify(responseBody), {
            status: statusCode,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Set as default payment method for invoices/charges
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      } catch (updateErr: any) {
        console.error('[trade-payment] Failed to update customer invoice_settings:', updateErr);
        // Non-fatal: proceed but log
      }
    } catch (stripeError: any) {
      console.error('[trade-payment] Stripe PM attachment unexpected error:', stripeError);
      return new Response(JSON.stringify({ error: 'Failed to attach payment method', details: stripeError?.message ?? String(stripeError) }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6) Mark trade as payment_processing
    await supabaseClient
      .from('trades')
      .update({ 
        status: 'payment_processing', 
        last_status_change_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', trade.id);

    // 7) Create PaymentIntent (Uncaptured for atomicity)
    console.log('[trade-payment] Creating PaymentIntent (manual capture) for amount:', cashAmountCents);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: cashAmountCents,
      currency: trade.cash_currency || 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      capture_method: 'manual', // We will capture only if SP debit succeeds
      off_session: false,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        supabase_trade_id: trade.id,
        buyer_id: trade.buyer_id,
        seller_id: trade.seller_id,
      },
    });

    if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
      console.error('[trade-payment] Payment authorization failed status:', paymentIntent.status);
      await supabaseClient
        .from('trades')
        .update({ 
          status: 'payment_failed', 
          last_status_change_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      return new Response(
        JSON.stringify({ 
          error: 'Payment authorization failed', 
          payment_intent_status: paymentIntent.status 
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6) Debit SP wallet if points were used
    let spDebitLedgerId: string | null = null;
    const pointsToDebit = trade.sp_amount;

    if (pointsToDebit && pointsToDebit > 0) {
      console.log('[trade-payment] Debiting SP points:', pointsToDebit);
      const { data: debitResult, error: debitError } = await supabaseClient
        .rpc('debit_sp_for_trade', {
          p_user_id: trade.buyer_id,
          p_trade_id: trade.id,
          p_points: pointsToDebit,
        });

      // Log the full result to help debugging of RPC shape
      console.log('[trade-payment] SP debit RPC result:', { debitResult, debitError });

      // Normalize possible shapes: RPC might return JSON directly or an array
      const ledgerIdFromResult = debitResult?.ledger_entry_id ?? (Array.isArray(debitResult) ? debitResult[0]?.ledger_entry_id : null) ?? (debitResult && debitResult[0] && debitResult[0].ledger_entry_id) ?? null;

      if (debitError || !ledgerIdFromResult) {
        console.error('[trade-payment] SP debit failed or returned unexpected result. Cancelling Stripe payment.', { debitError, ledgerIdFromResult, debitResult });
        
        // ATOMIC FAILURE: Cancel Stripe PaymentIntent because SP debit failed
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id);
        } catch (cancelErr: any) {
          console.error('[trade-payment] Failed to cancel Stripe PaymentIntent after SP debit failure:', cancelErr);
        }

        await supabaseClient
          .from('trades')
          .update({ 
            status: 'payment_failed', 
            last_status_change_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);

        return new Response(
          JSON.stringify({ error: 'Swap Points debit failed or returned invalid response. Payment cancelled.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        spDebitLedgerId = ledgerIdFromResult;

        // Extra verification: fetch the inserted ledger row and wallet to confirm DB changes
        try {
          const { data: ledgerRow, error: ledgerError } = await supabaseClient
            .from('sp_ledger')
            .select('*')
            .eq('related_transaction_id', trade.id)
            .maybeSingle();

          console.log('[trade-payment] Post-SP-debit ledger row:', { ledgerRow, ledgerError });

          const { data: walletRow, error: walletError } = await supabaseClient
            .from('sp_wallets')
            .select('*')
            .eq('user_id', trade.buyer_id)
            .maybeSingle();

          console.log('[trade-payment] Post-SP-debit wallet row:', { walletRow, walletError });

          // Validation: ledger entry must exist and reflect the spent points
          const expectedAmount = -Math.abs(pointsToDebit);
          const ledgerMissing = !ledgerRow || ledgerError;
          const ledgerAmountMismatch = ledgerRow && Number(ledgerRow.amount) !== expectedAmount;
          const walletMissing = !walletRow || walletError;

          // If RPC returned a balance_after, compare with walletRow.available_balance
          const rpcBalanceAfter = debitResult?.balance_after ?? debitResult?.balanceAfter ?? null;
          const walletBalanceMismatch = (rpcBalanceAfter !== null && walletRow && Number(walletRow.available_balance) !== Number(rpcBalanceAfter));

          if (ledgerMissing || ledgerAmountMismatch || walletMissing || walletBalanceMismatch) {
            console.error('[trade-payment] SP debit verification failed', { ledgerMissing, ledgerAmountMismatch, walletMissing, walletBalanceMismatch, rpcBalanceAfter });

            // ATOMIC FAILURE: Cancel Stripe PaymentIntent because SP debit did not materialize correctly
            try {
              await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (cancelErr: any) {
              console.error('[trade-payment] Failed to cancel Stripe PaymentIntent after SP verification failure:', cancelErr);
            }

            await supabaseClient
              .from('trades')
              .update({ 
                status: 'payment_failed', 
                last_status_change_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id);

            return new Response(
              JSON.stringify({ error: 'Swap Points debit did not persist correctly. Payment cancelled.' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (verifyErr) {
          console.error('[trade-payment] Error while verifying SP debit in DB:', verifyErr);

          // Treat verification failure as a fatal error and rollback
          try {
            await stripe.paymentIntents.cancel(paymentIntent.id);
          } catch (cancelErr: any) {
            console.error('[trade-payment] Failed to cancel Stripe PaymentIntent after SP verification error:', cancelErr);
          }

          await supabaseClient
            .from('trades')
            .update({ 
              status: 'payment_failed', 
              last_status_change_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', trade.id);

          return new Response(
            JSON.stringify({ error: 'Error verifying Swap Points debit. Payment cancelled.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 7) Capture Stripe Payment
    console.log('[trade-payment] Capturing Stripe payment:', paymentIntent.id);
    try {
      const capturedIntent = await stripe.paymentIntents.capture(paymentIntent.id);
      
      if (capturedIntent.status !== 'succeeded') {
        throw new Error(`Capture failed with status: ${capturedIntent.status}`);
      }
    } catch (captureError: any) {
      console.error('[trade-payment] Stripe capture failed. Refunding SP if needed.', captureError);
      
      // ATOMIC FAILURE: Refund SP because Stripe capture failed
      if (pointsToDebit && pointsToDebit > 0) {
        const { data: refundResult, error: refundError } = await supabaseClient.rpc('credit_sp_for_cancelled_trade', {
          p_user_id: trade.buyer_id,
          p_trade_id: trade.id,
          p_points: pointsToDebit,
        });
        console.log('[trade-payment] SP refund RPC result after capture failure:', { refundResult, refundError });
        if (refundError) {
          console.error('[trade-payment] SP refund RPC failed during capture failure handling:', refundError);
        }
      }

      await supabaseClient
        .from('trades')
        .update({ 
          status: 'payment_failed', 
          last_status_change_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      return new Response(
        JSON.stringify({ error: 'Payment capture failed. Swap Points refunded.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8) Update trade as in_progress with payment + SP linkage
    const { error: updateTradeError } = await supabaseClient
      .from('trades')
      .update({
        status: 'in_progress',
        last_status_change_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent.id,
        sp_debit_ledger_entry_id: spDebitLedgerId,
      })
      .eq('id', trade.id);

    if (updateTradeError) {
      console.error('[trade-payment] Failed to update trade after payment:', updateTradeError);
      throw updateTradeError;
    }

    // 8) Update item status to 'pending' (locked for this trade)
    await supabaseClient
      .from('items')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', trade.listing_id);

    console.log('[trade-payment] Trade payment successful:', trade.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tradeId: trade.id, 
        payment_intent_id: paymentIntent.id,
        status: 'in_progress'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[trade-payment] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
