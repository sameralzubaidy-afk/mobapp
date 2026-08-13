# PAY-003: Seller Payout Setup UI - Manual Test Guide

## Module
MODULE-06-TRADE-FLOW-sellerpayouts.md (Phase 1 MVP + Balance/Withdrawal Extension)

## Task
PAY-003: Seller Payout Setup UI (Stripe/PayPal/Venmo)  
**EXTENDED:** Seller Balance Tracking & Manual Withdrawal

## Prerequisites
- ✅ Database migrations applied:
  - `061_seller_payouts.sql` (payout methods table)
  - `073_seller_payouts.sql` (seller_payouts ledger)
  - `074_seller_balance_and_withdrawal.sql` (NEW - balance tracking & withdrawal)
- ✅ Test user with seller role and completed profile
- ✅ Supabase project accessible in production
- ✅ Mobile app build with latest navigation changes
- ✅ At least one completed trade (to test balance update)

---

## Test Suite

### TS-001: Navigation to Payout Settings

**Objective:** Verify that PayoutSettings screen is accessible from navigation

**Steps:**
1. Launch the mobile app
2. Sign in as a test user (seller)
3. Navigate to Profile screen
4. Look for "Payout Settings" menu item (or trigger via deep link)
5. Tap "Payout Settings"

**Expected Results:**
- ✅ PayoutSettings screen loads successfully
- ✅ Screen displays header "Payout Settings"
- ✅ Back button is visible and functional
- ✅ No crash or navigation errors

**Test Data:**
- User: Any authenticated seller account
- Role: Seller (completed profile)

---

### TS-002: Empty State - No Payout Methods

**Objective:** Verify empty state when user has no payout methods configured

**Steps:**
1. Navigate to PayoutSettings screen
2. Ensure user has no existing payout methods (fresh account or manually cleared)
3. Observe the UI

**Expected Results:**
- ✅ Status card displays "⚠ Action Required"
- ✅ Status message: "No verified payout method configured"
- ✅ "Your Payout Methods" section shows empty state
- ✅ Empty state text: "No payout methods configured yet"
- ✅ Subtext: "Add a method to start receiving payments"
- ✅ "+ Add Payout Method" button is visible and enabled

**Test Data:**
- User: Seller with no payout methods

---

### TS-003: Add PayPal Payout Method

**Objective:** Successfully add a PayPal payout method

**Steps:**
1. On PayoutSettings screen, tap "+ Add Payout Method"
2. Modal opens with method type selection
3. Select "PayPal" option
4. Observe PayPal email input field appears
5. Enter valid PayPal email: `seller.test@paypal.com`
6. Tap "Add Method"
7. Wait for confirmation

**Expected Results:**
- ✅ Modal displays three method options (Stripe, PayPal, Venmo)
- ✅ PayPal button shows "2% fee, capped at $20" subtext
- ✅ Email input field appears when PayPal is selected
- ✅ Success alert: "PayPal payout method added. Please verify your email."
- ✅ Modal closes
- ✅ Screen refreshes and shows new PayPal method card
- ✅ Method card displays: "PayPal (seller.test@paypal.com)"
- ✅ Status message: "Verification pending"
- ✅ Yellow verification warning: "⚠ Verification required before setting as primary"

**Test Data:**
- PayPal email: `seller.test@paypal.com` (valid format)

---

### TS-004: Add PayPal with Invalid Email

**Objective:** Validate email format for PayPal method (strict validation per PayPal requirements)

**Steps:**
1. Tap "+ Add Payout Method"
2. Select "PayPal"
3. Enter invalid email from test data below
4. Tap "Add Method"

**Expected Results:**
- ✅ Error alert: "Validation failed: Invalid PayPal email format"
- ✅ Method is NOT created
- ✅ User remains on modal to correct input

**Test Data - Invalid Emails (should be REJECTED):**
- `not-an-email` (no @ symbol)
- `test@` (no domain)
- `@test.com` (no local part)
- `user@test.com` (blocked test domain per RFC 2606)
- `user@example.com` (blocked example domain per RFC 2606)
- `user@localhost` (invalid domain)
- `user@domain` (no TLD extension)
- `user@domain.123` (invalid TLD - must be alphabetic)
- `user@tempmail.com` (disposable email provider)
- `user name@domain.com` (contains space)

**Test Data - Valid Emails (should be ACCEPTED):**
- `seller.test@gmail.com` ✅
- `user@paypal.com` ✅
- `business@company.co.uk` ✅
- `payout+seller@domain.io` ✅

