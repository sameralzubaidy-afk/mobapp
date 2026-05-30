# ADMIN-V3-009 QUICK START — Run All Tests

**Task:** MODULE-12-ADMIN-V3-CATEGORIES TASK ADMIN-V3-009  
**Purpose:** Fast reference for executing the complete test suite

---

## Prerequisites

- [ ] All ADMIN-V3-001 to ADMIN-V3-007 implementations deployed
- [ ] Supabase production/staging instance running (NOT local)
- [ ] Admin portal running: `cd p2p-kids-admin && npm run dev` (for E2E tests)
- [ ] iOS Simulator or Android Emulator running (for Maestro flows)

---

## 1️⃣ Admin Portal Unit Tests (Vitest)

```bash
cd p2p-kids-admin
npm run test

# OR: Run specific test file
npm run test -- categorySuggestionService.test.ts
npm run test -- spConfigCategoryService.test.ts
npm run test -- useCategoryMutations.test.tsx
npm run test -- CategoryTable.test.tsx
npm run test -- CategoryForm.test.tsx
```

**Expected:** All 5 test files pass (30+ test cases)

---

## 2️⃣ Mobile Unit Tests (Jest)

```bash
cd p2p-kids-marketplace
npm run test:unit

# OR: Run specific test file
npm test -- src/__tests__/services/spConfigService.test.ts
```

**Expected:** spConfigService.test.ts passes (10 test cases)

---

## 3️⃣ PgTAP SQL Tests

```bash
cd /path/to/kids_marketplace_app
supabase test db

# OR: Run specific test file
supabase test db --file supabase/tests/category_management.sql
```

**Expected:** category_management.sql passes (8 assertions)

---

## 4️⃣ Playwright E2E Tests

**⚠️ Ensure admin portal is running on localhost:3001 first:**

```bash
# Terminal 1: Start admin portal
cd p2p-kids-admin
npm run dev

# Terminal 2: Run Playwright tests
cd p2p-kids-admin
npm run test:playwright

# OR: Run specific test file
npm run test:playwright -- category-crud.e2e.test.ts
npm run test:playwright -- category-suggestion-approve.e2e.test.ts
npm run test:playwright -- category-reorder.e2e.test.ts
npm run test:playwright -- sp-config-category.e2e.test.ts
npm run test:playwright -- bulk-deactivate.e2e.test.ts
```

**Expected:** All 5 E2E test files pass (16+ test groups)

---

## 5️⃣ Maestro Flows (iOS)

**⚠️ Ensure iOS Simulator is running first:**

```bash
cd p2p-kids-marketplace

# Run both category flows
npm run test:maestro:ios -- buyer-category-filter seller-other-flow

# OR: Run individually
maestro test .maestro/buyer-category-filter.yaml
maestro test .maestro/seller-other-flow.yaml
```

**Expected:** 2 flows pass

---

## 6️⃣ Maestro Flows (Android)

**⚠️ Ensure Android Emulator is running first:**

```bash
cd p2p-kids-marketplace

# Run both category flows
npm run test:maestro:android -- buyer-category-filter seller-other-flow

# OR: Run individually
maestro test .maestro/buyer-category-filter.yaml
maestro test .maestro/seller-other-flow.yaml
```

**Expected:** 2 flows pass

---

## 7️⃣ Manual Tests

Open `ADMIN-V3-009-MANUAL-TESTING-GUIDE.md` and follow:
- Admin Portal Tests: TC-ADMIN-001 to TC-ADMIN-011 (11 tests)
- Mobile Buyer Tests: TC-MOBILE-001 to TC-MOBILE-003 (3 tests)
- Mobile Seller Tests: TC-MOBILE-004 to TC-MOBILE-006 (3 tests)
- Regression Tests: TC-REG-001 to TC-REG-002 (2 tests)

---

## 🚀 Run Everything (One-Liner)

```bash
# Admin unit tests
cd p2p-kids-admin && npm run test && \

# Mobile unit tests
cd ../p2p-kids-marketplace && npm run test:unit && \

# PgTAP SQL tests
cd .. && supabase test db --file supabase/tests/category_management.sql && \

# Playwright E2E (requires admin portal running on localhost:3001)
cd p2p-kids-admin && npm run test:playwright && \

# Maestro iOS (requires iOS Simulator running)
cd ../p2p-kids-marketplace && npm run test:maestro:ios -- buyer-category-filter seller-other-flow && \

# Done!
echo "✅ All automated tests complete! Now run manual tests from ADMIN-V3-009-MANUAL-TESTING-GUIDE.md"
```

**Note:** You may need to run Playwright and Maestro separately if admin portal or simulators are not running.

---

## Troubleshooting

### Admin Unit Tests Fail
- Ensure Vitest imports are used (NOT Jest): `import { describe, it, expect, vi } from 'vitest'`
- Check `vitest.config.ts` includes `**/*.test.ts` and excludes `*.e2e.test.ts`

### Mobile Unit Tests Fail
- Ensure Jest globals are used (NOT Vitest): `jest.mock()`, `jest.fn()`
- Check `jest.config.js` includes `testPathIgnorePatterns` for E2E files

### PgTAP Fails
- Ensure migrations are applied: `supabase db reset` (if safe) or `supabase migration up`
- Verify test users and categories exist in DB (check SETUP section in category_management.sql)

### Playwright E2E Fails
- Ensure admin portal is running on `http://localhost:3001`
- Check `playwright.config.ts` has `baseURL: 'http://localhost:3001'`
- Verify admin user is logged in (or E2E tests have login fixture)

### Maestro Fails
- Ensure simulator is running and Expo app is installed
- Run `maestro test --debug <flow>.yaml` for verbose output
- Check testID locators match actual component props

---

## Success Criteria

✅ All unit tests pass (40+ test cases)  
✅ PgTAP SQL tests pass (8 assertions)  
✅ Playwright E2E tests pass (16+ test groups)  
✅ Maestro flows pass (2 flows, 7 states)  
✅ Manual tests completed (19 test cases)

---

**Result:** ADMIN-V3-009 verification complete → mark MODULE-12-VERIFICATION-V3.md section 7 as ✅
