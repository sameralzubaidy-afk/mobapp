# ADMIN-V3-006: SP Analytics Dashboard — Manual Testing Guide

**Task:** TASK ADMIN-V3-006  
**Feature:** SP Analytics Dashboard  
**Test Environment:** Admin Portal (Web)  
**Prerequisites:** 
- Admin user credentials
- Staging database with category and transaction data
- At least 3 categories with transaction history
- Date range of 30+ days of test data

---

## TC-001: Page Access and Navigation

**Objective:** Verify SP Analytics page is accessible from navigation

**Steps:**
1. Log in to admin portal
2. Navigate to the sidebar
3. Click on "SP Analytics" link (should be between "Categories" and "Policies")

**Expected Result:**
- ✓ SP Analytics page loads at `/sp-analytics`
- ✓ Page header shows "SP Analytics Dashboard"
- ✓ Subtitle shows "Track Swap Points velocity, gap percentage, and cash flow metrics per category"
- ✓ Page loads within 1 second (on staging data)

**Test ID:** `sp-analytics-page-access`

---

## TC-002: Date Range Picker — Default State

**Objective:** Verify date range picker defaults to 30 days

**Steps:**
1. Navigate to SP Analytics page
2. Observe the date range picker buttons

**Expected Result:**
- ✓ Three buttons visible: "Last 7 Days", "Last 30 Days", "Last 90 Days"
- ✓ "Last 30 Days" button is highlighted (blue background, white text)
- ✓ Other buttons are gray
- ✓ All buttons have proper `testID` attributes (`sp-analytics-date-range-7/30/90`)

**Test ID:** `date-range-default`

---

## TC-003: Date Range Picker — Selection Change

**Objective:** Verify date range selection triggers data reload

**Steps:**
1. Note the current metrics displayed
2. Click "Last 7 Days" button
3. Wait for data to load
4. Click "Last 90 Days" button
5. Wait for data to load
6. Click "Last 30 Days" to return to default

**Expected Result:**
- ✓ Selected button changes to blue background
- ✓ Loading indicator appears briefly during data fetch
- ✓ Metrics table updates with new data
- ✓ Summary text updates (e.g., "Last 7 days · N categories")
- ✓ No console errors
- ✓ Each transition completes within 1 second

**Test ID:** `date-range-change`

---

## TC-004: Metrics Table — Data Display

**Objective:** Verify metrics table displays correct data and formatting

**Steps:**
1. Navigate to SP Analytics page with 30-day range
2. Examine the metrics table

**Expected Result:**
- ✓ Table has 5 columns: Category, Velocity, Gap %, Avg Cash / Trade, Anomalies
- ✓ Each category row displays:
  - Category name (left-aligned)
  - Velocity (2 decimal places, right-aligned)
  - Gap % (1 decimal place with % sign, right-aligned)
  - Avg Cash / Trade ($ prefix, 2 decimals, right-aligned)
  - Anomaly badges (if any)
- ✓ Rows are sorted by gap_percent descending (highest gap first)
- ✓ All rows have `testID` like `sp-metrics-row-{category_id}`

**Test ID:** `metrics-table-display`

---

## TC-005: Metrics Table — Value Highlighting

**Objective:** Verify anomalous values are highlighted with color

**Steps:**
1. Find a category with velocity < 0.5
2. Find a category with velocity > 2
3. Find a category with gap > 10%

**Expected Result:**
- ✓ Velocity < 0.5 displayed in orange text (`text-orange-600`)
- ✓ Velocity > 2 displayed in red text (`text-red-600`)
- ✓ Gap > 10% displayed in yellow text (`text-yellow-600`)
- ✓ Normal values displayed in gray text
- ✓ Font weight is medium/bold for highlighted values

**Test ID:** `metrics-highlighting`

---

## TC-006: Anomaly Badges — Rendering

**Objective:** Verify anomaly badges render correctly in table

**Steps:**
1. Locate rows with anomaly flags
2. Check badge appearance and text

**Expected Result:**
- ✓ "hoarding" badge: yellow background (`bg-yellow-100`), yellow text
- ✓ "low velocity" badge: orange background (`bg-orange-100`), orange text
- ✓ "spending spike" badge: red background (`bg-red-100`), red text
- ✓ Badge text replaces underscores with spaces ("low velocity" not "low_velocity")
- ✓ Multiple badges can appear on same row
- ✓ Rows with no anomalies show "—" in Anomalies column

**Test ID:** `anomaly-badges`

---

## TC-007: Anomaly Alerts Panel — All Healthy

**Objective:** Verify panel shows "All Categories Healthy" when no anomalies

**Steps:**
1. Select a date range with no anomalies (may need to use future date or test data)
2. Observe anomaly alerts panel

**Expected Result:**
- ✓ Green background panel displays
- ✓ Text reads "✓ All Categories Healthy"
- ✓ Subtext: "No anomalies detected in the selected date range"
- ✓ `testID="sp-anomaly-none"` present

**Test ID:** `anomaly-alerts-healthy`

---

## TC-008: Anomaly Alerts Panel — Flagged Categories

