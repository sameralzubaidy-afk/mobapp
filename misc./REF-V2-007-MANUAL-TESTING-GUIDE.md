# REF-V2-007 Manual Testing Guide

## Test Environment Setup

### Prerequisites
- Admin Portal running locally or on staging
- Mobile app (iOS Simulator or Android Emulator)
- Admin UI secret configured (`NEXT_PUBLIC_ADMIN_UI_SECRET`)
- Supabase connection active

### Required SQL Setup
Before testing, verify `sp_config` table contains referral keys:

```sql
-- Verify referral config exists
SELECT config_key, config_value, value_type, description
FROM sp_config
WHERE category = 'referral'
ORDER BY config_key;

-- Expected rows:
-- referral_reward_referrer_sp | 25
-- referral_reward_referee_sp  | 10
-- max_referral_extensions     | 3
-- referral_extension_days     | 7
-- referral_program_enabled    | true
```

If missing, run migration `20260201000000_fix_referral_rewards_v2_bridge.sql`.

---

## TEST SUITE 1: Admin UI - Manage Referral Card

### TC-001: Verify "Manage Referral" Card Appears on Admin Home
**Precondition:** Admin portal home page loaded

**Steps:**
1. Navigate to admin portal home (`/`)
2. Locate the "Manage Referral" card
3. Verify card displays:
   - Icon: 🔗
   - Title: "Manage Referral"
   - Description: "Configure SP bonus rewards, trial extensions, and view referral program analytics."

**Expected Result:**
- ✅ Card visible next to "Trades" and "Payouts" cards
- ✅ Card has hover effect (shadow increases on hover)

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-002: Navigate to Referral Management Page
**Precondition:** "Manage Referral" card visible

**Steps:**
1. Click "Manage Referral" card
2. Verify URL changes to `/referrals`
3. Verify page title is "Referral Program Management"

**Expected Result:**
- ✅ URL: `http://localhost:3000/referrals`
- ✅ Page loads without errors
- ✅ Title displayed: "Referral Program Management"

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

## TEST SUITE 2: Admin UI - Configuration Tab

### TC-003: Verify Configuration Tab is Default
**Precondition:** `/referrals` page loaded

**Steps:**
1. Observe the tab navigation
2. Verify "Configuration" tab is highlighted (blue border)
3. Verify configuration form is visible

**Expected Result:**
- ✅ "Configuration" tab active (blue border + blue text)
- ✅ "Analytics" tab inactive (gray text)
- ✅ Configuration form visible

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-004: Load Current SP Bonus Values
**Precondition:** Configuration tab active

**Steps:**
1. Inspect "SP Bonus Rewards" section
2. Verify "Referrer SP Bonus" field shows current value (should be 25)
3. Verify "Referee SP Bonus" field shows current value (should be 10)
4. Verify description text is correct

**Expected Result:**
- ✅ Referrer SP Bonus input: `25`
- ✅ Referee SP Bonus input: `10`
- ✅ Description explains when rewards are granted

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-005: Update Referrer SP Bonus
**Precondition:** Configuration tab loaded

**Steps:**
1. Change "Referrer SP Bonus" from `25` to `30`
2. Click "Save" button next to the field
3. Wait for success message
4. Open browser console and verify API call succeeded

**Expected Result:**
- ✅ Success message: "Successfully updated referral_reward_referrer_sp"
- ✅ Message disappears after 3 seconds
- ✅ No errors in console

**Verification SQL:**
```sql
SELECT config_value FROM sp_config WHERE config_key = 'referral_reward_referrer_sp';
-- Should return: 30
```

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-006: Update Referee SP Bonus
**Precondition:** Configuration tab loaded

**Steps:**
1. Change "Referee SP Bonus" from `10` to `15`
2. Click "Save" button
3. Wait for success message

**Expected Result:**
- ✅ Success message appears
- ✅ Value persists after refresh

**Verification SQL:**
```sql
SELECT config_value FROM sp_config WHERE config_key = 'referral_reward_referee_sp';
-- Should return: 15
```

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-007: Validate Number Input (Negative Values)
**Precondition:** Configuration tab loaded

**Steps:**
1. Try to enter `-5` in "Referrer SP Bonus"
2. Attempt to save
3. Verify validation behavior

**Expected Result:**
- ✅ Input field enforces `min="0"` (browser validation prevents negative)
- OR ✅ Save fails with error message

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-008: Update Max Referral Extensions
**Precondition:** Configuration tab loaded

**Steps:**
1. Change "Max Referral Extensions" from `3` to `5`
2. Click "Save"
3. Verify success message

**Expected Result:**
- ✅ Value updates successfully
- ✅ Description text explains limit

**Verification SQL:**
```sql
SELECT config_value FROM sp_config WHERE config_key = 'max_referral_extensions';
-- Should return: 5
```

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-009: Update Extension Days per Referral
**Precondition:** Configuration tab loaded

