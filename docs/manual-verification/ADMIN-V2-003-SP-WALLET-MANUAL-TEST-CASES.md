# ADMIN-V2-003 SP Wallet Admin Operations — Manual Test Cases

**Module:** MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003  
**Flow:** FLOW-30 (SP Wallet Admin Operations)  
**Admin Portal:** `p2p-kids-admin` (Next.js)  
**Last Updated:** 2026-03-23 (Added TC-021 to TC-025 for wallet state enforcement)  

---

## Prerequisites

1. Admin portal running locally (`npm run dev` in `p2p-kids-admin/`)  
2. Supabase migrations applied (in order):  
   - `supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql` (base feature)
   - `supabase/migrations/20260323000001_enforce_wallet_state_on_spend_earn.sql` (enforcement — required for TC-021 to TC-025)
3. At least one user with an `sp_wallets` row in the database  
4. Log in to admin portal at `http://localhost:3001` with a valid admin account  
5. For mobile app tests (TC-021 to TC-025): Mobile app running on iOS/Android with test user logged in  

---

## TC-001: Home Page — SP Economy Card Visible

**Preconditions:** Admin portal home page loaded (`/`)  
**Steps:**
1. Navigate to `http://localhost:3001`
2. Scroll down past the existing cards
3. Look for "SP Economy" card in the navigation card grid

**Expected:**
- Card with title "SP Economy" is visible
- Card has link pointing to `/sp-wallet`
- Clicking the card navigates to `/sp-wallet`
- `data-testid="card-sp-wallet"` present in DOM

---

## TC-002: Home Page — SP Economy Summary Metrics

**Preconditions:** At least one `sp_wallets` row exists in the DB  
**Steps:**
1. Navigate to `http://localhost:3001`
2. Look for "SP Economy" summary section (server-rendered, above card grid)

**Expected:**
- Section titled "SP Economy" with sub-sections showing 4 metric tiles
- Tiles include: Total SP Earned, Total SP Spent, SP in Circulation, Active Wallets
- Numbers are non-negative integers
- If `get_sp_economy_metrics` RPC fails, section renders nothing (graceful degradation — no crash)

---

## TC-003: SP Wallet Page — Economy Metrics Grid

**Preconditions:** Navigate to `/sp-wallet`  
**Steps:**
1. Navigate to `http://localhost:3001/sp-wallet`
2. Observe the metrics grid at the top of the page

**Expected:**
- Page title "SP Wallet Admin" is visible
- 7 metric cards are shown: SP in Circulation, Total Earned, Total Spent, Active Wallets, Avg Balance, Admin Adjustments, Admin Adj Total
- `data-testid="metrics-grid"` is in DOM
- Numbers are non-negative integers
- Numbers match what is in the `sp_wallets` table when verified via Supabase dashboard

---

## TC-004: SP Wallet Page — Search for Existing User Wallet

**Preconditions:** User UUID with an `sp_wallets` row is known  
**Steps:**
1. Navigate to `http://localhost:3001/sp-wallet`
2. Paste a valid user UUID in the "Search by User ID" input (`data-testid="wallet-search-input"`)
3. Click "Load Wallet" (`data-testid="wallet-search-btn"`)

**Expected:**
- Wallet detail panel appears (`data-testid="wallet-detail-panel"`)
- Panel shows: User ID, status badge (active/frozen/suspended), Available Balance (SP), Pending Balance, Lifetime Earned, Lifetime Spent, Last Activity
- `data-testid="wallet-balance"` shows the correct available balance
- SP Adjustment form is visible below wallet details
- Ledger history table is visible (`data-testid="ledger-table"`)
- Last 100 ledger entries shown (or all entries if fewer than 100)

---

## TC-005: SP Wallet Page — Search for Non-Existent User

**Preconditions:** None  
**Steps:**
1. Navigate to `http://localhost:3001/sp-wallet`
2. Enter `00000000-0000-0000-0000-000000000001` in the search input
3. Click "Load Wallet"

**Expected:**
- Wallet detail panel does NOT appear
- Error message displayed: "SP wallet not found for this user"
- No JavaScript errors in console

---

## TC-006: SP Wallet Page — Add SP (Positive Adjustment)

