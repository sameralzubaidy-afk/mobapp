# NODE-007: Distance Radius Filter - Commands & Verification Reference

**Quick Command Reference for Deployment & Testing**

---

## 🗂️ File Locations & Structure

```
/Users/sameralzubaidi/Desktop/kids_marketplace_app/

├── 📄 NODE-007-IMPLEMENTATION-SUMMARY.md         ← Full implementation overview
├── 📄 NODE-007-MANUAL-TEST-GUIDE.md              ← 19 manual test cases
├── 📄 node-007-setup.sh                          ← Setup automation script
│
├── supabase/
│   └── migrations/
│       └── 20251217000003_user_preferences_and_distance_NODE007.sql
│           ├── user_preferences table
│           ├── calculate_node_distance() function
│           └── RLS policies
│
└── p2p-kids-marketplace/
    ├── src/
    │   ├── components/
    │   │   └── RadiusSlider.tsx
    │   ├── services/
    │   │   ├── location.ts (updated)
    │   │   └── items.ts (updated)
    │   └── screens/
    │       └── items/
    │           └── BrowseItemsScreen.tsx (updated)
    │
    ├── src/__tests__/
    │   └── node-007-radius.test.ts
    │
    └── e2e/
        └── node-007-distance-radius.e2e.ts
```

---

## 📋 Database Setup Commands

### 1. Open Supabase SQL Editor

```
https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new
```

### 2. Apply Migration

**Copy & paste entire contents of:**
```
supabase/migrations/20251217000003_user_preferences_and_distance_NODE007.sql
```

**Then click "Run"**

---

### 3. Verify Migration Success

**Run these verification queries:**

```sql
-- Check user_preferences table exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
ORDER BY ordinal_position;

-- Expected: id, user_id, preferred_radius_miles, created_at, updated_at columns
```

```sql
-- Check calculate_node_distance function exists
SELECT proname, pronargs FROM pg_proc 
WHERE proname = 'calculate_node_distance';

-- Expected: 1 row with pronargs = 2
```

```sql
-- Check RLS policies (should be 4)
SELECT policyname, cmnd FROM pg_policies 
WHERE tablename = 'user_preferences';

-- Expected: SELECT, INSERT, UPDATE policies for users + SELECT for admins
```

```sql
-- Check index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'user_preferences';

-- Expected: idx_user_preferences_user_id
```

---

### 4. Configure Admin Settings

**Run this SQL to set NODE-007 config:**

```sql
INSERT INTO admin_config (key, value, data_type, description) VALUES
  ('default_radius_miles', '10', 'integer', 'Default search radius for all users'),
  ('min_user_radius_miles', '5', 'integer', 'Minimum radius users can select'),
  ('max_user_radius_miles', '25', 'integer', 'Maximum radius users can select'),
  ('allow_user_radius_adjustment', 'true', 'boolean', 'Allow users to change search radius')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();
```

**Verify:**
```sql
SELECT key, value FROM admin_config 
WHERE key IN (
  'default_radius_miles',
  'min_user_radius_miles', 
  'max_user_radius_miles',
  'allow_user_radius_adjustment'
)
ORDER BY key;
```

---

## 🧪 Testing Commands

### Run Unit Tests

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Run all NODE-007 tests
npm test -- --testPathPattern=node-007-radius

# Run with verbose output
npm test -- --testPathPattern=node-007-radius --verbose

# Run with coverage
npm test -- --testPathPattern=node-007-radius --coverage

# Run specific test
npm test -- --testPathPattern=node-007-radius -t "getUserPreferredRadius"
```

### Run E2E Tests

```bash
cd p2p-kids-marketplace

# Run all NODE-007 E2E tests
npm run e2e -- --testNamePattern="NODE-007"

# Run specific E2E test
npm run e2e -- --testNamePattern="E2E-001"
```

### Run Linting & Type Check

```bash
cd p2p-kids-marketplace

# Type check
npm run type-check

# ESLint
npm run lint

# Both
npm run lint && npm run type-check
```

### Run All Tests Together

```bash
cd p2p-kids-marketplace

# Clean, test, and type-check
npm run test && npm run type-check

# Or with coverage report
npm test -- --coverage --testPathPattern=node-007
```

---

## 🚀 Deployment Commands

### Build Mobile App

```bash
cd p2p-kids-marketplace

# Development build
npm run dev

# Production build (local)
npm run build

# EAS build for iOS
eas build --platform ios --profile production

# EAS build for Android
eas build --platform android --profile production

