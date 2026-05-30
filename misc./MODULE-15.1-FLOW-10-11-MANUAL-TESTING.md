# MODULE-15.1 FLOW-10/11: SP Wallet & Transaction History — Manual Testing Guide

**Module:** MODULE-15.1-UI-redesign.md  
**Tasks:** FLOW-10/11 — SP Wallet UI Redesign (Visual Only)  
**Screens:** SpWalletScreen, SpTransactionHistoryScreen  
**Test Environment:** iOS/Android Simulators  
**Prerequisites:** User logged in with active subscription + SP wallet initialized

---

## Pre-Test Setup

### Required SQL (Run in Supabase SQL Editor BEFORE testing)

```sql
-- 1. Verify test user has SP wallet
SELECT id, user_id, available_balance, pending_balance, lifetime_earned, lifetime_spent, state
FROM sp_wallets
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-test-email@test.com');

-- 2. Create sample transactions if wallet is empty
DO $$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'your-test-email@test.com';
  SELECT id INTO v_wallet_id FROM sp_wallets WHERE user_id = v_user_id;

  -- Insert earn transactions
  INSERT INTO sp_transactions (wallet_id, user_id, transaction_type, amount, description)
  VALUES
    (v_wallet_id, v_user_id, 'sale', 350, 'Earned from selling toy'),
    (v_wallet_id, v_user_id, 'trade', 25, 'Completed trade bonus'),
    (v_wallet_id, v_user_id, 'referral', 100, 'Referral bonus');

  -- Insert spend transaction
  INSERT INTO sp_transactions (wallet_id, user_id, transaction_type, amount, description)
  VALUES
    (v_wallet_id, v_user_id, 'spend', -200, 'Spent on purchase');

  -- Update wallet balances
  UPDATE sp_wallets
  SET
    available_balance = 275,
    lifetime_earned = 475,
    lifetime_spent = 200
  WHERE user_id = v_user_id;
END $$;

-- 3. Verify transactions created
SELECT transaction_type, amount, description, created_at
FROM sp_transactions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-test-email@test.com')
ORDER BY created_at DESC;
```

---

## Test Case 1: SP Wallet Screen — Hero Balance Card

**Objective:** Verify hero balance card displays correctly with premium design

### Steps:
1. Launch app in iOS or Android simulator
2. Log in with test user credentials
3. Navigate: Bottom Nav → Profile → Tap "Swap Points"

### Expected Results:
- ✅ Hero card has **#5DBB8E green background**, rounded corners (16px radius)
- ✅ **Coins icon (40px, white)** displayed above balance
- ✅ **Balance amount** is **36px bold white** — largest text on screen
- ✅ "Swap Points" label below balance in **white with 0.8 opacity**
- ✅ Card is centered with proper padding (24px inside, 20px margins)

**Screenshot:** Capture hero balance card  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 2: SP Wallet Screen — Quick Action Buttons

**Objective:** Verify quick action buttons render with correct labels, icons, and navigation

### Steps:
1. From SP Wallet screen, observe the 3 action buttons below hero card

