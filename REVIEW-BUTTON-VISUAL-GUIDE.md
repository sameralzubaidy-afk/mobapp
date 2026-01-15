# REVIEW-001 Button Integration - Quick Visual Reference

## Where the Review Button Appears

### Screen Flow
```
Trade Details Screen (Completed Trade)
  ├── Header (Status Badge = COMPLETED ✅)
  ├── Item Details Section
  ├── Payment Summary Section
  ├── [ACTION BUTTONS CONTAINER - Only if in_progress]
  │   ├── Mark as Completed button
  │   └── Cancel Trade button
  │
  ├── ✨ NEW: [REVIEW CONTAINER] ← Review button appears here!
  │   └── Review [Counterparty] button (Amber/Gold)
  │
  └── Info Box ("This trade was completed on...")
```

### Button Styling
- **Color:** Amber/Gold (#f59e0b) - distinct from blue (Complete) and red (Cancel)
- **Icon:** Star (⭐) from Ionicons
- **Text:** "Review the Seller" OR "Review the Buyer"
- **Size:** Full width, 56px height (paddingVertical: 16)
- **Rounded:** 12px border radius
- **State:** Disabled during submission (opacity 0.5)

### Button Code Location in Component
**File:** `src/screens/trade/TradeDetailScreen.tsx`
**Lines:** ~254-268 (in JSX render section)

```typescript
{trade.status === 'completed' && (canReview || true) && (isBuyer || isSeller) && (
  <View style={styles.reviewContainer}>
    <Pressable
      style={[styles.button, styles.reviewButton, submitting && styles.disabledButton]}
      onPress={handleReviewPress}
      disabled={submitting}
      testID="review-trade-button"  // ← For E2E testing
    >
      <Ionicons name="star" size={20} color="#fff" style={{ marginRight: 8 }} />
      <Text style={styles.buttonText}>Review {isBuyer ? 'the Seller' : 'the Buyer'}</Text>
    </Pressable>
  </View>
)}
```

## testID Identifiers (for E2E Testing)

| Element | testID | Purpose |
|---------|--------|---------|
| Review Button | `review-trade-button` | Click in E2E tests |
| Mark Completed | `mark-completed-button` | Already existed |
| Cancel Trade | `cancel-trade-button` | Already existed |

## State Flow

### When Button Shows:
1. ✅ Trade status = 'completed'
2. ✅ User is buyer OR seller (isBuyer || isSeller)
3. ✅ canReview = true (user hasn't already reviewed)

### When Button Hides:
1. ❌ Trade still in_progress
2. ❌ Trade cancelled
3. ❌ User is neither buyer nor seller
4. ❌ User already submitted a review (canReview = false)

## Navigation on Click

```typescript
handleReviewPress() {
  navigation.navigate('SubmitReview', {
    tradeId: "trade-uuid-here",
    revieweeId: "buyer-or-seller-uuid",
    revieweeName: "the buyer" or "the seller"
  })
  // → Opens SubmitReviewScreen
}
```

## After Review Submission

User will:
1. See SubmitReviewScreen with star picker
2. Enter comment (optional, max 500 chars)
3. Toggle anonymous (optional)
4. Submit review
5. Return to TradeDetailScreen
6. Review button disappears (canReview = false after reload)
7. User can see their review in Buyer/Seller profiles

## Mobile Simulator Testing

**To test locally:**

```bash
# 1. Start Expo
cd p2p-kids-marketplace
npm start

# 2. Press 'i' for iOS Simulator
# 3. Or press 'a' for Android Emulator

# 4. In app:
#    - Login with test account
#    - Go to "My Trades" tab
#    - Find a completed trade
#    - Scroll to review button section
#    - Tap "Review [Name]" button
#    - Should navigate to SubmitReviewScreen
```

## UI Screenshot Location

The review button appears **BELOW** the trade completion info box:

```
┌─────────────────────────────┐
│ STATUS: COMPLETED           │
│ (green badge)               │
│                             │
│ ITEM DETAILS                │
│ - Get SP spending sliver    │
│ - Price: $11.00             │
│                             │
│ PAYMENT SUMMARY             │
│ - Cash Paid: $X.XX          │
│ - Swap Points Used: X SP    │
│ - Platform Fee: $X.XX       │
│ - Total: $XX.XX             │
│                             │
│ ┌───────────────────────┐   │
│ │ ⭐ Review the Seller  │   │ ← NEW BUTTON!
│ └───────────────────────┘   │
│                             │
│ This trade was completed    │
│ on 1/11/2026.               │
└─────────────────────────────┘
```

## Verify Integration

**In TradeDetailScreen.tsx, confirm:**

1. ✅ Line ~28: `import { canReviewUser } from '@/services/review';`
2. ✅ Line ~47: `const [canReview, setCanReview] = useState(false);`
3. ✅ Line ~48: `const [revieweeId, setRevieweeId] = useState<string>('');`
4. ✅ Lines ~85-100: Review eligibility check in fetchTrade()
5. ✅ Lines ~180-200: handleReviewPress() function defined
6. ✅ Lines ~254-268: Review button JSX rendered
7. ✅ Lines ~425-429: reviewButton and reviewContainer styles

All confirmed ✅ ready for testing!
