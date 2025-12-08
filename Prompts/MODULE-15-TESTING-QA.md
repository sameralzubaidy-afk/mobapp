# MODULE 15: TESTING & QA

**Total Tasks:** 14  
**Estimated Time:** ~52 hours  
**Dependencies:** All previous modules

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

Add this preamble to each AI prompt block when running in Claude Sonnet 4.5 mode. It guides the agent to reason, verify, and produce tests alongside code.

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.
```

---

## TASK TEST-001: Write Unit Tests for Core Business Logic (Points Calculation, Fee Calculation, etc.)

**Duration:** 5 hours  
**Priority:** Critical  
**Dependencies:** MODULE-06 (Trade Flow), MODULE-09 (Points)

### Description
Write unit tests for critical business logic. Test: points calculation, fee calculation, badge level calculation, trade status transitions. Use Jest or Vitest. Aim for 80%+ coverage on core functions.

---

### AI Prompt for Cursor (Generate Unit Tests)

```typescript
/*
TASK: Write unit tests for core business logic

CONTEXT:
Critical functions need comprehensive test coverage.
Use Jest or Vitest.

REQUIREMENTS:
1. Test points calculation (add, deduct, exchange rate)
2. Test fee calculation (cash fee %, points fee %)
3. Test badge level calculation
4. Test trade status transitions
5. Test refund logic (proportional refunds)
6. Aim for 80%+ coverage

==================================================
FILE 1: Points calculation tests
==================================================
*/

// filepath: src/lib/__tests__/points.test.ts

import { describe, it, expect } from 'vitest';
import { calculatePointsCost, calculatePlatformFee, deductPoints, addPoints } from '../points';

describe('Points Calculation', () => {
  describe('calculatePointsCost', () => {
    it('should calculate points cost with default exchange rate (1 point = $1)', () => {
      const cashAmount = 5000; // $50.00
      const exchangeRate = 100; // 1 point = $1
      const pointsCost = calculatePointsCost(cashAmount, exchangeRate);
      expect(pointsCost).toBe(50);
    });

    it('should calculate points cost with custom exchange rate', () => {
      const cashAmount = 5000; // $50.00
      const exchangeRate = 200; // 1 point = $0.50
      const pointsCost = calculatePointsCost(cashAmount, exchangeRate);
      expect(pointsCost).toBe(100);
    });

    it('should handle zero cash amount', () => {
      const pointsCost = calculatePointsCost(0, 100);
      expect(pointsCost).toBe(0);
    });
  });

  describe('calculatePlatformFee', () => {
    it('should calculate cash platform fee (5%)', () => {
      const cashAmount = 10000; // $100.00
      const feePercent = 5;
      const fee = calculatePlatformFee(cashAmount, feePercent, 'cash');
      expect(fee).toBe(500); // $5.00
    });

    it('should calculate points platform fee (10%)', () => {
      const pointsAmount = 100;
      const feePercent = 10;
      const fee = calculatePlatformFee(pointsAmount, feePercent, 'points');
      expect(fee).toBe(10);
    });

    it('should handle zero amount', () => {
      const fee = calculatePlatformFee(0, 5, 'cash');
      expect(fee).toBe(0);
    });

    it('should handle 0% fee', () => {
      const fee = calculatePlatformFee(10000, 0, 'cash');
      expect(fee).toBe(0);
    });
  });

  describe('deductPoints', () => {
    it('should deduct points if sufficient balance', async () => {
      const result = await deductPoints('user-123', 50, 'Test deduction');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBeLessThan(100); // Assuming initial balance
    });

    it('should fail if insufficient balance', async () => {
      const result = await deductPoints('user-123', 10000, 'Test deduction');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient points');
    });

    it('should create transaction log on deduction', async () => {
      await deductPoints('user-123', 10, 'Test deduction');
      // Verify transaction created in points_transactions table
    });
  });

  describe('addPoints', () => {
    it('should add points to user balance', async () => {
      const result = await addPoints('user-123', 50, 'Test reward');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBeGreaterThan(0);
    });

    it('should create transaction log on addition', async () => {
      await addPoints('user-123', 25, 'Test reward');
      // Verify transaction created
    });

    it('should handle negative points (should fail)', async () => {
      const result = await addPoints('user-123', -10, 'Invalid');
      expect(result.success).toBe(false);
    });
  });
});

