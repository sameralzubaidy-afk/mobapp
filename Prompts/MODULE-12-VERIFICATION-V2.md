# MODULE-12: ADMIN PANEL V2 - VERIFICATION CHECKLIST

**Version:** 2.0  
**Last Updated:** December 7, 2025  
**Module Reference:** MODULE-12-ADMIN-V2.md

---

## VERIFICATION OVERVIEW

This checklist ensures all admin panel features are properly implemented, secure, and integrated with V2 subscription-gated Swap Points model.

**Critical Success Factors:**
- All admin actions require role verification
- Complete audit trail in admin_activity_log
- Subscription/SP/Badge operations work correctly
- Revenue metrics calculate accurately
- Admin UI is intuitive and performant

---

## SECTION 1: ADMIN AUTHENTICATION & AUTHORIZATION (ADMIN-V2-001)

### Database Schema
- [ ] `user_role` enum created with values: 'user', 'admin', 'moderator'
- [ ] `role` column added to users table with default 'user'
- [ ] Index `users_role_idx` created on users(role)
- [ ] `admin_activity_log` table created with all required columns
- [ ] Indexes created on admin_activity_log (admin_id, entity_type+entity_id, created_at)

### RLS Policies
- [ ] Admin activity log RLS enabled
- [ ] "Admins can view all activity logs" policy works
- [ ] "Admins can insert activity logs" policy works
- [ ] Non-admin users cannot access admin_activity_log

### Admin Login Flow
- [ ] Admin can login with valid email/password
- [ ] Non-admin user login is rejected with "Access denied" error
- [ ] Admin session includes user role in response
- [ ] Failed authentication returns appropriate error message
- [ ] Admin session persists across page reloads

### Protected Routes
- [ ] `/admin/*` routes redirect non-authenticated users to login
- [ ] Non-admin users are redirected even if authenticated
- [ ] Admin dashboard loads successfully for admin users
- [ ] Admin logout clears session completely

### Activity Logging
- [ ] `log_admin_action` RPC verifies admin role before insertion
- [ ] Activity log entries include all required fields (admin_id, action_type, entity_type, entity_id, details, notes)
- [ ] Activity log queries filter by admin_id correctly
- [ ] Activity log queries filter by entity_type/entity_id correctly
- [ ] Activity log displays in reverse chronological order

### Testing
- [ ] Unit tests pass for AdminAuthService.loginAdmin()
- [ ] Unit tests pass for AdminAuthService.getCurrentAdmin()
- [ ] Unit tests verify non-admin rejection
- [ ] Unit tests verify admin role check in RPCs

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 2: SUBSCRIPTION MANAGEMENT (ADMIN-V2-002)

### Database Functions
- [ ] `admin_extend_trial` RPC created and working
- [ ] `admin_cancel_subscription` RPC created and working
- [ ] `get_subscription_analytics` RPC created and working
- [ ] All RPCs verify admin role before execution

### Trial Extension
- [ ] Admin can extend trial by specified number of days
- [ ] Trial extension updates `trial_ends_at` correctly
- [ ] Trial extension can resurrect cancelled subscriptions (status → 'trial')
- [ ] Trial extension logged in admin_activity_log with previous/new dates
- [ ] Trial extension returns success response with new trial end date

### Subscription Cancellation
- [ ] Admin can cancel subscription successfully
- [ ] Cancellation sets status to 'cancelled' and sets cancelled_at timestamp
- [ ] Cancellation with refund flag processes correctly
- [ ] SP wallet frozen when subscription cancelled (status → 'frozen')
- [ ] Cancellation logged in admin_activity_log with refund details

### Subscription Analytics
- [ ] Analytics correctly count subscriptions by status (trial/active/grace/cancelled)
- [ ] Trial conversion rate calculated accurately
- [ ] Churn rate calculated correctly (cancelled / (active + cancelled))
- [ ] MRR calculated as active_subscribers × $7.99
- [ ] Analytics filter by date range works correctly

### Subscription Search
- [ ] Admin can search subscriptions by user email
- [ ] Admin can search subscriptions by user ID
- [ ] Search results include user details (email, full_name)
- [ ] Search limited to 20 results
- [ ] Search returns results in descending order by created_at

