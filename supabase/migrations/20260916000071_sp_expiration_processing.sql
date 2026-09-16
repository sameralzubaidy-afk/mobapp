-- File: supabase/migrations/096_sp_expiration_processing.sql
-- MODULE-09 SP-004: SP Expiration Processing System
-- Mode: Idempotent rerunnable migration
-- Purpose: Automated SP batch expiration with warnings and grace period handling

-- =============================================================================
-- 1. CREATE SP EXPIRATION WARNING LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sp_expiration_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES sp_batches(id) ON DELETE CASCADE,
  
  -- Warning details
  warning_type TEXT NOT NULL CHECK (warning_type IN ('30_day', '14_day', '7_day', '1_day')),
  sp_amount INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Notification status
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate warnings
  UNIQUE(batch_id, warning_type)
);

CREATE INDEX IF NOT EXISTS idx_sp_expiration_warnings_user_id ON sp_expiration_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_expiration_warnings_batch_id ON sp_expiration_warnings(batch_id);
CREATE INDEX IF NOT EXISTS idx_sp_expiration_warnings_sent ON sp_expiration_warnings(notification_sent) WHERE notification_sent = false;

-- Enable RLS
ALTER TABLE sp_expiration_warnings ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view own warnings
DROP POLICY IF EXISTS "Users can view own warnings" ON sp_expiration_warnings;
CREATE POLICY "Users can view own warnings"
  ON sp_expiration_warnings FOR SELECT
  USING (user_id = auth.uid());

-- =============================================================================
-- 2. RPC: Process SP Batch Expiration
-- =============================================================================

CREATE OR REPLACE FUNCTION process_sp_expiration()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batches_expired INTEGER := 0;
  v_total_sp_expired INTEGER := 0;
  v_users_affected INTEGER := 0;
  v_batch RECORD;
BEGIN
  -- 1. Find and mark expired batches
  FOR v_batch IN
    SELECT 
      sb.id as batch_id,
      sb.wallet_id,
      sb.user_id,
      sb.remaining_sp,
      sw.available_balance
    FROM sp_batches sb
    JOIN sp_wallets sw ON sw.id = sb.wallet_id
    WHERE sb.expires_at <= NOW()
      AND sb.is_expired = FALSE
      AND sb.remaining_sp > 0
  LOOP
    -- Mark batch as expired
    UPDATE sp_batches
    SET 
      is_expired = TRUE,
      updated_at = NOW()
    WHERE id = v_batch.batch_id;
    
    -- Update wallet: move from available to lifetime_expired
    UPDATE sp_wallets
    SET 
      available_balance = GREATEST(0, available_balance - v_batch.remaining_sp),
      lifetime_expired = lifetime_expired + v_batch.remaining_sp,
      updated_at = NOW()
    WHERE id = v_batch.wallet_id;
    
    -- Create ledger entry
    INSERT INTO sp_ledger (
      wallet_id,
      user_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      description,
      related_batch_id
    ) VALUES (
      v_batch.wallet_id,
      v_batch.user_id,
      'expire',
      -v_batch.remaining_sp,
      v_batch.available_balance,
      GREATEST(0, v_batch.available_balance - v_batch.remaining_sp),
      'SP batch expired: ' || v_batch.batch_id,
      v_batch.batch_id
    );
    
    -- Increment counters
    v_batches_expired := v_batches_expired + 1;
    v_total_sp_expired := v_total_sp_expired + v_batch.remaining_sp;
  END LOOP;
  
  -- Count affected users
  SELECT COUNT(DISTINCT user_id) INTO v_users_affected
  FROM sp_batches
  WHERE is_expired = TRUE
    AND updated_at >= NOW() - INTERVAL '1 minute';
  
  RETURN jsonb_build_object(
    'success', true,
    'batches_expired', v_batches_expired,
    'total_sp_expired', v_total_sp_expired,
    'users_affected', v_users_affected,
    'processed_at', NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'processed_at', NOW()
    );
END;
$$;

COMMENT ON FUNCTION process_sp_expiration() IS 'Daily cron job to expire SP batches past their expiration date. Marks batches as expired, updates wallet balances, and creates ledger entries.';

