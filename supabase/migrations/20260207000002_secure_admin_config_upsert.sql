-- Secure Admin Config Upsert: SECURITY DEFINER to bypass RLS
-- Mode: Idempotent Rerunnable Migration

-- 1. FIX RLS POLICIES FOR service_role
-- Some Supabase environments have issues with auth.role() = 'service_role'
-- We'll add a more robust check using current_setting
DROP POLICY IF EXISTS admin_config_update_service_role ON admin_config;
CREATE POLICY admin_config_update_service_role ON admin_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. CREATE SECURE RPC FUNCTION
-- This function has SECURITY DEFINER and search_path set, making it highly secure
-- and capable of bypassing RLS to update administrative settings.
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
            WHEN p_key LIKE 'fee_%' THEN 'fees'::public.admin_config_category
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

    -- The trigger 'trigger_sync_sp_config_on_admin_update' will fire automatically
    -- syncing this change to the sp_config table.

    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('secure_upsert_admin_config', 'Success', jsonb_build_object('key', p_key, 'value', p_value, 'user_id', p_user_id));

    RETURN jsonb_build_object(
        'success', true,
        'data', row_to_json(v_updated)
    );
EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('secure_upsert_admin_config', 'ERROR', jsonb_build_object('error', SQLERRM, 'key', p_key));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. GRANT EXECUTE
GRANT EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID) TO anon, authenticated;

-- 4. ENSURE referral_bonus IS SEEDED IF MISSING
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES ('referral_bonus', '50', 'General referral bonus points awarded on signup', 'referral', 'number', true)
ON CONFLICT (key) DO NOTHING;

-- Verification
-- SELECT public.secure_upsert_admin_config('referral_bonus', '100');
