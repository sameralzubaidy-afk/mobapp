# E2E Test Coverage Analysis

## Current Status

### ✅ COVERED (2 test users exist)
- **AUTH Tests** (auth.integration.test.ts)
  - Signup → Phone Verification → Profile → Trial Enrollment
  - Email-based authentication
  - Session management

### ❌ NOT COVERED (missing test data)
- **TRADE Tests** (trade-flow-v2.e2e.ts)
  - Requires: 3+ items in database with seller_id
  - Requires: Stripe test payment methods
  - **FIX**: Seed script now creates 3 items

- **DISCOVERY Tests** (discovery-v2-001/002/003.e2e.ts)
  - Requires: 10+ searchable items with titles/descriptions
  - Requires: Items across multiple categories
  - **FIX**: Seed script now creates items with proper search fields

- **REVIEWS Tests** (review-*.e2e.ts)
  - Requires: Completed trades to review
  - Requires: Multiple user interactions
  - **STATUS**: Can run after completing trade tests

## What You Need To Do

### 1. Fresh Seed (Includes Items)
```bash
npm run reset:staging -- --force
npm run seed:staging
```

### 2. Verify Test Data
```bash
# Check users created
SELECT id, email, name FROM profiles WHERE email LIKE 'test-%@kidsmarketplace.test';

# Check items created
SELECT id, title, seller_id, price FROM items WHERE seller_id IN (SELECT id FROM profiles WHERE email LIKE 'test-seller%');

# Check trades created
SELECT * FROM trades;
```

### 3. Run E2E Tests
```bash
# Auth tests (should pass)
npm run test:auth

# Trade tests (requires items) 
npm run test:trades

# Discovery tests (requires items)
npm run test:e2e -- discovery-v2-001

# All tests
npm run test:all
```

## Test Data Summary

After seeding, you'll have:

| Resource | Count | Purpose |
|----------|-------|---------|
| Test Users | 2 | Buyer + Seller |
| Items/Listings | 3 | Trade flow testing |
| Trades | 1 | Pending trade state |
| Profiles | 2 | Verified & complete |
| Zip Code | 1 | 06850 (your location) |
| DOB | Both set | 2000-01-01 (24+ years old) |

## Known Limitations

⚠️ **Stripe Payment Tests** - Will skip if Stripe not configured in staging
⚠️ **Review Tests** - Require trades to be completed first
⚠️ **Payment Failure Tests** - Require Stripe test cards configured
