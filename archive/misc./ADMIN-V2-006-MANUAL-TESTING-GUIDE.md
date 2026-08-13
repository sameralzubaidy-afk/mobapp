# ADMIN-V2-006: User Management Dashboard - Manual Testing Guide

**Task:** User Management Dashboard  
**Module:** MODULE-12-ADMIN-V2.md  
**Test Environment:** iOS Simulator + Android Emulator (Note: This is admin portal, web-based)  
**Prerequisites:**
- Migration `126_admin_user_management.sql` applied to Supabase
- Edge Function `admin-trigger-password-reset` deployed
- Admin user exists with role in `role_based_access_control` table
- Admin portal running on `localhost:3000` (or deployed)

---

## PRE-TEST SETUP

### SQL: Verify Schema

Run this in Supabase SQL Editor:

```sql
-- 1. Verify account_status enum exists
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'account_status'::regtype;
-- Expected: active, suspended, banned

-- 2. Verify columns added to profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('account_status', 'suspended_at', 'suspended_by', 'suspension_reason', 'deleted_at', 'deleted_by', 'deletion_reason');
-- Expected: 7 rows

-- 3. Verify RPCs exist
SELECT proname FROM pg_proc 
WHERE proname IN ('admin_list_users', 'admin_get_user_analytics', 'admin_get_user_detail', 'admin_suspend_user', 'admin_unsuspend_user', 'admin_delete_user');
-- Expected: 6 rows

-- 4. Verify admin user exists
SELECT u.email, rbac.role
FROM auth.users u
JOIN role_based_access_control rbac ON rbac.user_id = u.id
WHERE rbac.role = 'admin';
-- Expected: At least 1 admin user
```

### SQL: Create Test Users (if needed)

```sql
-- Create a few test users with different states
INSERT INTO profiles (user_id, name, account_status) VALUES
  ('user-test-1', 'Active User Test', 'active'),
  ('user-test-2', 'Suspended User Test', 'suspended'),
  ('user-test-3', 'Free User Test', 'active');

-- Add suspension data to suspended user
UPDATE profiles 
SET 
  suspended_at = now(),
  suspension_reason = 'Test suspension for manual testing'
WHERE name = 'Suspended User Test';
```

---

## TEST CASES

### TC-001: Admin Login & Navigation

**Objective:** Verify admin can access user management page

**Steps:**
1. Open admin portal: `http://localhost:3000`
2. Login with admin credentials
3. Look for "Users" link in top navigation
4. Click "Users"

**Expected Results:**
- ✅ Admin successfully logged in
- ✅ "Users" link visible in navigation
- ✅ User management page loads
- ✅ Page title: "User Management"
- ✅ Analytics metrics visible at top

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-002: Analytics Header Display

**Objective:** Verify user analytics display correctly

**Steps:**
1. From Users page, observe analytics cards at top
2. Note the values displayed

**Expected Results:**
- ✅ "Total Users" card shows count ≥ 0
- ✅ "Active" card shows count ≥ 0 with green color
- ✅ "Suspended" card shows count ≥ 0 with orange color
- ✅ "New This Month" card shows count ≥ 0 with blue color
- ✅ "DAU" card shows count ≥ 0
- ✅ "MAU" card shows count ≥ 0
- ✅ "Deleted" card shows count ≥ 0 with red color
- ✅ "Subscribers" card shows count ≥ 0 with purple color

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-003: User List Display

**Objective:** Verify user list shows all required columns

**Steps:**
1. Scroll down to user table
2. Check table headers
3. Check at least one user row

**Expected Results:**
- ✅ Table headers visible: User, Email, Phone, Status, Subscription, Registered, Last Login, Stats
- ✅ Each user row shows:
  - Avatar (or initial if no avatar)
  - Name
  - Email
  - Phone (or "N/A")
  - Account status badge (active/suspended/banned)
  - Subscription status badge (trial/active/grace_period/cancelled/Free)
  - Registered date (formatted)
  - Last login date (formatted)
  - Stats: Trades, SP, Badges counts

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-004: Search Functionality

**Objective:** Verify search by name, email, phone works

**Steps:**
1. In "Search" input, type a partial user name (e.g., "Test")
2. Wait for results to update
3. Clear search
4. Type a partial email (e.g., "@test.com")
5. Wait for results
6. Clear search
7. Type a phone number (if any user has one)

**Expected Results:**
- ✅ Search by name returns matching users
- ✅ Search by email returns matching users
- ✅ Search by phone returns matching users
- ✅ Clearing search shows all users again
- ✅ Page resets to 1 when searching

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-005: Account Status Filter

