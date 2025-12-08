# MODULE 09: POINTS & GAMIFICATION - VERIFICATION REPORT V2

**Module:** Points & Gamification (Swap Points System)  
**Version:** 2.0 - Aligned with SYSTEM_REQUIREMENTS_V2.md  
**Total Tasks:** 12  
**Estimated Time:** ~28 hours  
**Status:** Ready for Implementation

---

## V2 KEY CHANGES FROM V1

| Aspect | V1 (Old) | V2 (New) |
|--------|----------|----------|
| **Eligibility** | All users | Kids Club+ subscribers only |
| **Architecture** | Single balance column | Wallet + Batches + Ledger tables |
| **Earning** | Immediate | 3-day pending period |
| **Spending** | Up to 50% of item price | Only on item price (fees in cash) |
| **Expiration** | Never | Admin-configurable (default 365 days from earn) |
| **Configuration** | Hardcoded | Admin-configurable via sp_config table |
| **Gamification** | Basic badges | Challenges + Badges + Progress tracking |

---

## DELIVERABLES CHECKLIST

### Database Schema

#### Core SP Tables
- [ ] `sp_wallets` table created with all required fields
- [ ] `sp_batches` table for FIFO expiration tracking
- [ ] `sp_ledger` immutable audit trail table
- [ ] `sp_config` admin configuration table
- [ ] All indexes created for performance
- [ ] All RLS policies configured

#### Gamification Tables
- [ ] `challenges` table for admin-defined challenges
- [ ] `user_challenges` table for progress tracking
- [ ] `badges` table with admin-configurable thresholds
- [ ] `user_badges` table for awarded badges
- [ ] `sp_warning_log` for expiration warnings

#### RPC Functions
- [ ] `sp_credit(user_id, amount, source, ref_id)` - Credit SP with batch creation
- [ ] `sp_debit_fifo(user_id, amount, ref_id)` - FIFO deduction across batches
- [ ] `sp_get_summary(user_id)` - Returns available, pending, expiring soon
- [ ] `sp_release_pending()` - Cron job to release pending SP
- [ ] `sp_expire_batches()` - Cron job to expire old batches
- [ ] `sp_handle_subscription_lapse(user_id)` - Handle cancellation
- [ ] `sp_admin_grant(user_id, amount, reason, admin_id)` - Admin grant
- [ ] `sp_admin_revoke(user_id, amount, reason, admin_id)` - Admin revoke

### Backend Services

#### SP Wallet Service (`src/services/sp/wallet.ts`)
- [ ] `getWallet(userId)` - Get or create wallet
- [ ] `getBalance(userId)` - Get available balance
- [ ] `getSummary(userId)` - Get full summary (available, pending, expiring)
- [ ] `getBatches(userId)` - Get active batches with expiration dates
- [ ] `getLedgerHistory(userId, limit, offset)` - Paginated ledger

#### SP Earning Service (`src/services/sp/earning.ts`)
- [ ] `awardStarterPack(userId)` - 100 SP for new subscribers
- [ ] `awardTransactionReward(userId, transactionId)` - Post-sale SP
- [ ] `awardReferralReward(referrerId, refereeId)` - Referral bonus
- [ ] `awardChallengeReward(userId, challengeId)` - Challenge completion
- [ ] Subscription check before all earning operations

#### SP Spending Service (`src/services/sp/spending.ts`)
- [ ] `calculateMaxSpendable(userId, itemPrice)` - Max SP for checkout
- [ ] `validateSpend(userId, amount)` - Check sufficient balance
- [ ] `processSpend(userId, amount, transactionId)` - FIFO deduction
- [ ] `processRefund(userId, amount, transactionId)` - Return SP on refund
- [ ] Fee exclusion (all fees paid in cash per V2)

#### SP Expiration Service (`src/services/sp/expiration.ts`)
- [ ] `calculateExpirationDate(earnDate, config)` - Based on trigger type
- [ ] `getExpiringBatches(userId, days)` - Batches expiring within N days
- [ ] `sendExpirationWarnings()` - Cron for 7-day warnings
- [ ] `handleSubscriptionLapse(userId)` - Freeze wallet, start grace period
- [ ] `handleGracePeriodExpiry(userId)` - Expire all SP after 90 days

