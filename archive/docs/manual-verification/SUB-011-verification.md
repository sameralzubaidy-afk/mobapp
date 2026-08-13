# Manual Verification: SUB-011 — Admin Subscription Management & Metrics Dashboard

**Platform:** Browser (localhost:3001)  
**Prerequisite:** All automated tests passing ✅  
**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-011  

---

## Automated Gates (confirm before opening browser)

- [ ] `npm test` — PASSED
- [ ] `npm run test:playwright` — PASSED  
- [ ] CI pipeline green (if applicable)

---

## TC-01: Verify MRR Card Accuracy Against Database

**Objective:** Confirm Monthly Recurring Revenue (MRR) card displays correct amount matching database

**Steps:**
1. Navigate to http://localhost:3001/subscriptions/manage
2. Wait for page to load completely
3. Record the **MRR** amount displayed on the card (e.g., "$1,245.67")
4. Open Supabase SQL Editor and run this verification query:
   ```sql
   SELECT 
     COALESCE(SUM(monthly_price_cents), 0) / 100.0 AS calculated_mrr
   FROM subscriptions
   WHERE status IN ('active', 'trial', 'paused')
     AND deleted_at IS NULL;
   ```
5. Convert the database result to formatted dollars (e.g., 1245.67 → "$1,245.67")
6. Compare displayed amount with calculated result

**Expected Results:**
- [ ] MRR card displays formatted dollar amount
- [ ] Database query returns a numeric value (cents)
- [ ] Displayed amount matches database (rounded to nearest cent)
- [ ] Format includes comma separators for thousands (e.g., "$1,245.67")
- [ ] Format includes dollar sign prefix
- [ ] If no subscriptions: displays "$0.00"

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-02: Verify Active Subscribers Count Against Database

**Objective:** Confirm Active Subscribers card shows correct count matching database

**Steps:**
1. On the subscriptions management page, record the **Active Subscribers** count (e.g., "42")
2. Open Supabase SQL Editor and run this verification query:
   ```sql
   SELECT COUNT(*) AS active_subscriber_count
   FROM subscriptions
   WHERE status = 'active'
     AND deleted_at IS NULL;
   ```
3. Compare the displayed count with the database result

**Expected Results:**
- [ ] Active Subscribers card displays an integer count
- [ ] Database query returns matching count
- [ ] Card shows exact count (no rounding or estimation)
- [ ] If no active subscriptions: displays "0"
- [ ] Count excludes deleted subscriptions (deleted_at IS NULL check)

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-03: Verify Trial Users Count Against Database

**Objective:** Confirm Trial Users card displays correct count matching database

**Steps:**
1. On the subscriptions management page, record the **Trial Users** count (e.g., "15")
2. Open Supabase SQL Editor and run this verification query:
   ```sql
   SELECT COUNT(*) AS trial_user_count
   FROM subscriptions
   WHERE status = 'trial'
     AND deleted_at IS NULL;
   ```
3. Compare the displayed count with the database result

**Expected Results:**
- [ ] Trial Users card displays an integer count
- [ ] Database query returns matching count
- [ ] Card shows exact count without rounding
- [ ] If no trial users: displays "0"
- [ ] Count excludes deleted subscriptions

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-04: Verify Grace Period Users Count Against Database

**Objective:** Confirm Grace Period card displays correct count matching database

**Steps:**
1. On the subscriptions management page, record the **Grace Period** count (e.g., "8")
2. Open Supabase SQL Editor and run this verification query:
   ```sql
   SELECT COUNT(*) AS grace_period_count
   FROM subscriptions
   WHERE status = 'grace_period'
     AND deleted_at IS NULL;
   ```
3. Compare the displayed count with the database result

**Expected Results:**
- [ ] Grace Period card displays an integer count
- [ ] Database query returns matching count
- [ ] Card shows exact count without rounding
- [ ] If no grace period subscriptions: displays "0"
- [ ] Count excludes deleted subscriptions

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-05: Verify Churn Rate Calculation Against Database

**Objective:** Confirm Churn Rate card shows correct percentage matching database calculation

**Steps:**
1. On the subscriptions management page, record the **Churn Rate** (e.g., "5.3%")
2. Open Supabase SQL Editor and run these verification queries:
   ```sql
   -- Total active + trial + grace subscriptions
   SELECT COUNT(*) AS total_active
   FROM subscriptions
   WHERE status IN ('active', 'trial', 'grace_period')
     AND deleted_at IS NULL;
   
   -- Cancelled subscriptions in the last 30 days
   SELECT COUNT(*) AS churned_30days
   FROM subscriptions
   WHERE status = 'cancelled'
     AND cancelled_at >= NOW() - INTERVAL '30 days'
     AND deleted_at IS NULL;
   ```
3. Calculate churn rate: (churned_30days / total_active) * 100
4. Compare displayed percentage with calculated result

