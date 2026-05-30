# REF-V2-008: Manual Testing Guide
## SP Bonus Rewards on First Listing

**Module:** MODULE-11-REFERRALS-V2  
**Task:** REF-V2-008  
**Feature:** SP rewards when referee creates first approved listing  
**Test Environment:** Production Supabase (no local DB)

---

## Prerequisites

Before testing, ensure:
- [ ] Migration `20260205000001_add_referral_listing_feature_toggle.sql` applied to production Supabase
- [ ] Feature toggle `referral_first_listing_enabled` = `true` in `sp_config` table
- [ ] Admin UI updated to show listing bonus config
- [ ] Mobile app rebuilt with latest code
- [ ] At least 2 test users with active/trial subscriptions

---

## Test Case 1: Complete Referral Listing Bonus Flow (Happy Path)

**Objective:** Verify full flow from referral code application to SP rewards on first listing approval.

### Steps:

1. **Setup Referrer**
   - Login as User A (referrer)
   - Navigate to Referral Dashboard
   - Copy referral code (e.g., `abc123xy`)
   - Note User A's current SP balance

   **Expected Result:**
   - Referral code displayed as 8-character alphanumeric string
   - Copy button works
   - SP balance visible

2. **Setup Referee**
   - Logout from User A
   - Signup as new User B (referee) using referral code `abc123xy`
   - During signup, paste referral code in "Referral Code (Optional)" field
   - Complete signup and onboarding

   **Expected Result:**
   - Signup succeeds with referral code
   - User B account created
   - Referral relationship created in `referrals` table (status = 'pending')

3. **Verify Referral Relationship**
   - Open Supabase Dashboard
   - Query: `SELECT * FROM referrals WHERE referred_user_id = '<User B ID>';`

   **Expected Result:**
   ```sql
   referrer_user_id: <User A ID>
   referred_user_id: <User B ID>
   status: 'pending'
   referral_code: 'abc123xy'
   ```

4. **Create First Listing (Referee)**
   - Login as User B
   - Navigate to "Create Listing"
   - Fill in listing details:
     - Title: "Test Item for Referral Bonus"
     - Price: $10.00
     - Category: Toys
     - Upload 1 photo
   - Submit listing

   **Expected Result:**
   - Listing created successfully
   - Listing status = 'pending' (awaiting approval)

5. **Approve Listing (Admin)**
   - Login to Admin Panel
   - Navigate to Listings -> Pending Approvals
   - Find "Test Item for Referral Bonus"
   - Click "Approve"

   **Expected Result:**
   - Listing status changes to 'available'
   - `approved_at` timestamp set

6. **Verify SP Rewards Granted (Automatic)**
   - Wait 5 seconds for trigger to process
   - Login as User A (referrer)
   - Check SP wallet balance

   **Expected Result:**
   - User A balance increased by **25 SP** (or configured amount)
   - SP ledger entry: `transaction_type = 'earn_referral'`, `description = 'Referral Bonus: Friend approved first listing'`

7. **Verify SP Rewards Granted (Referee)**
   - Login as User B (referee)
   - Check SP wallet balance

   **Expected Result:**
   - User B balance increased by **10 SP** (or configured amount)
   - SP ledger entry: `transaction_type = 'earn_referral'`, `description = 'Referral Bonus: First listing approved'`

8. **Verify Idempotency**
   - As admin, unapprove and re-approve the same listing
   - Query: `SELECT * FROM sp_ledger WHERE related_listing_id = '<listing ID>';`

   **Expected Result:**
   - Only 2 ledger entries exist (1 for referrer, 1 for referee)
   - No duplicate rewards granted

---

## Test Case 2: Feature Toggle Disabled

**Objective:** Verify that rewards are NOT granted when feature is disabled.

### Steps:

1. **Disable Feature Toggle**
   - Open Supabase SQL Editor
   - Run:
     ```sql
     UPDATE sp_config
     SET config_value = 'false'
     WHERE config_key = 'referral_first_listing_enabled';
     ```