#### Challenges Service (`src/services/challenges/index.ts`)
- [ ] `getActiveChallenges(userId)` - Available challenges for user
- [ ] `getUserProgress(userId, challengeId)` - Current progress
- [ ] `incrementProgress(userId, challengeId, amount)` - Update progress
- [ ] `claimReward(userId, challengeId)` - Claim completed challenge
- [ ] `checkAutoProgress(userId, eventType)` - Auto-update on events

#### Badges Service (`src/services/badges/index.ts`)
- [ ] `evaluateBadges(userId)` - Check eligibility for all badges
- [ ] `awardBadge(userId, badgeId)` - Grant badge to user
- [ ] `getUserBadges(userId)` - Get all earned badges
- [ ] `getBadgeProgress(userId, badgeId)` - Progress toward next tier

### UI Components

#### SP Wallet Screen (`src/screens/wallet/SpWalletScreen.tsx`)
- [ ] Balance card with available/pending/expiring
- [ ] "Expiring Soon" warning banner
- [ ] Batch list with individual expiration dates
- [ ] Ledger history with infinite scroll
- [ ] Filter by transaction type
- [ ] Empty state for new users

#### Progress Indicators
- [ ] `SpProgressBar` - Animated progress bar component
- [ ] `BadgeProgressCard` - Progress toward next badge tier
- [ ] `ChallengeCard` - Challenge with progress bar
- [ ] `SpStatusCard` - Compact wallet summary for profile

#### Challenges UI
- [ ] `ChallengesScreen` - List of active challenges
- [ ] `ChallengeDetailModal` - Full challenge info + claim button
- [ ] `CompletedChallengesTab` - History of completed challenges

#### Badges UI
- [ ] `BadgesScreen` - Grid of all badges with earned/locked state
- [ ] `BadgeDetailModal` - Badge info + requirements
- [ ] `BadgeShowcase` - Featured badges on profile

### Admin Panel

#### SP Configuration (`admin/app/sp-config/`)
- [ ] Earning rates configuration (starter pack, transaction, referral)
- [ ] Spending rules (max percentage, fee handling)
- [ ] Expiration settings (trigger type, days, grace period)
- [ ] Challenge CRUD interface
- [ ] Badge threshold configuration

#### SP Dashboard (`admin/app/sp-dashboard/`)
- [ ] Total SP in circulation
- [ ] SP velocity (earned vs spent per period)
- [ ] Pending SP awaiting release
- [ ] Expiring SP in next 30 days
- [ ] Top SP earners/spenders

#### User SP Management
- [ ] Search user by email/ID
- [ ] View user's SP wallet details
- [ ] Grant SP with reason
- [ ] Revoke SP with reason
- [ ] View user's ledger history

### Edge Functions

- [ ] `sp-release-pending` - Scheduled function for 3-day release
- [ ] `sp-expire-batches` - Scheduled function for expiration
- [ ] `sp-expiration-warnings` - Scheduled function for warnings
- [ ] `sp-subscription-lapse-handler` - Webhook for subscription events

---

## FEATURE FLOWS TO TEST

### 1. New Subscriber Starter Pack
**Flow:**
1. User subscribes to Kids Club+
2. System credits 100 SP starter pack
3. SP marked as pending for 3 days
4. After 3 days, SP becomes available
5. Notification sent when available

**Expected Results:**
- ✓ 100 SP credited to wallet
- ✓ Batch created with `source = 'starter_pack'`
- ✓ Ledger entry created
- ✓ `available_at` set to NOW() + 3 days
- ✓ Push notification after release

**Edge Cases:**
- User already received starter pack → No duplicate award
- User cancels before 3 days → SP deleted (not released)
- Subscription check fails → Award blocked

---

### 2. Transaction SP Earning
**Flow:**
1. Seller completes transaction (item delivered)
2. System calculates SP based on admin config
3. SP credited with 3-day pending period
4. Ledger entry with transaction reference
5. After 3 days, SP available to spend

