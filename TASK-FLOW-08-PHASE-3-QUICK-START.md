# TASK FLOW-08 Phase 3: Testing & Documentation Quick Start

**Status**: Ready to Execute  
**Prerequisites**: Phase 1 & 2 Complete ✅  
**Estimated Time**: 4-6 hours  

---

## 📋 Phase 3 Checklist

### 1. Unit Tests (2-3 hours)

#### Create Test Files:
```bash
cd p2p-kids-marketplace/src/screens/trade/__tests__

# Create 6 test files:
touch TradeOfferScreen.test.tsx
touch TradeReviewScreen.test.tsx
touch TradeDisputeScreen.test.tsx
touch TradeListScreen.test.tsx
touch TradeTimelineScreen.test.tsx
touch TradeSuccessScreen.test.tsx
```

#### Test Coverage Requirements:

**TradeOfferScreen.test.tsx**:
- [ ] Renders item details correctly
- [ ] SP input validation (max 50% of item price)
- [ ] SP input disabled for non-subscribers
- [ ] Disclaimer modal shown on first trade
- [ ] Trade initiation service called with correct params

**TradeReviewScreen.test.tsx**:
- [ ] Fetches trade details from Supabase
- [ ] Displays offer details (item, SP, cash)
- [ ] Accept button calls accept RPC
- [ ] Decline button shows confirmation
- [ ] Navigation to TradeTimeline on accept

**TradeDisputeScreen.test.tsx**:
- [ ] Reason chips toggleable
- [ ] Evidence upload placeholder works
- [ ] Description character limit enforced
- [ ] Submit button disabled when invalid
- [ ] Submit calls dispute RPC with correct payload

**TradeListScreen.test.tsx**:
- [ ] Tab filtering works (All/Buying/Selling)
- [ ] Status badge colors correct
- [ ] Empty state shown when no trades
- [ ] Navigation to TradeTimeline on tap

**TradeTimelineScreen.test.tsx**:
- [ ] Trade data fetched correctly
- [ ] Timeline steps render in correct order
- [ ] Status banner color matches status
- [ ] Complete button disabled when not in_progress
- [ ] Cancel button shows reason modal
- [ ] Real-time updates subscribe to Supabase

**TradeSuccessScreen.test.tsx**:
- [ ] Success state shows CheckCircle
- [ ] Failure state shows XCircle
- [ ] SP earned badge shown when spEarned > 0
- [ ] Navigation works (View Trade, Back to Home)

#### Run Tests:
```bash
cd p2p-kids-marketplace
yarn test src/screens/trade/__tests__
```

---

### 2. E2E Integration Tests (1-2 hours)

#### Create Test File:
```bash
cd p2p-kids-marketplace/e2e
touch trade-flow.e2e.ts
```

#### Test Scenarios:

```typescript
// trade-flow.e2e.ts

describe('Trade Flow E2E', () => {
  it('should complete full trade lifecycle', async () => {
    // 1. Initiate trade with SP
    // 2. Navigate to TradeTimeline
    // 3. Mark as completed (both parties)
    // 4. Navigate to TradeSuccess
  });

  it('should accept incoming trade offer', async () => {
    // 1. Navigate to TradeReview
    // 2. Accept trade
    // 3. Verify navigation to TradeTimeline
  });

  it('should file dispute', async () => {
    // 1. Navigate to TradeDispute
    // 2. Select reason
    // 3. Add description
    // 4. Submit
    // 5. Verify trade status updated
  });

  it('should cancel trade', async () => {
    // 1. Navigate to TradeTimeline
    // 2. Cancel trade
    // 3. Verify cancellation reason
    // 4. Verify SP refunded
  });
});
```

#### Run E2E:
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true yarn test e2e/trade-flow.e2e.ts
```

---

### 3. Maestro UI Flow (30 min)

#### Create Flow File:
```bash
cd p2p-kids-marketplace/.maestro
touch trade-flow.yaml
```

#### Maestro Flow:
```yaml
appId: com.p2p.kidsmarketplace
---
# Trade Flow UI Test

# 1. Navigate to Trade Offer
- tapOn:
    id: "trade-offer-card"
- assertVisible:
    id: "sp-input"
- inputText: "100"
- tapOn:
    id: "confirm-trade-button"

# 2. Verify Trade Timeline
- assertVisible:
    id: "trade-timeline"
- assertVisible:
    id: "status-banner"

# 3. Test Message Button
- tapOn:
    id: "message-button"
