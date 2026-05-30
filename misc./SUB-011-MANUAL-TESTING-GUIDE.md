# SUB-011 Manual Testing Guide: Admin Subscription Management & Analytics

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-011 - Admin Subscription Management & Analytics + Grace Period Config  
**Test Environment:** Admin Portal (p2p-kids-admin)  
**Prerequisites:**
- Admin portal running locally or deployed
- Valid admin credentials
- `ADMIN_UI_SECRET` configured for protected actions
- Supabase production database with test subscription data

---

## Test Setup

### Initial Setup

1. **Start Admin Portal:**
   ```bash
   cd p2p-kids-admin
   npm run dev
   ```

2. **Access URL:** `http://localhost:3001` (or your deployed URL)

3. **Navigate to Subscriptions:**
   - From homepage, click "Subscriptions" card
   - Should redirect to `/subscriptions/manage`

---

## Test Cases

### TC-SUB-011-001: View Subscription Metrics Dashboard

#### Test Steps:
1. Navigate to `/subscriptions/manage`
2. Wait for data to load (~2-3 seconds)

#### Expected Results:
- ✅ **Metrics Cards Displayed:**
  - MRR (Monthly Recurring Revenue) in dollars (e.g., "$49.90")
  - Active Subscribers count
  - Trial Users count
  - Grace Period Users count
  - Churn Rate as percentage (e.g., "5.2%")
- ✅ All metrics show numbers ≥ 0
- ✅ MRR format: `$XX.XX` (dollars with cents)
- ✅ No loading spinner after ~3 seconds
- ✅ No error messages displayed

#### Acceptance Criteria:
- Metrics accurately reflect database state
- MRR = sum of `monthly_price_cents` for all active subscribers ÷ 100
- Churn rate formula: (cancelled + expired) / total * 100

---

### TC-SUB-011-002: Filter Subscriptions by Status

#### Test Steps:
1. At `/subscriptions/manage`, observe filter buttons
2. Click "Trial" filter button
3. Verify table shows only trial users
4. Click "Active" filter button
5. Verify table shows only active subscribers
6. Click "Grace Period" filter button
7. Click "All" filter button

#### Expected Results:
- ✅ Filter buttons highlight when selected (blue background)
- ✅ Table updates immediately after clicking filter
- ✅ "Trial" filter shows only `status = 'trial'` rows
- ✅ "Active" filter shows only `status = 'active'` rows
- ✅ "Grace Period" filter shows only `status = 'grace_period'` rows
- ✅ "Cancelled" filter shows rows with `cancelled_at` not null
- ✅ "All" filter shows all subscriptions
- ✅ Pagination resets to page 1 when filter changes

#### Acceptance Criteria:
- Status badge color matches status (green=active, blue=trial, yellow=grace_period, orange=cancelled, red=expired)
- Filter state persists during same session

---

### TC-SUB-011-003: View Grace Period Configuration

#### Test Steps:
1. At `/subscriptions/manage`, scroll to "Grace Period Configuration" section
2. Observe current values

#### Expected Results:
- ✅ **Grace Period Days field:**
  - Shows current value (e.g., "90")
  - Label: "Grace Period Days"
  - Description: "Number of days users have to re-subscribe before their Swap Points are deleted. Default: 90 days."
- ✅ **Reminder Thresholds field:**
  - Shows current value (e.g., "60, 30, 7, 1")
  - Label: "Reminder Thresholds (days before expiry)"
  - Description includes example format
- ✅ Both fields editable (input boxes)
- ✅ "Save" buttons enabled for each field

#### Acceptance Criteria:
- Config values match `admin_config` table in database
- UI clearly explains what each setting does

---

### TC-SUB-011-004: Update Grace Period Days

#### Test Steps:
1. In "Grace Period Days" field, clear value and type "60"
2. Click "Save" button
3. Wait for success message

#### Expected Results:
- ✅ Button shows "Saving..." briefly (< 2 seconds)
- ✅ Green success message appears: "✓ Grace period days updated successfully"
- ✅ "Current: 60 days" text updates below field
- ✅ Success message auto-dismisses after 5 seconds
- ✅ No errors displayed

