-- Migration: Free Subscription Creation & Fix Registration Flow
-- Purpose: Allow creating free subscriptions + fix registration so users get correct tier based on their choice
-- Date: 2025-01-20

-- ============================================================================
-- BLOCK 1: Create Free Subscription RPC Function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_free_subscription(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Create free subscription (no trial)
  INSERT INTO subscriptions (
    user_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    'free',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'id', v_subscription_id,
    'user_id', p_user_id,
    'status', 'free',
    'created_at', NOW(),
    'updated_at', NOW()
  );
END;
$$;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION create_free_subscription(UUID) TO authenticated, anon;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to confirm changes)
-- ============================================================================

-- Query 1: Verify create_free_subscription function exists
SELECT 
  p.proname as function_name,
  d.description,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
LEFT JOIN pg_description d ON p.oid = d.objoid
WHERE p.proname = 'create_free_subscription'
LIMIT 1;

-- Query 2: Verify function signature
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'create_free_subscription'
  AND routine_schema = 'public';