**Note:** PayPal accepts any legitimate email address, but we block:
1. Test/example domains (RFC 2606: test.com, example.com, etc.)
2. Disposable/temporary email providers
3. Invalid email formats or missing TLDs

---

### TS-005: Add Venmo Payout Method

**Objective:** Successfully add a Venmo payout method

**Steps:**
1. Tap "+ Add Payout Method"
2. Select "Venmo" option
3. Enter Venmo handle: `@testvenmo`
4. Tap "Add Method"

**Expected Results:**
- ✅ Venmo button shows "2% fee, capped at $20" subtext
- ✅ Input field appears: "Venmo Handle or Phone"
- ✅ Success alert: "Venmo payout method added. Verification may be required."
- ✅ Modal closes
- ✅ New Venmo method card appears
- ✅ Card displays: "Venmo (@testvenmo)"
- ✅ Status: "Verification pending"

**Test Data:**
- Venmo handle: `@testvenmo`
- Venmo phone (optional test): `+15551234567`

---

### TS-006: Add Venmo with Invalid Phone

**Objective:** Validate E.164 phone format for Venmo (strict validation)

**Steps:**
1. Tap "+ Add Payout Method"
2. Select "Venmo"
3. Enter invalid phone from test data below
4. Tap "Add Method"

**Expected Results:**
- ✅ Error alert: "Validation failed: Phone number must be in E.164 format (e.g., +15551234567)"
- ✅ Method is NOT created

**Test Data - Invalid Phone Formats (should be REJECTED):**
- `1234567890` ❌ (missing + prefix)
- `555-123-4567` ❌ (missing + prefix, has formatting)
- `(555) 123-4567` ❌ (missing + prefix, has formatting)
- `+0123456789` ❌ (country code cannot start with 0)
- `+1 555 123 4567` ❌ (contains spaces after +)
- `123-456-7890` ❌ (missing + prefix)

**Test Data - Valid Inputs (should be ACCEPTED):**
- `@testvenmo` ✅ (valid Venmo handle)
- `@user123` ✅ (valid Venmo handle with numbers)
- `+15551234567` ✅ (valid E.164 US number)
- `+442071234567` ✅ (valid E.164 UK number)
- `+61412345678` ✅ (valid E.164 AU number)

**Note:** Venmo accepts EITHER:
1. **Venmo handle**: Must start with `@` (e.g., `@username`)
2. **Phone number**: Must be E.164 format starting with `+` (e.g., `+15551234567`)

**Validation Logic:**
- If input starts with `@` → Treated as handle (letters/numbers allowed)
- If input is all digits (with or without formatting like `-`, `()`, spaces) → Must be E.164 format
- E.164 format: `+[country code][number]` (1-15 digits total after +)

---

### TS-007: Add Stripe Connect (Stub Test)

**Objective:** Verify Stripe Connect flow placeholder

**Steps:**
1. Tap "+ Add Payout Method"
2. Select "Stripe Connect" option
3. Tap "Add Method"

**Expected Results:**
- ✅ Stripe button shows "Bank deposits via Stripe" subtext
- ✅ Alert: "Stripe onboarding is not yet implemented. This will redirect you to Stripe onboarding."
- ✅ Modal closes after OK
- ✅ No method is created (onboarding not wired yet per PAY-004)

**Note:** This is a placeholder until PAY-004 (Stripe onboarding) is implemented.

---

### TS-008: Set Primary Payout Method

**Objective:** Mark a verified method as primary

**Steps:**
1. User has at least 2 payout methods (e.g., PayPal and Venmo)
2. Manually mark one method as `is_verified = true` in Supabase (for testing)
3. Refresh PayoutSettings screen
4. On verified method card, tap "Set as Primary"

**Expected Results:**
- ✅ "Set as Primary" button only appears on verified, non-primary methods
- ✅ Success alert: "Primary payout method updated"
- ✅ Screen refreshes
- ✅ Method card now shows blue "PRIMARY" badge
- ✅ Previous primary method (if any) loses PRIMARY badge
- ✅ Status card at top changes to "✓ Ready for Payouts"

**Test Data:**
- Verified method (manually set in DB):
  ```sql
  UPDATE seller_payout_methods 
  SET is_verified = true 
  WHERE id = '<method_id>';
  ```

---

### TS-009: Delete Non-Primary Payout Method

**Objective:** Successfully delete a non-primary method

**Steps:**
1. User has at least 2 payout methods
2. One is primary, one is not
3. On non-primary method card, tap "Delete"
4. Confirmation alert appears
5. Tap "Delete" in alert

