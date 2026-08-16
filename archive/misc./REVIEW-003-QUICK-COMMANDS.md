# REVIEW-003: Quick Testing Commands

## ✅ Tier 0: Compile & Lint (MANDATORY BEFORE SIMULATOR)

```bash
cd p2p-kids-marketplace

# TypeScript compile check
npx tsc -p tsconfig.json --noEmit

# ESLint
npm run lint

# Run all review unit tests
npm test src/services/__tests__/review.test.ts
```

**Expected Result:** All commands exit with code 0, no errors.

---

## ✅ Tier 1: Run Unit Tests

```bash
cd p2p-kids-marketplace

# Run all review service tests
npm test src/services/__tests__/review.test.ts

# Run only anonymous review tests
npm test -- --testNamePattern="Anonymous"

# Run with coverage
npm test src/services/__tests__/review.test.ts -- --coverage
```

**Expected Output:**
```
PASS  src/services/__tests__/review.test.ts
  Review Service
    submitReview
      ✓ should submit anonymous review with is_anonymous flag true
      ✓ should default to is_anonymous false when not specified
      ✓ should submit anonymous review without comment
    getUserReviews
      ✓ should include anonymous reviews in user review list
      ✓ should handle reviews with only anonymous reviews

Tests: 5 passed (anonymous-specific), 5 total
```

---

## ✅ Tier 2: Run E2E Tests

```bash
cd p2p-kids-marketplace

# Run anonymous review E2E test
npm test src/__tests__/e2e/review-003-anonymous-flow.e2e.ts

# Run all review E2E tests
npm test -- --testPathPattern="review.*e2e"
```

**Note:** Requires Supabase connection configured.

---

## ✅ Manual Testing

### Before opening simulator, run:

```bash
cd p2p-kids-marketplace

# Compile check
npx tsc -p tsconfig.json --noEmit

# Lint
npm run lint
```

### Then start app:

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android
```

### Follow manual test guide:

Open: [REVIEW-003-MANUAL-TESTING-GUIDE.md](REVIEW-003-MANUAL-TESTING-GUIDE.md)

---

## ✅ Database Verification (Supabase Dashboard)

1. Login to Supabase Dashboard
2. Navigate to: **Table Editor** → `reviews` table
3. Filter: `is_anonymous = true`
4. Verify:
   - ✅ `is_anonymous` column exists
   - ✅ `reviewer_id` still stored (not null)
   - ✅ All fields populated correctly

---

## 📊 Test Results Summary

| Test Type | Command | Status |
|-----------|---------|--------|
| TypeScript Compile | `npx tsc -p tsconfig.json --noEmit` | ⬜ |
| ESLint | `npm run lint` | ⬜ |
| Unit Tests | `npm test src/services/__tests__/review.test.ts` | ⬜ |
| E2E Tests | `npm test src/__tests__/e2e/review-003-anonymous-flow.e2e.ts` | ⬜ |
| Manual Tests | Follow [REVIEW-003-MANUAL-TESTING-GUIDE.md](REVIEW-003-MANUAL-TESTING-GUIDE.md) | ⬜ |

---

## 🐛 If Tests Fail

### Unit Test Failures

```bash
# Run in verbose mode
npm test src/services/__tests__/review.test.ts -- --verbose

# Check specific test
npm test -- --testNamePattern="should submit anonymous review"
```

### E2E Test Failures

- Check Supabase connection in `.env.local`
- Verify test users exist
- Check completed trade exists

### Compile Errors

- Run `npm install` to ensure dependencies installed
- Check TypeScript version: `npx tsc --version`
- Verify tsconfig.json is correct

---

## 📝 Files Modified

- [p2p-kids-marketplace/src/services/__tests__/review.test.ts](p2p-kids-marketplace/src/services/__tests__/review.test.ts) ← **5 new tests added**
- [p2p-kids-marketplace/src/__tests__/e2e/review-003-anonymous-flow.e2e.ts](p2p-kids-marketplace/src/__tests__/e2e/review-003-anonymous-flow.e2e.ts) ← **NEW FILE**
- [REVIEW-003-MANUAL-TESTING-GUIDE.md](REVIEW-003-MANUAL-TESTING-GUIDE.md) ← **NEW FILE**
- [REVIEW-003-IMPLEMENTATION-SUMMARY.md](REVIEW-003-IMPLEMENTATION-SUMMARY.md) ← **NEW FILE**

---

**Ready to test!** Start with Tier 0 (compile + lint), then unit tests, then manual testing.