#### Verification:
```sql
-- Run in Supabase SQL Editor
SELECT value FROM admin_config WHERE key = 'grace_period_days';
-- Should return '60'
```

#### Cleanup:
- Reset to 90 days after test:
  1. Enter "90" in field
  2. Click "Save"

#### Acceptance Criteria:
- Database value matches UI input
- Config change takes effect immediately for new grace period entries

---

### TC-SUB-011-005: Update Grace Reminder Thresholds

#### Test Steps:
1. In "Reminder Thresholds" field, clear value and type "90, 60, 30, 14, 7, 3, 1"
2. Click "Save" button
3. Wait for success message

#### Expected Results:
- ✅ Button shows "Saving..." briefly
- ✅ Green success message: "✓ Reminder thresholds updated successfully"
- ✅ "Current: 90, 60, 30, 14, 7, 3, 1" text updates below field
- ✅ No errors displayed

#### Verification:
```sql
-- Run in Supabase SQL Editor
SELECT value FROM admin_config WHERE key = 'grace_reminder_thresholds';
-- Should return '[90,60,30,14,7,3,1]' (JSON array)
```

#### Error Handling Test:
1. Try invalid input: "abc, xyz"
2. Click "Save"
3. Should show error message

#### Acceptance Criteria:
- Valid comma-separated integers accepted
- Invalid input (non-numeric, negative) rejected with error
- Parsed as JSON array in database

---

### TC-SUB-011-006: View Subscription List Table

#### Test Steps:
1. At `/subscriptions/manage`, scroll to subscription table
2. Observe table columns and data

#### Expected Results:
- ✅ **Columns displayed:**
  - User (name + email)
  - Status (with colored badge)
  - Price (e.g., "$4.99")
  - Period End (formatted date)
  - Grace Ends (formatted date or "N/A")
  - Updated (last update timestamp)
  - Actions (buttons)
- ✅ At least 1 row displayed (or "No subscriptions found" message)
- ✅ User names and emails visible
- ✅ Status badges color-coded correctly
- ✅ Dates formatted as "Jan 15, 2026" (readable format)
- ✅ Table scrolls horizontally on narrow screens

#### Acceptance Criteria:
- Profile data joins correctly (display_name from profiles.name)
- Grace Ends only shows date when status = 'grace_period'
- Period End shows `current_period_end` or `trial_ends_at`

---

### TC-SUB-011-007: Extend Trial (Admin Action)

#### Prerequisites:
- At least one user with `status = 'trial'`

#### Test Steps:
1. Find a trial user in the table
2. Click "Extend Trial" button in Actions column
3. In prompt dialog, enter "7" days
4. Click OK/Confirm
5. Wait for action to complete

#### Expected Results:
- ✅ Button shows "Processing..." during action (~1-2 seconds)
- ✅ Green success message appears: "✓ Trial extended by 7 days..."
- ✅ Table refreshes automatically
- ✅ User's "Period End" date updated (+7 days from previous)
- ✅ Status remains "trial"
- ✅ Action button re-enables after completion

#### Verification:
```sql
-- Run in Supabase SQL Editor
SELECT trial_end_date, current_period_end FROM subscriptions WHERE user_id = '<test_user_id>';
-- Should be 7 days later than before
```

#### Error Handling Tests:
1. Try extending with invalid days (e.g., "0", "100", "abc")
2. Should show error alert
3. Try extending non-trial user
4. Should show error: "Can only extend trial for users currently in trial status"

#### Acceptance Criteria:
- Trial end date extends by exact number of days entered
- Audit log created in `admin_audit_logs` table
- Only trial users show "Extend Trial" button

---

### TC-SUB-011-008: Manually Cancel Subscription (Admin Action)

#### Prerequisites:
- At least one user with `status = 'active'` or `status = 'trial'`

#### Test Steps:
1. Find an active or trial user in the table
2. Click "Cancel" button in Actions column
3. Confirm cancellation in dialog
4. Wait for action to complete

