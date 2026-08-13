# MANUAL TEST CASES: PAY-008 - Seller Earnings & Admin Payouts Views

**Module:** MODULE-06-TRADE-FLOW-sellerpayouts.md  
**Task:** PAY-008 (Minimal Admin + Seller Earnings Views)  
**Date:** January 1, 2026  
**Tester:** _____________

---

## Prerequisites

Before running these tests:

1. ✅ Database migration `061_seller_payouts.sql` applied to production
2. ✅ Test users created:
   - **Seller User** with completed trades
   - **Admin User** with admin privileges
3. ✅ Test data seeded:
   - At least 5 payouts in various states (completed, processing, pending, failed, requires_action)
   - Payouts associated with different payout methods (Stripe, PayPal, Venmo)
4. ✅ Mobile app deployed/built for testing
5. ✅ Admin portal accessible

---

## PART 1: MOBILE APP - SELLER EARNINGS SCREEN

### Test Case 1.1: Navigate to Seller Earnings Screen

**Steps:**
1. Open the mobile app
2. Log in as a seller user who has completed trades
3. Navigate to Profile or Seller menu
4. Tap "Earnings" or "My Payouts"

**Expected Result:**
- ✅ Seller Earnings screen loads without errors
- ✅ Loading indicator appears briefly
- ✅ Screen displays summary cards at the top

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.2: Verify Summary Cards Display

**Steps:**
1. On Seller Earnings screen, observe the summary section at the top
2. Look for the "Your Earnings" header (with 💰 emoji) followed by two cards

**Expected Result:**
- ✅ "Your Earnings" header with 💰 emoji is visible
- ✅ Two summary cards displayed below header:
  - "Total Earnings" card (left) shows total of all COMPLETED payouts
  - "Pending" card (right) shows total of all PENDING + PROCESSING payouts
- ✅ Amounts are formatted correctly (e.g., "$49.50", "$98.00")
- ✅ Cards have white background with subtle shadow
- ✅ Amount text is large and bold (24px font weight 700)
- ✅ Labels are smaller gray text above amounts
- ✅ Summary updates when data refreshes

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.3: Verify Payout List Display

**Steps:**
1. Scroll through the payout list

**Expected Result:**
- ✅ Last 20 payouts are displayed
- ✅ Each payout card shows:
  - Date (e.g., "Jan 1, 2026")
  - Payment method (e.g., "Stripe", "PayPal", "Venmo")
  - Net amount (e.g., "$49.50")
  - Status badge with appropriate color
  - Gross amount, Payout fee, Platform fee breakdown
- ✅ Payouts are ordered by creation date (newest first)

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.4: Verify Status Badge Colors

**Steps:**
1. Identify payouts with different statuses
2. Verify badge colors match status

**Expected Result:**
- ✅ "Action Required" = Amber/Orange background
- ✅ "Pending" = Gray background
- ✅ "Processing" = Blue background
- ✅ "Completed" = Green background
- ✅ "Failed" = Red background
- ✅ Badge text is white and readable

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.5: Verify Amount Formatting

**Steps:**
1. Check various payout amounts

**Expected Result:**
- ✅ Amounts display with dollar sign and 2 decimal places
- ✅ Net amount is prominent (larger, bold, green)
- ✅ Breakdown amounts are accurate:
  - Net = Gross - Platform Fee - Payout Fee
- ✅ No negative net amounts displayed

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.6: Pull-to-Refresh Functionality

**Steps:**
1. Pull down on the payout list to refresh
2. Observe loading indicator
3. Wait for refresh to complete

**Expected Result:**
- ✅ Pull-to-refresh gesture triggers reload
- ✅ Loading indicator appears
- ✅ Data refreshes and summary updates
- ✅ Scroll position resets to top

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.7: "Requires Action" Payout Handling

**Steps:**
1. Locate a payout with status "requires_action"
2. Observe the payout card

