# MODULE-06 TRADE FLOW: Test Execution Guide

## Quick Start

### Run All Module-06 Tests
```bash
cd p2p-kids-marketplace
npm test -- --testPathPattern=trade
```

### Run Specific Test Suites

#### 1. Unit Tests (Trade Service)
```bash
npm run test:unit:trade
```

#### 2. Integration Tests (NEW)
```bash
# Trade payment atomic transactions
npm test -- src/__tests__/integration/trade-payment.integration.test.ts

# Admin force-cancel
npm test -- src/__tests__/integration/admin-force-cancel.integration.test.ts
```

#### 3. E2E Tests
```bash
# Full trade flow
npm test -- src/__tests__/e2e/trade-flow-v2.e2e.ts

# Mid-trade subscription changes (NEW)
npm test -- src/__tests__/e2e/mid-trade-subscription.e2e.ts
```

#### 4. Test Coverage Report
```bash
bash scripts/test-coverage-module-06.sh
# Opens coverage/lcov-report/index.html
```

---

## Test Configuration

### Environment Variables (Required for Integration/E2E)

Create `.env.test` with:
```bash
# Test User IDs (from Supabase staging)
TEST_SUBSCRIBER_BUYER_ID=uuid-here
TEST_FREE_BUYER_ID=uuid-here
TEST_SELLER_ID=uuid-here
TEST_ADMIN_USER_ID=uuid-here

# Test Item ID
TEST_ITEM_ID=uuid-here

# Supabase (staging)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_...
```

### Test Data Setup (One-Time)

Run this SQL in Supabase SQL Editor (staging):
```sql
-- Create test users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES 
  ('test-subscriber-buyer', 'subscriber-buyer@test.com', crypt('test-password', gen_salt('bf')), NOW()),
  ('test-free-buyer', 'free-buyer@test.com', crypt('test-password', gen_salt('bf')), NOW()),
  ('test-seller', 'seller@test.com', crypt('test-password', gen_salt('bf')), NOW()),
  ('test-admin', 'admin@test.com', crypt('test-password', gen_salt('bf')), NOW());

-- Create test profiles
INSERT INTO profiles (user_id, username, role, node_id)
VALUES 
  ('test-subscriber-buyer', 'test-sub-buyer', 'user', 'node-123'),
  ('test-free-buyer', 'test-free-buyer', 'user', 'node-123'),
  ('test-seller', 'test-seller', 'user', 'node-123'),
  ('test-admin', 'test-admin', 'admin', 'node-123');

-- Create test subscriptions
INSERT INTO subscriptions (user_id, status, stripe_subscription_id, plan_id)
VALUES 
  ('test-subscriber-buyer', 'active', 'sub_test_123', 'kids_club_monthly');

-- Create test item
INSERT INTO items (id, seller_id, title, price, status, node_id)
VALUES 
  ('test-item', 'test-seller', 'Test Item', 25.00, 'available', 'node-123');
```

---

## Test Categories

### ✅ Unit Tests (TRADE-V2-002, PAY-002)
- `src/services/__tests__/trade.test.ts`
- `p2p-kids-admin/src/lib/payoutFees.test.ts`

**What they test:**
- Fee calculation ($0.99 vs $2.99)
- SP clamping to available balance
- Self-purchase prevention
- Payout fee calculations (Stripe, PayPal, Venmo)

**No external dependencies required** (mocked Supabase)

---

### ✅ Integration Tests (TRADE-V2-003, TRADE-V2-009)

#### trade-payment.integration.test.ts
**Tests:**
- INT-01: Successful Stripe payment + SP debit (atomic)
- INT-02: Stripe failure → no SP debit
- INT-03: SP debit failure → trade marked failed
- INT-04: Idempotency (no duplicate charges)

**Requires:** Live Supabase + Stripe test keys

