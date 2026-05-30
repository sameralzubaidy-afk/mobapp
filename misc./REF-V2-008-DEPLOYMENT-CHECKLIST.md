# Quick Deployment Guide - Referral Config Fix

## Problem Summary
- ❌ Page load: 404 errors for referral_first_trade_enabled / referral_first_listing_enabled
- ❌ Toggle: "Cannot coerce the result to a single JSON object" error
- ✅ Both fixed with upsert logic + graceful error handling

---

## Step 1: Run Tier 0 Tests (REQUIRED)

### TypeScript Check
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
yarn typecheck
```
**Expected**: ✅ No errors

### Lint Check
```bash
yarn lint
```
**Expected**: ✅ No errors

### Build Check
```bash
yarn build
```
**Expected**: ✅ Build succeeds

---

## Step 2: Apply Migration to Supabase

### Option A: CLI (Recommended)
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase migration up
```

### Option B: SQL Editor (Manual)
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy-paste contents of: `supabase/migrations/20260205000004_seed_referral_feature_toggles.sql`
4. Run Query

**Verify Migration Applied**:
```sql
SELECT config_key, config_value, category FROM sp_config 
WHERE config_key IN ('referral_first_trade_enabled', 'referral_first_listing_enabled')
ORDER BY config_key;
```

---

## Step 3: Deploy Admin Portal

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
yarn build
# Then deploy using your usual deployment process
```

---

## Step 4: Test in Browser

1. **Open Admin Portal**: http://localhost:3001 (or your admin URL)
2. **Navigate**: Referrals → Configuration
3. **Open Console**: F12 → Console tab

### Expected Results

✅ **On Page Load**:
- No 404 errors in console
- Toggles appear and are initialized
- Both toggles show "enabled" (blue ON state)

✅ **On Toggle Click**:
- Click "First Trade Bonus" toggle
- Success message appears: "Successfully updated referral_first_trade_enabled"
- Toggle animates smoothly
- No "Cannot coerce" error

✅ **After Refresh**:
- Toggle state persists
- No errors on page reload

---

## Troubleshooting

### Issue: Still seeing 404 errors on page load

**Solution**:
1. Make sure migration was applied: `SELECT COUNT(*) FROM sp_config WHERE config_key = 'referral_first_trade_enabled';`
   - Should return: 1
2. If returns 0, run migration again
3. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### Issue: Still seeing "Cannot coerce" error on toggle

**Solution**:
1. Make sure code was deployed:
   - Check admin portal `/api/admin/sp-config/route.ts` was updated
   - Check browser cache: Hard refresh as above
2. Restart admin portal if running locally:
   ```bash
   cd p2p-kids-admin
   npm run dev
   ```

### Issue: Toggles don't persist after refresh

**Solution**:
1. Check if admin secret is being sent:
   - Open DevTools → Network → look for PATCH requests
   - Click toggle and check if request includes `x-admin-secret` header
2. Verify admin secret in `.env.local`:
   ```
   NEXT_PUBLIC_ADMIN_UI_SECRET=your_secret_here
   ```
3. Verify this matches Supabase value

---

## Verification Checklist

- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Build succeeds
- [ ] Migration applied to Supabase
- [ ] Admin portal deployed
- [ ] Page loads without 404 errors
- [ ] Toggles initialize with correct state
- [ ] Toggle click succeeds with success message
- [ ] Toggle state persists after page refresh
- [ ] No errors in browser console

---

## Files Changed

1. `p2p-kids-admin/src/app/api/admin/sp-config/route.ts` - ✅ Upsert logic
2. `p2p-kids-admin/src/lib/spConfigService.ts` - ✅ Graceful error handling
3. `p2p-kids-admin/src/app/referrals/configuration-tab.tsx` - ✅ Simplified error handling
4. `supabase/migrations/20260205000004_seed_referral_feature_toggles.sql` - ✅ NEW: Seeds config keys

---

## Rollback (if needed)

```bash
# Revert code changes
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
git checkout src/app/api/admin/sp-config/route.ts
git checkout src/lib/spConfigService.ts
git checkout src/app/referrals/configuration-tab.tsx

# Revert migration (if needed)
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase migration down
```

---

## Questions?

Refer to the detailed documentation: `REF-V2-008-FIX-REFERRAL-CONFIG-ERRORS.md`