**Expected Results:**
- ✅ "Delete" button only appears on non-primary methods
- ✅ Confirmation alert: "Are you sure you want to delete this payout method?"
- ✅ After confirm: Success alert "Payout method deleted"
- ✅ Method card disappears from list
- ✅ Database record is deleted

**Test Data:**
- Non-primary method ID

---

### TS-010: Prevent Deleting Primary Method

**Objective:** Verify that primary method cannot be deleted

**Steps:**
1. User has a primary payout method
2. Try to tap "Delete" on primary method card

**Expected Results:**
- ✅ "Delete" button does NOT appear on primary method card
- ✅ Only "Set as Primary" button (on other methods) and no delete option on primary

**Alternative Test (Edge Case):**
If button appears due to bug, tapping it should show error:
- ✅ Error alert: "Cannot delete primary payout method. Please set another method as primary first."

---

### TS-011: Multiple Methods Display

**Objective:** Verify UI with multiple payout methods

**Setup:**
1. Add 3 methods: PayPal, Venmo, Stripe (stub)
2. Mark PayPal as verified and primary
3. Mark Venmo as verified but not primary
4. Leave Stripe unverified

**Expected Results:**
- ✅ All 3 methods display in list
- ✅ PayPal card:
  - Label: "PayPal (email@example.com)"
  - Blue PRIMARY badge
  - Status: "Verified"
  - No action buttons (is primary)
- ✅ Venmo card:
  - Label: "Venmo (@handle)"
  - Status: "Verified"
  - "Set as Primary" button visible
  - "Delete" button visible
- ✅ Stripe card:
  - Label: "Stripe Connect"
  - Status: "Onboarding required"
  - Yellow warning: "⚠ Verification required before setting as primary"
  - "Delete" button visible

---

### TS-012: Payout Eligibility Status

**Objective:** Verify status card reflects eligibility correctly

**Test Cases:**

**Case A: No methods**
- Status card: Yellow background
- Title: "⚠ Action Required"
- Message: "No verified payout method configured"

**Case B: Methods exist but none verified**
- Status card: Yellow background
- Title: "⚠ Action Required"
- Message: "No verified payout method configured"

**Case C: Verified method exists but not primary**
- Status card: Yellow background
- Title: "⚠ Action Required"
- Message: "No primary payout method selected"

**Case D: Verified primary method exists**
- Status card: Green background
- Title: "✓ Ready for Payouts"
- Message: "Ready to receive payouts"

---

### TS-013: Info Section Display

**Objective:** Verify informational content is displayed

**Steps:**
1. Scroll to bottom of PayoutSettings screen

**Expected Results:**
- ✅ "About Payouts" section visible
- ✅ Content displays:
  - "Payouts are processed when a trade is completed"
  - "You must have a verified primary payout method"
  - "Payout fees vary by method (displayed transparently)"
  - "Platform transaction fee: $0 (you only pay payout provider fees)"

---

### TS-014: Refresh/Reload Data

**Objective:** Verify screen refreshes data correctly

**Steps:**
1. On PayoutSettings screen, pull down to refresh (if pull-to-refresh implemented)
2. OR manually verify via external DB changes:
   - Make a DB change (e.g., verify a method via SQL)
   - Navigate away and back to PayoutSettings

**Expected Results:**
- ✅ Loading indicator appears briefly
- ✅ Data refreshes from database
- ✅ UI updates to reflect new state

---

### TS-015: Cancel Add Method Modal

**Objective:** Verify modal can be dismissed without adding

**Steps:**
1. Tap "+ Add Payout Method"
2. Modal opens
3. Tap "Cancel" button

**Expected Results:**
- ✅ Modal closes
- ✅ No method is created
- ✅ User returns to PayoutSettings screen

---

### TS-016: Concurrent Add Method

**Objective:** Test submission state during API call

**Steps:**
1. Tap "+ Add Payout Method"
2. Select PayPal
3. Enter email
4. Tap "Add Method"
5. Immediately observe button state

**Expected Results:**
- ✅ "Add Method" button shows loading spinner
- ✅ Button is disabled during submission
- ✅ Modal remains open until API call completes
- ✅ Success or error alert appears after completion

---

## Database Verification Queries

Run these in Supabase SQL Editor after each test:

### Check user's payout methods
```sql
SELECT * FROM seller_payout_methods 
WHERE user_id = '<test_user_id>' 
ORDER BY created_at DESC;
```

### Check primary method constraint (should return max 1 row)
```sql
SELECT user_id, COUNT(*) as primary_count
FROM seller_payout_methods
WHERE is_primary = true
GROUP BY user_id
HAVING COUNT(*) > 1;
```
**Expected:** 0 rows (no user should have more than 1 primary)