**Objective:** Verify flagged categories display in alerts panel

**Steps:**
1. Select a date range with anomalies (default 30 days should have some)
2. Observe anomaly alerts panel

**Expected Result:**
- ✓ Panel header shows "N Categories Flagged" (N = count)
- ✓ Each flagged category shows:
  - Category name
  - One or more anomaly descriptions with icons
  - Metrics summary (Velocity, Gap, Avg Cash)
- ✓ Anomaly descriptions match:
  - Hoarding: "Gap > 10% — users earning but not spending"
  - Low Velocity: "Velocity < 0.5 — spending is much lower than earning"
  - Spending Spike: "Velocity > 2 — users spending more SP than earning"
- ✓ Cards have hover effect and cursor pointer
- ✓ Each card has `testID="anomaly-card-{category_id}"`

**Test ID:** `anomaly-alerts-flagged`

---

## TC-009: Category Click — Deep Link from Alerts

**Objective:** Verify clicking flagged category navigates to edit modal

**Steps:**
1. In anomaly alerts panel, click on a flagged category card
2. Observe navigation

**Expected Result:**
- ✓ Navigates to `/categories?edit={category_id}&tab=sp-config`
- ✓ CategoryForm modal opens (if implemented)
- ✓ SP Config tab is focused
- ✓ Category data is pre-filled

**Test ID:** `anomaly-click-deeplink`

---

## TC-010: Category Click — Deep Link from Table Row

**Objective:** Verify clicking metrics table row navigates to edit modal

**Steps:**
1. In metrics table, click on any category row
2. Observe navigation

**Expected Result:**
- ✓ Navigates to `/categories?edit={category_id}&tab=sp-config`
- ✓ Same behavior as TC-009
- ✓ Row has hover effect before click (`hover:bg-gray-50`)

**Test ID:** `table-row-click-deeplink`

---

## TC-011: CSV Export — Button Visibility

**Objective:** Verify Export CSV button is present and accessible

**Steps:**
1. Navigate to SP Analytics page
2. Locate Export CSV button in top-right

**Expected Result:**
- ✓ Button displays with Download icon + "Export CSV" text
- ✓ Blue background (`bg-blue-600`)
- ✓ `testID="export-csv-button"`
- ✓ Button has `aria-label="Export CSV"`
- ✓ Hover effect changes to `bg-blue-700`

**Test ID:** `csv-export-button`

---

## TC-012: CSV Export — Download Functionality

**Objective:** Verify CSV export generates correct file

**Steps:**
1. Click "Export CSV" button
2. Check browser downloads folder
3. Open downloaded CSV file

**Expected Result:**
- ✓ File downloads with name format: `sp-analytics-{days}days-{YYYY-MM-DD}.csv`
- ✓ CSV has 6 columns: Category ID, Category Name, Velocity, Gap %, Avg Cash Per Trade, Anomaly Flags
- ✓ First row is header row
- ✓ Data rows match displayed table data
- ✓ Velocity has 2 decimals, Gap has 1 decimal, Cash has 2 decimals
- ✓ Anomaly flags are semicolon-separated if multiple
- ✓ Category names with commas are quoted
- ✓ Number of data rows = number of categories in table

**Test ID:** `csv-export-content`

---

## TC-013: Empty State — No Data in Range

**Objective:** Verify empty state displays when no data exists

**Steps:**
1. Select a future date range (e.g., manually edit test to use future dates)
   OR use a fresh staging DB with no transactions
2. Observe metrics table

**Expected Result:**
- ✓ Table shows message: "No category data available for the selected date range"
- ✓ `testID="sp-metrics-empty"` present
- ✓ No anomaly alerts panel displayed (or shows "All Healthy")
- ✓ Export CSV button still visible but shows alert "No data to export" on click

**Test ID:** `empty-state`

---

## TC-014: Loading State

**Objective:** Verify loading indicator during data fetch

**Steps:**
1. Navigate to SP Analytics page
2. Immediately observe loading state (use network throttling if needed)
3. Change date range and observe loading state

**Expected Result:**
- ✓ Initial load shows: "Loading metrics..." in table area
- ✓ `testID="sp-metrics-loading"` present
- ✓ Loading state replaces with data when fetch completes
- ✓ No anomaly alerts panel shown during loading
- ✓ Date range buttons remain enabled during loading

**Test ID:** `loading-state`

---

## TC-015: Error State

**Objective:** Verify error handling when service fails

**Steps:**
1. Simulate service error (disconnect network or break service endpoint)
2. Navigate to SP Analytics page
3. Observe error display

**Expected Result:**
- ✓ Red error banner displays at top
- ✓ Error message: "Error Loading Analytics"
- ✓ Details show error reason (e.g., "Failed to load analytics. Please try again.")
- ✓ `testID="sp-analytics-error"` present
- ✓ Table area shows empty state
- ✓ User can retry by changing date range

**Test ID:** `error-state`

---

## TC-016: Performance — Initial Load

**Objective:** Verify dashboard loads within 1 second