**Objective:** Verify filtering by account status

**Steps:**
1. Select "Active" from Account Status dropdown
2. Observe results
3. Select "Suspended" from dropdown
4. Observe results
5. Select "Deleted" from dropdown
6. Observe results
7. Select "All" to reset

**Expected Results:**
- ✅ "Active" filter shows only users with active status
- ✅ "Suspended" filter shows only users with suspended status
- ✅ "Deleted" filter shows only soft-deleted users (`profiles.deleted_at IS NOT NULL`)
- ✅ "All" shows all users regardless of status
- ✅ Page resets to 1 when filtering

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-006: Subscription Status Filter

**Objective:** Verify filtering by subscription status

**Steps:**
1. Select "Trial" from Subscription Status dropdown
2. Observe results
3. Select "Active" from dropdown
4. Observe results
5. Select "Free" from dropdown
6. Observe results (users with no subscription)
7. Select "All" to reset

**Expected Results:**
- ✅ "Trial" filter shows only trial users
- ✅ "Active" filter shows only active subscribers
- ✅ "Free" filter shows only non-subscribers
- ✅ "All" shows all users
- ✅ Page resets to 1 when filtering

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-007: Pagination

**Objective:** Verify pagination works correctly

**Steps:**
1. If total users > 20, observe pagination controls
2. Click "Next" button
3. Observe page number change
4. Click "Previous" button
5. Observe page number change

**Expected Results:**
- ✅ Pagination shows "Page X of Y"
- ✅ "Next" button works and increments page
- ✅ "Previous" button works and decrements page
- ✅ "Previous" disabled on page 1
- ✅ "Next" disabled on last page
- ✅ User list updates with new page data

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-008: Open User Detail Panel

**Objective:** Verify clicking a user row opens detail panel

**Steps:**
1. Click any user row in the table
2. Wait for detail panel to load

**Expected Results:**
- ✅ Modal/panel opens
- ✅ Panel has "User Detail" title
- ✅ Close button (×) visible in top-right
- ✅ Panel shows multiple sections: Identity, Subscription, SP Wallet, Trade Activity, Badges, Recent Admin Activity, Admin Actions

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-009: User Detail - Identity Section

**Objective:** Verify identity section shows all user info

**Steps:**
1. In user detail panel, check Identity section

**Expected Results:**
- ✅ Avatar or initial displayed
- ✅ Name displayed
- ✅ Email displayed
- ✅ User ID displayed
- ✅ Phone displayed (must not be empty or "N/A")
- ✅ DOB displayed (must not be empty or "N/A")
- ✅ Account status badge displayed
- ✅ Registered date displayed
- ✅ Last login date displayed
- ✅ Email verified status (✅ or ❌)
- ✅ Phone verified status (✅ or ❌)
- ✅ If suspended: suspension reason and date displayed in orange box

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-010: User Detail - Subscription Section

**Objective:** Verify subscription info displays correctly

**Steps:**
1. Check Subscription section
2. Test with a subscribed user
3. Test with a free user (no subscription)

**Expected Results:**
- ✅ For subscribed user:
  - Status badge displayed
  - Tier displayed
  - Started date displayed
  - Trial ends date displayed (if applicable)
  - Period end date displayed
  - Cancelled date displayed (if applicable)
- ✅ For free user:
  - "No subscription record found (Free user)" message

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-011: User Detail - SP Wallet Section

**Objective:** Verify SP wallet info displays correctly

**Steps:**
1. Check SP Wallet section
2. Test with a user who has SP wallet
3. Test with a user without SP wallet

**Expected Results:**
- ✅ For user with wallet:
  - Balance displayed (e.g., "50 SP")
  - Status displayed (active/frozen/suspended)
  - Lifetime earned displayed
  - Lifetime spent displayed
- ✅ For user without wallet:
  - "No SP wallet found" message

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-012: User Detail - Trade Activity Section

**Objective:** Verify trade stats display correctly

**Steps:**
1. Check Trade Activity section

**Expected Results:**
- ✅ Total completed trades count displayed
- ✅ Trades as seller count displayed
- ✅ Trades as buyer count displayed
- ✅ Last trade date displayed (or "N/A")

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-013: User Detail - Badges Section

**Objective:** Verify user badges display correctly

**Steps:**
1. Check Badges section
2. Test with a user who has badges
3. Test with a user without badges

**Expected Results:**
- ✅ Badge count displayed in heading
- ✅ For user with badges: badges listed with icon and name
- ✅ For user without badges: "No badges earned yet" message

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-014: User Detail - Recent Admin Activity

**Objective:** Verify admin activity log displays

