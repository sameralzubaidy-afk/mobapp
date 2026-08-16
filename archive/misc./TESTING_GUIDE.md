# Trade Cancellation - Testing Guide

## Overview
This guide provides comprehensive testing procedures for the trade cancellation feature with reason capture and improved error handling.

---

## Setup & Prerequisites

### 1. Ensure Backend RPC is Running
The `cancel_trade_v2` RPC function must exist in your Supabase database:

```sql
-- Verify the RPC function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%cancel_trade%';

-- Should return: cancel_trade_v2 | FUNCTION
```

### 2. Verify Database Schema
Check that the trades table has the cancellation columns:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'trades' 
AND column_name IN ('cancellation_reason', 'cancelled_at', 'status');
```

Expected columns:
- `status`: CHARACTER VARYING (contains 'cancelled')
- `cancellation_reason`: TEXT (nullable)
- `cancelled_at`: TIMESTAMP (nullable)

### 3. Create Test Trade
Create a trade record in 'pending' status for testing:

```sql
INSERT INTO trades (
  listing_id,
  buyer_id,
  seller_id,
  status,
  sp_amount,
  cash_amount_cents,
  platform_fee_cents,
  cash_currency,
  created_at,
  updated_at
) VALUES (
  'test-item-id-here',
  'test-buyer-id-here',
  'test-seller-id-here',
  'pending',
  0,
  5000,
  299,
  'usd',
  NOW(),
  NOW()
)
RETURNING id;
```

Save the returned trade ID for testing.

---

## Unit Tests

### Test 1: Successful Cancellation with Reason

```typescript
import { cancelTradeV2 } from '../services/trade';

