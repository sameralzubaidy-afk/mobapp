-- Verification Query for Migration 20260606000001 D-17 Fix
-- Tests that ALL SP (buyer + platform) goes to pending_balance in ONE event
--
-- Expected Behavior After Fix:
-- 1. fn_release_all_sp_on_complete() creates ONE sp_ledger entry (not two)
-- 2. ALL SP goes to pending_balance (nothing to available_balance)
-- 3. trades.sp_earned_at_completion = buyer_sp + platform_sp (total)
-- 4. ONE notification sent (not two separate notifications)
--
-- How to Test:
-- 1. Complete a trade that has both buyer SP and seller accepts SP
-- 2. Query sp_ledger for seller - should see ONE 'earn_reward' entry
-- 3. Query sp_wallets for seller - pending_balance should have total SP
-- 4. Query user_notifications - should see ONE 'sp_pending_release' notification

-- ======================================================================
-- Test Query 1: Check sp_ledger entries for a completed trade
-- ======================================================================
-- Replace <TRADE_ID> with actual trade ID
/*
SELECT 
  sl.transaction_type,
  sl.amount,
  sl.description,
  sl.created_at
FROM sp_ledger sl
WHERE sl.related_transaction_id = '<TRADE_ID>'
  AND sl.user_id IN (
    SELECT seller_id FROM trades WHERE id = '<TRADE_ID>'
  )
ORDER BY sl.created_at;

Expected Result (D-17 FIXED):
- ONE entry with transaction_type = 'earn_reward'
- Amount = buyer_sp + platform_sp (total)
- Description mentions both buyer SP and platform bonus

Expected Result (D-17 VIOLATED - old behavior):
- TWO entries: 'earn_bonus' (immediate) + 'earn_reward' (pending)
- Amounts split between platform and buyer
*/

-- ======================================================================
-- Test Query 2: Check wallet balances after completion
-- ======================================================================
-- Replace <SELLER_ID> with actual seller user ID
/*
SELECT 
  w.available_balance,
  w.pending_balance,
  w.lifetime_earned
FROM sp_wallets w
WHERE w.user_id = '<SELLER_ID>';

Expected Result (D-17 FIXED):
- pending_balance = buyer_sp + platform_sp (all in pending)
- available_balance = unchanged from before trade completion

Expected Result (D-17 VIOLATED - old behavior):
- pending_balance = buyer_sp only
- available_balance = increased by platform_sp (immediate)
*/

-- ======================================================================
-- Test Query 3: Check trade record
-- ======================================================================
-- Replace <TRADE_ID> with actual trade ID
/*
SELECT 
  t.sp_amount as buyer_sp_used,
  t.sp_earned_at_completion as total_sp_earned,
  t.pending_sp_release_at,
  t.status
FROM trades t
WHERE t.id = '<TRADE_ID>';

Expected Result (D-17 FIXED):
- sp_earned_at_completion = buyer_sp + platform_sp (total)
- pending_sp_release_at = now + 3 days

Expected Result (D-17 VIOLATED - old behavior):
- sp_earned_at_completion = buyer_sp only (platform bonus not tracked)
*/

-- ======================================================================
-- Test Query 4: Check notifications sent
-- ======================================================================
-- Replace <SELLER_ID> with actual seller user ID
/*
SELECT 
  un.type,
  un.title,
  un.body,
  un.data,
  un.created_at
FROM user_notifications un
WHERE un.user_id = '<SELLER_ID>'
  AND un.category = 'sp_events'
  AND un.data->>'trade_id' = '<TRADE_ID>'
ORDER BY un.created_at;

Expected Result (D-17 FIXED):
- ONE notification with type = 'sp_pending_release'
- Body mentions total SP with breakdown: "X SP (Y from buyer + Z platform bonus)"
- data contains: sp_total, sp_buyer, sp_platform, pending_release_at

Expected Result (D-17 VIOLATED - old behavior):
- TWO notifications: 'sp_pending_release' + 'sp_earned'
- Separate messages for buyer SP and platform bonus
*/
