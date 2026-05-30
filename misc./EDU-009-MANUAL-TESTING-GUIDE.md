# EDU-009 Manual Testing Guide

## MODULE-18 V1 TASK EDU-009: Admin Portal — AnalyticsDashboard

**Test Environment:** Admin Portal (`p2p-kids-admin`)  
**Prerequisites:** 
- Admin portal running: `npm run dev`
- Supabase production database with `education_analytics` table
- Sample analytics data (seeded or from user activity)
- Admin user authenticated

---

## Test Case 1: Analytics Tab Access

**Objective:** Verify analytics tab is accessible and renders correctly

**Steps:**
1. Navigate to `/education` in admin portal
2. Observe the tab bar (Sections | Examples | Analytics)
3. Click "Analytics" tab

**Expected Results:**
- ✅ Analytics tab button visible with orange indicator dot
- ✅ Tab switches to Analytics Dashboard without errors
- ✅ Date range picker displays with "Last 30 Days" selected
- ✅ Three metric cards visible: Onboarding Funnel, Help Metrics, Calculator Usage

**Test ID:** `EDU-009-TC-001`

---

## Test Case 2: Date Range Selection (7 Days)

**Objective:** Verify date range picker updates analytics data

**Steps:**
1. Navigate to Analytics tab
2. Observe current metrics (note values)
3. Click "Last 7 Days" button
4. Wait for loading to complete

**Expected Results:**
- ✅ "Last 7 Days" button becomes highlighted (blue background)
- ✅ Loading state shows briefly ("Loading analytics...")
- ✅ Metrics refresh with 7-day data
- ✅ Values may differ from 30-day range
- ✅ All three cards update simultaneously

**Test ID:** `EDU-009-TC-002`

---

## Test Case 3: Date Range Selection (90 Days)

**Objective:** Verify 90-day date range works correctly

**Steps:**
1. Navigate to Analytics tab
2. Click "Last 90 Days" button
3. Wait for loading to complete
4. Verify metrics display

**Expected Results:**
- ✅ "Last 90 Days" button becomes highlighted
- ✅ Metrics refresh with 90-day data
- ✅ Higher values than 7/30 day ranges (if data exists)
- ✅ No console errors

**Test ID:** `EDU-009-TC-003`

---

## Test Case 4: Onboarding Funnel Card (Normal Data)

**Objective:** Verify onboarding funnel displays correctly with good completion rate

**Setup:** Ensure database has onboarding events with completion rate >= 50%

**Steps:**
1. Navigate to Analytics tab (30-day default)
2. Locate "Onboarding Funnel" card
3. Observe metrics display

**Expected Results:**
- ✅ Card title: "Onboarding Funnel"
- ✅ Purple icon (TrendingUp) visible
- ✅ Three metrics displayed:
  - Started: [number]
  - Completed: [number] in green
  - Skipped: [number] in gray
- ✅ Completion rate section shows percentage
- ✅ Progress bar width matches percentage
- ✅ Progress bar is GREEN (completion >= 50%)
- ✅ No warning message visible

**Test ID:** `EDU-009-TC-004`

---

## Test Case 5: Onboarding Funnel Card (Low Completion)

**Objective:** Verify warning displays when completion rate < 50%

**Setup:** Ensure database has data with completion rate < 50%

**Steps:**
1. Navigate to Analytics tab
2. Observe Onboarding Funnel card

**Expected Results:**
- ✅ Completion rate shows < 50%
- ✅ Progress bar is RED
- ✅ Warning message visible: "⚠️ Low completion rate - consider reviewing onboarding content"
- ✅ Warning text is red

**Test ID:** `EDU-009-TC-005`

---

## Test Case 6: Help Metrics Card (With Data)

**Objective:** Verify help section metrics display correctly

**Setup:** Ensure database has help_view and section_expand events

**Steps:**
1. Navigate to Analytics tab
2. Locate "Help Section Metrics" card
3. Observe metrics

**Expected Results:**
- ✅ Card title: "Help Section Metrics"
- ✅ Blue icon (HelpCircle) visible
- ✅ Total Views metric displays formatted number (e.g., "1,250")
- ✅ "Top 5 Expanded Sections" header visible
- ✅ Up to 5 sections listed with:
  - Numbered (1-5)
  - Formatted label (e.g., "How to Earn SP")
  - Count value
  - Progress bar