**Preconditions:** Wallet detail panel is loaded for a valid user (TC-004)  
**Steps:**
1. In the SP Adjustment form, enter `10` in the Amount field (`data-testid="adj-amount-input"`)
2. Enter `Test manual top-up` in the Reason field (`data-testid="adj-reason-input"`)
3. Optionally enter a note in the Notes field
4. Click "Apply Adjustment" (`data-testid="adj-submit-btn"`)

**Expected:**
- Success message appears (`data-testid="adj-success"`)
- Available Balance in the wallet panel increases by 10
- Reload the wallet → new ledger entry visible in the table with:
  - `type = earn_admin_grant`
  - `amount = +10`
  - Description contains the reason text
- In Supabase dashboard: `sp_wallets.available_balance` and `lifetime_earned` both increased by 10
- `sp_ledger` has new row with `transaction_type='earn_admin_grant'`, `amount=10`, `description` containing reason text
- `admin_audit_logs` has new row with `action_type='sp_adjustment'`, `entity_type='sp_wallet'`, `entity_id=<wallet_id>`

---

## TC-007: SP Wallet Page — Deduct SP (Negative Adjustment)

**Preconditions:** Wallet loaded with `available_balance >= 5`  
**Steps:**
1. Enter `-5` in the Amount field
2. Enter `Deduction test` in the Reason field
3. Click "Apply Adjustment"

**Expected:**
- Success message appears
- Available Balance decreases by 5
- Ledger entry appears with `type = admin_deduct`, `amount = -5`
- `sp_wallets.lifetime_spent` increases by 5

---

## TC-008: SP Wallet Page — Prevent Negative Balance Deduction

**Preconditions:** Wallet loaded with `available_balance = 3` (or adjust to a low balance first)  
**Steps:**
1. Enter `-100` in the Amount field
2. Enter `Force negative` in the Reason field
3. Click "Apply Adjustment"

**Expected:**
- Error message appears (`data-testid="adj-error"`)
- Message contains "Insufficient balance"
- `sp_wallets.available_balance` is unchanged (still 3)
- No new ledger entry created
- No audit log created

---

## TC-009: SP Wallet Page — Reject Adjustment with Empty Reason

**Preconditions:** Wallet detail panel is loaded  
**Steps:**
1. Enter `5` in the Amount field
2. Leave the Reason field **empty**
3. Click "Apply Adjustment"

**Expected:**
- Error message appears (`data-testid="adj-error"`)
- Message contains "Reason is mandatory" or "reason is required"
- No new ledger entry created
- Wallet balance unchanged

---

## TC-010: SP Wallet Page — Reject Zero Amount Adjustment

**Preconditions:** Wallet detail panel is loaded  
**Steps:**
1. Enter `0` in the Amount field
2. Enter `Zero amount test` in the Reason field
3. Click "Apply Adjustment"

**Expected:**
- Error message shown: "Amount cannot be zero"
- No ledger entry created

---

## TC-011: SP Wallet Page — Freeze Wallet

**Preconditions:** Wallet loaded with `status = active`  
**Steps:**
1. Observe the status toggle buttons (`data-testid="status-btn-active"`, `"status-btn-frozen"`, `"status-btn-suspended"`)
2. The "Active" button should appear highlighted/disabled (current state)
3. Click "Frozen" (`data-testid="status-btn-frozen"`)

**Expected:**
- Success message appears (`data-testid="status-success"`)
- Status badge in wallet panel changes to "frozen"
- "Frozen" button is now highlighted/disabled; "Active" button is clickable again
- In Supabase dashboard: `sp_wallets.state = 'frozen'` (Note: column is `state`, not `status`)
- `admin_audit_logs` has new row with `action_type='sp_wallet_status_change'`, `payload.new_status='frozen'`

**Mobile App Enforcement (Added 2026-03-23):**
- After freezing, mobile app should block SP spending (see TC-021 for detailed verification)
- Backend: Attempting SP purchase should fail with error "Cannot spend SP: wallet is frozen..."
- Frontend: `AuthContext.can_spend_sp` should be `false` after session refresh

---

## TC-012: SP Wallet Page — Unfreeze Wallet (Restore to Active)

**Preconditions:** Wallet has `status = frozen` (from TC-011)  
**Steps:**
1. Click "Active" (`data-testid="status-btn-active"`)

**Expected:**
- Success message appears
- Status badge changes back to "active"
- `sp_wallets.status = 'active'` in DB

---

## TC-013: SP Wallet Page — Suspend Wallet

