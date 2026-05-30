# SUB-009: Implementation Checklist

Use this checklist to track completion of MODULE-11 SUB-009 (Grace Period Countdown, Reminders & Expiry).

---

## Phase 1: Backend Implementation ✅ COMPLETE

- [x] Database migration: `grace_reminder_thresholds` config
- [x] Edge Function: `grace-period-cron` (344 lines)
- [x] Cron scheduler migration: pg_cron job at 3:00 AM UTC
- [x] RPC function: `invoke_grace_period_cron()`

**Files Created:**
- ✅ `/supabase/migrations/20260224000001_grace_reminder_thresholds.sql`
- ✅ `/supabase/functions/grace-period-cron/index.ts`
- ✅ `/supabase/migrations/20260224000002_schedule_grace_period_cron.sql`

---

## Phase 2: Frontend Implementation ⚠️ 95% COMPLETE

- [x] React Native component: `GracePeriodBanner.tsx` (119 lines)
- [x] Import added to `UserDashboardScreen.tsx` (line 24)
- [ ] **JSX integration in `UserDashboardScreen.tsx`** ← **ACTION REQUIRED**

**Files Created:**
- ✅ `/p2p-kids-marketplace/src/components/GracePeriodBanner.tsx`

**Files Partially Modified:**
- ⚠️ `/p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx`

**Next Action:**
1. Open `p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx`
2. Find line 237 (`<TrialReminderBanner />`)
3. Add the grace period banner code (see `SUB-009-QUICK-FIX.md`)
4. Save the file

---

## Phase 3: Database Setup ⏳ PENDING

- [ ] Run SQL prerequisites (http extension, database settings)
- [ ] Apply migrations (`npx supabase db push`)
- [ ] Deploy Edge Function (`npx supabase functions deploy grace-period-cron`)
- [ ] Set environment variable: `SP_SUBSCRIPTION_EXPIRE_URL`
- [ ] Run verification queries (`SUB-009-VERIFICATION.sql`)

**Next Actions:**
1. Open Supabase SQL Editor
2. Copy/paste commands from `SUB-009-IMPLEMENTATION-INSTRUCTIONS.md` → Section "Pre-Deployment SQL Setup"
3. Run `SUB-009-VERIFICATION.sql` to confirm setup

---

## Phase 4: Quality Assurance ⏳ PENDING

### Tier 0: Compile & Lint
- [ ] Run `npm run typecheck` from `p2p-kids-marketplace/` (must exit 0)
- [ ] Run `npm run lint` from `p2p-kids-marketplace/` (must exit 0)

### Manual Testing (iOS/Android Simulator)
- [ ] TC-001: Grace period banner displays (15 days, yellow, ⏰)
- [ ] TC-002: Banner shows urgent level (7 days, orange, ⚠️)
- [ ] TC-003: Banner shows critical level (1 day, red, ⛔)
- [ ] TC-004: "Re-Subscribe Now" button navigates to ManageKidsClub
- [ ] TC-005: Cron job manual trigger returns success JSON
- [ ] TC-006: Expiry transition works (grace_period → expired)
- [ ] TC-007: 60-day reminder notification sent
- [ ] TC-008: 30-day reminder notification sent
- [ ] TC-009: 7-day reminder notification sent
- [ ] TC-010: 1-day reminder notification sent

**Next Actions:**
1. Complete Phase 2 (JSX integration)
2. Run Tier 0 (typecheck + lint)
3. Start simulator: `npm start` from `p2p-kids-marketplace/`
4. Follow test cases from `SUB-009-IMPLEMENTATION-INSTRUCTIONS.md`

---

## Phase 5: Automated Tests ⏳ PENDING

- [ ] Unit tests created: `supabase/functions/grace-period-cron/__tests__/index.test.ts`
- [ ] Unit tests passing (all test cases)
- [ ] E2E tests created: `p2p-kids-marketplace/src/__tests__/e2e/sub-009-grace-period.e2e.ts`
- [ ] E2E tests passing (full flow)

**Next Actions:**
1. Create unit test file (test days calculation, expiry logic, reminder deduplication)
2. Run: `npm test -- grace-period-cron`
3. Create E2E test file (test full grace period lifecycle)
4. Run: `npm test -- sub-009-grace-period.e2e.ts`

---