### Subscription Dashboard UI
- [ ] Dashboard displays real-time subscription counts
- [ ] Metric cards show correct values for all statuses
- [ ] Trial conversion rate displays as percentage
- [ ] Churn rate displays as percentage
- [ ] MRR displays with $ currency symbol
- [ ] Search functionality works correctly
- [ ] Trial extension form validates required fields
- [ ] Cancel subscription shows confirmation dialog
- [ ] Cancel with refund shows refund amount
- [ ] UI updates after successful admin action

### Cross-Module Integration
- [ ] Trial extension integrates with MODULE-11 (Subscriptions)
- [ ] Cancellation freezes SP wallet (MODULE-09)
- [ ] Activity logs track subscription changes

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 3: SP WALLET OPERATIONS (ADMIN-V2-003)

### Database Functions
- [ ] `admin_adjust_sp_wallet` RPC created and working
- [ ] `admin_toggle_sp_wallet_status` RPC created and working
- [ ] `get_sp_economy_metrics` RPC created and working
- [ ] All RPCs verify admin role before execution

### SP Wallet Adjustments
- [ ] Admin can add SP to wallet (positive amount)
- [ ] Admin can deduct SP from wallet (negative amount)
- [ ] Negative balance prevention works (raises exception)
- [ ] SP adjustment creates ledger entry with 'admin_adjustment' reason
- [ ] Ledger entry includes admin metadata (admin_id, adjustment_reason, admin_notes)
- [ ] Wallet balance updated correctly after adjustment
- [ ] SP adjustment logged in admin_activity_log

### Wallet Status Management
- [ ] Admin can activate wallet (status → 'active')
- [ ] Admin can freeze wallet (status → 'frozen')
- [ ] Admin can suspend wallet (status → 'suspended')
- [ ] Status change validates allowed values
- [ ] Status change logged in admin_activity_log
- [ ] Frozen wallets cannot earn/spend SP (enforced by MODULE-09 rules)

### SP Economy Metrics
- [ ] Total SP earned calculated correctly (sum of 'earned' transactions)
- [ ] Total SP spent calculated correctly (sum of 'spent' transactions)
- [ ] Current circulation equals sum of all active wallet balances
- [ ] Active wallets count accurate
- [ ] Average balance calculated correctly (excluding zero balances)
- [ ] Admin adjustments count tracked for specified period
- [ ] Admin adjustments total amount accurate

### Wallet Inspection
- [ ] Admin can view wallet details by user ID
- [ ] Wallet details include user information (email, full_name)
- [ ] Ledger history displays last 100 transactions
- [ ] Ledger entries show transaction type, amount, balance_after, reason
- [ ] Admin adjustment entries show adjustment_reason from metadata
- [ ] Ledger sorted by created_at descending

### SP Wallet Dashboard UI
- [ ] Economy metrics display correctly (earned, spent, circulation, active wallets, avg balance)
- [ ] Admin adjustments metrics show count and total amount
- [ ] Wallet search finds user by ID
- [ ] Wallet details panel displays current balance and status
- [ ] Adjustment form validates amount and reason
- [ ] Adjustment form prevents empty reason
- [ ] Status toggle buttons disabled when already in that status
- [ ] Ledger table displays all transactions with formatting
- [ ] Transaction type color-coded (green for earned, red for spent)

### Cross-Module Integration
- [ ] SP adjustments create ledger entries (MODULE-09)
- [ ] Wallet status changes affect earning/spending ability (MODULE-09)
- [ ] Activity logs track all SP operations

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 4: BADGE ADMINISTRATION (ADMIN-V2-004)

### Database Functions
- [ ] `admin_award_badge` RPC created and working
- [ ] `admin_revoke_badge` RPC created and working
- [ ] `get_badge_statistics` RPC created and working
- [ ] `get_badge_distribution` RPC created and working
- [ ] All RPCs verify admin role before execution

### Manual Badge Awards
- [ ] Admin can award badge to user
- [ ] Award creates user_badges entry with awarded_at timestamp
- [ ] Award includes admin metadata (awarded_by_admin, admin_id, award_reason, admin_notes)
- [ ] Cannot award duplicate badge to same user (raises exception)
- [ ] Badge award logged in admin_activity_log
- [ ] Award returns success with badge name