#### Expected Results:
- ✅ Confirmation dialog shows: "Are you sure you want to manually cancel subscription for [User Name]?"
- ✅ Button shows "Processing..." during action
- ✅ Green success message: "✓ Subscription moved to grace_period"
- ✅ Table refreshes automatically
- ✅ User's status changes to "grace_period"
- ✅ "Grace Ends" column now shows date (~90 days from now)
- ✅ "Actions" column now shows "Reactivate" button instead of "Cancel"

#### Verification:
```sql
-- Run in Supabase SQL Editor
SELECT status, cancelled_at, cancel_reason, grace_ends_at 
FROM subscriptions 
WHERE user_id = '<test_user_id>';
-- status = 'grace_period'
-- cancelled_at = current timestamp
-- cancel_reason = 'admin_override'
-- grace_ends_at = ~90 days from now
```

#### Acceptance Criteria:
- Active users → grace_period (not immediate expiry)
- `cancelled_at` and `cancel_reason` recorded
- Audit log created
- SP wallet freeze triggered (MODULE-09 integration)

---

### TC-SUB-011-009: Reactivate Subscription (Admin Action)

#### Prerequisites:
- At least one user with `status = 'cancelled'`, `'grace_period'`, or `'expired'`

#### Test Steps:
1. Find a cancelled/grace_period/expired user in the table
2. Click "Reactivate" button in Actions column
3. Confirm reactivation in dialog
4. Wait for action to complete

#### Expected Results:
- ✅ Confirmation dialog shows: "Are you sure you want to manually reactivate subscription for [User Name]? This will set status to active."
- ✅ Button shows "Processing..." during action
- ✅ Green success message: "✓ Subscription reactivated successfully. Status set to active."
- ✅ Table refreshes automatically
- ✅ User's status changes to "active"
- ✅ "Grace Ends" column now shows "N/A"
- ✅ "Period End" column shows new date (~30 days from now)
- ✅ "Actions" column now shows "Cancel" button instead of "Reactivate"

#### Verification:
```sql
-- Run in Supabase SQL Editor
SELECT status, cancelled_at, grace_ends_at, current_period_start, current_period_end
FROM subscriptions 
WHERE user_id = '<test_user_id>';
-- status = 'active'
-- cancelled_at = NULL
-- grace_ends_at = NULL
-- current_period_start = current timestamp
-- current_period_end = ~30 days from now
```

#### Acceptance Criteria:
- Status set to 'active'
- Grace period fields cleared
- New billing period set (30 days)
- SP wallet unfrozen (MODULE-09 integration)
- Audit log created

---

### TC-SUB-011-010: Admin Actions Security

#### Test Steps:
1. Open browser DevTools → Network tab
2. Trigger any admin action (extend trial, cancel, or reactivate)
3. Observe the POST request to `/api/admin/subscriptions/actions`
4. Note the `x-admin-secret` header

#### Expected Results:
- ✅ Request includes `x-admin-secret` header
- ✅ Request body includes `action`, `user_id`, and optional parameters
- ✅ Response returns 200 OK with success message
- ✅ Without valid secret, returns 401 Unauthorized

#### Security Test:
1. Use curl or Postman to send request without `x-admin-secret`:
   ```bash
   curl -X POST http://localhost:3001/api/admin/subscriptions/actions \
     -H "Content-Type: application/json" \
     -d '{"action":"manually_cancel","user_id":"test-user-id"}'
   ```
2. Should return 401 error

#### Acceptance Criteria:
- All admin actions protected by admin secret
- Unauthorized requests rejected
- No sensitive data leaked in error messages

---

### TC-SUB-011-011: MRR Calculation Accuracy

#### Test Steps:
1. At `/subscriptions/manage`, note the displayed MRR
2. Click "Active" filter
3. Count number of active subscribers in table
4. Calculate expected MRR: `active_count × $4.99`
5. Compare with displayed MRR

#### Expected Results:
- ✅ Displayed MRR matches manual calculation (within $0.10)
- ✅ MRR only includes `status = 'active'` users
- ✅ Trial users do NOT contribute to MRR
- ✅ Grace period users do NOT contribute to MRR