- ✅ Sections sorted descending by count
- ✅ Progress bars proportional (highest = 100% width)

**Test ID:** `EDU-009-TC-006`

---

## Test Case 7: Help Metrics Card (Empty State)

**Objective:** Verify empty state when no help data exists

**Steps:**
1. Navigate to Analytics tab
2. Select future date range OR use fresh database
3. Observe Help Metrics card

**Expected Results:**
- ✅ Card displays
- ✅ Message: "No data for selected range"
- ✅ No metrics or sections visible

**Test ID:** `EDU-009-TC-007`

---

## Test Case 8: Calculator Usage Card (With Data)

**Objective:** Verify calculator usage metrics and histogram

**Setup:** Ensure database has calculator_use events with price buckets

**Steps:**
1. Navigate to Analytics tab
2. Locate "Calculator Usage" card
3. Observe metrics

**Expected Results:**
- ✅ Card title: "Calculator Usage"
- ✅ Orange icon (Calculator) visible
- ✅ Two top metrics:
  - Total Uses: [number]
  - Unique Users: [number]
- ✅ "Price Range Distribution" section visible
- ✅ Four price buckets listed:
  - < $10
  - $10-50
  - $50-100
  - > $100
- ✅ Each bucket shows count and orange progress bar
- ✅ Progress bars proportional to max bucket
- ✅ Numbers formatted (1,500 not 1500)

**Test ID:** `EDU-009-TC-008`

---

## Test Case 9: Calculator Usage Card (Empty State)

**Objective:** Verify empty state for calculator usage

**Steps:**
1. Navigate to Analytics tab with no calculator data
2. Observe Calculator Usage card

**Expected Results:**
- ✅ Card displays
- ✅ Message: "No data for selected range"
- ✅ No metrics or histogram visible

**Test ID:** `EDU-009-TC-009`

---

## Test Case 10: Error Handling

**Objective:** Verify error state and retry functionality

**Setup:** Disconnect from Supabase OR use invalid project URL temporarily

**Steps:**
1. Navigate to Analytics tab
2. Observe error state
3. Click "Retry" button
4. Restore connection
5. Click "Retry" again

**Expected Results:**
- ✅ Error card displays with red background
- ✅ Error message: "Failed to load analytics"
- ✅ Error details shown (network error, etc.)
- ✅ "Retry" button visible
- ✅ Clicking retry attempts to reload
- ✅ After connection restored, retry succeeds
- ✅ Dashboard renders with data

**Test ID:** `EDU-009-TC-010`

---

## Test Case 11: Loading State

**Objective:** Verify loading state displays during fetch

**Steps:**
1. Navigate to Analytics tab
2. Observe initial load
3. Change date range
4. Observe loading state

**Expected Results:**
- ✅ Loading message: "Loading analytics..."
- ✅ Loading state appears briefly (<2s on staging)
- ✅ After load, full dashboard renders
- ✅ Smooth transition (no flash)

**Test ID:** `EDU-009-TC-011`

---

## Test Case 12: Performance (Initial Load)

**Objective:** Verify initial load performance < 2s

**Setup:** Use browser DevTools Network tab

**Steps:**
1. Clear cache
2. Navigate to `/education`
3. Click Analytics tab
4. Measure time to full render (Network tab waterfall)

**Expected Results:**
- ✅ Initial fetch completes < 2s
- ✅ All three cards render simultaneously
- ✅ No layout shift during load
- ✅ Responsive UI (no lag)

**Test ID:** `EDU-009-TC-012`

---

## Test Case 13: Responsive Layout

**Objective:** Verify responsive grid layout

**Steps:**
1. Navigate to Analytics tab (desktop view)
2. Resize browser to tablet width (~768px)
3. Resize to mobile width (~375px)

**Expected Results:**
- ✅ Desktop: Two-column grid for metric cards
- ✅ Tablet: Single column grid
- ✅ Mobile: Single column grid
- ✅ Cards stack correctly
- ✅ No horizontal scroll
- ✅ Date range picker remains accessible