### Manual Badge Revocations
- [ ] Admin can revoke badge from user
- [ ] Revocation sets revoked_at timestamp (soft delete)
- [ ] Revocation adds metadata (revoked_by_admin, admin_id, revoke_reason, admin_notes)
- [ ] Cannot revoke already-revoked badge (raises exception)
- [ ] Badge revocation logged in admin_activity_log
- [ ] Revoke returns success with badge name

### Badge Statistics
- [ ] Total badge types count accurate
- [ ] Total awards count includes all user_badges
- [ ] Active awards count excludes revoked badges
- [ ] Revoked awards count accurate
- [ ] Admin-awarded badges count accurate (metadata flag check)
- [ ] Auto-awarded badges count accurate

### Badge Distribution
- [ ] Distribution query returns all badge types
- [ ] Award count per badge accurate (active badges only)
- [ ] Rarity score calculated correctly (100 - (awards / users * 100))
- [ ] Distribution sorted by rarity (rarest first)
- [ ] Distribution includes badge icon

### Badge Dashboard UI
- [ ] Statistics cards display correct values
- [ ] Badge distribution table shows all badges
- [ ] Rarity displayed as percentage with visual bar
- [ ] Badge icons render correctly
- [ ] User search loads user's current badges
- [ ] Current badges section shows active badges only
- [ ] Available badges section excludes already-awarded badges
- [ ] Award button prompts for reason
- [ ] Revoke button prompts for reason and confirmation
- [ ] UI updates after award/revoke action

### Cross-Module Integration
- [ ] Manual awards integrate with MODULE-08 badge schema
- [ ] Auto-awarded badges (from triggers) display correctly
- [ ] Activity logs track all badge operations

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 5: REVENUE & ANALYTICS (ADMIN-V2-005)

### Database Functions
- [ ] `get_revenue_metrics` RPC created and working
- [ ] `get_engagement_metrics` RPC created and working
- [ ] All RPCs verify admin role before execution

### Subscription Revenue Metrics
- [ ] Active subscribers count accurate (trial + active status)
- [ ] MRR calculated correctly (active_subscribers × $7.99)
- [ ] ARR calculated correctly (MRR × 12)
- [ ] Revenue metrics filter by date range

### Transaction Fee Revenue
- [ ] Total transaction fee revenue calculated for period
- [ ] Subscriber transaction fees accurate ($0.99 per trade)
- [ ] Non-subscriber transaction fees accurate ($2.99 per trade)
- [ ] Transaction fees join with subscriptions to determine subscriber status
- [ ] Only completed trades counted in fee revenue

### Total Revenue & ARPU
- [ ] Total revenue combines subscription + transaction fees
- [ ] Total users count accurate
- [ ] ARPU calculated correctly (total_revenue / total_users)
- [ ] ARPU handles division by zero (returns 0)

### Engagement Metrics
- [ ] DAU (Daily Active Users) calculated correctly
- [ ] MAU (Monthly Active Users) calculated correctly
- [ ] DAU/MAU ratio calculated as percentage
- [ ] Engagement metrics separated by subscription status
- [ ] Subscriber DAU/MAU counts accurate
- [ ] Non-subscriber DAU/MAU counts accurate

### Revenue Dashboard UI
- [ ] Subscription revenue cards display MRR, ARR, active subscribers
- [ ] Transaction fee cards show total, subscriber fees, non-subscriber fees
- [ ] Total revenue card shows combined revenue
- [ ] ARPU card displays average revenue per user
- [ ] Engagement cards show DAU, MAU, ratio, cohort breakdown
- [ ] All currency values formatted with $ symbol
- [ ] All percentages formatted with % symbol
- [ ] Metric cards use appropriate color coding

### Performance
- [ ] Revenue metrics query executes in < 500ms
- [ ] Engagement metrics query executes in < 500ms
- [ ] Dashboard loads all metrics in parallel
- [ ] No N+1 query issues

### Cross-Module Integration
- [ ] Revenue metrics integrate with MODULE-11 (Subscriptions)
- [ ] Transaction fees integrate with MODULE-06 (Trade Flow)
- [ ] Engagement metrics consider subscription status

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 6: USER MANAGEMENT DASHBOARD (ADMIN-V2-006)

