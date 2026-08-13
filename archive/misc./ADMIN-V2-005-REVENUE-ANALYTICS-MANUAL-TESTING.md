# ADMIN-V2-005: Revenue & Analytics Dashboard - Manual Testing Guide

**Task:** ADMIN-V2-005  
**Module:** MODULE-12-ADMIN-V2.md  
**Date:** 2026-03-25  
**Tester:** ___________

---

## Prerequisites

Before testing, ensure:
1. ✅ SQL migration `20260325000000_admin_v2_005_revenue_analytics.sql` has been applied to production Supabase
2. ✅ Admin portal is running (`cd p2p-kids-admin && npm run dev`)
3. ✅ You have admin credentials (email/password)
4. ✅ Database has some test data:
   - At least 2-3 subscriptions (mix of trial/active/cancelled)
   - At least 5-10 completed trades
   - Users with login activity (last_sign_in_at populated)

---

## Test Suite

### TC-001: Database Migration Verification

**Objective:** Verify SQL migration created required RPCs and indexes

**Steps:**
1. Log into Supabase Dashboard → SQL Editor
2. Run the following query:
   ```sql
   SELECT 
     proname AS function_name,
     pg_get_function_identity_arguments(oid) AS arguments
   FROM pg_proc
   WHERE proname IN ('get_revenue_metrics', 'get_engagement_metrics', 'get_revenue_time_series')
   ORDER BY proname;
   ```

**Expected Result:**
- ✅ 3 functions returned:
  - `get_revenue_metrics(p_admin_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)`
  - `get_engagement_metrics(p_admin_id uuid, p_date date)`
  - `get_revenue_time_series(p_admin_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_interval text)`

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-002: Index Verification

**Objective:** Verify performance indexes created

**Steps:**
1. In Supabase SQL Editor, run:
   ```sql
   SELECT 
     schemaname, 
     tablename, 
     indexname, 
     indexdef
   FROM pg_indexes
   WHERE indexname IN (
     'idx_trades_completed_at',
     'idx_subscriptions_status',
     'idx_users_last_sign_in_at'
   )
   ORDER BY indexname;
   ```

**Expected Result:**
- ✅ 2 indexes returned with correct definitions:
  - `idx_trades_completed_at` on public.trades
  - `idx_subscriptions_status` on public.subscriptions
- ℹ️ Note: No index on auth.users (owned by Supabase system, cannot be modified)

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-003: Navigate to Analytics Dashboard

**Objective:** Verify navigation link exists and loads dashboard

**Steps:**
1. Open admin portal: `http://localhost:3001`
2. Login with admin credentials
3. On homepage, look for "📊 Revenue & Analytics" card
4. Click the card

**Expected Result:**
- ✅ Homepage shows analytics card in top row
- ✅ Clicking card navigates to `/analytics`
- ✅ Dashboard page loads without errors
- ✅ Page title shows "Revenue & Analytics"

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-004: Subscription Revenue Metrics Display

**Objective:** Verify subscription revenue section displays correctly

**Steps:**
1. Navigate to `/analytics`
2. Locate "💰 Subscription Revenue" section
3. Verify 3 metric cards display:
   - Active Subscribers
   - MRR (Monthly Recurring Revenue)
   - ARR (Annual Recurring Revenue)

**Expected Result:**
- ✅ Active Subscribers shows numeric count (e.g., "150")
- ✅ MRR shows currency formatted value (e.g., "$1,198.50")
- ✅ MRR subtitle says "Active subscribers only"
- ✅ ARR shows currency formatted value (should be MRR × 12)
- ✅ ARR subtitle says "MRR × 12"
- ✅ All cards have blue/green/purple color scheme

**Status:** ☐ Pass ☐ Fail  
**Actual Values:**
- Active Subscribers: _________
- MRR: _________
- ARR: _________

---

### TC-005: Transaction Fee Revenue Display

**Objective:** Verify transaction fee breakdown displays correctly

**Steps:**
1. On `/analytics`, locate "💳 Transaction Fee Revenue" section
2. Verify 3 metric cards display:
   - Total Transaction Fees
   - Subscriber Fees
   - Non-Subscriber Fees

**Expected Result:**
- ✅ Total Transaction Fees shows currency value
- ✅ Subscriber Fees shows currency value with "$0.99 per trade" subtitle
- ✅ Non-Subscriber Fees shows currency value with "$2.99 per trade" subtitle
- ✅ Total = Subscribers + Non-Subscribers (verify math)
- ✅ Date range period shown (e.g., "30D Period")

**Status:** ☐ Pass ☐ Fail  
**Actual Values:**
- Total: _________
- Subscribers: _________
- Non-Subscribers: _________
- Math Check: _________ = _________ + _________ ☐ Correct

---