**Steps:**
1. Change "Extension Days per Referral" from `7` to `10`
2. Click "Save"
3. Verify success message

**Expected Result:**
- ✅ Value updates successfully

**Verification SQL:**
```sql
SELECT config_value FROM sp_config WHERE config_key = 'referral_extension_days';
-- Should return: 10
```

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-010: Toggle Referral Program Enabled
**Precondition:** Configuration tab loaded

**Steps:**
1. Click "Referral Program Enabled" checkbox to disable
2. Wait for auto-save
3. Verify success message
4. Toggle back to enabled
5. Verify success message

**Expected Result:**
- ✅ Checkbox state changes
- ✅ Success message on each change
- ✅ Value persists

**Verification SQL:**
```sql
SELECT config_value FROM sp_config WHERE config_key = 'referral_program_enabled';
-- Should toggle between 'true' and 'false'
```

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-011: Verify Warning Banner
**Precondition:** Configuration tab visible

**Steps:**
1. Scroll down to yellow warning banner
2. Read the warning text

**Expected Result:**
- ✅ Yellow banner visible at bottom
- ✅ Text explains: "Changes to SP bonus values only affect new referrals after the change is saved"
- ✅ Mentions existing pending referrals use old values

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-012: Test Save Without Admin Secret (Security)
**Precondition:** Admin secret not set in headers (manual API test)

**Steps:**
1. Use Postman or curl to call API without admin secret:
   ```bash
   curl -X PATCH http://localhost:3000/api/admin/sp-config \
     -H "Content-Type: application/json" \
     -d '{"key":"referral_reward_referrer_sp","value":"999"}'
   ```

**Expected Result:**
- ✅ HTTP 401 Unauthorized
- ✅ Error: "Unauthorized: Invalid admin secret"
- ✅ Value NOT updated in database

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

## TEST SUITE 3: Mobile App - Dynamic SP Values

### TC-013: Mobile App Reads Dynamic SP Values
**Precondition:** 
- Admin portal: Set referrer SP to 30, referee SP to 15 (from TC-005, TC-006)
- Mobile app running

**Steps:**
1. Open mobile app
2. Navigate to Referral Dashboard (if implemented)
3. Verify SP values displayed match configured values

**Expected Result:**
- ✅ Share message says: "Join Kids Club+ and get **15 SP** when you complete your first trade!"
- ✅ Referrer reward text mentions **30 SP**

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

**Note:** If ReferralDashboardScreen doesn't exist yet, this test can be deferred.

---

### TC-014: Verify SP Config Cache Works
**Precondition:** Mobile app loaded

**Steps:**
1. Call `ReferralConfigService.getConfig()` twice in succession
2. Check console logs for API calls

**Expected Result:**
- ✅ First call fetches from Supabase
- ✅ Second call uses cached values (no new API call)
- ✅ Cache expires after 5 minutes

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

## TEST SUITE 4: Backend - Verify Rewards Use Config

### TC-015: Trigger Referral Reward with Updated Config
**Precondition:** 
- Two test users: referrer and referee
- Referee has pending referral
- SP config updated to referrer=30, referee=15

**Steps:**
1. As referee, complete first trade
2. Wait for rewards to trigger
3. Query sp_ledger for both users

**Expected Verification:**
```sql
-- Referrer should receive 30 SP
SELECT amount, reason, user_id FROM sp_ledger
WHERE reason = 'referral_bonus' AND user_id = '<referrer_user_id>'
ORDER BY created_at DESC LIMIT 1;
-- Should return: amount = 30

-- Referee should receive 15 SP
SELECT amount, reason, user_id FROM sp_ledger
WHERE reason = 'referral_bonus' AND user_id = '<referee_user_id>'
ORDER BY created_at DESC LIMIT 1;
-- Should return: amount = 15
```

**Expected Result:**
- ✅ Referrer receives 30 SP (not 25)
- ✅ Referee receives 15 SP (not 10)
- ✅ sp_wallets balances updated correctly

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-016: Verify Old Referrals Use Old Values
**Precondition:** 
- Referral created BEFORE config change (when values were 25/10)
- Config changed to 30/15
- Referee completes first trade AFTER config change

**Steps:**
1. Identify a referral created before config change
2. Complete first trade for that referee
3. Verify rewards granted

**Expected Result:**
- ✅ Referrer receives 25 SP (old value from `referrals.bonus_points_referrer`)
- ✅ Referee receives 10 SP (old value from `referrals.bonus_points`)
- ✅ Confirms config change only affects NEW referrals

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

## TEST SUITE 5: Analytics Tab

### TC-017: Switch to Analytics Tab
**Precondition:** `/referrals` page loaded

**Steps:**
1. Click "Analytics" tab
2. Verify tab becomes active
3. Verify content loads

**Expected Result:**
- ✅ "Analytics" tab highlighted (blue)
- ✅ "Configuration" tab inactive (gray)
- ✅ Analytics content visible (or placeholder shown)

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