### Database Schema
- [ ] `account_status` enum created with values: 'active', 'suspended', 'banned'
- [ ] `account_status` column added to `users` table with default 'active'
- [ ] `suspended_at`, `suspended_by`, `suspension_reason` columns added to `users`
- [ ] `deleted_at`, `deleted_by`, `deletion_reason` columns added to `users`
- [ ] `users_account_status_idx` index created on `users(account_status)`
- [ ] `users_deleted_at_idx` partial index created on `users(deleted_at) WHERE deleted_at IS NULL`

### Database Functions (RPCs)
- [ ] `admin_list_users` RPC created and returns paginated results
- [ ] `admin_get_user_detail` RPC created and returns full profile + sub + SP + trades + badges + log
- [ ] `admin_suspend_user` RPC created — sets `account_status = 'suspended'`, logs action
- [ ] `admin_unsuspend_user` RPC created — sets `account_status = 'active'`, clears suspension columns, logs action
- [ ] `admin_delete_user` RPC created — sets `deleted_at`, freezes SP wallet, logs action
- [ ] `admin_get_user_analytics` RPC created — returns counts, DAU/MAU, subscription breakdown
- [ ] All RPCs verify `role = 'admin'` before execution
- [ ] All RPCs use table-qualified column references (no ambiguous column errors)
- [ ] All RPCs use `p_` prefix for parameters and `v_` prefix for local variables

### Edge Function
- [ ] `admin-trigger-password-reset` Edge Function deployed
- [ ] Function verifies caller JWT and admin role before proceeding
- [ ] Function uses service role key only for fetching user email and sending reset
- [ ] Function logs admin action in `admin_activity_log` via RPC
- [ ] Non-admin callers receive 403 Forbidden
- [ ] Missing `target_user_id` returns 400 Bad Request
- [ ] Unknown user returns 404 Not Found

### User Analytics Header
- [ ] Total users count excludes soft-deleted users
- [ ] Active users count reflects `account_status = 'active'`
- [ ] Suspended users count reflects `account_status = 'suspended'`
- [ ] Deleted users count reflects `deleted_at IS NOT NULL`
- [ ] New this month count uses `date_trunc('month', now())`
- [ ] DAU derived from `auth.users.last_sign_in_at >= now() - interval '1 day'`
- [ ] MAU derived from `auth.users.last_sign_in_at >= now() - interval '30 days'`
- [ ] Subscription breakdown aggregates all statuses including 'none' (free users)

### User Table & Filtering
- [ ] Table displays: avatar, full name, email, phone, subscription status badge, account status badge, registered date, last login date, trade count, SP balance, badge count
- [ ] Search matches on `full_name`, `email`, and `phone` (case-insensitive ILIKE)
- [ ] Account status filter returns only matching records
- [ ] Subscription status filter correctly handles 'none' (users with no subscription row)
- [ ] Pagination shows correct count and total pages
- [ ] Page navigation works (prev/next, disables at boundaries)
- [ ] Deleted users are excluded from all list results

### User Detail Panel
- [ ] Identity section shows: user ID, phone, date of birth, role, account status, registered date, last login, email verified flag, phone verified flag
- [ ] Suspension reason and date displayed when account is suspended
- [ ] Subscription section shows: status badge, started date, trial end date, period end date, cancelled at date
- [ ] Free user shows "No subscription record found" message
- [ ] SP wallet section shows: balance, wallet status, lifetime earned, lifetime spent
- [ ] Trade activity section shows: total completed, as seller, as buyer, last trade date
- [ ] Badges section lists all active (non-revoked) badge names
- [ ] Recent admin activity log shows last 10 entries with action type, performed-by email, timestamp, and notes

### Admin Actions
- [ ] Suspend action prompts for reason, rejects empty reason, shows confirmation, calls `admin_suspend_user`
- [ ] Unsuspend action prompts for reason, rejects empty reason, calls `admin_unsuspend_user`
- [ ] Suspend/unsuspend button toggles based on current `account_status`
- [ ] Password reset button shows confirmation dialog, calls Edge Function, shows success alert
- [ ] Delete action prompts for reason, rejects empty reason, shows ⚠️ confirmation, calls `admin_delete_user`
- [ ] All actions refresh the user list and close the panel on success