- assertVisible: "Chat"

# 4. Navigate to Trade History
- back
- tapOn:
    id: "trade-history-tab"
- assertVisible:
    id: "tab-all"
- tapOn:
    id: "tab-buying"

# 5. Test Success Screen
- tapOn: "View Trade"
- assertVisible:
    id: "success-icon"
```

#### Run Maestro:
```bash
maestro test .maestro/trade-flow.yaml
```

---

### 4. Manual Testing Guide (1 hour)

#### Create Guide:
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
touch TASK-FLOW-08-MANUAL-TESTING.md
```

#### Guide Structure:
```markdown
# Manual Testing Guide: Trade Flow Screens

## Prerequisites
- [ ] 2+ test users (1 free, 1 subscriber)
- [ ] Test items listed by both users
- [ ] Different node assignments
- [ ] Supabase staging environment

## Test Case 1: Initiate Trade (TradeOfferScreen)
**User**: Subscriber (for SP testing)
**Steps**:
1. Navigate to listing detail
2. Tap "Make Offer" → TradeOfferScreen
3. Verify SP input shows (subscribers only)
4. Enter 100 SP
5. Verify SP cap enforced (max 50% of price)
6. Tap "Confirm Trade"
7. Accept disclaimer if first trade
8. **Expected**: Navigate to TradeTimeline, status "pending"

## Test Case 2: Review Incoming Offer (TradeReviewScreen)
**User**: Seller
**Steps**:
1. Navigate to notification/trade list
2. Tap pending trade → TradeReviewScreen
3. Verify offer details shown
4. Verify SP balance preview
5. Tap "Accept Trade"
6. **Expected**: Navigate to TradeTimeline, status "in_progress"

## Test Case 3: File Dispute (TradeDisputeScreen)
**User**: Buyer or Seller
**Steps**:
1. Navigate to TradeTimeline (in_progress trade)
2. Tap "Report Problem" → TradeDisputeScreen
3. Select reason chip "Item not as described"
4. Tap evidence upload (placeholder)
5. Enter description (100+ chars)
6. Tap "Submit Dispute"
7. **Expected**: Trade status "disputed", admin notified

## Test Case 4: Complete Trade (TradeTimelineScreen)
**User**: Seller first, then Buyer
**Steps**:
1. Navigate to TradeTimeline
2. Verify status banner (yellow for pending, green for in_progress)
3. Tap "Mark as Completed" (seller)
4. **Expected**: Message "Waiting for buyer"
5. Switch to buyer, tap "Mark as Completed"
6. **Expected**: Navigate to TradeSuccess, status "completed"

## Test Case 5: Browse History (TradeListScreen)
**User**: Any
**Steps**:
1. Navigate to "My Trades" → TradeListScreen
2. Tap "All" tab → verify all trades shown
3. Tap "Buying" → verify only buyer trades
4. Tap "Selling" → verify only seller trades
5. Verify status badge colors (pending=amber, active=green, completed=gray)

## Test Case 6: Result Screens (TradeSuccessScreen)
**User**: Any
**Steps**:
1. After completing trade → TradeSuccessScreen
2. Verify CheckCircle green icon
3. Verify SP earned badge (if applicable)
4. Tap "View Trade" → TradeTimeline
5. Test failure state: initiate trade with insufficient funds
6. **Expected**: XCircle red icon, error message, "Try Again" button

## Visual Checklist
- [ ] All Phosphor icons render correctly
- [ ] Status colors match spec (pending=amber, active=green, etc.)
- [ ] Buttons are pill-shaped (borderRadius = height/2)
- [ ] Inputs are filled style (#F0F0F0, no borders)
- [ ] SP inputs have gold background (#FEF3C7)
- [ ] Safety disclaimers have green background (#E8F5F0)
```

---

### 5. Flow Registry Update (15 min)

#### Update File:
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
nano docs/flow-registry.md
```

#### Add Entry:
```markdown
### FLOW-08: Trade Flow – Initiate/Review/Dispute/Timeline/History/Result

**Covers**:
- TradeOfferScreen (initiate with SP)
- TradeReviewScreen (accept/decline offers)
- TradeDisputeScreen (file disputes)
- TradeTimelineScreen (track progress, mark complete, cancel)
- TradeListScreen (browse history with tabs)
- TradeSuccessScreen (success/failure results)

**Smoke Script**: `scripts/smoke/trade-flow.mjs`

