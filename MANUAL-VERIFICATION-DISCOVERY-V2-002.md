# Manual Verification Guide: MODULE-05-DISCOVERY-V2-002
## Subscriber-Personalized Recommendations

**Date Created**: December 21, 2025  
**Module**: MODULE-05-DISCOVERY-V2  
**Task**: DISCOVERY-V2-002 - Subscriber-Personalized Recommendations  
**Status**: Ready for Manual Testing

---

## 📍 WHERE TO FIND THE RECOMMENDATIONS

### Location in App
**Screen**: Home Feed Screen (after login)  
**Position**: Top section of the screen, ABOVE the action buttons ("Browse", "List Item", etc.)  
**Component Name**: `RecommendationsCarousel`

### File Reference
- Screen File: `p2p-kids-marketplace/src/screens/home/HomeFeedScreen.tsx`
- Component File: `p2p-kids-marketplace/src/components/organisms/RecommendationsCarousel/index.tsx`

---

## 🧪 MANUAL VERIFICATION STEPS

### PHASE 1: APP SETUP (One-time)

#### Step 1.1: Start the Expo Development Server
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
yarn ios
```

**Expected Result**:
- iOS Simulator opens
- Expo app loads
- You see the Welcome/Login screen

**Troubleshooting**:
- If simulator doesn't open: `xcrun simctl erase all` then restart
- If Expo freezes: Press `i` in terminal to rebuild

---

#### Step 1.2: Confirm SQL Migration Was Applied
Before testing in the app, verify the RPC function exists in Supabase:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your Kids P2P Marketplace project
3. Navigate to: **SQL Editor**
4. Run this verification query:

```sql
-- Verify get_recommendations RPC exists
SELECT 
  proname, 
  proargnames, 
  prosrc 
FROM pg_proc 
WHERE proname = 'get_recommendations'
LIMIT 1;
```

**Expected Result**:
```
proname          | get_recommendations
proargnames      | {p_user_id, p_limit}
prosrc           | (long function body showing scoring logic)
```

**If Not Found**:
- Run the migration manually in SQL Editor:
  - Open `/Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20251220000003_get_recommendations_rpc.sql`
  - Copy entire content
  - Paste into Supabase SQL Editor
  - Click "Run"
  - Confirm you see "Success"

---

### PHASE 2: TEST WITH SUBSCRIBER ACCOUNT (SP Balance)

#### Step 2.1: Login as Subscriber
In the iOS Simulator:

1. **Tap "Login"** on Welcome screen
2. **Email**: Use your test subscriber account
   - Example: `subscriber@test.com`
3. **Password**: Enter your test password
4. **Tap "Sign In"**

**Expected Result**:
- Login succeeds
- You're redirected to Home Feed screen
- You see "Recommendations" carousel at the TOP

---

#### Step 2.2: Verify RecommendationsCarousel Appears
On the Home Feed screen:

**What You Should See** (from top to bottom):
```
┌─────────────────────────────────────┐
│  RECOMMENDATIONS                    │ ← Title at top
│ ┌──────┐  ┌──────┐  ┌──────┐       │
│ │ Item │  │ Item │  │ Item │ ...   │ ← Horizontal scroll cards
│ │ Photo│  │ Photo│  │ Photo│       │
│ │ $15  │  │ $20  │  │ $25  │       │
│ │✓ SP  │  │      │  │✓ SP  │       │ ← SP Eligible badge
│ │Elig. │  │      │  │Elig. │       │
│ └──────┘  └──────┘  └──────┘       │
└─────────────────────────────────────┘
              ↓ (scroll down)
  Browse | List Item | Profile
  (existing buttons)
