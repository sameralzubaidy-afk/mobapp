-- ================================================================
-- Migration: 20260730_add_bundle_fields_to_admin_view
-- Module: ADMIN-V2-010 - Admin Bundle Trade Management
-- Description: Adds bundle_id and bundle_size to admin_trades_view
-- so the admin portal can distinguish single trades from bundle trades
-- ================================================================

-- Drop existing view first to recreate with additional fields
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
  ps.phone as seller_phone
FROM trades t
LEFT JOIN profiles pb ON t.buyer_id = pb.user_id
LEFT JOIN profiles ps ON t.seller_id = ps.user_id;

-- Grant access to the view
GRANT SELECT ON admin_trades_view TO authenticated;
GRANT SELECT ON admin_trades_view TO service_role;

-- Verification Query:
-- SELECT bundle_id, bundle_size, COUNT(*) as item_count 
-- FROM admin_trades_view 
-- WHERE bundle_id IS NOT NULL 
-- GROUP BY bundle_id, bundle_size 
-- ORDER BY bundle_id;
