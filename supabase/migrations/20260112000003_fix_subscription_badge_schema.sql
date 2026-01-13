-- Migration: Fix subscription badge schema
-- Adds canceled_at column to subscriptions table if it doesn't exist
-- This fixes the "column s.canceled_at does not exist" error in retroactive badge awarding
-- Date: 2026-01-12

-- =============================================================================
-- 1. Add canceled_at column to subscriptions table (if it doesn't exist)
-- =============================================================================

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;

-- =============================================================================
-- 2. Update retroactive_award_badges function to handle subscription badges correctly
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
    -- Uses either canceled_at (if subscription was canceled) or NOW() (if active)
    FOR v_user_id IN
      SELECT t.user_id
      FROM (
        SELECT 
          s.user_id,
          EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 as days_subscribed
        FROM subscriptions s
        WHERE s.status IN ('active', 'trial', 'canceled', 'grace', 'expired')
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
-- 3. Update preview_retroactive_awards function to use correct table name
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
      COALESCE(p.name, 'Unknown User') as o_display_name,
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
      COALESCE(p.name, 'Unknown User') as o_display_name,
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
      COALESCE(p.name, 'Unknown User') as o_display_name,
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

  ELSIF v_badge.category = 'subscription' THEN
    RETURN QUERY
    SELECT 
      t.user_id as o_user_id,
      COALESCE(p.name, 'Unknown User') as o_display_name,
      t.days_subscribed::INT as o_current_value,
      EXISTS(SELECT 1 FROM user_badges ub WHERE ub.user_id = t.user_id AND ub.badge_id = p_badge_id) as o_already_has_badge
    FROM (
      SELECT 
        s.user_id,
        EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 as days_subscribed
      FROM subscriptions s
      WHERE s.status IN ('active', 'trial', 'canceled', 'grace', 'expired')
    ) t
    LEFT JOIN profiles p ON p.user_id = t.user_id
    WHERE t.days_subscribed >= v_badge.threshold
    ORDER BY t.days_subscribed DESC;
    
  ELSE
    RAISE NOTICE 'Preview not supported for category: %', v_badge.category;
  END IF;
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Verify canceled_at column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subscriptions' AND column_name = 'canceled_at';

-- 2. Verify retroactive_award_badges function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'retroactive_award_badges';

-- 3. Verify preview_retroactive_awards function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'preview_retroactive_awards';
