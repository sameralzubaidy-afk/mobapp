# EDGE Functions — Trade V2 (TASK TRADE-V2-004)

This document contains full Edge Function code examples, environment setup, deployment and local testing steps for the Trade state transitions feature (manual completion, cancellation with refund, auto-complete cron, Stripe webhook handler). Copy the code into `supabase/functions/<function-name>/index.ts` and deploy using the Supabase CLI.

---

## ✨ Overview
- Functions covered:
  - `complete-trade` — manual completion (buyer or seller triggers)
  - `cancel-trade` — manual cancellation; triggers Stripe refund when needed
  - `auto-complete-trades` — cron-run auto-completion for 7-day window
  - `stripe-webhook` — webhook handler for Stripe events (refunds / failures)

- Requirements:
  - Supabase project + CLI installed
  - Stripe account + API keys
  - Postgres RPCs/migrations already applied (`complete_trade_v2`, `cancel_trade_v2`, `earn_sp_for_trade`, `credit_sp_for_cancelled_trade`)
  - Follow security rules: JWT validation for user actions, service-role only where appropriate

---

## Environment variables (required)
Add these to your Supabase function environment or `.env` for local development:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (used by cron & webhook handlers)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

Example `.env` (local only):

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=anon_...
SUPABASE_SERVICE_ROLE_KEY=service_role_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 1) Shared helper & contracts (copy to `supabase/functions/_shared/`)

File: `supabase/functions/_shared/trade-utils.ts`

```ts
// Deno / supabase-edge function helper
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

export const env = {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL')!,
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY')!,
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  STRIPE_SECRET_KEY: Deno.env.get('STRIPE_SECRET_KEY')!,
  STRIPE_WEBHOOK_SECRET: Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
};

export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
export const supabaseService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

// Simple helper to extract user from an incoming bearer token using the anon client
export async function getUserFromBearer(authorization?: string) {
  if (!authorization) return null;
  const token = authorization.replace(/^Bearer\s+/i, '');
  try {
    const { data } = await supabaseAnon.auth.getUser(token);
    return data.user ?? null;
  } catch (e) {
    return null;
  }
}

// Zod schemas for requests
export const CompleteRequest = z.object({ trade_id: z.string().uuid() });
export const CancelRequest = z.object({ trade_id: z.string().uuid(), reason: z.string().optional(), issue_refund: z.boolean().optional().default(true) });

export type CompleteRequestType = z.infer<typeof CompleteRequest>;
export type CancelRequestType = z.infer<typeof CancelRequest>;
```

Notes:
- `getUserFromBearer` uses `supabaseAnon.auth.getUser(token)` to validate the token and extract user id.
- The service client `supabaseService` uses service role key for admin tasks (webhook & cron only).

---

## 2) `complete-trade` function

File: `supabase/functions/complete-trade/index.ts`

```ts
import { serve } from 'std/http/server.ts';
import { CompleteRequest, getUserFromBearer, supabaseAnon } from '../_shared/trade-utils.ts';

serve(async (req: Request) => {
  try {
    // Auth & validate
    const user = await getUserFromBearer(req.headers.get('Authorization') ?? undefined);
    if (!user) return new Response(JSON.stringify({ error: { code: 'unauth', message: 'Unauthorized' } }), { status: 401 });

    const body = await req.json();
    const parse = CompleteRequest.safeParse(body);
    if (!parse.success) return new Response(JSON.stringify({ error: parse.error.flatten() }), { status: 400 });

    const { trade_id } = parse.data;

    // Call the RPC with the caller user id
    const { data, error } = await supabaseAnon.rpc('complete_trade_v2', { p_trade_id: trade_id, p_user_id: user.id });

    if (error) {
      return new Response(JSON.stringify({ error: { code: 'rpc_error', message: error.message } }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, result: data }), { status: 200 });
  } catch (err) {
    console.error('complete-trade error', err);
    return new Response(JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }), { status: 500 });
  }
});
```

Notes:
- This endpoint requires a valid user JWT (Authorization: Bearer <token>).
- The RPC `complete_trade_v2` performs the DB updates and SP crediting atomically.

---

## 3) `cancel-trade` function

File: `supabase/functions/cancel-trade/index.ts`