### Security
- [ ] Admin cannot delete their own account (RPC raises exception)
- [ ] All user management RPCs reject non-admin callers with `RAISE EXCEPTION`
- [ ] Edge Function rejects non-admin JWT with 403
- [ ] Suspension and deletion reasons stored in DB for audit trail
- [ ] All user management actions logged in `admin_activity_log` with entity_type = 'user'
- [ ] Service role key not exposed to client-side code

### Performance
- [ ] `admin_list_users` returns results in < 500ms for up to 10,000 users
- [ ] User analytics query executes in < 500ms
- [ ] User detail panel loads in < 1 second
- [ ] Analytics header and user list load in parallel on page mount

### Cross-Module Integration
- [ ] User detail subscription status pulled from MODULE-11 `subscriptions` table
- [ ] User detail SP wallet data pulled from MODULE-09 `sp_wallets` and `sp_transactions` tables
- [ ] User detail trade counts pulled from MODULE-06 `transactions` table
- [ ] User detail badges pulled from MODULE-08 `user_badges` and `badges` tables
- [ ] Deleting a user freezes SP wallet (MODULE-09)
- [ ] Activity logs track all user management actions (MODULE-12 audit trail)

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 7: UI THEME & LAYOUT REDESIGN (ADMIN-V2-007)

### Prerequisites
- [ ] `recharts` present in `p2p-kids-admin/package.json` dependencies
- [ ] `lucide-react` present in `p2p-kids-admin/package.json` dependencies
- [ ] Google Fonts (`Inter`) loading — OR swapped to `next/font/google`
- [ ] `tailwind.config.js` has no syntax errors (`yarn build` passes)

### Design Tokens: Tailwind Config
- [ ] `sidebar.bg` = `#3D1073` defined in extended colors
- [ ] `sidebar.active` = `#5A2D9C` defined in extended colors
- [ ] `brand.primary` = `#6C3CE1` defined in extended colors
- [ ] `brand.accent` = `#FF6B35` defined in extended colors
- [ ] `content.bg` = `#F2F0FB` defined in extended colors
- [ ] `card.bg` = `#FFFFFF` and `card.border` = `#F0EDF9` defined
- [ ] `text.primary`, `text.secondary`, `text.muted` defined
- [ ] `card` and `sidebar` entries added to `boxShadow` extension
- [ ] `w-sidebar` (256px) and `h-topbar` (64px) entries added

### Design Tokens: CSS Custom Properties
- [ ] `globals.css` imports `Inter` font
- [ ] All `--sidebar-*`, `--topbar-*`, `--brand-*`, `--content-bg`, `--card-*`, `--text-*` variables defined on `:root`
- [ ] CSS variables match Tailwind config values exactly
- [ ] Custom scrollbar styles applied (4px, transparent track, `--sidebar-muted` thumb)

### Design Tokens: TypeScript (theme.ts)
- [ ] `theme.colors` mirrors Tailwind config values
- [ ] `theme.iconColors` defines `purple`, `orange`, `green`, `blue` (each with `bg` + `icon` fields)
- [ ] `theme.subscriptionColors` defines all statuses: `trial`, `active`, `grace_period`, `cancelled`, `none`
- [ ] `theme.accountStatusColors` defines `active`, `suspended`, `banned`
- [ ] `theme.shadow.card` and `theme.shadow.sidebar` defined
- [ ] `IconColorKey` type exported and used by `MetricCard` props

### Sidebar Component (`Sidebar.tsx`)
- [ ] Sidebar background = `var(--sidebar-bg)` — deep purple `#3D1073`
- [ ] Sidebar is `position: fixed`, full screen height
- [ ] Expanded width = 256px; collapsed width = 64px
- [ ] Width transition is smooth (`transition-all duration-300`)
- [ ] Hamburger button at top-left toggles collapsed state
- [ ] Brand logo (gradient circle + text) visible when expanded, hidden when collapsed
- [ ] All 8 nav items render: Dashboard, Users, Subscriptions, SP Wallet, Badges, Revenue, Nodes, Config
- [ ] Each nav item has a Lucide icon + text label
- [ ] Active route highlighted with `var(--sidebar-active)` background
- [ ] Non-active items show white overlay on hover
- [ ] Nav labels and chevron arrows hidden when collapsed
- [ ] Nav items use `next/link` (not `router.push`)
- [ ] Icons visible in collapsed mode (icon-only)