**Steps:**
1. Open browser DevTools Network tab
2. Navigate to SP Analytics page
3. Measure time from navigation to "DOMContentLoaded"

**Expected Result:**
- ✓ Initial page render < 500ms
- ✓ Data fetch completes < 1000ms total
- ✓ No console errors or warnings
- ✓ Network waterfall shows no blocking requests

**Test ID:** `performance-initial-load`

---

## TC-017: Accessibility — Keyboard Navigation

**Objective:** Verify full keyboard accessibility

**Steps:**
1. Navigate to SP Analytics page
2. Use Tab key to navigate through interactive elements
3. Use Enter/Space to activate buttons
4. Use arrow keys in table (if applicable)

**Expected Result:**
- ✓ All buttons are keyboard-focusable
- ✓ Focus order: Date range buttons → Export button → Table rows
- ✓ Focus indicator visible on all elements
- ✓ Enter/Space activates date range buttons
- ✓ Enter/Space on table row navigates to category edit
- ✓ No keyboard traps

**Test ID:** `accessibility-keyboard`

---

## TC-018: Accessibility — Screen Reader

**Objective:** Verify screen reader announcements

**Steps:**
1. Enable VoiceOver (macOS) or NVDA (Windows)
2. Navigate through SP Analytics page
3. Listen to announcements

**Expected Result:**
- ✓ Page title announced: "SP Analytics Dashboard"
- ✓ Date range buttons announce: "Last 30 Days, button, pressed" (for selected)
- ✓ Export button announces: "Export CSV, button"
- ✓ Table announces column headers
- ✓ Anomaly badges announced with flag name
- ✓ Metrics values announced with labels (e.g., "Velocity: 0.30")

**Test ID:** `accessibility-screen-reader`

---

## TC-019: Responsive Design — Tablet View

**Objective:** Verify layout works on tablet breakpoints

**Steps:**
1. Resize browser to 768px width (tablet)
2. Navigate to SP Analytics page
3. Test all interactions

**Expected Result:**
- ✓ Dashboard layout remains usable
- ✓ Table scrolls horizontally if needed
- ✓ Date range picker wraps to new line if needed
- ✓ Anomaly cards stack vertically
- ✓ Export button remains accessible
- ✓ No horizontal overflow

**Test ID:** `responsive-tablet`

---

## TC-020: Responsive Design — Mobile View

**Objective:** Verify layout works on mobile breakpoints

**Steps:**
1. Resize browser to 375px width (mobile)
2. Navigate to SP Analytics page
3. Test all interactions

**Expected Result:**
- ✓ All elements stack vertically
- ✓ Date range buttons remain selectable
- ✓ Table becomes horizontally scrollable
- ✓ Anomaly alerts panel readable on small screen
- ✓ Export button full-width or clearly visible
- ✓ Touch targets ≥ 44x44px

**Test ID:** `responsive-mobile`

---

## Test Summary Matrix

| TC ID | Test Case | Priority | Expected Pass Rate |
|-------|-----------|----------|-------------------|
| TC-001 | Page Access | Critical | 100% |
| TC-002 | Date Range Default | High | 100% |
| TC-003 | Date Range Change | High | 100% |
| TC-004 | Metrics Display | Critical | 100% |
| TC-005 | Value Highlighting | High | 100% |
| TC-006 | Anomaly Badges | High | 100% |
| TC-007 | Alerts Healthy | Medium | 100% |
| TC-008 | Alerts Flagged | High | 100% |
| TC-009 | Alert Deep Link | High | 100% |
| TC-010 | Row Deep Link | High | 100% |
| TC-011 | CSV Button | Medium | 100% |
| TC-012 | CSV Content | High | 100% |
| TC-013 | Empty State | Medium | 100% |
| TC-014 | Loading State | High | 100% |
| TC-015 | Error State | High | 100% |
| TC-016 | Performance | Critical | 100% |
| TC-017 | Keyboard Nav | High | 100% |
| TC-018 | Screen Reader | Medium | 100% |
| TC-019 | Tablet View | Medium | 90% |
| TC-020 | Mobile View | Low | 90% |

---

## Pre-Test Setup (SQL)

Run this SQL in Supabase SQL Editor before testing to ensure test data exists:

```sql
-- Verify categories exist
SELECT id, name, is_active FROM categories WHERE is_active = true LIMIT 5;

-- Check for transaction data in last 90 days
SELECT 
  c.name,
  COUNT(*) as transaction_count
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE i.status = 'sold'
  AND i.created_at >= NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name
ORDER BY transaction_count DESC;
```

**Expected:** At least 3 categories with 5+ transactions each in last 90 days.

---

## Post-Test Cleanup

No cleanup required — this is a read-only dashboard.

---

## Known Issues / Limitations

1. CSV export cannot be tested in Maestro (browser download API)
2. Deep-link to categories page depends on ADMIN-V3-004 implementation
3. Performance test requires realistic staging data volume
4. Screen reader testing is manual-only (not automatable via Maestro)

---

**Test Author:** AI Agent  
**Review Date:** [To be filled]  
**Approved By:** [To be filled]