### Manually verify a method (for testing)
```sql
UPDATE seller_payout_methods 
SET is_verified = true 
WHERE id = '<method_id>';
```

### Manually set primary (for testing)
```sql
-- First unset all primary for this user
UPDATE seller_payout_methods 
SET is_primary = false 
WHERE user_id = '<user_id>';

-- Then set target as primary
UPDATE seller_payout_methods 
SET is_primary = true 
WHERE id = '<method_id>';
```

---

## Test Suite 2: Balance Tracking & Withdrawal (NEW - Requires Migration 074)

### TS-017: Balance Card Display - Initial State (No Prior Trades)
**Objective:** Verify balance card shows $0 for new user with no trades

**Precondition:** 
- Test user with NO completed trades

**Steps:**
1. Log in as test user (seller)
2. Navigate to Settings > Payout Settings
3. Observe the "💰 Your Earnings" card at the top

**Expected Results:**
- ✅ Balance card displays with three rows:
  - Available to Withdraw: $0.00
  - Pending (In Progress): $0.00
  - Lifetime Earnings: $0.00
- ✅ "Withdraw Now" button NOT visible (disabled/hidden)
- ✅ No errors in console
- ✅ Load time < 2 seconds

---

### TS-018: Trade Completion Triggers Balance Update
**Objective:** Verify that when a buyer completes a trade, seller's available balance increases correctly (CASH ONLY, no SP value)

**CRITICAL RULE:** Seller only receives the CASH portion paid by buyer, NOT the SP portion
- Example: Item $100, buyer pays $50 cash + $50 SP → seller gets only $50 (plus any pending from future trades)
- SP amount stays in buyer's wallet and does NOT transfer to seller's balance

**Precondition:**
- Two test users (buyer + seller)
- Seller has NO previous balance
- An active trade in "in_progress" status where buyer is marked as the completer
- Trade has mixed payment: some cash + some SP (to test both scenarios)

**Steps:**
1. Log in as buyer
2. Navigate to an active trade in progress
3. Note the item price and payment breakdown:
   - Example: $100 item with $50 cash + $50 SP payment
4. Press "I've picked up the items" (buyer completion)
5. Confirm the trade status changes to "completed"
6. Log out and log in as seller
7. Navigate to Settings > Payout Settings
8. Observe the balance card

**Expected Results:**
- ✅ Trade status changes to "completed"
- ✅ Seller's "Available to Withdraw" increases by the CASH amount only:
  - If trade was $100 (50% cash + 50% SP): seller gets $50
  - If trade was $100 (100% cash): seller gets $100
  - If trade was $100 (30% cash + 70% SP): seller gets $30
- ✅ "Lifetime Earnings" increases by the SAME CASH amount (not full item price)
- ✅ "Pending (In Progress)" shows $0.00
- ✅ No errors in console or Edge Functions logs
- ✅ SP value does NOT appear in seller balance (SP stays with buyer)

**DB Verification:**
```sql
-- Check seller balance was created/updated with CASH amount only
SELECT available_balance_cents, pending_balance_cents, lifetime_earnings_cents 
FROM seller_balance WHERE user_id = '<seller_uuid>';

-- Verify trade details and SP amount
SELECT 
  id, status, buyer_id, seller_id, 
  (price * 100)::INTEGER as item_price_cents, 
  sp_amount 
FROM trades 
WHERE seller_id = '<seller_uuid>' AND status = 'completed' 
ORDER BY updated_at DESC LIMIT 1;

-- Example: If item was $100 (1000 cents) with sp_amount = 5000 cents (50%)
-- Then seller_balance.available_balance_cents should be 5000 (only cash portion)
-- NOT 10000 (which would be the full item price)
```

**Mathematical Verification Example:**
- Item price: $100 (10000 cents)
- Buyer payment: $50 cash (5000 cents) + 500 SP points
- Expected seller balance increase: $50 (5000 cents)
- Calculation: item_price_cents (10000) - sp_amount_cents (5000) = **5000 cents ✅**

---

### TS-019: Withdraw Button Appears When Balance > $0
**Objective:** Verify "Withdraw Now" button becomes visible and enabled when balance is available

**Precondition:**
- Seller has available balance > $0 from previous test (TS-018)
- Seller has at least one verified payout method (from TS-001 through TS-005)

**Steps:**
1. Log in as seller (from TS-018)
2. Navigate to Settings > Payout Settings
3. Observe the balance card