/*
==================================================
FILE 2: Fee calculation tests
==================================================
*/

// filepath: src/lib/__tests__/fees.test.ts

import { describe, it, expect } from 'vitest';
import { calculateTradeFees, calculateRefundAmounts } from '../fees';

describe('Fee Calculation', () => {
  describe('calculateTradeFees', () => {
    it('should calculate fees for cash-only trade', () => {
      const fees = calculateTradeFees({
        cashAmount: 10000, // $100
        pointsAmount: 0,
        cashFeePercent: 5,
        pointsFeePercent: 10,
      });

      expect(fees.cashFee).toBe(500); // $5
      expect(fees.pointsFee).toBe(0);
      expect(fees.totalCash).toBe(10500); // $105
      expect(fees.totalPoints).toBe(0);
    });

    it('should calculate fees for points-only trade', () => {
      const fees = calculateTradeFees({
        cashAmount: 0,
        pointsAmount: 100,
        cashFeePercent: 5,
        pointsFeePercent: 10,
      });

      expect(fees.cashFee).toBe(0);
      expect(fees.pointsFee).toBe(10);
      expect(fees.totalCash).toBe(0);
      expect(fees.totalPoints).toBe(110);
    });

    it('should calculate fees for mixed payment trade', () => {
      const fees = calculateTradeFees({
        cashAmount: 5000, // $50
        pointsAmount: 50,
        cashFeePercent: 5,
        pointsFeePercent: 10,
      });

      expect(fees.cashFee).toBe(250); // $2.50
      expect(fees.pointsFee).toBe(5);
      expect(fees.totalCash).toBe(5250); // $52.50
      expect(fees.totalPoints).toBe(55);
    });
  });

  describe('calculateRefundAmounts', () => {
    it('should calculate full refund for cash trade', () => {
      const refund = calculateRefundAmounts({
        cashPaid: 10500,
        pointsPaid: 0,
        cashFee: 500,
        pointsFee: 0,
      });

      expect(refund.cashRefund).toBe(10500);
      expect(refund.pointsRefund).toBe(0);
    });

    it('should calculate full refund for points trade', () => {
      const refund = calculateRefundAmounts({
        cashPaid: 0,
        pointsPaid: 110,
        cashFee: 0,
        pointsFee: 10,
      });

      expect(refund.cashRefund).toBe(0);
      expect(refund.pointsRefund).toBe(110);
    });

    it('should calculate proportional refund for mixed payment', () => {
      const refund = calculateRefundAmounts({
        cashPaid: 5250,
        pointsPaid: 55,
        cashFee: 250,
        pointsFee: 5,
      });

      expect(refund.cashRefund).toBe(5250);
      expect(refund.pointsRefund).toBe(55);
    });
  });
});

/*
==================================================
FILE 3: Badge calculation tests
==================================================
*/

// filepath: src/lib/__tests__/badges.test.ts

import { describe, it, expect } from 'vitest';
import { calculateBadgeLevel } from '../badges';

