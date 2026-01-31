# 🚀 Quick Testing Guide

## New Commands Available

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `npm run test:unit` | Runs only unit tests (no Supabase needed) | Quick sanity check |
| `npm run test:integration` | Runs integration tests against staging | Testing DB/API changes |
| `npm run test:e2e` | Runs E2E tests against staging | Full flow verification |
| `npm run test:auth` | Auth-related tests only | Testing auth changes |
| `npm run test:trades` | Trade-related tests only | Testing trade changes |
| `npm run test:all` | All tests including skipped ones | Complete verification |
| `npm run seed:staging` | Create test data | Before testing |
| `npm run reset:staging -- --force` | Delete test data | Clean slate |

## 🧪 Your New Testing Workflow

### Before (10+ minutes manual):
1. Open simulator
2. Register new user manually
3. Create listing manually  
4. Log into another account
5. Find listing, request trade
6. Switch accounts, accept trade
7. Verify everything worked

### After (~2 minutes automated):

```bash
# One-time setup: seed your staging with test data
npm run seed:staging

# Quick verification of auth flows
npm run test:auth

# Quick verification of trade flows  
npm run test:trades

# Or run everything
npm run test:all
```

## 📋 Test Credentials (Created by seed:staging)

```
BUYER:  test-buyer@kidsmarketplace.test / TestBuyer123!
SELLER: test-seller@kidsmarketplace.test / TestSeller123!
```

Use these for manual testing when you need to visually verify UI.

## 🔄 Fresh Start

When test data gets messy:

```bash
# Reset everything
npm run reset:staging -- --force

# Recreate clean test data
npm run seed:staging
```

## 📊 What's Already Tested (146 E2E Tests)

Your existing test coverage includes:

- ✅ **Auth Flow**: Signup → Phone Verification → Profile → Trial Enrollment
- ✅ **Trade Flow**: Initiate → Accept → Complete → Cancel
- ✅ **Discovery**: Item filtering, recommendations, search
- ✅ **Reviews**: Submission, mutual flow, anonymous reviews
- ✅ **Payments**: Stripe + SP wallet integration
- ✅ **Admin**: Force cancel, moderation
- ✅ **Messaging**: Expiration, conversations

These were being **skipped** - now they run with the new commands!
