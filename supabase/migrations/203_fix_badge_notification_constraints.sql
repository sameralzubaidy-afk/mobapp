-- =====================================================
-- FILE: supabase/migrations/203_fix_badge_notification_constraints.sql
-- MODULE: MODULE-10-ID-BADGE-VERIFICATION-V2
-- TASK: Fix Notification Delivery (BADGE-011)
-- DESCRIPTION:
--   1. Fix admin_notifications check constraint to include ID badge types.
--   2. Ensure service_role can insert into notification tables.
--   3. Idempotent setup for BADGE-011 notifications.
-- =====================================================

-- 1. Update admin_notifications CHECK constraint for notification_type
-- This ensures the Edge Function doesn't fail when inserting new types.
DO $$ 
BEGIN
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update admin_notifications constraint. It may have been updated in migration 201.';
END $$;

-- 2. Explicitly allow service_role to insert (bypasses RLS)
-- While service_role usually bypasses RLS, being explicit prevents issues in some configurations.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_notifications' AND policyname = 'Service role can manage user notifications'
    ) THEN
        CREATE POLICY "Service role can manage user notifications"
            ON user_notifications FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_notifications' AND policyname = 'Service role can manage admin notifications'
    ) THEN
        CREATE POLICY "Service role can manage admin notifications"
            ON admin_notifications FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 3. Verify user_notifications schema for badges category
-- If user_notifications does not have proper default for category, or if we want to ensure any TEXT fits.
-- (user_notifications.category is already TEXT in migration 175)

-- 4. Initial verification query for user
-- Run this in SQL editor to confirm setup:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'admin_notifications'::regclass;
-- SELECT policyname FROM pg_policies WHERE tablename = 'user_notifications';
