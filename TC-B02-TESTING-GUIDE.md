# TC-B02 Testing Guide — Offer Expiry + Seller Ignore Prompt

## ✅ Implementation Complete

All 4 features from TC-B02 have been implemented:

1. ✅ **Auto-cancel at expiry** — Trade status changes to 'cancelled', buyer's SP restored
2. ✅ **Expired offer UI** — The cancelled (expired) trade appears in the buyer's **History** tab with a **View Item** button when the item is still available (owner decision 2026-08-28 — expired/declined offers no longer appear under Active → Your Offers)
3. ✅ **Reminder notifications** — Seller receives push at 6h and 1h before expiry
4. ✅ **Seller ignore prompt** — After 2 consecutive offers **expire unanswered** (consecutive-expiry streak, DEV-TASK-34), seller gets modal with [Pause Listing] / [Dismiss]

---

## 📋 Pre-Test Setup

### 1. Apply Database Migration

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Apply the migration via Supabase SQL Editor:
# Copy the contents of supabase/migrations/20260608000001_fix_offer_expiry_complete.sql
# Run it in the SQL Editor
```

### 2. Verify Edge Function Deployment

The `send-trade-notifications` Edge Function has been deployed with the new notification types:
- `offer_reminder_6h`
- `offer_reminder_1h`
- `seller_ignore_prompt`

You can verify at: https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/functions

### 3. Rebuild Mobile App

```bash
cd p2p-kids-marketplace
npx expo start --clear
# Press 'i' for iOS simulator
```

---

## 🧪 Test Scenario 1: Auto-Cancel + SP Restoration

**Objective**: Verify an unanswered offer auto-cancels and restores buyer's SP

### Steps:

1. **Create an offer with SP** (as test-buyer):
   - Log in as test-buyer (subscriber)
   - Find an "Accept SP" listing from test-seller
   - Submit an offer using 5 SP (e.g., $25 cash + 5 SP = $30 total)
   - Note the buyer's SP balance **before** (should show 5 SP reserved)

2. **Fast-forward the expiry clock**:
   ```sql
   -- Find the trade
   SELECT id, offer_expires_at, status, sp_amount FROM trades 
   WHERE status = 'pending' 
   ORDER BY created_at DESC LIMIT 1;
   
   -- Set expiry to 2 minutes from now
   UPDATE trades 
   SET offer_expires_at = NOW() + INTERVAL '2 minutes'
   WHERE id = '<trade-uuid>';
   ```

3. **Wait 2-3 minutes**, then run:
   ```sql
   SELECT public.rpc_process_expired_offers(100);
   ```

4. **Verify the results**:
   ```sql
   -- Check trade was cancelled
   SELECT id, status, cancellation_reason, sp_released_at 
   FROM trades 
   WHERE id = '<trade-uuid>';
   
   -- EXPECTED: status = 'cancelled', sp_released_at = timestamp
   
   -- Check SP ledger shows refund
   SELECT 
     transaction_type,
     amount,
     balance_before,
     balance_after,
     description,
     created_at
   FROM sp_ledger 
   WHERE related_transaction_id = '<trade-uuid>'
   ORDER BY created_at ASC;
   
   -- EXPECTED: Two entries:
   --   1. 'spend_purchase' (negative) when offer was created
   --   2. 'earn_refund' (positive) when offer was cancelled
   
   -- Check buyer's wallet
   SELECT available_balance, reserved_sp 
   FROM sp_wallets 
   WHERE user_id = '<buyer-id>';
   
   -- EXPECTED: 
   --   - available_balance increased by 5
   --   - reserved_sp decreased by 5
   ```

---

## 🧪 Test Scenario 2: Expired Offer UI

**Objective**: Verify the cancelled (expired) offer appears in the buyer's History tab with a "View Item" affordance when the item is still available

### Steps:

1. **Log in as test-buyer** and navigate to **Trades → History** (expired/declined offers no longer appear under Active → Your Offers — owner decision 2026-08-28)

2. **Verify the expired offer shows**:
   - Badge: **"Cancelled"**
   - Row links to the trade details; if the listing is still available, a **[View Item]** button appears

3. **Tap [View Item]** (or tap the row → trade details):
   - [View Item] should navigate to the listing detail (ListingDetail) for that listing
   - You should be able to submit a new offer

4. **If the listing was deleted/sold**:
   - No [View Item] button (just the row → trade details)

---

## 🧪 Test Scenario 3: Reminder Notifications

**Objective**: Verify seller receives push notifications at 6h and 1h before expiry

### Steps:

1. **Create a fresh offer** (as test-buyer on test-seller's listing)

2. **Fast-forward to 6 hours before expiry**:
   ```sql
   -- Set offer to expire in 6 hours 15 minutes
   UPDATE trades 
   SET offer_expires_at = NOW() + INTERVAL '6 hours 15 minutes'
   WHERE id = '<trade-uuid>';
   ```

3. **Run the reminder processor**:
   ```sql
   SELECT public.rpc_send_offer_reminders(100);
   ```

4. **Verify 6h reminder was sent**:
   ```sql
   SELECT reminder_6h_sent_at FROM trades WHERE id = '<trade-uuid>';
   -- EXPECTED: timestamp (not NULL)
   ```

5. **Check seller's device** (logged in as test-seller):
   - Should receive push notification: **"Offer Expiring Soon"**
   - Body: **"You have an offer on "[Item]" expiring in 6 hours."**

6. **Fast-forward to 1 hour before expiry**:
   ```sql
   UPDATE trades 
   SET offer_expires_at = NOW() + INTERVAL '1 hour 15 minutes'
   WHERE id = '<trade-uuid>';
   ```

7. **Run reminders again**:
   ```sql
   SELECT public.rpc_send_offer_reminders(100);
   ```

8. **Verify 1h reminder was sent**:
   ```sql
   SELECT reminder_1h_sent_at FROM trades WHERE id = '<trade-uuid>';
   -- EXPECTED: timestamp (not NULL)
   ```

9. **Check seller's device**:
   - Should receive: **"You have an offer on "[Item]" expiring in 1 hour."**

---

## 🧪 Test Scenario 4: Seller Ignore Prompt

**Objective**: Verify seller receives modal prompt after **2 consecutive offers that expire unanswered** (consecutive-expiry streak in `listing_offer_stats.unanswered_offer_count`)

> **DEV-TASK-34 (2026-08-29):** the counter is now a **consecutive-expiry streak** — +1 per offer that *expires unanswered* (`rpc_process_expired_offers`), reset to 0 on seller **accept/decline**, declines never count. Offer submission does NOT increment it. The nudge copy is: *"A few offers on [Item] have gone unanswered. Respond to your pending offers — or pause the listing if you're not able to sell right now."*

### Steps:

1. **Create 2 consecutive offers** on the same listing (both from test-buyer):
   - Submit Offer 1, let it expire (use fast-forward method)
   - Submit Offer 2 (only AFTER Offer 1 has fully expired — sequential, no overlap), let it expire

2. **Run expiry processor for both** (after each expiry):
   ```sql
   SELECT public.rpc_process_expired_offers(100);
   ```

3. **Check the streak was built**:
   ```sql
   SELECT 
     i.id,
     i.title,
     los.unanswered_offer_count,
     los.last_prompt_sent_at
   FROM items i
   LEFT JOIN listing_offer_stats los ON i.id = los.listing_id
   WHERE i.seller_id = '<test-seller-id>'
     AND los.unanswered_offer_count >= 2;
   ```
   - 1st expiry → count = 1 (no nudge)
   - 2nd sequential expiry → count = 2 → nudge fires

4. **Verify seller received push notification**:
   - Title: **"Listing Feedback"**
   - Body: **"A few offers on "[Item]" have gone unanswered. Respond to your pending offers — or pause the listing if you're not able to sell right now."**

5. **Test the modal UI** (manual simulation):
   - Log in as test-seller in the app
   - Navigate to **Trades** screen
   - Manually trigger the modal by calling:
     ```typescript
     setIgnoringModalItem({ listing_id: '<listing-id>', title: 'Test Item' });
     setShowIgnoringModal(true);
     ```
   
6. **Verify modal content**:
   - Title: **"Listing Feedback"**
   - Body: Shows the listing title with the new copy
   - Button 1: **[Pause Listing]** (green button)
   - Button 2: **[Dismiss]** (gray text link)

7. **Test [Pause Listing]**:
   - Tap the button
   - Verify listing status changes to 'paused':
     ```sql
     SELECT id, title, status FROM items WHERE id = '<listing-id>';
     -- EXPECTED: status = 'paused'
     ```

8. **Test [Dismiss]**:
   - Modal should close without changing listing status

9. **Decline leg — streak never fires for declines (DEV-TASK-34)**: submit an offer, **decline** it (`status='cancelled', cancellation_reason='seller_declined'`), repeat once more → `unanswered_offer_count` stays **0** and `last_prompt_sent_at` stays NULL (declines reset the streak, never count).

10. **Verify cooldown** (7-day):
   ```sql
   -- Check last_prompt_sent_at was updated
   SELECT last_prompt_sent_at FROM listing_offer_stats WHERE listing_id = '<listing-id>';
   -- EXPECTED: Recent timestamp
   
   -- Simulate another 2 unanswered expiries (should NOT trigger prompt again within 7 days)
   UPDATE listing_offer_stats 
   SET unanswered_offer_count = 4,
       last_prompt_sent_at = NOW() - INTERVAL '6 days'
   WHERE listing_id = '<listing-id>';
   
   SELECT public.rpc_process_expired_offers(100);
   -- Should NOT send another prompt (7-day cooldown still active)
   ```

---

## 🔍 Verification Queries

### Check all expired offers processed:
```sql
SELECT 
  t.id,
  t.created_at,
  t.offer_expires_at,
  t.status,
  t.cancellation_reason,
  t.sp_amount,
  t.sp_released_at