**Preconditions:** Wallet loaded with `status = active`  
**Steps:**
1. Click "Suspended" (`data-testid="status-btn-suspended"`)

**Expected:**
- Success message appears
- Status badge changes to "suspended"
- `sp_wallets.state = 'suspended'` in DB (Note: column is `state`, not `status`)
- Audit log created

**Mobile App Enforcement (Added 2026-03-23):**
- After suspending, mobile app should block both SP spending AND earning (see TC-022 for detailed verification)
- Backend: Attempting SP purchase should fail with error "Cannot spend SP: wallet is suspended..."
- Backend: Earning SP from trade should fail with error "Cannot earn SP: wallet is suspended..."

> **Cleanup:** Reset to active: click "Active"

---

## TC-014: Ledger History — Color Coding

**Preconditions:** Wallet loaded with multiple ledger entries of different types  
**Steps:**
1. Observe the ledger table rows after performing TC-006 (earn_admin_grant) and TC-007 (admin_deduct)

**Expected:**
- `earn_admin_grant` row has green-tinted background or green text on amount
- `admin_deduct` row has red-tinted background or red text on amount
- Columns visible: Type, Amount, Before, After, Description, Date
- Entries ordered newest-first

---

## TC-015: Audit Log Verification (via Supabase Dashboard)

**Preconditions:** TC-006 (add SP) and TC-011 (freeze wallet) completed  
**Steps:**
1. Open Supabase dashboard → Table Editor → `admin_audit_logs`
2. Filter by `entity_type = 'sp_wallet'` or `action_type IN ('sp_adjustment', 'sp_wallet_status_change')`

**Expected:**
- Row for TC-006: `action_type='sp_adjustment'`, `entity_type='sp_wallet'`, `payload.amount=10`, `payload.reason='Test manual top-up'`
- Row for TC-011: `action_type='sp_wallet_status_change'`, `payload.old_status='active'`, `payload.new_status='frozen'`
- Both rows have correct `entity_id` matching the wallet UUID
- `actor_id` is `null` (service role actions)
- `created_at` timestamps are recent

---

## TC-016: Economy Metrics Accuracy

**Preconditions:** Known wallet state before adding SP  
**Steps:**
1. Record current metrics from `/sp-wallet` page (Total Earned, SP in Circulation)
2. Add 20 SP to a wallet (TC-006)
3. Refresh `/sp-wallet` page

**Expected:**
- "Total Earned" increases by 20
- "SP in Circulation" (available + pending) reflects the new balance
- "Admin Adjustments" count increases by 1
- "Admin Adj Total" increases by 20

---

## TC-017: Navigation — SP Wallet Link in Admin Sidebar

**Preconditions:** Admin portal running  
**Steps:**
1. Navigate to any page in admin portal
2. Look for navigation link to "SP Wallet" or "sp-wallet" in the sidebar/nav

**Expected:**
- Link is visible and correctly routes to `/sp-wallet`

---

## TC-018: Error State — Invalid User ID Format

**Preconditions:** SP Wallet page loaded  
**Steps:**
1. Enter `not-a-uuid` in the search input
2. Click "Load Wallet"

**Expected:**
- Error shown: "Invalid user ID format" or API error
- No crash, no broken UI state

---

## TC-019: Regression — Large Ledger History Truncated at 100

**Preconditions:** User with > 100 `sp_ledger` entries (can be created via script or manual adjustments)  
**Steps:**
1. Load wallet for user with > 100 ledger entries
2. Observe ledger table

**Expected:**
- Exactly 100 rows shown (most recent first)
- No performance degradation (table renders in < 3s)

---

## TC-020: Security — Unauthenticated Access Blocked

**Preconditions:** Logged out of admin portal (or open incognito)  
**Steps:**
1. Navigate directly to `http://localhost:3001/sp-wallet`

**Expected:**
- Redirected to login page (not shown the SP wallet UI)
- API endpoint `GET /api/admin/sp-wallet?user_id=...` without `x-admin-secret` header returns 401

---

## Wallet State Enforcement (Mobile App) — Added 2026-03-23

*These test cases verify that wallet state changes made in the admin portal are enforced in the mobile app (backend + frontend). This prevents users from spending/earning SP when their wallet is frozen or suspended.*