### Top Navbar Component (`TopNavbar.tsx`)
- [ ] Navbar is `position: fixed`, top 0, left = sidebar width
- [ ] Height = 64px (`var(--topbar-height)`)
- [ ] Background = `#FFFFFF`, bottom border = `var(--topbar-border)`
- [ ] Search input with icon on the left renders correctly
- [ ] Brand name centered with gradient circle icon
- [ ] Notification bell visible on right with orange dot
- [ ] Admin name/avatar pill visible on right
- [ ] Three-dot menu icon visible
- [ ] `sidebarWidth` prop correctly offsets navbar left edge

### AdminShell Component (`AdminShell.tsx`)
- [ ] `AdminShell` is `'use client'`; `layout.tsx` is a Server Component
- [ ] `<main>` `paddingLeft` equals sidebarWidth in pixels (dynamic)
- [ ] `<main>` `paddingTop` = `var(--topbar-height)` (64px)
- [ ] Main background = `var(--content-bg)`
- [ ] Sidebar and main both animate on toggle without layout jump

### MetricCard Component (`MetricCard.tsx`)
- [ ] White background, `card-shadow`, rounded corners
- [ ] Icon in soft-tinted rounded square (background from `theme.iconColors[color].bg`)
- [ ] Icon color from `theme.iconColors[color].icon`
- [ ] Label = small uppercase text in icon accent color
- [ ] Value = large bold `text-primary`
- [ ] Trend: green for up, red for down
- [ ] `color` prop accepts: `purple`, `orange`, `green`, `blue`

### ChartCard Component (`ChartCard.tsx`)
- [ ] Matches MetricCard visual style (white, shadow, rounded)
- [ ] Title shows as bold heading
- [ ] Period filter dropdown works when `showPeriodFilter={true}`
- [ ] Dropdown options: Today, This week, This month, This year
- [ ] Active period highlighted in brand-primary
- [ ] `onPeriodChange` callback fires when period selected
- [ ] Chart container height controlled by `chartHeight` prop

### Dashboard Page
- [ ] Suspense skeleton shows while data loads (pulsing blocks)
- [ ] Row 1: 4 metric cards — Total Users (purple), Subscriptions (orange), Revenue (green), SP Circulating (blue)
- [ ] Row 2: 3 chart cards — Trade Categories (donut), Platform Visits (line), Revenue (area)
- [ ] Donut chart: correct segments and legend
- [ ] Line chart: `brand.primary` line, `brand.accent` dots
- [ ] Area chart: stacked subscription + fees with gradient fills
- [ ] Revenue summary shows total + 3 trend stats (Growth/Refund/Online)
- [ ] Recharts Tooltip styled to match design system (white background, brand border)

### Responsive Behavior
- [ ] Sidebar collapsed by default on screens < 768px
- [ ] Metric cards: 4-col → 2-col → 1-col at breakpoints
- [ ] Chart cards: 3-col → 1-col on small screens
- [ ] No horizontal scroll at any supported viewport

### Build Gate
- [ ] `cd p2p-kids-admin && yarn lint` exits code 0
- [ ] `cd p2p-kids-admin && yarn typecheck` (or `npx tsc --noEmit`) exits code 0
- [ ] `cd p2p-kids-admin && yarn build` exits code 0 (Next.js compile clean)
- [ ] No duplicate exported identifiers in any file
- [ ] No escaped JSX attribute quotes

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 8: SECURITY & AUDIT COMPLIANCE

### Role-Based Access Control
- [ ] All admin RPCs verify role = 'admin' before execution
- [ ] Non-admin users cannot call admin RPCs (exception raised)
- [ ] Admin role check uses SECURITY DEFINER functions safely
- [ ] No SQL injection vulnerabilities in admin queries

