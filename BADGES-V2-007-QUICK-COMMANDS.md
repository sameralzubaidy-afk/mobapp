# BADGES-V2-007: Quick Command Reference

**Status:** Error Fixed - Ready to Deploy  
**Last Updated:** January 12, 2026

---

## 🚀 ONE-MINUTE FIX

```bash
# 1. Deploy Edge Function
cd supabase/functions
supabase functions deploy badges-update-icon

# 2. Test it (in browser)
# Go to http://localhost:3001/badges
# Click Edit → Upload Icon → Done! ✅
```

---

## 📋 Step-by-Step Commands

### A. Deploy Edge Function (REQUIRED)

```bash
# Navigate to functions directory
cd supabase/functions

# Deploy the function
supabase functions deploy badges-update-icon

# Expected output:
# ✓ Successfully deployed function badges-update-icon
```

**If you don't have Supabase CLI:**
```bash
npm install -g supabase
supabase functions deploy badges-update-icon
```

### B. Verify Deployment

```bash
# List all functions
supabase functions list

# Should show: badges-update-icon (active)
```

### C. Run Tests

```bash
# Unit tests
cd p2p-kids-admin
npm test

# E2E tests
npm run test:e2e
```

### D. Manual Test (TC-003)

```bash
# Start admin portal
cd p2p-kids-admin
npm run dev

# In browser:
# 1. Open http://localhost:3001/badges
# 2. Log in as admin
# 3. Click "Edit" on any badge
# 4. Click "Upload New Icon"
# 5. Select PNG/JPEG image (< 5MB)
# 6. Wait for "Icon uploaded successfully!"
# 7. Verify icon appears in list ✅
```

---

## 🔧 Troubleshooting Commands

### CLI Not Found
```bash
npm install -g supabase
```

### Function Not Deploying
```bash
# Check if you're in correct directory
pwd
# Should show: .../kids_marketplace_app/supabase/functions

# Try explicit path
supabase functions deploy ./badges-update-icon
```

### Function Still Getting Errors
```bash
# Check Supabase Dashboard
# 1. Go to Edge Functions
# 2. Click badges-update-icon
# 3. Check Function Logs tab
# 4. Look for error details
```

### Typecheck Issues
```bash
cd p2p-kids-admin
npm run type-check
```

### Lint Issues
```bash
cd p2p-kids-admin
npm run lint
```

---

## 📊 Verification Queries

Run these in Supabase SQL Editor:

```sql
-- Check badge-icons bucket exists
SELECT id, public FROM storage.buckets WHERE id = 'badge-icons';

-- Count badges
SELECT COUNT(*) FROM badges;

-- Check recent uploads
SELECT name, created_at FROM storage.objects 
WHERE bucket_id = 'badge-icons' 
ORDER BY created_at DESC LIMIT 5;

-- Check audit logs
SELECT * FROM badge_audit_logs 
ORDER BY created_at DESC LIMIT 5;
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/badges-update-icon/index.ts` | Edge Function (NEW) |
| `p2p-kids-admin/src/app/badges/BadgeEditor.tsx` | Updated to use Edge Function |
| `BADGES-V2-007-ERROR-ANALYSIS-AND-FIX.md` | Full error analysis |
| `BADGES-V2-007-RLS-FIX.md` | Detailed fix guide |
| `BADGES-V2-007-MANUAL-TESTING-GUIDE.md` | Manual test cases |

---

## ✅ Success Checklist

- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Edge Function deployed (`supabase functions deploy badges-update-icon`)
- [ ] Function shows "Active" in Supabase Dashboard
- [ ] npm test passes (12 tests)
- [ ] TC-003 passes (icon uploads successfully)
- [ ] Icon visible in badge list
- [ ] No console errors

---

## 🎯 After Fix

Once fix is deployed and working:

1. **Update Manual Tests**
   - Fill in results in `BADGES-V2-007-MANUAL-TESTING-GUIDE.md`
   - Mark TC-003 as PASS

2. **Run Full Test Suite**
   ```bash
   npm test
   npm run test:e2e
   ```

3. **Test Other Scenarios**
   - TC-004: File size validation
   - TC-005: File type validation
   - TC-006: Update badge details
   - TC-007: Toggle active/inactive
   - TC-008-009: Manual award

---

## 🆘 Need Help?

1. **Error still occurring?**
   - Check: `BADGES-V2-007-ERROR-ANALYSIS-AND-FIX.md`

2. **Deployment fails?**
   - Check: `BADGES-V2-007-RLS-FIX.md` → Troubleshooting section

3. **Tests failing?**
   - Check: Browser console for errors
   - Check: Supabase Edge Function logs
   - Check: npm run type-check

---

**Ready? Run this now:**

```bash
cd supabase/functions
supabase functions deploy badges-update-icon
```

**Then test in browser at http://localhost:3001/badges** 🚀
