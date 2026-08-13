# MODULE-15.1 FLOW-22 — Payout Dashboard + Request Payout: Manual Testing Guide

**Module**: MODULE-15.1 UI Redesign — TASK FLOW-22  
**Screens**: `PayoutDashboardScreen` + `RequestPayoutScreen`  
**Platform**: iOS Simulator + Android Emulator  
**Prerequisites**:
- Authenticated user (Kids Club+ subscription active)
- At least one completed trade in the system
- Supabase PRODUCTION only

---

## Pre-Test Checklist

- [ ] App launched and user is logged in
- [ ] Navigation reaches the Payout Dashboard (via Profile → Payouts or equivalent deep link)
- [ ] Supabase production API is reachable

---

## TC-001: Payout Dashboard — Loading State

**Steps:**
1. Navigate to Payout Dashboard screen
2. Observe immediately on screen open

**Expected Result:**
- A loading spinner / skeleton is visible while balance and history data fetches
- No blank screen flash
- `payout-dashboard-screen` testID is present in view hierarchy

---

## TC-002: Payout Dashboard — Balance Hero Card

**Steps:**
1. Wait for data to load on Payout Dashboard

**Expected Result:**
- Hero card background color is `#5DBB8E` (green)
- `Coins` icon is visible, 24px, white color
- SP balance value is displayed in **32px bold white** text
- AUD equivalent label shown below the SP balance (e.g., "≈ $12.34 AUD")

---

## TC-003: Payout Dashboard — "Request Payout" Pill on Hero Card

**Steps:**
1. On Payout Dashboard with data loaded

**Expected Result:**
- "Request Payout" is a **white pill button** rendered INSIDE the green hero card
- It is NOT a separate full-width button below the card
- Text reads exactly "Request Payout"
- Tapping it navigates to `RequestPayoutScreen`

---

## TC-004: Payout Dashboard — Bank Row with Primary Method

**Steps:**
1. Ensure a payout method is configured for the test account
2. Navigate to Payout Dashboard and wait for data

**Expected Result:**
- Bank row is visible (`bank-row`)
- `Bank` icon (20px, `#5DBB8E`) appears on the left
- Bank display name is visible (`bank-name`)
- Masked account details visible (`bank-masked`) if available
- `CaretRight` icon (16px, `#999999`) appears on the right
- Tapping the row navigates to PayoutSettings screen

---

## TC-005: Payout Dashboard — No Bank Method Shows "Add Bank Account"

**Steps:**
1. Use a test account with NO payout method configured
2. Navigate to Payout Dashboard

**Expected Result:**
- "Add Bank Account" row is visible (`add-bank-row`)
- `Plus` icon + "Add Bank Account" text visible
- `CaretRight` icon on right
- Tapping navigates to PayoutSettings screen

---

## TC-006: Payout Dashboard — Payout History Status Icons

**Steps:**
1. Ensure test account has both `completed` and `pending`/`processing` payout records
2. Navigate to Payout Dashboard, scroll to history section

**Expected Result:**
- Completed payouts show `CheckCircle` icon (16px, `#5DBB8E` green)
- Pending/processing payouts show `Clock` icon (16px, `#F59E0B` amber)
- Each row shows: amount, date, status icon
- Row testID follows pattern `history-row-{id}`

---

## TC-007: Payout Dashboard — Empty History State

**Steps:**
1. Use a test account with NO prior payouts
2. Navigate to Payout Dashboard

**Expected Result:**
- Payout history section is visible but shows empty state message
- `empty-history` testID visible
- No blank crash or undefined errors

---

## TC-008: Payout Dashboard — Pull-to-Refresh

**Steps:**
1. On Payout Dashboard with data loaded
2. Pull down from the top of the list (scroll down then release)

**Expected Result:**
- Refresh indicator appears while data reloads
- Balance and history data reloads without navigation change
- No crash or blank screen

---

## TC-009: Request Payout — Amount Input Filled Style

**Steps:**
1. Navigate to Request Payout screen (tap "Request Payout" pill)
2. Observe the amount input row

**Expected Result:**
- Amount input wrapper background is `#F0F0F0` (light grey fill)
- Border radius is 12px (rounded corners)
- Height is ~52px
- `Coins` icon (20px, `#F59E0B` amber) appears on the left inside the input
- Input font is 20px bold
- Placeholder text is visible when empty

---

## TC-010: Request Payout — Available Balance Display

**Steps:**
1. On Request Payout screen with data loaded

**Expected Result:**
- `available-balance` row shows current SP available
- `available-amount` testID shows the correct SP count (matches `PayoutDashboard` balance)

---

## TC-011: Request Payout — AUD Equivalent Updates Live

