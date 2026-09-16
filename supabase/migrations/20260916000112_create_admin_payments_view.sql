-- File: supabase/migrations/20260801000003_create_admin_payments_view.sql
-- Bug fix (2026-08-01): TC-K09 — the admin Payments reconciliation page search
-- (by trade id / Stripe PI id / bundle id) failed with "Fetch failed: 404" then
-- "Fetch failed: 400".
--
-- Root cause:
--   The `/api/admin/payments` route queried the raw `payments` table and applied
--   `ilike` to `trade_id` and `bundle_id`, which are UUID columns. PostgREST
--   cannot apply `ilike` (a text operator) to a UUID type (404), and casts like
--   `trade_id::text` are NOT supported inside `or=(...)` filters (400 — the
--   PostgREST filter grammar only parses `::` casts in `select`, not in filter
--   fields).
--
-- Fix:
--   Mirror the established `admin_trades_view` pattern ("We cast UUIDs to text to
--   support ILIKE searching via PostgREST"): expose an `admin_payments_view` that
--   pre-casts the searchable UUID columns (`id`, `trade_id`, `bundle_id`) to text.
--   The route now queries this view with plain `ilike` (no casts needed).
--
-- Mode B: idempotent rerunnable migration (DROP VIEW IF EXISTS + CREATE).

BEGIN;

DROP VIEW IF EXISTS public.admin_payments_view;

CREATE OR REPLACE VIEW public.admin_payments_view AS
SELECT
  p.id::text,
  p.trade_id::text,
  p.bundle_id::text,
  p.stripe_payment_intent_id,
  p.stripe_refund_id,
  p.buyer_id,
  p.seller_id,
  p.currency,
  p.item_price_cents,
  p.platform_fee_cents,
  p.tax_amount_cents,
  p.sp_amount,
  p.total_charged_cents,
  p.refunded_cents,
  p.refunded_price_cents,
  p.refunded_fee_cents,
  p.refunded_tax_cents,
  p.status,
  p.created_at,
  p.updated_at,
  p.captured_at,
  p.refunded_at
FROM public.payments p;

GRANT SELECT ON public.admin_payments_view TO service_role;
GRANT SELECT ON public.admin_payments_view TO authenticated;

COMMIT;

-- ============================================================================
-- Verification queries (run after applying this migration)
-- ============================================================================
-- 1) View exists with text-cast searchable columns:
--    SELECT column_name, data_type
--      FROM information_schema.columns
--     WHERE table_name = 'admin_payments_view'
--       AND column_name IN ('id','trade_id','bundle_id');
--    Expected data_type = 'text' for all three.
--
-- 2) The PostgREST search query that previously 404'd/400'd now returns rows:
--    GET /rest/v1/admin_payments_view?select=*&or=(trade_id.ilike.*f9d53797*,stripe_payment_intent_id.ilike.*f9d53797*,bundle_id.ilike.*f9d53797*)
--    (with the service-role Authorization header) — expected 200 + matching rows.
