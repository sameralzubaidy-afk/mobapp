-- File: supabase/migrations/20260830235900_dev_task_69_trade_payment_method.sql
-- DT-69 (2026-08-30) Item 6 — capture the buyer's card brand/last4 at offer time
-- so the seller's Review Offer screen can show "Buyer pays via •••• 4444 (authorized)".
--
-- The buyer's card details are NOT stored anywhere client-accessible today (only in
-- Stripe), so a seller could not see how the buyer intends to pay before accepting.
-- `create-trade-offer` already retrieves the buyer's PaymentMethod to attach/verify it;
-- this migration adds two nullable columns on `trades` for the EF to snapshot the card's
-- brand + last4 at offer time. Both are PII-lite display fields: last4 + brand are the
-- same values already shown to the buyer on their own payment-method screens.
--
-- Mode B: idempotent rerunnable migration (ADD COLUMN IF NOT EXISTS).

BEGIN;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS stripe_payment_method_brand TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_last4 TEXT;

COMMIT;
