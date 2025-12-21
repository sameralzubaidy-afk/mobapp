# Admin Control Testing Guide

## Overview

The Admin Portal (`p2p-kids-admin`) is a Next.js web application at `http://localhost:3001` that manages system-wide configuration. Currently implements:

1. **System Configuration** - Rate limits, verification settings
2. **SMS Statistics** - Monitor SMS verification usage
3. **Admin Authentication** - Admin secret key protection

---

## Prerequisites

### 1. Start the Admin Portal

```bash
cd p2p-kids-admin
npm run dev
```

**Expected Output:**
```
> ready - started server on 0.0.0.0:3001, url: http://localhost:3001
```

Access: **http://localhost:3001**

### 2. Start the Mobile App (Keep Running)

In another terminal:
```bash
cd p2p-kids-marketplace
yarn start
```

### 3. Start Supabase (Keep Running)

In another terminal:
```bash
cd supabase
supabase start
```

---

## Test 1: Admin Portal Home Page

### Steps

1. **Navigate to home page**
   ```
   http://localhost:3001
   ```

2. **Verify page loads**
   - Should show "Admin Portal" header
   - Should display navigation menu
   - Should show available sections

### Expected Result

✅ Clean admin dashboard layout  
✅ Navigation menu visible  
✅ No console errors

---

## Test 2: System Configuration Page

### Steps

1. **Navigate to config page**
   ```
   http://localhost:3001/config
   ```

2. **Verify configuration loads**
   - Page should load with "System Configuration" title
   - Should display 3 configuration items:
     - `sms_rate_limit_per_hour`
     - `verification_code_expiry_minutes`
     - `max_verification_attempts`

3. **View descriptions**
   - Hover over each config item
   - Should see helpful descriptions

### Expected Result

✅ All 3 config items display  
✅ Descriptions shown for each item  
✅ Current values visible  
✅ Edit input fields present  
✅ "Save" buttons available for each item

---

## Test 3: Edit Configuration Value

### Steps

1. **On config page, modify a value**
   ```
   sms_rate_limit_per_hour: 5 → 10
   ```

2. **Click "Save" button** for that config item

3. **Wait for success message**
   - Should see green success notification
   - Message: "Successfully updated sms_rate_limit_per_hour"

4. **Verify in database**
   ```bash
   supabase sql -- -c "SELECT key, value FROM admin_config WHERE key = 'sms_rate_limit_per_hour';"
   ```
   
   **Expected output:**
   ```
    key                        | value
   ----                        | -----
    sms_rate_limit_per_hour   | 10
   ```

### Expected Result

✅ Config value updates successfully  
✅ Success message appears  
✅ Database reflects change  
✅ Value persists after page reload

### Verify Database Persistence

5. **Reload config page** (F5)
   - New value should still display

---

## Test 4: Test Each Configuration Item

### Test 4a: SMS Rate Limit

1. **Change `sms_rate_limit_per_hour`** to `15`
2. **Click Save**
3. **Verify in mobile app** (subsequent tests)
   - Should reject >15 SMS per hour
   - Rate limit error should appear

### Test 4b: Verification Code Expiry

1. **Change `verification_code_expiry_minutes`** to `3` (for testing)
2. **Click Save**
3. **In mobile app, test signup:**
   ```
   - Enter phone number
   - Request verification code
   - Wait 3+ minutes
   - Try to use code
   → Should show "Code expired" error
   ```

### Test 4c: Max Verification Attempts

1. **Change `max_verification_attempts`** to `2` (for testing)
2. **Click Save**
3. **In mobile app, test signup:**
   ```
   - Enter phone number
   - Request verification code
   - Enter wrong code twice
   → Should show "Too many attempts" error
   → Should require new code
   ```

---

## Test 5: SMS Statistics Page

### Steps

1. **Navigate to SMS stats**
   ```
   http://localhost:3001/config (scroll to SMS stats section)
   ```
   
   OR if separate page:
   ```
   http://localhost:3001/sms-stats
   ```

2. **View SMS statistics**
   - Should display:
     - Total SMS sent today
     - Total SMS sent this hour
     - Unique phone numbers this hour
     - Rate-limited attempts

3. **Generate SMS traffic**
   ```
   In mobile app, sign up 3 new users with different phone numbers:
   - User 1: +1 555-0001
   - User 2: +1 555-0002
   - User 3: +1 555-0003
   ```

4. **Refresh SMS stats page**
   - "Total SMS sent this hour" should increase by 3
   - "Unique phone numbers this hour" should show 3

### Expected Result

✅ SMS stats page loads  
✅ Statistics display correctly  
✅ Numbers update after new signups  
✅ Rate limit tracking works

---

## Test 6: Admin Secret Protection

### Steps

1. **Try to save config WITHOUT admin secret header**
   
   Use curl:
   ```bash
   curl -X PATCH http://localhost:3001/api/admin/config \
     -H "Content-Type: application/json" \
     -d '{"key": "sms_rate_limit_per_hour", "value": "20"}'
   ```

2. **Verify error response**
   - Should get 401 or 403 error
   - Message: "Unauthorized" or similar

3. **Try WITH admin secret**
   ```bash
   export ADMIN_SECRET=$(grep NEXT_PUBLIC_ADMIN_UI_SECRET p2p-kids-admin/.env.local | cut -d= -f2)
   
   curl -X PATCH http://localhost:3001/api/admin/config \
     -H "Content-Type: application/json" \
     -H "x-admin-secret: $ADMIN_SECRET" \
     -d '{"key": "sms_rate_limit_per_hour", "value": "20"}'
   ```

4. **Verify success response**
   - Should get 200 OK
   - Config updated successfully