**Expected Results:**
- ✓ SP amount matches config formula
- ✓ Batch created with `source = 'transaction'`
- ✓ `ref_id` links to transaction
- ✓ Pending period enforced
- ✓ Notification on release

**Edge Cases:**
- Seller not subscribed → No SP earned
- Transaction reversed before release → SP cancelled
- Zero SP config → No SP awarded (but no error)

---

### 3. SP Spending at Checkout
**Flow:**
1. Subscriber at checkout with $50 item
2. System shows max spendable SP
3. User selects SP amount (slider/input)
4. SP deducted via FIFO from oldest batches
5. Cash portion charged separately
6. Platform fee charged in cash (not SP)

**Expected Results:**
- ✓ Max SP shown correctly
- ✓ FIFO deduction (oldest batches first)
- ✓ Multiple batches used if needed
- ✓ Ledger entry with transaction ref
- ✓ Fee excluded from SP calculation

**Edge Cases:**
- Insufficient SP → Show available amount only
- All SP in pending state → $0 spendable
- Transaction fails → SP refunded atomically
- Subscription lapsed → No SP spending allowed

---

### 4. SP Expiration Flow
**Flow:**
1. Cron job runs daily at midnight UTC
2. Find batches where `expires_at < NOW()`
3. Mark batches as expired
4. Deduct from wallet available balance
5. Log in ledger as `reason = 'expiration'`
6. Send summary notification to affected users

**Expected Results:**
- ✓ Expired batches marked correctly
- ✓ Wallet balance reduced
- ✓ Ledger entries created
- ✓ Notifications sent
- ✓ No double-expiration

**Edge Cases:**
- User has no expiring batches → Skip
- All batches expired → Balance goes to 0
- Expiration during active transaction → Transaction uses available only

---

### 5. Expiration Warning (7-Day Notice)
**Flow:**
1. Cron job runs daily
2. Find batches expiring in 7 days
3. Check if warning already sent
4. Send push notification with amount
5. Log warning in sp_warning_log
6. Show "Expiring Soon" banner in wallet

**Expected Results:**
- ✓ Warnings sent 7 days before expiry
- ✓ No duplicate warnings (check log)
- ✓ Notification includes SP amount and date
- ✓ UI shows expiring banner

**Edge Cases:**
- User has notifications disabled → Skip push, still log
- Multiple batches expiring same day → Aggregate in one message
- User spends before expiry → No warning needed (batch gone)

---

### 6. Subscription Cancellation → SP Freeze
**Flow:**
1. User cancels Kids Club+ subscription
2. Webhook triggers `sp_handle_subscription_lapse`
3. Wallet status set to `frozen`
4. 90-day grace period starts
5. User can see SP but not earn/spend
6. Reminders at 60, 30, 7, 1 days

**Expected Results:**
- ✓ Wallet frozen immediately
- ✓ Grace period end date recorded
- ✓ UI shows frozen state with countdown
- ✓ Spending blocked (validation fails)
- ✓ Earning blocked (subscription check)

**Edge Cases:**
- User resubscribes during grace → Wallet unfrozen
- User resubscribes after grace → Fresh wallet (old SP gone)
- Grace period expires → All SP permanently deleted

---

### 7. Challenge Progress & Completion
**Flow:**
1. User performs action (e.g., lists 5 items)
2. System auto-increments challenge progress
3. When target reached, challenge marked complete
4. User claims reward via UI
5. SP credited (with pending period)

**Expected Results:**
- ✓ Progress updates on relevant events
- ✓ Progress bar reflects current/target
- ✓ Claim button appears when complete
- ✓ Reward credited with pending period
- ✓ Challenge moves to "Completed" tab

**Edge Cases:**
- Challenge expires before completion → Reset progress
- User not subscribed → Cannot participate
- Duplicate claim attempt → Blocked
- Challenge deleted while in progress → No reward

---

### 8. Badge Evaluation & Award
**Flow:**
1. User completes action (e.g., 5 donations)
2. System evaluates badge eligibility
3. If threshold met, badge awarded
4. Notification sent with badge info
5. Badge displayed on profile

