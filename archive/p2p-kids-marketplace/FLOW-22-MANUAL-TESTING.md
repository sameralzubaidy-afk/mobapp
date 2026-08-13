# FLOW-22: Payout Settings — Manual Test Cases

**Module:** MODULE-15.1 UI Redesign  
**Feature:** PayoutSettingsScreen — Hero balance card, all-methods list, NoMethodModal, USD-only history, status design tokens  
**Platforms:** iOS Simulator + Android Emulator  
**Prerequisite:** Signed-in seller account; at least one row in `seller_balances`; optionally rows in `seller_payouts`.

---

## TC-22-01: Header — ArrowLeft icon replaces text back button

**Given:** User navigates to Payout Settings from Profile  
**When:** Screen renders  
**Then:**
- `ArrowLeft` Phosphor icon (24px, `#1A1A1A`) is visible top-left — testID `back-button`
- Header title reads **"Payouts"** (not "Payout Settings")
- No old `← Back` text link visible

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-02: Hero balance card — layout and colors

**When:** Screen loads with a non-zero balance  
**Then:**
- Hero card (`testID="balance-hero-card"`) has `#5DBB8E` background
- `Coins` Phosphor icon (24px, white, fill weight) — testID `coins-icon` — top-left of card
- Label "Available Balance" in white, above the amount
- Balance amount (`testID="balance-amount"`) is displayed as `$X.XX` — no "AUD" suffix, no "💰" emoji
- Pending row (`testID="balance-pending"`) shows `$X.XX` format
- Lifetime row (`testID="balance-lifetime"`) shows `$X.XX` format
- A thin vertical divider separates Pending and Lifetime stat columns

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-03: Hero card — "Withdraw Now" CTA

**When:** Screen renders with available balance  
**Then:**
- White pill button is visible inside the hero card — testID `request-payout-btn`
- Button label reads **"Withdraw Now"**
- `ArrowDown` Phosphor icon (16px, `#5DBB8E`) appears left of label
- Old `💳 Withdraw Now` emoji-prefixed button is **not** present

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-04: Hero card — zero balance state

**Given:** Seller has `available_balance_cents = 0`  
**When:** Screen loads  
**Then:**
- Balance shows `$0.00`
- "Withdraw Now" button is still visible (tapping it handles zero-balance via guard logic)
- No "Complete trades to build your balance" notice box with the old gray styling

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-05: PAYOUT METHOD section — all methods shown

**Given:** Seller has 2+ connected payout methods  
**When:** Screen renders  
**Then:**
- Section label **"PAYOUT METHOD"** is visible
- Every connected method appears as a separate row (not just the primary)
- Each method row shows: `Bank` icon + method label (e.g., "Stripe Connect") + `CaretRight` icon
- The primary method row shows a green `#5DBB8E` **"Primary"** pill badge on the right side

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-06: PAYOUT METHOD section — single method with Primary pill

**Given:** Seller has exactly one connected method and it is primary  
**When:** Screen renders  
**Then:**
- One method row is visible with the green **"Primary"** pill badge
- **"Add Another Method"** row appears below it with `Plus` icon and `#5DBB8E` label

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-07: PAYOUT METHOD section — no methods, "Add Payment Method" row

**Given:** Seller has zero connected payout methods  
**When:** Screen renders  
**Then:**
- Section label **"PAYOUT METHOD"** is visible
- A single row shows `Bank` icon + **"Add Payment Method"** text in `#5DBB8E`
- No "Primary" pill is shown

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-08: NoMethodModal — shown when no method exists and "Withdraw Now" tapped

**Given:** Seller has zero connected payout methods  
**When:** User taps "Withdraw Now"  
**Then:**
- A modal overlay appears (NOT a native iOS `Alert.alert()` dialog)
- `Bank` Phosphor icon (40px, `#5DBB8E`, fill weight) is centered in the modal
- Title **"Payment Method Required"** is visible (24px)
- Descriptive message is visible explaining why a method is needed
- Green pill button **"Add Payout Method"** with `Plus` icon (18px, white) is visible
- Gray **"Cancel"** text link is visible below the button

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-09: NoMethodModal — "Add Payout Method" button dismisses modal and opens add-method flow