**Expected Result:**
- ✅ Status badge shows "Action Required" in amber
- ✅ "Set Up Payout Method" button is visible
- ✅ Tapping button navigates to Payout Settings screen (optional implementation)
- ✅ Message explains seller needs to configure payout method

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.8: Failed Payout Display

**Steps:**
1. Locate a payout with status "failed"
2. Observe failure details

**Expected Result:**
- ✅ Status badge shows "Failed" in red
- ✅ Failure reason is displayed in a warning box
- ✅ Reason text is readable and explains the issue
- ✅ No action button for retry (admin handles this)

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.9: Empty State

**Steps:**
1. Log in as a new seller with no completed trades
2. Navigate to Earnings screen

**Expected Result:**
- ✅ Empty state message displays: "No Earnings Yet"
- ✅ Subtitle encourages completing trades
- ✅ Summary cards show $0.00
- ✅ No payout cards are displayed

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 1.10: Error Handling

**Steps:**
1. Disconnect device from internet
2. Navigate to Earnings screen or pull to refresh

**Expected Result:**
- ✅ Error message displays: "Failed to Load Earnings"
- ✅ Error details shown (e.g., "Network error")
- ✅ "Retry" button is available
- ✅ Tapping retry attempts to reload

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

## PART 2: ADMIN PORTAL - PAYOUTS MANAGEMENT

### Test Case 2.1: Navigate to Admin Payouts Page

**Steps:**
1. Open admin portal
2. Log in as admin user
3. Navigate to "Payouts" → "Earnings" section

**Expected Result:**
- ✅ Admin payouts page loads at `/payouts/earnings`
- ✅ Loading indicator appears briefly
- ✅ Stats cards appear at top
- ✅ Payouts table displays below stats

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.2: Verify Stats Dashboard

**Steps:**
1. Observe the stats cards at the top of the page

**Expected Result:**
- ✅ 5 stat cards displayed in a row:
  - Total Payouts (count)
  - Completed (count)
  - Pending (count)
  - Failed (count)
  - Total Volume (dollar amount)
- ✅ Numbers are accurate based on database
- ✅ Colors distinguish positive/negative metrics

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.3: Payouts Table Display

**Steps:**
1. Review the payouts table

**Expected Result:**
- ✅ Table has columns:
  - Seller (email + name)
  - Trade ID (clickable link)
  - Status (badge)
  - Net Amount
  - Provider
  - Created (date + time)
  - Actions
- ✅ Rows are displayed (up to 100 by default)
- ✅ Data is sorted by created date (newest first)

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.4: Search Functionality

**Steps:**
1. Enter a seller email in the search box
2. Wait for results to filter

**Expected Result:**
- ✅ Search filters payouts by:
  - Seller email
  - User ID
  - Trade ID
- ✅ Results update dynamically
- ✅ "No payouts found" message if no match

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.5: Status Filter

**Steps:**
1. Select "Completed" from status dropdown
2. Observe table updates

**Expected Result:**
- ✅ Only completed payouts are shown
- ✅ Stats update to reflect filtered data
- ✅ Table refreshes without page reload

**Repeat for:** Pending, Processing, Failed, Action Required

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.6: Refresh Button

**Steps:**
1. Click "Refresh" button
2. Observe loading state

**Expected Result:**
- ✅ Refresh icon rotates/animates
- ✅ Data reloads from database
- ✅ Stats and table update
- ✅ Loading completes in < 2 seconds

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.7: Export Payouts

**Steps:**
1. Apply desired filters (optional)
2. Click "Export" button

**Expected Result:**
- ✅ CSV file downloads automatically
- ✅ File name indicates export (e.g., `payouts-2026-01-01.csv`)
- ✅ CSV contains all filtered payouts
- ✅ CSV has proper headers and formatting

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.8: Payout Detail Modal

**Steps:**
1. Click any payout row in the table
2. Observe modal that opens

