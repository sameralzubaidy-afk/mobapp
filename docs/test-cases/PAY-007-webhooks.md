# PAY-007 — Webhooks (Stripe + PayPal) → Reconcile Payout Ledger

Module: `Prompts/MODULE-06-TRADE-FLOW-sellerpayouts.md`

Scope: Verify provider webhooks update `seller_payouts.status` to `processing` → `completed/failed`.

## Preconditions

- Supabase PROD has payout schema applied:
  - `seller_payouts`
  - `seller_payout_methods`
- Supabase Edge Functions deployed:
  - `stripe-webhook`
  - `paypal-webhook`
- Env vars set in Supabase PROD:
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, (optional) `PAYPAL_BASE_URL`

## Test Cases

### TC-PAY-007-001 — Stripe payout webhook marks payout `processing`

Steps:
1) In Supabase PROD, create (or identify) a `seller_payouts` row with:
   - `provider = 'stripe'`
   - `provider_reference_id = '<stripe_payout_id>'`
   - `status = 'pending'`
2) In Stripe Dashboard (Connect), trigger/observe a `payout.created` or `payout.updated` event for that payout.
3) Confirm webhook delivery succeeded (2xx) in Stripe dashboard.
4) In Supabase PROD, query that `seller_payouts` row.

Expected:
- `status = 'processing'`
- `initiated_at` is set (may be overwritten if multiple events arrive).

### TC-PAY-007-002 — Stripe payout webhook marks payout `completed`

Steps:
1) Ensure an existing `seller_payouts` row matches a real Stripe payout id in `provider_reference_id`.
2) Trigger/observe a `payout.paid` event for that payout.
3) Query `seller_payouts`.

Expected:
- `status = 'completed'`
- `completed_at` is set.

### TC-PAY-007-003 — Stripe payout webhook marks payout `failed`

Steps:
1) Ensure an existing `seller_payouts` row matches a real Stripe payout id.
2) Trigger/observe a `payout.failed` event.
3) Query `seller_payouts`.

Expected:
- `status = 'failed'`
- `failure_reason` is set.

### TC-PAY-007-004 — PayPal webhook verification rejects invalid signatures

Steps:
1) Call the PayPal webhook endpoint manually with missing `paypal-*` signature headers.

Expected:
- HTTP 401
- Body contains “Missing signature headers”

### TC-PAY-007-005 — PayPal payout item webhook updates ledger to `completed`

Steps:
1) In the app, go to Payout Settings:
   - Navigate to the route `PayoutSettings` (already wired in the app navigator).
2) Add a PayPal payout method and set it as primary.
3) Ensure you have a positive available seller balance.
4) Withdraw (this should submit to PayPal via PAY-005).
5) After PayPal sends `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, query `seller_payouts` by the stored `provider_reference_id` (batch id).

Expected:
- `status = 'completed'`
- `completed_at` is set.

### TC-PAY-007-006 — PayPal payout item webhook updates ledger to `failed`

Steps:
1) Repeat the PayPal withdrawal flow but force a PayPal failure (e.g., invalid recipient in sandbox).
2) Wait for PayPal webhook `PAYMENT.PAYOUTS-ITEM.FAILED`.
3) Query `seller_payouts`.

Expected:
- `status = 'failed'`
- `failure_reason` is set with PayPal error messages.