**Steps:**
1. Check Recent Admin Activity section
2. Test with a user who has admin activity
3. Test with a user without activity

**Expected Results:**
- ✅ For user with activity:
  - Action type displayed
  - Admin email (performed by) displayed
  - Timestamp displayed
  - Notes displayed (if any)
  - Sorted newest first
  - Max 10 entries shown
- ✅ For user without activity:
  - "No admin activity yet" message

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-015: Suspend User Action

**Objective:** Verify admin can suspend a user

**Prerequisites:** Select an active user

**Steps:**
1. In user detail panel, click "Suspend User" button
2. When prompted, enter suspension reason: "Test suspension"
3. Click OK/Confirm
4. Confirm in confirmation dialog

**Expected Results:**
- ✅ Prompt asks for suspension reason
- ✅ Prompt rejects empty reason with error
- ✅ Confirmation dialog shows before suspension
- ✅ Success alert: "User suspended successfully"
- ✅ Detail panel closes
- ✅ User list refreshes
- ✅ Analytics header updates (suspended count +1, active count -1)
- ✅ Mobile app behavior (target suspended user):
  - User can still log in with valid credentials
  - User is redirected to a blocked screen: "Your account is currently suspended. Please contact admin for help"
  - Placeholder contact email is visible: `admin-support@kidsmarketplace.app`
  - User cannot access normal app flows while suspended
- ✅ In Supabase, verify:
  ```sql
  SELECT account_status, suspended_at, suspension_reason 
  FROM profiles WHERE user_id = '<user_id>';
  -- Expected: account_status = 'suspended', suspended_at IS NOT NULL
  ```
- ✅ Admin activity log entry created:
  ```sql
  SELECT * FROM admin_activity_log 
  WHERE entity_id = '<user_id>' AND action_type = 'suspend_user';
  ```

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-016: Unsuspend User Action

**Objective:** Verify admin can unsuspend a user

**Prerequisites:** Select a suspended user (or use user from TC-015)

**Steps:**
1. In user detail panel, click "Unsuspend User" button
2. When prompted, enter unsuspension reason: "Test unsuspension"
3. Click OK/Confirm

**Expected Results:**
- ✅ Prompt asks for unsuspension reason
- ✅ Prompt rejects empty reason with error
- ✅ Success alert: "User unsuspended successfully"
- ✅ Detail panel closes
- ✅ User list refreshes
- ✅ Analytics header updates (suspended count -1, active count +1)
- ✅ Mobile app behavior after unsuspend:
  - User can log in and no longer sees the suspended account screen
  - User is routed back to normal app flow based on onboarding/auth state
- ✅ In Supabase, verify:
  ```sql
  SELECT account_status, suspended_at, suspension_reason 
  FROM profiles WHERE user_id = '<user_id>';
  -- Expected: account_status = 'active', suspended_at IS NULL
  ```
- ✅ Admin activity log entry created

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-017: Reset Password Action

**Objective:** Verify admin can trigger password reset email

**Prerequisites:** Select any active user

**Steps:**
1. In user detail panel, click "Reset Password" button
2. Confirm in confirmation dialog
3. Wait for response

**Expected Results:**
- ✅ Confirmation dialog shows user's email
- ✅ Success alert: "Password reset email sent to <email>"
- ✅ Edge Function logs show password reset triggered
- ✅ Admin activity log entry created:
  ```sql
  SELECT * FROM admin_activity_log 
  WHERE entity_id = '<user_id>' AND action_type = 'trigger_password_reset';
  ```
- ✅ (If possible) Check user's email for reset link

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-018: Soft Delete User Action

**Objective:** Verify admin can soft delete a user

**Prerequisites:** Select a test user (NOT a real user or admin)

**Steps:**
1. In user detail panel, click "Delete User (Soft)" button
2. When prompted, enter deletion reason: "Test deletion - E2E"
3. Read the confirmation warning
4. Confirm deletion

**Expected Results:**
- ✅ Prompt asks for deletion reason
- ✅ Prompt rejects empty reason with error
- ✅ Confirmation dialog shows ⚠️ warning about soft delete
- ✅ Warning lists consequences: profile marked deleted, SP wallet frozen, user cannot login
- ✅ Success alert: "User deleted successfully (soft delete)"
- ✅ Detail panel closes
- ✅ User list refreshes (deleted user removed from list)
- ✅ Analytics header updates (deleted count +1, active count -1)
- ✅ Mobile app behavior (target deleted user):
  - User cannot log in to the app after soft delete
  - Login shows error: "Your account has been deleted. Please contact admin-support@kidsmarketplace.app."
  - If user had an active session, session is cleared on auth refresh/startup
