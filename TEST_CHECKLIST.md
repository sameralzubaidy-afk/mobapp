# Trade Cancellation with Reason - Testing Checklist

## Pre-Test Setup

### 1. Ensure TypeScript Compiles
```bash
cd p2p-kids-marketplace
yarn typecheck
```
Expected output: `✓ No TypeScript errors`

### 2. Ensure No Lint Errors
```bash
yarn lint
```
Expected output: `✓ No linting errors`

## Manual Testing Flow

### Step 1: Start Your App
```bash
cd p2p-kids-marketplace
npx expo start
# or
yarn start
```
Then open in iOS Simulator (press `i`) or Android Emulator (press `a`)

### Step 2: Login with Test User
- Email: `test@example.com` (or your test user email)
- Password: Your test password
- Should see your dashboard/home screen

### Step 3: Navigate to Active Trades
- Tap "My Trades" or "Activity" section
- You should see a list of pending/in-progress trades
- If no trades exist, you need to create one first:
  - List an item for sale
  - Have another test account purchase it
  - Trade will be in "pending" status

### Step 4: Open a Pending Trade
- Tap on any trade in "pending" or "in_progress" status
- Should see trade details with "Cancel Trade" button at bottom

### Step 5: Test Cancel Button - Open Modal
- **Action**: Tap "Cancel Trade" button
- **Expected**: A modal appears from bottom with:
  - Title: "Why are you cancelling?"
  - Subtitle: The item name/title
  - 5 radio button options:
    - ○ Found elsewhere
    - ○ Changed mind
    - ○ Buyer unresponsive
    - ○ Item damaged/incorrect
    - ○ Other reason

### Step 6: Test Predefined Reason Selection
- **Action**: Tap "Found elsewhere" radio button
- **Expected**:
  - Radio button becomes selected (filled circle)
  - No text input appears
  - "Confirm" button becomes enabled

### Step 7: Test "Other" Option with Custom Text
- **Action**: Tap "Other reason" radio button
- **Expected**:
  - "Other reason" becomes selected
  - A text input field appears below with placeholder "Enter your reason here..."
  - Character counter shows: "0/500"

- **Action**: Type in the text input: "Item is too expensive"
- **Expected**:
  - Text appears in input
  - Counter updates: "26/500"
  - "Confirm" button remains enabled

### Step 8: Test Character Limit (Optional)
- **Action**: Paste very long text (>500 chars)
- **Expected**:
  - Input stops accepting text at 500 characters
  - Counter shows "500/500"

### Step 9: Submit Cancellation
- **Action**: Make sure a reason is selected, then tap "Confirm" button
- **Expected**:
  - Modal shows loading spinner
  - All interactive elements become disabled
  - API call is being made

### Step 10: Verify Success Response
- **Expected After 2-3 seconds**:
  - Modal closes
  - Alert appears: "Trade Cancelled"
  - Message: "Your trade has been cancelled. Any Swap Points have been refunded to your wallet."
  - Button: "OK"
  
- **Action**: Tap "OK"
- **Expected**:
  - Alert closes
  - You're navigated back to trade list or home screen
  - If you go back to that trade, status should show "CANCELLED"

### Step 11: Verify Database Entry
- **Action**: Open Supabase dashboard
- **Navigate to**: Your project → SQL Editor
- **Run this query**:
```sql
SELECT 
  id,
  status,
  cancellation_reason,
  cancelled_at
FROM trades
WHERE status = 'cancelled'
ORDER BY cancelled_at DESC
LIMIT 5;
```

- **Expected**:
  - Your cancelled trade appears in results
  - `cancellation_reason` column contains your selected reason
  - `cancelled_at` has a timestamp
  - `status` is 'cancelled'

## Error Handling Tests

### Test Case: Try Cancelling Already Cancelled Trade
1. Cancel a trade (steps 1-10 above)
2. Immediately tap "Cancel Trade" again
3. **Expected**: Error alert: "Trade not found. It may have already been cancelled or expired."

### Test Case: Network Timeout (Optional)
1. Turn off WiFi/mobile data
2. Start cancellation
3. **Expected**: Timeout error after 10-30 seconds: "Request timed out. Check your connection..."

### Test Case: Cancel, Then Retry
1. Try to cancel a trade
2. Get an error
3. **Action**: Tap "Try Again" in error alert
4. **Expected**: Modal reopens with your previous reason still selected
5. **Action**: Tap "Confirm" again
6. **Expected**: Should succeed on retry

## Regression Tests (Make Sure Nothing Broke)

### Test: Complete Trade Still Works
1. Navigate to an "in_progress" trade
2. Tap "Mark as Completed"
3. **Expected**: Success - trade status changes to "completed"

### Test: Other Trade Screens Still Load
1. Go to "My Trades" / active trades list
2. **Expected**: List loads normally, no crashes

### Test: Navigation Back Works
1. Open a trade detail
2. Tap back arrow
3. **Expected**: Navigate back to list without errors

## Debugging if Something Goes Wrong

### Modal Doesn't Appear
- Check: Is the "Cancel Trade" button being tapped?
- Check: Are `showCancellationModal` state and `setShowCancellationModal` properly set?
- Check TypeScript: `yarn typecheck` for type errors
- Check imports in TradeDetailScreen: Is `CancellationReasonModal` imported correctly?

### Modal Appears but Buttons Don't Work
- Check: Is `onConfirm` callback properly connected?
- Check: Are event handlers being triggered? (Check React DevTools or add `console.log`)
- Check: Is `isLoading` prop being passed correctly?

### Cancellation Fails with Error
- Check the error message:
  - "Trade not found..." → Trade may be in wrong status
  - "Permission denied..." → Check you're logged in as the trade buyer
  - "Timeout..." → Check internet connection
  - Generic "Failed..." → Check app console for more details (`yarn start` logs)

### Database Doesn't Show Reason
- Check: Did cancellation succeed? (You should see success alert)
- Check: Is the `cancellation_reason` column in the `trades` table? (It should be)
- Check: Did you query the right database? (staging vs production)
- Check: Run this to see all cancelled trades:
  ```sql
  SELECT * FROM trades WHERE status = 'cancelled' LIMIT 20;
  ```

## Performance Checklist

- [ ] Modal opens instantly (no lag)
- [ ] Typing in text input is smooth (no jank)
- [ ] Submission doesn't hang for >3 seconds
- [ ] No duplicate cancellations even if confirm tapped twice
- [ ] No memory leaks (app doesn't get slower after multiple cancellations)

## Final Sign-Off

When all tests pass, fill out:

```
Date Tested: _______________
Tester: _______________
Device: iOS Simulator / Android Emulator
Environment: staging / production

✓ Modal opens and closes properly
✓ All 5 reasons selectable
✓ Custom text input works
✓ Cancellation succeeds
✓ Database has reason logged
✓ No TypeScript errors
✓ No crashes during flow

Approved for GitHub sync: [ ] YES  [ ] NO
```

---

If you encounter any issues, check the console logs with:
- iOS: Xcode console or `expo start` terminal
- Android: `adb logcat | grep RN`
