-- =====================================================
-- FILE: supabase/migrations/201_notifications_schema_v2.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-001)
-- TASK: Notification Schema & Preferences
-- DESCRIPTION:
--   1. Create notification category enum
--   2. Create notification preferences table
--   3. Create trigger to initialize default preferences
--   4. Ensure user_notifications table is consistent
-- =====================================================

-- 1. Create notification category enum if not exists
DO $$ BEGIN
    CREATE TYPE notification_category AS ENUM (
        'subscription',
        'sp_events',
        'badges',
        'trades',
        'system'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category notification_category NOT NULL,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    quiet_hours_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TIME DEFAULT '22:00:00', -- 10pm
    quiet_hours_end TIME DEFAULT '08:00:00', -- 8am
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);

-- 3. RLS policies for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
CREATE POLICY "Users can view own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;
CREATE POLICY "Users can update own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role bypass for preferences" ON notification_preferences;
CREATE POLICY "Service role bypass for preferences"
    ON notification_preferences FOR ALL
    TO service_role
    USING (true);

-- 4. Trigger Function: Initialize notification preferences for new users
CREATE OR REPLACE FUNCTION initialize_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id, category, push_enabled, in_app_enabled, email_enabled)
    VALUES
        (NEW.id, 'subscription', true, true, true),
        (NEW.id, 'sp_events', true, true, false),
        (NEW.id, 'badges', true, true, false),
        (NEW.id, 'trades', true, true, false),
        (NEW.id, 'system', true, true, false)
    ON CONFLICT (user_id, category) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to auth.users (idempotent)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_initialize_notification_preferences'
    ) THEN
        CREATE TRIGGER trigger_initialize_notification_preferences
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION initialize_notification_preferences();
    END IF;
END $$;

-- Initialize preferences for existing users
INSERT INTO notification_preferences (user_id, category, push_enabled, in_app_enabled, email_enabled)
SELECT u.id, c.cat, true, true, false
FROM auth.users u
CROSS JOIN (
    SELECT unnest(enum_range(NULL::notification_category)) as cat
) c
ON CONFLICT (user_id, category) DO NOTHING;

-- 5. Ensure user_notifications is consistent with V2 requirements
-- If user_notifications exists but doesn't have category enum, we'll keep it as text for compatibility 
-- but allow it to store these enum values.

-- 6. RPC: Get notification preferences
CREATE OR REPLACE FUNCTION get_notification_preferences(p_user_id UUID)
RETURNS TABLE(
    category notification_category,
    push_enabled BOOLEAN,
    in_app_enabled BOOLEAN,
    email_enabled BOOLEAN,
    quiet_hours_enabled BOOLEAN,
    quiet_hours_start TIME,
    quiet_hours_end TIME
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        np.category,
        np.push_enabled,
        np.in_app_enabled,
        np.email_enabled,
        np.quiet_hours_enabled,
        np.quiet_hours_start,
        np.quiet_hours_end
    FROM notification_preferences np
    WHERE np.user_id = p_user_id
    ORDER BY np.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Update notification preference
CREATE OR REPLACE FUNCTION update_notification_preference(
    p_user_id UUID,
    p_category notification_category,
    p_push_enabled BOOLEAN DEFAULT NULL,
    p_in_app_enabled BOOLEAN DEFAULT NULL,
    p_email_enabled BOOLEAN DEFAULT NULL,
    p_quiet_hours_enabled BOOLEAN DEFAULT NULL,
    p_quiet_hours_start TIME DEFAULT NULL,
    p_quiet_hours_end TIME DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    UPDATE notification_preferences
    SET
        push_enabled = COALESCE(p_push_enabled, push_enabled),
        in_app_enabled = COALESCE(p_in_app_enabled, in_app_enabled),
        email_enabled = COALESCE(p_email_enabled, email_enabled),
        quiet_hours_enabled = COALESCE(p_quiet_hours_enabled, quiet_hours_enabled),
        quiet_hours_start = COALESCE(p_quiet_hours_start, quiet_hours_start),
        quiet_hours_end = COALESCE(p_quiet_hours_end, quiet_hours_end),
        updated_at = now()
    WHERE user_id = p_user_id AND category = p_category;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1. Check if table exists
-- SELECT * FROM information_schema.tables WHERE table_name = 'notification_preferences';

-- 2. Check if enum exists
-- SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_category' GROUP BY t.typname;

-- 3. Check if RLS is enabled
--SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'notification_preferences';

-- 4. Update admin_notifications CHECK constraint for notification_type
ALTER TABLE admin_notifications 
    DROP CONSTRAINT IF EXISTS admin_notifications_notification_type_check;

ALTER TABLE admin_notifications
    ADD CONSTRAINT admin_notifications_notification_type_check 
    CHECK (notification_type IN (
        'listing_pending_approval', 
        'listing_starter_pack_eligible', 
        'listing_approved', 
        'listing_deleted',
        'id_badge_submission',
        'id_badge_approved',
        'id_badge_rejected'
    ));
