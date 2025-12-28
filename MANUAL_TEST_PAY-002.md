# MANUAL TEST GUIDE: PAY-002 - Payout Fee Model + Helpers

**Module:** MODULE-06-TRADE-FLOW-sellerpayouts.md  
**Task:** PAY-002  
**Test Date:** _______________  
**Tester:** _______________  
**Environment:** Production Supabase + Admin Portal

---

## ⚠️ PREREQUISITE: Run SQL Migration

**BEFORE testing, you MUST run this SQL in Supabase SQL Editor:**

```sql
-- Run this in Supabase SQL Editor (Production)
-- File: supabase/migrations/074_admin_payout_fee_config.sql

-- Copy the entire content of 074_admin_payout_fee_config.sql and execute
```

**Verification after migration:**
```sql
-- Verify admin_config entries exist
SELECT key, value, description FROM admin_config WHERE category = 'payout_fees' ORDER BY key;

-- Expected: 7 rows returned
```

---

## TEST SUITE 1: Database Schema & RPCs

### TC-001: Verify Payout Fee Config Keys Exist
**Objective:** Confirm all payout fee configuration keys are in database

**Steps:**
1. Open Supabase SQL Editor
2. Run query:
```sql
SELECT key, value, description, category 
FROM admin_config 
WHERE category = 'payout_fees' 
ORDER BY key;
```

**Expected Results:**
- ✅ Returns 7 rows
- ✅ Keys present:
  - `payout_fee_stripe_fixed_cents` (value: 25)
  - `payout_fee_stripe_percentage` (value: 0.25)
  - `payout_fee_paypal_percentage` (value: 2.0)
  - `payout_fee_paypal_cap_cents` (value: 2000)
  - `payout_fee_venmo_percentage` (value: 2.0)
  - `payout_fee_venmo_cap_cents` (value: 2000)
  - `payout_fee_bank_ach_cents` (value: 25)

**Status:** ☐ Pass  ☐ Fail  

---

### TC-002: Test get_payout_fee_config RPC
**Objective:** Verify RPC returns all fee configuration values

**Steps:**
1. Run query:
```sql
SELECT * FROM get_payout_fee_config();
```

**Expected Results:**
- ✅ Returns 1 row with columns:
  - `stripe_fixed_cents`: 25
  - `stripe_percentage`: 0.25
  - `paypal_percentage`: 2.0
  - `paypal_cap_cents`: 2000
  - `venmo_percentage`: 2.0
  - `venmo_cap_cents`: 2000
  - `bank_ach_cents`: 25

**Status:** ☐ Pass  ☐ Fail  

---

### TC-003: Test calculate_payout_fee_cents for Stripe
**Objective:** Verify Stripe fee calculation (0.25% + $0.25)

**Test Cases:**

**A. $100 payout**
```sql
SELECT calculate_payout_fee_cents('stripe_connect', 10000);
```
**Expected:** 50 cents (25 percentage + 25 fixed)

**B. $1,000 payout**
```sql
SELECT calculate_payout_fee_cents('stripe_connect', 100000);
```
**Expected:** 275 cents (250 percentage + 25 fixed)

**C. $0.01 payout (edge case)**
```sql
SELECT calculate_payout_fee_cents('stripe_connect', 1);
```
**Expected:** 25 cents (0 percentage + 25 fixed)

**Status:** ☐ Pass  ☐ Fail  

---

### TC-004: Test calculate_payout_fee_cents for PayPal
**Objective:** Verify PayPal fee calculation (2% capped at $20)

**Test Cases:**

**A. $50 payout (no cap)**
```sql
SELECT calculate_payout_fee_cents('paypal', 5000);
```
**Expected:** 100 cents (2% of $50)

**B. $1,000 payout (hits cap)**
```sql
SELECT calculate_payout_fee_cents('paypal', 100000);
```
**Expected:** 2000 cents ($20 cap)

**C. $2,000 payout (exceeds cap)**
```sql
SELECT calculate_payout_fee_cents('paypal', 200000);
```
**Expected:** 2000 cents ($20 cap applied)

**Status:** ☐ Pass  ☐ Fail  

---

### TC-005: Test calculate_payout_fee_cents for Venmo
**Objective:** Verify Venmo fee calculation (2% capped at $20)

**Test Cases:**

**A. $50 payout**
```sql
SELECT calculate_payout_fee_cents('venmo', 5000);
```
**Expected:** 100 cents

**B. $2,000 payout (hits cap)**
```sql
SELECT calculate_payout_fee_cents('venmo', 200000);
```
**Expected:** 2000 cents

