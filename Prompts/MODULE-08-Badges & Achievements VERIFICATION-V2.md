# MODULE-08 VERIFICATION CHECKLIST (V2)

**Module:** Badges & Achievements  
**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Last Updated:** [Auto-generated timestamp]

---

## VERIFICATION CHECKLIST

### 1. BADGE SCHEMA (BADGES-V2-001)

- [ ] Migration `080_badges_v2.sql` applied
  - [ ] `badges` table created
  - [ ] `user_badges` junction table created
  - [ ] Unique constraint on (user_id, badge_id)
  - [ ] Seed badges inserted (13 badges)

- [ ] TypeScript types
  - [ ] Badge interface
  - [ ] UserBadge interface

### 2. SP MILESTONE TRIGGERS (BADGES-V2-002)

- [ ] Migration `081_badge_triggers.sql` applied
  - [ ] Function `award_badge_if_eligible` created
  - [ ] Function `check_sp_badges` created
  - [ ] Trigger `trigger_check_sp_badges` on sp_ledger table

- [ ] Tests passing
  - [ ] Earning 10 SP awards "SP Earner - Bronze"
  - [ ] Spending 50 SP awards "SP Spender - Silver"
  - [ ] No duplicate badge awards
  - [ ] Trigger performance < 50ms

### 3. TRADE & SUBSCRIPTION BADGES (BADGES-V2-003)

- [ ] Migration `082_trade_badges.sql` applied
  - [ ] Function `check_trade_badges` created
  - [ ] Trigger `trigger_check_trade_badges` on trades table

- [ ] Edge function `award-tenure-badges` deployed (cron)
  - [ ] Runs daily
  - [ ] Awards subscription tenure badges

- [ ] Tests passing
  - [ ] 1st trade awards "First Trade" badge
  - [ ] 30 days subscription awards "1-Month Subscriber"

### 4. BADGE DISPLAY UI (BADGES-V2-004)

- [ ] Service `getUserBadges` implemented
- [ ] Service `getBadgeLeaderboard` implemented
- [ ] RPC `get_badge_leaderboard` deployed
- [ ] UI `BadgeShowcase` component
  - [ ] Displays on user profiles
  - [ ] Shows badge icons and names
- [ ] Leaderboard UI (optional)

- [ ] All tests passing in CI/CD

---

**End of MODULE-08-VERIFICATION-V2.md**