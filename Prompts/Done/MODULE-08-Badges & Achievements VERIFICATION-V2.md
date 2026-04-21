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

### 5. ADMIN CONFIGURATION & AUDIT (BADGES-V2-005)

- [ ] Migration `084_badge_admin_config.sql` applied
  - [ ] `badges` table updated with `is_active`, `sort_order`, `is_archived`
  - [ ] `badge_config_history` table created
  - [ ] `badge_audit_logs` table created
- [ ] Audit logs captured for config changes

### 6. ICON MANAGEMENT (BADGES-V2-006)

- [ ] Supabase Storage bucket `badge-icons` created
- [ ] `uploadBadgeIcon` service implemented
- [ ] Icons display correctly using storage URLs

### 7. ADMIN PORTAL UI (BADGES-V2-007)

- [ ] Badge Management page functional
  - [ ] Can enable/disable badges
  - [ ] Can update thresholds and titles
- [ ] Manual Awarding tool functional
- [ ] Audit log viewer integrated

### 8. RETROACTIVE AWARDING (BADGES-V2-008)

- [ ] Migration `085_retroactive_badges.sql` applied
- [ ] RPC `retroactive_award_badges` functional
- [ ] Verification: Lowering threshold awards badges to eligible users automatically

### 9. SANDBOX & REAL-TIME (BADGES-V2-009)

- [ ] Admin Sandbox page functional
  - [ ] Can simulate SP and trade events
- [ ] Mobile real-time sync implemented
  - [ ] Real-time celebration/modal displays when badge is awarded

- [ ] All tests passing in CI/CD

---

**End of MODULE-08-VERIFICATION-V2.md**