**Test ID:** `EDU-009-TC-013`

---

## Test Case 14: Section Label Formatting

**Objective:** Verify section types display human-readable labels

**Setup:** Ensure help_metrics data has various section types

**Steps:**
1. Navigate to Analytics tab
2. View Help Metrics card top sections
3. Verify label formatting

**Expected Results:**
- ✅ `sp_earning` → "How to Earn SP"
- ✅ `sp_spending` → "How to Use SP"
- ✅ `sp_definition` → "SP Definition"
- ✅ `safety` → "Safety & Trust"
- ✅ `general` → "General"
- ✅ `example` → "Example Scenarios"

**Test ID:** `EDU-009-TC-014`

---

## Test Case 15: Data Consistency Across Date Ranges

**Objective:** Verify metrics are logically consistent across date ranges

**Steps:**
1. Navigate to Analytics tab (30 days)
2. Note Onboarding Funnel "Started" count
3. Switch to 7 days
4. Note new "Started" count
5. Switch to 90 days
6. Note new "Started" count

**Expected Results:**
- ✅ 7-day count ≤ 30-day count
- ✅ 30-day count ≤ 90-day count
- ✅ Logical progression (unless all data is within 7 days)

**Test ID:** `EDU-009-TC-015`

---

## SQL Verification Queries

Run these queries in Supabase SQL Editor to verify data structure:

### Verify analytics table exists
```sql
SELECT COUNT(*) FROM education_analytics;
```

### Check event type distribution
```sql
SELECT event_type, COUNT(*) 
FROM education_analytics 
GROUP BY event_type 
ORDER BY COUNT(*) DESC;
```

### Verify price bucket data
```sql
SELECT 
  (event_data->>'item_price_bucket') AS bucket,
  COUNT(*) 
FROM education_analytics 
WHERE event_type = 'calculator_use'
GROUP BY bucket
ORDER BY bucket;
```

### Verify onboarding completion rate
```sql
WITH onboarding_events AS (
  SELECT event_type
  FROM education_analytics
  WHERE event_type IN ('onboarding_complete', 'onboarding_skip')
    AND created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
  COUNT(CASE WHEN event_type = 'onboarding_complete' THEN 1 END) AS completed,
  COUNT(CASE WHEN event_type = 'onboarding_skip' THEN 1 END) AS skipped,
  ROUND(
    COUNT(CASE WHEN event_type = 'onboarding_complete' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*), 0),
    2
  ) AS completion_rate
FROM onboarding_events;
```

---

## Test Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001: Tab Access | ⬜ | |
| TC-002: 7-Day Range | ⬜ | |
| TC-003: 90-Day Range | ⬜ | |
| TC-004: Funnel Normal | ⬜ | |
| TC-005: Funnel Warning | ⬜ | |
| TC-006: Help Metrics | ⬜ | |
| TC-007: Help Empty | ⬜ | |
| TC-008: Calculator Data | ⬜ | |
| TC-009: Calculator Empty | ⬜ | |
| TC-010: Error Handling | ⬜ | |
| TC-011: Loading State | ⬜ | |
| TC-012: Performance | ⬜ | |
| TC-013: Responsive | ⬜ | |
| TC-014: Labels | ⬜ | |
| TC-015: Consistency | ⬜ | |

**Total Test Cases:** 15  
**Estimated Testing Time:** 45-60 minutes

---

## Pre-Testing Checklist

Before starting manual testing:

- [ ] Admin portal is running (`npm run dev`)
- [ ] Authenticated as admin user
- [ ] Supabase production connection verified
- [ ] `education_analytics` table has sample data (run seed if needed)
- [ ] Browser DevTools open for performance testing
- [ ] No console errors on page load

---

## Notes for Tester

- Use ⬜ → ✅ to mark test cases as passed
- Use ⬜ → ❌ to mark failures (add notes)
- Screenshot any visual anomalies
- Note any console warnings/errors
- Test in Chrome (primary) and Safari/Firefox (secondary)
- Report all failures with:
  - Test Case ID
  - Steps to reproduce
  - Expected vs actual result
  - Screenshot/console log