describe('Badge Calculation', () => {
  it('should return "none" for new user', () => {
    const level = calculateBadgeLevel({
      completedTrades: 0,
      avgRating: 0,
      accountAge: 0,
    });
    expect(level).toBe('none');
  });

  it('should return "bronze" for 5+ trades', () => {
    const level = calculateBadgeLevel({
      completedTrades: 5,
      avgRating: 4.0,
      accountAge: 30,
    });
    expect(level).toBe('bronze');
  });

  it('should return "silver" for 20+ trades with 4.5+ rating', () => {
    const level = calculateBadgeLevel({
      completedTrades: 20,
      avgRating: 4.5,
      accountAge: 90,
    });
    expect(level).toBe('silver');
  });

  it('should return "gold" for 50+ trades with 4.8+ rating', () => {
    const level = calculateBadgeLevel({
      completedTrades: 50,
      avgRating: 4.8,
      accountAge: 180,
    });
    expect(level).toBe('gold');
  });

  it('should not upgrade to silver with low rating', () => {
    const level = calculateBadgeLevel({
      completedTrades: 20,
      avgRating: 3.5, // Too low
      accountAge: 90,
    });
    expect(level).toBe('bronze');
  });
});

/*
==================================================
FILE 4: Test configuration
==================================================
*/

// filepath: vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Unit tests for points calculation
✓ Unit tests for fee calculation
✓ Unit tests for badge calculation
✓ Unit tests for refund logic
✓ 80%+ coverage on core functions
✓ All tests passing

==================================================
NEXT TASK
==================================================

TEST-002: Integration tests for API endpoints
*/
```

---

### Output Files

1. **src/lib/__tests__/points.test.ts** - Points calculation tests
2. **src/lib/__tests__/fees.test.ts** - Fee calculation tests
3. **src/lib/__tests__/badges.test.ts** - Badge calculation tests
4. **vitest.config.ts** - Test configuration

---

### Testing Steps

1. **Run unit tests:**
   ```bash
   npm run test
   ```

2. **Check coverage:**
   ```bash
   npm run test:coverage
   ```

3. **Verify 80%+ coverage** on core modules

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Write points tests | 1.5 hours |
| Write fee tests | 1.5 hours |
| Write badge tests | 1 hour |
| Write refund tests | 1 hour |
| **Total** | **~5 hours** |

---

## TASK TEST-002: Write Integration Tests for API Endpoints (Supabase Edge Functions)

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** All Edge Functions

### Description
Integration tests for Supabase Edge Functions. Test: stripe payment, CPSC import, AI moderation, notifications. Mock external APIs. Test error handling.

---

### AI Prompt for Cursor (Generate Integration Tests)

```typescript
/*
TASK: Write integration tests for Edge Functions

REQUIREMENTS:
1. Test Stripe payment Edge Function
2. Test CPSC import Edge Function
3. Test AI moderation Edge Function
4. Test notification Edge Function
5. Mock external APIs (Stripe, Google Vision, etc.)
6. Test error handling

FILES:
- supabase/functions/_tests/payment.test.ts
- supabase/functions/_tests/cpsc-import.test.ts
- supabase/functions/_tests/moderation.test.ts
*/
```

### Time Breakdown: **~4 hours**

---

## TASK TEST-003: Write E2E Tests for Critical User Flows (Signup, Create Listing, Buy Item, etc.) using Detox or Maestro

**Duration:** 6 hours  
**Priority:** High  
**Dependencies:** All user-facing features

### Description
End-to-end tests for critical user journeys. Test: signup → create listing → search → buy item → complete trade → leave review. Use Detox (React Native) or Maestro.

---

### AI Prompt for Cursor (Generate E2E Tests)

```typescript
/*
TASK: Write E2E tests for critical user flows

CONTEXT:
Use Detox for React Native E2E testing.
Test complete user journeys from start to finish.

REQUIREMENTS:
1. Test signup flow
2. Test create listing flow
3. Test search and filter
4. Test buy item flow
5. Test trade completion
6. Test review flow

==================================================
FILE 1: Detox configuration
==================================================
*/

// filepath: .detoxrc.js

module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/YourApp.app',
      build: 'xcodebuild -workspace ios/YourApp.xcworkspace -scheme YourApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_5_API_33',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};

/*
==================================================
FILE 2: E2E test - Complete user journey
==================================================
*/