**Note:** If analytics requires server component refactor, placeholder is acceptable.

---

## TEST SUITE 6: Error Handling

### TC-018: Handle Network Error Gracefully
**Precondition:** Configuration tab loaded

**Steps:**
1. Disconnect from network or stop Supabase
2. Try to save a config value
3. Verify error message displayed

**Expected Result:**
- ✅ Red error banner appears
- ✅ Error message explains failure (e.g., "Failed to save configuration")
- ✅ Form remains editable (not frozen)

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

### TC-019: Handle Invalid Admin Secret
**Precondition:** Configuration tab loaded with wrong admin secret

**Steps:**
1. Modify `NEXT_PUBLIC_ADMIN_UI_SECRET` env var to wrong value
2. Try to save a config value
3. Verify 401 error handling

**Expected Result:**
- ✅ Error message: "Unauthorized: Invalid admin secret"
- ✅ Value NOT saved

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

## TEST SUITE 7: End-to-End Flow

### TC-020: Complete Admin → Mobile → Reward Flow
**Precondition:** Clean test environment

**Steps:**
1. **Admin:** Set referrer SP = 40, referee SP = 20
2. **Mobile:** User A shares referral code
3. **Mobile:** User B signs up with referral code
4. **Mobile:** User B completes first trade
5. **Verify:** Both users receive correct SP amounts

**Expected Result:**
- ✅ Referral created with status 'pending'
- ✅ After first trade:
  - User A receives 40 SP
  - User B receives 20 SP
  - Referral status = 'completed'
- ✅ Notifications sent with correct amounts

**Verification SQL:**
```sql
SELECT r.status, r.bonus_points_referrer, r.bonus_points, 
       l1.amount as referrer_sp, l2.amount as referee_sp
FROM referrals r
LEFT JOIN sp_ledger l1 ON l1.user_id = r.referrer_user_id AND l1.reason = 'referral_bonus'
LEFT JOIN sp_ledger l2 ON l2.user_id = r.referred_user_id AND l2.reason = 'referral_bonus'
WHERE r.id = '<referral_id>';
```

**Actual Result:** ___________

**Status:** ⬜ Pass / ⬜ Fail

---

## Verification Checklist (MODULE-11-REFERRALS-VERIFICATION-V2.md)

### Section 6: Admin Referral Analytics
- [ ] **TC-001**: "Manage Referral" card visible on Admin Home
- [ ] **TC-002**: Card links to `/referrals` page
- [ ] **TC-003**: Configuration tab is default
- [ ] **TC-004**: Current SP values loaded correctly
- [ ] **TC-005**: Referrer SP can be updated
- [ ] **TC-006**: Referee SP can be updated
- [ ] **TC-008**: Max extensions can be updated
- [ ] **TC-009**: Extension days can be updated
- [ ] **TC-010**: Program enabled flag can be toggled
- [ ] **TC-012**: Admin secret enforced (security)
- [ ] **TC-015**: Rewards use updated config values
- [ ] **TC-016**: Old referrals use old config values
- [ ] **TC-020**: End-to-end flow works

### REF-V2-007 Specific Items
- [ ] Admin UI Configuration tab displays all fields
- [ ] Save button persists changes to `sp_config`
- [ ] Mobile app reads dynamic SP values
- [ ] Share message uses dynamic values
- [ ] Notifications use dynamic values (text)
- [ ] Warning banner explains impact of changes
- [ ] Analytics tab accessible (or placeholder shown)

---

## Test Summary Report

**Date:** ___________  
**Tester:** ___________  
**Environment:** ⬜ Local / ⬜ Staging  

### Results
- **Total Tests:** 20
- **Passed:** ___
- **Failed:** ___
- **Blocked:** ___
- **Skipped:** ___

### Critical Failures
(List any P0/P1 bugs found)

1. ___________
2. ___________

### Notes
(Additional observations, performance issues, UX feedback)

___________

---

## Commands for npm

### Admin Portal
```bash
# Install dependencies
cd p2p-kids-admin
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run type check
npm run type-check

# Run lint
npm run lint
```

### Mobile App
```bash
# Install dependencies
cd p2p-kids-marketplace
npm install

# Run type check
npm run typecheck

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Start Expo
npm start
```

---

## SQL Cleanup (After Testing)

```sql
-- Reset config to defaults
UPDATE sp_config SET config_value = '25' WHERE config_key = 'referral_reward_referrer_sp';
UPDATE sp_config SET config_value = '10' WHERE config_key = 'referral_reward_referee_sp';
UPDATE sp_config SET config_value = '3' WHERE config_key = 'max_referral_extensions';
UPDATE sp_config SET config_value = '7' WHERE config_key = 'referral_extension_days';
UPDATE sp_config SET config_value = 'true' WHERE config_key = 'referral_program_enabled';
```
