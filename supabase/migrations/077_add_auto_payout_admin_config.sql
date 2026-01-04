-- ================================================================
-- Migration: 077_add_auto_payout_admin_config.sql
-- Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-006)
-- Description: Add enable_automatic_seller_payout admin config flag
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- =============================================================================
-- BLOCK 1: SCHEMA (Add admin config for auto-payout toggle)
-- =============================================================================

-- Use upsert function to avoid duplicate key conflicts
SELECT upsert_admin_config_setting(
  'enable_automatic_seller_payout',
  'false',
  'fees'::admin_config_category,
  'boolean',
  false,
  true
);

-- Add description if needed (update existing record)
UPDATE admin_config
SET description = 'Enable automatic seller payout on trade completion. If false, sellers must manually request withdrawal.'
WHERE key = 'enable_automatic_seller_payout';

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm success)
-- =============================================================================

-- Verify config exists
-- SELECT key, value, description, category, data_type, is_active 
-- FROM admin_config 
-- WHERE key = 'enable_automatic_seller_payout';

-- Expected result:
-- key: enable_automatic_seller_payout
-- value: false
-- description: Enable automatic seller payout...
-- category: fees
-- data_type: boolean
-- is_active: true

-- =============================================================================
-- ACCEPTANCE CRITERIA
-- =============================================================================

-- ✅ Admin config flag 'enable_automatic_seller_payout' created with default 'false'
-- ✅ Flag is toggleable via Admin Panel (uses existing upsert_admin_config_setting RPC)
-- ✅ Applied globally to all sellers (future: can be extended per-node)