```ts
import { serve } from 'std/http/server.ts';
import { CancelRequest, getUserFromBearer, supabaseAnon, supabaseService, stripe } from '../_shared/trade-utils.ts';

serve(async (req: Request) => {
  try {
    const user = await getUserFromBearer(req.headers.get('Authorization') ?? undefined);
    if (!user) return new Response(JSON.stringify({ error: { code: 'unauth', message: 'Unauthorized' } }), { status: 401 });

    const body = await req.json();
    const parse = CancelRequest.safeParse(body);
    if (!parse.success) return new Response(JSON.stringify({ error: parse.error.flatten() }), { status: 400 });

    const { trade_id, reason, issue_refund } = parse.data;

    // Fetch trade to inspect payment intent and status (use anon; results still RLS filtered)
    const { data: tradeRow, error: tradeErr } = await supabaseAnon.from('trades').select('*').eq('id', trade_id).single();
    if (tradeErr) return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Trade not found' } }), { status: 404 });

    // If a payment was made and refund requested -> create refund in Stripe
    if (issue_refund && tradeRow.payment_intent_id) {
      // Idempotency: check if there's already a refund recorded in trades.stripe_refund_id
      if (!tradeRow.stripe_refund_id) {
        // Use Stripe secret to create refund
        const refund = await stripe.refunds.create({ payment_intent: tradeRow.payment_intent_id });

        // Store refund id (service role required)
        await supabaseService.from('trades').update({ stripe_refund_id: refund.id }).eq('id', trade_id);
      }
    }

    // Now call the RPC to update trade/cancel state and handle SP refund
    const { data: rpcRes, error: rpcErr } = await supabaseAnon.rpc('cancel_trade_v2', { p_trade_id: trade_id, p_user_id: user.id, p_reason: reason });

    if (rpcErr) {
      return new Response(JSON.stringify({ error: { code: 'rpc_error', message: rpcErr.message } }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, result: rpcRes }), { status: 200 });
  } catch (err) {
    console.error('cancel-trade error', err);
    return new Response(JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }), { status: 500 });
  }
});
```

Notes:
- The function uses Stripe to create a refund (if payment intent exists) and stores `stripe_refund_id` using the service role client.
- The DB RPC handles SP refunds and trade/listing state changes.

---

## 4) `auto-complete-trades` function (cron)

File: `supabase/functions/auto-complete-trades/index.ts`

```ts
import { serve } from 'std/http/server.ts';
import { supabaseService } from '../_shared/trade-utils.ts';

serve(async (req: Request) => {
  try {
    // Protect endpoint: require service role key as Bearer token
    const auth = req.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token || token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }

    // Find trades older than 7 days in in_progress
    const { data: trades, error } = await supabaseService
      .from('trades')
      .select('id')
      .lt('created_at', 'now() - interval \u00277 days\u0027')
      .eq('status', 'in_progress');

    if (error) {
      console.error('auto-complete fetch error', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const results = [] as any[];
    for (const t of trades) {
      const { data: res, error: rpcErr } = await supabaseService.rpc('complete_trade_v2', { p_trade_id: t.id, p_user_id: null });
      results.push({ trade_id: t.id, result: res, error: rpcErr?.message || null });
    }

    return new Response(JSON.stringify({ success: true, results }), { status: 200 });
  } catch (err) {
    console.error('auto-complete error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
});
```

Notes:
- This must be invoked by a scheduler (Supabase Cron or GitHub Actions) with the service role token.
- Uses service-role client for safe admin RPC operations.

---

## 5) `stripe-webhook` function

File: `supabase/functions/stripe-webhook/index.ts`

