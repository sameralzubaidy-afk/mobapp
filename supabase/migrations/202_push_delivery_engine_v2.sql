-- =====================================================
-- FILE: supabase/migrations/202_push_delivery_engine_v2.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-005)
-- TASK: Push Notification Delivery Engine
-- DESCRIPTION:
--   1. Rate limiting table (10 push notifications/hour)
--   2. Deduplication tracking (5-minute window)
--   3. Retry mechanism (up to 3 attempts)
--   4. Push notification receipts tracking
--   5. Quiet hours enforcement RPC
--   6. Centralized delivery status tracking
-- =====================================================

-- Precondition: this migration depends on the existing user_notifications table.
DO $$
BEGIN
    IF to_regclass('public.user_notifications') IS NULL THEN
        RAISE EXCEPTION 'Missing dependency: public.user_notifications does not exist. Apply notifications schema migrations first.';
    END IF;

    IF to_regclass('public.notification_preferences') IS NULL THEN
        RAISE EXCEPTION 'Missing dependency: public.notification_preferences does not exist. Apply NOTIF-V2-001 migration first.';
    END IF;

    IF to_regclass('public.push_tokens') IS NULL THEN
        RAISE EXCEPTION 'Missing dependency: public.push_tokens does not exist. Apply push token migration first.';
    END IF;
END $$;