2. **Create New Referral**
   - Setup User C (referrer) and User D (referee)
   - Apply referral code

3. **Create and Approve Listing**
   - User D creates first listing
   - Admin approves listing

4. **Verify NO SP Rewards Granted**
   - Check User C and User D SP balances

   **Expected Result:**
   - NO SP balance increase
   - NO new ledger entries with `related_listing_id = '<listing ID>'`

5. **Re-enable Feature**
   ```sql
   UPDATE sp_config
   SET config_value = 'true'
   WHERE config_key = 'referral_first_listing_enabled';
   ```

---

## Test Case 3: Second Listing Does NOT Trigger Reward

**Objective:** Verify that only the FIRST approved listing triggers the reward.

### Steps:

1. **Use Existing Referee** (from Test Case 1)
   - Login as User B
   - Note current SP balance

2. **Create Second Listing**
   - Navigate to "Create Listing"
   - Fill in listing details:
     - Title: "Second Test Listing"
     - Price: $15.00
   - Submit listing

3. **Approve Second Listing**
   - Admin approves listing

4. **Verify NO Additional SP Rewards**
   - Check User A and User B SP balances

   **Expected Result:**
   - Balances unchanged from Test Case 1
   - NO new ledger entries for this listing

---

## Test Case 4: Subscription Gating

**Objective:** Verify rewards NOT granted if either user's subscription is expired.

### Steps:

1. **Setup Expired Referrer**
   - Create User E with expired subscription
   - Setup referral with User F (active subscription)
   - User F creates and gets first listing approved

   **Expected Result:**
   - NO SP rewards granted to User E or User F

2. **Setup Expired Referee**
   - Create User G (active subscription) as referrer
   - Create User H (expired subscription) as referee
   - User H creates and gets first listing approved

   **Expected Result:**
   - NO SP rewards granted to User G or User H

3. **Both Active Subscriptions**
   - Create User I and User J (both active subscriptions)
   - Complete referral flow with first listing

   **Expected Result:**
   - SP rewards granted to both User I and User J

---

## Test Case 5: Admin Config Changes

**Objective:** Verify that admin can change SP amounts and changes take effect.

### Steps:

1. **Update Listing Bonus Amounts**
   - Login to Admin Panel
   - Navigate to Referrals -> Configuration
   - Update:
     - "Referrer First Listing Bonus" from 25 to **50**
     - "Referee First Listing Bonus" from 10 to **20**
   - Click "Save"

2. **Verify Config Updated**
   ```sql
   SELECT config_key, config_value
   FROM sp_config
   WHERE config_key IN ('referral_reward_referrer_listing_sp', 'referral_reward_referee_listing_sp');
   ```

   **Expected Result:**
   ```
   referral_reward_referrer_listing_sp: '50'
   referral_reward_referee_listing_sp: '20'
   ```

3. **Create New Referral and First Listing**
   - Setup User K (referrer) and User L (referee)
   - User L creates and gets first listing approved

4. **Verify New Amounts Applied**
   - User K receives **50 SP**
   - User L receives **20 SP**

5. **Restore Original Amounts**
   - Change back to 25 SP / 10 SP

---

## Test Case 6: No Referral Relationship

**Objective:** Verify graceful handling when user has no referrer.

### Steps:

1. **Create User Without Referral**
   - Signup as User M without using any referral code
   - Create and approve first listing

2. **Verify NO SP Rewards**
   - Check User M SP balance

   **Expected Result:**
   - NO SP balance increase
   - NO ledger entries with referral bonus

---

## Test Case 7: Mobile UI Displays Correct Amounts

**Objective:** Verify mobile app displays configured SP amounts.

### Steps:

1. **Open Referral Dashboard**
   - Login to mobile app
   - Navigate to Referral Dashboard

2. **Verify Display**
   - Share message includes correct amounts:
     - "Earn 10 SP when you complete your first trade!"
     - "Get 10 SP bonus when your first listing is approved!"

3. **Update Admin Config**
   - Change referee listing bonus to 20 SP