**Prerequisites for TC-021 to TC-025:**
- Mobile app running on iOS simulator or device
- Test user logged into mobile app with an active wallet
- Test user has `available_balance >= 10` in `sp_wallets`
- Admin portal open at `http://localhost:3001/sp-wallet`
- SQL migration `20260323000001_enforce_wallet_state_on_spend_earn.sql` applied

---

## TC-021: Frozen Wallet Blocks SP Spending (Backend Enforcement)

**Preconditions:** Test user wallet is `active` with `available_balance >= 10`  
**Steps:**

1. **Verify baseline (before freeze):**
   ```sql
   SELECT user_id, state, available_balance 
   FROM sp_wallets 
   WHERE user_id = '<test_user_id>';
   ```
   - Expected: `state='active'`, `available_balance >= 10`

2. **Test that spend works BEFORE freeze:**
   ```sql
   SELECT public.debit_sp_for_trade('<test_user_id>', gen_random_uuid(), 5);
   ```
   - Expected: `{"success": true, "balance_after": <balance-5>, ...}`

3. **Admin portal: Freeze the wallet:**
   - Navigate to `/sp-wallet`, search for test user
   - Click "Frozen" button
   - Confirm success message

4. **Test that spend is BLOCKED after freeze (backend):**
   ```sql
   SELECT public.debit_sp_for_trade('<test_user_id>', gen_random_uuid(), 5);
   ```
   - Expected: `ERROR: Cannot spend SP: wallet is frozen. Please renew your subscription to restore access.`

5. **Test RPC eligibility check:**
   ```sql
   SELECT public.can_user_spend_sp('<test_user_id>');
   ```
   - Expected: `FALSE` (was `TRUE` before freeze)

6. **Cleanup:**
   ```sql
   UPDATE sp_wallets SET state = 'active' WHERE user_id = '<test_user_id>';
   ```

**Expected:**
- ✅ Active wallet: spend succeeds
- ✅ Frozen wallet: backend blocks spend with clear error message
- ✅ RPC `can_user_spend_sp()` returns `FALSE` when frozen

**What This Validates:** Backend enforcement (P0 — Security Critical)

---

## TC-022: Suspended Wallet Blocks SP Earning (Backend Enforcement)

**Preconditions:** Test user wallet is `active`  
**Steps:**

1. **Suspend the wallet:**
   ```sql
   UPDATE sp_wallets SET state = 'suspended' WHERE user_id = '<test_user_id>';
   ```

2. **Test that earning is BLOCKED:**
   ```sql
   SELECT public.earn_sp_for_trade('<test_user_id>', gen_random_uuid(), 15);
   ```
   - Expected: `ERROR: Cannot earn SP: wallet is suspended. Contact support for assistance.`

3. **Test that spending is also BLOCKED:**
   ```sql
   SELECT public.debit_sp_for_trade('<test_user_id>', gen_random_uuid(), 5);
   ```
   - Expected: `ERROR: Cannot spend SP: wallet is suspended. Contact support for assistance.`

4. **Cleanup:**
   ```sql
   UPDATE sp_wallets SET state = 'active' WHERE user_id = '<test_user_id>';
   ```

**Expected:**
- ✅ Suspended wallet: earn fails with clear error message
- ✅ Suspended wallet: spend also fails with clear error message

**What This Validates:** Backend enforcement for suspended wallets (P0)

---

## TC-023: Mobile App AuthContext Wallet State Sync (Frontend Enforcement)

**Preconditions:** 
- Mobile app running with test user logged in (active wallet)
- Test user has active subscription (`trial` or `active`)
- Metro bundler running so you can view console logs

**Steps:**

1. **Baseline: Verify active wallet state in app:**
   - Open React Native debugger or Metro logs
   - Look for: `[AUTH] 💰 SP spending eligibility:` log
   - Expected output:
     ```
     [AUTH] 💰 SP spending eligibility: {
       subscriptionStatus: 'trial' or 'active',
       wallet_state: 'active',
       canSpendSP: true
     }
     ```

2. **Admin portal: Freeze test user wallet:**
   - Navigate to `/sp-wallet`, search for test user UUID
   - Click "Frozen" button
   - Confirm success message

3. **Mobile app: Force session refresh:**
   - Kill mobile app (swipe up from app switcher)
   - Relaunch app
   - Login as test user (if needed)
   - Wait for app to fully load (Dashboard screen)

