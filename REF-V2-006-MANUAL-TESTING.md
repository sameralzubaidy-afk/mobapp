# REF-V2-006: Admin Referral Analytics - Manual Testing Guide

**Task:** TASK REF-V2-006 from MODULE-11-REFERRALS-V2.md  
**Date:** 2026-02-01  
**Tester:** _______________

---

## Prerequisites

1. **SQL Migration Applied**: Run migration #174 in Supabase SQL Editor
2. **Admin Access**: You have admin role in the system
3. **Test Data**: At least 5 referrals with varying statuses (pending/completed)
4. **Admin Portal Running**: `cd p2p-kids-admin && npm run dev`

---

## Test Case 1: SQL Migration Verification

**Objective:** Confirm all RPCs are created and executable

### Steps:
1. Open Supabase SQL Editor
2. Run the following verification query:

```sql
-- Check if RPCs exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_referral_metrics', 'get_top_referrers', 'get_referral_funnel');
```

### Expected Results:
- ✅ 3 functions returned: `get_referral_metrics`, `get_top_referrers`, `get_referral_funnel`
- ✅ All routine_type = 'FUNCTION'

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________

---

## Test Case 2: Get Referral Metrics RPC

**Objective:** Verify K-factor, conversion rates, and SP distribution calculations

### Steps:
1. In Supabase SQL Editor, run:

```sql
SELECT get_referral_metrics();
```

2. Verify the returned JSON structure:

```json
{
  "total_users": <number>,
  "users_with_referrals": <number>,
  "total_referrals": <number>,
  "pending_referrals": <number>,
  "completed_referrals": <number>,
  "k_factor": <number>,
  "signup_to_trade_rate": <number>,
  "total_sp_distributed": <number>
}
```

### Expected Results:
- ✅ All fields present
- ✅ `k_factor` = completed_referrals / users_with_referrals (rounded to 2 decimals)
- ✅ `signup_to_trade_rate` = (completed_referrals / total_referrals) * 100
- ✅ `total_sp_distributed` = completed_referrals * 35 (25 referrer + 10 referee)
- ✅ `pending_referrals` + `completed_referrals` <= `total_referrals`

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________
- K-factor: __________
- Signup to trade rate: __________
- SP distributed: __________

---

## Test Case 3: Get Top Referrers Leaderboard

**Objective:** Verify leaderboard sorting and SP calculations

### Steps:
1. In Supabase SQL Editor, run:

```sql
SELECT * FROM get_top_referrers(10);
```

2. Verify results are sorted by `completed_referrals` (descending)
3. Check SP earned calculation: `total_sp_earned` = `completed_referrals` * 25

### Expected Results:
- ✅ Results sorted correctly (highest completed_referrals first)
- ✅ Each row has: user_id, email, total_referrals, completed_referrals, total_sp_earned, trial_extensions_earned
- ✅ `total_sp_earned` = `completed_referrals` * 25
- ✅ Max 10 rows returned (or fewer if less than 10 users have referrals)

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________
- Number of rows: __________
- Top referrer email: __________
- Top referrer completed_referrals: __________

---

## Test Case 4: Get Referral Conversion Funnel

**Objective:** Verify conversion rates at each funnel stage

### Steps:
1. In Supabase SQL Editor, run:

```sql
SELECT get_referral_funnel();
```

2. Verify funnel progression:
   - invites_sent ≥ signups ≥ first_trades ≥ rewards_granted

3. Check rate calculations:
   - `trade_rate` = (first_trades / signups) * 100
   - `reward_rate` = (rewards_granted / first_trades) * 100

### Expected Results:
- ✅ `signups` = `invites_sent` (referral row created on signup)
- ✅ `first_trades` <= `signups`
- ✅ `rewards_granted` = `first_trades` (reward granted when trade completed)
- ✅ `trade_rate` calculated correctly
- ✅ `reward_rate` = 100% (or close to it, since rewards auto-granted)

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________
- Signups: __________
- First trades: __________
- Trade rate: __________

---

## Test Case 5: Admin Portal Page Load

**Objective:** Verify /referrals page renders correctly

### Steps:
1. Start admin portal: `cd p2p-kids-admin && npm run dev`
2. Navigate to: `http://localhost:3000/referrals`
3. Observe page load and data display

### Expected Results:
- ✅ Page loads without errors (< 2 seconds)
- ✅ 4 metric cards displayed (K-Factor, Total Referrals, Conversion Rate, SP Distributed)
- ✅ Conversion funnel section visible with 3 steps
- ✅ Top referrers leaderboard table displayed
- ✅ If no data, "No referral data yet" message shown

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________
- Page load time: __________
- K-Factor displayed: __________

---

## Test Case 6: Metric Card Values

**Objective:** Verify metric cards display correct data

### Steps:
1. On `/referrals` page, compare metric card values to SQL results from Test Case 2
2. Check K-Factor card:
   - Value matches SQL result
   - Subtitle: "Avg referrals per user"
   - Card color: Green if > 1.0, Yellow otherwise

### Expected Results:
- ✅ K-Factor value matches SQL
- ✅ Total Referrals value matches SQL
- ✅ Conversion Rate value matches SQL (signup_to_trade_rate)
- ✅ SP Distributed value matches SQL

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________
- Mismatched values: __________________________________

