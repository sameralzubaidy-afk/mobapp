# AUTH-003: SMS Rate Limiting Admin UI - Testing Guide

## ✅ Implementation Complete

**Task:** AUTH-003 - Implement SMS Rate Limiting (Admin Configurable)  
**Module:** MODULE-02-AUTHENTICATION  
**Status:** ✅ COMPLETE

---

## 📁 Files Created/Modified

### Admin Portal (Next.js)
1. **`p2p-kids-admin/src/app/config/page.tsx`** - Main admin config UI
2. **`p2p-kids-admin/src/types/config.ts`** - TypeScript types for config
3. **`p2p-kids-admin/src/app/layout.tsx`** - Root layout with navigation
4. **`p2p-kids-admin/src/app/page.tsx`** - Home page with dashboard
5. **`p2p-kids-admin/src/app/globals.css`** - Global styles
6. **`p2p-kids-admin/package.json`** - Dependencies
7. **`p2p-kids-admin/tsconfig.json`** - TypeScript config
8. **`p2p-kids-admin/tailwind.config.js`** - Tailwind CSS config
9. **`p2p-kids-admin/postcss.config.js`** - PostCSS config
10. **`p2p-kids-admin/next.config.js`** - Next.js config

### Database
11. **`supabase/seed_admin_config.sql`** - Seed admin_config table with default values

---

## 🚀 Quick Start Commands

### 1. Seed Admin Config Table
```bash
# Navigate to project root
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Run seed file via Supabase CLI
npx supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres"

# OR manually run seed file
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed_admin_config.sql
```

### 2. Install Admin Portal Dependencies
```bash
cd p2p-kids-admin
npm install
# OR if you prefer yarn (you have yarn.lock)
yarn install
```

### 3. Configure Environment Variables
```bash
# Edit p2p-kids-admin/.env.local
# Add:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Start Admin Portal
```bash
cd p2p-kids-admin
npm run dev
# Opens at http://localhost:3001
```

---

## 🧪 Manual Testing Steps

### Test 1: View Configuration Page
1. Open browser: **http://localhost:3001/config**
2. ✅ Should see "System Configuration" page
3. ✅ Should see SMS Usage Statistics cards:
   - Today Total
   - Last Hour
   - Unique Phones
   - Rate Limited
4. ✅ Should see Configuration Settings section with:
   - `sms_rate_limit_per_hour` (default: 10)
   - `verification_code_expiry_minutes` (default: 10)
   - `max_verification_attempts` (default: 3)

### Test 2: Edit SMS Rate Limit
1. In `sms_rate_limit_per_hour` field, change value to **5**
2. Click **Save** button
3. ✅ Should see green success message: "Successfully updated sms_rate_limit_per_hour"
4. ✅ "Last updated" timestamp should refresh
5. ✅ Verify in database:
   ```sql
   SELECT * FROM admin_config WHERE key = 'sms_rate_limit_per_hour';
   ```
   Expected: `value = '5'`

### Test 3: Validation - Invalid Input
1. In `sms_rate_limit_per_hour` field, enter **-5** (negative)
2. Click **Save**
3. ✅ Should see red error message: "SMS rate limit must be a positive integer"
4. ✅ Database should NOT be updated

### Test 4: Validation - Non-numeric Input
1. Enter **"abc"** in SMS rate limit field
2. Click **Save**
3. ✅ Should see error message
4. ✅ Value should not be saved

### Test 5: Audit Log Verification
1. Change `sms_rate_limit_per_hour` from **5** to **15**
2. Click **Save**
3. ✅ Verify audit log created:
   ```sql
   SELECT * FROM audit_logs 
   WHERE action = 'UPDATE_CONFIG' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
   Expected fields:
   - `action = 'UPDATE_CONFIG'`
   - `resource_type = 'admin_config'`
   - `resource_id = 'sms_rate_limit_per_hour'`
   - `details` contains old_value and new_value

