# REF-V2-002: Manual Testing Guide
# SP Bonus Rewards on First Trade

**Module**: MODULE-11-REFERRALS-V2  
**Task**: REF-V2-002  
**Status**: Implementation Complete

---

## Prerequisites

Before running these tests, ensure:

1. ✅ **Database migrations applied**:
   - Migration 094 (award_referral_sp RPC)
   - Migration 20260201000000 (referral rewards trigger)
   - Migration 20260129000000 (referral codes v2)

2. ✅ **Admin configuration**:
   ```sql
   SELECT config_key, config_value FROM sp_config 
   WHERE config_key IN ('referral_reward_referrer_sp', 'referral_reward_referee_sp');
   ```
   Expected: `referral_reward_referrer_sp=25`, `referral_reward_referee_sp=10`

3. ✅ **Test users setup**:
   - 2 users with trial/active subscriptions
   - Referral relationship exists (status='pending')
   - Referee has NOT completed any trades yet

---

## Run This SQL in Supabase BEFORE Testing

```sql
-- STEP 1: Verify SP config values
SELECT config_key, config_value FROM sp_config 
WHERE config_key IN ('referral_reward_referrer_sp', 'referral_reward_referee_sp');

-- Expected output:
-- referral_reward_referrer_sp | 25
-- referral_reward_referee_sp  | 10

-- If values are wrong, update them:
-- UPDATE sp_config SET config_value = '25' WHERE config_key = 'referral_reward_referrer_sp';
-- UPDATE sp_config SET config_value = '10' WHERE config_key = 'referral_reward_referee_sp';

-- STEP 2: Verify trigger exists and is enabled
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgname = 'trigger_process_referral_bonus_on_trade';

-- Expected: trigger_process_referral_bonus_on_trade | O (enabled)

-- STEP 3: Check for pending referrals
SELECT 
  id,
  referrer_user_id,
  referred_user_id,
  referral_code,
  status,
  created_at
FROM referrals 
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- Note the IDs for testing
```

---

## Test Case 1: Successful Referral Reward

### Objective
Verify that when a referee completes their first trade, both referrer and referee receive SP rewards.

### Steps

1. **Setup: Identify Test Users**
   ```sql
   -- Get a pending referral
   SELECT 
     r.id AS referral_id,
     r.referrer_user_id,
     r.referred_user_id,
       ref_profile.name AS referrer_name,
       ree_profile.name AS referee_name,
     r.status
   FROM referrals r
   JOIN profiles ref_profile ON ref_profile.user_id = r.referrer_user_id
   JOIN profiles ree_profile ON ree_profile.user_id = r.referred_user_id
   WHERE r.status = 'pending'
   LIMIT 1;
   ```
   
   **Record these IDs:**
   - Referral ID: `___________________`
   - Referrer User ID: `___________________`
   - Referee User ID: `___________________`

2. **Verify Initial State**
   ```sql
   -- Check both users have subscriptions
   SELECT user_id, status, trial_end_date, current_period_end
   FROM subscriptions
   WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>')
   ORDER BY created_at DESC;
   ```
   
   ✅ **Expected**: Both users show status IN ('active', 'trial', 'trialing', 'grace')
   
   ```sql
   -- Check referee has no completed trades
   SELECT COUNT(*) AS completed_trades
   FROM trades
   WHERE (buyer_id = '<REFEREE_ID>' OR seller_id = '<REFEREE_ID>')
     AND status = 'completed';
   ```
   
   ✅ **Expected**: `completed_trades = 0`

3. **Record Initial SP Balances**
   ```sql
   -- Referrer initial balance
   SELECT user_id, available_balance, lifetime_earned
   FROM sp_wallets
   WHERE user_id = '<REFERRER_ID>';
   ```
   **Referrer Initial Balance**: `___________________`
   
   ```sql
   -- Referee initial balance
   SELECT user_id, available_balance, lifetime_earned
   FROM sp_wallets
   WHERE user_id = '<REFEREE_ID>';
   ```
   **Referee Initial Balance**: `___________________`

