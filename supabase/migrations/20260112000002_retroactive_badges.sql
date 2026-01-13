-- filepath: supabase/migrations/20260112000002_retroactive_badges.sql
-- TASK: BADGES-V2-008 - Retroactive Awarding & Dynamic Triggers

-- =============================================================================
-- 1. Update award_badge_if_eligible to check is_active flag
-- =============================================================================

-- Note: This function was already updated in 20260110000001_badge_triggers.sql
-- to check b.is_active = TRUE. Verification query below confirms this.

-- =============================================================================
-- 2. Create retroactive_award_badges function
-- =============================================================================

CREATE OR REPLACE FUNCTION retroactive_award_badges(p_badge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge RECORD;
  v_awarded_count INT := 0;
  v_user_id UUID;
BEGIN
  -- Fetch badge details
  SELECT * INTO v_badge 
  FROM badges 
  WHERE id = p_badge_id AND is_active = TRUE AND is_archived = FALSE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found or inactive: %', p_badge_id;
  END IF;

  -- Log the retroactive award process start
  RAISE NOTICE 'Starting retroactive awarding for badge: % (category: %, threshold: %)', 
    v_badge.name, v_badge.category, v_badge.threshold;

  -- Process based on badge category
  IF v_badge.category = 'sp_earning' THEN
    -- Award to users who have earned >= threshold SP
    FOR v_user_id IN
      SELECT t.user_id
      FROM (
        SELECT sl.user_id, SUM(sl.amount) as total_earned
        FROM sp_ledger sl
        WHERE sl.amount > 0
        GROUP BY sl.user_id
      ) t
      WHERE t.total_earned >= v_badge.threshold
    LOOP
      -- Insert badge if not already awarded
      INSERT INTO user_badges (user_id, badge_id, awarded_at)
      VALUES (v_user_id, v_badge.id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Check if row was inserted (not a duplicate)
      IF FOUND THEN
        v_awarded_count := v_awarded_count + 1;
      END IF;
    END LOOP;
    
  ELSIF v_badge.category = 'sp_spending' THEN
    -- Award to users who have spent >= threshold SP (absolute value of negative entries)
    FOR v_user_id IN
      SELECT t.user_id
      FROM (
        SELECT sl.user_id, SUM(ABS(sl.amount)) as total_spent
        FROM sp_ledger sl
        WHERE sl.amount < 0
        GROUP BY sl.user_id
      ) t
      WHERE t.total_spent >= v_badge.threshold
    LOOP
      INSERT INTO user_badges (user_id, badge_id, awarded_at)
      VALUES (v_user_id, v_badge.id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      IF FOUND THEN
        v_awarded_count := v_awarded_count + 1;
      END IF;
    END LOOP;
    
  ELSIF v_badge.category = 'trades' THEN
    -- Award to users who have completed >= threshold trades (as buyer OR seller)
    FOR v_user_id IN
      SELECT combined.user_id
      FROM (
        SELECT trx_b.buyer_id as user_id, COUNT(*) as trade_count
        FROM trades trx_b
        WHERE trx_b.status = 'completed'
        GROUP BY trx_b.buyer_id
        
        UNION ALL
        
        SELECT trx_s.seller_id as user_id, COUNT(*) as trade_count
        FROM trades trx_s
        WHERE trx_s.status = 'completed'
        GROUP BY trx_s.seller_id
      ) combined
      GROUP BY combined.user_id
      HAVING SUM(combined.trade_count) >= v_badge.threshold
    LOOP
      INSERT INTO user_badges (user_id, badge_id, awarded_at)
      VALUES (v_user_id, v_badge.id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      IF FOUND THEN
        v_awarded_count := v_awarded_count + 1;
      END IF;
    END LOOP;
    
  ELSIF v_badge.category = 'subscription' THEN
    -- Award to users with subscription tenure >= threshold days
    FOR v_user_id IN
      SELECT t.user_id
      FROM (
        SELECT 
          s.user_id,
          EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 as days_subscribed
        FROM subscriptions s
        WHERE s.status IN ('active', 'trial', 'canceled')
      ) t
      WHERE t.days_subscribed >= v_badge.threshold
    LOOP
      INSERT INTO user_badges (user_id, badge_id, awarded_at)
      VALUES (v_user_id, v_badge.id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      IF FOUND THEN
        v_awarded_count := v_awarded_count + 1;
      END IF;
    END LOOP;
    
  ELSE
    RAISE NOTICE 'Unsupported badge category for retroactive awarding: %', v_badge.category;
  END IF;

  -- Log completion
  RAISE NOTICE 'Retroactive awarding complete. Awarded to % new users', v_awarded_count;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'badge_id', v_badge.id,
    'badge_name', v_badge.name,
    'category', v_badge.category,
    'threshold', v_badge.threshold,
    'awarded_count', v_awarded_count
  );
END;
$$;

-- =============================================================================
-- 3. Create trigger to auto-run retroactive awards when threshold decreases
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_retroactive_award_on_threshold_decrease()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only run if threshold was decreased and badge is still active
  IF OLD.threshold IS NOT NULL 
     AND NEW.threshold < OLD.threshold 
     AND NEW.is_active = TRUE 
     AND NEW.is_archived = FALSE 
  THEN
    RAISE NOTICE 'Threshold decreased from % to % for badge %. Running retroactive awarding...', 
      OLD.threshold, NEW.threshold, NEW.name;
    
    -- Run retroactive awarding asynchronously to avoid blocking the update
    -- Note: In production, consider using pg_cron or Edge Function for async execution
    PERFORM retroactive_award_badges(NEW.id);
    
    -- Log audit entry
    INSERT INTO badge_audit_logs (
      badge_id,
      user_id,
      admin_id,
      action_type,
      reason,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      auth.uid(), -- Will be null for system actions
      auth.uid(),
      'bulk_award',
      'Automatic retroactive award due to threshold decrease',
      jsonb_build_object(
        'old_threshold', OLD.threshold,
        'new_threshold', NEW.threshold,
        'triggered_by', 'threshold_decrease'
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_retroactive_award_on_threshold_decrease ON badges;
CREATE TRIGGER trigger_retroactive_award_on_threshold_decrease
AFTER UPDATE ON badges
FOR EACH ROW
EXECUTE FUNCTION trigger_retroactive_award_on_threshold_decrease();

-- =============================================================================
-- 4. Create RPC for manual retroactive awarding (admin trigger)
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_trigger_retroactive_awards(
  p_badge_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_result JSONB;
BEGIN
  -- Get admin user ID
  v_admin_id := auth.uid();
  
  -- Verify admin privileges
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Run retroactive awarding
  v_result := retroactive_award_badges(p_badge_id);

  -- Log audit entry
  INSERT INTO badge_audit_logs (
    badge_id,
    user_id,
    admin_id,
    action_type,
    reason,
    metadata,
    created_at
  ) VALUES (
    p_badge_id,
    v_admin_id, -- Admin is also the "user" for this action type
    v_admin_id,
    'bulk_award',
    COALESCE(p_reason, 'Manual retroactive award triggered by admin'),
    v_result,
    NOW()
  );

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 5. Create helper function to preview retroactive awards (dry-run)
-- =============================================================================

DROP FUNCTION IF EXISTS preview_retroactive_awards(UUID);
CREATE OR REPLACE FUNCTION preview_retroactive_awards(p_badge_id UUID)
RETURNS TABLE (
  o_user_id UUID,
  o_display_name TEXT,
  o_current_value INT,
  o_already_has_badge BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge RECORD;
BEGIN
  -- Fetch badge details
  SELECT * INTO v_badge 
  FROM badges 
  WHERE id = p_badge_id AND is_active = TRUE AND is_archived = FALSE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found or inactive: %', p_badge_id;
  END IF;

  -- Preview based on badge category
  IF v_badge.category = 'sp_earning' THEN
    RETURN QUERY
    SELECT 
      t.user_id as o_user_id,
      p.name as o_display_name,
      t.total_earned::INT as o_current_value,
      EXISTS(SELECT 1 FROM user_badges ub WHERE ub.user_id = t.user_id AND ub.badge_id = p_badge_id) as o_already_has_badge
    FROM (
      SELECT sl.user_id, SUM(sl.amount) as total_earned
      FROM sp_ledger sl
      WHERE sl.amount > 0
      GROUP BY sl.user_id
    ) t
    LEFT JOIN profiles p ON p.user_id = t.user_id
    WHERE t.total_earned >= v_badge.threshold
    ORDER BY t.total_earned DESC;
    
  ELSIF v_badge.category = 'sp_spending' THEN
    RETURN QUERY
    SELECT 
      t.user_id as o_user_id,
      p.name as o_display_name,
      t.total_spent::INT as o_current_value,
      EXISTS(SELECT 1 FROM user_badges ub WHERE ub.user_id = t.user_id AND ub.badge_id = p_badge_id) as o_already_has_badge
    FROM (
      SELECT sl.user_id, SUM(ABS(sl.amount)) as total_spent
      FROM sp_ledger sl
      WHERE sl.amount < 0
      GROUP BY sl.user_id
    ) t
    LEFT JOIN profiles p ON p.user_id = t.user_id
    WHERE t.total_spent >= v_badge.threshold
    ORDER BY t.total_spent DESC;
    
  ELSIF v_badge.category = 'trades' THEN
    RETURN QUERY
    SELECT 
      combined.user_id as o_user_id,
      p.name as o_display_name,
      SUM(combined.trade_count)::INT as o_current_value,
      EXISTS(SELECT 1 FROM user_badges ub WHERE ub.user_id = combined.user_id AND ub.badge_id = p_badge_id) as o_already_has_badge
    FROM (
      SELECT trx_b.buyer_id as user_id, COUNT(*) as trade_count
      FROM trades trx_b
      WHERE trx_b.status = 'completed'
      GROUP BY trx_b.buyer_id
      
      UNION ALL
      
      SELECT trx_s.seller_id as user_id, COUNT(*) as trade_count
      FROM trades trx_s
      WHERE trx_s.status = 'completed'
      GROUP BY trx_s.seller_id
    ) combined
    LEFT JOIN profiles p ON p.user_id = combined.user_id
    GROUP BY combined.user_id, p.name
    HAVING SUM(combined.trade_count) >= v_badge.threshold
    ORDER BY SUM(combined.trade_count) DESC;
    
  ELSE
    RAISE NOTICE 'Preview not supported for category: %', v_badge.category;
  END IF;
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Verify award_badge_if_eligible checks is_active
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'award_badge_if_eligible'
  AND routine_definition LIKE '%is_active%';

-- 2. Verify retroactive_award_badges function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'retroactive_award_badges';

-- 3. Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_retroactive_award_on_threshold_decrease';

-- 4. Verify RPCs exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'admin_trigger_retroactive_awards',
  'preview_retroactive_awards'
)
ORDER BY routine_name;

-- =============================================================================
-- EXAMPLE USAGE
-- =============================================================================

-- Example 1: Preview retroactive awards for a badge
-- SELECT * FROM preview_retroactive_awards('badge-id-here');

-- Example 2: Manually trigger retroactive awarding (admin)
-- SELECT * FROM admin_trigger_retroactive_awards('badge-id-here', 'Lowered threshold from 100 to 50');

-- Example 3: Test automatic trigger by lowering threshold
-- UPDATE badges SET threshold = 5 WHERE name = 'SP Earner - Bronze';
-- (This will automatically trigger retroactive awarding if threshold decreased)
