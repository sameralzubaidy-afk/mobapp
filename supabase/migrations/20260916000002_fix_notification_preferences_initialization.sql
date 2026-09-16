-- =====================================================
-- FILE: supabase/migrations/203_fix_notification_preferences_initialization.sql
-- TASK: Ensure user notification preferences can be initialized manually
-- =====================================================

-- RPC to manually initialize preferences for a user if they are missing
CREATE OR REPLACE FUNCTION public.initialize_user_preferences(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notification_preferences (user_id, category, push_enabled, in_app_enabled, email_enabled)
    VALUES
        (p_user_id, 'subscription', true, true, true),
        (p_user_id, 'sp_events', true, true, false),
        (p_user_id, 'badges', true, true, false),
        (p_user_id, 'trades', true, true, false),
        (p_user_id, 'system', true, true, false)
    ON CONFLICT (user_id, category) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verification
-- SELECT public.initialize_user_preferences('some-uuid');