```

**Verification Checklist for Step 2.2**:
- [ ] Carousel title says "Recommendations"
- [ ] Cards are displayed horizontally (can swipe/scroll left-right)
- [ ] Each card shows: Item photo, title, price
- [ ] Some cards show "✓ SP Eligible" badge (green/blue badge)
- [ ] Carousel loads in < 2 seconds
- [ ] No error message visible

**If Carousel Doesn't Appear**:
- Check if you can scroll down (it might be above the fold)
- Check mobile simulator: Device > Rotate Left/Right (verify layout)
- Check console in terminal for errors
- If 404 error: SQL migration wasn't applied (go back to Step 1.2)

---

#### Step 2.3: Verify SP-Eligible Prioritization
As a subscriber, SP-eligible items should appear FIRST:

1. **Look at the first 3-5 cards** in the carousel
2. **Count SP-eligible items**: How many have the "✓ SP Eligible" badge?
3. **Expected**: Subscriber accounts should see MORE SP-eligible items (and higher score)

**Verification Checklist for Step 2.3**:
- [ ] First card has "✓ SP Eligible" badge
- [ ] Second card has "✓ SP Eligible" badge
- [ ] SP items are prioritized (appear before cash-only items)
- [ ] Cash-only items appear at the end

**Scoring Logic Behind the Scenes** (for reference):
- SP-Eligible Item for Subscriber: Score = 110 (100 + 10)
- Cash-Only Item: Score = 10 (base only)
- Free User on SP Item: Score = 10 (no SP bonus)

---

#### Step 2.4: Tap on a Recommendation Card
1. **Find any recommendation card** (with or without SP badge)
2. **Tap the card** (anywhere on the item photo/title/price)

**Expected Result**:
- Screen transitions to **Item Details** page
- You see full item description, price, seller info, etc.
- No errors or crashes

**Verification Checklist for Step 2.4**:
- [ ] Item Details screen loads
- [ ] Item title matches the card
- [ ] Item price matches the card
- [ ] "Accept Offers" or "Purchase" button visible
- [ ] Can tap back to return to Home Feed

---

#### Step 2.5: Check Carousel Refresh (Session Change)
1. **Go back to Home Feed** (swipe back or tap back button)
2. **Wait 2-3 seconds**
3. **Scroll the carousel left and right**

**Expected Result**:
- Recommendations carousel still visible
- Can scroll through items smoothly
- No duplicate cards

**Verification Checklist for Step 2.5**:
- [ ] Carousel refreshes when returning to Home Feed
- [ ] Smooth horizontal scrolling
- [ ] No duplicate items in the carousel

---

### PHASE 3: TEST WITH FREE ACCOUNT (No SP Balance)

#### Step 3.1: Logout and Login as Free User
In the Home Feed screen:

1. **Tap "Profile"** button
2. **Scroll down** to find "Sign Out" or "Logout"
3. **Tap "Sign Out"**
4. **You're back to Login screen**

---

#### Step 3.2: Login as Free User
1. **Tap "Login"**
2. **Email**: Use your test free account
   - Example: `free@test.com`
3. **Password**: Enter password
4. **Tap "Sign In"**

**Expected Result**:
- Login succeeds
- Home Feed appears
- Recommendations carousel visible

---

#### Step 3.3: Verify Free Users See Different Recommendations
As a free user, SP-Eligible badge should NOT appear:

1. **Look at the recommendation cards**
2. **Check for "✓ SP Eligible" badges**

**Expected Result**:
- **NO "SP Eligible" badges visible** on any cards
- Cards show: Item photo, title, price only
- Same items as subscriber, but different order
- Free users see all items with same base score (=10)

**Why Different?**:
- Subscribers score SP items at 110
- Free users score all items at 10 (equal)
- So recommendations are different (randomized within same score)

**Verification Checklist for Step 3.3**:
- [ ] No "✓ SP Eligible" badges visible
- [ ] Carousel still appears
- [ ] Different item order than subscriber view
- [ ] Cards are clickable

---

### PHASE 4: ERROR & EDGE CASES

#### Step 4.1: Test Error State (Simulate RPC Failure)
To trigger an error manually:

1. **Go to Profile**
2. **Open Developer Console** (Command + D on iOS Simulator)
3. **Go to Network** tab
4. **Return to Home Feed**
5. **Watch for the error state**

**Expected Result**:
- If RPC fails: Error message appears with "Retry" button
- Message: "Failed to load recommendations"
- Button: Tappable "Retry" button
- No app crash

**Verification Checklist for Step 4.1**:
- [ ] Error message is user-friendly
- [ ] Retry button appears
- [ ] App doesn't crash
- [ ] Can still use other features

**Note**: If you don't see error state, the RPC is working correctly ✓

---

#### Step 4.2: Test Empty State
If there are no items in the database:

**Expected Result**:
- Empty state message: "No recommendations available"
- Message is centered and readable
- No error icon or crash

**Verification Checklist for Step 4.2**:
- [ ] Empty state message displays correctly
- [ ] Message is helpful/friendly
- [ ] No errors in console

---

#### Step 4.3: Test Loading State
Watch the carousel load when screen first appears:

**Expected Result**:
- Briefly see loading spinner/skeleton
- Carousel appears after 1-2 seconds
- Spinner disappears

**Verification Checklist for Step 4.3**:
- [ ] Loading indicator visible briefly
- [ ] Carousel replaces loading state
- [ ] Load time < 3 seconds

---

### PHASE 5: PERFORMANCE & STYLING

#### Step 5.1: Test Carousel Scrolling Performance
1. **Scroll left and right rapidly** through cards
2. **Swipe multiple times**

**Expected Result**:
- Smooth scrolling (60 FPS)
- No lag or jank
- Cards load instantly

**Verification Checklist for Step 5.1**:
- [ ] Scrolling is smooth
- [ ] No stuttering
- [ ] Images load quickly
- [ ] No memory leaks (simulator stays responsive)

---

#### Step 5.2: Test Responsive Layout
1. **Rotate device**: Cmd + ← or Cmd + →
2. **Check portrait and landscape**

**Expected Result**:
- Carousel adapts to new orientation
- Cards are properly sized in both modes
- Text is readable in both modes
- No overlapping elements

**Verification Checklist for Step 5.2**:
- [ ] Portrait mode: Carousel looks good
- [ ] Landscape mode: Carousel looks good
- [ ] No layout breaking
- [ ] Proper spacing maintained

---

#### Step 5.3: Visual Check
1. **Look at the overall design** of the carousel cards

**Expected Result** (Visual Checklist):
- [ ] Card background is clean (white or light gray)
- [ ] Item images load and display properly
- [ ] Title text is readable (not cut off)
- [ ] Price is clearly visible
- [ ] SP badge (when visible) stands out
- [ ] Cards have proper spacing between them
- [ ] Border/shadow on cards looks professional
- [ ] Consistent with app design language

---

## 📊 SCORING VERIFICATION (Advanced)

### For Testing Developers

If you want to verify the scoring logic is working correctly in the RPC:

#### Option A: Check RPC Scores Directly
In Supabase SQL Editor:

```sql
-- Test with your subscriber user ID
SELECT 
  id,
  title,
  price,
  accepts_swap_points,
  score