**Expected Results:**
- ✓ Badge awarded at correct threshold
- ✓ `user_badges` entry created
- ✓ Notification sent
- ✓ Badge appears in profile showcase
- ✓ Progress bar updates to next tier

**Edge Cases:**
- User already has badge → No duplicate
- Higher tier unlocked → Both tiers shown (or just highest)
- Badge criteria changed → Existing awards preserved

---

### 9. Admin SP Grant
**Flow:**
1. Admin searches for user
2. Enters SP amount and reason
3. Submits grant request
4. SP credited immediately (no pending)
5. Logged in ledger and admin audit

**Expected Results:**
- ✓ SP added to wallet instantly
- ✓ Batch created with `source = 'admin_grant'`
- ✓ Ledger entry with admin_id and reason
- ✓ Admin audit log entry
- ✓ User receives notification

**Edge Cases:**
- User not subscribed → Warning shown, grant anyway option
- Very large amount → Confirmation required
- Admin lacks permission → Action blocked

---

### 10. Admin SP Revoke
**Flow:**
1. Admin searches for user
2. Enters SP amount to revoke and reason
3. System validates sufficient balance
4. SP deducted via FIFO
5. Logged in ledger and admin audit

**Expected Results:**
- ✓ SP removed from wallet
- ✓ FIFO deduction from batches
- ✓ Ledger entry with `reason = 'admin_revoke'`
- ✓ Admin audit log entry
- ✓ User receives notification

**Edge Cases:**
- Amount > available balance → Partial revoke option
- User has pending SP only → Cannot revoke pending
- Revoke reason required → Validation enforced

---

## DATABASE SCHEMA VERIFICATION

### sp_wallets Table
```sql
CREATE TABLE sp_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  available_balance INTEGER NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance INTEGER NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  status sp_wallet_status NOT NULL DEFAULT 'active',
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Verify:**
- [ ] Table created with correct schema
- [ ] CHECK constraints prevent negative balances
- [ ] Unique constraint on user_id
- [ ] Index on user_id for lookups
- [ ] RLS policies applied

---

### sp_batches Table
```sql
CREATE TABLE sp_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id),
  original_amount INTEGER NOT NULL CHECK (original_amount > 0),
  remaining_amount INTEGER NOT NULL CHECK (remaining_amount >= 0),
  source sp_source NOT NULL,
  ref_id UUID,
  status sp_batch_status NOT NULL DEFAULT 'pending',
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  available_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Verify:**
- [ ] Table created with correct schema
- [ ] Foreign key to sp_wallets
- [ ] Indexes on wallet_id, status, expires_at
- [ ] Enum types created (sp_source, sp_batch_status)
- [ ] RLS policies applied

---

### sp_ledger Table
```sql
CREATE TABLE sp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id),
  batch_id UUID REFERENCES sp_batches(id),
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason sp_reason NOT NULL,
  ref_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Verify:**
- [ ] Table created with correct schema
- [ ] Immutable (no UPDATE/DELETE policies)
- [ ] Index on wallet_id + created_at
- [ ] Enum type created (sp_reason)
- [ ] Partition strategy for scale (optional)

---

### sp_config Table
```sql
CREATE TABLE sp_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  category TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);
```

**Verify:**
- [ ] Table created with correct schema
- [ ] Seeded with default values (see below)
- [ ] Admin-only write access
- [ ] Public read for app config

---

### sp_config Default Values
```sql
-- Earning Configuration
('starter_pack_amount', '100', 'integer', 'earning'),
('starter_pack_enabled', 'true', 'boolean', 'earning'),
('transaction_sp_percent', '10', 'integer', 'earning'),
('transaction_sp_min', '5', 'integer', 'earning'),
('transaction_sp_max', '200', 'integer', 'earning'),
('referral_reward_referrer', '50', 'integer', 'earning'),
('referral_reward_referee', '25', 'integer', 'earning'),

-- Spending Configuration
('sp_to_cash_rate', '100', 'integer', 'spending'), -- 100 SP = $1
('max_sp_percent_of_item', '100', 'integer', 'spending'), -- V2: No cap

