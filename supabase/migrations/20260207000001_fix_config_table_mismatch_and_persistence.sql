-- Fix Config Table Mismatch: Unify sp_config and admin_config
-- Mode: Idempotent Rerunnable Migration
-- Problem: RPC functions read from sp_config, but admin API writes to admin_config.
--          Migration kept resetting sp_config with ON CONFLICT DO UPDATE.
-- Solution: Make sp_config canonical for referral logic, sync changes from admin_config.

-- 0. ADD 'referral' CATEGORY TO admin_config_category ENUM (if not exists)
DO $$
BEGIN
    ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'referral';
EXCEPTION WHEN OTHERS THEN
    -- Enum value might already exist, continue
    NULL;
END $$;

-- 1. DISABLE RESET BEHAVIOR IN EXISTING sp_config TABLE
-- Remove the ON CONFLICT DO UPDATE pattern so migrations don't keep resetting values to hardcoded defaults
-- (This is already in 20260205000003, but we need to prevent future migrations from resetting)

-- 2. SEED sp_config ONLY ON FIRST RUN (IF NOT EXISTS)
-- Use INSERT ... ON CONFLICT DO NOTHING to avoid resetting user edits
DELETE FROM public.sp_config WHERE config_key IN (
    'referral_reward_referee_sp',
    'referral_reward_referrer_sp',
    'referral_reward_referrer_listing_sp',
    'referral_reward_referee_listing_sp',
    'referral_first_listing_enabled',
    'referral_program_enabled',
    'referral_first_trade_enabled'
) AND created_at = updated_at; -- Only delete if never been edited (created_at == updated_at)

-- Insert defaults only if not already present
INSERT INTO public.sp_config (config_key, config_value, value_type, category) VALUES
    ('referral_bonus', '50', 'number', 'general'),
    ('referral_reward_referee_sp', '10', 'number', 'general'),
    ('referral_reward_referrer_sp', '25', 'number', 'general'),
    ('referral_reward_referrer_listing_sp', '25', 'number', 'general'),
    ('referral_reward_referee_listing_sp', '10', 'number', 'general'),
    ('referral_first_listing_enabled', 'true', 'boolean', 'general'),
    ('referral_program_enabled', 'true', 'boolean', 'general'),
    ('referral_first_trade_enabled', 'true', 'boolean', 'general')
ON CONFLICT (config_key) DO NOTHING; -- IMPORTANT: DO NOTHING preserves user edits

-- 3. POPULATE admin_config with same referral keys (for admin UI)
-- Use ON CONFLICT DO NOTHING to preserve existing user edits
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active) VALUES
    ('referral_bonus', '50', 'General referral bonus points awarded on signup', 'referral', 'number', true),
    ('referral_reward_referee_sp', '10', 'Swap Points awarded to referee when they sign up with referral code', 'referral', 'number', true),
    ('referral_reward_referrer_sp', '25', 'Swap Points awarded to referrer when someone signs up with their code', 'referral', 'number', true),
    ('referral_reward_referrer_listing_sp', '25', 'Swap Points awarded to referrer when referred user approves first listing', 'referral', 'number', true),
    ('referral_reward_referee_listing_sp', '10', 'Swap Points awarded to referee when they approve first listing', 'referral', 'number', true),
    ('referral_first_listing_enabled', 'true', 'Enable/disable bonus SP for first approved listing', 'referral', 'boolean', true),
    ('referral_program_enabled', 'true', 'Enable/disable entire referral program', 'referral', 'boolean', true),
    ('referral_first_trade_enabled', 'true', 'Enable/disable bonus SP for first completed trade', 'referral', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

-- 4. CREATE SYNC TRIGGER: admin_config → sp_config
-- Whenever admin updates admin_config referral keys, automatically update sp_config
-- This ensures RPCs always read the latest admin-configured values
CREATE OR REPLACE FUNCTION public.sync_sp_config_on_admin_update()
RETURNS TRIGGER AS $$
DECLARE
    v_is_referral_key BOOLEAN;
BEGIN
    -- Only sync if this is a referral-related key
    v_is_referral_key := NEW.key LIKE 'referral_%';
    
    IF NOT v_is_referral_key THEN
        RETURN NEW;
    END IF;
    
    -- Update sp_config with the new value from admin_config
    UPDATE public.sp_config
    SET 
        config_value = to_jsonb(NEW.value),
        updated_at = now()
    WHERE config_key = NEW.key;
    
    -- If the key didn't exist in sp_config, insert it
    IF NOT FOUND THEN
        INSERT INTO public.sp_config (config_key, config_value, value_type, category)
        VALUES (
            NEW.key,
            to_jsonb(NEW.value),
            CASE 
                WHEN NEW.data_type = 'number' THEN 'number'
                WHEN NEW.data_type = 'boolean' THEN 'boolean'
                ELSE 'string'
            END,
            'general'
        )
        ON CONFLICT (config_key) DO UPDATE
        SET config_value = to_jsonb(NEW.value), updated_at = now();
    END IF;
    
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
        'sync_sp_config',
        'Synced admin_config change to sp_config',
        jsonb_build_object('key', NEW.key, 'new_value', NEW.value)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, recreate
DROP TRIGGER IF EXISTS trigger_sync_sp_config_on_admin_update ON public.admin_config;
CREATE TRIGGER trigger_sync_sp_config_on_admin_update
AFTER UPDATE ON public.admin_config
FOR EACH ROW
EXECUTE FUNCTION public.sync_sp_config_on_admin_update();

-- 5. VERIFICATION QUERIES (run after migration to confirm sync is working)
-- SELECT * FROM sp_config WHERE config_key LIKE 'referral_%' ORDER BY config_key;
-- SELECT * FROM admin_config WHERE key LIKE 'referral_%' ORDER BY key;
-- (Both tables should have matching values)

-- 6. INSTRUCTION FOR ADMIN PORTAL API
-- The admin portal API (/api/admin/config) already updates admin_config.
-- With this trigger in place, any PATCH to admin_config will automatically sync to sp_config.
-- RPCs will read the latest values from sp_config without any additional changes needed.

-- 7. ROLLBACK NOTE
-- If you need to rollback this migration:
--   1. DROP TRIGGER trigger_sync_sp_config_on_admin_update ON public.admin_config;
--   2. DROP FUNCTION public.sync_sp_config_on_admin_update();
--   3. The sp_config and admin_config tables will continue to exist but changes won't sync.