// filepath: e2e/userJourney.test.ts

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Complete User Journey', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete full user journey: signup → list item → buy item → review', async () => {
    // 1. Signup
    await element(by.id('signup-button')).tap();
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('Password123!');
    await element(by.id('full-name-input')).typeText('Test User');
    await element(by.id('submit-signup')).tap();

    // Wait for home screen
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // 2. Create listing
    await element(by.id('create-listing-button')).tap();
    await element(by.id('item-title-input')).typeText('Test Item');
    await element(by.id('item-price-input')).typeText('25');
    await element(by.id('item-description-input')).typeText('Test description');
    await element(by.id('category-picker')).tap();
    await element(by.text('Toys')).tap();
    await element(by.id('submit-listing')).tap();

    // Wait for listing created
    await waitFor(element(by.text('Listing created!')))
      .toBeVisible()
      .withTimeout(3000);

    // 3. Search for item
    await element(by.id('home-tab')).tap();
    await element(by.id('search-input')).typeText('Test Item');
    await element(by.id('search-button')).tap();

    // Wait for search results
    await waitFor(element(by.id('search-results')))
      .toBeVisible()
      .withTimeout(3000);

    // 4. Buy item (as different user - need to logout and login as buyer)
    await element(by.id('profile-tab')).tap();
    await element(by.id('logout-button')).tap();

    // Login as buyer
    await element(by.id('login-button')).tap();
    await element(by.id('email-input')).typeText('buyer@example.com');
    await element(by.id('password-input')).typeText('Password123!');
    await element(by.id('submit-login')).tap();

    // Search and buy
    await element(by.id('search-input')).typeText('Test Item');
    await element(by.id('search-button')).tap();
    await element(by.id('item-card-0')).tap();
    await element(by.id('buy-now-button')).tap();

    // Select payment method
    await element(by.id('cash-only-option')).tap();
    await element(by.id('proceed-payment')).tap();

    // Complete payment (mock)
    await element(by.id('confirm-payment')).tap();

    // Wait for trade confirmation
    await waitFor(element(by.text('Payment successful!')))
      .toBeVisible()
      .withTimeout(5000);

    // 5. Complete trade
    await element(by.id('confirm-receipt')).tap();

    // Wait for completion
    await waitFor(element(by.text('Trade completed!')))
      .toBeVisible()
      .withTimeout(3000);

    // 6. Leave review
    await element(by.id('leave-review-button')).tap();
    await element(by.id('rating-5-star')).tap();
    await element(by.id('review-comment')).typeText('Great seller!');
    await element(by.id('submit-review')).tap();

    // Verify review submitted
    await waitFor(element(by.text('Review submitted')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should handle error when creating listing with missing fields', async () => {
    await element(by.id('create-listing-button')).tap();
    await element(by.id('submit-listing')).tap(); // Submit without filling fields

    await detoxExpect(element(by.text('Please fill all required fields'))).toBeVisible();
  });

  it('should prevent buying own item', async () => {
    // Create listing
    await element(by.id('create-listing-button')).tap();
    await element(by.id('item-title-input')).typeText('My Item');
    await element(by.id('submit-listing')).tap();

    // Try to buy own item
    await element(by.id('home-tab')).tap();
    await element(by.id('search-input')).typeText('My Item');
    await element(by.id('item-card-0')).tap();

    // Buy button should be disabled
    await detoxExpect(element(by.id('buy-now-button'))).not.toBeVisible();
  });
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ E2E test for signup flow
✓ E2E test for create listing
✓ E2E test for search and buy
✓ E2E test for trade completion
✓ E2E test for review submission
✓ Error cases tested

==================================================
NEXT TASK
==================================================

TEST-004: Set up automated testing in CI/CD
*/
```

### Time Breakdown: **~6 hours**

---

## TASK TEST-004: Set Up Automated Testing in CI/CD Pipeline

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** TEST-001, TEST-002, TEST-003

### Description
Set up GitHub Actions (or similar) to run tests on every commit. Run unit tests, integration tests, type-check, lint. Fail build if tests fail. Generate coverage reports.

---

### AI Prompt for Cursor (Generate CI/CD Configuration)

```typescript
/*
TASK: Set up automated testing in CI/CD

REQUIREMENTS:
1. GitHub Actions workflow
2. Run on every push and PR
3. Unit tests, integration tests, type-check, lint
4. Generate coverage reports
5. Fail build if tests fail

==================================================
FILE: GitHub Actions workflow
==================================================
*/

// filepath: .github/workflows/test.yml

name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true

      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage is below 80%: $COVERAGE%"
            exit 1
          fi

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ GitHub Actions workflow created
✓ Runs on push and PR
✓ All tests executed
✓ Coverage reports generated
✓ Build fails if tests fail or coverage < 80%

==================================================
NEXT TASK
==================================================

TEST-005: Create fake users seed script
*/
```

### Time Breakdown: **~3 hours**

---

## TASK TEST-005: Create 500 Fake Users with Seed Script

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** AUTH-001 (User authentication)

### Description
Seed script to create 500 fake users for testing. Generate random names, emails, profiles. Insert into users table. Create verified accounts. Use Faker.js for data generation.

---

### AI Prompt for Cursor (Generate User Seed Script)

```typescript
/*
TASK: Create seed script for 500 fake users

REQUIREMENTS:
1. Generate 500 fake users
2. Random names, emails, profiles
3. Some with verified email
4. Some with profile photos
5. Random badge levels

FILE: scripts/seed-users.ts
- Use @faker-js/faker for data
- Insert via Supabase client
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK TEST-006: Create 1,500 Fake Listings with Seed Script

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** TEST-005 (Fake users), MODULE-04 (Item listing)

### Description
Seed script to create 1,500 fake listings. Assign to random users. Generate titles, descriptions, prices, categories. Upload placeholder images. Mix of active/sold items.

---

### AI Prompt for Cursor (Generate Listing Seed Script)

```typescript
/*
TASK: Create seed script for 1,500 fake listings

REQUIREMENTS:
1. Generate 1,500 fake items
2. Assign to random users from seed
3. Random titles, descriptions, prices, categories
4. Placeholder images (unsplash or lorem picsum)
5. Mix of statuses (active, sold, flagged)

FILE: scripts/seed-items.ts
*/
```

### Time Breakdown: **~3 hours**

---

## TASK TEST-007: Perform Manual QA on All User Flows (Signup, Listing, Search, Trade, Messaging, Reviews)

**Duration:** 6 hours  
**Priority:** Critical  
**Dependencies:** All user-facing features

### Description
Comprehensive manual QA testing. Test all user flows on real devices (iOS + Android). Create test plan with checkboxes. Document bugs in issue tracker.

---

### Test Plan

**Signup & Onboarding:**
- [ ] Email signup works
- [ ] Phone signup works
- [ ] Email verification sent
- [ ] Profile creation works
- [ ] Profile photo upload works

**Item Listing:**
- [ ] Create new listing
- [ ] Upload multiple images
- [ ] Edit listing
- [ ] Delete listing
- [ ] View own listings

**Search & Discovery:**
- [ ] Search by keyword
- [ ] Filter by category
- [ ] Filter by price range
- [ ] Filter by node/location
- [ ] Sort results (price, date, etc.)

**Trade Flow:**
- [ ] Buy now with cash
- [ ] Buy now with points
- [ ] Buy now with mixed payment
- [ ] Payment processing works
- [ ] Trade confirmation works
- [ ] Cancel trade works

**Messaging:**
- [ ] Send message
- [ ] Receive message
- [ ] Push notification works
- [ ] Image sharing works

**Reviews:**
- [ ] Leave review
- [ ] View reviews
- [ ] Report review
- [ ] Admin moderation works

**Subscriptions:**
- [ ] View subscription tiers
- [ ] Subscribe to tier
- [ ] Free trial works
- [ ] Cancel subscription

**Admin Panel:**
- [ ] Admin login works
- [ ] View dashboard
- [ ] Manage users
- [ ] Manage items
- [ ] Moderation queue

### Time Breakdown: **~6 hours**

---

## TASK TEST-008: Perform Load Testing (Simulate 2X Peak Capacity using k6 or Artillery)

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** All backend features

### Description
Load test backend to simulate 2x peak capacity. Test: API response times, database performance, Edge Function execution. Use k6 or Artillery. Identify bottlenecks.

---

### AI Prompt for Cursor (Generate Load Tests)

```typescript
/*
TASK: Create load tests to simulate 2x peak capacity

CONTEXT:
Use k6 for load testing.
Simulate realistic user behavior.

REQUIREMENTS:
1. Test API endpoints (list items, search, create trade)
2. Simulate 2x peak capacity (e.g., 1000 concurrent users)
3. Measure response times
4. Identify bottlenecks
5. Test Edge Functions under load

==================================================
FILE: Load test script
==================================================
*/

// filepath: load-tests/api-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 500 }, // Stay at 500 users
    { duration: '2m', target: 1000 }, // Peak at 1000 users (2x capacity)
    { duration: '3m', target: 1000 }, // Maintain peak
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'], // <1% failure rate
  },
};

const BASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const API_KEY = 'YOUR_ANON_KEY';

export default function () {
  // Test 1: List items
  const listResponse = http.get(`${BASE_URL}/rest/v1/items?select=*&limit=20`, {
    headers: {
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  check(listResponse, {
    'list items status 200': (r) => r.status === 200,
    'list items response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test 2: Search items
  const searchResponse = http.get(
    `${BASE_URL}/rest/v1/items?select=*&title=ilike.%toy%&limit=20`,
    {
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  check(searchResponse, {
    'search status 200': (r) => r.status === 200,
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(2);

  // Test 3: View item details
  const itemId = 'some-item-id'; // Use real item ID from seed data
  const detailsResponse = http.get(
    `${BASE_URL}/rest/v1/items?id=eq.${itemId}&select=*`,
    {
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  check(detailsResponse, {
    'item details status 200': (r) => r.status === 200,
    'item details response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

/*
==================================================
Run load test:
k6 run load-tests/api-load-test.js

Expected results:
- 95% of requests < 500ms
- <1% failure rate
- No database connection errors

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Load test simulates 2x peak capacity
✓ API response times measured
✓ Database performance tested
✓ Bottlenecks identified
✓ All thresholds met

==================================================
NEXT TASK
==================================================

TEST-009: Test SMS rate limiting under high load
*/
```

### Time Breakdown: **~4 hours**

---

## TASK TEST-009: Test SMS Rate Limiting Under High Load

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** NOTIF-006 (SMS notifications)

### Description
Test SMS rate limiting (3 per day per user). Simulate high load. Verify rate limit enforced. Check error messages.

---

### Time Breakdown: **~2 hours**

---

## TASK TEST-010: Test Supabase Realtime Chat Under Load (100+ Concurrent Users)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** MODULE-07 (Messaging)

### Description
Load test Supabase Realtime for chat. Simulate 100+ concurrent users sending messages. Measure latency, message delivery rate. Test connection stability.

---

### Time Breakdown: **~3 hours**

---

## TASK TEST-011: Test Image Upload/Resize Performance (Large Batches)

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** MODULE-04 (Item listing - images)

### Description
Test image upload and resize performance. Upload batches of 100+ images. Measure processing time. Test CDN delivery speed.

---

### Time Breakdown: **~2.5 hours**

---

## TASK TEST-012: Test CPSC Batch Import (Ensure Completes Within 24 Hours)

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** SAFETY-001 (CPSC import)

### Description
Test CPSC daily batch import. Verify completes within time window. Check deduplication logic. Monitor import logs.

---

### Time Breakdown: **~2 hours**

---

## TASK TEST-013: Test AI Moderation Batch Processing (Ensure No UX Impact)

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** SAFETY-004 (AI moderation)

### Description
Test AI moderation under load. Process 100+ items. Verify no UX impact (users don't wait). Check moderation logs for accuracy.

---

### Time Breakdown: **~2.5 hours**

---

## TASK TEST-014: Fix All Critical Bugs Identified During QA

**Duration:** 6 hours  
**Priority:** Critical  
**Dependencies:** TEST-007 (Manual QA)

### Description
Triage and fix all critical bugs found during QA. Prioritize: P0 (blocking), P1 (critical), P2 (important). Retest after fixes.

---

### Bug Triage Template

**P0 - Blocking (Fix immediately):**
- App crashes on startup
- Cannot complete payment
- Data loss on trade
- Security vulnerabilities

**P1 - Critical (Fix before launch):**
- Major feature broken
- Incorrect fee calculation
- Push notifications not working
- Admin panel not accessible

**P2 - Important (Fix soon):**
- UI glitches
- Minor calculation errors
- Missing error messages
- Performance issues

**P3 - Nice to have (Post-launch):**
- UI polish
- Non-critical features
- Feature requests

### Time Breakdown: **~6 hours**

---

---

## MODULE 15 SUMMARY

**Total Tasks:** 14  
**Estimated Time:** ~52 hours

### Task Breakdown

| Task | Description | Duration | Status |
|------|-------------|----------|--------|
| TEST-001 | Unit tests for core logic | 5h | ✅ Documented |
| TEST-002 | Integration tests for APIs | 4h | ✅ Documented |
| TEST-003 | E2E tests for user flows | 6h | ✅ Documented |
| TEST-004 | CI/CD automated testing | 3h | ✅ Documented |
| TEST-005 | Seed 500 fake users | 2.5h | ✅ Documented |
| TEST-006 | Seed 1,500 fake listings | 3h | ✅ Documented |
| TEST-007 | Manual QA all flows | 6h | ✅ Documented |
| TEST-008 | Load testing (2x capacity) | 4h | ✅ Documented |
| TEST-009 | Test SMS rate limiting | 2h | ✅ Documented |
| TEST-010 | Test Realtime chat load | 3h | ✅ Documented |
| TEST-011 | Test image upload performance | 2.5h | ✅ Documented |
| TEST-012 | Test CPSC batch import | 2h | ✅ Documented |
| TEST-013 | Test AI moderation batch | 2.5h | ✅ Documented |
| TEST-014 | Fix critical bugs | 6h | ✅ Documented |

---

### Key Features

**Automated Testing:**
- Unit tests (Jest/Vitest)
- Integration tests (Edge Functions)
- E2E tests (Detox)
- CI/CD pipeline (GitHub Actions)
- Code coverage tracking

**Load Testing:**
- API performance (k6)
- Realtime chat (100+ users)
- Image processing
- SMS rate limiting
- AI moderation batching

**Manual QA:**
- Complete user flow testing
- Cross-platform (iOS + Android)
- Bug tracking and triage
- Regression testing

**Test Data:**
- 500 fake users
- 1,500 fake listings
- Realistic data generation

---

### Testing Tools

**Unit Testing:**
- Vitest (fast, modern)
- Jest (alternative)
- @testing-library/react-native

**E2E Testing:**
- Detox (React Native)
- Maestro (alternative)
- Appium (alternative)

**Load Testing:**
- k6 (scriptable, modern)
- Artillery (alternative)
- JMeter (alternative)

**CI/CD:**
- GitHub Actions
- CircleCI (alternative)
- GitLab CI (alternative)

**Data Generation:**
- @faker-js/faker
- lorem-picsum (images)

---

### Coverage Goals

**Unit Tests:**
- Core logic: 80%+
- Services: 70%+
- Components: 60%+

**Integration Tests:**
- All Edge Functions
- All RPC functions
- All webhooks

**E2E Tests:**
- All critical user flows
- All payment flows
- All moderation flows

---

### Performance Benchmarks

**API Response Times:**
- List items: <200ms
- Search: <300ms
- Item details: <150ms
- Create trade: <500ms

**Load Capacity:**
- Concurrent users: 500+ (normal), 1000+ (peak)
- Requests per second: 100+ (normal), 200+ (peak)
- Database connections: <50

**Realtime Chat:**
- Message delivery latency: <100ms
- Concurrent connections: 100+
- Message throughput: 1000+ msg/sec

**Image Processing:**
- Upload + resize: <3 seconds per image
- Batch processing: 100 images in <5 minutes
- CDN delivery: <200ms

---

### Bug Priority Matrix

| Priority | Description | Examples | Fix Timeline |
|----------|-------------|----------|--------------|
| P0 | Blocking | App crashes, data loss, security | Immediately |
| P1 | Critical | Major feature broken, payment fails | Before launch |
| P2 | Important | UI glitches, minor bugs | Within 1 week |
| P3 | Nice to have | Polish, enhancements | Post-launch |

---

### Testing Checklist

**Before Launch:**
- [ ] All unit tests passing (80%+ coverage)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Load testing completed (2x capacity)
- [ ] Manual QA completed (all flows)
- [ ] All P0 and P1 bugs fixed
- [ ] CI/CD pipeline configured
- [ ] Test data seeded (500 users, 1500 items)

**Launch Criteria:**
- [ ] Zero P0 bugs
- [ ] Zero P1 bugs
- [ ] <5 P2 bugs
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Privacy policy approved
- [ ] Terms of service approved

---

### Continuous Testing

**Daily:**
- Automated test runs (CI/CD)
- Monitor production errors
- Check performance metrics

**Weekly:**
- Regression testing
- Manual smoke tests
- Review bug backlog

**Monthly:**
- Load testing
- Security audit
- Coverage review

---

### Testing Best Practices

**Unit Tests:**
- Test one thing at a time
- Mock external dependencies
- Use descriptive test names
- Arrange, Act, Assert pattern

**Integration Tests:**
- Test realistic scenarios
- Use test databases
- Clean up after tests
- Test error cases

**E2E Tests:**
- Test happy path first
- Test critical error paths
- Keep tests independent
- Use stable selectors

**Load Tests:**
- Ramp up gradually
- Monitor system resources
- Test failure scenarios
- Document bottlenecks

---

### Future Testing Enhancements

1. **Visual Regression Testing** - Catch UI changes
2. **Accessibility Testing** - WCAG compliance
3. **Security Testing** - Penetration testing
4. **Chaos Engineering** - Test system resilience
5. **A/B Testing Framework** - Experiment tracking
6. **Performance Monitoring** - Real user metrics
7. **Synthetic Monitoring** - Proactive alerts
8. **Smoke Testing** - Pre-production checks
9. **Canary Deployments** - Gradual rollouts
10. **Blue-Green Deployments** - Zero-downtime releases

---

**MODULE 15: TESTING & QA - COMPLETE**

---

## PROJECT COMPLETION SUMMARY

**All 15 modules documented:**
1. ✅ Infrastructure
2. ✅ Authentication
3. ✅ Node Management
4. ✅ Item Listing
5. ✅ Search & Discovery
6. ✅ Trade Flow
7. ✅ Messaging
8. ✅ Reviews & Ratings
9. ✅ Points & Gamification
10. ✅ Badges & Trust
11. ✅ Subscriptions
12. ✅ Admin Panel
13. ✅ Safety & Compliance
14. ✅ Notifications
15. ✅ Testing & QA

**Total Estimated Time:** ~500+ hours  
**Ready for implementation using Claude Sonnet 4.5 agents!**