-- Expiration Configuration
('expiration_trigger', 'from_earn_date', 'string', 'expiration'),
('expiration_days', '365', 'integer', 'expiration'),
('grace_period_days', '90', 'integer', 'expiration'),
('warning_days_before', '7', 'integer', 'expiration'),

-- Pending Period
('pending_release_hours', '72', 'integer', 'pending'),
```

**Verify:**
- [ ] All config keys seeded
- [ ] Values match V2 requirements
- [ ] Admin can edit via UI
- [ ] Changes logged with updated_by

---

### challenges Table
```sql
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  reward_sp INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  is_repeatable BOOLEAN DEFAULT FALSE,
  category TEXT,
  icon_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Challenge Types:**
- `items_listed` - List N items
- `items_sold` - Sell N items
- `items_purchased` - Buy N items
- `sp_earned` - Earn N total SP
- `sp_spent` - Spend N total SP
- `donations_made` - Donate N items
- `referrals_completed` - Refer N users who subscribe
- `days_active` - Log in N consecutive days
- `reviews_given` - Leave N reviews

**Verify:**
- [ ] Table created
- [ ] All challenge types supported
- [ ] Active/inactive toggle working
- [ ] Date range filtering working

---

### badges Table
```sql
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  badge_type TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  threshold INTEGER NOT NULL,
  icon_url TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Badge Types:**
- `trust` - Bronze, Silver, Gold, Verified
- `donation` - Helper, Generous, Champion, Super Parent
- `seller` - New, Active, Power, Elite
- `buyer` - First Purchase, Regular, VIP
- `special` - Admin-awarded, seasonal

**Verify:**
- [ ] Table created
- [ ] Default badges seeded
- [ ] Tier progression correct
- [ ] Thresholds admin-editable

---

## TESTING CHECKLIST

### Unit Tests

#### Wallet Service
- [ ] `getWallet()` creates wallet if not exists
- [ ] `getBalance()` returns correct available balance
- [ ] `getSummary()` returns all three balance types
- [ ] Subscription check blocks non-subscribers

#### Earning Service
- [ ] `awardStarterPack()` credits 100 SP correctly
- [ ] `awardTransactionReward()` calculates based on config
- [ ] `awardReferralReward()` credits both users
- [ ] Pending period applied (available_at = now + 72h)
- [ ] Duplicate starter pack blocked

#### Spending Service
- [ ] `calculateMaxSpendable()` respects available balance
- [ ] `validateSpend()` rejects if insufficient
- [ ] `processSpend()` uses FIFO correctly
- [ ] `processRefund()` recreates batch correctly
- [ ] Frozen wallet blocks spending

#### Expiration Service
- [ ] `calculateExpirationDate()` handles all trigger types
- [ ] `getExpiringBatches()` returns correct batches
- [ ] Expiration cron processes batches correctly
- [ ] Warning cron sends notifications correctly
- [ ] Grace period handling works

#### Challenges Service
- [ ] `getActiveChallenges()` filters correctly
- [ ] `incrementProgress()` updates correctly
- [ ] `claimReward()` credits SP and marks complete
- [ ] Expired challenges not claimable
- [ ] Repeatable challenges reset correctly

#### Badges Service
- [ ] `evaluateBadges()` checks all badge types
- [ ] `awardBadge()` creates user_badges entry
- [ ] No duplicate badge awards
- [ ] Progress calculation correct

### Integration Tests

- [ ] Complete transaction → SP earned → 3-day release → available
- [ ] Checkout with SP → FIFO deduction → ledger entries correct
- [ ] Subscription cancel → wallet frozen → grace period → expiration
- [ ] Challenge complete → claim → SP credited with pending
- [ ] Admin grant → immediate availability → ledger correct

### E2E Tests

- [ ] New subscriber sees starter pack notification
- [ ] Wallet screen shows correct balances
- [ ] Expiring banner appears when batches expiring soon
- [ ] Checkout slider shows correct max SP
- [ ] Challenge progress updates in real-time
- [ ] Badge appears on profile after award

### Performance Tests

- [ ] Wallet fetch: <100ms
- [ ] FIFO deduction across 10 batches: <500ms
- [ ] Ledger history (1000 entries): <1s
- [ ] Expiration cron (10,000 wallets): <5min
- [ ] Concurrent spending: no race conditions

---

## SECURITY CONSIDERATIONS

### RLS Policies

```sql
-- Wallet: Users can view own wallet only
CREATE POLICY "Users view own wallet"
  ON sp_wallets FOR SELECT
  USING (user_id = auth.uid());