#### admin-force-cancel.integration.test.ts
**Tests:**
- ADMIN-INT-01: Force cancel pending trade
- ADMIN-INT-02: Force cancel in_progress with refunds
- ADMIN-INT-03: Cannot cancel completed trades
- ADMIN-INT-04: Audit log integrity

**Requires:** Live Supabase + admin user

---

### ✅ E2E Tests (TRADE-V2-007, TRADE-V2-010)

#### trade-flow-v2.e2e.ts
**Tests:**
- E2E-01: Full happy path (subscriber with SP)
- E2E-02: Free user (no SP)
- E2E-03: Pre-payment cancellation
- E2E-04: Post-payment cancellation with refunds
- E2E-05: Auto-completion after 7 days

**Requires:** Live Supabase + test users + test item

#### mid-trade-subscription.e2e.ts (NEW)
**Tests:**
- E2E-07-01: Subscription expires during in_progress trade
- E2E-07-02: Subscription downgrade mid-trade
- E2E-07-03: Monitor function detects changes

**Requires:** Live Supabase + ability to manipulate subscription status

---

## Expected Test Results

### Passing Criteria
- ✅ All unit tests pass (no mocking issues)
- ✅ Integration tests pass (Stripe test cards work)
- ✅ E2E tests pass (test data seeded correctly)
- ✅ Coverage ≥80% for trade services

### Common Issues

#### "Cannot find module @/..."
```bash
# Fix: Ensure TypeScript paths are configured
npm run type-check
```

#### "Supabase connection failed"
```bash
# Fix: Check .env.test has correct SUPABASE_URL
node scripts/check-supabase.js
```

#### "Test user not found"
```bash
# Fix: Run test data setup SQL (see above)
```

#### "Stripe payment failed"
```bash
# Fix: Use Stripe test cards:
# Success: pm_card_visa
# Decline: pm_card_chargeDeclined
```

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test-module-06.yml
name: Module-06 Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run type-check
      - run: npm run lint
      - run: npm test -- --testPathPattern=trade --coverage
      - run: bash scripts/test-coverage-module-06.sh
```

---

## Debugging Tips

### Enable Verbose Logging
```bash
# For unit tests
DEBUG=* npm test -- --testPathPattern=trade --verbose

# For integration tests
LOG_LEVEL=debug npm test -- src/__tests__/integration/
```

### Inspect Test Database
```bash
# Connect to Supabase staging
psql $SUPABASE_DB_URL

# Check test trades
SELECT id, status, buyer_id, seller_id, created_at 
FROM trades 
WHERE buyer_id LIKE 'test-%' 
ORDER BY created_at DESC 
LIMIT 10;

# Check SP ledger
SELECT * FROM sp_ledger 
WHERE user_id LIKE 'test-%' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Clean Test Data
```sql
-- Remove test trades
DELETE FROM trades WHERE buyer_id LIKE 'test-%' OR seller_id LIKE 'test-%';

-- Remove test SP ledger entries
DELETE FROM sp_ledger WHERE user_id LIKE 'test-%';
```

---

## Test Maintenance

### When to Update Tests

1. **Trade schema changes**: Update `src/types/trade.ts` + tests
2. **Fee formula changes**: Update unit tests in `trade.test.ts`
3. **New trade statuses**: Update E2E tests + state machine
4. **SP rules changes**: Update integration tests + SP wallet mocks

### Test Data Refresh
```bash
# Re-seed test data monthly
bash scripts/seed-test-data.sh
```

---

## Related Documentation

- [MODULE-06-VERIFICATION-V2.md](../Prompts/MODULE-06-VERIFICATION-V2.md)
- [MODULE-06-IMPLEMENTATION-COMPLETE.md](../MODULE-06-IMPLEMENTATION-COMPLETE.md)
- [SYSTEM_REQUIREMENTS_V2.md](../docx/SYSTEM_REQUIREMENTS_V2.md)

---

**Last Updated:** January 3, 2026  
**Test Count:** 30+ tests across unit/integration/E2E  
**Coverage Target:** ≥80%
