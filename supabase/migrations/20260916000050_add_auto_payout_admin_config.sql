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
-- NOTE (FIX-Task-40): passing six arguments matched TWO overloads — the legacy
-- six-parameter form and the seven-parameter form whose last argument has a
-- default - so PostgreSQL raised "function is not unique".
-- FIX-Task-40 phase 3: supplying `NULL::uuid` as the actor resolved the overload
-- ambiguity but then hit the RPC's OWN guard -
--   UNAUTHORIZED: only admins or service_role can update configuration
-- - which is correct behaviour: a migration has no acting admin, and
-- `admin_has_role(NULL)` can never be true. Passing a fabricated admin id would be
-- worse (it would forge an audit actor). `upsert_admin_config_setting` stays the
-- right path for an ADMIN-PORTAL write (BP-48: it records `updated_by` and audits);
-- a migration seed is not an admin action, so it writes the row directly in the
-- canonical shape. Idempotent via ON CONFLICT (key) DO NOTHING (Mode B).
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'enable_automatic_seller_payout',
  'false',
  'Enable automatic seller payout on trade completion. If false, sellers must manually request withdrawal.',
  'fees',
  'boolean',
  false,
  true
)
ON CONFLICT (key) DO NOTHING;

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
