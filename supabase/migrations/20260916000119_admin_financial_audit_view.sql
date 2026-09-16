-- =============================================================================
-- N2 — Admin Financial Audit view (read surface for the new /audit screen)
-- Migration: 20260810000007_admin_financial_audit_view.sql
-- Mode B — idempotent rerunnable (CREATE OR REPLACE VIEW + idempotent GRANT).
--
-- Why this exists (BP-45): the admin Financial Audit screen needs to search the
-- `financial_audit_log` journal by entity id / trade id / idempotency key. Those
-- are UUID/text columns; PostgREST cannot `ilike` a UUID column, and `::text`
-- casts are not supported inside `or=(...)` filters. This view pre-casts the
-- searchable ids to text and joins display context (trade, listing title, buyer/
-- seller name, node name) so the page can render a readable journal.
--
-- RLS: the view inherits RLS from `financial_audit_log` — service role (used by
-- the admin API route) sees all rows; `authenticated` users only their own actor
-- rows. Underlying table RLS is unchanged.
-- =============================================================================

CREATE OR REPLACE VIEW public.admin_financial_audit_view AS
SELECT
  f.id,
  f.mutation_type,
  f.entity_type,
  f.entity_id,
  f.entity_id::text AS entity_id_text,
  f.actor_id,
  f.actor_id::text AS actor_id_text,
  f.before_state,
  f.after_state,
  f.amount_cents,
  f.idempotency_key,
  f.node_id,
  f.created_at,
  t.id AS trade_id,
  t.id::text AS trade_id_text,
  t.listing_id,
  l.title AS listing_title,
  buyer.name AS buyer_name,
  seller.name AS seller_name,
  n.name AS node_name,
  actor_prof.name AS actor_name
FROM public.financial_audit_log f
LEFT JOIN public.trades t ON t.id = f.entity_id
LEFT JOIN public.items l ON l.id = t.listing_id
LEFT JOIN public.profiles buyer ON buyer.user_id = t.buyer_id
LEFT JOIN public.profiles seller ON seller.user_id = t.seller_id
LEFT JOIN public.nodes n ON n.id = f.node_id
LEFT JOIN public.profiles actor_prof ON actor_prof.user_id = f.actor_id;

GRANT SELECT ON public.admin_financial_audit_view TO service_role;
GRANT SELECT ON public.admin_financial_audit_view TO authenticated;

-- Verification:
--   SELECT mutation_type, entity_id_text, amount_cents, created_at
--   FROM public.admin_financial_audit_view ORDER BY created_at DESC LIMIT 5;