4. **Verify frozen wallet state in logs:**
   - Check Metro logs for: `[AUTH] 💰 SP spending eligibility:` 
   - Expected output:
     ```
     [AUTH] 💰 SP spending eligibility: {
       subscriptionStatus: 'trial' or 'active',
       wallet_state: 'frozen',
       canSpendSP: false
     }
     ```

5. **Verify SP slider is disabled:**
   - Navigate to an item that accepts SP
   - Tap "Buy Now" to go to checkout
   - Expected: SP slider should be DISABLED or hidden (because `can_spend_sp === false`)

6. **Cleanup:**
   - Admin portal: Click "Active" button to restore wallet
   - Mobile app: Kill + relaunch
   - Verify: `canSpendSP: true` in logs

**Expected:**
- ✅ `wallet_state` changes from `'active'` to `'frozen'` after admin action
- ✅ `canSpendSP` becomes `false` when wallet is frozen
- ✅ SP slider is disabled in checkout when `canSpendSP === false`
- ✅ Restoring to active re-enables SP spending

**What This Validates:** Frontend enforcement via AuthContext (P1 — UX Critical)

---

## TC-024: Mobile App Wallet State Reflected in `get_user_sp_wallet_summary()` RPC

**Preconditions:** Test user logged into mobile app  
**Steps:**

1. **Query wallet summary RPC directly:**
   ```sql
   SELECT * FROM get_user_sp_wallet_summary('<test_user_id>');
   ```
   - Expected columns: `available_points`, `pending_points`, `lifetime_earned`, `lifetime_spent`, `wallet_state`
   - Expected: `wallet_state = 'active'`

2. **Freeze wallet:**
   ```sql
   UPDATE sp_wallets SET state = 'frozen' WHERE user_id = '<test_user_id>';
   ```

3. **Query RPC again:**
   ```sql
   SELECT * FROM get_user_sp_wallet_summary('<test_user_id>');
   ```
   - Expected: `wallet_state = 'frozen'`

4. **Suspend wallet:**
   ```sql
   UPDATE sp_wallets SET state = 'suspended' WHERE user_id = '<test_user_id>';
   SELECT * FROM get_user_sp_wallet_summary('<test_user_id>');
   ```
   - Expected: `wallet_state = 'suspended'`

5. **Cleanup:**
   ```sql
   UPDATE sp_wallets SET state = 'active' WHERE user_id = '<test_user_id>';
   ```

**Expected:**
- ✅ RPC returns `wallet_state` field (5th column)
- ✅ `wallet_state` matches actual `sp_wallets.state` value
- ✅ Mobile app AuthContext uses this value to set `can_spend_sp`

**What This Validates:** RPC contract change (returns wallet_state)

---

## TC-025: Mobile App Wallet Warning Banners (UI — Pending Implementation)

*Note: This test case is for the `WalletWarningBanner` component. The component exists but is not yet integrated into wallet/checkout screens. Mark this test as PENDING until component is added to screens.*

**Preconditions:** 
- `WalletWarningBanner` component added to `WalletScreen.tsx` and `CheckoutScreen.tsx`
- Mobile app running with test user logged in

**Steps:**

1. **Test frozen wallet warning:**
   - Admin portal: Freeze test user wallet
   - Mobile app: Kill + relaunch
   - Navigate to wallet screen (`/wallet` or similar)
   - Expected: **Blue banner** visible at top with:
     - Icon: ⚠️
     - Title: "Swap Points Frozen"
     - Message: "Your subscription is in grace period. Renew your subscription to restore SP access."

2. **Test suspended wallet warning:**
   - Admin portal: Suspend test user wallet
   - Mobile app: Kill + relaunch
   - Navigate to wallet screen
   - Expected: **Red banner** visible with:
     - Icon: 🚫
     - Title: "Wallet Suspended"
     - Message: "Your SP wallet has been suspended. Please contact support for assistance."

3. **Test grace period warning:**
   - Set wallet to grace_period:
     ```sql
     UPDATE sp_wallets SET state = 'grace_period' WHERE user_id = '<test_user_id>';
     ```
   - Mobile app: Kill + relaunch
   - Navigate to wallet screen
   - Expected: **Yellow banner** visible with:
     - Icon: ⏳
     - Title: "Grace Period Active"
     - Message: "You have 90 days to renew your subscription and keep your Swap Points."

4. **Test active wallet (no banner):**
   - Admin portal: Restore wallet to active
   - Mobile app: Kill + relaunch
   - Navigate to wallet screen
   - Expected: **No banner** visible (normal operation)

