-- =============================================================================
-- Migration: Dev Task 86 — Forward-only min_listing_price (remove the
--            retroactive auto-pause of existing active listings)
-- Date: 2026-09-02
-- Mode: Idempotent Rerunnable (Mode B) — safe to re-run; CREATE OR REPLACE is
--       native rerunnable and REVOKE of an already-revoked grant is a no-op.
--
-- Decision (owner, 2026-09-02): min_listing_price is FORWARD-ONLY. Raising it
--   MUST NOT retroactively pause existing `available` listings that now sit below
--   the new floor. The floor is enforced only at:
--     * NEW listing creation        — client `createListing` / `ItemCreateScreen`
--                                     publish modal ("Price must be at least $X"),
--     * PRICE EDITS on existing listings — client `updateListing` /
--                                     `EditListingScreen` re-validate against the
--                                     current minimum,
--   and is NOT applied to non-price edits (only the CREATE- and PRICE-EDIT paths
--   re-read `admin_config.min_listing_price`; a non-price edit never hits the
--   floor check).
--
-- Problem being fixed:
--   The previous `secure_upsert_admin_config` body (20260721000003 BLOCK 3)
--   contained a RETROACTIVE auto-pause branch: whenever an admin raised
--   `min_listing_price` on the admin `/config` FEES page, it paused EVERY
--   `available` listing priced below the new threshold. QA Task 19 (2026-09-02)
--   proved this live on staging — raising 0→5 auto-paused 12 listings, including
--   11 pre-existing ones that were never touched by a seller. Under the
--   forward-only decision this is wrong: existing active listings must stay
--   listed even if they are below the new floor.
--
-- Fix:
--   1. Re-create public.secure_upsert_admin_config WITHOUT the auto-pause branch
--      (and without its now-unused DECLARE vars / `paused_listings_count` return
--      field). The admin config PATCH API (route.ts) only logs the RPC result and
--      does not read `paused_listings_count`, so dropping it is safe.
--   2. Re-assert grants: service_role ONLY (keeps the DT-56a lockdown state —
--      the admin portal config-save API authenticates with the service-role key).
--   3. NO automatic data backfill is baked into this migration — see the
--      "Backfill policy" note at the bottom (staging is already clean; a blind
--      backfill cannot distinguish legacy-auto-paused rows from admin-paused rows
--      because the old branch never recorded per-listing ids and items have no
--      pause-reason column).
--
-- Rollback (one-line reverse): re-apply the pre-2026-09-02 function body from
--   migration 20260721000003 (BLOCK 3) to restore the retroactive auto-pause.
-- =============================================================================

-- =============================================================================
-- BLOCK 1: Re-create secure_upsert_admin_config without the auto-pause branch
-- =============================================================================