FROM get_recommendations('YOUR_SUBSCRIBER_USER_ID'::UUID, 20)
ORDER BY score DESC;
```

**Expected Score Patterns** (Subscriber with SP balance):
- SP-Eligible Items: Score = 110
- Cash-Only Items: Score = 10
- Items within SP Balance: Score = 110 (same as other SP items)

**Expected Score Patterns** (Free User):
- All items: Score = 10 (equal, so order is random)

---

#### Option B: Dev Mode Score Display
The RecommendationsCarousel component has a dev mode that shows scores:

1. Go to `src/components/organisms/RecommendationsCarousel/index.tsx`
2. Look for line: `const DEV_MODE = false;`
3. Change to: `const DEV_MODE = true;`
4. Reload the app

**Result**:
- Each card shows its score in the bottom-right corner
- Example: "Score: 110"

Then revert it back when done.

---

## ✅ FINAL VERIFICATION CHECKLIST

### Must-Pass Criteria
- [ ] Recommendations carousel appears on Home Feed
- [ ] Carousel loads in < 3 seconds
- [ ] Subscriber accounts see SP-eligible items prioritized
- [ ] Free accounts see items without SP bonus
- [ ] Can tap cards to view item details
- [ ] No app crashes
- [ ] Smooth scrolling
- [ ] Error state shows gracefully if RPC fails
- [ ] Empty state displays if no items available

### Nice-to-Have
- [ ] Loading state is smooth
- [ ] Responsive in landscape
- [ ] Visual design matches app theme
- [ ] No console errors

---

## 🐛 TROUBLESHOOTING

### Problem: Carousel Doesn't Appear at All

**Check List**:
1. ✓ Are you logged in? (Not on Login screen)
2. ✓ Are you on Home Feed? (Not Profile/Browse/etc.)
3. ✓ Scroll to top of screen (maybe it's below the fold)
4. ✓ Did you add items to the database? (Carousel is empty = needs items)
5. ✓ Did you run the SQL migration? (Check Step 1.2)

**Test Command**:
```bash
# In Supabase SQL Editor
SELECT COUNT(*) FROM items WHERE status = 'available' AND seller_id != 'YOUR_USER_ID';
```
Should return > 0

---

### Problem: Carousel Shows but Cards are Blank

**Causes**:
- Images not loading (storage bucket issues)
- Item data missing from database
- RPC returning null values

**Fix**:
1. Check if items table has data: `SELECT COUNT(*) FROM items;`
2. Check if items have titles/prices: `SELECT id, title, price FROM items LIMIT 5;`
3. Check network tab for failed image requests

---

### Problem: Error Message: "Failed to load recommendations"

**Causes**:
1. RPC function doesn't exist (migration not run)
2. Database connection issue
3. RLS policy blocking access

**Fix**:
1. Verify RPC exists (Step 1.2 verification query)
2. Check Supabase status: https://status.supabase.com
3. Check RLS policies on `items` table in Supabase

---

### Problem: Tap on Card But Nothing Happens

**Causes**:
- Navigation not configured
- Navigation params incorrect
- useNavigation hook not working

**Check**:
- Open Developer Console (Cmd+D)
- Look for navigation errors
- Check if other screens navigate properly

---

## 📱 TEST ACCOUNTS

Use these test accounts (or create new ones):

### Subscriber Test Account
- Email: `subscriber+test@example.com`
- Password: `TestPassword123!`
- Status: Kids Club+ subscription
- Expected SP Balance: 100+ points

### Free Test Account
- Email: `free+test@example.com`
- Password: `TestPassword123!`
- Status: Free tier (no subscription)
- Expected SP Balance: 0

---

## 📝 TEST RESULTS TEMPLATE

When you finish testing, document results below:

```markdown
### Test Session: [DATE]
**Tester**: [YOUR NAME]
**Device**: iPhone 15 / iPhone 14 Pro Max
**Simulator Version**: iOS 18.x