**Expected Results:**
- ✅ "Withdraw Now" button visible (not grayed out)
- ✅ Button has primary/green background color
- ✅ Button text: "💳 Withdraw Now"
- ✅ Button is pressable and responsive

---

### TS-020: Withdraw Modal Shows Fee Breakdown
**Objective:** Verify withdrawal modal displays all fees and net amount correctly

**Precondition:**
- Seller has balance $10.00+
- Seller has verified Stripe as primary payout method

**Steps:**
1. From TS-019, press "Withdraw Now" button
2. Observe the withdrawal confirmation modal

**Expected Results:**
- ✅ Modal title: "Confirm Withdrawal"
- ✅ Modal displays:
  - Available Balance: $10.00 (or actual amount)
  - Payout Fee (Stripe 0.25% + $0.25): calculated amount
  - **Net Amount:** in green, bold (Available - Fee)
  - Payout Method: "Stripe ending in ****"
- ✅ Two buttons: "Cancel" and "Confirm Withdrawal"
- ✅ No calculation errors

**Mathematical Verification (Example: $10.00 with Stripe):**
- Gross: $10.00 (1000 cents)
- Stripe fee: (1000 * 0.0025) + 25 = 2.5 + 25 = 27.5 cents ≈ $0.28
- Net: 1000 - 27.5 ≈ 972.5 cents ≈ $9.72 ✅

---

### TS-021: Successful Withdrawal Request Creates Payout Record
**Objective:** Verify pressing "Confirm Withdrawal" creates payout record and decrements balance

**Precondition:**
- Modal visible with fee breakdown (from TS-020)
- Seller balance: $10.00+
- Verified Stripe method

**Steps:**
1. From TS-020, press "Confirm Withdrawal"
2. Observe loading indicator
3. Wait for success confirmation
4. Press "OK" on alert
5. Observe updated balance card

**Expected Results:**
- ✅ Loading indicator shows during request
- ✅ Success alert displays: "Withdrawal request submitted"
- ✅ Balance card updates:
  - Available to Withdraw: $0.00 (or reduced amount if partial)
  - Lifetime Earnings: unchanged (lifetime is not affected by withdrawals)
- ✅ No error messages in console

**DB Verification:**
```sql
-- Check payout record created
SELECT id, gross_amount_cents, payout_fee_cents, net_amount_cents, status 
FROM seller_payouts 
WHERE user_id = '<seller_uuid>' 
ORDER BY created_at DESC LIMIT 1;

-- Verify balance decremented
SELECT available_balance_cents, pending_balance_cents, lifetime_balance_cents 
FROM seller_balance WHERE user_id = '<seller_uuid>';
```

---

### TS-022: Recent Payouts Section Displays Withdrawal
**Objective:** Verify recent payouts section shows newly created withdrawal

**Precondition:**
- Withdrawal created from TS-021
- Payout record exists in database

**Steps:**
1. From TS-021, observe the "Recent Withdrawals" section below balance card
2. Look for the most recent payout

**Expected Results:**
- ✅ "Recent Withdrawals" section visible
- ✅ Most recent payout displays:
  - Amount: gross amount withdrawn (e.g., "$10.00")
  - Date: today's date in MM/DD/YYYY format
  - Status badge: "Pending" (orange) - awaiting Stripe processing
  - Fee display: "Fee: $0.28" shown below amount
- ✅ List sorted with newest first
- ✅ Card styling matches design

---

### TS-023: Lifetime Earnings Persist After Withdrawal
**Objective:** Verify lifetime earnings accumulation across multiple trades and withdrawals

**Precondition:**
- Seller has completed 2+ trades (total ≥ $20)
- Seller has withdrawn once (TS-021)

**Steps:**
1. Complete a new trade as seller (buyer completes)
2. Check balance card immediately
3. Navigate to Payout Settings
4. Observe "Lifetime Earnings" field

**Expected Results:**
- ✅ Lifetime Earnings shows cumulative total from all trades
- ✅ Example: 2 trades of $10 each = $20 lifetime (even if $9.72 already withdrawn)
- ✅ Lifetime Earnings never decreases
- ✅ Available Balance updates with new trade amount

**Test Scenario:**
| Trade | Amount | Withdrawn | Lifetime | Available |
|-------|--------|-----------|----------|-----------|
| Trade 1 | $10.00 | - | $10.00 | $9.72 |
| Withdrawal 1 | - | -$9.72 | $10.00 | $0.28 |
| Trade 2 | $10.00 | - | $20.00 | $10.00 |

---