-- 1. Create push_delivery_log table (tracks each push attempt + rate limiting)
CREATE TABLE IF NOT EXISTS push_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES user_notifications(id) ON DELETE CASCADE,
    push_token_id UUID REFERENCES push_tokens(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ DEFAULT now(),
    expo_receipt_id TEXT, -- Expo push ticket ID
    receipt_status TEXT CHECK (receipt_status IN ('ok', 'error', 'DeviceNotRegistered', 'MessageTooBig', 'MessageRateExceeded', 'MismatchSenderId', 'InvalidCredentials')),
    receipt_message TEXT,
    receipt_details JSONB,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_user_sent ON push_delivery_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_notification ON push_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_receipt ON push_delivery_log(expo_receipt_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_retry ON push_delivery_log(retry_count) WHERE receipt_status = 'error';

-- RLS policies for push_delivery_log
ALTER TABLE push_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage push delivery log" ON push_delivery_log;
CREATE POLICY "Service role can manage push delivery log"
    ON push_delivery_log FOR ALL
    TO service_role
    USING (true);

-- 2. Create notification_deduplication table (prevents duplicate notifications within 5 minutes)
CREATE TABLE IF NOT EXISTS notification_deduplication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL, -- e.g., 'sp_earned', 'badge_earned'
    notification_fingerprint TEXT NOT NULL, -- Hash of type + key data
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '5 minutes'),
    UNIQUE(user_id, notification_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_dedup_user_fingerprint ON notification_deduplication(user_id, notification_fingerprint);
-- NOTE: partial index predicates cannot use non-IMMUTABLE functions like now().
CREATE INDEX IF NOT EXISTS idx_dedup_expires ON notification_deduplication(expires_at);

-- RLS policies for notification_deduplication
ALTER TABLE notification_deduplication ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage deduplication" ON notification_deduplication;
CREATE POLICY "Service role can manage deduplication"
    ON notification_deduplication FOR ALL
    TO service_role
    USING (true);

-- 3. Create notification_retry_queue table (failed deliveries to retry)
CREATE TABLE IF NOT EXISTS notification_retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ DEFAULT now(),
    last_error TEXT,
    last_error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(notification_id)
);

CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry ON notification_retry_queue(next_retry_at) WHERE attempt_count < max_attempts;
CREATE INDEX IF NOT EXISTS idx_retry_queue_notification ON notification_retry_queue(notification_id);

-- RLS policies for notification_retry_queue
ALTER TABLE notification_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage retry queue" ON notification_retry_queue;
CREATE POLICY "Service role can manage retry queue"
    ON notification_retry_queue FOR ALL
    TO service_role
    USING (true);

-- 4. RPC: Check if user is within rate limit (10 push notifications/hour)
CREATE OR REPLACE FUNCTION check_push_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Count push deliveries in last hour
    SELECT COUNT(*)
    INTO v_count
    FROM push_delivery_log
    WHERE user_id = p_user_id
      AND sent_at >= (now() - INTERVAL '1 hour');
    
    -- Return true if under limit (10/hour)
    RETURN v_count < 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Check if user is in quiet hours
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

    -- Get user's quiet hours preferences (default to subscription category)
    SELECT 
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end
    INTO 
        v_quiet_enabled,
        v_quiet_start,
        v_quiet_end
    FROM notification_preferences
        WHERE user_id = v_resolved_user_id
      AND category = 'subscription' -- Use subscription category as global default
    LIMIT 1;
    
    -- If no preferences found or quiet hours disabled, not in quiet hours
    IF v_quiet_enabled IS NULL OR v_quiet_enabled = false THEN
        RETURN false;
    END IF;
    
    -- Prefer client-provided local time to avoid server-timezone mismatch.
    v_effective_current_time := COALESCE(p_current_time, CURRENT_TIME);
    
    -- Check if current time is within quiet hours
    -- Handle overnight quiet hours (e.g., 22:00 - 08:00)
    IF v_quiet_start > v_quiet_end THEN
        -- Overnight: quiet if >= start OR <= end
        RETURN v_effective_current_time >= v_quiet_start OR v_effective_current_time <= v_quiet_end;
    ELSE
        -- Same day: quiet if >= start AND <= end
        RETURN v_effective_current_time >= v_quiet_start AND v_effective_current_time <= v_quiet_end;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Check for duplicate notification (returns true if duplicate exists)
CREATE OR REPLACE FUNCTION is_duplicate_notification(
    p_user_id UUID,
    p_notification_type TEXT,
    p_fingerprint TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if duplicate exists and hasn't expired
    SELECT EXISTS(
        SELECT 1
        FROM notification_deduplication
        WHERE user_id = p_user_id
          AND notification_type = p_notification_type
          AND notification_fingerprint = p_fingerprint
          AND expires_at > now()
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Record notification for deduplication
CREATE OR REPLACE FUNCTION record_notification_dedup(
    p_user_id UUID,
    p_notification_type TEXT,
    p_fingerprint TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notification_deduplication (
        user_id,
        notification_type,
        notification_fingerprint,
        created_at,
        expires_at
    ) VALUES (
        p_user_id,
        p_notification_type,
        p_fingerprint,
        now(),
        now() + INTERVAL '5 minutes'
    )
    ON CONFLICT (user_id, notification_fingerprint) 
    DO UPDATE SET 
        created_at = now(),
        expires_at = now() + INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Log push delivery
CREATE OR REPLACE FUNCTION log_push_delivery(
    p_user_id UUID,
    p_notification_id UUID,
    p_push_token_id UUID,
    p_expo_receipt_id TEXT DEFAULT NULL,
    p_receipt_status TEXT DEFAULT 'ok',
    p_receipt_message TEXT DEFAULT NULL,
    p_receipt_details JSONB DEFAULT NULL,
    p_retry_count INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO push_delivery_log (
        user_id,
        notification_id,
        push_token_id,
        sent_at,
        expo_receipt_id,
        receipt_status,
        receipt_message,
        receipt_details,
        retry_count
    ) VALUES (
        p_user_id,
        p_notification_id,
        p_push_token_id,
        now(),
        p_expo_receipt_id,
        p_receipt_status,
        p_receipt_message,
        p_receipt_details,
        p_retry_count
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Add notification to retry queue
CREATE OR REPLACE FUNCTION add_to_retry_queue(
    p_notification_id UUID,
    p_user_id UUID,
    p_error TEXT,
    p_error_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_attempt_count INTEGER;
BEGIN
    -- Check if already in queue
    SELECT attempt_count INTO v_attempt_count
    FROM notification_retry_queue
    WHERE notification_id = p_notification_id;
    
    IF v_attempt_count IS NOT NULL THEN
        -- Update existing entry
        UPDATE notification_retry_queue
        SET 
            attempt_count = attempt_count + 1,
            last_error = p_error,
            last_error_details = p_error_details,
            -- Exponential backoff: 1min, 5min, 15min
            next_retry_at = CASE 
                WHEN attempt_count = 0 THEN now() + INTERVAL '1 minute'
                WHEN attempt_count = 1 THEN now() + INTERVAL '5 minutes'
                ELSE now() + INTERVAL '15 minutes'
            END,
            updated_at = now()
        WHERE notification_id = p_notification_id;
    ELSE
        -- Insert new entry
        INSERT INTO notification_retry_queue (
            notification_id,
            user_id,
            attempt_count,
            max_attempts,
            next_retry_at,
            last_error,
            last_error_details
        ) VALUES (
            p_notification_id,
            p_user_id,
            0,
            3,
            now() + INTERVAL '1 minute',
            p_error,
            p_error_details
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: Remove from retry queue (after successful delivery)
CREATE OR REPLACE FUNCTION remove_from_retry_queue(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM notification_retry_queue
    WHERE notification_id = p_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Cleanup expired deduplication entries (daily maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_deduplications()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM notification_deduplication
    WHERE expires_at < now();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. View: Retry queue pending items
CREATE OR REPLACE VIEW v_pending_retries AS
SELECT 
    nrq.*,
    n.title,
    n.body,
    n.type,
    n.category
FROM notification_retry_queue nrq
JOIN user_notifications n ON n.id = nrq.notification_id
WHERE nrq.attempt_count < nrq.max_attempts
  AND nrq.next_retry_at <= now()
ORDER BY nrq.next_retry_at ASC;

-- Grant permissions
GRANT SELECT ON v_pending_retries TO service_role;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('push_delivery_log', 'notification_deduplication', 'notification_retry_queue');

-- Verify RPCs created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'check_push_rate_limit',
    'is_in_quiet_hours',
    'is_duplicate_notification',
    'record_notification_dedup',
    'log_push_delivery',
    'add_to_retry_queue',
    'remove_from_retry_queue',
    'cleanup_expired_deduplications'
  );

-- Test rate limit check (should return true for new user)
-- SELECT check_push_rate_limit('<YOUR_USER_ID>'::uuid);

-- Test quiet hours check (should return false during day time)
-- SELECT is_in_quiet_hours('<YOUR_USER_ID>'::uuid);

-- Test duplicate check (should return false for new fingerprint)
-- SELECT is_duplicate_notification('<YOUR_USER_ID>'::uuid, 'sp_earned', 'test-fingerprint');
