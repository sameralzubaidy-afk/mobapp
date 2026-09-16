-- =====================================================================
-- FIX-Task-40 phase 3 — commit the two `tax_status` enum labels that
-- `20260724000002_fix_tax_refund_reconciliation.sql` ADDS and then USES in the
-- SAME transaction.
--
-- PostgreSQL requires an enum label to be committed before it can be referenced:
-- adding and using a value in one transaction raises SQLSTATE 55P04,
--   unsafe use of new value "reconciliation_required" of enum type tax_status.
--
-- This is the same defect class already fixed for `admin_config_category` by
-- `20250114000000_admin_config_category_add_missing_values.sql`; this file is its
-- `tax_status` sibling. It sits AFTER the type's creator
-- (`20260510000001_tax_001_sales_tax_schema.sql`) and BEFORE the consumers
-- (`20260724000001`, `20260724000002`), which now find the labels already present
-- and skip their own `ADD VALUE` blocks - so their behaviour is unchanged on
-- staging, where the labels already exist.
--
-- ALTER TYPE ... ADD VALUE is permitted inside a transaction on PostgreSQL 12+ as
-- long as the type was not created in the same transaction (it is not - the type
-- comes from an earlier migration), so this applies cleanly under `db reset`.
-- =====================================================================

ALTER TYPE public.tax_status ADD VALUE IF NOT EXISTS 'pending_refund';
ALTER TYPE public.tax_status ADD VALUE IF NOT EXISTS 'reconciliation_required';