4. **Create a Trade for Referee**
   
   In the mobile app:
   - Log in as the referee user
   - Browse listings
   - Initiate a trade (as buyer or seller)
   - Complete payment flow (test mode)
   - **CRITICAL**: Mark the trade as 'completed'

5. **Verify Trade Status**
   ```sql
   SELECT id, buyer_id, seller_id, status, total_price_cents, created_at
   FROM trades
   WHERE (buyer_id = '<REFEREE_ID>' OR seller_id = '<REFEREE_ID>')
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   ✅ **Expected**: status = 'completed'
   
   **Record Trade ID**: `___________________`

6. **Verify Referral Status Updated**
   ```sql
   SELECT 
     id,
     status,
     bonus_points_referrer,
     bonus_points,
     bonus_claimed_referrer_at,
     bonus_claimed_at
   FROM referrals
   WHERE id = '<REFERRAL_ID>';
   ```
   
   ✅ **Expected**:
   - status = 'completed'
   - bonus_points_referrer = 25
   - bonus_points = 10
   - bonus_claimed_referrer_at IS NOT NULL
   - bonus_claimed_at IS NOT NULL

7. **Verify SP Ledger Entries**
   ```sql
   -- Referrer SP ledger
   SELECT 
     user_id,
     transaction_type,
     amount,
     description,
     balance_before,
     balance_after,
     created_at
   FROM sp_ledger
   WHERE user_id = '<REFERRER_ID>'
     AND transaction_type = 'earn_referral'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   ✅ **Expected**:
   - amount = 25
   - description LIKE '%Referral Reward%'
   - balance_after = balance_before + 25
   
   ```sql
   -- Referee SP ledger
   SELECT 
     user_id,
     transaction_type,
     amount,
     description,
     balance_before,
     balance_after,
     created_at
   FROM sp_ledger
   WHERE user_id = '<REFEREE_ID>'
     AND transaction_type = 'earn_referral'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   ✅ **Expected**:
   - amount = 10
   - description LIKE '%Welcome bonus%'
   - balance_after = balance_before + 10

8. **Verify SP Wallet Balances Updated**
   ```sql
   -- Referrer final balance
   SELECT user_id, available_balance, lifetime_earned
   FROM sp_wallets
   WHERE user_id = '<REFERRER_ID>';
   ```
   **Referrer Final Balance**: `___________________`
   
   ✅ **Expected**: available_balance = initial_balance + 25
   
   ```sql
   -- Referee final balance
   SELECT user_id, available_balance, lifetime_earned
   FROM sp_wallets
   WHERE user_id = '<REFEREE_ID>';
   ```
   **Referee Final Balance**: `___________________`
   
   ✅ **Expected**: available_balance = initial_balance + 10

9. **Verify SP Batches Created**
   ```sql
   -- Check SP batches for both users
   SELECT 
     user_id,
     initial_sp,
     remaining_sp,
     source_type,
     expires_at,
     created_at
   FROM sp_batches
   WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>')
     AND source_type = 'referral'
   ORDER BY created_at DESC
   LIMIT 2;
   ```
   
   ✅ **Expected**: 2 batches (one for referrer=25, one for referee=10)

---

## Test Case 2: Idempotency Check

### Objective
Verify that if the referee completes a second trade, NO additional referral rewards are granted.

### Steps

1. **Record Current Balances**
   ```sql
   SELECT user_id, available_balance FROM sp_wallets
   WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>');
   ```
   **Referrer Balance Before**: `___________________`
   **Referee Balance Before**: `___________________`

2. **Create and Complete Second Trade**
   
   In the mobile app:
   - Log in as referee
   - Complete another trade
   - Verify status = 'completed'

3. **Verify Balances Unchanged**
   ```sql
   SELECT user_id, available_balance FROM sp_wallets
   WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>');
   ```
   
   ✅ **Expected**: Balances are EXACTLY the same as before

4. **Verify No New Ledger Entries**
   ```sql
   SELECT COUNT(*) AS referral_entries
   FROM sp_ledger
   WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>')
     AND transaction_type = 'earn_referral';
   ```
   
   ✅ **Expected**: COUNT = 2 (still just the original 2 entries)

5. **Verify Referral Status Unchanged**
   ```sql
   SELECT status, bonus_points_referrer, bonus_points
   FROM referrals
   WHERE id = '<REFERRAL_ID>';
   ```
   
   ✅ **Expected**: 
   - status = 'completed' (no change)
   - bonus_points_referrer = 25 (no change)
   - bonus_points = 10 (no change)

---

## Test Case 3: Subscription Gating

### Objective
Verify that rewards are NOT granted if either user's subscription is expired/cancelled.

### Steps

1. **Setup: Create New Pending Referral with Non-Subscriber**
   
   This test requires:
   - User A (referrer) with active subscription
   - User B (referee) with expired subscription
   - Pending referral relationship
   
   ```sql
   -- Check for test users with expired subscriptions
   SELECT user_id, status FROM subscriptions
   WHERE status IN ('expired', 'cancelled')
   LIMIT 5;
   ```

2. **Create and Complete Trade for Non-Subscribed Referee**
   
   Follow Test Case 1 steps 4-5 but with a user who has expired subscription.

3. **Verify Referral Status Updated BUT Rewards NOT Granted**
   ```sql
   SELECT status, bonus_points_referrer, bonus_points
   FROM referrals
   WHERE referred_user_id = '<NON_SUBSCRIBED_REFEREE_ID>'
     AND status = 'completed';
   ```
   
   ✅ **Expected**: 
   - status = 'completed' (gets updated)
   - bonus_points_referrer = 25 (metadata set)
   - bonus_points = 10 (metadata set)
   
   **BUT** no actual SP awarded (next step):

4. **Verify No SP Ledger Entries Created**
   ```sql
   SELECT COUNT(*) FROM sp_ledger
   WHERE user_id = '<NON_SUBSCRIBED_REFEREE_ID>'
     AND transaction_type = 'earn_referral';
   ```
   
   ✅ **Expected**: COUNT = 0 (no SP awarded)

---

## Test Case 4: Admin Configuration Changes

### Objective
Verify that changing SP reward amounts in admin config affects new rewards.

### Steps

1. **Change SP Config Values**
   ```sql
   UPDATE sp_config 
   SET config_value = '50' 
   WHERE config_key = 'referral_reward_referrer_sp';
   
   UPDATE sp_config 
   SET config_value = '20' 
   WHERE config_key = 'referral_reward_referee_sp';
   ```

2. **Create New Pending Referral**
   - Sign up a new user with a referral code
   - Verify referral status = 'pending'

3. **Complete First Trade for New Referee**
   - Follow Test Case 1 steps 4-5

4. **Verify NEW Reward Amounts Used**
   ```sql
   SELECT amount FROM sp_ledger
   WHERE user_id = '<NEW_REFERRER_ID>'
     AND transaction_type = 'earn_referral'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   ✅ **Expected**: amount = 50 (new config value)
   
   ```sql
   SELECT amount FROM sp_ledger
   WHERE user_id = '<NEW_REFEREE_ID>'
     AND transaction_type = 'earn_referral'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   ✅ **Expected**: amount = 20 (new config value)

5. **Reset Config to Defaults**
   ```sql
   UPDATE sp_config 
   SET config_value = '25' 
   WHERE config_key = 'referral_reward_referrer_sp';
   
   UPDATE sp_config 
   SET config_value = '10' 
   WHERE config_key = 'referral_reward_referee_sp';
   ```

---

## Test Results Summary

| Test Case | Pass/Fail | Notes |
|-----------|-----------|-------|
| 1: Successful Referral Reward | ⬜ PASS / ⬜ FAIL | |
| 2: Idempotency Check | ⬜ PASS / ⬜ FAIL | |
| 3: Subscription Gating | ⬜ PASS / ⬜ FAIL | |
| 4: Admin Config Changes | ⬜ PASS / ⬜ FAIL | |

---

## Troubleshooting

### Issue: Rewards not granted after completing trade

**Possible causes**:
1. Trigger not enabled
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger 
   WHERE tgname = 'trigger_process_referral_bonus_on_trade';
   ```
   Fix: Rerun migration 20260201000000

