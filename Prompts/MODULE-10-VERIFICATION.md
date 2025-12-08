# MODULE 10: BADGES & TRUST - VERIFICATION REPORT

**Module:** Badges & Trust  
**Total Tasks:** 8  
**Estimated Time:** ~21 hours  
**Status:** Ready for Implementation

---

## DELIVERABLES CHECKLIST

### Database Schema
- [ ] `badge_level` enum created (none, bronze, silver, gold, verified)
- [ ] `badge_level` column added to users table
- [ ] `badge_config` table created with thresholds
- [ ] `calculate_badge_level()` function created
- [ ] `auto_upgrade_badges` trigger created on trade completion
- [ ] Indexes created for badge queries

### Backend Services
- [ ] Badge calculation service (`badgeService.ts`)
- [ ] Badge threshold configuration
- [ ] Auto-upgrade logic on trade completion
- [ ] Manual badge assignment (admin)
- [ ] Stripe Identity stub (deferred)

### UI Components
- [ ] Badge icon component (`BadgeIcon.tsx`)
- [ ] Badge display in user profile
- [ ] Badge display on listings (seller badge)
- [ ] Badge requirements tooltip
- [ ] Admin badge threshold editor

### Admin Panel
- [ ] Badge config management UI
- [ ] Manual badge assignment interface
- [ ] Badge statistics dashboard
- [ ] Audit log for manual assignments

---

## FEATURE FLOWS TO TEST

### 1. Auto Badge Upgrade on Trade Completion
**Flow:**
1. User completes trade (buyer confirms receipt)
2. Trigger `auto_upgrade_badges` fires
3. System calls `calculate_badge_level()` for both users
4. Compare current badge vs calculated badge
5. If upgrade warranted → Update user.badge_level
6. Log badge change
7. Send notification to user

**Expected Results:**
- ✓ Badge upgraded automatically
- ✓ User notified of upgrade
- ✓ Badge visible in profile
- ✓ Change logged in admin_activity_log

**Edge Cases:**
- No upgrade needed → No action taken
- Downgrade not allowed → Badge stays same
- Multiple trades simultaneously → All processed
- Trade cancelled → No badge change

---

### 2. Badge Level Calculation
**Flow:**
1. System retrieves user stats:
   - `completed_trades` count
   - `avg_rating` from reviews
   - `account_age` in days
2. Compare against `badge_config` thresholds
3. Determine highest badge level earned
4. Return badge level

**Expected Results:**
- ✓ Bronze: 5+ trades, 4.0+ rating, 30+ days
- ✓ Silver: 20+ trades, 4.5+ rating, 90+ days
- ✓ Gold: 50+ trades, 4.8+ rating, 180+ days
- ✓ None: Below all thresholds

**Edge Cases:**
- New user (0 trades) → None
- High trades, low rating → Lower badge than expected
- All trades cancelled → 0 completed_trades
- Missing reviews → avg_rating = 0

---

### 3. Admin Manual Badge Assignment
**Flow:**
1. Admin opens user profile in admin panel
2. Clicks "Assign Badge" button
3. Selects badge level (including "verified")
4. Enters reason for manual assignment
5. Confirms action
6. Badge updated in database
7. Action logged in admin_activity_log
8. User notified of badge change

**Expected Results:**
- ✓ Badge updated immediately
- ✓ Manual override flag set
- ✓ Auto-upgrade disabled for manually assigned badges
- ✓ Admin action logged

**Edge Cases:**
- Assign lower badge → Warning shown, allowed
- Assign verified → Admin only, requires justification
- Remove badge → Set to "none"
- User has auto-upgraded badge → Override allowed

---

### 4. Badge Display in UI
**Flow:**
1. User profile loaded
2. Badge icon component rendered based on badge_level
3. Tooltip shows badge requirements on hover
4. Badge displayed on all user listings

**Expected Results:**
- ✓ Correct icon shown (bronze/silver/gold/verified)
- ✓ Tooltip shows requirements
- ✓ Badge visible on listings
- ✓ No badge if level = "none"

**Edge Cases:**
- Badge = null → Treat as "none"
- Unknown badge level → Show default icon
- Very long badge name → Truncate display

---

### 5. Badge Threshold Configuration (Admin)
**Flow:**
1. Admin opens badge config UI
2. Views current thresholds for each level
3. Edits threshold values (trades, rating, days)
4. Saves changes
5. Changes applied to future calculations
6. Existing badges not retroactively changed