-- Batches: Users can view own batches only
CREATE POLICY "Users view own batches"
  ON sp_batches FOR SELECT
  USING (wallet_id IN (SELECT id FROM sp_wallets WHERE user_id = auth.uid()));

-- Ledger: Users can view own ledger only
CREATE POLICY "Users view own ledger"
  ON sp_ledger FOR SELECT
  USING (wallet_id IN (SELECT id FROM sp_wallets WHERE user_id = auth.uid()));

-- All writes via service role (RPC functions)
-- No direct INSERT/UPDATE/DELETE for users
```

**Verify:**
- [ ] Users cannot view others' SP data
- [ ] Users cannot directly modify balances
- [ ] All modifications via authenticated RPC
- [ ] Admin has elevated access

### Anti-Fraud Measures

- [ ] 3-day pending period prevents rapid fraud
- [ ] FIFO deduction prevents cherry-picking batches
- [ ] Immutable ledger provides audit trail
- [ ] Subscription check on all earning
- [ ] Row-level locking prevents race conditions
- [ ] Admin actions logged with reason

---

## API ENDPOINTS

### Supabase RPC Calls

```typescript
// Get wallet summary
supabase.rpc('sp_get_summary', { p_user_id: userId })

// Credit SP (internal use only)
supabase.rpc('sp_credit', {
  p_user_id: userId,
  p_amount: 100,
  p_source: 'starter_pack',
  p_ref_id: null
})

// Debit SP (FIFO)
supabase.rpc('sp_debit_fifo', {
  p_user_id: userId,
  p_amount: 50,
  p_ref_id: transactionId
})

// Release pending SP (cron)
supabase.rpc('sp_release_pending')

// Expire batches (cron)
supabase.rpc('sp_expire_batches')

// Admin grant
supabase.rpc('sp_admin_grant', {
  p_user_id: userId,
  p_amount: 100,
  p_reason: 'Customer service compensation',
  p_admin_id: adminId
})

