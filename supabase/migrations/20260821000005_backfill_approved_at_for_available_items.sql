-- File: supabase/migrations/20260821000005_backfill_approved_at_for_available_items.sql
-- Group L backlog (Fix 5): backfill approval metadata for legacy/seed items
-- Mode: Idempotent rerunnable migration (Mode B — safe to re-run)
--
-- Invariant: every item with status = 'available' must carry approval metadata
-- (approved_at NOT NULL). The listing-approval workflow (admin_approve_listing)
-- and the re-approval trigger (tr_items_require_reapproval_on_seller_edit, which
-- sets status back to 'pending' AND clears approved_at/approved_by together)
-- guarantee this for all NEW rows. Seed/legacy rows predate the workflow and were
-- inserted with status='available' and approved_at=NULL (seed-staging-data.ts).
--
-- Backfill rule: use updated_at (falling back to created_at) as the effective
-- approval timestamp. approved_by stays NULL — these are seed/legacy approvals
-- with no recorded admin. Idempotent: only touches rows still missing approved_at,
-- so re-running (or running after a partial apply) is safe.

-- =============================================================================
-- BLOCK 1 — Data backfill (no schema change)
-- =============================================================================
UPDATE public.items i
SET approved_at = COALESCE(i.updated_at, i.created_at)
WHERE i.status = 'available'
  AND i.approved_at IS NULL;

-- =============================================================================
-- BLOCK 2 — Verification (run after applying; expect 0 rows)
-- =============================================================================
-- SELECT COUNT(*) AS still_missing
-- FROM public.items i
-- WHERE i.status = 'available' AND i.approved_at IS NULL;