### Activity Logging
- [ ] All subscription actions logged (extend, cancel, refund)
- [ ] All SP wallet actions logged (adjust, status change)
- [ ] All badge actions logged (award, revoke)
- [ ] Activity logs include sufficient detail for audit
- [ ] Activity logs cannot be deleted (no DELETE policy)
- [ ] Activity logs timestamped with created_at

### Data Integrity
- [ ] SP wallet adjustments prevent negative balances
- [ ] Badge awards prevent duplicates
- [ ] Subscription cancellations atomic with SP wallet freeze
- [ ] All admin actions use transactions where needed

### PII Protection
- [ ] Admin activity logs don't expose sensitive user data
- [ ] User searches return minimal required information
- [ ] Admin dashboard doesn't log PII to client console

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 9: CROSS-MODULE INTEGRATION

### MODULE-11 (Subscriptions V2)
- [ ] Admin can extend trials for any subscription
- [ ] Admin can cancel subscriptions with proper status updates
- [ ] Subscription analytics accurate across all statuses
- [ ] Trial conversion rate reflects actual user behavior
- [ ] User detail panel shows correct subscription status and dates (ADMIN-V2-006)

### MODULE-09 (Swap Points V2)
- [ ] Admin SP adjustments create proper ledger entries
- [ ] Wallet status changes enforce earning/spending rules
- [ ] SP economy metrics match ledger data
- [ ] Frozen wallets cannot transact

### MODULE-08 (Badges V2)
- [ ] Admin-awarded badges display alongside auto-awarded badges
- [ ] Badge revocations soft delete (preserve history)
- [ ] Badge statistics separate admin vs auto awards
- [ ] Badge distribution calculates rarity correctly

### MODULE-06 (Trade Flow V2)
- [ ] Transaction fee revenue calculated from completed trades
- [ ] Subscriber vs non-subscriber fees determined by subscription status
- [ ] Trade completion timestamps used for revenue period filtering

### MODULE-04 (Item Listing V2)
- [ ] No direct integration required
- [ ] Activity logs can track listing-related admin actions if needed

### MODULE-03 (Authentication V2)
- [ ] Admin login separate from mobile user login
- [ ] Admin sessions managed independently
- [ ] Admin role persists in session

**Acceptance Criteria Met:** ☐ Yes ☐ No  
**Notes:**

---

## SECTION 10: DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Create first admin user in Supabase dashboard
- [ ] Update users table: `UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'`
- [ ] Test admin login in staging environment
- [ ] Verify all admin RPCs work in staging
- [ ] Test subscription extension/cancellation flows
- [ ] Test SP wallet adjustments and status changes
- [ ] Test badge award/revoke flows

### Database Migrations
- [ ] Run migration 120_admin_roles_v2.sql (admin role schema)
- [ ] Run migration 121_admin_subscription_management.sql (subscription RPCs)
- [ ] Run migration 122_admin_sp_wallet_management.sql (SP wallet RPCs)
- [ ] Run migration 123_admin_badge_management.sql (badge RPCs)
- [ ] Run migration 124_admin_revenue_analytics.sql (analytics RPCs)
- [ ] Run migration 125_admin_user_management.sql (user management schema + RPCs)
- [ ] Verify all indexes created successfully
- [ ] Verify all RLS policies active

### Admin Panel Configuration
- [ ] Configure admin panel subdomain (e.g., admin.kidsclub.com)
- [ ] Set up SSL certificate for admin subdomain
- [ ] Configure separate authentication flow for admin vs mobile
- [ ] Set up admin session duration (recommend shorter than user sessions)

### Monitoring & Alerts
- [ ] Set up monitoring for admin login failures
- [ ] Alert on unusual admin activity (bulk cancellations, large SP adjustments)
- [ ] Monitor admin_activity_log for suspicious patterns
- [ ] Track admin action frequency and types

### Documentation
- [ ] Document admin panel access procedures
- [ ] Create admin user guide for common tasks
- [ ] Document escalation procedures for admin actions
- [ ] Create runbook for emergency admin operations

**Deployment Complete:** ☐ Yes ☐ No  
**Production URL:** ___________________________  
**Deployed By:** ___________________________  
**Deployment Date:** ___________________________