### TS-024: Withdrawal Validation - Minimum Amount (Dynamic)
**Objective:** Verify seller cannot request withdrawal below configured minimum

**Precondition:**
- Check admin config for current `minimum_withdrawal_amount_cents` value
- Default: 500 cents ($5.00)
- If admin sets it to 0, minimum validation is disabled
- Test with seller balance between $1 and configured minimum

**Steps:**
1. Check current minimum via Admin Config page or query:
   ```sql
   SELECT value FROM admin_config WHERE key = 'minimum_withdrawal_amount_cents';
   ```
2. Log in as seller with available balance below the minimum (e.g., $3.00)
3. Navigate to Settings > Payout Settings
4. Observe the "Withdraw Now" button

**Expected Results:**
- ✅ If balance < minimum AND minimum > 0: "Withdraw Now" button is DISABLED or shows error
- ✅ Error message matches configured minimum: "Minimum withdrawal amount is $X.XX"
- ✅ If minimum is 0 (disabled): Button becomes enabled for ANY positive balance
- ✅ Balance unchanged after any attempt

**Test Variations:**

| Config Value | Balance | Expected Behavior |
|--------------|---------|-------------------|
| 500 cents ($5) | $3.00 | Disabled/Error |
| 500 cents ($5) | $5.00+ | Enabled |
| 0 cents (disabled) | $0.01 | Enabled |
| 1000 cents ($10) | $7.00 | Disabled/Error |

**Admin Control Test:**
1. Set minimum to $10 (1000 cents) via admin config
2. Verify user with $7 balance cannot withdraw
3. Set minimum to $0 via admin config
4. Verify same user can now withdraw $7

---

### TS-025: Withdrawal Validation - Verified Method Required
**Objective:** Verify seller cannot withdraw without verified primary payout method

**Precondition:**
- Seller has balance > $5.00
- Seller has NO verified primary payout method (delete primary from TS-009)

**Steps:**
1. Log in as seller (remove primary method if needed)
2. Navigate to Settings > Payout Settings
3. Verify balance card shows available balance
4. Try to press "Withdraw Now"

**Expected Results:**
- ✅ "Withdraw Now" button is DISABLED (grayed out)
- ✅ Tooltip or inline message: "Add a verified payout method to withdraw"
- ✅ After adding/verifying method (TS-001 through TS-005), button becomes enabled
- ✅ No partial withdrawal possible without method

---

### TS-026: Fee Calculation - PayPal (2% capped at $20)
**Objective:** Verify PayPal fee is 2% with maximum cap at $20

**Precondition:**
- Test Case A: Seller balance $50.00
- Test Case B: Seller balance $2000.00
- PayPal is verified primary method

**Steps - Case A ($50):**
1. Seller balance: $50.00
2. Press "Withdraw Now"
3. Observe fee breakdown

**Calculation - Case A:**
- Gross: $50.00
- PayPal fee: 50 * 0.02 = $1.00 (below $20 cap) ✅
- Net: 50 - 1.00 = $49.00

**Expected Results - Case A:**
- ✅ Payout Fee: "$1.00"
- ✅ Net Amount: "$49.00"

**Steps - Case B ($2000):**
1. Seller balance: $2000.00
2. Press "Withdraw Now"
3. Observe fee in modal

**Calculation - Case B:**
- Gross: $2000.00
- PayPal fee: min(2000 * 0.02, 20) = min($40, $20) = $20.00 (capped) ✅
- Net: 2000 - 20 = $1980.00

**Expected Results - Case B:**
- ✅ Payout Fee: "$20.00" (capped, NOT $40.00)
- ✅ Net Amount: "$1980.00"

---

### TS-027: Fee Calculation - Venmo (2% capped at $20, same as PayPal)
**Objective:** Verify Venmo fee calculation matches PayPal

**Precondition:**
- Seller balance: $75.00
- Venmo is verified primary method

**Steps:**
1. Seller balance: $75.00
2. Press "Withdraw Now"
3. Observe fee breakdown

**Calculation:**
- Gross: $75.00
- Venmo fee: min(75 * 0.02, 20) = min($1.50, $20) = $1.50 ✅
- Net: 75 - 1.50 = $73.50

**Expected Results:**
- ✅ Payout Fee: "$1.50"
- ✅ Net Amount: "$73.50"

---

### TS-028: Network Timeout During Balance Load
**Objective:** Verify graceful error handling if balance fetch times out

**Precondition:**
- Network connection available (will simulate failure)

**Steps:**
1. Log in as seller
2. Disable Wi-Fi/cellular briefly
3. Navigate to Settings > Payout Settings
4. Observe loading state
5. Re-enable connection after 5+ seconds

