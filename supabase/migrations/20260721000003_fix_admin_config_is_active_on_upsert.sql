-- =============================================================================
-- Migration: Fix secure_upsert_admin_config to always set is_active = true
--            + Restore admin_config_authenticated_read RLS policy
-- Date: 2026-07-21
-- Mode: Idempotent Rerunnable
--
-- Problem #1 (RLS — root cause of invisible min_listing_price):
--   Migration 312_prod_p1_stage_security_lockdown.sql DROPs the
--   "admin_config_authenticated_read" RLS policy but never recreates it.
--   The fix migration 20260601000002_fix_sp_wallet_admin_config_rls.sql
--   (which would have recreated it) was never applied to the remote.
--   Result: RLS blocks ALL authenticated reads from the mobile app.
--   The query returns [] (empty), getAdminConfig() falls back to defaults,
--   and min_listing_price silently becomes 0 — validation passes.
--
-- Problem #2 (upsert — secondary):
--   The secure_upsert_admin_config RPC's INSERT does NOT include the
--   is_active column. When a row is re-inserted, is_active defaults to NULL.
--   The mobile app's getAdminConfig() filters by .eq('is_active', true),
--   so it does not find rows with is_active = NULL.
--
-- Fix:
--   1. Recreate the missing admin_config_authenticated_read RLS policy
--   2. Add is_active = true to the INSERT VALUES
--   3. Add is_active = true to the ON CONFLICT DO UPDATE SET clause
--   4. Fixup any existing rows where is_active IS NULL or is_active = false
-- =============================================================================

-- =============================================================================
-- BLOCK 1: Fix RLS — restore authenticated read access to admin_config
-- =============================================================================

-- Migration 312_prod_p1_stage_security_lockdown.sql dropped this policy;
-- migration 20260601000002_fix_sp_wallet_admin_config_rls.sql would have
-- recreated it but was never applied to the remote database.
DROP POLICY IF EXISTS "admin_config_authenticated_read" ON public.admin_config;
CREATE POLICY "admin_config_authenticated_read" ON public.admin_config
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- BLOCK 2: Fixup existing rows
-- =============================================================================

-- Set is_active = true for any admin_config key that was upserted without it.
-- This catches (a) min_listing_price if it was ever re-inserted, and (b) any
-- other config keys whose is_active flag was lost during an upsert.
UPDATE public.admin_config
SET is_active = true,
    updated_at = now()
WHERE is_active IS DISTINCT FROM true
  AND key IS NOT NULL;

-- =============================================================================
-- BLOCK 3: Recreate secure_upsert_admin_config with is_active = true
-- =============================================================================

DROP FUNCTION IF EXISTS public.secure_upsert_admin_config(TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.secure_upsert_admin_config(
    p_key TEXT,
    p_value TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_updated RECORD;
    v_category public.admin_config_category;
    v_old_value TEXT;
    v_new_price NUMERIC;
    v_old_price NUMERIC;
    v_paused_count INTEGER := 0;
BEGIN
    -- Capture old value before upsert (for min_listing_price auto-pause logic)
    SELECT value INTO v_old_value FROM public.admin_config WHERE key = p_key;

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
    -- (FIX: previous version omitted is_active, causing it to default to NULL
    --  on insert, which silently bypassed the mobile app's is_active filter)
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

    -- Auto-pause listings when min_listing_price is raised
    IF p_key = 'min_listing_price' THEN
        v_new_price := p_value::NUMERIC;
        v_old_price := COALESCE(v_old_value::NUMERIC, 0);
        
        IF v_new_price > v_old_price THEN
            -- Pause available listings whose price is now below the new threshold
            WITH paused AS (
                UPDATE public.items
                SET status = 'paused',
                    updated_at = now()
                WHERE status = 'available'
                  AND price < v_new_price
                RETURNING id
            )
            SELECT count(*) INTO v_paused_count FROM paused;
            
            INSERT INTO public.debug_logs (process_name, message, payload)
            VALUES (
                'secure_upsert_admin_config',
                'Auto-paused listings',
                jsonb_build_object(
                    'key', p_key,
                    'old_value', v_old_price,
                    'new_value', v_new_price,
                    'paused_count', v_paused_count
                )
            );
        END IF;
    END IF;

    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('secure_upsert_admin_config', 'Success', jsonb_build_object('key', p_key, 'value', p_value, 'user_id', p_user_id));

    RETURN jsonb_build_object(
        'success', true,
        'data', row_to_json(v_updated),
        'paused_listings_count', v_paused_count
    );
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('secure_upsert_admin_config', 'ERROR', jsonb_build_object('error', SQLERRM, 'key', p_key));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-grant execute permissions (required after DROP/CREATE)
GRANT EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID) TO anon, authenticated;

-- =============================================================================
-- BLOCK 3: Verification queries
-- =============================================================================

-- 1. Verify fixup updated any rows that had is_active NULL/false
SELECT key, value, is_active, data_type
FROM public.admin_config
WHERE is_active IS DISTINCT FROM true;

-- Expected: zero rows (empty result)

-- 2. Verify RPC now sets is_active = true
-- Run this AFTER applying the migration:
-- SELECT public.secure_upsert_admin_config('min_listing_price', '12');
-- Then verify:
-- SELECT key, value, is_active FROM public.admin_config WHERE key = 'min_listing_price';
-- Expected: is_active = true

-- 3. Verify function signature
SELECT proname, prosrc FROM pg_proc WHERE proname = 'secure_upsert_admin_config';