2. Referral status not 'pending'
   ```sql
   SELECT status FROM referrals WHERE id = '<REFERRAL_ID>';
   ```
   Fix: Update referral status to 'pending' if needed

3. Not referee's first completed trade
   ```sql
   SELECT COUNT(*) FROM trades 
   WHERE (buyer_id = '<REFEREE_ID>' OR seller_id = '<REFEREE_ID>')
     AND status = 'completed';
   ```
   Fix: Use a different referee who hasn't completed trades

4. Subscription expired
   ```sql
   SELECT status FROM subscriptions 
   WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>');
   ```
   Fix: Reactivate subscriptions

### Issue: Duplicate rewards granted

**Check for duplicate ledger entries**:
```sql
SELECT user_id, COUNT(*) AS entry_count
FROM sp_ledger
WHERE transaction_type = 'earn_referral'
GROUP BY user_id
HAVING COUNT(*) > 1;
```

Fix: Idempotency is handled by referral status. If duplicates exist, check trigger logic.

---

## Verification Checklist (from MODULE-11-REFERRALS-VERIFICATION-V2.md § 2)

- [ ] **SP Reward Granting**
  - [ ] SP rewards triggered when referee completes first trade
  - [ ] Referrer receives exactly 25 SP
  - [ ] Referee receives exactly 10 SP
  - [ ] SP ledger entries created with reason 'earn_referral'
  - [ ] SP wallet balances updated correctly
  - [ ] SP wallet total_earned updated correctly
  - [ ] Referral status updated from 'pending' to 'completed'
  - [ ] reward_granted_at timestamp set
  - [ ] completed_at timestamp set