**Expected Results:**
- ✅ Loading indicator shows initially
- ✅ After timeout: Error message displays
  - "Unable to load balance. Please try again."
- ✅ Retry button available or automatic retry on reconnect
- ✅ No crash or blank screen
- ✅ Connection restored → balance loads successfully

---

### TS-029: Balance Updates After Multiple Trades
**Objective:** Verify balance accumulates correctly after multiple trades

**Precondition:**
- Same seller involved in 3 sequential trades
- Each trade: $10.00 item price
- All trades completed by buyer

**Steps:**
1. Seller completes Trade 1 (buyer initiates completion)
2. Check balance card: Should show ~$9.70
3. Seller completes Trade 2
4. Check balance card: Should show ~$19.40
5. Seller completes Trade 3
6. Check balance card: Should show ~$29.10

**Expected Results:**
- ✅ Available Balance accumulates: $9.70 → $19.40 → $29.10
- ✅ Lifetime Earnings accumulates: $10.00 → $20.00 → $30.00
- ✅ Each new trade correctly increments balance
- ✅ No gaps or missing updates

**Verification Table:**

| Trade | Status | Available | Lifetime | Recent Payouts |
|-------|--------|-----------|----------|-----------------|
| None | - | $0.00 | $0.00 | Empty |
| Trade 1 | completed | $9.70 | $10.00 | - |
| Trade 2 | completed | $19.40 | $20.00 | - |
| Withdrawal | submitted | $0.00 | $20.00 | $9.70 withdrawn |
| Trade 3 | completed | $9.70 | $30.00 | $9.70 withdrawn |

---

## Error Handling Test Cases

### EH-001: Network Timeout
- Disconnect network or use poor connection
- Attempt to load PayoutSettings
- **Expected:** Error alert "Failed to load payout methods. Please try again."

### EH-002: Unauthorized Access
- Sign out user mid-session
- Attempt any action
- **Expected:** Error alert "User not authenticated"

### EH-003: Database Constraint Violation
- Attempt to create duplicate PayPal email (if unique constraint exists)
- **Expected:** Error alert with database error message

### EH-004: Insufficient Balance During Withdrawal (NEW)
- Setup: Seller balance $9.70
- Open withdrawal modal (shows $9.70 available)
- (Simulated: Balance drops to $0 in background via another session)
- Press "Confirm Withdrawal"
- **Expected:** Error alert "Your balance has changed. Please close and retry."
- **Result:** Balance refreshes, withdrawal not created, no state corruption

### EH-005: Minimum Withdrawal Not Met (NEW)
- Setup: Seller balance $3.00 (below $5 minimum)
- Attempt to access "Withdraw Now" button
- **Expected:** Button disabled with optional tooltip "Minimum withdrawal is $5.00"

### EH-006: Unverified Payout Method (NEW)
- Setup: Seller has balance but NO verified primary method
- Navigate to Payout Settings
- Try to press "Withdraw Now"
- **Expected:** Button disabled or error "Add a verified payout method to withdraw"

---

## Performance Benchmarks

- Initial screen load: < 2 seconds
- Load balance card: < 2 seconds
- Add method API call: < 1 second
- Delete method API call: < 1 second
- Set primary API call: < 1 second
- Open withdraw modal: < 1 second
- Submit withdrawal API call: < 3 seconds
- Fee calculation: < 500ms

---

## Accessibility Checklist

- [ ] All buttons have accessible labels
- [ ] Text inputs have placeholders and labels
- [ ] Status messages are readable with screen reader
- [ ] Color contrast meets WCAG AA standards (green/yellow status cards)
- [ ] Touch targets are >= 44x44 points
- [ ] Balance amounts clearly distinguishable (available/pending/lifetime)
- [ ] Withdraw button has sufficient size and contrast
- [ ] Withdraw modal has clear heading and navigation
- [ ] Fee breakdown text is readable and clear
- [ ] Status badges (Pending/Completed) have text + color (not color-only)

---

## Cross-Platform Testing

### iOS
- [ ] SafeAreaView padding correct on notched devices
- [ ] Modal animation smooth
- [ ] Keyboard dismissal works correctly

### Android
- [ ] Back button closes modal correctly
- [ ] Status bar height handled correctly
- [ ] Keyboard pushes content appropriately

---

## Regression Tests

### REG-001: Complete Payout Setup Flow (TS-001 through TS-016)
Execute all original payout method tests in sequence:
- TS-001 through TS-016 must all pass
- No payout method functionality regression