**Expected Results:**
- [ ] Churn Rate card displays percentage with one decimal (e.g., "5.3%")
- [ ] Database calculations match displayed value
- [ ] Percentage includes "%" symbol
- [ ] Calculation uses 30-day window (subscriptions cancelled in last 30 days)
- [ ] If no active subscriptions: displays "0.0%"
- [ ] If no churned subscriptions: displays "0.0%"

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-06: Filter Subscriptions by Status and Verify Card Updates

**Objective:** Verify that metrics cards update correctly when status filters are applied

**Steps:**
1. On the subscriptions management page, note current metrics (e.g., MRR: $1,245.67, Active: 42)
2. Click the "Active" filter button
3. Record the new metrics displayed
4. Verify in database:
   ```sql
   -- For "Active" filter only
   SELECT 
     COUNT(*) AS active_count,
     COALESCE(SUM(monthly_price_cents), 0) / 100.0 AS filtered_mrr
   FROM subscriptions
   WHERE status = 'active'
     AND deleted_at IS NULL;
   ```
5. Click different filters ("Trial", "Grace Period", "Cancelled", "Expired") and repeat verification
6. Click "All" to reset and confirm metrics return to starting values

**Expected Results:**
- [ ] Active filter button has blue background (`bg-blue-600`)
- [ ] Inactive filters have gray background (`bg-gray-100`)
- [ ] Only one filter button is active at a time
- [ ] **MRR card updates** to show only selected status subscriptions' revenue
- [ ] **Active Subscribers card updates** to match filter (0 when not "Active" filter)
- [ ] **Trial Users card updates** to match filter (0 when not "Trial" filter)
- [ ] **Grace Period card updates** to match filter (0 when not "Grace Period" filter)
- [ ] **Churn Rate updates** to reflect filtered dataset
- [ ] All displayed metrics match database verification queries for selected filter
- [ ] "All" filter shows sum of all non-deleted subscriptions
- [ ] Table below updates to show only matching subscriptions

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-07: View Subscriptions Table

**Objective:** Verify that subscriptions table displays correctly with all required columns

**Steps:**
1. Ensure there are subscriptions in the database (or seed test data)
2. Navigate to subscriptions management page
3. Observe the subscriptions table

**Expected Results:**
- [ ] Table displays these columns: User, Status, Price, Period End, Grace Ends, Updated
- [ ] User column shows display name and email
- [ ] Status column shows colored badge (green=active, blue=trial, yellow=grace, etc.)
- [ ] Price column shows formatted currency (e.g., "$4.99")
- [ ] Dates are formatted as "MMM DD, YYYY"  
- [ ] Null values show "—" (em dash)
- [ ] Table has hover effect on rows (`hover:bg-gray-50`)

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-08: Handle Empty Subscriptions State

**Objective:** Verify appropriate messaging when no subscriptions exist for filter

**Steps:**
1. Select a status filter that has no subscriptions (e.g., "Expired")
2. Observe the display

**Expected Results:**
- [ ] Empty state message appears: "No subscriptions found for the selected filter."
- [ ] Message is centered with gray background
- [ ] No table is displayed
- [ ] Metrics still show (may be zero)

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-09: Handle Loading State

**Objective:** Verify loading indicator appears during data fetch

**Steps:**
1. Open browser DevTools → Network tab → set throttling to "Slow 3G"
2. Navigate to subscriptions management page
3. Observe loading behavior

**Expected Results:**
- [ ] Loading spinner appears while fetching data
- [ ] Text "Loading subscriptions..." displays
- [ ] Loading state replaces with content once data loads
- [ ] No flicker or layout shift

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## TC-10: Handle Error State

**Objective:** Verify appropriate error messaging when API fails

**Steps:**
1. Ensure Supabase service role key is invalid or comment out in `.env.local`
2. Navigate to subscriptions management page
3. Observe error handling

**Expected Results:**
- [ ] Error message displays in red box
- [ ] Error message includes helpful text (e.g., "Failed to fetch subscriptions")
- [ ] Page does not crash
- [ ] User can attempt to reload or navigate away

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Mobile Regression (Config Changed)

**ℹ️ NOTE:** Grace period configuration changes are no longer tested in this verification.  
If future subscription config changes are needed, consult `ADMIN-CONFIG-IMPACT-REGISTRY.md` for mobile effect analysis.

---

## Completion Checklist

- [ ] All automated tests passing (Jest + Playwright)
- [ ] All TC cases marked Pass
- [ ] No console errors in browser
- [ ] MRR card matches database calculation
- [ ] Active Subscribers count matches database
- [ ] Trial Users count matches database
- [ ] Grace Period count matches database
- [ ] Churn Rate percentage matches database calculation
- [ ] All metrics update when filters applied
- [ ] Card numbers match database for all filter selections
- [ ] Screenshots attached for any failures (optional)

---

_Verification Date:_ __________  
_Verified By:_ __________  
_Notes:_
