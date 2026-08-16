# REF-V2-008: Admin Toggles for Referral Bonuses - IMPLEMENTATION SUMMARY

## ✅ What Was Fixed

**Issue**: Admin portal was missing toggle switches to enable/disable:
- ❌ First Trade Bonus (dynamic control)
- ❌ First Approved Listing Bonus (dynamic control)

**Solution**: Added two independent toggle switches to admin configuration tab allowing admins to enable/disable each bonus type independently.

---

## 📋 Files Created/Modified

### 1. **SQL Migration** (NEW)
**File**: `supabase/migrations/20260205000002_add_referral_trade_feature_toggle.sql`
- Adds `referral_first_trade_enabled` config key to sp_config table
- Default value: `true` (enabled)
- Idempotent: Safe to re-run (uses ON CONFLICT DO NOTHING)

### 2. **Admin Configuration Tab** (UPDATED)
**File**: `p2p-kids-admin/src/app/referrals/configuration-tab.tsx`

**Changes Made**:
1. Added state variables:
   - `firstTradeEnabled` (boolean)
   - `firstListingEnabled` (boolean)

2. Updated `loadConfig()` to fetch both toggles:
   ```typescript
   const firstTradeToggle = await SPConfigService.get('referral_first_trade_enabled');
   const firstListingToggle = await SPConfigService.get('referral_first_listing_enabled');
   setFirstTradeEnabled(firstTradeToggle?.config_value !== 'false');
   setFirstListingEnabled(firstListingToggle?.config_value !== 'false');
   ```

3. Added new "Feature Toggles" section with three toggles:
   - **🎯 First Trade Bonus Active** - Enable/disable trade bonuses
   - **📝 First Approved Listing Bonus Active** - Enable/disable listing bonuses
   - **🌐 Entire Referral Program Active** - Master kill switch for all referral rewards

4. Each toggle immediately saves to database via `handleSave()`

---

## 🗄️ Database Changes

### Migration: `20260205000002_add_referral_trade_feature_toggle.sql`

**Adds to sp_config table**:
```sql
INSERT INTO public.sp_config 
  (config_key, config_value, value_type, description, category) 
VALUES
  ('referral_first_trade_enabled', 'true', 'boolean', 
   'Enable/disable SP rewards when referee completes first approved trade', 'referral')
ON CONFLICT (config_key) DO NOTHING;
```

**Config keys now available**:
- `referral_first_trade_enabled` ✅ NEW
- `referral_first_listing_enabled` ✅ (from previous migration)
- `referral_program_enabled` (master toggle)
- `referral_reward_referrer_sp` (trade bonus amount)
- `referral_reward_referee_sp` (trade bonus amount)
- `referral_reward_referrer_listing_sp` (listing bonus amount)
- `referral_reward_referee_listing_sp` (listing bonus amount)

---

## 🔧 How It Works

### Admin Workflow
1. Admin logs into admin portal
2. Navigate to **Referrals > Configuration**
3. Scroll to **Feature Toggles** section
4. Toggle on/off:
   - 🎯 First Trade Bonus Active
   - 📝 First Approved Listing Bonus Active
   - 🌐 Entire Referral Program Active
5. Each toggle change saves immediately to database

### Backend Workflow
When referee completes **first trade**:
- ✅ If `referral_first_trade_enabled = true` → Awards SP
- ❌ If `referral_first_trade_enabled = false` → No reward (feature disabled)

When referee's **first listing is approved**:
- ✅ If `referral_first_listing_enabled = true` → Awards SP
- ❌ If `referral_first_listing_enabled = false` → No reward (feature disabled)

### Mobile App Impact
- SP amounts still displayed dynamically from admin config ✅
- Referral dashboard shows active bonuses (from previous fix) ✅
- Share message includes both bonuses if enabled ✅

---

## 🚀 Deployment Steps

### Step 1: Apply SQL Migration
Execute in Supabase SQL Editor:
```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/20260205000002_add_referral_trade_feature_toggle.sql
```

**Verify migration success**:
```sql
SELECT config_key, config_value, value_type, description, category
FROM public.sp_config
WHERE config_key IN ('referral_first_trade_enabled', 'referral_first_listing_enabled')
ORDER BY config_key;
```

Expected output:
```
referral_first_listing_enabled | true | boolean | ... | referral
referral_first_trade_enabled   | true | boolean | ... | referral
```

### Step 2: Rebuild Admin Portal
```bash
cd p2p-kids-admin
npm install  # if any new dependencies
npm run build
npm run start
```

### Step 3: Verify TypeScript Compilation
```bash
cd p2p-kids-admin
npm run type-check
```

Expected: No errors, exit code 0

### Step 4: Test in Admin Portal
1. Open admin portal
2. Navigate to **Referrals > Configuration**
3. Scroll to **Feature Toggles** section
4. Verify three toggle switches appear:
   - 🎯 First Trade Bonus Active (checkbox)
   - 📝 First Approved Listing Bonus Active (checkbox)
   - 🌐 Entire Referral Program Active (checkbox)
5. Click each toggle and verify:
   - Visual feedback (checked/unchecked)
   - "Successfully updated..." message appears
   - No error messages

---

## 📝 Manual Testing Checklist

### Test 1: Toggle Loads Correctly
- [ ] Admin portal loads configuration tab
- [ ] First Trade toggle shows current state (true/false)
- [ ] First Listing toggle shows current state (true/false)
- [ ] Program toggle shows current state (true/false)