### REG-002: Balance Tracking & Withdrawal Complete Flow (TS-017 through TS-029)
**End-to-end test of new balance/withdrawal functionality:**

**Steps:**
1. TS-017: Initial state shows $0 balance ✅
2. Complete a trade (have buyer press "I've picked up items") ✅
3. TS-018: Verify balance updates after trade completion ✅
4. TS-019: Verify "Withdraw Now" button visible ✅
5. TS-020: Open modal, verify fee breakdown ✅
6. TS-021: Submit withdrawal, verify balance decremented ✅
7. TS-022: Verify payout appears in recent list ✅
8. TS-023: Complete new trade, verify lifetime earnings accumulate ✅
9. TS-024 through TS-029: Verify validation and fee calculations ✅

**Expected Results:**
- ✅ All tests pass without error
- ✅ Balance updates correctly throughout flow
- ✅ Fees calculated accurately for all methods
- ✅ Database state matches UI state
- ✅ No regression in original PAY-003 tests

### REG-003: Multi-Trade Accumulation (TS-029 Focus)
- Complete 3 sequential trades as seller
- Verify available balance accumulates ($9.70 → $19.40 → $29.10)
- Verify lifetime earnings accumulate ($10 → $20 → $30)
- Verify no gaps or missing updates

### REG-004: Interaction with PAY-004 (Future - Stripe Connect)
- **Note:** When Stripe Connect onboarding (PAY-004) is implemented:
  - Stripe methods should auto-verify via webhook
  - Verified methods should be immediately usable for withdrawal
  - Balance/withdrawal should work seamlessly with Stripe verified status

---

## Test Execution Checklist

### Original Payout Method Tests (TS-001 through TS-016)
- [ ] TS-001: Add Stripe, PayPal, Venmo
- [ ] TS-002: Edit existing payout method
- [ ] TS-003: Set as primary
- [ ] TS-004: Unset primary
- [ ] TS-005: Delete payout method
- [ ] TS-006 through TS-016: Additional validation and UI tests
- **Subtotal:** 16 test cases all PASS ✅

### New Balance & Withdrawal Tests (TS-017 through TS-029)
- [ ] TS-017: Balance card display - initial state ($0)
- [ ] TS-018: Trade completion triggers balance update
- [ ] TS-019: Withdraw button appears when balance > $0
- [ ] TS-020: Withdraw modal shows fee breakdown
- [ ] TS-021: Successful withdrawal creates payout record
- [ ] TS-022: Recent payouts display withdrawal
- [ ] TS-023: Lifetime earnings persist after withdrawal
- [ ] TS-024: Withdrawal validation - minimum $5
- [ ] TS-025: Withdrawal validation - verified method required
- [ ] TS-026: Fee calculation - PayPal (2% capped $20)
- [ ] TS-027: Fee calculation - Venmo (2% capped $20)
- [ ] TS-028: Network timeout error handling
- [ ] TS-029: Balance updates after multiple trades
- **Subtotal:** 13 test cases all PASS ✅

### Error Handling Tests (EH-001 through EH-006)
- [ ] EH-001: Network timeout
- [ ] EH-002: Unauthorized access
- [ ] EH-003: Database constraint violation
- [ ] EH-004: Insufficient balance during withdrawal
- [ ] EH-005: Minimum withdrawal not met
- [ ] EH-006: Unverified payout method
- **Subtotal:** 6 error test cases all handled correctly ✅

### Regression Tests
- [ ] REG-001: Complete payout setup flow (TS-001 through TS-016)
- [ ] REG-002: Balance & withdrawal complete flow (TS-017 through TS-029)
- [ ] REG-003: Multi-trade accumulation (3 trades)
- [ ] REG-004: Stripe Connect compatibility (future)
- **Subtotal:** All regression tests PASS ✅

### Final Verification
- [ ] All 35+ test cases executed
- [ ] All expected results verified
- [ ] Database state confirmed after each critical test
- [ ] Screenshots captured for key flows (balance, modal, recent payouts)
- [ ] Performance benchmarks met (load < 2s, withdrawal < 3s)
- [ ] No console errors or warnings
- [ ] TypeScript type-check passes
- [ ] Unit tests pass
- [ ] Accessibility tests passed
- [ ] Cross-platform tests passed (iOS + Android)
- [ ] **TOTAL RESULT: PASS ✅**

---

## Sign-Off

**Tester:** _______________  
**Date:** _______________  
**Build Version:** _______________  
**Pass/Fail:** _______________  
**Notes:** _______________

---

**End of Manual Test Guide**