**Status:** ☐ Pass  ☐ Fail  

---

### TC-006: Test calculate_payout_fee_cents Edge Cases
**Objective:** Verify error handling and edge cases

**Test Cases:**

**A. Zero amount**
```sql
SELECT calculate_payout_fee_cents('stripe_connect', 0);
```
**Expected:** 0 cents

**B. Negative amount (should return 0)**
```sql
SELECT calculate_payout_fee_cents('paypal', -1000);
```
**Expected:** 0 cents

**C. Invalid method type**
```sql
SELECT calculate_payout_fee_cents('unknown_method', 10000);
```
**Expected:** 0 cents

**Status:** ☐ Pass  ☐ Fail  

---

### TC-007: Test compute_net_payout_cents
**Objective:** Verify net payout calculation

**Test Cases:**

**A. Normal case**
```sql
SELECT compute_net_payout_cents(10000, 0, 50);
```
**Expected:** 9950 cents ($100 - $0 - $0.50)

**B. Negative prevention**
```sql
SELECT compute_net_payout_cents(1000, 900, 200);
```
**Expected:** 0 cents (NOT -100)

**C. Zero fees**
```sql
SELECT compute_net_payout_cents(10000, 0, 0);
```
**Expected:** 10000 cents

**Status:** ☐ Pass  ☐ Fail  

---

## TEST SUITE 2: Admin UI - View Configuration

### TC-101: Access Payout Fees Page
**Objective:** Navigate to payout fees configuration page

**Steps:**
1. Log into admin portal
2. Navigate to `/payouts` URL
3. Wait for page to load

**Expected Results:**
- ✅ Page loads without errors
- ✅ "Payout Fee Configuration" heading visible
- ✅ Two columns: "Configuration" (left) and "Preview" (right)
- ✅ 7 configuration items displayed
- ✅ Fee calculator visible with test amount input

**Status:** ☐ Pass  ☐ Fail  

---

### TC-102: Verify Configuration Items Display
**Objective:** Check all fee configuration items are shown correctly

**Steps:**
1. On `/payouts` page
2. Scroll through "Configuration" section
3. Verify each item

**Expected Results (7 items):**
- ✅ `payout_fee_stripe_fixed_cents` - "Stripe Connect fixed fee in cents"
- ✅ `payout_fee_stripe_percentage` - "Stripe Connect percentage fee"
- ✅ `payout_fee_paypal_percentage` - "PayPal payout percentage fee"
- ✅ `payout_fee_paypal_cap_cents` - "PayPal payout fee cap in cents ($20)"
- ✅ `payout_fee_venmo_percentage` - "Venmo payout percentage fee"
- ✅ `payout_fee_venmo_cap_cents` - "Venmo payout fee cap in cents ($20)"
- ✅ `payout_fee_bank_ach_cents` - "Bank ACH payout fee in cents (Post-MVP)"

**Each item should have:**
- ✅ Description text
- ✅ Value type badge (integer/decimal)
- ✅ Input field with current value
- ✅ Save button (disabled)
- ✅ Reset button (disabled)

**Status:** ☐ Pass  ☐ Fail  

---

### TC-103: Test Fee Calculator - Default Amount
**Objective:** Verify fee calculator shows correct calculations

**Steps:**
1. On `/payouts` page
2. Locate "Fee Calculator" section
3. Verify default test amount is 10000 cents ($100)
4. Check calculations for all methods

**Expected Results:**

| Method | Fee Description | Gross | Fee | Net |
|--------|----------------|-------|-----|-----|
| Stripe Connect | 0.25% + $0.25 | $100.00 | -$0.50 | $99.50 |
| PayPal | 2% (max $20.00) | $100.00 | -$2.00 | $98.00 |
| Venmo | 2% (max $20.00) | $100.00 | -$2.00 | $98.00 |
| Bank ACH | $0.25 | $100.00 | -$0.25 | $99.75 |

**Status:** ☐ Pass  ☐ Fail  

---

### TC-104: Test Fee Calculator - Custom Amount
**Objective:** Verify calculator updates when test amount changes

**Steps:**
1. On `/payouts` page
2. In "Test Amount (cents)" field, enter: `200000` (= $2,000)
3. Press Tab or click outside field
4. Verify calculations update

**Expected Results:**

| Method | Fee | Net |
|--------|-----|-----|
| Stripe Connect | -$5.25 | $1,994.75 |
| PayPal | -$20.00 (capped) | $1,980.00 |
| Venmo | -$20.00 (capped) | $1,980.00 |
| Bank ACH | -$0.25 | $1,999.75 |