-- =============================================================================
-- 3. RPC: Send SP Expiration Warnings
-- =============================================================================

CREATE OR REPLACE FUNCTION send_sp_expiration_warnings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_warnings_created INTEGER := 0;
  v_batch RECORD;
  v_warning_types TEXT[] := ARRAY['30_day', '14_day', '7_day', '1_day'];
  v_warning_type TEXT;
  v_days_until_expiry INTEGER;
BEGIN
  -- Loop through warning types
  FOREACH v_warning_type IN ARRAY v_warning_types
  LOOP
    -- Determine days based on warning type
    v_days_until_expiry := CASE v_warning_type
      WHEN '30_day' THEN 30
      WHEN '14_day' THEN 14
      WHEN '7_day' THEN 7
      WHEN '1_day' THEN 1
    END;
    
    -- Find batches expiring in N days
    FOR v_batch IN
      SELECT 
        sb.id as batch_id,
        sb.wallet_id,
        sb.user_id,
        sb.remaining_sp,
        sb.expires_at
      FROM sp_batches sb
      WHERE sb.is_expired = FALSE
        AND sb.remaining_sp > 0
        AND sb.expires_at > NOW()
        AND sb.expires_at <= NOW() + (v_days_until_expiry || ' days')::INTERVAL
        AND NOT EXISTS (
          -- Check if warning already exists
          SELECT 1 FROM sp_expiration_warnings
          WHERE batch_id = sb.id
            AND warning_type = v_warning_type
        )
    LOOP
      -- Create warning record
      INSERT INTO sp_expiration_warnings (
        user_id,
        wallet_id,
        batch_id,
        warning_type,
        sp_amount,
        expires_at
      ) VALUES (
        v_batch.user_id,
        v_batch.wallet_id,
        v_batch.batch_id,
        v_warning_type,
        v_batch.remaining_sp,
        v_batch.expires_at
      )
      ON CONFLICT (batch_id, warning_type) DO NOTHING;
      
      v_warnings_created := v_warnings_created + 1;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'warnings_created', v_warnings_created,
    'processed_at', NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'processed_at', NOW()
    );
END;
$$;

COMMENT ON FUNCTION send_sp_expiration_warnings() IS 'Daily cron job to create warning records for SP batches expiring soon (30, 14, 7, 1 days). Edge Function will send notifications for unsent warnings.';

-- =============================================================================
-- 4. RPC: Get User Expiration Warnings
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_expiration_warnings(p_user_id UUID)
RETURNS TABLE (
  warning_id UUID,
  sp_amount INTEGER,
  expires_at TIMESTAMPTZ,
  days_until_expiry INTEGER,
  warning_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.sp_amount,
    w.expires_at,
    EXTRACT(DAY FROM (w.expires_at - NOW()))::INTEGER,
    w.warning_type
  FROM sp_expiration_warnings w
  JOIN sp_batches b ON b.id = w.batch_id
  WHERE w.user_id = p_user_id
    AND b.is_expired = FALSE
    AND b.remaining_sp > 0
  ORDER BY w.expires_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_expiration_warnings(UUID) IS 'Get all active expiration warnings for a user, sorted by expiration date.';

-- =============================================================================
-- 5. VERIFICATION QUERIES
-- =============================================================================

-- Query 1: Manually trigger expiration processing
-- SELECT process_sp_expiration();

-- Query 2: Manually trigger warning creation
-- SELECT send_sp_expiration_warnings();

-- Query 3: View warnings for a user
-- SELECT * FROM get_user_expiration_warnings('YOUR_USER_ID'::UUID);

-- Query 4: Check expired batches
-- SELECT 
--   COUNT(*) as expired_count,
--   SUM(remaining_sp) as total_expired_sp
-- FROM sp_batches
-- WHERE is_expired = TRUE;

-- Query 5: Check upcoming expirations
-- SELECT 
--   user_id,
--   COUNT(*) as batch_count,
--   SUM(remaining_sp) as total_sp
-- FROM sp_batches
-- WHERE is_expired = FALSE
--   AND expires_at <= NOW() + INTERVAL '30 days'
-- GROUP BY user_id
-- ORDER BY total_sp DESC;
