# PAY-003 Manual Test Guide - Update Summary

## Overview
Successfully updated `PAY-003-MANUAL-TEST-GUIDE.md` to include comprehensive testing for the new **Seller Balance Tracking & Manual Withdrawal** feature (from Migration 074).

## What Was Added

### 1. **Header Updates**
- Updated Module title to: "MODULE-06-TRADE-FLOW-sellerpayouts.md (Phase 1 MVP + Balance/Withdrawal Extension)"
- Updated Task description to include Balance Tracking & Manual Withdrawal
- Added prerequisites for Migration 074 and requirement for at least one completed trade

### 2. **New Test Suite 2: Balance Tracking & Withdrawal (TS-017 through TS-029)**
Added 13 comprehensive test scenarios covering:

| Test ID | Objective | Key Verification |
|---------|-----------|------------------|
| TS-017 | Balance Card Display (Initial State) | $0 balance for new users |
| TS-018 | Trade Completion Triggers Balance Update | Balance increases after buyer completes trade |
| TS-019 | Withdraw Button Visibility | Button appears when balance > $0 |
| TS-020 | Withdraw Modal Fee Breakdown | Correct fee calculation with Stripe example |
| TS-021 | Successful Withdrawal Request | Payout record created, balance decremented |
| TS-022 | Recent Payouts Display | Withdrawal shows in recent payouts list |
| TS-023 | Lifetime Earnings Persistence | Earnings accumulate across withdrawals |
| TS-024 | Minimum Withdrawal Validation | $5.00 minimum enforced |
| TS-025 | Verified Method Requirement | Withdrawal blocked without verified method |
| TS-026 | PayPal Fee Calculation | 2% fee with $20 cap verified |
| TS-027 | Venmo Fee Calculation | 2% fee with $20 cap verified |
| TS-028 | Network Timeout Error Handling | Graceful error recovery |
| TS-029 | Multi-Trade Balance Accumulation | Balance updates correctly across 3+ trades |

### 3. **Enhanced Error Handling Tests (EH-004 through EH-006)**
Added 3 new error test cases:
- **EH-004:** Insufficient balance during withdrawal
- **EH-005:** Minimum withdrawal validation
- **EH-006:** Unverified payout method error

### 4. **New Database Verification Queries**
Added SQL queries for balance/withdrawal verification:
```sql
-- Check seller_balance table
SELECT available_balance_cents, pending_balance_cents, lifetime_balance_cents 
FROM seller_balance WHERE user_id = '<seller_uuid>';

-- Check payouts
SELECT * FROM seller_payouts 
WHERE user_id = '<seller_uuid>' 
ORDER BY created_at DESC LIMIT 10;

-- Verify trigger exists
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'trades'::regclass 
AND tgname = 'trigger_update_seller_balance_on_completion';
```

### 5. **Updated Performance Benchmarks**
Added new timing expectations:
- Load balance card: < 2 seconds
- Open withdraw modal: < 1 second
- Submit withdrawal API call: < 3 seconds
- Fee calculation: < 500ms

### 6. **Enhanced Accessibility Checklist**
Added balance/withdrawal specific accessibility checks:
- Balance amounts clearly distinguishable
- Withdraw button size and contrast
- Modal heading clarity
- Fee breakdown readability
- Status badges with text + color

### 7. **Updated Regression Tests (REG-001 through REG-004)**
- **REG-001:** Complete payout setup flow (TS-001 through TS-016)
- **REG-002:** Balance & withdrawal complete flow (TS-017 through TS-029)
- **REG-003:** Multi-trade accumulation focus
- **REG-004:** Future Stripe Connect compatibility note

### 8. **Comprehensive Test Execution Checklist**
Organized checklist by category:
- **Original Tests (TS-001 through TS-016):** 16 test cases
- **New Balance/Withdrawal Tests (TS-017 through TS-029):** 13 test cases
- **Error Handling Tests (EH-001 through EH-006):** 6 error cases
- **Regression Tests (REG-001 through REG-004):** 4 regression scenarios
- **Final Verification:** 10+ confirmation points

## File Statistics

| Metric | Value |
|--------|-------|
| Original file size | ~500 lines |
| Added content | ~800+ new lines |
| New test scenarios | 13 (TS-017 through TS-029) |
| New error tests | 3 (EH-004 through EH-006) |
| New DB queries | 6+ SQL verification queries |
| Total test coverage | 35+ test scenarios |

## Key Features Tested

### Balance Display
- ✅ Balance card shows available/pending/lifetime amounts
- ✅ Correct formatting ($X.XX)
- ✅ Updates after trade completion
- ✅ Persists across withdrawals

### Withdrawal Flow
- ✅ Modal displays fee breakdown
- ✅ Correct fee calculations (Stripe/PayPal/Venmo)
- ✅ Payout record creation in database
- ✅ Balance decrements correctly

### Validation
- ✅ Minimum $5.00 withdrawal enforced
- ✅ Verified method required
- ✅ Graceful error handling for insufficient balance
- ✅ Network timeout recovery

### Database Integration
- ✅ Trigger fires on trade completion
- ✅ seller_balance table updated correctly
- ✅ seller_payouts records created
- ✅ RLS policies working correctly

## How to Use This Updated Guide

### For QA Testing:
1. Execute tests **TS-001 through TS-016** (original payout method tests)
2. Execute tests **TS-017 through TS-029** (new balance/withdrawal tests)
3. Run regression tests **REG-001 and REG-002**
4. Verify all error cases **EH-001 through EH-006**
5. Check database state with provided SQL verification queries

### Prerequisites:
- ✅ Apply Migration 074: `supabase db push`
- ✅ Have test users ready (buyer + seller with completed profile)
- ✅ Complete at least one trade to test balance update

### Expected Timeline:
- Original tests (TS-001-TS-016): 20-30 minutes
- New balance tests (TS-017-TS-029): 30-40 minutes
- Regression tests: 15-20 minutes
- **Total manual testing: ~60-90 minutes**

## Dependencies

This updated guide requires:
- Migration 074: `supabase/migrations/074_seller_balance_and_withdrawal.sql`
- Service layer: `p2p-kids-marketplace/src/services/sellerBalance.ts`
- Updated UI: `p2p-kids-marketplace/src/screens/seller/PayoutSettingsScreen.tsx`

## Next Steps

### For Developers:
1. ✅ All code changes implemented (Migration 074, Service, UI)
2. ✅ Test guide updated with all verification scenarios
3. → Run database migrations
4. → Build mobile app with latest code
5. → Execute manual test suite using this guide

### For QA:
1. → Review this guide
2. → Follow test scenarios in order
3. → Document results in checklist
4. → Verify database state after critical tests
5. → Sign off on complete test execution

## Sign-Off

**Updated By:** Assistant (GitHub Copilot)  
**Date:** [Current]  
**Status:** ✅ COMPLETE - Ready for Manual QA Testing  
**Total Test Scenarios:** 35+ (16 original + 13 new + 6 error handling)  
**Coverage Areas:** Balance display, withdrawal flow, fee calculations, validation, error handling, database integration

---

**Note:** This is a comprehensive manual testing guide. For production deployment:
1. Run all 35+ test scenarios
2. Verify database state with provided SQL queries
3. Check performance benchmarks
4. Confirm accessibility standards
5. Test on both iOS and Android
6. Document any issues and get sign-off before deployment