### Test 6: SMS Stats Real-time Updates
1. View SMS Usage Statistics section
2. Note current counts
3. From mobile app, trigger SMS verification (signup with new user)
4. Wait 5 seconds, click **Refresh** button in stats section
5. ✅ "Last Hour" count should increment by 1
6. ✅ "Unique Phones" should increment if new phone number

### Test 7: Rate Limit Enforcement (Integration Test)
1. Set `sms_rate_limit_per_hour` to **3**
2. Save the configuration
3. From mobile app, attempt to send 4 SMS codes to same phone within 1 hour:
   ```bash
   # Test script (run 4 times in succession)
   curl -X POST http://localhost:54321/functions/v1/send-verification-code \
     -H "Content-Type: application/json" \
     -d '{"phone": "+15555551234"}'
   ```
4. ✅ First 3 attempts should succeed
5. ✅ 4th attempt should fail with: "Too many verification codes sent"
6. ✅ "Rate Limited" count in stats should show 1

### Test 8: Navigation
1. Click **P2P Kids Admin** logo in top left
2. ✅ Should navigate to home page (http://localhost:3001)
3. ✅ Home page should show 3 cards:
   - Configuration
   - Users
   - Audit Logs
4. Click **Configuration** card
5. ✅ Should navigate back to /config

### Test 9: UI Responsiveness
1. Resize browser window to mobile size (375px width)
2. ✅ Navigation should remain functional
3. ✅ Stats cards should stack vertically
4. ✅ Config form should be readable and usable
5. ✅ Save button should remain accessible

### Test 10: Loading States
1. Refresh config page
2. ✅ Should briefly show loading spinner
3. ✅ After load, spinner disappears and config displays
4. Click **Save** on any config item
5. ✅ Button should show "Saving..." during save
6. ✅ Button should return to "Save" after completion

---

## 🗄️ Database Verification

### Check Admin Config Table
```sql
-- View all config items
SELECT key, value, description, created_at, updated_at 
FROM admin_config 
ORDER BY key;

-- Expected rows:
-- sms_rate_limit_per_hour | 10 | Max SMS per hour...
-- verification_code_expiry_minutes | 10 | Code expiry...
-- max_verification_attempts | 3 | Max attempts...
-- max_login_attempts | 5 | Max failed logins...
-- password_reset_expiry_minutes | 15 | Password reset expiry...
-- referral_bonus_points | 50 | Points for referral...
-- referral_window_days | 60 | Days to claim bonus...
```

### Check SMS Rate Limit Log
```sql
-- View recent SMS sends
SELECT phone, user_id, sms_type, rate_limited, sent_at
FROM sms_rate_limit_log
ORDER BY sent_at DESC
LIMIT 10;

-- Count SMS per phone in last hour
SELECT phone, COUNT(*) as sms_count
FROM sms_rate_limit_log
WHERE sent_at > NOW() - INTERVAL '1 hour'
GROUP BY phone
ORDER BY sms_count DESC;
```

### Check Audit Logs
```sql
-- View config changes
SELECT 
  user_id,
  action,
  resource_type,
  resource_id,
  details,
  created_at
FROM audit_logs
WHERE action = 'UPDATE_CONFIG'
ORDER BY created_at DESC
LIMIT 5;
```

---

## ✅ MODULE-02-VERIFICATION.md Items Satisfied

From `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/MODULE-02-VERIFICATION.md`:

### Task AUTH-003 Checklist:
- [x] **Admin config management screen** - Created `p2p-kids-admin/src/app/config/page.tsx`
- [x] **View current SMS rate limit** - Displays in Configuration Settings section
- [x] **Edit SMS rate limit** - Input field with Save button
- [x] **Validate input (positive integer)** - Validates before saving
- [x] **Show SMS usage statistics** - Real-time stats cards (today, hour, unique, rate limited)
- [x] **Audit trail logging** - Logs all config changes to `audit_logs` table
- [x] **Navigation between admin pages** - Layout with nav links (Config, Users, Audit Logs)
- [x] **Error handling** - Shows red error messages for failures
- [x] **Success feedback** - Shows green success messages after save
- [x] **Loading states** - Spinner during data fetch and save
- [x] **Responsive design** - Mobile-friendly layout with Tailwind CSS

### Admin Portal Deliverables:
- [x] `admin/app/config/page.tsx` - Admin config UI ✅
- [x] Admin navigation layout ✅
- [x] TypeScript types for config ✅
- [x] Integration with Supabase RLS ✅

---

## 📊 Expected Behavior

### Default Configuration Values:
| Key | Default Value | Description |
|-----|---------------|-------------|
| `sms_rate_limit_per_hour` | 10 | Max SMS per hour per phone |
| `verification_code_expiry_minutes` | 10 | Code expiry time |
| `max_verification_attempts` | 3 | Max wrong code attempts |
| `max_login_attempts` | 5 | Max failed logins |
| `password_reset_expiry_minutes` | 15 | Password reset token expiry |
| `referral_bonus_points` | 50 | Points for referrals |
| `referral_window_days` | 60 | Days to claim referral |

### SMS Rate Limit Logic:
- **Enforcement:** Checked in `check_sms_rate_limit()` Postgres function
- **Window:** Rolling 1-hour window (last 60 minutes)
- **Scope:** Per phone number (not per user, to prevent multiple account abuse)
- **Logging:** All SMS attempts logged to `sms_rate_limit_log` table
- **Override:** Admins can adjust limit via config page

---

## 🔧 Troubleshooting

### Issue: "Failed to load configuration"
**Solution:** 
- Check Supabase is running: `npx supabase status`
- Verify `admin_config` table exists
- Run seed file: `psql ... -f supabase/seed_admin_config.sql`

### Issue: "SMS stats show 0 for everything"
**Solution:**
- Check `sms_rate_limit_log` table has data
- Try sending SMS from mobile app first
- Verify RLS policies allow admin to read table

### Issue: "Unauthorized" when saving config
**Solution:**
- Ensure admin user is authenticated
- Check RLS policies on `admin_config` table
- Verify `audit_logs` table allows INSERT

### Issue: Admin portal won't start
**Solution:**
```bash
cd p2p-kids-admin
rm -rf node_modules .next
npm install
npm run dev
```

### Issue: Can't connect to Supabase
**Solution:**
- Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verify Supabase is running: `npx supabase status`
- Check network: `curl http://localhost:54321/rest/v1/admin_config`

---

## 🎯 Success Criteria

All these should be true after testing:

✅ Admin config page loads without errors  
✅ SMS rate limit displays current value from database  
✅ Changing SMS rate limit updates database  
✅ Input validation prevents invalid values  
✅ Audit logs capture all config changes  
✅ SMS stats display real-time data  
✅ Rate limit is enforced in mobile app signup flow  
✅ Navigation works between admin pages  
✅ UI is responsive and mobile-friendly  
✅ Loading and error states display correctly  

---

## 📝 Next Steps

After verifying AUTH-003:
1. ✅ Proceed to AUTH-004 (Age Verification) - **DEFERRED to Post-MVP**
2. ✅ Continue with AUTH-005 (User Profile Creation)
3. Test end-to-end signup flow with SMS rate limiting
4. Add more admin config items as needed (e.g., feature flags, pricing)

---

## 📚 Related Files

- **Mobile App SMS Service:** `p2p-kids-marketplace/src/services/verification.ts`
- **Database Migration:** `supabase/migrations/20241213000002_add_referral_system_tables.sql`
- **Rate Limit Function:** Lines 350-378 in migration file (`check_sms_rate_limit()`)
- **Module Prompt:** `Prompts/MODULE-02-AUTHENTICATION.md` (Lines 1408+)
- **Verification File:** `Prompts/MODULE-02-VERIFICATION.md`

---

**Implementation Date:** December 14, 2024  
**Implemented By:** GitHub Copilot (Claude Sonnet 4.5)  
**Status:** ✅ COMPLETE - Ready for Manual Testing
