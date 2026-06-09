-- Fix Pending SP Amounts from Wrong Formula
-- This script recalculates SP for trades that used the incorrect formula
-- (price × 0.25 × multiplier instead of buyer_sp × multiplier)

-- ====================================================================
-- SAFETY: Run in transaction with manual COMMIT
-- ====================================================================
BEGIN;

-- ====================================================================
-- STEP 1: Identify trades with incorrect SP amounts
-- ====================================================================

-- Create temp table to store trades that need recalculation
CREATE TEMP TABLE trades_to_fix AS
SELECT 
  t.id AS trade_id,
  t.seller_id,
  t.sp_amount AS buyer_sp,
  t.sp_earned_at_completion AS current_sp_earned,
  i.price AS item_price,
  COALESCE(c.sp_earning_multiplier, 1.10) AS multiplier,
  -- Calculate CORRECT SP amount
  CASE 
    WHEN t.sp_amount > 0 THEN 
      FLOOR(t.sp_amount * COALESCE(c.sp_earning_multiplier, 1.10))
    ELSE 
      FLOOR((i.price::numeric) * COALESCE(c.sp_earning_multiplier, 1.10))
  END AS correct_sp_earned,
  -- Calculate difference
  CASE 
    WHEN t.sp_amount > 0 THEN 
      FLOOR(t.sp_amount * COALESCE(c.sp_earning_multiplier, 1.10))
    ELSE 
      FLOOR((i.price::numeric) * COALESCE(c.sp_earning_multiplier, 1.10))
  END - t.sp_earned_at_completion AS sp_difference
FROM trades t
JOIN items i ON i.id = t.listing_id
LEFT JOIN categories c ON c.id = i.category_id
WHERE t.status = 'completed'
  AND t.sp_earned_at_completion > 0
  AND t.pending_sp_release_at IS NOT NULL
  AND t.sp_released_at IS NULL  -- Still pending
  -- Filter for trades with wrong SP amount
  AND t.sp_earned_at_completion != (
    CASE 
      WHEN t.sp_amount > 0 THEN 
        FLOOR(t.sp_amount * COALESCE(c.sp_earning_multiplier, 1.10))
      ELSE 
        FLOOR((i.price::numeric) * COALESCE(c.sp_earning_multiplier, 1.10))
    END
  );

-- Show trades that will be fixed
SELECT * FROM trades_to_fix;

-- ====================================================================
-- STEP 2: Update sp_wallets.pending_balance
-- ====================================================================

-- For each affected seller, adjust their pending_balance
UPDATE sp_wallets w
SET 
  pending_balance = w.pending_balance + COALESCE(
    (SELECT SUM(sp_difference) 
     FROM trades_to_fix 
     WHERE seller_id = w.user_id
     GROUP BY seller_id),
    0
  ),
  lifetime_earned = w.lifetime_earned + COALESCE(
    (SELECT SUM(sp_difference) 
     FROM trades_to_fix 
     WHERE seller_id = w.user_id
     GROUP BY seller_id),
    0
  ),
  updated_at = now()
WHERE w.user_id IN (SELECT DISTINCT seller_id FROM trades_to_fix);

-- ====================================================================
-- STEP 3: Update trades.sp_earned_at_completion
-- ====================================================================

UPDATE trades t
SET 
  sp_earned_at_completion = ttf.correct_sp_earned,
  updated_at = now()
FROM trades_to_fix ttf
WHERE t.id = ttf.trade_id;

-- ====================================================================
-- STEP 4: Update sp_ledger entries
-- ====================================================================

UPDATE sp_ledger l
SET 
  amount = ttf.correct_sp_earned,
  balance_after = l.balance_before + ttf.correct_sp_earned,
  description = CASE 
    WHEN ttf.buyer_sp > 0 THEN 
      format('Trade reward: %s SP (buyer %s SP × %.2f multiplier) [RECALCULATED]', 
             ttf.correct_sp_earned, ttf.buyer_sp, ttf.multiplier)
    ELSE
      format('Trade reward: %s SP (price $%.2f × %.2f multiplier) [RECALCULATED]', 
             ttf.correct_sp_earned, ttf.item_price, ttf.multiplier)
  END,
  updated_at = now()
FROM trades_to_fix ttf
WHERE l.related_transaction_id = ttf.trade_id
  AND l.transaction_type = 'earn_reward'
  AND l.user_id = ttf.seller_id;

-- ====================================================================
-- STEP 5: Verify changes
-- ====================================================================

-- Show updated wallets
SELECT 
  u.email,
  w.pending_balance,
  w.lifetime_earned,
  w.updated_at
FROM sp_wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE w.user_id IN (SELECT DISTINCT seller_id FROM trades_to_fix);

-- Show updated trades
SELECT 
  t.id,
  t.sp_earned_at_completion AS new_sp_earned,
  ttf.current_sp_earned AS old_sp_earned,
  ttf.sp_difference
FROM trades t
JOIN trades_to_fix ttf ON ttf.trade_id = t.id;

-- Show updated ledger entries
SELECT 
  l.user_id,
  l.amount,
  l.description,
  l.updated_at
FROM sp_ledger l
WHERE l.related_transaction_id IN (SELECT trade_id FROM trades_to_fix)
  AND l.transaction_type = 'earn_reward';

-- ====================================================================
-- MANUAL REVIEW REQUIRED:
-- Review the output above. If everything looks correct, run:
--   COMMIT;
-- If something looks wrong, run:
--   ROLLBACK;
-- ====================================================================

-- ⚠️ DO NOT AUTO-COMMIT - MANUAL REVIEW REQUIRED