# Both platforms
eas build
```

---

## ✅ Manual Testing Checklist

Use the manual test guide for these steps:

```
1. Open: NODE-007-MANUAL-TEST-GUIDE.md
2. Follow each test case (TEST-001 through TEST-019)
3. Record pass/fail for each
4. Note any issues
5. Sign off on results
```

**Quick test flow:**
1. Login as test user
2. Navigate to Browse Items
3. Toggle "Show All Nodes" → Slider appears ✅
4. Adjust radius 5→10→20→25 → Items reload ✅
5. Check distance badges show correct distances ✅
6. Restart app → Radius persists ✅

---

## 🔧 Troubleshooting Commands

### Check if Migration Applied

```sql
-- In Supabase SQL Editor:
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'user_preferences'
);

-- Should return: true
```

### Test PostGIS Function

```sql
-- Test calculate_node_distance function
-- Assuming you have two nodes created, use their IDs:

SELECT calculate_node_distance(
  'node-norwalk-id',
  'node-littlefalls-id'
);

-- Should return distance in miles (~73 for Norwalk↔Little Falls)
```

### Check User Preferences

```sql
-- View all user preferences
SELECT user_id, preferred_radius_miles, updated_at 
FROM user_preferences 
ORDER BY updated_at DESC 
LIMIT 10;

-- Check specific user
SELECT * FROM user_preferences 
WHERE user_id = 'USER_ID_HERE';
```

### Test RLS Policies

```sql
-- Test that RLS is enforced:
-- (Run this as a non-admin user via API)

-- Should work (own preferences)
SELECT * FROM user_preferences 
WHERE user_id = auth.uid();

-- Should fail (other user's preferences)
SELECT * FROM user_preferences 
WHERE user_id != auth.uid();
```

---

## 📊 Sample Data for Testing

### Create Test Data

```sql
-- Create test user (if not exists)
-- Note: Normally done via Auth signup, but here's SQL for reference

-- Assign test user to node
INSERT INTO user_preferences (user_id, preferred_radius_miles)
VALUES ('test-user-id', 15)
ON CONFLICT (user_id) DO UPDATE SET preferred_radius_miles = 15;

-- Create test items in different nodes
INSERT INTO items (seller_id, title, description, price, status)
VALUES 
  ('seller-1', 'Toy Car', 'Red toy car', 10.00, 'available'),
  ('seller-2', 'Book', 'Math textbook', 5.00, 'available'),
  ('seller-3', 'Game', 'Board game', 15.00, 'available');
```

---

## 🎯 Quality Assurance Checklist

Before marking NODE-007 complete:

```
Database:
☐ Migration applied successfully
☐ user_preferences table exists with correct schema
☐ calculate_node_distance() function works
☐ RLS policies enforced
☐ Indexes created
☐ Admin config settings populated

Mobile App:
☐ RadiusSlider component renders correctly
☐ Slider integrates with BrowseItemsScreen
☐ Distance display shows on item cards
☐ Radius values persisted to database
☐ User preferences load on app restart

Testing:
☐ Unit tests pass (20+ cases)
☐ E2E tests pass (20+ scenarios)
☐ Manual tests pass (19 tests)
☐ Type check passes (npm run type-check)
☐ Lint passes (npm run lint)

Documentation:
☐ Implementation summary complete
☐ Manual test guide comprehensive
☐ Deployment steps clear
☐ Error handling documented
```

---

## 📞 Support Contacts

For issues or questions:

1. **Module Spec:** [MODULE-03-NODE-MANAGEMENT.md](Prompts/MODULE-03-NODE-MANAGEMENT.md)
2. **Verification:** [MODULE-03-Node Management VERIFICATION.md](Prompts/MODULE-03-Node%20Management%20VERIFICATION.md)
3. **Implementation Details:** [NODE-007-IMPLEMENTATION-SUMMARY.md](NODE-007-IMPLEMENTATION-SUMMARY.md)
4. **Manual Testing:** [NODE-007-MANUAL-TEST-GUIDE.md](NODE-007-MANUAL-TEST-GUIDE.md)

---

## ⏱️ Estimated Time for Full Cycle

| Phase | Time |
|-------|------|
| Database Migration + Setup | 15-30 min |
| Unit Tests | 5-10 min |
| E2E Tests | 10-20 min |
| Manual Testing | 30-60 min |
| Bug Fixes (if any) | 15-30 min |
| **Total** | **75-150 min** |

---

## 🎉 Success Criteria

NODE-007 is **COMPLETE** when:

✅ All database migrations applied  
✅ All unit tests pass  
✅ All E2E tests pass  
✅ All 19 manual tests pass  
✅ Type check: 0 errors  
✅ Lint: 0 errors  
✅ Distance calculations accurate (±2 miles)  
✅ User preferences persist correctly  
✅ Radius slider UX smooth and responsive  
✅ Error handling tested & verified  

---

**Ready to Deploy!** 🚀
