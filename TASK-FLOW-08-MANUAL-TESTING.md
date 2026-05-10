# Manual Testing Guide: Trade Flow Screens (FLOW-08)

**Task**: FLOW-08 Trade Flow UI Redesign  
**Date**: 2025-01-20  
**Tester**: _____________  
**Environment**: Staging / Production (circle one)  

---

## Prerequisites

### Test Users Required:
- [ ] **User A**: Free tier user (no subscription)
  - Email: __________________
  - Password: __________________
  
- [ ] **User B**: Kids Club+ subscriber (active)
  - Email: __________________
  - Password: __________________
  - SP Balance: ≥100 SP

### Test Data Setup:
- [ ] 3+ listings created by User A (prices: $20, $50, $100)
- [ ] 2+ listings created by User B (prices: $30, $80)
- [ ] Users in same geographic node
- [ ] Both users have completed onboarding

### Devices/Platforms:
- [ ] iOS Simulator / Physical iPhone (iOS version: ___)
- [ ] Android Emulator / Physical Android (API level: ___)

---

## Test Case 1: Initiate Trade with SP (TradeOfferScreen)

**User**: User B (Subscriber)  
**Objective**: Verify SP input works and trade initiation succeeds

### Steps:
1. [ ] Login as User B (subscriber)
2. [ ] Navigate to Browse → Find listing by User A ($100 item)
3. [ ] Tap "Make Offer" → **TradeOfferScreen** opens
4. [ ] **Verify UI Elements**:
   - [ ] Item image, title, price displayed
   - [ ] SP input field visible (#FEF3C7 background, Coins icon)
   - [ ] SP balance shown ("You have X SP")
   - [ ] Safety disclaimer box visible (#E8F5F0 background, ShieldCheck icon)
   - [ ] "Confirm Trade" button (green pill #5DBB8E)
5. [ ] Enter **60 SP** in SP input (should exceed 50% cap)
6. [ ] **Expected**: Error message "SP cannot exceed 50% of item price"
7. [ ] Enter **50 SP** (exactly 50%)
8. [ ] **Verify**: No error, input accepted
9. [ ] Tap "Confirm Trade"
10. [ ] **Expected**: Disclaimer modal appears (if first trade)
11. [ ] Accept disclaimer (if shown)
12. [ ] **Expected**: 
    - Loading indicator
    - Navigate to **TradeTimelineScreen**
    - Status = "Pending Payment"

### Visual Checks:
- [ ] Phosphor Coins icon renders correctly
- [ ] ArrowsLeftRight divider between item cards
- [ ] Button is pill-shaped (borderRadius 26 for height 52)
- [ ] SP input has gold tint background

---

## Test Case 2: Accept Incoming Trade Offer (TradeReviewScreen)

**User**: User A (Seller)  
**Objective**: Verify trade review acceptance triggers buyer payment step

### Steps:
1. [ ] Login as User A (seller from Test Case 1)
2. [ ] Navigate to Notifications or My Trades
3. [ ] Find pending trade from User B → Tap to open
4. [ ] **TradeReviewScreen** opens
5. [ ] **Verify UI Elements**:
   - [ ] Trade summary card with ArrowsLeftRight divider
   - [ ] Buyer's item shown (left side)
   - [ ] Your item shown (right side)
   - [ ] SP amount displayed (25 SP with Coins icon)
   - [ ] Cash amount displayed ($75.00)
   - [ ] SP balance preview
   - [ ] Safety disclaimer (ShieldCheck icon, #E8F5F0 bg)
   - [ ] Green "Accept Trade" button (pill shape)
   - [ ] Red "Decline" text link
6. [ ] Tap "Accept Trade"
7. [ ] **Expected**:
    - Loading indicator
    - Navigate to **TradeTimelineScreen**
   - Status = "Processing Payment"
8. [ ] Login as User B (buyer)
9. [ ] Open the same trade in **TradeTimelineScreen**
10. [ ] **Verify**: "Make Payment" section is visible with card charge amount and payment button
11. [ ] Tap "Make Payment"
12. [ ] **Expected**:
   - Success message for payment
   - Trade status updates to **"In Progress"**

### Visual Checks:
- [ ] Phosphor icons render (ArrowsLeftRight, Coins, ShieldCheck)
- [ ] Accept button is green pill (#5DBB8E)
- [ ] Decline link is red (#E85D75)

---

## Test Case 3: File Dispute (TradeDisputeScreen)

**User**: User B (Buyer) or User A (Seller)  
**Objective**: Verify dispute filing flow

### Steps:
1. [ ] Navigate to active trade from Test Case 2
2. [ ] **TradeTimelineScreen** → Tap "Report Problem" (future: add this button)
3. [ ] **TradeDisputeScreen** opens
4. [ ] **Verify UI Elements**:
   - [ ] Red warning banner (WarningCircle icon, #FEE2E2 bg, #E85D75 text)
   - [ ] 5 reason chips displayed:
     - [ ] "Item not as described"
     - [ ] "Item not received"
     - [ ] "Safety concern"
     - [ ] "Payment issue"
     - [ ] "Other"
   - [ ] Evidence upload area (Camera icon, dashed border)
   - [ ] Description textarea (filled style #F0F0F0)
   - [ ] Character counter "0/1000"
   - [ ] Red "Submit Dispute" button (Flag icon, disabled initially)
5. [ ] Tap reason chip "Item not as described"
6. [ ] **Expected**: Chip background turns red (#E85D75)
7. [ ] Tap another reason chip
8. [ ] **Expected**: Previous chip deselects, new chip turns red
9. [ ] Enter description: "The item arrived damaged and does not match the photos."
10. [ ] **Expected**: Character counter updates "62/1000"
11. [ ] **Verify**: Submit button enabled
12. [ ] Tap "Submit Dispute"
13. [ ] **Expected**: 
    - Success alert "Dispute filed"
    - Navigate back or to TradeTimeline
    - Trade status = "Disputed"

### Visual Checks:
- [ ] Warning banner is red with WarningCircle icon
- [ ] Selected reason chip has red background
- [ ] Submit button has Flag icon and red color

---

## Test Case 4: Complete Trade (TradeTimelineScreen)

**User**: User A (Seller), then User B (Buyer)  
**Objective**: Verify trade completion flow

**Precondition**: Payment step from Test Case 2 is completed and trade status is **In Progress**.

### Steps (Seller):
1. [ ] Login as User A (seller)
2. [ ] Navigate to active trade → **TradeTimelineScreen**
3. [ ] **Verify UI Elements**:
   - [ ] Status banner (green #E8F5F0 bg, "In Progress")
   - [ ] Timeline with 4 steps (Initiated, Processing, In Progress, Completed)
   - [ ] Active step has filled green circle (#5DBB8E)
   - [ ] Payment details card
   - [ ] Message button (ChatCircle icon, gray bg #F0F0F0)
   - [ ] Green "Mark as Completed" button (CheckCircle icon, pill shape)
   - [ ] Red outlined "Cancel Trade" button (XCircle icon)
4. [ ] Tap "Mark as Completed"
5. [ ] **Expected**: Confirmation alert "Are you sure?"
6. [ ] Confirm
7. [ ] **Expected**:
    - Success message
    - Button changes to "Waiting for buyer" (disabled)

### Steps (Buyer):
8. [ ] Login as User B (buyer)
9. [ ] Navigate to same trade → **TradeTimelineScreen**
10. [ ] **Verify**:
    - [ ] Orange notice box: "Seller marked as completed" (WarningCircle icon)
11. [ ] Tap "Mark as Completed"
12. [ ] Confirm
13. [ ] **Expected**:
    - Navigate to **TradeSuccessScreen**
    - CheckCircle icon (72px, green #5DBB8E)
    - "Trade Completed!" message
    - SP earned badge (if applicable, gold bg #FEF3C7)
    - Green "View Trade" button
    - "Back to Home" link

### Visual Checks:
- [ ] Timeline circles are 32×32px
- [ ] Confirm button is green pill with CheckCircle icon
- [ ] Cancel button is red outlined with XCircle icon
- [ ] Message button has gray background
- [ ] All Phosphor icons render correctly

---

## Test Case 5: Browse Trade History (TradeListScreen)

**User**: User B (with multiple trades)  
**Objective**: Verify trade history display and filtering

### Steps:
1. [ ] Navigate to Profile → "My Trades" → **TradeListScreen**
2. [ ] **Verify UI Elements**:
   - [ ] Tab navigation (All, Buying, Selling)
   - [ ] Active tab has green underline (#5DBB8E)
   - [ ] Trade cards with 56×56px thumbnails
   - [ ] Status badges with correct colors
3. [ ] **Verify "All" tab**:
   - [ ] Shows both buying and selling trades
4. [ ] Tap "Buying" tab
5. [ ] **Expected**: Only trades where User B is buyer shown
6. [ ] Tap "Selling" tab
7. [ ] **Expected**: Only trades where User B is seller shown
8. [ ] **Verify Status Badge Colors**:
   - [ ] Pending: Amber bg (#FEF3C7), orange text (#D97706)
   - [ ] Active: Green bg (#E8F5F0), green text (#5DBB8E)
   - [ ] Completed: Gray bg (#F0F0F0), gray text (#6B6B6B)
   - [ ] Cancelled: Red bg (#FEE2E2), red text (#E85D75)
9. [ ] Tap any trade card
10. [ ] **Expected**: Navigate to **TradeTimelineScreen**

### Visual Checks:
- [ ] Tab underline is green (#5DBB8E)
- [ ] Thumbnails are 56×56px
- [ ] CaretLeft icon for back button
- [ ] Receipt icon in empty state

---

## Test Case 6: Result Screens (TradeSuccessScreen)

**User**: Any  
**Objective**: Verify success and failure states

### Success State:
1. [ ] Complete a trade successfully (Test Case 4)
2. [ ] **TradeSuccessScreen** opens automatically
3. [ ] **Verify UI**:
   - [ ] CheckCircle icon (72px, green #5DBB8E)
   - [ ] "Trade Completed!" heading
   - [ ] SP earned badge (if SP used, gold #FEF3C7 bg, Coins icon)
   - [ ] Trade ID shown
   - [ ] Green pill "View Trade" button
   - [ ] "Back to Home" text link
4. [ ] Tap "View Trade"
5. [ ] **Expected**: Navigate to **TradeTimelineScreen**

### Failure State:
6. [ ] Initiate trade with insufficient funds
7. [ ] **Expected**: **TradeSuccessScreen** with failure state
8. [ ] **Verify UI**:
   - [ ] XCircle icon (72px, red #E85D75)
   - [ ] Error message displayed
   - [ ] Red pill "Try Again" button
   - [ ] "Back to Home" link
9. [ ] Tap "Try Again"
10. [ ] **Expected**: Navigate back to previous screen

### Visual Checks:
- [ ] Icons are 72px
- [ ] Success icon is green, failure icon is red
- [ ] Buttons are pill-shaped
- [ ] SP badge has gold styling

---

## Test Case 7: Cancel Trade with Reason

**User**: User B (Buyer)  
**Objective**: Verify cancellation flow with reason selection

### Steps:
1. [ ] Navigate to active trade → **TradeTimelineScreen**
2. [ ] Tap "Cancel Trade" (red outlined button)
3. [ ] **Expected**: Cancellation reason modal opens
4. [ ] **Verify Modal UI**:
   - [ ] List of cancellation reasons
   - [ ] Text input for "Other" reason
   - [ ] "Cancel" and "Confirm" buttons
5. [ ] Select reason: "Changed my mind"
6. [ ] Tap "Confirm"
7. [ ] **Expected**:
    - Success alert "Trade cancelled"
    - SP refunded to wallet
    - Navigate back or status updates to "Cancelled"

---

## Design System Compliance Checklist

### Colors:
- [ ] Primary green #5DBB8E used for confirm buttons, active states
- [ ] SP gold #F59E0B for SP badges/inputs
- [ ] Error red #E85D75 for cancel/dispute actions
- [ ] White #FFFFFF background
- [ ] Card backgrounds #F7F7F7

### Status Colors:
- [ ] Pending: #FEF3C7 background, #D97706 text
- [ ] Active: #E8F5F0 background, #059669 text
- [ ] Completed: #F0FDF4 background, #16A34A text
- [ ] Cancelled/Failed: #FEE2E2 background, #DC2626 text

### Typography & Spacing:
- [ ] All inputs have filled style (#F0F0F0, no borders)
- [ ] Buttons are pill-shaped (borderRadius = height/2)
- [ ] Icons are Phosphor (no Ionicons visible)
- [ ] Consistent 16px padding
- [ ] 12px border radius on cards

### Icons Used:
- [ ] ArrowsLeftRight (trade divider)
- [ ] Coins (SP indicators)
- [ ] ShieldCheck (safety disclaimers)
- [ ] CheckCircle (success states)
- [ ] XCircle (failure/cancel states)
- [ ] Clock (pending status)
- [ ] ChatCircle (message button)
- [ ] WarningCircle (warnings/notices)
- [ ] Star (reviews)
- [ ] CaretLeft (back navigation)
- [ ] Receipt (empty state)
- [ ] Flag (dispute submission)
- [ ] Camera (evidence upload)

---

## Regression Checks

### Existing Functionality:
- [ ] Trade initiation still works with cash-only (free users)
- [ ] SP wallet balance updates correctly
- [ ] Notifications sent for trade events
- [ ] Real-time updates work (status changes)
- [ ] Navigation stack preserved (back button works)

### Edge Cases:
- [ ] SP input accepts only numbers
- [ ] Trade with 0 SP works (cash-only)
- [ ] Cancelled trades show cancellation reason
- [ ] Completed trades allow reviews
- [ ] Disputed trades disable complete/cancel buttons

---

## Bug Report Template

If you find issues, document them here:

### Bug #1:
- **Screen**: _____________
- **Steps to Reproduce**: 
  1. 
  2. 
  3. 
- **Expected**: _____________
- **Actual**: _____________
- **Screenshot**: (attach)

---

## Sign-off

- [ ] All 7 test cases passed
- [ ] Design system compliance verified
- [ ] Regression checks passed
- [ ] No critical bugs found

**Tester Name**: ____________________  
**Date**: ____________________  
**Signature**: ____________________

---

**Notes/Comments**:
