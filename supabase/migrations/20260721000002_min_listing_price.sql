-- =============================================================================
-- Migration: Minimum Listing Price Floor
-- Date: 2026-07-21
-- Mode: Idempotent Rerunnable
--
-- Adds an admin-configurable minimum listing price. Listings priced below this
-- threshold cannot be published (single-item or bulk). When the threshold is
-- raised, existing available listings below the new value are auto-paused.
-- =============================================================================

-- =============================================================================
-- BLOCK 1: Seed the config key + extend secure_upsert_admin_config
-- =============================================================================

-- 1. Seed min_listing_price into admin_config (default $0 = no floor)
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES (
    'min_listing_price',
    '0',
    'Minimum price (in dollars) required for a listing to go live. Set to 0 to disable the floor.',
    'fees',
    'number',
    true
)
ON CONFLICT (key) DO NOTHING;

-- 2. Extend secure_upsert_admin_config to auto-pause listings when min_listing_price is raised
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

    -- Perform the upsert
    INSERT INTO public.admin_config (
        key,
        value,
        category,
        updated_at,
        updated_by
    )
    VALUES (
        p_key,
        p_value,
        v_category,
        now(),
        p_user_id
    )
    ON CONFLICT (key) DO UPDATE
    SET
        value = EXCLUDED.value,
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
-- BLOCK 2: Verification queries
-- =============================================================================

-- Verify config row exists
SELECT key, value, data_type, is_active, category
FROM public.admin_config
WHERE key = 'min_listing_price';

-- Verify RPC works
SELECT public.secure_upsert_admin_config('min_listing_price', '0');

-- Verify function signature
SELECT proname, prosrc FROM pg_proc WHERE proname = 'secure_upsert_admin_config';