describe('cancelTradeV2', () => {
  it('should successfully cancel a trade with reason', async () => {
    const tradeId = 'test-trade-id-pending';
    const reason = 'Found elsewhere';

    const result = await cancelTradeV2(tradeId, reason);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should successfully cancel a trade without reason', async () => {
    const tradeId = 'test-trade-id-pending';

    const result = await cancelTradeV2(tradeId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
```

### Test 2: Error Cases

```typescript
describe('cancelTradeV2 - Error Handling', () => {
  it('should return error for non-existent trade', async () => {
    const result = await cancelTradeV2('non-existent-id', 'Test reason');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Trade not found');
  });

  it('should return error for unauthorized user', async () => {
    // Call with trade owned by different user
    const result = await cancelTradeV2('other-user-trade-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission');
  });

  it('should return error when unauthenticated', async () => {
    // Mock logged-out state
    await supabase.auth.signOut();

    const result = await cancelTradeV2('test-trade-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not authenticated');
  });
});
```

---

## Integration Tests

### Test 1: Modal Interaction

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CancellationReasonModal } from '../components/molecules/CancellationReasonModal';

describe('CancellationReasonModal', () => {
  it('should render with all predefined reasons', () => {
    const { getByText } = render(
      <CancellationReasonModal
        visible={true}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(getByText('Found elsewhere')).toBeTruthy();
    expect(getByText('Changed mind')).toBeTruthy();
    expect(getByText('Buyer unresponsive')).toBeTruthy();
    expect(getByText('Item damaged/incorrect')).toBeTruthy();
    expect(getByText('Other reason')).toBeTruthy();
  });

  it('should call onConfirm with selected reason', () => {
    const mockConfirm = jest.fn();
    const { getByText } = render(
      <CancellationReasonModal
        visible={true}
        onConfirm={mockConfirm}
        onCancel={jest.fn()}
      />
    );

    fireEvent.press(getByText('Found elsewhere'));
    fireEvent.press(getByText('Cancel Trade'));

    expect(mockConfirm).toHaveBeenCalledWith('Found elsewhere');
  });

  it('should validate custom reason is entered before confirming', () => {
    const mockConfirm = jest.fn();
    const { getByText, queryByText } = render(
      <CancellationReasonModal
        visible={true}
        onConfirm={mockConfirm}
        onCancel={jest.fn()}
      />
    );

    fireEvent.press(getByText('Other reason'));

    // Cancel Trade button should be disabled without text
    const confirmButton = queryByText('Cancel Trade');
    expect(confirmButton?.props.disabled).toBe(true);
  });

  it('should enable confirm when custom reason is provided', () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <CancellationReasonModal
        visible={true}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    fireEvent.press(getByText('Other reason'));

    const input = getByPlaceholderText(
      "Please describe why you're cancelling..."
    );
    fireEvent.changeText(input, 'Custom cancellation reason');

    const confirmButton = queryByText('Cancel Trade');
    expect(confirmButton?.props.disabled).toBe(false);
  });
});
```

---

## Manual Testing Scenarios

### Scenario 1: Happy Path - Cancel with Predefined Reason

**Steps:**
1. Open app and navigate to a trade in "pending" status
2. Tap "Cancel Trade" button
3. Modal appears showing "Why are you cancelling?"
4. Select "Found elsewhere"
5. Tap "Cancel Trade" button
6. Wait for success message

**Expected Results:**
- ✅ Modal appears with all 5 predefined reasons
- ✅ Selected reason is highlighted
- ✅ Success alert shows
- ✅ Trade detail updates showing cancelled status
- ✅ Reason visible in database

**Database Verification:**
```sql
SELECT id, status, cancellation_reason, cancelled_at 
FROM trades 
WHERE id = 'test-trade-id'
AND status = 'cancelled';

-- Should show:
-- id: test-trade-id
-- status: cancelled
-- cancellation_reason: Found elsewhere
-- cancelled_at: (current timestamp)
```

### Scenario 2: Custom Reason Entry

**Steps:**
1. Open trade and tap "Cancel Trade"
2. Select "Other reason"
3. Type custom message: "Seller won't respond to messages"
4. Tap "Cancel Trade"
5. Verify success

**Expected Results:**
- ✅ Text input appears when "Other reason" is selected
- ✅ Character counter shows (current/500)
- ✅ Confirm button disabled until text is entered
- ✅ Custom text sent to API
- ✅ Custom reason stored in database

**Database Verification:**
```sql
SELECT cancellation_reason FROM trades 
WHERE status = 'cancelled' 
ORDER BY cancelled_at DESC LIMIT 1;

-- Should show: Seller won't respond to messages
```

### Scenario 3: Modal Cancellation

**Steps:**
1. Open trade and tap "Cancel Trade"
2. Select a reason
3. Tap "Keep Trade" button
4. Modal closes without cancelling

**Expected Results:**
- ✅ Modal closes
- ✅ Trade remains in original status
- ✅ No API call made
- ✅ No database changes

### Scenario 4: SP Refund on In-Progress Trade

**Steps:**
1. Create a trade with SP applied (e.g., 100 SP used)
2. Complete payment (trade moves to 'in_progress')
3. Tap cancel and select reason
4. Verify SP is refunded

**Expected Results:**
- ✅ Trade cancelled successfully
- ✅ SP ledger shows refund entry
- ✅ User's available SP increased by refunded amount
- ✅ Cancellation reason logged

**Database Verification:**
```sql
-- Check SP ledger for refund
SELECT user_id, points_before, points_after, amount, reason 
FROM sp_ledger 
WHERE reason LIKE '%cancel%' OR reason LIKE '%refund%'
ORDER BY created_at DESC LIMIT 1;

-- Check trades table
SELECT sp_amount, sp_refunded FROM trades 
WHERE id = 'test-trade-id' AND status = 'cancelled';
```

### Scenario 5: Error - Trade Not Found

**Steps:**
1. Manually delete the trade from database
2. Try to cancel it through UI with fake ID
3. Observe error handling

**Expected Results:**
- ✅ Error message appears: "Trade not found..."
- ✅ Clear, user-friendly error message
- ✅ No app crash
- ✅ User can retry

### Scenario 6: Error - Unauthorized User

**Steps:**
1. Get a trade ID from another user
2. Log in as different user
3. Try to cancel that trade
4. Observe error

**Expected Results:**
- ✅ Error message appears: "You do not have permission..."
- ✅ Trade not modified
- ✅ Clear feedback

### Scenario 7: Network Timeout

**Steps:**
1. Slow down network (Chrome DevTools or similar)
2. Attempt cancellation
3. Observe error handling

**Expected Results:**
- ✅ Timeout error message appears: "The request timed out..."
- ✅ User can retry
- ✅ No partial state changes

### Scenario 8: Loading State

**Steps:**
1. Open cancellation modal
2. Select reason and tap confirm
3. Observe UI during request

**Expected Results:**
- ✅ Button changes to "Cancelling..." text
- ✅ Button disabled during request
- ✅ Modal cannot be dismissed during request
- ✅ Loading state clears on success or error

---

## Performance Tests

### Test 1: Modal Performance

```typescript
// Measure modal render time
console.time('modal-render');
render(<CancellationReasonModal visible={true} />);
console.timeEnd('modal-render');
// Should be < 100ms
```

### Test 2: API Response Time

```typescript
const startTime = Date.now();
const result = await cancelTradeV2(tradeId, 'Test reason');
const duration = Date.now() - startTime;
console.log(`Cancellation took ${duration}ms`);
// Should be < 3000ms
```

### Test 3: Large Character Input

```typescript
// Test with 500 character reason
const longReason = 'A'.repeat(500);
const result = await cancelTradeV2(tradeId, longReason);
expect(result.success).toBe(true);
```

---

## Logging Verification

Check the console logs for proper error handling:

### Expected Success Logs:
```
[trade-service] Attempting to cancel trade: {
  tradeId: "...",
  userId: "...",
  reason: "Found elsewhere"
}

[trade-service] Trade cancelled successfully: {
  tradeId: "...",
  status: "cancelled",
  spRefunded: 0,
  reason: "Found elsewhere"
}
```

### Expected Error Logs:
```
[trade-service] cancelTradeV2 RPC error: {
  code: "...",
  message: "...",
  details: "...",
  hint: "..."
}
```

---

## Browser Testing (if applicable)

### Chrome DevTools Network Tab:
1. Open DevTools → Network tab
2. Filter for supabase/functions API calls
3. Perform cancellation
4. Verify request payload includes `p_reason` parameter
5. Verify response includes `success: true`

### Console Verification:
1. Open DevTools → Console tab
2. Look for `[trade-service]` logs
3. Verify all logging statements appear
4. Check for any console errors

---

## Accessibility Testing

- [ ] Tab through modal options
- [ ] Voice control works for buttons
- [ ] Screen reader announces options correctly
- [ ] High contrast mode is readable
- [ ] Text size adjustments work

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests pass (unit, integration, manual)
- [ ] Error handling tested with various error scenarios
- [ ] Modal UI is polished and responsive
- [ ] Loading states work correctly
- [ ] Database backups taken
- [ ] RPC function verified in production database
- [ ] Analytics/logging configured
- [ ] User documentation updated
- [ ] Beta users tested (if applicable)
- [ ] Mobile-specific testing completed (iOS & Android)

---

## Rollback Plan

If issues occur in production:

1. **Modal UI Issues**: Revert `CancellationReasonModal.tsx` changes
2. **Service Error Handling**: Revert `trade.ts` function changes
3. **Database Issues**: Verify RPC function integrity
4. **Data Loss**: Restore from backup if necessary

---

## Monitoring in Production

### Key Metrics to Track:
- [ ] Cancellation success rate (target: >95%)
- [ ] Error rate by type
- [ ] Average response time (target: <2s)
- [ ] User abandonment rate (incomplete cancellations)
- [ ] Most common cancellation reasons

### Log Aggregation:
Set up alerts for:
- `[trade-service] cancelTradeV2 failed`
- `[trade-service] RPC error`
- Any errors with status codes 4xx or 5xx

---

## Support Notes

Common issues and solutions:

### Issue: "Trade not found"
- **Cause**: Trade was already cancelled or deleted
- **Solution**: Refresh trade list, verify trade ID is correct

### Issue: "Permission denied"
- **Cause**: Logged in as wrong user
- **Solution**: Verify correct user is logged in

### Issue: Modal not appearing
- **Cause**: Component not properly imported
- **Solution**: Verify import path matches file location

### Issue: Reason not saving
- **Cause**: Database constraint or RPC error
- **Solution**: Check database logs, verify RPC function