4. **Refresh Mobile App**
   - Pull-to-refresh Referral Dashboard

5. **Verify Updated Amount**
   - Share message now shows:
     - "Get 20 SP bonus when your first listing is approved!"

---

## Verification Queries (Supabase SQL Editor)

### Check feature toggle status
```sql
SELECT config_key, config_value, value_type
FROM sp_config
WHERE config_key = 'referral_first_listing_enabled';
```

### Check all referral config
```sql
SELECT config_key, config_value, description
FROM sp_config
WHERE category = 'referral'
ORDER BY config_key;
```

### Check referral relationship
```sql
SELECT 
  r.id,
  r.referrer_user_id,
  r.referred_user_id,
  r.status,
  r.referral_code,
  r.created_at
FROM referrals r
WHERE r.referred_user_id = '<User B ID>';
```

### Check SP ledger entries for listing bonus
```sql
SELECT 
  sl.user_id,
  sl.transaction_type,
  sl.amount,
  sl.description,
  sl.related_listing_id,
  sl.created_at
FROM sp_ledger sl
WHERE sl.transaction_type = 'earn_referral'
  AND sl.description LIKE '%listing%'
ORDER BY sl.created_at DESC;
```

### Check SP wallet balances
```sql
SELECT 
  w.user_id,
  w.available_balance,
  w.lifetime_earned,
  w.updated_at
FROM sp_wallets w
WHERE w.user_id IN ('<User A ID>', '<User B ID>');
```

### Check first listing approval status
```sql
SELECT 
  i.id,
  i.seller_id,
  i.title,
  i.status,
  i.approved_at,
  i.created_at
FROM items i
WHERE i.seller_id = '<User B ID>'
ORDER BY i.created_at;
```

---

## Success Criteria

✅ **All test cases pass:**
- [ ] TC1: Complete flow works (referrer + referee both receive SP)
- [ ] TC2: Feature toggle disable prevents rewards
- [ ] TC3: Second listing does NOT trigger reward (idempotent)
- [ ] TC4: Subscription gating enforced (no rewards if expired)
- [ ] TC5: Admin config changes take effect immediately
- [ ] TC6: No referral relationship handled gracefully
- [ ] TC7: Mobile UI displays correct configured amounts

✅ **Database integrity:**
- [ ] No duplicate ledger entries
- [ ] Wallet balances match ledger totals
- [ ] Idempotency keys prevent double-rewards

✅ **Performance:**
- [ ] Trigger processes within 5 seconds of listing approval
- [ ] No database errors in logs

---

## Troubleshooting

### Issue: Rewards not granted
**Possible Causes:**
1. Feature toggle disabled → Check `sp_config.referral_first_listing_enabled`
2. Not first listing → Check `items` table for previous approved listings
3. Subscription expired → Check `subscriptions.status` for both users
4. No referral relationship → Check `referrals` table

### Issue: Duplicate rewards granted
**Possible Cause:**
- Idempotency key not working → Check `sp_ledger.idempotency_key` for duplicates

### Issue: Wrong SP amounts
**Possible Cause:**
- Config not updated → Check `sp_config` values for `referral_reward_referrer_listing_sp` and `referral_reward_referee_listing_sp`

---

## Rollback Plan

If critical issues found:

1. **Disable feature toggle:**
   ```sql
   UPDATE sp_config
   SET config_value = 'false'
   WHERE config_key = 'referral_first_listing_enabled';
   ```

2. **Revert migration (if needed):**
   ```sql
   -- Drop updated RPC
   DROP FUNCTION IF EXISTS public.award_listing_referral_sp(UUID, UUID, UUID, UUID);
   
   -- Delete config key
   DELETE FROM sp_config WHERE config_key = 'referral_first_listing_enabled';
   ```

3. **Notify team and revert app build**

---

## Contact

For questions or issues during testing:
- **Developer:** [Your Name]
- **Supabase Project:** [Project URL]
- **Migration File:** `20260205000001_add_referral_listing_feature_toggle.sql`