**When:** User taps "Add Payout Method" in the NoMethodModal  
**Then:**
- Modal closes
- Add-method modal / Stripe Connect flow opens

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-10: NoMethodModal — "Cancel" dismisses modal without action

**When:** User taps "Cancel" in the NoMethodModal  
**Then:**
- Modal closes
- No navigation or add-method flow triggered
- User remains on PayoutSettingsScreen

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-11: Payout history — currency display is USD only

**Given:** Seller has rows in `seller_payouts`  
**When:** Payout history section renders  
**Then:**
- Each history row shows amount as `$X.XX` (e.g., `$54.61`)
- **No "AUD" suffix** — neither ` AUD` nor `A$` appears anywhere in the history list
- Date is formatted in US format: `Jan 15, 2025` (not `15/01/2025`)

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-12: Payout history — status badge colors use design tokens

**When:** Payout history rows are visible with various statuses  
**Then:**

| Status | Label | Expected Color |
|--------|-------|----------------|
| `processing` | Processing | `#5DBB8E` (green) |
| `completed` | Completed | `#5DBB8E` (green) |
| `pending` | Pending | `#F59E0B` (amber) |
| `requires_action` | Action Required | `#E85D75` (red/pink) |
| `failed` | Failed | `#E85D75` (red/pink) |

- **No iOS blue** (`#007AFF`) status text visible anywhere
- **No Bootstrap green** (`#28a745`) or Bootstrap red (`#dc3545`) visible

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-13: Payout history — CheckCircle / Clock icons per status

**When:** Payout history rows render  
**Then:**
- `completed` rows show `CheckCircle` Phosphor icon in `#5DBB8E`
- `pending` / `processing` rows show `Clock` Phosphor icon in `#F59E0B`
- `failed` / `requires_action` rows show appropriate icon in `#E85D75`

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-14: Pull-to-refresh — green spinner

**When:** User pulls down on the PayoutSettingsScreen scroll view  
**Then:**
- iOS: loading spinner (`tintColor`) is `#5DBB8E` — not blue
- Android: progress circle (`colors`) is `#5DBB8E` — not blue
- Screen does **not** flash blank / show a spinner-only screen during refresh (guard: `loading && !refreshing`)
- After refresh completes, data reloads correctly

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-15: Loading state — does not show blank screen on pull-to-refresh

**When:** User pulls to refresh while data is loading  
**Then:**
- Screen content remains visible during refresh (no blank white screen flash)
- `LoadingSpinner` only shows on initial cold load (`loading === true && refreshing === false`)

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-16: Back navigation

**When:** User taps the `ArrowLeft` back button  
**Then:**
- Navigates back to the previous screen (Profile or wherever the user came from)
- No navigation crash or duplicate screen push

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-22-17: Phosphor icons — zero legacy icon style visible

**When:** PayoutSettingsScreen is fully rendered (header, hero card, method rows, history)  
**Then:**
- All icons are Phosphor style — no `Ionicons` style (outlined circle icons), no MaterialIcons
- No emoji used in place of icons (`💰`, `💳`)

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## Overall Regression Checks

| Check | Expected | iOS | Android |
|-------|----------|-----|---------|
| `npx tsc --noEmit` exits 0 | No TS errors | | |
| `npm run lint` exits 0 | No lint errors | | |
| Unit tests `PayoutSettings\|UserDashboard` | 22/22 pass | | |
| No "AUD" text visible anywhere in payout history | ✓ | | |
| No iOS blue (`#007AFF`) status color visible | ✓ | | |
| "Withdraw Now" tapped with no method → modal (not native Alert) | ✓ | | |
| All payout method rows visible (not just primary) | ✓ | | |

---

*Generated by Kids P2P App Builder agent — FLOW-22 PayoutSettingsScreen fixes (session May 2026)*