---

## Test Case 7: Conversion Funnel Visual

**Objective:** Verify funnel visualization and percentages

### Steps:
1. Locate "Conversion Funnel" section on page
2. Verify 3 bars:
   - Signups (100% width, blue)
   - First Trades (calculated %, green/yellow)
   - Rewards Granted (calculated %, green/yellow)
3. Check percentage labels match SQL results

### Expected Results:
- ✅ 3 funnel steps displayed
- ✅ Signups bar = 100% width (baseline)
- ✅ First trades bar width = trade_rate from SQL
- ✅ Rewards granted bar width = reward_rate from SQL
- ✅ Percentages displayed correctly

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________

---

## Test Case 8: Top Referrers Leaderboard Table

**Objective:** Verify leaderboard displays correct data

### Steps:
1. Locate "Top Referrers" table on page
2. Verify table columns:
   - Rank (# 1, #2, etc.)
   - Email
   - Total Referrals
   - Completed
   - SP Earned
   - Trial Extensions
3. Compare first 3 rows to SQL results from Test Case 3

### Expected Results:
- ✅ Table has 6 columns
- ✅ Ranks displayed correctly (#1, #2, #3, etc.)
- ✅ Email addresses match SQL
- ✅ Completed referrals match SQL
- ✅ SP Earned values match SQL (completed * 25)
- ✅ Trial extensions match SQL
- ✅ Empty state shown if no data

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________
- Number of rows displayed: __________

---

## Test Case 9: Error Handling

**Objective:** Verify graceful error handling when RPC fails

### Steps:
1. Temporarily rename one of the RPCs in Supabase:
   ```sql
   ALTER FUNCTION get_referral_metrics() RENAME TO get_referral_metrics_temp;
   ```
2. Refresh `/referrals` page
3. Observe error display

### Expected Results:
- ✅ Page does not crash
- ✅ Red error box displayed: "Error Loading Analytics"
- ✅ Error message explains what failed
- ✅ User can navigate away from page

### Cleanup:
```sql
ALTER FUNCTION get_referral_metrics_temp() RENAME TO get_referral_metrics;
```

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________

---

## Test Case 10: Performance

**Objective:** Verify page loads quickly with large datasets

### Steps:
1. Check current referral count in database:
   ```sql
   SELECT COUNT(*) FROM referrals;
   ```
2. Reload `/referrals` page and measure load time (Chrome DevTools → Network tab)
3. Check RPC execution time in Supabase Dashboard → Logs

### Expected Results:
- ✅ Page loads in < 2 seconds
- ✅ RPC `get_referral_metrics` executes in < 1 second
- ✅ RPC `get_top_referrers` executes in < 1 second
- ✅ RPC `get_referral_funnel` executes in < 500ms
- ✅ No console errors

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________
- Page load time: __________
- RPC execution times: __________

---

## Test Case 11: Edge Cases

**Objective:** Test with zero referrals and zero completed referrals

### Steps:
1. If database has referrals, test with sample data
2. Create a new test environment OR clear referrals temporarily
3. Run SQL queries and check admin portal

### Test 11a: Zero Referrals
**SQL:**
```sql
-- Simulate zero referrals (if needed, delete test referrals)
-- DELETE FROM referrals WHERE created_at > now() - interval '1 hour';
SELECT get_referral_metrics();
```

**Expected:**
- ✅ K-factor = 0
- ✅ Signup to trade rate = 0
- ✅ SP distributed = 0
- ✅ Admin portal shows empty state: "No referral data yet"

### Test 11b: All Pending (No Completed Referrals)
**Expected:**
- ✅ completed_referrals = 0
- ✅ K-factor = 0
- ✅ Trade rate = 0%
- ✅ SP distributed = 0

### Actual Results:
- [ ] PASS
- [ ] FAIL - Reason: __________________________________

---

## Test Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-01: SQL Migration | ⬜ | |
| TC-02: Get Metrics RPC | ⬜ | |
| TC-03: Top Referrers RPC | ⬜ | |
| TC-04: Conversion Funnel RPC | ⬜ | |
| TC-05: Admin Page Load | ⬜ | |
| TC-06: Metric Cards | ⬜ | |
| TC-07: Funnel Visual | ⬜ | |
| TC-08: Leaderboard Table | ⬜ | |
| TC-09: Error Handling | ⬜ | |
| TC-10: Performance | ⬜ | |
| TC-11: Edge Cases | ⬜ | |

**Overall Status:** ⬜ PASS / ⬜ FAIL

---

## Bugs Found

| Bug ID | Description | Severity | Status |
|--------|-------------|----------|--------|
| | | | |

---

## Sign-Off

**Tester Name:** _______________  
**Date:** _______________  
**Signature:** _______________

---

## Navigation Update (for manual verification)

To manually navigate to the referral analytics page:

1. Add link to admin navigation (if not present):

**File:** `p2p-kids-admin/src/app/layout.tsx` (or AdminNav component)

Add this link:
```tsx
<Link href="/referrals" className="...">
  📊 Referral Analytics
</Link>
```

2. Restart dev server:
```bash
cd p2p-kids-admin
npm run dev
```

3. Open browser: `http://localhost:3000/referrals`