- ✅ In Supabase, verify:
  ```sql
  SELECT deleted_at, deleted_by, deletion_reason, account_status 
  FROM profiles WHERE user_id = '<user_id>';
  -- Expected: deleted_at IS NOT NULL
  
  SELECT state FROM sp_wallets WHERE user_id = '<user_id>';
  -- Expected: state = 'frozen' (if wallet exists)
  ```
- ✅ Admin activity log entry created

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-019: Prevent Admin Self-Deletion

**Objective:** Verify admin cannot delete their own account

**Steps:**
1. Find the logged-in admin user in the list
2. Click to open detail panel
3. Click "Delete User (Soft)" button
4. Enter a deletion reason
5. Confirm

**Expected Results:**
- ✅ Error alert: "Admin cannot delete their own account" or similar
- ✅ Deletion does NOT proceed
- ✅ Admin user remains active

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-020: Close User Detail Panel

**Objective:** Verify panel can be closed properly

**Steps:**
1. Open any user detail panel
2. Click the "×" button in top-right corner

**Expected Results:**
- ✅ Panel closes
- ✅ User list remains visible
- ✅ No errors in console

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-021: Responsive Layout (Browser Resize)

**Objective:** Verify admin portal is usable at different screen sizes

**Steps:**
1. Resize browser window to narrow (mobile width)
2. Check navigation
3. Check user table
4. Resize to tablet width
5. Resize to desktop width

**Expected Results:**
- ✅ Navigation responsive (may collapse to menu)
- ✅ Analytics cards stack vertically on mobile
- ✅ User table scrollable horizontally on small screens
- ✅ Filters stack vertically on small screens
- ✅ User detail panel fits within viewport

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-022: Loading States

**Objective:** Verify loading indicators display during async operations

**Steps:**
1. Reload page and observe initial load
2. Search for a user and observe
3. Click a user to open detail panel and observe
4. Perform an admin action (suspend/unsuspend) and observe

**Expected Results:**
- ✅ "Loading..." message shows while fetching users
- ✅ Action buttons disable during admin actions
- ✅ No double-clicks / race conditions

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

### TC-023: Error Handling - Non-Admin User

**Objective:** Verify non-admin users cannot access user management

**Prerequisites:** Have a non-admin test account

**Steps:**
1. Logout from admin account
2. Login with non-admin account
3. Try to navigate to `/users`
4. (Or) Try to call `/api/admin/users` API directly

**Expected Results:**
- ✅ Non-admin redirected to login or error page
- ✅ API returns 403 Forbidden or 401 Unauthorized
- ✅ RPC raises "User is not an admin" exception

**Actual Results:**
- [ ] Pass
- [ ] Fail (reason: _____________)

---

## TEST SUMMARY

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001: Login & Navigation | [ ] | |
| TC-002: Analytics Display | [ ] | |
| TC-003: User List Display | [ ] | |
| TC-004: Search | [ ] | |
| TC-005: Account Status Filter | [ ] | |
| TC-006: Subscription Filter | [ ] | |
| TC-007: Pagination | [ ] | |
| TC-008: Open Detail Panel | [ ] | |
| TC-009: Identity Section | [ ] | |
| TC-010: Subscription Section | [ ] | |
| TC-011: SP Wallet Section | [ ] | |
| TC-012: Trade Activity | [ ] | |
| TC-013: Badges Section | [ ] | |
| TC-014: Admin Activity Log | [ ] | |
| TC-015: Suspend User | [ ] | |
| TC-016: Unsuspend User | [ ] | |
| TC-017: Reset Password | [ ] | |
| TC-018: Soft Delete User | [ ] | |
| TC-019: Prevent Self-Deletion | [ ] | |
| TC-020: Close Panel | [ ] | |
| TC-021: Responsive Layout | [ ] | |
| TC-022: Loading States | [ ] | |
| TC-023: Non-Admin Rejection | [ ] | |

**Total Passed:** ___ / 23  
**Total Failed:** ___ / 23

---

## CLEANUP

After testing, clean up test data:

```sql
-- Remove test users
DELETE FROM profiles WHERE name LIKE '%Test%' AND created_at > now() - interval '1 day';

-- Clean up test admin activity logs (optional)
DELETE FROM admin_activity_log WHERE notes LIKE '%E2E%' OR notes LIKE '%Test%';
```

---

## SIGN-OFF

**Tester Name:** _______________  
**Date:** _______________  
**Environment:** [ ] Staging [ ] Production  
**Overall Result:** [ ] All Pass [ ] Some Fail  
**Comments:** _______________________________________________

