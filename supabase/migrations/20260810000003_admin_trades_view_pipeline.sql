-- ============================================================================
-- Admin Trade Pipeline — extend admin_trades_view with countdown/dispute columns
-- Date: 2026-08-10
-- Mode B: Idempotent rerunnable migration
--
-- WHAT THIS DOES (owner summary):
--   Adds offer_expires_at, auto_complete_at, authorization_expires_at,
--   dispute_status, and dispute_resolution to admin_trades_view so the new
--   admin Trade Pipeline board can show live stage countdowns (offer window →
--   pickup window → auto-complete) and dispute chips, all in one view.
--
-- Backward compatibility: columns are APPENDED at the end of the SELECT list
-- (after seller_phone), so existing admin consumers that select specific
-- columns are unaffected; `select=*` consumers just gain the new fields.
-- ============================================================================

DROP VIEW IF EXISTS admin_trades_view CASCADE;

CREATE OR REPLACE VIEW admin_trades_view AS
SELECT
  t.id::text,
  t.listing_id::text,
  t.buyer_id::text,
  t.seller_id::text,
  t.status,
  t.sp_amount,
  t.cash_amount_cents,
  t.buyer_transaction_fee_cents,
  t.cash_currency,
  t.buyer_subscription_status,
  t.stripe_payment_intent_id,
  t.stripe_refund_id,
  t.sp_debit_ledger_entry_id,
  t.sp_credit_ledger_entry_id,
  t.cancellation_reason,
  -- Bundle fields for admin grouping
  t.bundle_id::text,
  t.bundle_size,
  t.created_at,
  t.updated_at,
  t.completed_at,
  t.cancelled_at,
  t.last_status_change_at,
  -- Buyer info from profiles
  pb.name as buyer_name,
  pb.email as buyer_email,
  pb.phone as buyer_phone,
  -- Seller info from profiles
  ps.name as seller_name,
  ps.email as seller_email,
  ps.phone as seller_phone,
  -- Trade Pipeline (R2, 2026-08-10): countdown + dispute fields
  t.offer_expires_at,
  t.auto_complete_at,
  t.authorization_expires_at,
  t.dispute_status,
  t.dispute_resolution
FROM trades t
LEFT JOIN profiles pb ON t.buyer_id = pb.user_id
LEFT JOIN profiles ps ON t.seller_id = ps.user_id;

-- Grant access to the view
GRANT SELECT ON admin_trades_view TO authenticated;
GRANT SELECT ON admin_trades_view TO service_role;

-- ---------------------------------------------------------------------------
-- Verification queries (SQL-3)
-- ---------------------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'admin_trades_view'
--     AND column_name IN ('offer_expires_at','auto_complete_at','authorization_expires_at','dispute_status','dispute_resolution')
--   ORDER BY ordinal_position;
-- SELECT status, COUNT(*) FROM admin_trades_view GROUP BY status ORDER BY status;