FROM trades t
WHERE t.offer_expires_at <= NOW()
  AND t.status = 'pending'
ORDER BY t.offer_expires_at ASC;

-- EXPECTED: 0 rows (all should be cancelled)
```

### Check SP restoration is working:
```sql
SELECT 
  t.id,
  t.buyer_id,
  t.sp_amount,
  t.sp_reserved_at,
  t.sp_released_at,
  t.status
FROM trades t
WHERE t.status = 'cancelled'
  AND t.sp_amount > 0
ORDER BY t.cancelled_at DESC
LIMIT 5;

-- EXPECTED: All rows have sp_released_at set
```

### Check notification logs:
```sql
-- If you have a notifications table, check it:
SELECT * FROM notifications 
WHERE event_type IN ('offer_reminder_6h', 'offer_reminder_1h', 'seller_ignore_prompt')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🚨 Known Issues / Limitations

1. **Notification deep-linking** — Tapping the `seller_ignore_prompt` push notification currently only logs to console. Full deep-linking requires setting up a navigation ref in App.tsx (future enhancement).

2. **Cron automation** — The `rpc_process_expired_offers` and `rpc_send_offer_reminders` functions must be called manually or via a cron job. Set up automation:
   - `rpc_process_expired_offers(100)` — Run every 5-10 minutes
   - `rpc_send_offer_reminders(100)` — Run every 15-30 minutes

