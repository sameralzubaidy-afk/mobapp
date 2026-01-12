# BADGES-V2-007: Quick Start Checklist

**Task:** Admin Portal Badge Management with Icon Upload  
**Status:** ✅ Implementation Complete - Ready for Manual Testing

---

## ⚡ Quick Start (3 Steps)

### 1️⃣ Prerequisites Check

```bash
# Verify Supabase connection
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Should return your Supabase prod URLs
```

**Run SQL verification in Supabase SQL Editor:**
```bash
# Open: BADGES-V2-007-SQL-VERIFICATION.sql
# Copy all queries and run in Supabase SQL Editor
```

✅ All 10 verification steps must pass

---

### 2️⃣ Start Admin Portal

```bash
cd p2p-kids-admin
npm install          # If first time
npm run dev          # Start on port 3001
```

✅ Portal should open at http://localhost:3001

---

### 3️⃣ Run Tests

**Unit Tests (Quick):**
```bash
cd p2p-kids-admin
npm test
```

Expected: 12 tests pass

**E2E Tests (Requires Admin Auth):**
```bash
cd p2p-kids-admin
npm run test:e2e
```

Expected: 6 test suites pass (icon upload may require service role)

---

## 🎯 Primary Test: TC-003 Upload Badge Icon

**Goal:** Verify icon upload works from admin portal

**Quick Steps:**
1. Navigate to http://localhost:3001/badges
2. Click "Edit" on any badge
3. Click "Upload New Icon"
4. Select PNG file (< 5MB)
5. Wait for "Icon uploaded successfully!"
6. Verify icon appears in badge list

✅ **Pass Criteria:**
- Upload completes without errors
- Icon URL is publicly accessible
- Icon displays in badge list
- Database record updated with icon_url

---

## 📋 Full Test Suite

**Manual Testing Guide:**
- File: `BADGES-V2-007-MANUAL-TESTING-GUIDE.md`
- Total: 13 test cases
- Duration: ~30 minutes

**Test Priority:**
1. 🔥 TC-003: Upload Badge Icon (PRIMARY)
2. TC-006: Update Badge Details
3. TC-007: Toggle Active/Inactive
4. TC-009: Manual Badge Award
5. Others: Optional for comprehensive testing

---

## 🔧 Troubleshooting

### Issue: "Failed to load badges"
**Solution:**
- Check Supabase credentials in `.env.local`
- Verify badges table exists
- Check browser console for errors

### Issue: "Upload failed - policy violation"
**Solution:**
- Ensure logged in user has `is_admin = true`
- Run SQL verification (Step 8)
- Check RLS policies on storage.objects

### Issue: "User not found" in manual award
**Solution:**
- Verify profiles table has users
- Run SQL verification (Step 9)
- Use exact email from profiles table

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `p2p-kids-admin/src/app/badges/page.tsx` | Badge list page |
| `p2p-kids-admin/src/app/badges/BadgeEditor.tsx` | Editor with icon upload |
| `p2p-kids-admin/src/app/badges/ManualAwardModal.tsx` | Manual award interface |
| `BADGES-V2-007-MANUAL-TESTING-GUIDE.md` | Full test guide |
| `BADGES-V2-007-SQL-VERIFICATION.sql` | SQL verification queries |
| `BADGES-V2-007-IMPLEMENTATION-SUMMARY.md` | Complete implementation details |

---

## ✅ Verification Checklist

Before reporting test results:

- [ ] SQL verification (all 10 steps pass)
- [ ] Admin portal starts without errors
- [ ] Unit tests pass (12/12)
- [ ] Badge list displays correctly
- [ ] TC-003: Icon upload works
- [ ] Icon displays in badge list
- [ ] Icon URL is publicly accessible
- [ ] Manual award flow works
- [ ] No console errors in browser

---

## 🚀 Ready to Test!

**Start here:**
1. Run SQL verification → `BADGES-V2-007-SQL-VERIFICATION.sql`
2. Start portal → `cd p2p-kids-admin && npm run dev`
3. Test icon upload → Follow TC-003 in manual guide

**Report results:**
- Update test results in `BADGES-V2-007-MANUAL-TESTING-GUIDE.md`
- Note any issues in the Issues table
- Share pass/fail summary

---

**Questions?**
- Check `BADGES-V2-007-IMPLEMENTATION-SUMMARY.md` for details
- Review unit tests for expected behavior
- Check browser console for error messages
