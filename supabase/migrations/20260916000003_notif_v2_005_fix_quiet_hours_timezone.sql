-- =====================================================
-- FILE: supabase/migrations/203_notif_v2_005_fix_quiet_hours_timezone.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-005)
-- TASK: Quiet Hours timezone-safe check
-- DESCRIPTION:
--   Fix is_in_quiet_hours to support client-local time input
--   to avoid DB server timezone mismatch during push checks.
-- =====================================================

CREATE OR REPLACE FUNCTION is_in_quiet_hours(
    p_user_id UUID,
    p_current_time TIME DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_resolved_user_id UUID;
    v_quiet_enabled BOOLEAN;
    v_quiet_start TIME;
    v_quiet_end TIME;
    v_effective_current_time TIME;
BEGIN
    v_resolved_user_id := p_user_id;

    -- Accept either auth user_id or profiles.id.
    IF NOT EXISTS (
        SELECT 1
        FROM notification_preferences np
        WHERE np.user_id = v_resolved_user_id
    ) THEN
        SELECT p.user_id
        INTO v_resolved_user_id
        FROM profiles p
        WHERE p.id = p_user_id
        LIMIT 1;

        IF v_resolved_user_id IS NULL THEN
            RETURN false;
        END IF;
    END IF;

    SELECT
        np.quiet_hours_enabled,
        np.quiet_hours_start,
        np.quiet_hours_end
    INTO
        v_quiet_enabled,
        v_quiet_start,
        v_quiet_end
    FROM notification_preferences np
        WHERE np.user_id = v_resolved_user_id
      AND np.category = 'subscription'
    LIMIT 1;

    IF v_quiet_enabled IS NULL OR v_quiet_enabled = false THEN
        RETURN false;
    END IF;

    v_effective_current_time := COALESCE(p_current_time, CURRENT_TIME);

    IF v_quiet_start > v_quiet_end THEN
        RETURN v_effective_current_time >= v_quiet_start
            OR v_effective_current_time <= v_quiet_end;
    ELSE
        RETURN v_effective_current_time >= v_quiet_start
            AND v_effective_current_time <= v_quiet_end;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1) Verify function signature exists
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid)
-- FROM pg_proc p
-- WHERE p.proname = 'is_in_quiet_hours';

-- 2) Verify client-time based evaluation with an in-window value
-- SELECT is_in_quiet_hours(
--   '<YOUR_USER_ID>'::uuid,
--   (
--     SELECT (np.quiet_hours_start + INTERVAL '1 minute')::time
--     FROM notification_preferences np
--     WHERE np.user_id = '<YOUR_USER_ID>'::uuid
--       AND np.category = 'subscription'
--     LIMIT 1
--   )
-- ) AS should_be_true;

-- 2b) If you only know profiles.id, verify the fallback path
-- SELECT is_in_quiet_hours('<YOUR_PROFILE_ID>'::uuid, '08:25:00'::time) AS should_be_true_via_profile_id;

-- 3) Verify fallback to server CURRENT_TIME still works
-- SELECT is_in_quiet_hours('<YOUR_USER_ID>'::uuid) AS server_time_based;