3. **Timezone** — All timestamps are in UTC. Reminder timings are approximate (e.g., "6 hours" could be 5h30m - 6h30m).

---

## ✅ Acceptance Criteria (from TC-B02)

- [x] At expiry the trade auto-cancels
- [x] Buyer's reserved SP is restored to available balance
- [x] SP ledger shows 'earn_refund' entry
- [x] Buyer's History tab shows the cancelled (expired) trade with a [View Item] button when the item is still available (owner decision 2026-08-28 — moved out of Active "Your Offers")
- [x] [View Item] button navigates to the listing detail (ListingDetail)
- [x] Seller receives reminder push at ~6 hours before expiry
- [x] Seller receives reminder push at ~1 hour before expiry
- [x] After 2nd consecutive offer that **expires unanswered**, seller receives prompt (streak reaches 2; declines reset the streak and never count — DEV-TASK-34)
- [x] Modal shows: "A few offers on [Item] have gone unanswered. Respond to your pending offers — or pause the listing if you're not able to sell right now."
- [x] [Pause Listing] button changes listing status to 'paused'
- [x] [Dismiss] button closes modal without changes
- [x] 7-day cooldown prevents spam prompts

---

## 📦 Files Modified

1. `supabase/migrations/20260608000001_fix_offer_expiry_complete.sql` — ✅ Created
2. `supabase/functions/send-trade-notifications/index.ts` — ✅ Updated, deployed
3. `p2p-kids-marketplace/src/screens/trade/TradeListScreen.tsx` — ✅ Modal UI added
4. `p2p-kids-marketplace/src/services/notifications.ts` — ✅ Notification handler updated
5. `TC-B02-OFFER-EXPIRY-FIX.md` — ✅ Documentation updated

---

## 🔄 Next Steps After Testing

1. **Set up cron jobs** for automatic expiry processing
2. **Implement navigation ref** for deep-linking from push notifications
3. **Add analytics events** for offer expiry and seller ignore prompts
4. **Test on production** after staging validation
5. **Monitor metrics**: 
   - % of offers that expire
   - % of sellers who pause after prompt
   - SP restoration accuracy