**Steps:**
1. Tap on the amount input
2. Type "1000" (1000 SP)

**Expected Result:**
- AUD equivalent label appears below the input (`aud-equivalent`)
- Value updates to "$10.00 AUD" (or equivalent based on 1 SP = 1 cent = $0.01)
- Updates in real time as more digits are typed

---

## TC-012: Request Payout — Exceeds Balance Validation

**Steps:**
1. On Request Payout screen
2. Enter an amount exceeding the available SP balance (e.g., enter 9999999)

**Expected Result:**
- `amount-exceeds-error` is visible with error text (red/error color `#E85D75`)
- Confirm button is disabled
- No crash

---

## TC-013: Request Payout — Payout Summary Card Appears

**Steps:**
1. Enter a valid amount (e.g., 500)
2. Ensure a payout method is configured

**Expected Result:**
- `payout-summary` card appears below the bank selector
- `summary-amount` shows the entered amount in AUD
- `summary-fee` shows the calculated payout fee
- `summary-net` shows the net amount after fee deduction

---

## TC-014: Request Payout — Fee Note Styling

**Steps:**
1. On Request Payout screen with amount entered

**Expected Result:**
- `fee-note` is visible below the payout summary (or above the confirm button)
- Font size is 13px
- Text color is `#999999` (grey)
- Text is center-aligned

---

## TC-015: Request Payout — Confirm Button Disabled When No Amount/Method

**Steps:**
1. Navigate to Request Payout screen
2. Do NOT enter an amount (or clear it)

**Expected Result:**
- `confirm-payout-btn` is visually disabled (greyed out or opacity reduced)
- Tapping it does nothing (no navigation, no API call)

---

## TC-016: Request Payout — Successful Payout Shows Alert and Goes Back

**Steps:**
1. Enter a valid amount within available balance
2. Ensure payout method is set
3. Tap `confirm-payout-btn`

**Expected Result:**
- Alert appears with title "Payout Requested" (or similar success message)
- Tapping "Done" / "OK" in the alert dismisses it
- User is navigated back to Payout Dashboard
- Dashboard refreshes with updated balance

---

## TC-017: Both Screens — iOS Simulator

**Steps:**
1. Run app on iOS Simulator
2. Walk through TC-001 to TC-016 above

**Expected Result:**
- All test cases pass on iOS
- No layout overflow, no missing icons, no font size issues
- Safe area insets handled correctly (no content under notch/home indicator)

---

## TC-018: Both Screens — Android Emulator

**Steps:**
1. Run app on Android Emulator
2. Walk through TC-001 to TC-016 above

**Expected Result:**
- All test cases pass on Android
- No layout differences breaking the design
- `#5DBB8E` color renders correctly
- Phosphor icons render correctly (not missing/fallback)

---

## Preflight Gate Commands

Run these before manual testing:

```bash
# TypeScript compile check
cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit

# Lint check
cd p2p-kids-marketplace && npm run lint

# Unit tests for FLOW-22
cd p2p-kids-marketplace && npm test -- --testPathPattern="PayoutDashboard|RequestPayout|flow-22"
```

**Expected**: All commands exit with code 0.

---

## Change Classification

- **Classification**: C (UI/screens only)
- **Impacted Flows**: FLOW-22 (self)
- **Regression Tiers**: Tier 0 (always) + Tier 1 (FLOW-22 smoke)

---

## Test Summary

| TC | Description | Platform | Status |
|----|-------------|----------|--------|
| TC-001 | Loading state | Both | ⏳ |
| TC-002 | Balance hero card | Both | ⏳ |
| TC-003 | Request Payout pill | Both | ⏳ |
| TC-004 | Bank row with method | Both | ⏳ |
| TC-005 | Add Bank Account (no method) | Both | ⏳ |
| TC-006 | History status icons (CheckCircle / Clock) | Both | ⏳ |
| TC-007 | Empty history state | Both | ⏳ |
| TC-008 | Pull-to-refresh | Both | ⏳ |
| TC-009 | Amount input filled style | Both | ⏳ |
| TC-010 | Available balance display | Both | ⏳ |
| TC-011 | AUD equivalent live update | Both | ⏳ |
| TC-012 | Exceed balance validation | Both | ⏳ |
| TC-013 | Payout summary card | Both | ⏳ |
| TC-014 | Fee note styling | Both | ⏳ |
| TC-015 | Confirm disabled (no amount/method) | Both | ⏳ |
| TC-016 | Successful payout → alert → back | Both | ⏳ |
| TC-017 | Full flow iOS Simulator | iOS | ⏳ |
| TC-018 | Full flow Android Emulator | Android | ⏳ |