**Expected Results:**
- ✓ Thresholds saved to badge_config table
- ✓ Future badge calculations use new thresholds
- ✓ Change logged in admin_activity_log
- ✓ UI shows updated values

**Edge Cases:**
- Set threshold to 0 → Warning shown
- Overlapping thresholds (silver < bronze) → Validation error
- Negative values → Validation error
- Very high thresholds (1000+ trades) → Warning shown

---

### 6. Stripe Identity Integration (Deferred)
**Status:** Post-MVP feature (BADGE-007)  
**Flow:**
1. User requests "verified" badge
2. Redirected to Stripe Identity verification
3. User submits ID document
4. Stripe verifies identity
5. On success → Badge upgraded to "verified"
6. On failure → User notified, can retry

**Implementation Notes:**
- Deferred to Post-MVP per task BADGE-007
- Stub created for future implementation
- Manual "verified" assignment by admin in interim

---

### 7. Badge Requirements Display
**Flow:**
1. User opens profile or badge info screen
2. Current badge shown
3. Next badge requirements displayed
4. Progress indicators shown (e.g., "15/20 trades for Silver")

**Expected Results:**
- ✓ Current badge clearly labeled
- ✓ Next badge requirements shown
- ✓ Progress towards next badge visible
- ✓ Motivates users to trade more

**Edge Cases:**
- Already at highest badge → Show "Max level achieved"
- Manually assigned badge → Hide progress
- Missing data → Show "Complete your profile"

---

### 8. Badge Statistics Dashboard (Admin)
**Flow:**
1. Admin opens analytics dashboard
2. Views badge distribution chart
3. Sees breakdown: X users with bronze, Y with silver, etc.
4. Filters by date range
5. Exports data

**Expected Results:**
- ✓ Chart shows badge distribution
- ✓ Total user count per badge
- ✓ Percentage breakdown
- ✓ Historical trends (if tracked)

**Edge Cases:**
- All users = none → Show message to encourage engagement
- Only 1 verified user → Highlight exclusivity

---

## DATABASE SCHEMA VERIFICATION

### badge_level enum
```sql
CREATE TYPE badge_level AS ENUM ('none', 'bronze', 'silver', 'gold', 'verified');
```

**Verify:**
- [ ] Enum created
- [ ] All 5 levels defined
- [ ] Cannot insert invalid values

---

