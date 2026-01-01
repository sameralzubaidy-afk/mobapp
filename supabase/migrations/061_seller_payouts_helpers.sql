-- PAY-004 & PAY-005: Additional helper functions
-- File: supabase/migrations/061_seller_payouts_helpers.sql

-- RPC function to atomically set primary payout method
CREATE OR REPLACE FUNCTION set_primary_payout_method(
  p_user_id UUID,
  p_method_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify method belongs to user and is verified
  IF NOT EXISTS (
    SELECT 1 FROM seller_payout_methods
    WHERE id = p_method_id
    AND user_id = p_user_id
    AND is_verified = TRUE
  ) THEN
    RAISE EXCEPTION 'Payout method not found or not verified';
  END IF;

  -- Clear any existing primary for this user
  UPDATE seller_payout_methods
  SET is_primary = FALSE,
      updated_at = NOW()
  WHERE user_id = p_user_id
  AND is_primary = TRUE
  AND id != p_method_id;

  -- Set new primary
  UPDATE seller_payout_methods
  SET is_primary = TRUE,
      updated_at = NOW()
  WHERE id = p_method_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_primary_payout_method TO authenticated;

-- Verification queries
SELECT 'RPC function set_primary_payout_method created successfully' AS status;