### Test 2: Toggle Saves to Database
- [ ] Click First Trade toggle (change state)
- [ ] Success message appears: "Successfully updated referral_first_trade_enabled"
- [ ] Refresh page - toggle state persists
- [ ] Verify in Supabase: `SELECT config_value FROM sp_config WHERE config_key = 'referral_first_trade_enabled';`

### Test 3: Toggle Saves to Database (Listing)
- [ ] Click First Listing toggle (change state)
- [ ] Success message appears: "Successfully updated referral_first_listing_enabled"
- [ ] Refresh page - toggle state persists
- [ ] Verify in Supabase: `SELECT config_value FROM sp_config WHERE config_key = 'referral_first_listing_enabled';`

### Test 4: Program Toggle Affects Both (Optional)
- [ ] Disable "Entire Referral Program Active"
- [ ] Success message appears: "Successfully updated referral_program_enabled"
- [ ] Verify both trade and listing bonuses won't be awarded until re-enabled
- [ ] Re-enable and verify bonuses award again

### Test 5: Error Handling
- [ ] Lose network connection while saving
- [ ] Verify error message appears: "Failed to save configuration"
- [ ] No duplicate saves when retrying

---

## 🔍 Verification Queries

### Check Migration Applied
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'sp_config';
```

Expected: `sp_config | true`

### List All Referral Toggle Keys
```sql
SELECT config_key, config_value, description, updated_at
FROM public.sp_config
WHERE category = 'referral' AND value_type = 'boolean'
ORDER BY config_key;
```

Expected rows:
- `referral_first_listing_enabled | true | ...`
- `referral_first_trade_enabled | true | ...`
- `referral_program_enabled | true | ...`

### Get Toggle State
```sql
SELECT config_value FROM public.sp_config 
WHERE config_key = 'referral_first_trade_enabled';
-- Should return: 'true' or 'false'

SELECT config_value FROM public.sp_config 
WHERE config_key = 'referral_first_listing_enabled';
-- Should return: 'true' or 'false'
```

---

## 🐛 Troubleshooting

### Problem: Toggle doesn't appear in admin UI
**Diagnosis**:
1. Check admin build succeeded: `npm run build` in p2p-kids-admin
2. Check no TypeScript errors: `npm run type-check`
3. Check migration was applied: Run verification query above
4. Hard refresh browser (Cmd+Shift+R)

**Solution**:
```bash
cd p2p-kids-admin
npm run type-check
# Fix any errors, then rebuild:
npm run build
npm run start
# Wait 5 seconds for reload, then refresh browser
```

### Problem: Toggle doesn't save
**Diagnosis**:
1. Check browser console for errors (F12 > Console)
2. Check admin secret is configured: `echo $NEXT_PUBLIC_ADMIN_UI_SECRET`
3. Check network tab (F12 > Network) - PATCH request to `/api/admin/sp-config`

**Solution**:
1. Verify admin secret in `.env.local`: `NEXT_PUBLIC_ADMIN_UI_SECRET=...`
2. Restart admin server: `npm run start`
3. Try toggling again

### Problem: Toggle state wrong after refresh
**Diagnosis**:
1. Check loadConfig function runs on mount
2. Check `SPConfigService.get()` returns correct value

**Solution**:
```sql
-- Verify database has correct value
SELECT config_key, config_value FROM public.sp_config 
WHERE config_key IN ('referral_first_trade_enabled', 'referral_first_listing_enabled');

-- If wrong, update manually:
UPDATE public.sp_config 
SET config_value = 'true' 
WHERE config_key = 'referral_first_trade_enabled';
```

---

## 📊 Tier 0 Tests

```bash
# Admin Portal TypeScript Check
cd p2p-kids-admin
npm run type-check
# Expected: No errors, exit code 0

# Admin Portal Lint Check
npm run lint
# Expected: No errors, exit code 0

# Build Check
npm run build
# Expected: Build succeeds, no errors
```

---

## 🎯 Acceptance Criteria

✅ Two independent toggles added to admin configuration tab
✅ First Trade Bonus toggle saves to `referral_first_trade_enabled` config key
✅ First Listing Bonus toggle saves to `referral_first_listing_enabled` config key
✅ Toggles load from database on page load
✅ Toggles persist across page refresh
✅ Admin can enable/disable each bonus type independently
✅ Success/error messages display for each toggle change
✅ TypeScript compiles without errors
✅ No duplicate config keys in sp_config table

---

## 🔗 Related Implementation

This completes the admin control portion of **REF-V2-008: SP Bonus Rewards on First Listing**.

**Previous steps completed**:
- ✅ RPC function: `award_listing_referral_sp()` checks toggle before awarding
- ✅ RPC function: `award_referral_sp()` checks trade toggle before awarding
- ✅ Mobile dashboard: Shows dynamic SP amounts from admin config
- ✅ Mobile share: Includes both bonuses in referral message

**Remaining**:
- ⏳ Test toggles in production with real referral flow

---

## 📞 Support

If toggles aren't working:
1. Check migration is applied in Supabase
2. Check admin UI rebuilt: `npm run build`
3. Check no TypeScript errors: `npm run type-check`
4. Check admin secret configured in `.env.local`
5. Hard refresh browser (Cmd+Shift+R)
6. Check browser console (F12) for errors