5. **Verify banner appears in checkout screen:**
   - Freeze wallet again
   - Navigate to checkout for an item
   - Expected: Blue frozen wallet banner appears in checkout screen as well

6. **Cleanup:**
   ```sql
   UPDATE sp_wallets SET state = 'active' WHERE user_id = '<test_user_id>';
   ```

**Expected:**
- ✅ Frozen: Blue banner with renewal message
- ✅ Suspended: Red banner with support message
- ✅ Grace period: Yellow banner with 90-day warning
- ✅ Active: No banner shown
- ✅ Banner appears in both wallet screen and checkout screen

**What This Validates:** UI warnings (P2 — UX Enhancement)

---

## Quick Regression Checklist (Run After Any Change to SP Wallet)

**Admin Portal UI:**
- [ ] TC-001: SP Economy card on home page
- [ ] TC-003: Economy metrics grid loads
- [ ] TC-004: Wallet search works for valid user
- [ ] TC-006: Add SP succeeds + ledger entry created
- [ ] TC-007: Deduct SP succeeds + ledger entry created
- [ ] TC-008: Negative balance prevention works
- [ ] TC-009: Empty reason rejected
- [ ] TC-011: Freeze wallet succeeds + audit log
- [ ] TC-020: Unauthenticated access blocked

**Backend Enforcement (Added 2026-03-23):**
- [ ] TC-021: Frozen wallet blocks SP spending (backend error)
- [ ] TC-022: Suspended wallet blocks earning and spending
- [ ] TC-023: Mobile AuthContext syncs wallet state correctly
- [ ] TC-024: RPC returns wallet_state field

**Mobile UI (Pending Implementation):**
- [ ] TC-025: Wallet warning banners display correctly

---

## Tier Classification

| Tier | When | Commands |
|------|------|---------|
| 0 | Always | `cd p2p-kids-admin && npm run typecheck && npm run lint` |
| 0 | Always | `cd p2p-kids-admin && npm test -- --testPathPattern=sp-wallet` |
| 0 | Always (mobile) | `cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit` |
| 1 | When API/UI changes | Run TC-001, TC-003 to TC-018 manually |
| 1 | When enforcement changes | Run TC-021 to TC-024 (backend + mobile app enforcement) |
| 2 | When SQL migration changes | `supabase db reset` → re-apply migrations → run TC-001 to TC-025 |

---

## SQL Migrations Required

**Base Feature (ADMIN-V2-003):**
- `supabase/migrations/20260322000001_admin_v2_003_sp_wallet_rpcs.sql`

**Wallet State Enforcement (Added 2026-03-23):**
- `supabase/migrations/20260323000001_enforce_wallet_state_on_spend_earn.sql`

**Verification:**
```sql
-- Verify all RPCs exist with correct signatures
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN (
  'admin_adjust_sp_wallet',
  'admin_toggle_sp_wallet_status',
  'admin_get_sp_wallet_detail',
  'get_sp_economy_metrics',
  'debit_sp_for_trade',
  'earn_sp_for_trade',
  'can_user_spend_sp',
  'get_user_sp_wallet_summary'
);
-- Expected: 8 rows

-- Verify get_user_sp_wallet_summary returns 5 columns (including wallet_state)
SELECT * FROM get_user_sp_wallet_summary('<any_user_id>');
-- Expected columns: available_points, pending_points, lifetime_earned, lifetime_spent, wallet_state
```

---

## Known Issues & Pending Work

**TC-025 (Wallet Warning Banners):**
- ⚠️ Status: **PENDING IMPLEMENTATION**
- Component `WalletWarningBanner.tsx` exists but not yet integrated into screens
- To complete: Add component to `WalletScreen.tsx` and `CheckoutScreen.tsx`
- See: `ADMIN-V2-003-WALLET-STATE-ENFORCEMENT-QUICK-START.md` for integration example

---

## Related Documentation

- **Implementation Details:** `ADMIN-V2-003-WALLET-STATE-ENFORCEMENT-IMPLEMENTATION.md`
- **Quick Start Guide:** `ADMIN-V2-003-WALLET-STATE-ENFORCEMENT-QUICK-START.md`
- **Flow Registry:** `docs/flow-registry.md` (FLOW-30)
- **Original Feature Summary:** `ADMIN-V2-003-IMPLEMENTATION-SUMMARY.md`