## Phase 6: Documentation ⏳ PENDING

- [ ] Manual test cases document created: `SUB-009-MANUAL-TEST-CASES.md`
- [ ] Flow registry updated: `docs/flow-registry.md` (add FLOW-12.1)
- [ ] Component export added: `p2p-kids-marketplace/src/components/index.ts`

**Next Actions:**
1. Create `SUB-009-MANUAL-TEST-CASES.md` (format matching `SUB-004-MANUAL-TESTING-GUIDE.md`)
2. Add FLOW-12.1 entry to `docs/flow-registry.md`
3. Export GracePeriodBanner in `src/components/index.ts`

---

## Phase 7: Regression Testing ⏳ PENDING

### Tier 1: Targeted Smoke Tests
- [ ] FLOW-12 smoke tests passing (grace period lifecycle)

### Tier 2: Full Regression
- [ ] Database reset: `npx supabase db reset --linked`
- [ ] All smoke tests passing: `npm run test:smoke:all`

**Next Actions:**
1. Run: `npm run test:smoke -- --flows=FLOW-12`
2. If Tier 1 passes, run: `cd supabase && npx supabase db reset --linked`
3. Run: `npm run test:smoke:all`

---

## Phase 8: Code Review & Merge ⏳ PENDING

- [ ] All verification items from `MODULE-11-VERIFICATION-V2.md` passing (11/15 currently)
- [ ] PR created with summary and test results
- [ ] Code review approved
- [ ] Merged to `main` branch

**Next Actions:**
1. Ensure all previous phases are ✅
2. Create PR with title: `[MODULE-11] SUB-009: Grace Period Countdown, Reminders & Expiry`
3. Link to `SUB-009-IMPLEMENTATION-SUMMARY.md` in PR description
4. Request review

---

## Quick Commands Reference

### Development
```bash
# Typecheck (mobile app)
cd p2p-kids-marketplace && npm run typecheck

# Lint (mobile app)
cd p2p-kids-marketplace && npm run lint

# Start simulator
cd p2p-kids-marketplace && npm start
```

### Database
```bash
# Apply migrations
cd supabase && npx supabase db push

# Reset database (for testing)
cd supabase && npx supabase db reset --linked

# Deploy Edge Function
cd supabase && npx supabase functions deploy grace-period-cron --no-verify-jwt
```

### Testing
```bash
# Unit tests (once created)
cd p2p-kids-marketplace && npm test -- grace-period-cron

# E2E tests (once created)
cd p2p-kids-marketplace && npm test -- sub-009-grace-period.e2e.ts

# Tier 1 smoke
npm run test:smoke -- --flows=FLOW-12

# Tier 2 smoke (all)
npm run test:smoke:all
```

### Manual Cron Trigger
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/grace-period-cron \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| 1. Backend Implementation | ✅ COMPLETE | 100% (4/4) |
| 2. Frontend Implementation | ⚠️ IN PROGRESS | 95% (2/3) |
| 3. Database Setup | ⏳ PENDING | 0% (0/5) |
| 4. Quality Assurance | ⏳ PENDING | 0% (0/12) |
| 5. Automated Tests | ⏳ PENDING | 0% (0/4) |
| 6. Documentation | ⏳ PENDING | 0% (0/3) |
| 7. Regression Testing | ⏳ PENDING | 0% (0/3) |
| 8. Code Review & Merge | ⏳ PENDING | 0% (0/4) |

**Overall:** ~40 /38 tasks (26% complete)

---

## 🚨 Immediate Blockers

**BLOCKER 1:** UserDashboardScreen JSX integration (manual edit required)
- **Impact:** Cannot test banner display in simulator
- **Resolution:** See `SUB-009-QUICK-FIX.md` for exact code to add
- **ETA:** 5 minutes

**BLOCKER 2:** Database setup not yet applied
- **Impact:** Cron job won't run, reminders won't send, expiry won't work
- **Resolution:** Follow "Phase 3: Database Setup" above
- **ETA:** 15 minutes

---

## 📋 Definition of Done

All checkboxes in this file must be ✅ before merging to `main`.

**Current Gate:** Phase 2 (Frontend Implementation) - 95% complete  
**Next Gate:** Phase 3 (Database Setup)

---

**Last Updated:** 2026-02-24  
**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-009