-- CREATE OR REPLACE (no DROP) so the DT-56a grant state (service_role only)
-- persists across the replace; the REVOKE/GRANT below re-asserts it explicitly.
CREATE OR REPLACE FUNCTION public.secure_upsert_admin_config(
    p_key TEXT,
    p_value TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_updated RECORD;
    v_category public.admin_config_category;
BEGIN
    -- Determine category (Preserve existing or use heuristic)
    SELECT category INTO v_category FROM public.admin_config WHERE key = p_key;

    IF v_category IS NULL THEN
        -- Heuristic for new keys
        v_category := CASE
            WHEN p_key LIKE 'referral_%' THEN 'referral'::public.admin_config_category
            WHEN p_key LIKE 'sp_%' THEN 'swap_points'::public.admin_config_category
            WHEN p_key LIKE 'fee_%' OR p_key LIKE 'min_%' OR p_key LIKE '%_price%' THEN 'fees'::public.admin_config_category
            ELSE 'feature_flags'::public.admin_config_category -- Fallback
        END;
    END IF;

    -- Perform the upsert — ALWAYS set is_active = true
    -- (is_active must stay true so the mobile app's .eq('is_active', true) read
    --  path sees the row — see 20260721000003 for the original fix history.)
    INSERT INTO public.admin_config (
        key,
        value,
        category,
        is_active,
        updated_at,
        updated_by
    )
    VALUES (
        p_key,
        p_value,
        v_category,
        true,
        now(),
        p_user_id
    )
    ON CONFLICT (key) DO UPDATE
    SET
        value = EXCLUDED.value,
        is_active = true,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
    RETURNING * INTO v_updated;

    -- NOTE (Dev Task 86, 2026-09-02): the former retroactive auto-pause branch
    -- (pause all `available` items with price < new min_listing_price) was
    -- REMOVED here per the forward-only decision. Raising min_listing_price now
    -- only updates the config value; existing listings are never auto-paused.

    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('secure_upsert_admin_config', 'Success', jsonb_build_object('key', p_key, 'value', p_value, 'user_id', p_user_id));

    RETURN jsonb_build_object(
        'success', true,
        'data', row_to_json(v_updated)
    );
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('secure_upsert_admin_config', 'ERROR', jsonb_build_object('error', SQLERRM, 'key', p_key));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- BLOCK 2: Re-assert grant state — service_role ONLY (DT-56a lockdown)
-- =============================================================================

-- CREATE OR REPLACE preserves grants, but make the intended end-state explicit
-- and rerun-safe (idempotent: revoking an already-revoked grant is a no-op).
REVOKE EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID)
  FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- Verification queries (SQL-3 / BP-10 — run AFTER applying)
-- =============================================================================

-- 1. Function body no longer contains the retroactive auto-pause branch.
--    Predicate = the OLD branch's distinctive debug_logs message literal
--    ('Auto-paused listings') + its counter var, which the new body does not
--    contain (a naive ILIKE '%auto-pause%' would false-positive on the NOTE
--    comment inside the new body). Expect: 0 rows.
SELECT proname
FROM pg_proc
WHERE proname = 'secure_upsert_admin_config'
  AND (prosrc ILIKE '%Auto-paused listings%' OR prosrc ILIKE '%v_paused_count%');

-- 2. Grants: expect EXACTLY service_role (plus owner); NO anon/authenticated/PUBLIC
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'secure_upsert_admin_config'
ORDER BY grantee, privilege_type;

-- 3. Raise does NOT pause (functional smoke, run via the service-role admin path):
--    raise min_listing_price 0->5, then confirm no `available` item flipped to
--    `paused`; lower back to the prior value afterwards.

-- =============================================================================
-- Backfill policy (Dev Task 86 — owner note, NO automatic backfill in this file)
-- =============================================================================
-- The task asks to "backfill any listings paused solely under the old retroactive
-- behavior back to `available`". This migration intentionally does NOT auto-run a
-- blind backfill, because the old branch never recorded per-listing ids (it wrote
-- only a count to debug_logs) and `items` has no pause-reason/`auto_paused`
-- marker — so a programmatic backfill cannot distinguish a listing the old branch
-- auto-paused from one an admin paused deliberately. Restoring the wrong rows
-- would silently re-list listings an admin intentionally paused.
--
-- Current state (verified by QA Task 19 cleanup, 2026-09-02, on staging): the
-- raise was reverted to `min_listing_price = 0`, all 11 pre-existing auto-paused
-- listings were restored to `available`, the $3 fixture was deleted, and the final
-- state was `min_listing_price = 0`, `paused_sub5_remaining = 0`. => No rows need
-- a backfill on staging today.
--
-- If a DIFFERENT environment still holds rows paused by the old branch, restore
-- them ONLY after confirming they were not admin-paused. Diagnostic to enumerate
-- the candidate set (approval-gated before any UPDATE):
--
--   SELECT id, seller_id, title, price, status, updated_at
--   FROM public.items
--   WHERE status = 'paused'
--     AND price < (SELECT COALESCE(MAX((value)::NUMERIC), 0)
--                  FROM public.admin_config
--                  WHERE key = 'min_listing_price' AND is_active = true)
--   ORDER BY updated_at DESC;
-- =============================================================================
