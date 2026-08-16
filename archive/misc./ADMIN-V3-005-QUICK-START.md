# ADMIN-V3-005 Quick Start Guide
## Category Suggestions Queue - Testing Commands

**Task:** ADMIN-V3-005  
**Status:** ✅ Ready for Testing  

---

## 🚀 Quick Commands (Copy-Paste)

### 1️⃣ Tier 0 Gates (MANDATORY - Run First)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin

# Typecheck
npm run typecheck

# Lint
npm run lint

# Build (verify no JSX/TS errors)
npm run build
```

**Expected:** All commands exit with code 0, no errors.  
**❌ STOP if any fail** – fix errors before proceeding.

---

### 2️⃣ Unit Tests

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin

# Run all tests
npm test

# Run only suggestion list tests
npm test -- CategorySuggestionsList

# Run only modal tests
npm test -- SuggestionModals
```

**Expected:** All tests pass, coverage ≥ 85%.

---

### 3️⃣ Integration/E2E Tests (Against Supabase)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin

# Set environment variables (replace with your staging values)
export RUN_SUPABASE_E2E=true
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run E2E tests
npm run test:e2e
```

**Expected:** All integration tests pass, DB state changes verified.  
**⚠️ WARNING:** Runs against production Supabase – use staging only.

---

### 4️⃣ Maestro UI Automation (iOS/Android)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Ensure iOS simulator or Android emulator is running with admin app installed

# Run admin category suggestions flow
maestro test .maestro/admin-v3-005-category-suggestions.yaml
```

**Expected:**
- ✅ Navigate to Suggestions tab
- ✅ Badge count matches SQL
- ✅ Approve creates category + reassigns item
- ✅ Merge reassigns to existing category
- ✅ Reject updates status + saves note
- ✅ Modal close behaviors work
- ✅ Empty state displays

---

## 📋 Manual Testing Prerequisites

**Run this SQL in Supabase SQL Editor BEFORE manual testing:**

```sql
-- 1. Verify category_suggestions table exists
SELECT tablename FROM pg_tables WHERE tablename = 'category_suggestions';
-- Expected: 1 row

-- 2. Create test seller
INSERT INTO profiles (user_id, full_name, email)
VALUES ('test-seller-suggestion-001', 'Test Seller', 'testseller@example.com')
ON CONFLICT DO NOTHING;

-- 3. Create test item with "Other" category
INSERT INTO items (seller_id, name, description, price, status, category_id)
SELECT 
  'test-seller-suggestion-001',
  'Test Item Needing Category',
  'A test item for category suggestions',
  15.00,
  'available',
  id
FROM categories WHERE LOWER(name) = 'other'
RETURNING id;
-- ⚠️ SAVE THE RETURNED ID FOR NEXT STEP

-- 4. Create test suggestion (replace {ITEM_ID} with ID from step 3)
INSERT INTO category_suggestions (suggested_name, seller_id, item_id, status)
VALUES ('Vintage Collectibles', 'test-seller-suggestion-001', '{ITEM_ID}', 'pending')
RETURNING *;
-- Expected: 1 row with status = 'pending'

-- 5. Verify pending count
SELECT COUNT(*) FROM category_suggestions WHERE status = 'pending';
-- Expected: At least 1
```

**Wait for confirmation** before proceeding to manual UI tests.

---

## 🧪 Manual Testing Flow

1. **Navigate to Admin Portal:** `http://localhost:3001` (or staging URL)
2. **Login as admin**
3. **Go to Categories page** → Click "Suggestions" tab
4. **Verify:**
   - Badge shows pending count (matches SQL count)
   - Table displays: Suggested Name | Item (link) | Seller | Date | Actions
   - 3 action buttons per row: Approve (green), Merge (blue), Reject (red)

5. **Test Approve (TC-004):**
   - Click "Approve" on first suggestion
   - Verify modal opens with pre-filled name
   - Click "Approve & Create Category"
   - Verify success message
   - Verify row removed + badge decremented

6. **Verify SQL:**
   ```sql
   -- Category created
   SELECT * FROM categories WHERE name ILIKE '%vintage%collectibles%';
   -- Expected: 1 row, is_active = true

   -- Suggestion status updated
   SELECT status, approved_by, reviewed_at 
   FROM category_suggestions 
   WHERE suggested_name = 'Vintage Collectibles';
   -- Expected: status = 'approved', reviewed_at NOT NULL

   -- Item reassigned
   SELECT i.name, c.name AS category_name
   FROM items i JOIN categories c ON i.category_id = c.id
   WHERE i.name = 'Test Item Needing Category';
   -- Expected: category_name = 'Vintage Collectibles'
   ```

