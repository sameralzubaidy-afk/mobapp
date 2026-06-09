-- ============================================================================
-- QUICK REFERENCE: SP Fix Commands (Copy & Paste)
-- ============================================================================
-- For detailed instructions, see: APPLY-SP-FIX-STEP-BY-STEP.md
-- ⚠️ Run each section in order, review output before proceeding
-- ============================================================================

-- ============================================================================
-- DIAGNOSTIC: Find User and Calculate Differences
-- ============================================================================

-- 1. Find user with 13 SP pending
SELECT u.id, u.email, w.pending_balance
FROM auth.users u JOIN sp_wallets w ON w.user_id = u.id
WHERE w.pending_balance = 13;
-- 👉 Copy user_id: ___________________


-- 2. Calculate what needs to be fixed (⚠️ replace <user-id>)
SELECT 
  t.id, t.sp_earned_at_completion AS current,
  FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10)) AS correct,
  FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10)) - t.sp_earned_at_completion AS diff
FROM trades t
JOIN items i ON i.id = t.listing_id
WHERE t.seller_id = '<user-id>'
  AND t.status = 'completed' AND t.sp_earned_at_completion > 0
  AND t.pending_sp_release_at IS NOT NULL;
-- 👉 Total difference should be: -2 (meaning current is 2 SP too high)


-- ============================================================================
-- FIX: Run in Transaction (⚠️ REVIEW BEFORE COMMIT)
-- ============================================================================

BEGIN;

-- Create temp table with fixes
CREATE TEMP TABLE trades_to_fix AS
SELECT 
  t.id AS trade_id, t.seller_id, t.sp_amount AS buyer_sp,
  t.sp_earned_at_completion AS current_sp,
  FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10)) AS correct_sp,
  FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10)) - t.sp_earned_at_completion AS diff,
  i.price, COALESCE(t.sp_category_multiplier, 1.10) AS multiplier
FROM trades t JOIN items i ON i.id = t.listing_id
WHERE t.status = 'completed' AND t.sp_earned_at_completion > 0
  AND t.pending_sp_release_at IS NOT NULL AND t.sp_released_at IS NULL
  AND t.sp_earned_at_completion != FLOOR(t.sp_amount * COALESCE(t.sp_category_multiplier, 1.10));

SELECT * FROM trades_to_fix; -- ✅ CHECKPOINT 1

-- Update wallets
UPDATE sp_wallets w
SET pending_balance = w.pending_balance + COALESCE((
    SELECT SUM(diff) FROM trades_to_fix WHERE seller_id = w.user_id
  ), 0),
  lifetime_earned = w.lifetime_earned + COALESCE((
    SELECT SUM(diff) FROM trades_to_fix WHERE seller_id = w.user_id
  ), 0)
WHERE w.user_id IN (SELECT DISTINCT seller_id FROM trades_to_fix);

SELECT u.email, w.pending_balance FROM sp_wallets w 
JOIN auth.users u ON u.id = w.user_id
WHERE w.user_id IN (SELECT seller_id FROM trades_to_fix); -- ✅ CHECKPOINT 2

-- Update trades
UPDATE trades t SET sp_earned_at_completion = ttf.correct_sp
FROM trades_to_fix ttf WHERE t.id = ttf.trade_id;

SELECT t.id, t.sp_earned_at_completion FROM trades t
JOIN trades_to_fix ttf ON t.id = ttf.trade_id; -- ✅ CHECKPOINT 3

-- Update ledger
UPDATE sp_ledger l
SET amount = ttf.correct_sp,
    balance_after = l.balance_before + ttf.correct_sp,
    description = format('Trade reward: %s SP (buyer %s SP × %.2f) [RECALCULATED]',
                        ttf.correct_sp, ttf.buyer_sp, ttf.multiplier)
FROM trades_to_fix ttf
WHERE l.related_transaction_id = ttf.trade_id
  AND l.transaction_type = 'earn_reward';

SELECT amount, description FROM sp_ledger
WHERE related_transaction_id IN (SELECT trade_id FROM trades_to_fix); -- ✅ CHECKPOINT 4

-- ⚠️ REVIEW ALL CHECKPOINTS ABOVE
-- ✅ If correct: COMMIT;
-- ❌ If wrong:   ROLLBACK;


-- ============================================================================
-- VERIFY: Check Final State (⚠️ replace <user-id>)
-- ============================================================================

-- Should show 11 SP pending (not 13)
SELECT u.email, w.pending_balance, w.lifetime_earned
FROM sp_wallets w JOIN auth.users u ON u.id = w.user_id
WHERE w.user_id = '<user-id>';

-- Should show 11 SP earned (not 13-14)
SELECT t.id, t.sp_earned_at_completion, i.title
FROM trades t JOIN items i ON i.id = t.listing_id
WHERE t.seller_id = '<user-id>' AND t.status = 'completed'
ORDER BY t.completed_at DESC;

-- Should show [RECALCULATED] tag
SELECT amount, description FROM sp_ledger
WHERE user_id = '<user-id>' AND transaction_type = 'earn_reward'
ORDER BY created_at DESC LIMIT 3;