#### Manual Verification:
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) * 499 AS expected_mrr_cents
FROM subscriptions
WHERE status = 'active';
-- Compare with dashboard MRR (convert to cents)
```

#### Acceptance Criteria:
- Formula: `MRR = SUM(monthly_price_cents) WHERE status = 'active'`
- Displayed in dollars with 2 decimal places

---

### TC-SUB-011-012: Churn Rate Calculation Accuracy

#### Test Steps:
1. At `/subscriptions/manage`, note the displayed Churn Rate
2. Click "All" filter
3. Count total subscriptions
4. Count cancelled + expired subscriptions
5. Calculate expected churn: `(cancelled + expired) / total × 100`
6. Compare with displayed Churn Rate

#### Expected Results:
- ✅ Displayed Churn Rate matches manual calculation (within 0.1%)
- ✅ Formula includes both cancelled and expired users
- ✅ Percentage displayed with 1 decimal place (e.g., "15.3%")

#### Manual Verification:
```sql
-- Run in Supabase SQL Editor
SELECT 
  COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL OR status = 'expired') * 100.0 / COUNT(*) AS churn_rate
FROM subscriptions;
-- Compare with dashboard Churn Rate
```

#### Acceptance Criteria:
- Formula: `(cancelled_count + expired_count) / total_count × 100`
- Displayed as percentage with 1 decimal

---

### TC-SUB-011-013: Empty State Handling

#### Test Steps:
1. Apply a filter that returns no results (e.g., if no expired users exist, click "Expired")

#### Expected Results:
- ✅ Empty state message displayed: "No subscriptions found for the selected filter."
- ✅ No table displayed (or empty table body)
- ✅ No loading spinner
- ✅ No error message
- ✅ Filter buttons still functional

#### Acceptance Criteria:
- Clear messaging when no data available
- UI remains functional (can switch filters)

---

### TC-SUB-011-014: Error Handling

#### Test Steps:
1. Disconnect internet or stop Supabase service
2. Refresh `/subscriptions/manage` page
3. Observe error behavior

#### Expected Results:
- ✅ Error message displayed (red background)
- ✅ Error text: "Error: [description]"
- ✅ No metrics cards shown (or show "0" values)
- ✅ No table shown
- ✅ Page doesn't crash (no blank screen)

#### Recovery Test:
1. Restore internet/service
2. Refresh page
3. Should load normally

#### Acceptance Criteria:
- Graceful error handling
- No console errors that crash the app
- Clear user messaging

---

## Test Summary Checklist

After completing all test cases, verify:

- [ ] Subscription metrics display correctly
- [ ] Filtering works for all statuses
- [ ] Grace period config can be viewed and updated
- [ ] Admin actions (extend trial, cancel, reactivate) work correctly
- [ ] Security (admin secret) enforced
- [ ] MRR and churn rate calculations accurate
- [ ] Empty states and errors handled gracefully
- [ ] Audit logs created for all admin actions
- [ ] No console errors or warnings
- [ ] UI responsive on different screen sizes

---

## Known Issues / Edge Cases

1. **Grace → Re-subscribe Rate:**
   - Currently hardcoded to `0`
   - TODO: Implement historical tracking

2. **Profile Data Missing:**
   - If user has no profile, shows "No Name" / "No Email"
   - Expected behavior per implementation

3. **Pagination:**
   - Implemented with `limit`/`offset`
   - Test: load 50+ subscriptions and verify pagination works

---

## Test Data Cleanup

After testing, optionally reset test data:

```sql
-- Restore grace period config to defaults
UPDATE admin_config SET value = '90' WHERE key = 'grace_period_days';
UPDATE admin_config SET value = '[60,30,7,1]' WHERE key = 'grace_reminder_thresholds';

-- Delete test subscriptions (optional)
DELETE FROM subscriptions WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-sub-%@example.com'
);
```

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| QA Engineer | ______ | ______ | ☐ Pass ☐ Fail |
| Product Owner | ______ | ______ | ☐ Approved |
| Tech Lead | ______ | ______ | ☐ Approved |

**Notes:**