#### Phase 1 - Setup
- SQL Migration Applied: ✓ YES / ✗ NO
- RPC Function Verified: ✓ YES / ✗ NO

#### Phase 2 - Subscriber Tests
- Carousel Appears: ✓ YES / ✗ NO
- SP Items Prioritized: ✓ YES / ✗ NO
- Tap Navigation Works: ✓ YES / ✗ NO
- Load Time: __ seconds
- Issues Found: [DESCRIBE]

#### Phase 3 - Free User Tests
- Carousel Appears: ✓ YES / ✗ NO
- No SP Badges: ✓ CORRECT / ✗ WRONG
- Tap Navigation Works: ✓ YES / ✗ NO
- Issues Found: [DESCRIBE]

#### Phase 4 - Error Handling
- Error State Works: ✓ YES / ✗ NO
- Retry Button Works: ✓ YES / ✗ NO
- No App Crashes: ✓ YES / ✗ NO

#### Phase 5 - Performance
- Scroll Performance: Smooth / Laggy
- Image Load Time: Fast / Slow
- Orientation Change: Works / Broken

#### Overall
**Status**: ✓ PASS / ⚠️ ISSUES / ✗ FAIL
**Comments**: [ANY ADDITIONAL NOTES]
```

---

## 🚀 NEXT STEPS

After you complete manual verification:

1. **If everything passes**:
   - All verification checkboxes are checked ✓
   - Document test results
   - Ready for code review/merge

2. **If issues found**:
   - Note the exact error message
   - Try the troubleshooting steps
   - If still broken, reach out with:
     - Device/simulator version
     - Exact error message
     - Steps to reproduce

3. **Performance optimization** (if needed):
   - Reduce recommendation limit
   - Add pagination
   - Optimize image loading

---

## 📞 SUPPORT

If you encounter any issues:

1. Check console errors (Cmd+D → Debug)
2. Check Supabase logs
3. Verify RPC function exists
4. Verify you're logged in as subscriber
5. Verify items exist in database

---

**Document Version**: 1.0  
**Last Updated**: December 21, 2025  
**Module**: MODULE-05-DISCOVERY-V2  
**Task**: DISCOVERY-V2-002