### Expected Result

✅ Requests without secret are rejected  
✅ Requests with secret are accepted  
✅ Security header validation works

---

## Test 7: End-to-End: Config Change Affects Mobile App

### Complete Flow

**Step 1: Reduce SMS rate limit (Admin)**
```
1. Go to http://localhost:3001/config
2. Set sms_rate_limit_per_hour = 1 (for testing)
3. Click Save
4. Verify success
```

**Step 2: Test rate limiting in mobile app**
```
1. Open mobile app
2. Go to Signup screen
3. Enter phone number: +1 555-1234
4. Click "Request Code"
   → First request succeeds ✅
5. Immediately click "Request Code" again
   → Should fail with "Rate limit exceeded" ✅
```

**Step 3: Increase rate limit back (Admin)**
```
1. Go to http://localhost:3001/config
2. Set sms_rate_limit_per_hour = 5 (normal)
3. Click Save
```

### Expected Result

✅ Admin can change config  
✅ Mobile app respects new limit  
✅ Rate limiting works correctly  
✅ Changes take effect immediately

---

## Test 8: Handle Errors

### Test Invalid Values

1. **Try to set `sms_rate_limit_per_hour` to `-5`**
   - Should show error
   - Value should not update

2. **Try to set `verification_code_expiry_minutes` to `abc`**
   - Should show error
   - Value should not update

### Expected Result

✅ Invalid values rejected  
✅ Error messages shown  
✅ Previous values preserved

---

## Test 9: Page Reload & Persistence

### Steps

1. **Make config changes**
   ```
   sms_rate_limit_per_hour = 12
   verification_code_expiry_minutes = 7
   ```

2. **Reload page** (Cmd+R / Ctrl+R)

3. **Verify values persist**
   - Both values should still show as changed

### Expected Result

✅ Values persist after reload  
✅ No loss of data  
✅ Config correctly hydrated on page load

---

## Test 10: Concurrent User Simulation

### Steps (Open 2 browser windows/tabs)

**Tab 1: Admin Portal**
```
http://localhost:3001/config
```

**Tab 2: Admin Portal (same)**
```
http://localhost:3001/config
```

1. **In Tab 1: Change `sms_rate_limit_per_hour` to 8**
2. **Click Save**
3. **Switch to Tab 2**
4. **Change same value to 15**
5. **Click Save**
6. **Verify in database:**
   ```bash
   supabase sql -- -c "SELECT value FROM admin_config WHERE key = 'sms_rate_limit_per_hour';"
   ```
   - Should show `15` (last write wins)

### Expected Result

✅ Last update wins  
✅ No corruption  
✅ Both requests handled correctly

---

## Test 11: Check Admin API Endpoints

### Endpoint 1: GET /api/admin/config

```bash
curl http://localhost:3001/api/admin/config
```

**Expected Response:**
```json
{
  "can_write": true,
  "data": [
    {
      "key": "sms_rate_limit_per_hour",
      "value": "10",
      "description": "Maximum number of SMS...",
      "created_at": "2024-12-16T...",
      "updated_at": "2024-12-16T..."
    },
    ...
  ]
}
```

### Endpoint 2: PATCH /api/admin/config

```bash
curl -X PATCH http://localhost:3001/api/admin/config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_SECRET_HERE" \
  -d '{
    "key": "verification_code_expiry_minutes",
    "value": "10"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Config updated successfully",
  "data": {
    "key": "verification_code_expiry_minutes",
    "value": "10",
    ...
  }
}
```

### Endpoint 3: GET /api/admin/sms-stats

```bash
curl http://localhost:3001/api/admin/sms-stats
```

**Expected Response:**
```json
{
  "data": {
    "totalSentToday": 15,
    "totalSentThisHour": 3,
    "uniquePhonesThisHour": 3,
    "rateLimitedAttempts": 2
  }
}
```

---

## Quick Test Checklist

- [ ] Admin portal starts on localhost:3001
- [ ] Config page loads with 3 items
- [ ] Can edit and save config values
- [ ] Values persist after reload
- [ ] SMS stats display
- [ ] Admin secret required for writes
- [ ] Rate limiting works in mobile app
- [ ] Config changes affect mobile behavior
- [ ] No console errors
- [ ] No database errors

---

## Troubleshooting

### Admin portal won't start

```bash
# Clear cache and reinstall
cd p2p-kids-admin
rm -rf .next node_modules
npm install
npm run dev
```

### Config values not loading

```bash
# Check Supabase is running
supabase status

# Check admin_config table exists
supabase sql -- -c "\dt admin_config"

# Check table has data
supabase sql -- -c "SELECT * FROM admin_config;"
```

### Admin secret not working

```bash
# Check environment variable
cat p2p-kids-admin/.env.local | grep NEXT_PUBLIC_ADMIN_UI_SECRET

# If missing, regenerate
echo "NEXT_PUBLIC_ADMIN_UI_SECRET=$(openssl rand -hex 16)" >> p2p-kids-admin/.env.local
```

### SMS stats not updating

```bash
# Check Supabase RPC function exists
supabase sql -- -c "SELECT * FROM pg_proc WHERE proname = 'get_sms_stats';"

# Check SMS audit table
supabase sql -- -c "SELECT COUNT(*) FROM audit_logs WHERE action LIKE '%sms%';"
```

---

## Success Criteria

✅ All configuration items load  
✅ All values can be edited  
✅ Changes persist in database  
✅ Mobile app respects new config  
✅ Admin authentication works  
✅ SMS stats track correctly  
✅ No errors in console or network  
✅ API endpoints respond correctly  

---

**Date**: December 16, 2025  
**Status**: Ready for testing