### TC-006: Total Revenue & ARPU Display

**Objective:** Verify total revenue and user metrics

**Steps:**
1. Locate "📈 Total Revenue & User Metrics" section
2. Verify 3 metric cards:
   - Total Revenue
   - Total Users
   - ARPU (Average Revenue Per User)

**Expected Result:**
- ✅ Total Revenue shows currency value
- ✅ Total Revenue subtitle says "Subscription + Transaction Fees"
- ✅ Total Users shows numeric count
- ✅ ARPU shows currency value with "Per 30-day period" subtitle
- ✅ ARPU calculation correct: Total Revenue / Total Users

**Status:** ☐ Pass ☐ Fail  
**Actual Values:**
- Total Revenue: _________
- Total Users: _________
- ARPU: _________

---

### TC-007: User Engagement Metrics Display

**Objective:** Verify DAU/MAU engagement metrics

**Steps:**
1. Locate "👥 User Engagement" section
2. Verify 4 metric cards:
   - DAU (Daily Active Users)
   - MAU (Monthly Active Users)
   - DAU/MAU Ratio
   - Non-Subscriber DAU

**Expected Result:**
- ✅ DAU shows total with "X subscribers" subtitle
- ✅ MAU shows total with "X subscribers" subtitle
- ✅ DAU/MAU Ratio shows percentage (e.g., "18.0%")
- ✅ Ratio subtitle says "Engagement stickiness"
- ✅ Non-Subscriber DAU shows count
- ✅ All values are numeric and non-negative

**Status:** ☐ Pass ☐ Fail  
**Actual Values:**
- DAU: _________
- MAU: _________
- Ratio: _________%

---

### TC-008: Date Range Filtering

**Objective:** Verify date range selector updates data

**Steps:**
1. On `/analytics`, locate date range buttons (top right): 7D, 30D, 90D, 1 Year
2. Click "7D" button
3. Wait for data to reload
4. Note transaction fee values
5. Click "90D" button
6. Wait for data to reload
7. Compare transaction fee values

**Expected Result:**
- ✅ Clicking date range button highlights it (blue background)
- ✅ Page shows loading state briefly
- ✅ Transaction fees update (90D should be higher than 7D if trades exist)
- ✅ Period info banner updates to show correct date range
- ✅ No errors in browser console

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-009: Revenue Trend Time Series Display

**Objective:** Verify time series table displays correctly

**Steps:**
1. On `/analytics`, scroll to "📊 Revenue Trend" section
2. Verify table displays with columns:
   - Period
   - Transaction Fees
   - Subscription
   - Total
3. Click interval buttons: Day, Week, Month
4. Verify data updates for each interval

**Expected Result:**
- ✅ Table displays data rows (at least 7 for 30-day period)
- ✅ Period column shows dates in MM/DD/YYYY format
- ✅ Transaction Fees column shows currency values in indigo color
- ✅ Subscription column shows currency values in green color
- ✅ Total column shows currency values (bold)
- ✅ Total = Transaction Fees + Subscription (spot check a few rows)
- ✅ Changing interval updates data grouping
- ✅ Week interval shows fewer rows than Day
- ✅ Month interval shows fewest rows

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-010: Interval Selector Functionality

**Objective:** Verify interval selector changes time series grouping

**Steps:**
1. On revenue trend section, click "Day" button
2. Note number of rows in table
3. Click "Week" button
4. Note number of rows
5. Click "Month" button
6. Note number of rows

**Expected Result:**
- ✅ Day: ~30 rows (for 30-day period)
- ✅ Week: ~4 rows
- ✅ Month: 1-2 rows
- ✅ Selected interval button has blue background
- ✅ Data updates without page reload

**Status:** ☐ Pass ☐ Fail  
**Row Counts:**
- Day: _________
- Week: _________
- Month: _________

---

### TC-011: Refresh Data Functionality

**Objective:** Verify refresh button reloads data

**Steps:**
1. On `/analytics`, scroll to bottom
2. Click "🔄 Refresh Data" button
3. Observe loading state
4. Verify data reloads

**Expected Result:**
- ✅ Button exists at bottom of page
- ✅ Clicking button shows brief loading state
- ✅ All metrics reload
- ✅ No errors displayed
- ✅ Data remains consistent (no duplicate refresh)

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-012: Responsive Layout - Desktop

**Objective:** Verify layout looks good on desktop

**Steps:**
1. View `/analytics` on desktop browser (1920x1080 or larger)
2. Check grid layouts for all metric sections

**Expected Result:**
- ✅ Subscription Revenue: 3 columns
- ✅ Transaction Fees: 3 columns
- ✅ Total Revenue: 3 columns
- ✅ Engagement: 4 columns
- ✅ No horizontal scrolling required
- ✅ Cards have consistent spacing and sizing

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-013: Responsive Layout - Tablet