**Status:** ☐ Pass  ☐ Fail  

---

### TC-105: Verify RPC Config Display
**Objective:** Check current active configuration is shown

**Steps:**
1. Scroll to bottom of `/payouts` page
2. Locate "Current Active Configuration (RPC)" section

**Expected Results:**
- ✅ JSON object displayed with 7 properties
- ✅ Values match database config
- ✅ Format is readable (indented JSON)

**Status:** ☐ Pass  ☐ Fail  

---

## TEST SUITE 3: Admin UI - Edit Configuration

### TC-201: Edit Stripe Fixed Fee
**Objective:** Update Stripe fixed fee and verify it saves

**Steps:**
1. On `/payouts` page
2. Find `payout_fee_stripe_fixed_cents` item
3. Note current value (should be 25)
4. Change value to `50`
5. Observe "⚠️ Unsaved changes" warning appears
6. Click "Save" button
7. Wait for success message
8. Verify input field updates
9. Check fee calculator updates

**Expected Results:**
- ✅ Save button becomes enabled when value changes
- ✅ Success message: "✅ Saved payout_fee_stripe_fixed_cents"
- ✅ Input field shows new value: 50
- ✅ Calculator shows Stripe fee increased (now 0.25% + $0.50 = $0.75 for $100)
- ✅ No errors displayed

**Status:** ☐ Pass  ☐ Fail  

**Cleanup:** Reset to original value (25) and save

---

### TC-202: Edit PayPal Percentage Fee
**Objective:** Update PayPal percentage and verify cap still applies

**Steps:**
1. On `/payouts` page
2. Find `payout_fee_paypal_percentage` item
3. Change value from `2.0` to `3.0`
4. Click "Save"
5. In fee calculator, set test amount to `50000` ($500)
6. Verify PayPal fee is 3% of $500 = $15
7. Set test amount to `200000` ($2,000)
8. Verify PayPal fee is still capped at $20

**Expected Results:**
- ✅ Save succeeds
- ✅ For $500: fee shows $15 (3% applies)
- ✅ For $2,000: fee shows $20 (cap still applies)

**Status:** ☐ Pass  ☐ Fail  

**Cleanup:** Reset to 2.0 and save

---

### TC-203: Edit PayPal Fee Cap
**Objective:** Update PayPal cap and verify new cap applies

**Steps:**
1. On `/payouts` page
2. Find `payout_fee_paypal_cap_cents` item
3. Change value from `2000` to `1000` ($10 cap)
4. Click "Save"
5. In fee calculator, set test amount to `100000` ($1,000)
6. Verify PayPal fee is capped at $10 (not $20)

**Expected Results:**
- ✅ Save succeeds
- ✅ PayPal fee for $1,000 shows $10 (new cap)

**Status:** ☐ Pass  ☐ Fail  

**Cleanup:** Reset to 2000 and save

---

### TC-204: Test Reset Button
**Objective:** Verify Reset button reverts unsaved changes

**Steps:**
1. Find any config item (e.g., `payout_fee_stripe_percentage`)
2. Change value from `0.25` to `1.0`
3. Observe "⚠️ Unsaved changes" warning
4. Click "Reset" button (NOT Save)
5. Verify value reverts to original

**Expected Results:**
- ✅ Reset button becomes enabled when value changes
- ✅ Clicking Reset reverts value to `0.25`
- ✅ Unsaved changes warning disappears
- ✅ Save button becomes disabled again

**Status:** ☐ Pass  ☐ Fail  

---

### TC-205: Test Multiple Edits
**Objective:** Edit multiple configs and save each separately

**Steps:**
1. Edit `payout_fee_stripe_fixed_cents` to `30`
2. Click Save for that item
3. Edit `payout_fee_venmo_percentage` to `2.5`
4. Click Save for that item
5. Refresh page
6. Verify both changes persisted

**Expected Results:**
- ✅ Each save completes independently
- ✅ After refresh, both values show updated values
- ✅ Calculator reflects both changes

**Status:** ☐ Pass  ☐ Fail  

**Cleanup:** Reset both to original values

---

## TEST SUITE 4: Validation & Error Handling

### TC-301: Test Invalid Percentage Value
**Objective:** Verify validation rejects invalid percentage

**Steps:**
1. Edit `payout_fee_stripe_percentage` to `-1`
2. Click Save

**Expected Results:**
- ✅ Error message displayed: "❌ Percentage must be between 0 and 100"
- ✅ Value NOT saved
- ✅ Database unchanged

**Status:** ☐ Pass  ☐ Fail  

---

### TC-302: Test Invalid Cents Value
**Objective:** Verify validation rejects negative cents

