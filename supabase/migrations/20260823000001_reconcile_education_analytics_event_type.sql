-- Migration: 20260823000001_reconcile_education_analytics_event_type.sql
-- Module: MODULE-18 TRADING EDUCATION V1 (EDU)
-- Description: Reconcile chk_education_analytics_event_type CHECK constraint with the
--   TypeScript EducationAnalyticsEventType union (mobile + admin).
--
--   The app's own `help_view` event (fired on every Help-screen mount) was silently
--   dropped: the DB CHECK omitted it (and `seller_prompt_view` / `buyer_prompt_view`),
--   even though the TS union declares all three. QA Group Q+S 2026-08-23 (Q06) proved
--   0 help_view rows all-time while valid calculator_use events landed.
--
--   Canonical source: docx/TRADING-EDUCATION-REQUIREMENTS.md (the spec's event list
--   explicitly includes help_view), so `help_view` was NOT deprecated — the CHECK was
--   too narrow. This migration WIDENS the CHECK to the full TS-union event set.
--   The pre-existing DB-only values (section_collapse / prompt_view / prompt_dismiss /
--   prompt_action) are preserved to avoid breaking any existing/unknown inserters.
--
-- Mode: B (idempotent rerunnable) — DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT is safe
--   to re-run.

-- ============================================================================
-- BLOCK 1 — Schema: widen the CHECK constraint (drop + re-add)
-- ============================================================================

ALTER TABLE public.education_analytics
  DROP CONSTRAINT IF EXISTS chk_education_analytics_event_type;

ALTER TABLE public.education_analytics
  ADD CONSTRAINT chk_education_analytics_event_type
  CHECK (event_type IN (
    'onboarding_start',
    'onboarding_complete',
    'onboarding_skip',
    'help_view',
    'section_expand',
    'section_collapse',
    'calculator_use',
    'prompt_view',
    'prompt_dismiss',
    'prompt_action',
    'seller_prompt_view',
    'buyer_prompt_view'
  ));

-- ============================================================================
-- BLOCK 2 — Verification queries (run after BLOCK 1)
-- ============================================================================

-- 1) Constraint definition now includes the TS-union events:
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'chk_education_analytics_event_type';
--    Expected: the 12-event list above (incl. help_view, seller_prompt_view, buyer_prompt_view).

-- 2) The app's own event type is now accepted (rollback-safe test insert):
--    BEGIN;
--    INSERT INTO public.education_analytics (user_id, event_type, event_data)
--      VALUES (NULL, 'help_view', '{}') RETURNING id;
--    ROLLBACK;
--    Expected: returns an id (previously raised CHECK violation).

-- 3) Pre-existing valid events still accepted:
--    INSERT INTO public.education_analytics (user_id, event_type, event_data)
--      VALUES (NULL, 'calculator_use', '{"mode":"free"}') RETURNING id;

-- Common failure modes:
--   - Re-running is safe (DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT).
--   - If any other DDL holds a lock on education_analytics, the ALTER waits — expected.