```ts
import { serve } from 'std/http/server.ts';
import Stripe from 'stripe';
import { supabaseService, stripe, env } from '../_shared/trade-utils.ts';

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

serve(async (req: Request) => {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    // Handle relevant events
    if (event.type === 'charge.refunded' || event.type === 'charge.refund.updated') {
      const charge = event.data.object as Stripe.Charge;
      // We expect metadata.payment_intent or payment_intent in the charge
      const paymentIntentId = (charge.payment_intent as string) || charge.metadata?.payment_intent;
      if (paymentIntentId) {
        // Find trade by payment_intent_id (use service role)
        const { data: trades } = await supabaseService.from('trades').select('id').eq('payment_intent_id', paymentIntentId).limit(1).maybeSingle();
        if (trades) {
          // Cancel the trade via RPC using service role
          await supabaseService.rpc('cancel_trade_v2', { p_trade_id: trades.id, p_user_id: null, p_reason: 'stripe_refund_webhook' });
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = pi.id;
      const { data: trade } = await supabaseService.from('trades').select('id').eq('payment_intent_id', paymentIntentId).limit(1).maybeSingle();
      if (trade) {
        // Mark trade as cancelled with reason
        await supabaseService.rpc('cancel_trade_v2', { p_trade_id: trade.id, p_user_id: null, p_reason: 'stripe_payment_failed' });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('Webhook handler error', err);
    return new Response(JSON.stringify({ error: 'handler_error' }), { status: 500 });
  }
});
```

Notes:
- This function verifies Stripe signatures using `STRIPE_WEBHOOK_SECRET`.
- It uses the `service role` client to call `cancel_trade_v2` (system user) so the webhook can update trades regardless of RLS.

---

## 6) Deployment & Local Testing

### Build/deploy
1. Ensure Supabase CLI is installed and you're logged in.
2. From repo root:

```bash
# Deploy a single function
cd supabase/functions/complete-trade
supabase functions deploy complete-trade --project-ref <PROJECT_REF>
# Repeat for cancel-trade, auto-complete-trades, stripe-webhook
```

### Local serve (development)

```bash
# in repo root
supabase functions serve --no-verify-jwt --env-file .env
# or serve individual functions
cd supabase/functions/complete-trade
supabase functions serve complete-trade --env-file ../../.env
```

> Note: When serving with Supabase locally, the Supabase CLI will route requests at `http://localhost:54321/functions/v1/<function-name>`.

### Test requests

Manual completion (as authenticated user):

```bash
curl -X POST http://localhost:54321/functions/v1/complete-trade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_JWT>" \
  -d '{"trade_id":"<TRADE_UUID>"}'
```

Cancel & refund:

```bash
curl -X POST http://localhost:54321/functions/v1/cancel-trade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_JWT>" \
  -d '{"trade_id":"<TRADE_UUID>", "reason":"Buyer returned item", "issue_refund":true}'
```

Auto-complete (service role):

```bash
curl -X POST http://localhost:54321/functions/v1/auto-complete-trades \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Simulate Stripe webhook locally with Stripe CLI:

```bash
stripe listen --forward-to "http://localhost:54321/functions/v1/stripe-webhook"
# Then trigger sample event
stripe trigger charge.refunded
```

---

## 7) Observability & Idempotency
- Log request_id (generate UUID) for each request and include user_id (hashed) in logs.
- Ensure refunds and RPC calls are idempotent:
  - Store `stripe_refund_id` in `trades` and check before creating a new refund.
  - RPC `cancel_trade_v2` returns `success=false` if already finalized.

---

## 8) Security notes
- **Manual endpoints (`complete-trade`, `cancel-trade`)**: require user JWT (Authorization header). Use anon client to validate JWT and rely on RPC's authorization checks.
- **Webhook & Cron**: MUST use service role client and verify `STRIPE_WEBHOOK_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` respectively.
- Avoid storing raw secrets in code. Use environment variables.

---

## 9) Example responses

- Success:
```
{ "success": true, "result": { "success": true, "trade_id": "...", "status": "completed", "sp_earned": 25 } }
```
- Error:
```
{ "error": { "code": "rpc_error", "message": "Trade not found" } }
```

---

## 10) Next steps & verification checklist
- [ ] Deploy functions to staging and run the manual test cases in `docs/manual_testing/TRADE-V2-004-TEST-CASES.md`.
- [ ] Add unit tests for function helpers (e.g., idempotent refund check).
- [ ] Instrument logs and alerts for webhook failures.
- [ ] Add smoke script in `scripts/smoke/transactions.mjs` to exercise these functions.

---

If you'd like, I can create the actual function files in `supabase/functions/<name>/index.ts` for you and add a simple smoke script to `scripts/smoke/transactions.mjs`. Which would you prefer me to do next?