**Objective:** Verify layout adapts for tablet

**Steps:**
1. Resize browser to tablet width (~768px) or use device simulator
2. Check grid layouts adapt

**Expected Result:**
- ✅ Metric cards stack appropriately
- ✅ Text remains readable
- ✅ No overlapping content
- ✅ Time series table scrolls horizontally if needed

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-014: Period Info Banner

**Objective:** Verify period info banner displays correct dates

**Steps:**
1. On `/analytics` with 30D selected
2. Read period info banner (blue box near top)
3. Verify dates match 30 days ago to today
4. Change to 7D and verify dates update

**Expected Result:**
- ✅ Banner shows "📊 Showing data from [start] to [end]"
- ✅ Dates are human-readable (e.g., "2/25/2026 to 3/25/2026")
- ✅ Dates update when date range changes

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-015: Error Handling - No Data

**Objective:** Verify dashboard handles empty data gracefully

**Steps:**
1. (If possible) Test with a database that has no trades/subscriptions
2. OR verify RPCs return zero values (not null)

**Expected Result:**
- ✅ Dashboard displays without crashing
- ✅ All metrics show "0" or "$0.00" (not "undefined" or "null")
- ✅ No JavaScript errors in console

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-016: testID Attributes for Automation

**Objective:** Verify all interactive elements have testID props

**Steps:**
1. Open browser DevTools → Elements
2. Inspect key elements and verify testID attributes exist:
   - Dashboard container: `analytics-dashboard`
   - Date range buttons: `date-range-7d`, `date-range-30d`, etc.
   - Metric cards: `metric-mrr`, `metric-arr`, `metric-dau`, etc.
   - Interval buttons: `interval-day`, `interval-week`, `interval-month`
   - Time series table: `time-series-table`
   - Refresh button: `refresh-button`

**Expected Result:**
- ✅ All listed testID attributes present in DOM
- ✅ testID values match expected patterns

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-017: Browser Console - No Errors

**Objective:** Verify no JavaScript errors during normal operation

**Steps:**
1. Open browser DevTools → Console
2. Clear console
3. Navigate to `/analytics`
4. Interact with all features (date ranges, intervals, refresh)
5. Check console for errors

**Expected Result:**
- ✅ No red error messages in console
- ✅ Only info/log messages (if any)
- ✅ No "Failed to fetch" errors
- ✅ No React warnings about keys or hooks

**Status:** ☐ Pass ☐ Fail  
**Errors Found:** _____________________________________________________

---

### TC-018: Network Performance

**Objective:** Verify API calls complete within 500ms

**Steps:**
1. Open browser DevTools → Network tab
2. Reload `/analytics` page
3. Find request to `/api/admin/analytics/revenue?...`
4. Check response time

**Expected Result:**
- ✅ API request completes in < 500ms
- ✅ Status code 200
- ✅ Response includes revenue, engagement, and timeSeries data

**Status:** ☐ Pass ☐ Fail  
**Response Time:** _________ ms

---

### TC-019: Authorization - Requires Admin Login

**Objective:** Verify analytics page requires authentication

**Steps:**
1. Logout from admin portal
2. Try to directly access `http://localhost:3001/analytics`

**Expected Result:**
- ✅ Redirected to login page
- OR ✅ Shows "Unauthorized" error
- ✅ Analytics data NOT visible without login

**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________________________________________________

---

### TC-020: Data Accuracy Spot Check

**Objective:** Manually verify a few calculations are correct

**Steps:**
1. Note MRR value from dashboard
2. Go to Supabase Dashboard → Table Editor → subscriptions
3. Count rows where `status = 'active'`
4. Multiply count by $7.99
5. Compare with MRR on dashboard

**Expected Result:**
- ✅ MRR on dashboard matches (active subscribers × $7.99)
- ✅ ARR = MRR × 12

**Status:** ☐ Pass ☐ Fail  
**Calculations:**
- Active subscribers (DB): _________
- Expected MRR: _________ × $7.99 = _________
- Dashboard MRR: _________
- Match: ☐ Yes ☐ No

---

## Test Session Summary

**Date Tested:** ___________  
**Tester Name:** ___________  
**Browser/Device:** ___________  
**Tests Passed:** _____ / 20  
**Tests Failed:** _____ / 20  

**Overall Status:** ☐ All Pass ☐ Issues Found  

**Critical Issues:**
1. _____________________________________________________
2. _____________________________________________________

**Minor Issues:**
1. _____________________________________________________
2. _____________________________________________________

**Additional Notes:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

## Sign-Off

**Tester Signature:** ___________  
**Date:** ___________  

**Ready for Production:** ☐ Yes ☐ No (issues must be resolved first)