### Expected Results:
- ✅ **3 buttons in a row:** "Shop" | "Sell" | "History"
- ✅ Each button is a **white card with 12px border radius**
- ✅ **Subtle shadow** (elevation: 2, shadowOpacity: 0.06)
- ✅ Icons: **MagnifyingGlass (green #5DBB8E)**, **Tag (gold #F59E0B)**, **Receipt (black)**
- ✅ Icon size: **24px**
- ✅ Label below icon: **12px, semibold, black**

### Navigation Verification:
- ✅ Tap **"Shop"** → navigates to **Discover** screen (browse items, use SP as discount)
- ✅ Tap **"Sell"** → navigates to **Create Listing** screen (earn SP by selling with SP accepted)
- ✅ Tap **"History"** → navigates to **Transaction History** screen

### Business Rule Notes:
- SP cannot be "redeemed" outside the app. Users spend SP as a discount when purchasing items.
- Users earn SP only by: (1) selling items with "Accept SP" enabled, or (2) referring friends.

**Screenshot:** Capture quick action buttons  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 3: SP Wallet Screen — How to Earn Section

**Objective:** Verify "How to Earn SP" section displays correct earn methods with tappable rows

### Steps:
1. Scroll down to "How to Earn SP" section

### Expected Results:
- ✅ **Section title:** "How to Earn SP" (18px, semibold, black)
- ✅ **2 earn methods only:**
  - Sell an item → **50-500 SP**
  - Refer a friend → **100 SP**
- ✅ **"Complete a trade" row is NOT displayed** (not a valid earn method)
- ✅ Each row has:
  - **Icon (20px, green #5DBB8E)**: Storefront, UserPlus
  - **Label (15px, medium)**: Action description
  - **Gold SP chip** on right:
    - Background: **#FEF3C7** (light gold)
    - Text: **#F59E0B** (gold), 12px, semibold
    - Icon: **Coins (12px, gold, filled)**
- ✅ Rows are **tappable**:
  - Tap "Sell an item" → navigates to **Create Listing** screen
  - Tap "Refer a friend" → navigates to **Referral Dashboard** screen

**Screenshot:** Capture earn methods section  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 4: SP Wallet Screen — Lifetime Stats Chips

**Objective:** Verify 3 lifetime stat chips render in a row

### Steps:
1. Scroll to lifetime stats section

### Expected Results:
- ✅ **3 chips in a row:** Total Earned | Total Spent | Pending
- ✅ Each chip has:
  - **Background:** #F7F7F7 (light gray)
  - **Border radius:** 12px
  - **Padding:** 12px
  - **Amount:** 18px, bold, black
  - **Label:** 11px, #6B6B6B
- ✅ Chips are evenly spaced (gap: 12px)
- ✅ Numbers match SQL query results

**Screenshot:** Capture lifetime stats chips  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 5: SP Wallet Screen — Expiring Soon Alert (Conditional)

**Objective:** Verify expiring SP alert displays when applicable

### Steps:
1. If SP is expiring within 30 days, verify alert appears
2. If no SP expiring, verify alert is NOT displayed

### Expected Results (if expiring SP exists):
- ✅ Alert box with:
  - **Background:** #FEF3C7 (light gold)
  - **Text:** "⚠️ [amount] SP will expire in 30 days"
  - **Text color:** #F59E0B (gold), semibold
  - **Border radius:** 12px

### Expected Results (if no expiring SP):
- ✅ Alert is **not displayed**

**Screenshot:** Capture alert (if present)  
**Result:** [ ] Pass  [ ] Fail  [ ] N/A  
**Notes:** ___________

---

## Test Case 6: Navigate to Transaction History

**Objective:** Verify "History" button navigates to SpTransactionHistoryScreen

### Steps:
1. From SP Wallet screen, tap **"History"** quick action button
2. Observe screen transition

### Expected Results:
- ✅ Screen transitions to **Transaction History**
- ✅ Header shows: **"Transaction History"**
- ✅ Back button (← Back) visible in top-left
- ✅ 3 tabs visible: **All | Earned | Spent**
- ✅ Default tab: **"All"** with **#5DBB8E green underline** (3px height)

**Screenshot:** Capture transaction history screen  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 7: Transaction History — All Tab (Default)

**Objective:** Verify all transactions display correctly

### Steps:
1. Observe transactions in "All" tab (default view)

### Expected Results:
- ✅ Each transaction row shows:
  - **Icon circle (36px diameter):**
    - Background: **#E8F5F0** (light green)
    - Icon: Type-specific (Storefront, ArrowsLeftRight, ArrowUp, UserPlus, Clock, Coins)
    - Icon size: **20px**
  - **Title:** Transaction type (15px, semibold, black)
  - **Date:** MM/DD/YYYY at HH:MM (13px, #6B6B6B)
  - **Amount (right side):**
    - Earned: **"+[amount] SP"** in **#5DBB8E green**
    - Spent: **"−[amount] SP"** in **#E85D75 red**
- ✅ Transactions ordered by date (newest first)

**Screenshot:** Capture transaction list  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 8: Transaction History — Earned Tab Filter

**Objective:** Verify "Earned" tab filters correctly

### Steps:
1. Tap **"Earned"** tab
2. Observe filtered transactions

### Expected Results:
- ✅ **"Earned" tab has green underline** (3px, #5DBB8E)
- ✅ Only transactions with **positive amounts** are displayed
- ✅ All amounts show **"+[amount] SP"** in **#5DBB8E green**
- ✅ Negative (spent) transactions are **hidden**

**Screenshot:** Capture earned transactions only  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 9: Transaction History — Spent Tab Filter

**Objective:** Verify "Spent" tab filters correctly

### Steps:
1. Tap **"Spent"** tab
2. Observe filtered transactions

### Expected Results:
- ✅ **"Spent" tab has green underline**
- ✅ Only transactions with **negative amounts** are displayed
- ✅ All amounts show **"−[amount] SP"** in **#E85D75 red**
- ✅ Positive (earned) transactions are **hidden**

**Screenshot:** Capture spent transactions only  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 10: Transaction History — Empty State

**Objective:** Verify empty state displays when no transactions exist

### Steps:
1. Test with user who has no transactions OR filter to a tab with 0 results

### Expected Results:
- ✅ **Coins icon (64px, #E0E0E0 gray)** centered
- ✅ Text: **"No transactions yet"** (16px, #999999)
- ✅ Empty state is vertically centered

**Screenshot:** Capture empty state  
**Result:** [ ] Pass  [ ] Fail  [ ] N/A  
**Notes:** ___________

---

## Test Case 11: Navigation — Back from Transaction History

**Objective:** Verify back button returns to SP Wallet screen

### Steps:
1. From Transaction History screen, tap **"← Back"** button
2. Observe navigation

### Expected Results:
- ✅ Returns to **SP Wallet screen**
- ✅ Hero balance card is visible
- ✅ Scroll position is preserved (if applicable)

**Screenshot:** N/A  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 12: Navigation — Back from SP Wallet

**Objective:** Verify back button returns to Profile screen

### Steps:
1. From SP Wallet screen, tap **"← Back"** button
2. Observe navigation

### Expected Results:
- ✅ Returns to **Profile screen**
- ✅ "Swap Points" button is visible

**Screenshot:** N/A  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 13: Visual Design — Color Verification

**Objective:** Verify all colors match MODULE-15.1 spec

### Steps:
1. Review all screens and components

### Expected Color Palette:
- ✅ **Primary Green (SP theme):** #5DBB8E — hero card background, tab underline, earned amounts
- ✅ **Gold (SP accents):** #F59E0B — SP chips, Coins icon, "Earn More" icon
- ✅ **Red (Spent amounts):** #E85D75 — spent transactions
- ✅ **White:** #FFFFFF — hero card text, background
- ✅ **Black (Primary text):** #1A1A1A — headings, labels, amounts
- ✅ **Gray (Secondary text):** #6B6B6B — dates, hints
- ✅ **Light Gray (Stats chips):** #F7F7F7
- ✅ **Light Green (Icon circles):** #E8F5F0
- ✅ **Light Gold (Chips, alerts):** #FEF3C7

**Screenshot:** Capture color palette usage  
**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 14: Visual Design — Icon Verification

**Objective:** Verify all icons are from Phosphor Icons (not Ionicons)

### Steps:
1. Review all screens for icon usage

### Expected Icons (Phosphor):
- ✅ **Wallet** — (unused in current design)
- ✅ **Coins** — hero card, earn chip icon
- ✅ **ArrowUp** — Redeem button, redemption transactions
- ✅ **Receipt** — History button
- ✅ **Storefront** — Sale transactions
- ✅ **ArrowsLeftRight** — Trade transactions
- ✅ **UserPlus** — Referral transactions
- ✅ **TrendUp** — (unused in current design)
- ✅ **Clock** — Pending transactions

**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Test Case 15: Accessibility — Text Hierarchy

**Objective:** Verify text sizes create clear visual hierarchy

### Steps:
1. Review text sizes across all screens

### Expected Hierarchy:
- ✅ **Largest:** Balance amount (36px) — hero number
- ✅ **Large:** Section titles (18px), stat amounts (18px)
- ✅ **Medium:** Transaction titles (15px), earn labels (15px), amounts (15px)
- ✅ **Small:** Tab text (15px), dates (13px), labels (14px), action labels (12px), stat labels (11px)

**Result:** [ ] Pass  [ ] Fail  
**Notes:** ___________

---

## Regression Checks

### Check 1: No Breaking Changes
- ✅ SP balance calculation logic unchanged (visual only)
- ✅ Transaction history query unchanged (visual only)
- ✅ Navigation flow intact (back buttons work)

### Check 2: Bottom Nav Bar
- ✅ Bottom nav bar remains visible and functional on both screens

### Check 3: Pull-to-Refresh
- ✅ Pull-to-refresh works on SP Wallet screen
- ✅ Pull-to-refresh works on Transaction History screen

---

## Test Summary

**Total Test Cases:** 15  
**Passed:** ___  
**Failed:** ___  
**N/A:** ___

**Tested By:** ___________  
**Date:** ___________  
**Simulator:** [ ] iOS  [ ] Android  
**Build Version:** ___________

**Critical Issues Found:** ___________

**Notes:** ___________