**Steps:**
1. Edit `payout_fee_stripe_fixed_cents` to `-50`
2. Click Save

**Expected Results:**
- ✅ Error message displayed: "❌ Cents must be a non-negative integer"
- ✅ Value NOT saved

**Status:** ☐ Pass  ☐ Fail  

---

### TC-303: Test Percentage Over 100
**Objective:** Verify validation rejects percentage > 100

**Steps:**
1. Edit `payout_fee_paypal_percentage` to `150`
2. Click Save

**Expected Results:**
- ✅ Error message displayed: "❌ Percentage must be between 0 and 100"
- ✅ Value NOT saved

**Status:** ☐ Pass  ☐ Fail  

---

### TC-304: Test Empty Value
**Objective:** Verify validation rejects empty input

**Steps:**
1. Edit any config item
2. Clear the input field (make it empty)
3. Click Save

**Expected Results:**
- ✅ Error message displayed
- ✅ Value NOT saved
- ✅ Original value remains

**Status:** ☐ Pass  ☐ Fail  

---

## TEST SUITE 5: Integration with Database

### TC-401: Verify Database Reflects UI Changes
**Objective:** Confirm UI edits update database correctly

**Steps:**
1. In UI, change `payout_fee_stripe_fixed_cents` to `35`
2. Click Save
3. Wait for success message
4. Open Supabase SQL Editor
5. Run query:
```sql
SELECT value FROM admin_config WHERE key = 'payout_fee_stripe_fixed_cents';
```

**Expected Results:**
- ✅ Query returns `35`

**Status:** ☐ Pass  ☐ Fail  

**Cleanup:** Reset to 25

---

### TC-402: Verify RPC Reflects Changes Immediately
**Objective:** Confirm RPC functions use updated config

**Steps:**
1. In UI, change `payout_fee_paypal_percentage` to `2.5`
2. Save
3. In Supabase SQL Editor, run:
```sql
SELECT * FROM get_payout_fee_config();
```
4. Verify `paypal_percentage` column shows `2.5`
5. Run:
```sql
SELECT calculate_payout_fee_cents('paypal', 10000);
```
6. Verify result is 250 cents (2.5% of $100)

**Expected Results:**
- ✅ RPC reflects change immediately
- ✅ Fee calculation uses new percentage

**Status:** ☐ Pass  ☐ Fail  

**Cleanup:** Reset to 2.0

---

## TEST SUITE 6: Cross-Browser & Responsive

### TC-501: Test on Different Browsers
**Objective:** Verify functionality across browsers

**Browsers to test:**
- ☐ Chrome
- ☐ Firefox
- ☐ Safari
- ☐ Edge

**For each browser:**
1. Navigate to `/payouts`
2. Verify page loads correctly
3. Edit one config item and save
4. Verify calculator updates

**Status:** ☐ Pass  ☐ Fail  

---

### TC-502: Test Responsive Layout
**Objective:** Verify UI works on different screen sizes

**Steps:**
1. On `/payouts` page
2. Resize browser window to mobile width (~375px)
3. Verify layout adapts
4. Test editing and saving on mobile view

**Expected Results:**
- ✅ Two-column layout stacks to single column on mobile
- ✅ All inputs and buttons remain accessible
- ✅ Save and reset functionality works

**Status:** ☐ Pass  ☐ Fail  

---

## ACCEPTANCE CRITERIA CHECKLIST

**From MODULE-06-VERIFICATION-V2.md:**

### B. HELPERS & BUSINESS LOGIC (PAY-002)

- ☐ `p2p-kids-admin/src/lib/payoutFees.ts` implemented and unit-tested
- ☐ `getPayoutFeeCents(methodType, amountCents)` returns expected fees
- ☐ `computeNetPayoutCents` never returns negative
- ☐ Tests: `p2p-kids-admin/src/lib/payoutFees.test.ts` passing in CI

**Additional Acceptance Criteria (Task PAY-002):**

- ☐ Dynamic admin config created for all payout fee types
- ☐ Admin UI page allows viewing and editing payout fees
- ☐ Fee calculator provides real-time preview
- ☐ Input validation prevents invalid values
- ☐ Changes persist to database immediately
- ☐ RPC functions reflect updated configuration
- ☐ All unit tests pass
- ☐ All E2E tests pass

---

## NOTES & OBSERVATIONS

**Issues Found:**

---

**Recommendations:**

---

**Sign-Off:**

- [ ] All tests passed
- [ ] All issues resolved
- [ ] Ready for production use

**Tester Signature:** _______________  
**Date:** _______________