---

## SECTION 11: TESTING SUMMARY

### Unit Tests
- [ ] Admin authentication service tests pass
- [ ] Admin subscription service tests pass
- [ ] Admin SP wallet service tests pass
- [ ] Admin badge service tests pass
- [ ] Admin analytics service tests pass
- [ ] All RPC tests pass

### Integration Tests
- [ ] Admin login → subscription management flow works
- [ ] Admin login → SP wallet management flow works
- [ ] Admin login → badge management flow works
- [ ] Admin login → analytics dashboard flow works
- [ ] Activity logs created for all admin actions

### End-to-End Tests
- [ ] Admin can complete full subscription management workflow
- [ ] Admin can complete full SP wallet adjustment workflow
- [ ] Admin can complete full badge award/revoke workflow
- [ ] Admin can view all analytics and export data

### Performance Tests
- [ ] Admin dashboard loads in < 2 seconds
- [ ] Subscription search returns results in < 500ms
- [ ] SP economy metrics calculate in < 500ms
- [ ] Badge distribution query executes in < 500ms
- [ ] Revenue metrics query executes in < 500ms

### Security Tests
- [ ] Non-admin users cannot access admin RPCs
- [ ] Non-admin users cannot access admin routes
- [ ] SQL injection attempts fail safely
- [ ] Activity logs immutable by non-admins
- [ ] Admin sessions expire properly

**All Tests Passing:** ☐ Yes ☐ No  
**Test Coverage:** _____%  
**Tested By:** ___________________________  
**Test Date:** ___________________________

---

## FINAL SIGN-OFF

### Product Owner Approval
- [ ] All admin features meet business requirements
- [ ] Admin workflows are intuitive and efficient
- [ ] Analytics provide actionable insights
- [ ] Audit trail meets compliance requirements

**Approved By:** ___________________________  
**Date:** ___________________________  
**Signature:** ___________________________

### Engineering Lead Approval
- [ ] All code reviewed and approved
- [ ] Database migrations tested and safe
- [ ] Security measures implemented correctly
- [ ] Performance requirements met
- [ ] Documentation complete

**Approved By:** ___________________________  
**Date:** ___________________________  
**Signature:** ___________________________

### QA Lead Approval
- [ ] All test cases passed
- [ ] No critical or high-severity bugs
- [ ] Security vulnerabilities addressed
- [ ] Cross-browser/device testing complete
- [ ] Regression testing passed

**Approved By:** ___________________________  
**Date:** ___________________________  
**Signature:** ___________________________

---

## OPEN ISSUES & FUTURE ENHANCEMENTS

### Known Issues
1. **Issue:** _________________________________________________
   **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low  
   **Status:** ☐ Open ☐ In Progress ☐ Resolved

2. **Issue:** _________________________________________________
   **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low  
   **Status:** ☐ Open ☐ In Progress ☐ Resolved

### Future Enhancements
1. **Enhancement:** Time-series revenue charts (weekly/monthly trends)
   **Priority:** ☐ High ☐ Medium ☐ Low
   **Estimated Effort:** 8 hours

2. **Enhancement:** CSV export for analytics data
   **Priority:** ☐ High ☐ Medium ☐ Low
   **Estimated Effort:** 4 hours

3. **Enhancement:** Scheduled admin reports via email (weekly/monthly)
   **Priority:** ☐ High ☐ Medium ☐ Low
   **Estimated Effort:** 6 hours

4. **Enhancement:** Admin notification system for critical events
   **Priority:** ☐ High ☐ Medium ☐ Low
   **Estimated Effort:** 8 hours

5. **Enhancement:** Bulk admin operations on users (bulk suspend, bulk export, bulk badge awards)
   **Priority:** ☐ High ☐ Medium ☐ Low
   **Estimated Effort:** 12 hours

6. **Enhancement:** Advanced analytics (cohort analysis, funnel metrics, retention curves)
   **Priority:** ☐ High ☐ Medium ☐ Low
   **Estimated Effort:** 16 hours

---

**MODULE-12 VERIFICATION COMPLETE:** ☐ Yes ☐ No  
**Verification Date:** ___________________________  
**Verified By:** ___________________________