- [ ] **Subscription Gating**
  - [ ] Rewards ONLY granted if referrer has trial/active subscription
  - [ ] Rewards ONLY granted if referee has trial/active subscription
  - [ ] Rewards NOT granted if referrer subscription expired
  - [ ] Rewards NOT granted if referee subscription expired
  - [ ] Rewards NOT granted if referrer subscription cancelled
  - [ ] Rewards NOT granted if referee subscription cancelled

- [ ] **Idempotency**
  - [ ] Rewards only granted once per referral
  - [ ] Rewards NOT granted on referee's second trade
  - [ ] Rewards NOT granted on referee's third trade
  - [ ] Referral status change prevents duplicate rewards

- [ ] **Trigger Verification**
  - [ ] Trigger fires when trade status changes to 'completed'
  - [ ] Trigger checks if buyer is referee
  - [ ] Trigger checks if seller is referee
  - [ ] Trigger only fires on first completed trade
  - [ ] Trigger does NOT fire on pending/cancelled trades

- [ ] **Service Verification**
  - [ ] ReferralRewardsService.grantRewards() calls RPC correctly
  - [ ] ReferralRewardsService.checkEligibility() returns correct status
  - [ ] Methods handle errors gracefully

---

## Next Steps

After completing manual testing:

1. ✅ Update MODULE-11-REFERRALS-VERIFICATION-V2.md with test results
2. ✅ Document any issues found
3. ✅ Proceed to REF-V2-003 (Trial Extension) if all tests pass
4. ✅ Create referral dashboard UI (REF-V2-004)
5. ✅ Implement referral notifications (REF-V2-005)

---

**Tester Name**: ___________________  
**Test Date**: ___________________  
**Environment**: ⬜ Staging / ⬜ Production  
**Overall Status**: ⬜ PASS / ⬜ FAIL