### users table (UPDATE)
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS badge_level badge_level DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS badge_manually_assigned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_assigned_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS badge_assigned_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX users_badge_level_idx ON users(badge_level);
```

**Verify:**
- [ ] Column exists with correct type
- [ ] Default value = 'none'
- [ ] Manual assignment tracking fields present
- [ ] Index created for badge queries

---

### badge_config table
```sql
CREATE TABLE badge_config (
  level badge_level PRIMARY KEY,
  min_completed_trades INTEGER NOT NULL,
  min_avg_rating DECIMAL(2, 1) NOT NULL,
  min_account_age_days INTEGER NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default thresholds
INSERT INTO badge_config VALUES
  ('bronze', 5, 4.0, 30, 'Reliable trader'),
  ('silver', 20, 4.5, 90, 'Experienced trader'),
  ('gold', 50, 4.8, 180, 'Elite trader'),
  ('verified', 0, 0.0, 0, 'Identity verified via Stripe');
```

**Verify:**
- [ ] Table created
- [ ] Default thresholds seeded
- [ ] Admin can update thresholds via UI
- [ ] Updated_at timestamp working

---

### calculate_badge_level() function
```sql
CREATE OR REPLACE FUNCTION calculate_badge_level(p_user_id UUID)
RETURNS badge_level AS $$
DECLARE
  v_trades INTEGER;
  v_rating DECIMAL(2,1);
  v_account_age INTEGER;
BEGIN
  -- Calculate user stats
  SELECT 
    COUNT(*) FILTER (WHERE status = 'completed'),
    COALESCE(AVG(rating), 0),
    EXTRACT(DAY FROM NOW() - created_at)
  INTO v_trades, v_rating, v_account_age
  FROM users
  LEFT JOIN trades ON trades.buyer_id = p_user_id OR trades.seller_id = p_user_id
  LEFT JOIN reviews ON reviews.reviewed_user_id = p_user_id
  WHERE users.id = p_user_id
  GROUP BY users.created_at;

  -- Determine badge level
  IF v_trades >= 50 AND v_rating >= 4.8 AND v_account_age >= 180 THEN
    RETURN 'gold';
  ELSIF v_trades >= 20 AND v_rating >= 4.5 AND v_account_age >= 90 THEN
    RETURN 'silver';
  ELSIF v_trades >= 5 AND v_rating >= 4.0 AND v_account_age >= 30 THEN
    RETURN 'bronze';
  ELSE
    RETURN 'none';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Verify:**
- [ ] Function created
- [ ] Uses badge_config thresholds
- [ ] Returns correct badge level
- [ ] Handles missing data (0 trades, no reviews)

---

### auto_upgrade_badges trigger
```sql
CREATE OR REPLACE FUNCTION auto_upgrade_badges()
RETURNS TRIGGER AS $$
DECLARE
  buyer_new_badge badge_level;
  seller_new_badge badge_level;
BEGIN
  -- Only run on trade completion
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Calculate badges for buyer
    SELECT calculate_badge_level(NEW.buyer_id) INTO buyer_new_badge;
    
    -- Calculate badges for seller
    SELECT calculate_badge_level(
      (SELECT user_id FROM items WHERE id = NEW.item_id)
    ) INTO seller_new_badge;
    
    -- Update buyer badge if higher and not manually assigned
    UPDATE users
    SET badge_level = buyer_new_badge
    WHERE id = NEW.buyer_id
      AND badge_manually_assigned = FALSE
      AND badge_level < buyer_new_badge;
    
    -- Update seller badge if higher and not manually assigned
    UPDATE users
    SET badge_level = seller_new_badge
    WHERE id = (SELECT user_id FROM items WHERE id = NEW.item_id)
      AND badge_manually_assigned = FALSE
      AND badge_level < seller_new_badge;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_upgrade_badges_trigger
  AFTER UPDATE OF status ON trades
  FOR EACH ROW
  EXECUTE FUNCTION auto_upgrade_badges();
```

**Verify:**
- [ ] Trigger created
- [ ] Fires only on trade completion
- [ ] Updates both buyer and seller badges
- [ ] Respects manual assignment flag
- [ ] Only upgrades (never downgrades)

---

## TESTING CHECKLIST

### Unit Tests
- [ ] `calculateBadgeLevel()` - Returns correct badge for given stats
- [ ] `calculateBadgeLevel()` - Handles 0 trades (returns "none")
- [ ] `calculateBadgeLevel()` - Handles missing reviews (rating = 0)
- [ ] Badge comparison logic (bronze < silver < gold)
- [ ] Threshold validation (no negative values)

### Integration Tests
- [ ] Complete trade → Both users' badges recalculated
- [ ] Badge upgrade → User notified
- [ ] Manual assignment → Auto-upgrade disabled
- [ ] Threshold change → Future calculations use new values

### E2E Tests
- [ ] New user → Badge = "none"
- [ ] Complete 5 trades with 4.0+ rating → Badge upgrades to bronze
- [ ] Complete 20 trades with 4.5+ rating → Badge upgrades to silver
- [ ] Admin assigns gold manually → Badge stays gold regardless of stats
- [ ] User profile shows correct badge icon

### Performance Tests
- [ ] Badge calculation for 10K users → Completes in <30s
- [ ] Auto-upgrade trigger on 100 concurrent trades → No deadlocks

---

## CONFIGURATION SETTINGS

### badge_config table (default values)
| Level | Min Trades | Min Rating | Min Account Age | Description |
|-------|-----------|------------|-----------------|-------------|
| bronze | 5 | 4.0 | 30 days | Reliable trader |
| silver | 20 | 4.5 | 90 days | Experienced trader |
| gold | 50 | 4.8 | 180 days | Elite trader |
| verified | 0 | 0.0 | 0 days | Identity verified |

**Verify:**
- [ ] All levels configured
- [ ] Admin can edit via UI
- [ ] Changes logged
- [ ] Validated on save (no overlaps)

---

## SECURITY CONSIDERATIONS

### RLS Policies
```sql
-- Anyone can view badges (public info)
CREATE POLICY "Anyone can view user badges"
  ON users FOR SELECT
  USING (TRUE);

-- Only admins can manually assign badges
CREATE POLICY "Admins can update badges"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users admin
      WHERE admin.id = auth.uid()
      AND admin.role = 'admin'
    )
  )
  WITH CHECK (badge_manually_assigned = TRUE);
```

**Verify:**
- [ ] Badges publicly visible (for trust display)
- [ ] Only admins can manually assign
- [ ] Auto-upgrade bypasses RLS (service role)
- [ ] Manual assignment requires admin role

### Anti-Gaming Measures
- [ ] Cannot self-review to boost rating
- [ ] Cancelled trades don't count toward badge
- [ ] Account age prevents instant badge farming
- [ ] Admin audit log tracks manual assignments

---

## COST ANALYSIS

**Monthly Costs (10,000 users):**

**Database Operations:**
- Badge calculations: ~10K/month (on trade completions)
- Badge config queries: Minimal
- **Cost: $0** (included in Supabase free tier)

**Stripe Identity (Post-MVP):**
- $1.50 per verification
- Estimated 100 verifications/month = $150
- **Cost: $0** (MVP), **$150/month** (Post-MVP)

**Total: $0/month (MVP)**

---

## ANALYTICS EVENTS

Track these events in Amplitude:

1. `badge_upgraded` - User's badge upgraded (level, from → to)
2. `badge_manually_assigned` - Admin manually assigned badge
3. `badge_requirements_viewed` - User viewed badge requirements
4. `badge_config_changed` - Admin changed thresholds
5. `badge_distribution_viewed` - Admin viewed badge stats
6. `verified_badge_requested` - User initiated Stripe Identity (Post-MVP)

---

## MIGRATION SCRIPT SUMMARY

**Migration Files:**
1. `033_badges_system.sql` - Badge enum, columns, config table
2. `034_badge_calculation.sql` - calculate_badge_level() function
3. `035_auto_badge_upgrade.sql` - auto_upgrade_badges trigger

**Rollback Plan:**
```sql
DROP TRIGGER IF EXISTS auto_upgrade_badges_trigger ON trades;
DROP FUNCTION IF EXISTS auto_upgrade_badges();
DROP FUNCTION IF EXISTS calculate_badge_level(UUID);
DROP TABLE IF EXISTS badge_config;
ALTER TABLE users 
  DROP COLUMN IF EXISTS badge_level,
  DROP COLUMN IF EXISTS badge_manually_assigned,
  DROP COLUMN IF EXISTS badge_assigned_by,
  DROP COLUMN IF EXISTS badge_assigned_at;
DROP TYPE IF EXISTS badge_level;
```

---

## KNOWN LIMITATIONS

1. **No Stripe Identity in MVP** - Verified badges assigned manually by admin
2. **No Badge Downgrade** - Badges never decrease (only upgrade)
3. **No Badge History** - Cannot see previous badges
4. **No Badge Sharing** - No social sharing of badge achievements
5. **Fixed Thresholds** - All users have same requirements (no tiers)

---

## POST-MVP ENHANCEMENTS

1. **Stripe Identity Integration** (BADGE-007) - Automated ID verification
2. **Badge Expiration** - Require maintaining stats to keep badge
3. **Badge Levels 2.0** - Platinum, Diamond tiers
4. **Specialized Badges** - Category expert badges (Toys, Electronics, etc.)
5. **Badge Challenges** - Time-limited achievement badges
6. **Badge Showcase** - Display multiple badges earned
7. **Badge Sharing** - Share badge upgrades on social media
8. **Badge NFTs** - Mint badges as NFTs (blockchain verification)
9. **Badge Rewards** - Perks for badge holders (priority support, etc.)
10. **Dynamic Thresholds** - Adjust based on platform activity

---

## SIGN-OFF CHECKLIST

**Before marking module complete:**
- [ ] All database migrations run successfully
- [ ] Badge calculation function tested
- [ ] Auto-upgrade trigger working
- [ ] Badge icons display correctly in UI
- [ ] Admin badge assignment functional
- [ ] Badge config UI working
- [ ] Manual assignment logging verified
- [ ] All unit tests passing (badge calculation)
- [ ] Integration tests passing (auto-upgrade)
- [ ] E2E tests passing (UI display)
- [ ] Performance acceptable (<100ms for badge display)
- [ ] Security audit passed (RLS policies)
- [ ] Analytics events firing
- [ ] Documentation complete

---

**Module Status:** ✅ READY FOR IMPLEMENTATION  
**Blocker Issues:** None  
**Dependencies:** MODULE-02 (Auth), MODULE-06 (Trade Flow), MODULE-08 (Reviews)  
**Next Module:** MODULE-11 (Subscriptions)