**Expected Result:**
- ✅ Modal opens with title "Payout Details"
- ✅ Close button (✕) visible in top right
- ✅ Sections displayed:
  - Payout ID and Status
  - Seller information (email, user ID)
  - Trade ID
  - Amount Breakdown (Gross, Platform Fee, Payout Fee, Net)
  - Provider Information (Provider, Reference ID, Idempotency Key)
  - Timestamps (Created, Initiated, Completed)
- ✅ All fields populated with correct data

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.9: Close Detail Modal

**Steps:**
1. Open payout detail modal
2. Click the ✕ button or click outside modal

**Expected Result:**
- ✅ Modal closes smoothly
- ✅ Table remains in same state
- ✅ No data loss or errors

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.10: Trade ID Link

**Steps:**
1. In payouts table, click a Trade ID link
2. Observe navigation

**Expected Result:**
- ✅ Clicking Trade ID opens trade detail page in new tab or navigates to `/trades/{id}`
- ✅ Trade detail page loads correctly
- ✅ Back navigation returns to payouts page

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.11: Retry Failed Payout

**Steps:**
1. Filter payouts by "Failed" status
2. Locate a failed payout
3. Click "Retry" button in Actions column
4. Confirm retry in dialog

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ After confirming:
  - Payout status resets to "Pending"
  - Success message appears
  - Table refreshes
  - Payout now visible in "Pending" filter

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.12: Failed Payout Reason Display

**Steps:**
1. Filter by "Failed" status
2. Click a failed payout to open detail modal
3. Scroll to "Failure Reason" section

**Expected Result:**
- ✅ "Failure Reason" section visible
- ✅ Red background/border highlights section
- ✅ Reason text is clear and actionable
- ✅ Example: "Insufficient funds in account" or "Invalid PayPal email"

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.13: Amount Breakdown Accuracy

**Steps:**
1. Open several payout detail modals
2. Verify amount calculations

**Expected Result:**
- ✅ For each payout:
  - Net Amount = Gross Amount - Platform Fee - Payout Fee
- ✅ All amounts match database values
- ✅ Dollar formatting is consistent ($XX.XX)

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.14: Responsive Design (Desktop)

**Steps:**
1. Resize browser window to various widths
2. Observe layout adjustments

**Expected Result:**
- ✅ Stats cards stack on smaller screens
- ✅ Table remains horizontally scrollable
- ✅ Modal is centered and responsive
- ✅ No content is cut off or overlapping

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 2.15: Error Handling

**Steps:**
1. Simulate API error (e.g., disconnect backend)
2. Refresh payouts page

**Expected Result:**
- ✅ Error banner appears at top of page
- ✅ Error message is clear
- ✅ Retry button or refresh option available
- ✅ Page doesn't crash

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

## PART 3: INTEGRATION TESTS

### Test Case 3.1: Seller View vs Admin View Consistency

**Steps:**
1. Note a specific payout ID from seller's mobile app
2. Search for same payout in admin portal
3. Compare details

**Expected Result:**
- ✅ Status matches between both views
- ✅ Net amount matches
- ✅ Provider matches
- ✅ Created date matches

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

### Test Case 3.2: Real-time Updates

**Steps:**
1. Have admin portal open on one device
2. Complete a trade that triggers a payout on mobile
3. Refresh admin portal

**Expected Result:**
- ✅ New payout appears in admin table
- ✅ Stats update to include new payout
- ✅ Seller sees new payout in mobile app

**Actual Result:** _____________  
**Status:** ☐ Pass ☐ Fail  
**Notes:** _____________

---

## SUMMARY

**Total Test Cases:** 32  
**Passed:** ______  
**Failed:** ______  
**Blocked:** ______  
**Not Tested:** ______  

**Critical Issues Found:**
1. _____________
2. _____________
3. _____________

**Recommendations:**
_____________

**Tester Signature:** _____________  
**Date Completed:** _____________