// Admin revoke
supabase.rpc('sp_admin_revoke', {
  p_user_id: userId,
  p_amount: 50,
  p_reason: 'Fraud investigation',
  p_admin_id: adminId
})
```

**Verify:**
- [ ] All RPC functions work from client
- [ ] Service role required for credit/debit
- [ ] Admin role required for grant/revoke
- [ ] Rate limiting on all endpoints

---

## ANALYTICS EVENTS

Track these events:

### SP Events
1. `sp_earned` - amount, source, user_id
2. `sp_spent` - amount, transaction_id, user_id
3. `sp_expired` - amount, batch_count, user_id
4. `sp_refunded` - amount, transaction_id, user_id
5. `sp_wallet_frozen` - user_id, reason
6. `sp_wallet_unfrozen` - user_id

### Gamification Events
7. `challenge_started` - challenge_id, user_id
8. `challenge_progress` - challenge_id, progress, target, user_id
9. `challenge_completed` - challenge_id, reward_sp, user_id
10. `badge_earned` - badge_id, badge_type, user_id

### Admin Events
11. `sp_admin_grant` - amount, reason, target_user, admin_id
12. `sp_admin_revoke` - amount, reason, target_user, admin_id
13. `sp_config_changed` - key, old_value, new_value, admin_id

---

## CRON JOB SCHEDULE

| Job | Schedule | Function |
|-----|----------|----------|
| Release Pending SP | Every hour | `sp_release_pending()` |
| Expire Batches | Daily 00:00 UTC | `sp_expire_batches()` |
| Send Warnings | Daily 09:00 UTC | `sp_send_expiration_warnings()` |
| Grace Period Check | Daily 00:00 UTC | `sp_process_grace_expiry()` |

**Verify:**
- [ ] Cron jobs scheduled in Supabase
- [ ] Error handling and retry logic
- [ ] Logging for debugging
- [ ] Alerting on failures

---

## COST ANALYSIS

**Monthly Costs (10,000 active subscribers):**

| Item | Estimate |
|------|----------|
| Database storage (SP tables) | ~50MB = $0 (free tier) |
| RPC function calls | ~500K/month = $0 (free tier) |
| Edge function invocations | ~100K/month = $0 (free tier) |
| Push notifications | ~50K/month = $0 (Expo free tier) |
| **Total** | **$0/month (MVP)** |

**Scale Considerations:**
- At 100K users: May need Supabase Pro ($25/month)
- At 1M users: Consider read replicas, caching

---

## MIGRATION SCRIPT SUMMARY

**Migration Files (in order):**
1. `040_sp_enums.sql` - Create enum types
2. `041_sp_wallets.sql` - Wallet table
3. `042_sp_batches.sql` - Batch table with FIFO
4. `043_sp_ledger.sql` - Immutable ledger
5. `044_sp_config.sql` - Admin configuration
6. `045_sp_functions.sql` - RPC functions
7. `046_sp_triggers.sql` - Auto-update triggers
8. `047_sp_challenges.sql` - Challenges system
9. `048_sp_badges.sql` - Badges system
10. `049_sp_warning_log.sql` - Warning tracking

**Rollback Plan:**
```sql
-- Rollback in reverse order
DROP TABLE IF EXISTS sp_warning_log CASCADE;
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS badges CASCADE;
DROP TABLE IF EXISTS user_challenges CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS sp_ledger CASCADE;
DROP TABLE IF EXISTS sp_batches CASCADE;
DROP TABLE IF EXISTS sp_wallets CASCADE;
DROP TABLE IF EXISTS sp_config CASCADE;
DROP TYPE IF EXISTS sp_wallet_status CASCADE;
DROP TYPE IF EXISTS sp_batch_status CASCADE;
DROP TYPE IF EXISTS sp_source CASCADE;
DROP TYPE IF EXISTS sp_reason CASCADE;
```

---

## KNOWN LIMITATIONS

1. **SP on Item Price Only** - Cannot use SP for fees (V2 requirement)
2. **No SP Transfer** - Cannot send SP to other users
3. **No SP Purchase** - Cannot buy SP with cash (closed-loop)
4. **Single Currency** - SP only, no multiple point types
5. **No Negative Balance** - System prevents overdraft
6. **Subscription Required** - Non-subscribers excluded from SP system

---

## POST-MVP ENHANCEMENTS

1. **SP Gifting** - Send SP to friends/family
2. **SP Tiers** - Different earning rates by membership level
3. **Seasonal Multipliers** - 2x SP events
4. **Challenge Builder** - Admin creates custom challenges
5. **Badge Marketplace** - Trade/display rare badges
6. **SP Leaderboards** - Community competition
7. **SP Forecasting** - Predict expiration impact
8. **Multi-Currency** - Different point types for different actions

---

## SIGN-OFF CHECKLIST

**Before marking module complete:**

### Database
- [ ] All migrations run successfully
- [ ] Enum types created
- [ ] All tables created with correct schema
- [ ] RLS policies applied and tested
- [ ] Indexes created
- [ ] Config table seeded

### Services
- [ ] Wallet service complete and tested
- [ ] Earning service complete and tested
- [ ] Spending service complete and tested
- [ ] Expiration service complete and tested
- [ ] Challenges service complete and tested
- [ ] Badges service complete and tested

### UI
- [ ] Wallet screen complete
- [ ] Expiring banner functional
- [ ] Progress bars animated
- [ ] Challenges UI complete
- [ ] Badges UI complete
- [ ] Admin SP config UI complete

### Testing
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Performance benchmarks met

### Documentation
- [ ] API documentation complete
- [ ] Admin guide complete
- [ ] Error codes documented

---

**Module Status:** ✅ READY FOR IMPLEMENTATION  
**Blocker Issues:** None  
**Dependencies:** MODULE-02 (Auth), MODULE-11 (Subscriptions)  
**Next Module:** MODULE-11 (Subscriptions V2)

---

**MODULE 09 V2 VERIFICATION COMPLETE**