**Tier Rules**:
- Tier 0: Always (typecheck + lint when trade screens change)
- Tier 1: When any trade screen/service changes
- Tier 2: When trade state machine, SP logic, or fees change

**Test Data Required**:
- 2+ users (free + subscriber)
- 3+ listings per node
- Test trades in each status (pending, in_progress, completed, cancelled, disputed)

**Known Dependencies**:
- FLOW-04 (Listings)
- FLOW-11 (Swap Points)
- FLOW-12 (Subscriptions)
- FLOW-14 (Notifications)
```

---

### 6. Smoke Test Script (1 hour)

#### Create Script:
```bash
cd p2p-kids-marketplace/scripts/smoke
touch trade-flow.mjs
chmod +x trade-flow.mjs
```

#### Script Template:
```javascript
#!/usr/bin/env node
/**
 * Smoke Test: FLOW-08 Trade Flow
 * Tests all 6 trade screens with seeded data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTradeFlowSmoke() {
  console.log('🧪 FLOW-08: Trade Flow Smoke Test\n');

  // 1. Test trade initiation
  console.log('1️⃣ Testing trade initiation...');
  // Call initiateTradeV2 with test data
  
  // 2. Test trade review/accept
  console.log('2️⃣ Testing trade review...');
  // Fetch pending trade, simulate accept
  
  // 3. Test trade completion
  console.log('3️⃣ Testing trade completion...');
  // Mark as completed (both parties)
  
  // 4. Test trade history
  console.log('4️⃣ Testing trade history...');
  // Fetch trades, verify filtering
  
  // 5. Test dispute flow
  console.log('5️⃣ Testing dispute flow...');
  // File dispute, verify status change
  
  console.log('\n✅ All FLOW-08 smoke tests passed!');
  process.exit(0);
}

runTradeFlowSmoke().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
```

#### Run Smoke:
```bash
cd p2p-kids-marketplace
node scripts/smoke/trade-flow.mjs
```

---

## 🚀 Execution Order

1. **Unit Tests** (start here, can run locally)
2. **Manual Testing Guide** (document expected behavior)
3. **Flow Registry Update** (register FLOW-08)
4. **Smoke Test Script** (automate key paths)
5. **E2E Tests** (requires Supabase staging)
6. **Maestro Flow** (requires device/simulator)

---

## ✅ Completion Criteria

### All Phase 3 tasks complete when:
- [ ] All 6 unit test files created with >80% coverage
- [ ] `yarn test src/screens/trade/__tests__` passes
- [ ] E2E integration test created and passes
- [ ] Maestro flow created (`.maestro/trade-flow.yaml`)
- [ ] Manual testing guide created with 6+ test cases
- [ ] Flow registry updated with FLOW-08 entry
- [ ] Smoke test script created and passes
- [ ] All tests run in CI (GitHub Actions)

---

## 📊 Expected Test Results

### Unit Tests:
```
Test Suites: 6 passed, 6 total
Tests:       35 passed, 35 total
Coverage:    85.3% (target >80%)
```

### E2E Tests:
```
Trade Flow E2E
  ✓ should complete full trade lifecycle (2500ms)
  ✓ should accept incoming trade offer (1200ms)
  ✓ should file dispute (800ms)
  ✓ should cancel trade (600ms)
```

### Maestro:
```
✓ Navigate to Trade Offer
✓ Verify Trade Timeline
✓ Test Message Button
✓ Navigate to Trade History
✓ Test Success Screen

5 flows passed
```

---

## 🔄 After Phase 3 Complete

1. **Commit & Push**:
   ```bash
   git add .
   git commit -m "feat(trade-flow): Phase 3 complete - tests + docs"
   git push origin feature/trade-flow-ui-redesign
   ```

2. **Create PR**:
   - Title: `TASK FLOW-08: Trade Flow UI Redesign (Whisk Design)`
   - Link to `TASK-FLOW-08-IMPLEMENTATION-COMPLETE.md`
   - Link to `TASK-FLOW-08-MANUAL-TESTING.md`
   - Request review from QA + design

3. **Run CI Checks**:
   - GitHub Actions should run Tier 0 + Tier 1
   - Verify all tests pass in CI environment

4. **Manual QA**:
   - QA team follows manual testing guide
   - Verify on staging environment
   - Check analytics events fire correctly

---

*Ready to Execute*: 2025-01-20  
*Estimated Completion*: 4-6 hours  
*Priority*: High (blocks trade flow release)