7. **Test Merge (TC-006):**
   - Create another test suggestion (use step 4 SQL with different name)
   - Click "Merge" on suggestion
   - Select a category from dropdown
   - Add admin note: "Merging because similar"
   - Click "Merge Suggestion"
   - Verify success + row removed

8. **Test Reject (TC-008):**
   - Create another test suggestion
   - Click "Reject"
   - Add admin note: "Too specific"
   - Click "Reject Suggestion"
   - Verify success + row removed

9. **Verify SQL:**
   ```sql
   SELECT status, admin_note FROM category_suggestions
   WHERE suggested_name = '{YOUR_SUGGESTION_NAME}';
   -- Expected: status = 'rejected', admin_note = 'Too specific'
   ```

---

## 🧹 Cleanup SQL (Run After Testing)

```sql
-- Remove test data
DELETE FROM category_suggestions WHERE seller_id = 'test-seller-suggestion-001';
DELETE FROM items WHERE seller_id = 'test-seller-suggestion-001';
DELETE FROM profiles WHERE user_id = 'test-seller-suggestion-001';

-- Remove test categories created during approval
DELETE FROM categories WHERE name ILIKE '%vintage%collectibles%' OR name ILIKE '%test%category%';
```

---

## 📁 Key Files Created

| File | Purpose |
|------|---------|
| `p2p-kids-admin/src/app/categories/components/CategorySuggestionsList.tsx` | Main suggestions queue table |
| `p2p-kids-admin/src/app/categories/components/ApproveSuggestionModal.tsx` | Approve modal (re-uses CategoryForm) |
| `p2p-kids-admin/src/app/categories/components/MergeSuggestionModal.tsx` | Merge modal (category dropdown) |
| `p2p-kids-admin/src/app/categories/components/RejectSuggestionModal.tsx` | Reject modal (admin note) |
| `p2p-kids-admin/src/__tests__/components/CategorySuggestionsList.test.tsx` | Unit tests for list |
| `p2p-kids-admin/src/__tests__/components/SuggestionModals.test.tsx` | Unit tests for all 3 modals |
| `p2p-kids-admin/src/__tests__/integration/category-suggestions.integration.test.ts` | E2E tests (approve/merge/reject) |
| `ADMIN-V3-005-MANUAL-TESTING-GUIDE.md` | Full manual test guide (11 test cases) |
| `.maestro/admin-v3-005-category-suggestions.yaml` | Maestro UI automation flow |
| `ADMIN-V3-005-IMPLEMENTATION-SUMMARY.md` | Complete implementation summary |

---

## ✅ Verification Checklist

From `MODULE-12-VERIFICATION-V3.md` (lines 118-125):

- [x] Columns: Suggested Name, Item (link), Seller, Date, Actions
- [x] Approve opens ApproveSuggestionModal (re-uses CategoryForm, name pre-filled)
- [x] Merge opens MergeSuggestionModal with active-category dropdown
- [x] Reject opens RejectSuggestionModal with note (optional, 500 char)
- [x] After action: row removed from pending list; tab badge decrements
- [x] Pending count via polling (60s) OR Supabase realtime

**All 6 items satisfied.**

---

## 🚨 Known Issues / TODOs

1. **Admin User ID Placeholder:**
   - All modals use `'temp-admin-id'`
   - **TODO:** Replace with `authContext.user.id`
   - Location: Search for `temp-admin-id` in all 3 modal files

2. **Item Link Target:**
   - Assumes `/admin/items/{id}` route exists
   - Verify route is implemented (not part of this task)

---

## 📚 Full Documentation

- **Implementation Summary:** `ADMIN-V3-005-IMPLEMENTATION-SUMMARY.md`
- **Manual Test Guide:** `ADMIN-V3-005-MANUAL-TESTING-GUIDE.md`
- **Maestro Flow:** `.maestro/admin-v3-005-category-suggestions.yaml`
- **Task Specification:** `Prompts/V3/MODULE-12-ADMIN-V3-CATEGORIES.md` (TASK ADMIN-V3-005)
- **Verification File:** `Prompts/V3/MODULE-12-VERIFICATION-V3.md`

---

**Status:** ✅ Ready for testing  
**Next Step:** Run Tier 0 gates above ⬆️
