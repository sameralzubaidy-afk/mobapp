# MODULE-18 Admin Portal — Manual Testing Guide

**Source of truth:** `docs/flow-registry.md` (FLOW-18 Admin Controls / CPSC Recall Imports / ID Badge Verification · FLOW-20 Audit/Logging · FLOW-21 Category Management / Education CMS · FLOW-22 Sales Tax · FLOW-25 Manual Payout Admin · FLOW-28 Cron & Background Jobs · FLOW-30 SP Wallet Admin Ops · FLOW-34 Admin Auth Middleware)
**Tasks covered:** Admin Auth & Dashboard (health strip, Action Center, KPI cards, no duplicate nav cards) · Users · Listings/Items/Flagged · Categories · Nodes/Node Settings/Waitlist + **per-node KPIs (N6 node tagging)** · Global Config (cart, trade-timing, N1 configurability — pickup/payout) · Policies · Trades · Disputes · Tax · Payouts (config + earnings) · SP Economy/Analytics/Wallet · Subscriptions · Referrals · ID Badges/Badges · Review Moderation · Education/FAQ CMS · Support · Revenue/Notification Analytics · Audit Logs · Monitoring/Cron · Sidebar Navigation (grouped & collapsible)
**Last updated:** 2026-08-09
**Scope:** Admin portal manual testing in a **web browser** (this is a web-based admin tool, not a mobile app). No SQL / no DB access required — **exception:** the N6 node-tagging data-layer checks (TC-E06, and the SQL reconcile step in TC-E07) run **read-only** queries in the Supabase SQL Editor on staging.
**Devices:** Desktop browser (Chrome/Safari/Firefox). Admin login required.

> Note: detailed **Sales Tax admin** cases (node rate config, bulk update, audit history, reporting dashboard, CSV export) live in `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` Group P (TC-P01–TC-P08). This guide's Tax group (Group J) covers entry points and cross-references those.

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Auth & Dashboard** | TC-A01 | Admin login with admin role |
| | TC-A02 | Non-admin login rejected (RBAC gate) |
| | TC-A03 | Dashboard layout: intro → health strip → Action Center → KPIs (no duplicate nav) |
| | TC-A04 | Direct protected route access without session redirects to login |
| | TC-A05 | Expired session redirects once without a loop |
| | TC-A06 | Dashboard KPI cards follow design-system styling |
| **B — User Management** | TC-B01 | User list, search, status filters, pagination |
| | TC-B02 | User detail drawer (identity, subscription, SP, trades) |
| | TC-B03 | Suspend / ban / delete account |
| | TC-B04 | Credit/debit SP + freeze wallet from user |
| | TC-B05 | User analytics cards (totals, DAU/MAU) |
| **C — Listings, Items & Flagged** | TC-C01 | Listing management — search & analytics tabs |
| | TC-C02 | Flagged items — filter tabs + statuses |
| | TC-C03 | Approve flagged item |
| | TC-C04 | Reject item with required reason |
| | TC-C05 | Item detail view + appeal info |
| **D — Categories** | TC-D01 | Category list, filters (incl. Bonus), search |
| | TC-D02 | Create / edit category + SP multiplier |
| | TC-D03 | Activate / deactivate category |
| | TC-D04 | Category suggestions queue + count badge |
| **E — Nodes & Waitlist** | TC-E01 | Geographic nodes list + stats |
| | TC-E02 | Add / edit node |
| | TC-E03 | Deactivate node with members warning |
| | TC-E04 | Node settings (radius validations) |
| | TC-E05 | ZIP waitlist queue + status filter |
| | TC-E06 | Node tagging completeness (N6) — every record resolves to one node |
| | TC-E07 | Per-node KPIs (N6) — expansion-gate metrics per node |
| **F — Global Config & Settings** | TC-F01 | Global configuration inline edit + permission gate |
| | TC-F02 | Cart settings (min value, max carts, expiry) |
| | TC-F03 | Trade timing config (timing keys + nested validation) |
| | TC-F04 | Settings single-source — cross-link + last-updated + audit |
| | TC-F05 | N1 configurability — pickup countdown + payout buffer (new keys) |
| | TC-F06 | R2 — 7-day trade-window guardrail (hard block) + pickup reminders (new keys) |
| | TC-F07 | Trade Pipeline visualization — see & track trades in all stages |
| **G — Policy Management** | TC-G01 | Policy tabs (TOS/Privacy/Liability) + versions |
| | TC-G02 | Create new policy version (version regex) |
| | TC-G03 | Edit draft policy |
| | TC-G04 | Publish policy (confirmation) |
| **H — Trades** | TC-H01 | Trade list filters + columns |
| | TC-H02 | Trade detail (info, monetary breakdown, audit) |
| | TC-H03 | Trade admin actions |
| **I — Disputes** | TC-I01 | Dispute queue + SLA highlighting |
| | TC-I02 | Mark dispute under review |
| | TC-I03 | Resolve dispute — Complete |
| | TC-I04 | Resolve dispute — Refund |
| **J — Tax Admin** | TC-J01 | Tax admin entry points (cross-ref TradeFlow Group P) |
| **K — Payouts** | TC-K01 | Payout fee configuration + test breakdown |
| | TC-K02 | Payouts management list, stats, filters |
| | TC-K03 | Retry failed payout (confirmation) |
| **R3 — Delayed Payout (Admin)** | TC-R3-01 | Scheduled payouts visible with release dates |
| | TC-R3-02 | payout_buffer_days enforcement on new completions |
| | TC-R3-03 | Release via cron — processing/paid + balance move |
| | TC-R3-04 | Trade Pipeline shows payout release date |
| **L — SP Economy / Analytics / Wallet** | TC-L01 | SP Economy hub tabs (Health/Flow/Rules) |
| | TC-L02 | SP Analytics dashboard + CSV export |
| | TC-L03 | SP Wallet admin — economy metrics + search |
| | TC-L04 | SP adjustment (credit/deduct) with reason |
| | TC-L05 | Freeze / unfreeze / suspend wallet |
| **M — Subscriptions Admin** | TC-M01 | Grace period config (days + reminders) |
| | TC-M02 | Subscriptions list, filters, metrics |
| | TC-M03 | Extend / cancel / send reminder |
| **N — Referrals Admin** | TC-N01 | Referral configuration tab |
| | TC-N02 | Referral analytics tab |
| **O — ID Badge Verification** | TC-O01 | ID badge queue + stats + status filter |
| | TC-O02 | Review request — approve |
| | TC-O03 | Review request — reject with reason |
| | TC-O04 | Request details (screenshot deleted note) |
| | TC-O05 | Message templates edit |
| **P — Badges & Sandbox** | TC-P01 | Badge management list + toggle |
| | TC-P02 | Create/edit/delete badge |
| | TC-P03 | Manual award badge |
| | TC-P04 | Badge sandbox event simulation |
| **Q — Review Moderation** | TC-Q01 | Reported reviews list + reason filter |
| | TC-Q02 | Hide review (confirmation) |
| | TC-Q03 | Approve review (unhide + delete reports) |
| **R — Education & FAQ CMS** | TC-R01 | Education sections/examples/analytics |
| | TC-R02 | FAQ management (questions/categories/analytics) |
| | TC-R03 | Publish FAQ / education content |
| **S — Support Messages** | TC-S01 | Support inbox + unread filter |
| | TC-S02 | Support detail + mark as read |
| **T — Analytics** | TC-T01 | Revenue & Analytics dashboard |
| | TC-T02 | Notification analytics (category/type/variant) |
| **U — Audit Logs** | TC-U01 | Audit logs view |
| **V — Monitoring & Cron** | TC-V01 | Monitoring run + alerts (acknowledge/note) |
| | TC-V02 | Cron jobs status + run history + timezone |
| **W — Sidebar Navigation** | TC-W01 | Sidebar grouped into 7 labeled sections |
| | TC-W02 | Expand / collapse a section via label + chevron |
| | TC-W03 | Section state persists per admin across sessions |
| | TC-W04 | Active route auto-expands its parent section |
| | TC-W05 | Active/inactive item styling + label typography |
| | TC-W06 | Collapsed icon rail shows all destinations |
| | TC-W07 | All previous nav destinations still reachable |
| **X — Action Center** | TC-X01 | Action Center page loads aggregated cards |
| | TC-X02 | Same-type items bundled with count |
| | TC-X03 | Severity tags (Urgent/Routine) |
| | TC-X04 | Expand card drills into item list |
| | TC-X05 | Inline approve flagged item |
| | TC-X06 | Inline mark dispute under review |
| | TC-X07 | Inline retry failed payout (confirmation) |
| | TC-X08 | Empty state "All caught up" |
| | TC-X09 | Sidebar pinned nav item + live count badge |
| | TC-X10 | Header bell opens Action Center + badge |
| | TC-X11 | Config drift card lists out-of-range settings |
| | TC-X12 | Dashboard embeds top-5 Action Center cards + View all link |
| **Y — Command Palette & Global Search** | TC-Y01 | ⌘K / Ctrl+K opens the palette from any page |
| | TC-Y02 | Header search bar opens the palette |
| | TC-Y03 | Parallel search across 4 entity types with grouped labels |
| | TC-Y04 | Breadcrumb context per result row |
| | TC-Y05 | Input debounced ~200ms |
| | TC-Y06 | Top 5 per group + "See all N results" expansion |
| | TC-Y07 | Footer "View all in <domain>" → prefilled list page |
| | TC-Y08 | Selecting a result navigates directly |
| | TC-Y09 | Keyboard navigation (↑/↓/↵/Esc) + focus trap |
| | TC-Y10 | Non-admin rejected (permission scoping) |
| | TC-Y11 | Secret settings values never shown |
| | TC-Y12 | Empty + no-results states |
| **Z — Dashboard Health Strip** | TC-Z01 | Health strip renders below title, above Action Center |
| | TC-Z02 | Six indicators with colored dots + labels + values |
| | TC-Z03 | Dot color reflects configurable thresholds |
| | TC-Z04 | Clicking an indicator navigates to its detail page |
| | TC-Z05 | Failed Payouts deep-link pre-filters to failed |
| | TC-Z06 | Thresholds tunable via /config (health) without code change |
| | TC-Z07 | Dashboard embeds Action Center below the strip |
| **N2 — Idempotency & Audit (Cross-Cutting)** | TC-N2-A01 | Financial audit journal viewable per trade |
| | TC-N2-A02 | Admin SP adjustment — double-click cannot double-credit |
| | TC-N2-A03 | Duplicate refund attempt rejected (no double refund) |
| | TC-N2-A04 | Payout — single row per trade, single transfer |
| | TC-N2-A05 | Financial Audit screen accessible from sidebar + renders |
| | TC-N2-A06 | Financial Audit — search & filters |
| | TC-N2-A07 | Financial Audit — row details, trade link, amount formatting |
| | TC-N2-A08 | Financial Audit — summary strip reconciles with journal |

---

## Pre-conditions (set up before testing)

- The admin portal is deployed/running and reachable in a browser.
- An admin account exists (role `admin` in `role_based_access_control`) and a non-admin account exists for the RBAC negative test.
- Seed data exists across domains: users in each account/subscription status; at least one flagged item (status = flagged) pending review, one rejected item, one item with an appeal; categories including a bonus category and a pending suggestion; an inactive node with members; a ZIP waitlist entry in each status; draft + published policy versions; trades in each status including one open dispute (reported) and one under review; failed and pending payouts; SP wallets including a frozen one; subscriptions in grace/cancelled; pending/approved/rejected ID badge requests; a reported review with 3+ reports; draft + published FAQ and education sections; unread support messages; cron jobs with at least one failed run; **at least one admin_config value set outside its recommended range (e.g. grace_period_days > 180) so the Config Drift card has data** (and can be re-set to 90 to clear it).
- Test admin credentials are available (the login screen lists demo credentials in non-prod).

## Accounts for testing

| Role | Email | Notes |
|---|---|---|
| Admin | test-admin@kidsmarketplace.test | Full admin access (role = admin) |
| Non-admin | test-buyer@kidsmarketplace.test | Used to verify RBAC rejection |

> Some admin actions are destructive or financial (suspend/ban/delete user, resolve dispute → refund, retry payout, SP adjust, publish policy). Perform these against seed/test data only. Each such action requires a confirmation dialog — verify the confirmation appears before the action commits.

---

## Group A — Auth & Dashboard

### TC-A01 · Admin login with admin role

**Ref:** FLOW-34 · /auth/login
**Actors:** test-admin

**Objective:** Verify an admin can log into the portal.

**Steps:**
1. Open the portal `/auth/login`.
2. Enter the admin email + password and click **[Sign in]**.

**Expected Result:**
- The title "P2P Kids Admin" and email/password fields render.
- "Signing in..." shows while loading; on success the admin lands on the dashboard.

---

### TC-A02 · Non-admin login rejected (RBAC gate)

**Ref:** FLOW-34 · /auth/login
**Actors:** test-buyer (non-admin)

**Objective:** Verify a non-admin cannot access the portal.

**Steps:**
1. At `/auth/login`, sign in with the non-admin account.

**Expected Result:**
- Access is denied (no `admin` role in `role_based_access_control`); a red error alert is shown and the dashboard is not reached.

---

### TC-A03 · Dashboard layout: intro → health strip → Action Center → KPIs (no duplicate nav)

**Ref:** FLOW-18 · / (dashboard)
**Actors:** test-admin

**Objective:** Verify the dashboard homepage composes top-to-bottom: intro line, system health strip, embedded Action Center, and KPI stat cards — with **no** homepage cards that duplicate sidebar navigation (every destination lives in the left sidebar).

**Steps:**
1. After login, review the dashboard ("Welcome to Admin Portal").

**Expected Result:**
- The page renders, top to bottom: the intro line ("Manage system configuration, users, and review audit logs."), the system health strip, the embedded Action Center section, then the KPI stat cards.
- The Trade Analytics KPI cards (Total Trades, Fee Revenue, Avg SP Usage, Completed Rate) and SP Economy KPI cards (SP Circulation, Total Earned, Total Spent, Active Wallets) render **below** the Action Center.
- **No** homepage cards duplicate sidebar destinations (Revenue & Analytics, SP Economy, Trades, Subscriptions, ID Badges, Payouts, Referrals, Config, Nodes, Users, Monitoring, Audit Logs, Reviews, Cron are reachable from the left sidebar only).
- Major sections are spaced 24px apart (design-system lg spacing).

---

### TC-A06 · Dashboard KPI cards follow design-system styling

**Ref:** FLOW-18 · / (dashboard) · `docx/old/design-system.md` (Card / §8.1 Level 1 shadow)
**Actors:** test-admin

**Objective:** Verify the dashboard KPI stat cards match the design-system card spec.

**Steps:**
1. Open the dashboard (`/`); inspect the KPI stat cards below the Action Center.

**Expected Result:**
- Each KPI card has a white background (`#FFFFFF`), a **16px** border radius (`rounded-2xl`), a **Level 1 shadow** (`0px 2px 8px rgba(0,0,0,0.08)`), and **16px** padding (`p-4`).
- Labels are uppercase 14px; values are bold 24px with a colored accent per metric (green/blue/indigo/red).

### TC-A04 · Direct protected route access without session redirects to login

**Ref:** FLOW-34 · protected admin routes
**Actors:** Logged-out browser session

**Objective:** Verify protected admin routes cannot be opened without an authenticated admin session.

**Steps:**
1. Open a new private/incognito browser window.
2. Navigate directly to a protected route such as `/users`, `/config`, or `/trades` without logging in.

**Expected Result:**
- The browser is redirected to `/auth/login` or shown an equivalent unauthorized gate.
- The protected page data never renders briefly before redirect.

### TC-A05 · Expired session redirects once without a loop

**Ref:** FLOW-34 · session expiry / refresh failure
**Actors:** test-admin

**Objective:** Verify an expired admin session fails closed and does not bounce between routes.

**Steps:**
1. Log in as **test-admin** and open a protected page.
2. Expire or invalidate the admin session in the test environment.
3. Refresh the protected page or navigate to another protected route.

**Expected Result:**
- The expired session is rejected and the user is redirected to login or shown a single unauthorized state.
- The app does not enter a redirect loop.
- After signing in again, the protected page loads normally.

---

## Group B — User Management

### TC-B01 · User list, search, status filters, pagination

**Ref:** FLOW-18 · /users
**Actors:** test-admin

**Objective:** Verify the user list, search, filters, and pagination.

**Steps:**
1. Open **/users**.
2. Search by name/email/phone; apply the Account Status filter (active/suspended/banned/deleted) and Subscription Status filter (trial/active/grace_period/cancelled/expired/none); page through results.

**Expected Result:**
- Header "User Management"; table shows User ID, Name, Email, Phone, Avatar, Account Status, Subscription Status, Trade Count, SP Balance, Badge Count.
- Search and both filters narrow results; pagination next/prev works.

---

### TC-B02 · User detail drawer (identity, subscription, SP, trades)

**Ref:** FLOW-18 · /users
**Actors:** test-admin

**Objective:** Verify the user detail side panel.

**Steps:**
1. Click a user row to open the detail drawer.

**Expected Result:**
- Shows identity (name, email, phone, DOB, avatar), account status + suspension tracking, subscription info (status, tier, dates), SP wallet (balance, lifetime earned/spent), trade activity (total, as seller/buyer, last trade date), badges, and recent admin activity log.

---

### TC-B03 · Suspend / ban / delete account

**Ref:** FLOW-18 · /users
**Actors:** test-admin

**Objective:** Verify account moderation actions.

**Steps:**
1. From a user's detail panel, suspend the account; confirm the status change.
2. Repeat for ban and delete (on disposable seed users).

**Expected Result:**
- Account status updates to suspended/banned/deleted respectively; the change is reflected in the list filter and (for suspended) the user hits the Suspended screen on the mobile app.

---

### TC-B04 · Credit/debit SP + freeze wallet from user

**Ref:** FLOW-30 · /users
**Actors:** test-admin

**Objective:** Verify SP balance adjustment and wallet freeze from the user panel.

**Steps:**
1. From a user's panel, credit and then debit SP (with a reason), and freeze the wallet.

**Expected Result:**
- The SP balance updates by the adjustment; the wallet status shows frozen; both actions appear in the audit/admin activity log.

---

### TC-B05 · User analytics cards (totals, DAU/MAU)

**Ref:** FLOW-18 · /users
**Actors:** test-admin

**Objective:** Verify the user analytics summary cards.

**Steps:**
1. On /users, review the analytics cards.

**Expected Result:**
- Cards for Total Users, Active, Suspended, Deleted, New This Month, and DAU/MAU render with values.

---

## Group C — Listings, Items & Flagged

### TC-C01 · Listing management — search & analytics tabs

**Ref:** FLOW-04 · /listings
**Actors:** test-admin

**Objective:** Verify the listing management tabs.

**Steps:**
1. Open **/listings**; switch between **Search & Manage** and **Analytics Dashboard**.

**Expected Result:**
- "Listing Management" header; Search & Manage shows search/filter + results; Analytics Dashboard shows listing metrics.

---

### TC-C02 · Flagged items — filter tabs + statuses

**Ref:** FLOW-18 · /items/flagged
**Actors:** test-admin

**Objective:** Verify the flagged-items queue and filters.

**Steps:**
1. Open **/items/flagged**; switch filter tabs All / Flagged / Rejected / Needs Edits.

**Expected Result:**
- Table shows Item ID, Title, Price, status badge (flagged/rejected/needs_edits color-coded), Seller, flagged date, Actions; tabs filter accordingly.

---

### TC-C03 · Approve flagged item

**Ref:** FLOW-18 · /items/flagged
**Actors:** test-admin

**Objective:** Verify approving a flagged item makes it available.

**Steps:**
1. Open a flagged item's detail modal and click **Approve**.

**Expected Result:**
- The item moves flagged → available and leaves the flagged queue.

---

### TC-C04 · Reject item with required reason

**Ref:** FLOW-18 · /items/flagged
**Actors:** test-admin

**Objective:** Verify rejection requires a reason.

**Steps:**
1. On a flagged item, click **Reject** without a reason, then with a reason.

**Expected Result:**
- Reject is blocked until a reason is provided; with a reason the item becomes rejected and the rejection reason is stored.

---

### TC-C05 · Item detail view + appeal info

**Ref:** FLOW-18 · /items/[id]
**Actors:** test-admin

**Objective:** Verify the item detail page and appeal data.

**Steps:**
1. Open **/items/[id]** for an item with an appeal.

**Expected Result:**
- Shows title, description, price, status, seller, category, created date; for appealed items, appeal count, appeal reason, and appeal date display; back/Open Listings navigation works.

---

## Group D — Categories

### TC-D01 · Category list, filters (incl. Bonus), search

**Ref:** FLOW-21 · /categories
**Actors:** test-admin

**Objective:** Verify category listing, filtering, and search.

**Steps:**
1. Open **/categories**; use filter tabs All / Active / Inactive / Bonus; search by name.

**Expected Result:**
- Table shows name, status, SP earning multiplier, item count, actions; Bonus filter shows only multiplier > 1.10; debounced search filters by name.

---

### TC-D02 · Create / edit category + SP multiplier

**Ref:** FLOW-21 / FLOW-04C · /categories
**Actors:** test-admin

**Objective:** Verify category create/edit including SP multiplier.

**Steps:**
1. Click **[+ Create New Category]**; set name, active toggle, SP earning multiplier; save.
2. Edit an existing category's multiplier; save.

**Expected Result:**
- The new/edited category appears with the configured multiplier; a bonus multiplier (> 1.10) makes it appear under the Bonus filter and as a bonus category in the app's SP calculator.

---

### TC-D03 · Activate / deactivate category

**Ref:** FLOW-21 · /categories
**Actors:** test-admin

**Objective:** Verify toggling category active state.

**Steps:**
1. Toggle a category active → inactive and back.

**Expected Result:**
- The status badge updates; inactive categories are hidden from new listings in the app.

---

### TC-D04 · Category suggestions queue + count badge

**Ref:** FLOW-21 · /categories (Suggestions tab)
**Actors:** test-admin

**Objective:** Verify the seller category-suggestions queue.

**Steps:**
1. Open the **Suggestions** tab.

**Expected Result:**
- Pending suggestions display with a count badge; the count polls/refreshes (~60s).

---

## Group E — Nodes & Waitlist

### TC-E01 · Geographic nodes list + stats

**Ref:** FLOW-03 · /nodes
**Actors:** test-admin

**Objective:** Verify the nodes list and stats.

**Steps:**
1. Open **/nodes**.

**Expected Result:**
- "Geographic Nodes" header; stats cards Total Nodes, Active Nodes, Total Members; table with name, city/state/ZIP, active badge, member count, actions.

---

### TC-E02 · Add / edit node

**Ref:** FLOW-03 · /nodes
**Actors:** test-admin

**Objective:** Verify adding and editing a node.

**Steps:**
1. Click **[+ Add Node]**, fill name/city/state/ZIP, save.
2. Edit an existing node, save.

**Expected Result:**
- The node is created/updated and appears in the list.

---

### TC-E03 · Deactivate node with members warning

**Ref:** FLOW-03 · /nodes
**Actors:** test-admin

**Objective:** Verify the members warning on deactivation.

**Steps:**
1. Toggle off an active node that has members.

**Expected Result:**
- A confirmation warns "This node has {X} active members. They will remain assigned but new users cannot join this node."; confirming logs to the admin audit log and deactivates the node.

---

### TC-E04 · Node settings (radius validations)

**Ref:** FLOW-03 · /settings/nodes
**Actors:** test-admin

**Objective:** Verify node radius settings and their validations.

**Steps:**
1. Open **/settings/nodes**; set default radius, max assignment distance, user radius toggle + min/max, distance warning threshold; save; also try invalid values.

**Expected Result:**
- Valid values save (1–100 radius, max assignment ≥ default, warning threshold 1–200); invalid combinations are blocked with validation messages.
- Current mobile propagation is verified on Discover for `default_radius_miles`, `min_user_radius_miles`, and `max_user_radius_miles` (see Discovery TC-O05).

---

### TC-E05 · ZIP waitlist queue + status filter

**Ref:** FLOW-03 · /waitlist
**Actors:** test-admin

**Objective:** Verify the ZIP waitlist queue.

**Steps:**
1. Open **/waitlist**; search by email/name; filter status all/pending/notified/joined; click **Refresh**.

**Expected Result:**
- Stats (Total, Pending, Notified, Joined); table with user, email, requested ZIP, assigned node, status badge, created date; search/filter/refresh work.

---

### TC-E06 · Node tagging completeness (N6)

**Ref:** FLOW-03 · BRD §6.10 (BR-N6-001..005, 007) · SRS §8A (SR-N6-001..005, 007, 008) · migration `20260809000005_n6_node_tagging.sql`
**Actors:** test-admin (SQL Editor on staging)

**Objective:** Verify every user, listing, trade, and cost/ledger record resolves to exactly **one** node.

**Steps (SQL Editor — one statement at a time):**
1. Run the per-table NULL-node coverage query from migration verification #3 (items, trades, payments, trade_refunds, sp_wallets, sp_ledger, sp_batches, seller_payouts, seller_balance, cart_items).
2. For any table with non-zero NULLs, run migration verification #4 to confirm the residual is **only** legacy rows whose user/listing/trade has no node assigned at all.
3. Create a new listing under a seller that has a node, then create a trade on it, and confirm `node_id` is auto-populated on the new `items` / `trades` / `payments` rows (write-trigger check).

**Expected Result:**
- `nulls` = 0 for every table except the documented unresolvable legacy residual (rows whose actor has no node).
- New rows are tagged automatically — no manual entry, no app change required.

---

### TC-E07 · Per-node KPIs (N6 expansion-gate metrics)

**Ref:** FLOW-03 · BRD §6.10 (BR-N6-006) · SRS §8A (SR-N6-006) · GTM plan §13/§15.6
**Actors:** test-admin (browser + SQL Editor on staging)

**Objective:** Verify the per-node KPIs are visible in the admin Nodes page and reconcile with the RPC.

**Steps (UI):**
1. Open **/nodes**.
2. Confirm the **Per-Node Marketplace KPIs** panel renders above the nodes table with columns: Node, Users, Listings, Trades, Completed, GMV, Platform Fees, Paid Payouts, SP Earned, SP Spent.
3. Confirm one row per node and that **Refresh** reloads the values.

**Steps (SQL Editor — one statement at a time, reconcile with UI):**
1. Run `SELECT public.admin_node_kpis(NULL);` — expect one JSON row per node matching the UI.
2. Pick a live node id (`SELECT id, name FROM public.nodes;`) and run `SELECT public.admin_node_kpis('<node-id>');`.

**Expected Result:**
- Each node row contains: `node_id`, `node_name`, `users`, `listings`, `trades`, `completed_trades`, `gmv_cents`, `platform_fee_cents`, `paid_payouts_cents`, `sp_earned`, `sp_spent`.
- The node-filtered call returns only that node's metrics.
- UI values reconcile with the RPC (e.g. `users` = count of `profiles.node_id` = node).
- No 401/"No valid authentication provided" errors — the page sends `x-admin-secret` (BP-49).

---

## Group F — Global Config & Settings

### TC-F01 · Global configuration inline edit + permission gate

**Ref:** FLOW-18 · /config
**Actors:** test-admin

**Objective:** Verify inline config editing and the write-permission gate.

**Steps:**
1. Open **/config**; edit a config item (e.g., sms_rate_limit_per_hour, moderation_ai_enabled); Save; then Reset another.
2. After saving, check the field's **"LAST UPDATED · <ts> · by <email>"** label shows the signed-in admin's email.
3. Open a tab that has a dedicated standalone page (**TAX**, **FEATURE FLAGS** containing cart keys, **TRADE**): confirm an Info-blue cross-link banner appears ("also managed on the … page") and the link opens the standalone page.

**Expected Result:**
- Items show value + edit/save/reset; saving shows success and persists; if `can_write` is false the items are read-only.
- Every field shows a "LAST UPDATED · … · by <editor>" label (Label style, Neutral 700), and the editor reflects the last admin who saved — even if that edit was made on the standalone page.
- Cross-link banners appear only on tabs whose keys are also editable on a standalone page (Tax → /tax/settings, cart keys → /settings/cart, trade-timing keys → /settings/trade-timing, node radius keys → /settings/nodes).
- For user-visible keys, rerun the linked mobile checks in `misc./ADMIN-CONFIG-IMPACT-REGISTRY.md` after saving.

---

### TC-F02 · Cart settings (min value, max carts, expiry)

**Ref:** FLOW-07 · /settings/cart
**Actors:** test-admin

**Objective:** Verify cart settings + validation + single-source with /config.

**Steps:**
1. Open **/settings/cart**; set minimum cart value (dollars), max saved carts (1–10), saved cart expiry (1–365); Save Changes; try invalid values.
2. Confirm the Info-blue banner "Related settings also live in Config → Feature Flags" is visible and opens **/config?tab=feature_flags**.
3. After saving, confirm each field shows a "LAST UPDATED · <ts> · by <email>" label with the signed-in admin's email.
4. Open **/config → Feature Flags**: the cart keys show the SAME values and the SAME last-updated timestamp/editor just saved on this page.

**Expected Result:**
- Valid values save and invalid values are blocked.
- Cross-link banner present; editing in either surface updates the same `admin_config` row and both surfaces show the same value + last-updated metadata.
- `cart_min_value_cents` is currently verified in the app via TradeFlow TC-M11 / TC-N01.
- `cart_max_saved_carts` and `cart_saved_expiry_days` still save in admin, but the runtime cart flow remains hardcoded and should not be marked end-to-end covered yet.

---

### TC-F03 · Trade timing config (timing keys + nested validation) — incl. consolidated fees

**Ref:** FLOW-08 · FLOW-09 · /settings/trade-timing
**Actors:** test-admin

**Objective:** Verify trade timing config, nested validations, and the consolidated fee params (buyer/seller platform fees + bundle fee toggle now live in the same Transaction Fees section).

**Steps:**
1. Open **/settings/trade-timing**; set offer timeout, the two offer notifications, auto-complete timeout + notification, pending SP release days, and transaction fees (Kids Club+ / Free-tier member fees, seller fee % per tier, buyer platform fee fixed + %, and the **Charge One Fee Per Bundle** toggle); Save.
2. Try invalid ordering (e.g., notif 1 ≥ timeout) and invalid fee values (negative fixed cents, buyer % > 100).
3. **Cross-link check:** Open **/config → FEES**; confirm `platform_fee_buyer_fixed_cents`, `platform_fee_buyer_percentage`, and `charge_one_fee_per_bundle` show the same values as the Trade Timing page, with an Info-blue banner "… also managed on the Trade Timing page" linking to **/settings/trade-timing**.

**Expected Result:**
- Valid values save; nested rules enforced (notif1 < timeout, notif2 < notif1 and ≥ 1, auto-complete notif < auto-complete hours, all ≥ 1, fees ≥ 0, buyer fixed ≥ 0, buyer % 0–100); invalid values are blocked.
- The Trade Timing page is the single place to manage every fee parameter; /config → FEES stays consistent (same `admin_config` rows) and cross-links.
- After saving distinct non-default values, rerun TradeFlow TC-B02 / TC-D01 / TC-D03 / TC-G01 / TC-G02 and Subscription TC-F06 / TC-R05 to confirm the new timing and fee values propagate.

---

### TC-F04 · Settings single-source — cross-link + last-updated + audit

**Ref:** FLOW-18 · /config ↔ standalone settings pages · FLOW-20 Audit/Logging
**Actors:** test-admin

**Objective:** Verify the /config hub and the standalone settings pages read/write the SAME `admin_config` rows, show cross-links to each other, and display a consistent "Last updated · <ts> · by <editor>" on every field — regardless of which surface made the last edit.

**Preconditions:** The migration `supabase/migrations/20260808000001_settings_single_source_audit.sql` has been applied (adds `p_admin_id` to `upsert_admin_config_setting`, plus `fn_get_admin_config_meta` / `fn_resolve_admin_emails`).

**Steps:**
1. **Edit from the standalone page:** Open **/tax/settings**, change a value (e.g. enable global tax), Save.
2. **Verify in /config:** Open **/config → TAX**. The same key shows the new value and a "LAST UPDATED · … · by <your email>" label matching what you just saved.
3. **Edit from /config:** On **/config → TAX**, change a value (e.g. default rate) and Save.
4. **Verify back on the standalone page:** Open **/tax/settings**. The field shows the value you just changed in /config and the same last-updated timestamp/editor.
5. **Audit trail:** Run `SELECT admin_id, action, entity_type, changes, created_at FROM admin_audit_log WHERE entity_type='admin_config' ORDER BY created_at DESC LIMIT 10;` — confirm `update_config` (from /config), `update_tax_settings`, `update_cart_settings`, `update_trade_timing_settings`, `update_node_settings` rows exist with the correct admin_id and old/new values.
6. **Cross-links:** Confirm the Info-blue banners point both ways (standalone pages → `/config?tab=<tab>`; /config tab → standalone page) and the deep links land on the correct tab.

**Expected Result:**
- The same `admin_config` row backs both surfaces — no value divergence after editing in either place.
- Every field shows a Label-style "LAST UPDATED · <ts> · by <editor>" in Neutral 700.
- All settings edits land in `admin_audit_log` regardless of surface.

---

### TC-F05 · N1 configurability — pickup countdown + payout buffer (new keys)

**Ref:** FLOW-08 (Trade) · FLOW-09 (Fees) · FLOW-18 (Admin Controls) · N1 Configurability (cross-cutting)
**Actors:** test-admin

**Objective:** Verify the N1 config keys — `pickup_window_hours` (pickup countdown, now ENFORCED by R2), `pickup_notif_1/2_hours_before` (pickup reminders), and `payout_buffer_days` (payout buffer) — are seeded, editable from the admin UI, validate, persist, show audit metadata, and appear in the /config hub — all without a code deploy. These are the shared dependency that the R1–R13 requirements read from instead of hardcoding.

**Preconditions:** Migration `supabase/migrations/20260809000004_n1_configurability.sql` applied.

**Steps:**
1. **Seeded + visible:** Open **/config → TRADE** and **/config → FEES**. Confirm `pickup_window_hours` and `payout_buffer_days` rows exist (values 72 and 2 respectively), with the descriptions from the migration and "LAST UPDATED · … · by" labels.
2. **Edit on the standalone page:** Open **/settings/trade-timing**. In the **Pickup & Payout** section, set Pickup Window = 24 and Payout Buffer = 1; Save.
3. **Cross-link banner:** On /config → TRADE and /config → FEES, confirm the Info-blue banner appears for both keys ("… also managed on the Trade Timing page") and opens **/settings/trade-timing**.
4. **Validation:** Try Pickup Window = 0 or 200, and Payout Buffer = -1 or 31 — confirm each is blocked with its error message (window 1–168, buffer 0–30). The combined 7-day guardrail (offer + pickup must total under 168h) is covered in TC-F06.
5. **Single-source + audit:** Re-open /settings/trade-timing and /config — both show 24 and 1, the same last-updated timestamp/editor; then run `SELECT key, value, updated_by, updated_at FROM admin_config WHERE key IN ('pickup_window_hours','payout_buffer_days');` and `SELECT admin_id, action, entity_type, changes FROM admin_audit_log WHERE entity_type='admin_config' ORDER BY created_at DESC LIMIT 5;` — confirm the values and the `update_trade_timing_settings` audit row.
6. **Typed read helper (no deploy):** Confirm the read RPC works: `SELECT public.fn_admin_config_int('pickup_window_hours', 72);` returns 24, and `SELECT public.fn_admin_config_int('missing_key', 7);` returns 7 (the caller decides, no crash).

**Expected Result:**
- Both keys are admin-tunable with validation, persist across surfaces, record the editor, and appear in the /config hub — proving a config change takes effect without a code deploy.
- Changing a value here is immediately readable via `fn_admin_config_int`, the canonical read helper R1–R13 will use instead of hardcoded numbers.
- No duplicate config store was created: the keys live in the existing `admin_config` table (single source of truth).

---

### TC-F06 · R2 — 7-day trade-window guardrail (hard block) + pickup reminders (new keys)

**Ref:** FLOW-08 (Trade) · FLOW-18 (Admin Controls) · R2 (2026-08-10)
**Actors:** test-admin

**Objective:** Verify the 7-day Stripe authorization guardrail HARD-BLOCKS offer + pickup windows totalling ≥ 168h, and that the two NEW pickup-reminder keys validate and save.

**Preconditions:** Migration `supabase/migrations/20260810000001_r2_auth_capture_countdown.sql` applied.

**Steps:**
1. Open **/settings/trade-timing**. Set Offer Timeout = 100, Pickup Window = 72 → combined 172h; Save.
2. Confirm the save is BLOCKED with an error on both fields ("Offer + pickup (172h) must stay under 168h (Stripe's 7-day authorization limit). Lower one window.").
3. Lower Pickup Window to 67 (100 + 67 = 167) → Save succeeds.
4. Set Offer Timeout = 48, Pickup Window = 72 (defaults, 120h) → Save succeeds (defaults remain valid).
5. In the Pickup & Payout section, confirm the two new fields — **First Pickup Reminder** (`pickup_notif_1_hours_before`) and **Final Pickup Reminder** (`pickup_notif_2_hours_before`) — are present with defaults 24 / 2.
6. Try First Pickup Reminder = 24 with Pickup Window = 24 (equal) → blocked (must be < pickup window); Final = 2 with First = 1 → blocked (must be < first).
7. Verify the hard block is SERVER-SIDE too (defense in depth): run `SELECT upsert_admin_config_setting('pickup_window_hours', '72', 'trade', 'number', false, true, NULL);` while offer_timeout_hours = 100 is stored → expect a RAISE EXCEPTION. Reset both to defaults afterwards.

**Expected Result:**
- Failure mode is a HARD BLOCK (not auto-clamp): the admin must lower a window; nothing is silently capped.
- The DB trigger (`fn_validate_trade_timing_config`) and the admin UI enforce the same ≤167h combined rule.
- The two pickup-reminder keys seed (24/2), validate their ordering, and persist; `/config → TRADE` shows them.
- Backstop note: the runtime `check-authorization-expiry` cron still cancels any stale authorization holds at the 7-day mark.

---

### TC-F07 · Trade Pipeline visualization — see & track trades in all stages

**Ref:** FLOW-08 (Trade) · FLOW-18 (Admin Controls) · R2 (2026-08-10)
**Actors:** test-admin

**Objective:** Verify the new **Trade Pipeline** board (`/trades/pipeline`) lets an admin see and track trades across all stages with live countdowns, filters, and an attention strip.

**Preconditions:** Migrations `20260810000001_r2_auth_capture_countdown.sql` and `20260810000003_admin_trades_view_pipeline.sql` applied. At least one trade exists in each of `pending`, `in_progress`, `completed`, `cancelled`.

**Steps:**
1. Open the sidebar **Trade Operations → Trade Pipeline** (or `/trades/pipeline`).
2. Confirm four columns render: **Pending Offer**, **In Progress · Pickup**, **Completed**, **Cancelled**, each with a count.
3. Confirm a **Pending Offer** card shows the buyer → seller, $cash + SP, and a live "Offer expires in X" countdown (from `offer_expires_at`).
4. Confirm an **In Progress** card shows "Auto-completes in X" (from `auto_complete_at`) and that a disputed trade shows a **Dispute** chip + "Dispute open — auto-complete paused".
5. Confirm bundle trades show a **Bundle ×N** chip and that every card deep-links to `/trades/[id]`.
6. Use the **status tabs** and the **search** box (buyer / seller / trade ID) — confirm they filter the board.
7. Create or fast-forward a pending offer to <6h before expiry (or an in_progress trade to <4h before `auto_complete_at`) and confirm the amber **attention strip** appears with the correct count; toggle "Show only these".
8. Confirm the strip disappears when all trades are outside the attention windows or disputes are resolved.

**Expected Result:**
- The board shows all four stages at once with live (≤30s-ticking) countdowns and per-column counts.
- Cards link to the existing trade detail page; bundle + dispute chips render.
- Status tabs and search filter the board; the attention strip flags offers expiring ≤6h, pickup/auto-complete ≤4h, and open disputes.
- No code deploy needed to see new trades — the board reads `admin_trades_view` directly.

---

## Group G — Policy Management

### TC-G01 · Policy tabs (TOS/Privacy/Liability) + versions

**Ref:** FLOW-31/32/33 · /settings/policies
**Actors:** test-admin

**Objective:** Verify the policy management overview.

**Steps:**
1. Open **/settings/policies**; switch tabs Terms of Service / Privacy Policy / Liability Disclaimer.

**Expected Result:**
- Per type: an Active (Published) policy card (title, version, published/effective dates, View), a Draft Versions list (View/Edit/Publish), and an Archived Versions list.

---

### TC-G02 · Create new policy version (version regex)

**Ref:** FLOW-31/32/33 · /settings/policies/new
**Actors:** test-admin

**Objective:** Verify creating a draft policy version.

**Steps:**
1. Click **[+ Create New Version]**; fill Title, Version, Content, Effective Date; submit. Try an invalid version (e.g., "v1") and a duplicate type+version.

**Expected Result:**
- Version must match X.Y or X.Y.Z; all fields required; duplicate type+version blocked; a valid submit creates a draft.

---

### TC-G03 · Edit draft policy

**Ref:** FLOW-31/32/33 · /settings/policies/[id]/edit
**Actors:** test-admin

**Objective:** Verify editing a draft (only drafts editable).

**Steps:**
1. Open a draft policy → Edit; change title/content/effective date; Save.

**Expected Result:**
- The draft updates; published/archived versions are not editable.

---

### TC-G04 · Publish policy (confirmation)

**Ref:** FLOW-31/32/33 · /settings/policies/[id]
**Actors:** test-admin

**Objective:** Verify publishing a draft with confirmation.

**Steps:**
1. Open a draft → **Publish**; confirm the dialog.

**Expected Result:**
- Confirmation reads "Are you sure you want to publish this policy? It will make it the active version for all users."; confirming makes it the active version and previous active moves to archived. (App users are re-prompted to accept — see Account/Legal TC-J05.)

---

## Group H — Trades

### TC-H01 · Trade list filters + columns

**Ref:** FLOW-08 · /trades
**Actors:** test-admin

**Objective:** Verify the trade list and filters.

**Steps:**
1. Open **/trades**; filter status (all/pending/completed/cancelled/in_progress); search by trade ID / buyer / seller / email / phone.

**Expected Result:**
- "Trade Management" header; table shows Trade ID (8-char), status badge (color-coded), buyer/seller (with contact), amount (cash + SP), created date, View Details; filter/search work.

---

### TC-H02 · Trade detail (info, monetary breakdown, audit)

**Ref:** FLOW-08 · /trades/[id]
**Actors:** test-admin

**Objective:** Verify the trade detail sections.

**Steps:**
1. Open a trade's **View Details**.

**Expected Result:**
- General info (full trade ID, buyer/seller identity, created/updated, status), monetary breakdown (item price, buyer/seller fees, cash, SP, net), trade actions, and an audit trail.

---

### TC-H03 · Trade admin actions

**Ref:** FLOW-08 / FLOW-27 · /trades/[id]
**Actors:** test-admin

**Objective:** Verify available admin trade actions.

**Steps:**
1. On a trade detail, exercise the available actions (e.g., complete/cancel/refund as applicable to the trade state).

**Expected Result:**
- Actions apply the expected state change, are reflected in the monetary breakdown/payout, and are recorded in the audit trail. (Refund/cancellation state machine detail is covered in the AUTH file Refund/Cancellation group.)

---

## Group I — Disputes

### TC-I01 · Dispute queue + SLA highlighting

**Ref:** FLOW-08 · /trades/disputes (and /disputes)
**Actors:** test-admin

**Objective:** Verify the dispute queue and SLA indicators.

**Steps:**
1. Open **/trades/disputes** (and **/disputes**).

**Expected Result:**
- Empty state "No open disputes 🎉" when none; otherwise sections/columns for Reported and Under Review with Trade, Item, Reason, Value, Age, Status, Actions; ages over 24h are red-highlighted with an "SLA!" badge.

---

### TC-I02 · Mark dispute under review

**Ref:** FLOW-08 · /trades/disputes/[tradeId]
**Actors:** test-admin

**Objective:** Verify moving a reported dispute to under review.

**Steps:**
1. Open a reported dispute; click **[Mark Under Review]** and confirm.

**Expected Result:**
- The dispute status changes reported → under_review.

---

### TC-I03 · Resolve dispute — Complete

**Ref:** FLOW-08 · /trades/disputes/[tradeId]
**Actors:** test-admin

**Objective:** Verify resolving a dispute in the seller's favor.

**Steps:**
1. On a dispute detail, click **[Resolve - Complete]** and confirm.

**Expected Result:**
- Confirmation "Are you sure you want to: {action}?"; on confirm the trade completes, SP/payout release, and a success message shows. (Mirrors TradeFlow TC-E05.)

---

### TC-I04 · Resolve dispute — Refund

**Ref:** FLOW-08 / FLOW-27 · /trades/disputes/[tradeId]
**Actors:** test-admin

**Objective:** Verify resolving a dispute as a refund.

**Steps:**
1. On a dispute detail, click **[Resolve - Refund]** and confirm.

**Expected Result:**
- The buyer is refunded (including proportional tax), SP is restored, the payout is cancelled/withheld, and the trade reflects the refund. (Mirrors TradeFlow TC-E06 / TC-O07.)

---

## Group J — Tax Admin

### TC-J01 · Tax admin entry points (cross-ref TradeFlow Group P)

**Ref:** FLOW-22 · /tax, /tax/nodes, /tax/reports, /tax/settings
**Actors:** test-admin

**Objective:** Verify the tax admin sections load, cross-link to /config, and show last-updated metadata; detailed cases live in TradeFlow Group P.

**Steps:**
1. Open **/tax**, **/tax/nodes**, **/tax/settings**, **/tax/reports**.
2. On **/tax/settings**, confirm the Info-blue banner "Related settings also live in Config → Tax" opens **/config?tab=tax**, and every field shows a "LAST UPDATED · <ts> · by <email>" label.
3. On **/tax/nodes**, confirm the banner links to **/config?tab=tax** and each node row shows a **Last Updated** column (timestamp + editor) sourced from the shared audit trail.
4. On **/tax/rules**, confirm the banner links to **/config?tab=tax** and each rule (and the version-history table) shows a **Last Updated** column with the editor email.

**Expected Result:**
- Node tax rate config (view/edit, validation), bulk update, rate change history/audit, global settings toggle + warning banner, reporting dashboard (summary, date presets, jurisdiction breakdown, 7 report types), and CSV export are reachable.
- Global settings on /tax/settings and /config→TAX edit the same `admin_config` rows; per-node / per-category data on /tax/nodes and /tax/rules stays distinct (not merged into /config) but cross-links make the relationship explicit.
- Execute the detailed checks in `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` **TC-P01 through TC-P08**.

---

## Group K — Payouts

### TC-K01 · Payout fee configuration + test breakdown

**Ref:** FLOW-25 · /payouts
**Actors:** test-admin

**Objective:** Verify payout fee configuration.

**Steps:**
1. Open **/payouts**; edit config items (enable_automatic_seller_payout, payout_fee_cents_per_dollar, min/max payout amounts); Save; review the test breakdown.

**Expected Result:**
- Each item shows key, description, type badge, input, save/reset (save enabled only when edited); a test breakdown (default $100) shows gross/fees/net; saving persists.

---

### TC-K02 · Payouts management list, stats, filters

**Ref:** FLOW-22/25 · /payouts/earnings
**Actors:** test-admin

**Objective:** Verify the payouts management list.

**Steps:**
1. Open **/payouts/earnings**; search by seller email / trade ID; filter status (all/requires_action/pending/processing/completed/failed).

**Expected Result:**
- Stats (total, completed, pending, failed, volume); table with payout ID, user, trade, method, gross, platform fee, payout fee, net, status badge (color-coded), provider + reference, initiated/completed dates, failure reason; filters work.

---

### TC-K03 · Retry failed payout (confirmation)

**Ref:** FLOW-25 · /payouts/earnings
**Actors:** test-admin

**Objective:** Verify retrying a failed payout.

**Steps:**
1. On a failed payout, click **Retry** and confirm.

**Expected Result:**
- Confirmation "Retry this payout? This will attempt to reprocess the failed payout."; on confirm the payout is re-submitted and its status updates.

---

## Group L — SP Economy / Analytics / Wallet

### TC-L01 · SP Economy hub tabs (Health/Flow/Rules)

**Ref:** FLOW-30 · /sp-economy
**Actors:** test-admin

**Objective:** Verify the SP economy hub.

**Steps:**
1. Open **/sp-economy**; switch tabs Health / Flow / Rules & Impact; click Wallets.

**Expected Result:**
- "💎 SP Economy" header; each tab renders its panel; the Wallets tab routes to /sp-wallet; tab selection updates the URL.

---

### TC-L02 · SP Analytics dashboard + CSV export

**Ref:** FLOW-30 · /sp-analytics
**Actors:** test-admin

**Objective:** Verify per-category SP analytics and export.

**Steps:**
1. Open **/sp-analytics**; switch date ranges (7/30/90/365 days); click a category; click **[Export CSV]**.

**Expected Result:**
- Per-category velocity, gap %, avg cash per trade, anomaly flags; clicking a category routes to `/categories?edit=...&tab=sp-config`; CSV downloads with the documented columns.

---

### TC-L03 · SP Wallet admin — economy metrics + search

**Ref:** FLOW-30 · /sp-wallet
**Actors:** test-admin

**Objective:** Verify wallet economy metrics and user wallet lookup.

**Steps:**
1. Open **/sp-wallet**; review economy metrics; search a user by ID/email.

**Expected Result:**
- Metrics: total SP in circulation, users with wallet, active/frozen wallets, average balance.
- Search shows the user's info, SP balance + status badge, lifetime earned/spent, and a ledger (type badges: admin purple, earnings green, debits red).

---

### TC-L04 · SP adjustment (credit/deduct) with reason

**Ref:** FLOW-30 · /sp-wallet
**Actors:** test-admin

**Objective:** Verify manual SP adjustment.

**Steps:**
1. On a wallet, enter a positive amount (add) with a reason and submit; repeat with a negative amount (deduct).

**Expected Result:**
- Amount must be a non-zero integer and reason is required; the balance updates and a ledger entry (admin_grant/admin_deduct) is recorded.

---

### TC-L05 · Freeze / unfreeze / suspend wallet

**Ref:** FLOW-30 · /sp-wallet
**Actors:** test-admin

**Objective:** Verify wallet status changes.

**Steps:**
1. On a wallet, toggle Freeze/Unfreeze and Suspend/Unsuspend.

**Expected Result:**
- The status badge updates (active/frozen/suspended) and the mobile wallet reflects the frozen/suspended state.

---

## Group M — Subscriptions Admin

### TC-M01 · Grace period config (days + reminders)

**Ref:** FLOW-12 · /subscriptions/manage
**Actors:** test-admin

**Objective:** Verify grace-period configuration.

**Steps:**
1. Open **/subscriptions/manage**; set grace period days and reminder thresholds (e.g., "60, 30, 7, 1"); **Save Config**.

**Expected Result:**
- The config saves with a success message; reminder thresholds drive subscription event notifications.

---

### TC-M02 · Subscriptions list, filters, metrics

**Ref:** FLOW-12 · /subscriptions, /subscriptions/manage
**Actors:** test-admin

**Objective:** Verify the subscriptions list and metrics.

**Steps:**
1. Open **/subscriptions/manage**; search by email/name/ID; filter status (all/active/cancelled/grace_period/expired/trial).

**Expected Result:**
- Metrics (total, active, grace, cancelled, expired); table with user, tier, status badge, start/end dates, actions; filters work. (`/subscriptions?user_id=...` shows a single user's subscriptions.)

---

### TC-M03 · Extend / cancel / send reminder

**Ref:** FLOW-12 · /subscriptions/manage
**Actors:** test-admin

**Objective:** Verify per-subscription admin actions.

**Steps:**
1. On a subscription row, extend it, send a reminder, and cancel one (with confirmation).

**Expected Result:**
- Extend updates the period end; reminder triggers a notification; cancel (after confirmation) sets the subscription to cancelled.

---

## Group N — Referrals Admin

### TC-N01 · Referral configuration tab

**Ref:** FLOW-13 · /referrals
**Actors:** test-admin

**Objective:** Verify referral program configuration.

**Steps:**
1. Open **/referrals** → **Configuration**; set SP bonus reward, trial extension days, max referrals per user, expiry days, enable toggle; **Save Configuration**.

**Expected Result:**
- The config saves and drives referral rewards in the app.

---

### TC-N02 · Referral analytics tab

**Ref:** FLOW-13 · /referrals
**Actors:** test-admin

**Objective:** Verify referral analytics.

**Steps:**
1. Open **/referrals** → **Analytics**.

**Expected Result:**
- Total referrals, conversion rate, reward distribution, top referrers, and effectiveness metrics render.

---

## Group O — ID Badge Verification

### TC-O01 · ID badge queue + stats + status filter

**Ref:** FLOW-18/21/29 · /id-badges
**Actors:** test-admin

**Objective:** Verify the ID badge verification queue.

**Steps:**
1. Open **/id-badges**; review stats; search by name/email; filter All/Pending/Approved/Rejected.

**Expected Result:**
- Stats (Pending, Approved, Rejected, Avg Review Time); table with name, email, phone, node ZIP, status badge, submitted date, Review/View actions; filters work.

---

### TC-O02 · Review request — approve

**Ref:** FLOW-21/29 · /id-badges/[requestId]/review
**Actors:** test-admin

**Objective:** Verify approving an ID badge request.

**Steps:**
1. Open a pending request's **Review**; view the ID screenshot; select **Approve**, add optional notes; **Submit Decision**; confirm.

**Expected Result:**
- Confirmation "Are you sure you want to: approve?"; on confirm the request is approved, the user is notified, and the queue returns.

---

### TC-O03 · Review request — reject with reason

**Ref:** FLOW-21/29 · /id-badges/[requestId]/review
**Actors:** test-admin

**Objective:** Verify rejecting with a required reason.

**Steps:**
1. On a pending request's Review, select **Reject**; pick a rejection reason (unclear_photo / id_expired / name_mismatch / multiple_ids / not_government_id / other); add notes; Submit; confirm.

**Expected Result:**
- Reject requires a reason; on confirm the request is rejected with the reason and the user is notified.

---

### TC-O04 · Request details (screenshot deleted note)

**Ref:** FLOW-21/29 · /id-badges/[requestId]/details
**Actors:** test-admin

**Objective:** Verify the request details view and privacy note.

**Steps:**
1. Open a reviewed request's **Details**.

**Expected Result:**
- Shows user info, status badge, submitted/reviewed timestamps, rejection reason/notes or approval notes; a note states the ID screenshot was permanently deleted after the decision for privacy.

---

### TC-O05 · Message templates edit

**Ref:** FLOW-29 · /id-badges/messages
**Actors:** test-admin

**Objective:** Verify editing ID badge message templates.

**Steps:**
1. Open **/id-badges/messages**; edit a template (using variables like {first_name}, {rejection_reason}); Save.

**Expected Result:**
- The template saves with a success alert; variables are preserved for use in notifications.

---

## Group P — Badges & Sandbox

### TC-P01 · Badge management list + toggle

**Ref:** FLOW-18 · /badges
**Actors:** test-admin

**Objective:** Verify the badge management list.

**Steps:**
1. Open **/badges**; review the table; toggle a badge active/inactive.

**Expected Result:**
- Table shows name, category badge (color-coded), threshold, active toggle, icon, sort order, actions; toggling updates the status.

---

### TC-P02 · Create/edit/delete badge

**Ref:** FLOW-18 · /badges
**Actors:** test-admin

**Objective:** Verify badge CRUD.

**Steps:**
1. Create a badge (modal), edit it, then delete it.

**Expected Result:**
- The badge is created/edited/deleted and the list updates with success messages.

---

### TC-P03 · Manual award badge

**Ref:** FLOW-18 · /badges
**Actors:** test-admin

**Objective:** Verify manually awarding a badge.

**Steps:**
1. Click **Manual Award**; select a user, a badge, and a reason; submit.

**Expected Result:**
- The badge is awarded to the user (visible in their profile) and the action is logged.

---

### TC-P04 · Badge sandbox event simulation

**Ref:** FLOW-18 · /badges/sandbox
**Actors:** test-admin

**Objective:** Verify the badge sandbox.

**Steps:**
1. Open **/badges/sandbox**; select a test user; choose category (sp_earning/sp_spending), amount; **Simulate Event**.

**Expected Result:**
- A result shows whether a badge was awarded by the simulated event; errors are surfaced clearly. (Sandbox should not affect production-facing data beyond test users.)

---

## Group Q — Review Moderation

### TC-Q01 · Reported reviews list + reason filter

**Ref:** FLOW-08 reviews · /reviews
**Actors:** test-admin

**Objective:** Verify the reported reviews queue.

**Steps:**
1. Open **/reviews**; filter by reason All / Spam / Offensive / False Information / Other; page through.

**Expected Result:**
- Per-review cards show reviewer, reviewee, rating, comment snippet, report count, report reasons, hidden status, Hide/Approve actions; reason filter and pagination work. (Mirrors TradeFlow TC-Q18.)

---

### TC-Q02 · Hide review (confirmation)

**Ref:** FLOW-08 reviews · /reviews
**Actors:** test-admin

**Objective:** Verify hiding a review.

**Steps:**
1. On a reported review, click **Hide** and confirm.

**Expected Result:**
- Confirmation "Are you sure you want to hide this review?"; on confirm the review is hidden from profiles. (Mirrors TradeFlow TC-Q20 deletion vs hide.)

---

### TC-Q03 · Approve review (unhide + delete reports)

**Ref:** FLOW-08 reviews · /reviews
**Actors:** test-admin

**Objective:** Verify approving (unhiding) a reported review.

**Steps:**
1. On a hidden/reported review, click **Approve** and confirm.

**Expected Result:**
- Confirmation "This will unhide the review and delete all associated reports. Continue?"; on confirm the review is visible again and its reports are cleared. (Mirrors TradeFlow TC-Q19.)

---

## Group R — Education & FAQ CMS

### TC-R01 · Education sections/examples/analytics

**Ref:** FLOW-21 / FLOW-EDU-001 · /education
**Actors:** test-admin

**Objective:** Verify education content management.

**Steps:**
1. Open **/education**; switch tabs Sections / Examples / Analytics; create + edit + delete a section and an example.

**Expected Result:**
- Sections and examples can be created/edited/deleted/reordered; Analytics shows view counts and engagement; success/error messages auto-dismiss.

---

### TC-R02 · FAQ management (questions/categories/analytics)

**Ref:** FLOW-19/21 · /education/faq
**Actors:** test-admin

**Objective:** Verify FAQ management.

**Steps:**
1. Open **/education/faq**; review stat chips; switch tabs Questions / Categories / Analytics; create/edit a question; manage a category.

**Expected Result:**
- Stat chips (total, published, drafts, categories); Questions table with title, category, status, sort order, view count, actions; the form modal sets title, answer, category, sort order, draft/published; categories can be added/edited/deleted; analytics show view counts.

---

### TC-R03 · Publish FAQ / education content

**Ref:** FLOW-19/21 · /education/faq, /education
**Actors:** test-admin

**Objective:** Verify publishing content makes it live in the app.

**Steps:**
1. Publish a draft FAQ (and an education section); open the mobile app's FAQ/education screens.

**Expected Result:**
- Published content appears in the app's FAQ list / education Help screen; drafts do not.

---

## Group S — Support Messages

### TC-S01 · Support inbox + unread filter

**Ref:** FLOW-19 · /support
**Actors:** test-admin

**Objective:** Verify the support inbox.

**Steps:**
1. Open **/support**; note the unread badge; filter All / Unread / Read; click **Refresh**; mark a row read via the row icon.

**Expected Result:**
- "Support Messages" with an unread count badge; table with user, subject, status badge, created date, View Details; the inline mark-as-read updates without a full reload; filters/pagination work.

---

### TC-S02 · Support detail + mark as read

**Ref:** FLOW-19 · /support/[id]
**Actors:** test-admin

**Objective:** Verify the support message detail.

**Steps:**
1. Open a message's **View Details**; click **Mark as Read** (if unread).

**Expected Result:**
- Shows subject, status badge, from (name/email), contact info, submitted date/time, full message; Mark as Read changes the status; back navigation works.

---

## Group T — Analytics

### TC-T01 · Revenue & Analytics dashboard

**Ref:** FLOW-18 · /analytics
**Actors:** test-admin

**Objective:** Verify the revenue dashboard.

**Steps:**
1. Open **/analytics**; switch date range (7d/30d/90d/1y) and interval (day/week/month).

**Expected Result:**
- Cards for subscription revenue (active subscribers, MRR, ARR), transaction fee revenue (total, subscriber, non-subscriber), totals (total revenue, total users, ARPU), engagement (DAU, MAU, DAU/MAU), and a revenue time-series chart that responds to range/interval.

---

### TC-T02 · Notification analytics (category/type/variant)

**Ref:** FLOW-17 · /analytics/notifications
**Actors:** test-admin

**Objective:** Verify notification analytics.

**Steps:**
1. Open **/analytics/notifications**; pick a date range (7/14/30/60/90 days); filter by category and type.

**Expected Result:**
- By-category and by-type tables show variant, total sent, delivered, failed, opened, clicked, and delivery/open/click rates; per-channel (Email/In-App/Push) breakdown and A/B variant comparison render.

---

## Group U — Audit Logs

### TC-U01 · Audit logs view

**Ref:** FLOW-20 · /audit-logs
**Actors:** test-admin

**Objective:** Verify admin actions are recorded and viewable.

**Steps:**
1. Perform an auditable action elsewhere (e.g., node deactivate, SP adjust, policy publish).
2. Open **/audit-logs**.

**Expected Result:**
- The page shows recent admin/config actions (actor, action type, payload, timestamp); the actions performed appear in the log. (Note: this page may currently render a reference query — verify the latest entries are retrievable.)

---

## Group V — Monitoring & Cron

### TC-V01 · Monitoring run + alerts (acknowledge/note)

**Ref:** FLOW-28 · /monitoring
**Actors:** test-admin

**Objective:** Verify monitoring run and alert handling.

**Steps:**
1. Open **/monitoring**; click **[Re-run Monitor]**; on an alert, View Trade, Add Note, and Acknowledge.

**Expected Result:**
- Re-run produces a result; the alerts table shows type/severity, trade link, issue, status, created at; the trade modal and note modal work; acknowledging updates the alert status.

---

### TC-V02 · Cron jobs status + run history + timezone

**Ref:** FLOW-28 · /monitoring/cron
**Actors:** test-admin

**Objective:** Verify cron monitoring.

**Steps:**
1. Open **/monitoring/cron**; switch timezone and time period; review **Active Jobs** and **Recent Runs**; filter runs by status.

**Expected Result:**
- "⏰ Cron Jobs Monitoring"; Active Jobs table (name, schedule, command, active toggle, last status badge, last run, last message, next run); Runs history (name, schedule, status, run time, message); timezone changes the displayed times; status filter works; a failed run shows the error message.

---

## Group W — Sidebar Navigation (Grouped & Collapsible)

### TC-W01 · Sidebar grouped into 7 labeled sections

**Ref:** Global admin shell · left sidebar
**Actors:** test-admin

**Objective:** Verify the sidebar is grouped into the agreed sections instead of one flat list.

**Steps:**
1. Log in as **test-admin**; expand the sidebar to full width if collapsed.

**Expected Result:**
- The sidebar shows exactly 7 uppercase section labels: **OVERVIEW**, **TRADE OPERATIONS**, **USERS & TRUST**, **MONETIZATION**, **CATALOG**, **PLATFORM CONFIG**, **ANALYTICS**.
- Each section contains its expected items (e.g., TRADE OPERATIONS = Trades, Disputes, Flagged Items, Cancel Insights, Reviews; PLATFORM CONFIG = Config, Tax Rules, Tax Reports, Tax Settings, Tax Nodes, Cart Settings, Trade Timing, Policies, Support, Nodes).
- Dashboard sits alone under OVERVIEW; Analytics sits alone under ANALYTICS.

---

### TC-W02 · Expand / collapse a section via label + chevron

**Ref:** Global admin shell · left sidebar
**Actors:** test-admin

**Objective:** Verify each section header toggles its items and shows the correct chevron state.

**Steps:**
1. Click a section label (e.g., **MONETIZATION**).
2. Click it again.
3. Repeat for several sections and for sections with a single item (OVERVIEW, ANALYTICS).

**Expected Result:**
- Clicking the label or its chevron expands (items appear) / collapses (items hide) the section.
- The chevron points down when expanded and is rotated 90° when collapsed.
- The section label itself remains visible in both states.

---

### TC-W03 · Section state persists per admin across sessions

**Ref:** Global admin shell · left sidebar (localStorage `kids-admin:sidebar-sections:<email>`)
**Actors:** test-admin

**Objective:** Verify expanded/collapsed choices survive a reload and are scoped per admin.

**Steps:**
1. Collapse **MONETIZATION** and expand everything else.
2. Hard-refresh the page (or log out and log back in as **test-admin**).
3. Log in as a second admin account and observe.

**Expected Result:**
- After reload/login, **MONETIZATION** is still collapsed for **test-admin**; other sections remain expanded.
- The state is stored per admin email (a second admin does not see test-admin's layout).
- State is stored in the browser's localStorage under `kids-admin:sidebar-sections:*`.

---

### TC-W04 · Active route auto-expands its parent section

**Ref:** Global admin shell · left sidebar
**Actors:** test-admin

**Objective:** Verify the section containing the current page opens automatically even if it was previously collapsed.

**Steps:**
1. Collapse **PLATFORM CONFIG** and **TRADE OPERATIONS**.
2. Open **/tax/rules** (or any page inside a collapsed section).
3. Navigate to **/trades** afterwards.

**Expected Result:**
- On load and on navigation, the parent section of the active route auto-expands (e.g., PLATFORM CONFIG opens when on /tax/rules; TRADE OPERATIONS opens when on /trades).
- The active nav item is highlighted inside that section.

---

### TC-W05 · Active/inactive item styling + label typography

**Ref:** `docx/old/design-system.md` (Label style, Neutral 900/700, Primary 500 roles)
**Actors:** test-admin

**Objective:** Verify visual hierarchy: uppercase labels, active highlight, muted inactive text, 8px vertical rhythm.

**Steps:**
1. Open a page (e.g., **/users**) and inspect the sidebar.

**Expected Result:**
- Section labels are uppercase, ~12px, 500 Medium, 0.5px letter-spacing, in a readable light tone on the dark purple sidebar (sidebar base color `#3D1073` is unchanged).
- The active item (Users) has the brand-active background (`#5A2D9C`) with white text.
- Inactive items use a soft-white secondary tone (Neutral-700 role mapped for dark background).
- Items are spaced on the 8px grid; section groups have clear vertical separation.

---

### TC-W06 · Collapsed icon rail shows all destinations

**Ref:** Global admin shell · left sidebar
**Actors:** test-admin

**Objective:** Verify the narrow (icon-only) sidebar still exposes every destination.

**Steps:**
1. Click the sidebar toggle (hamburger) to collapse it to the icon rail.
2. Hover over several icons; click one.

**Expected Result:**
- All 30+ destinations are present as icons in the rail (section grouping is hidden in icon mode).
- Hovering an icon shows a tooltip with the item label.
- Clicking an icon navigates to the page; the page loads with the correct section auto-expanded when the sidebar is widened again.

---

### TC-W07 · All previous nav destinations still reachable

**Ref:** Global admin shell · left sidebar
**Actors:** test-admin

**Objective:** Verify the restructure removed no access — every page that was in the old flat sidebar is still reachable.

**Steps:**
1. Walk the full grouped sidebar; for each item, click through to its page.
2. Specifically confirm **Badges** (/badges) and **Listings** (/listings) are present (USERS & TRUST and CATALOG respectively).

**Expected Result:**
- Every destination from the old flat list is reachable — no dead links, no 404s.
- Badges and Listings remain reachable from the sidebar (they are also still available by direct URL).
- **Action Center** is present as a pinned OVERVIEW item and reachable at /action-center (see Group X).

---

## Group X — Action Center

### TC-X01 · Action Center page loads aggregated cards

**Ref:** FLOW-18 · /action-center
**Actors:** test-admin

**Objective:** Verify the Action Center aggregates every pending admin action into one page.

**Steps:**
1. Open **/action-center**.
2. Confirm the page shows a card for each source that currently has pending work (Flagged Items, Disputes, ID Badge Requests, Cancel Insights, Failed Payouts, Config Drift).

**Expected Result:**
- Page title "Action Center" with a description and a last-updated timestamp.
- One card per non-empty source; each card shows an icon, source label, a bundled summary line (e.g. "3 flagged listings pending review"), a severity pill, and an expand chevron.
- A Refresh button re-runs the aggregation.

---

### TC-X02 · Same-type items bundled with count

**Ref:** FLOW-18 · /action-center
**Actors:** test-admin

**Objective:** Verify same-type pending actions are bundled into ONE card with a count, not listed individually.

**Steps:**
1. Ensure at least two flagged items exist (status = flagged).
2. Open **/action-center**; inspect the Flagged Items card.

**Expected Result:**
- The Flagged Items card shows a single row with a count (e.g. "2 flagged listings pending review") — not two separate rows.
- The count matches the number of pending rows of that type in the database.

---

### TC-X03 · Severity tags (Urgent/Routine)

**Ref:** docx/old/design-system.md (Status Badge) · /action-center
**Actors:** test-admin

**Objective:** Verify each card shows the correct severity pill.

**Steps:**
1. Open **/action-center** with pending Disputes/Failed Payouts and pending Flagged Items/ID Badges.

**Expected Result:**
- Disputes and Failed Payouts show an **Urgent** pill (Error 500 red background, white text).
- Flagged Items, ID Badge Requests, Cancel Insights, and Config Drift show a **Routine** pill (Warning 500 yellow background, white text).
- Pills are Status-Badge style: ~24px height, 12px border radius.

---

### TC-X04 · Expand card drills into item list

**Ref:** FLOW-18 · /action-center
**Actors:** test-admin

**Objective:** Verify clicking a card expands it into the underlying list.

**Steps:**
1. Open **/action-center**; click a card with a count > 0 (e.g. Flagged Items).
2. Click the same card again to collapse.

**Expected Result:**
- Clicking expands the card to show each pending row (title/name, amount/date, relevant detail) plus an inline action per row.
- The chevron rotates; clicking again collapses back to the summary row.
- A "Open …" deep-link to the full module page appears at the bottom of the expanded panel.

---

### TC-X05 · Inline approve flagged item

**Ref:** FLOW-18/FLOW-04 · /action-center
**Actors:** test-admin

**Objective:** Verify an admin can approve a flagged listing from the Action Center without leaving the page.

**Steps:**
1. Open **/action-center**; expand **Flagged Items**.
2. Click **Approve** on one row.

**Expected Result:**
- A success toast appears ("Approved …").
- The row disappears from the list and the card count decreases by 1.
- The item is now available in the moderation queue (/items/flagged shows it as available).

---

### TC-X06 · Inline mark dispute under review

**Ref:** FLOW-27 · /action-center
**Actors:** test-admin

**Objective:** Verify an admin can advance a reported dispute to under review from the Action Center.

**Steps:**
1. Open **/action-center**; expand **Disputes**.
2. On a dispute whose status is `reported`, click **Under Review**.

**Expected Result:**
- A success toast appears ("Dispute marked under review.").
- The dispute status updates to `under_review`; the button no longer shows for that row (it shows only for `reported`).
- The dispute queue (/trades/disputes) reflects the updated status.

---

### TC-X07 · Inline retry failed payout (confirmation)

**Ref:** FLOW-25 · /action-center
**Actors:** test-admin

**Objective:** Verify an admin can retry a failed payout from the Action Center with a confirmation.

**Steps:**
1. Open **/action-center**; expand **Failed Payouts**.
2. Click **Retry** on a failed payout row and confirm.

**Expected Result:**
- A confirmation "Retry this payout? …" appears before the action commits.
- On confirm a success toast appears ("Payout reset to pending for retry.") and the row leaves the failed list.
- /payouts/earnings shows the payout back in pending status.

---

### TC-X08 · Empty state "All caught up"

**Ref:** docx/old/design-system.md (Success 500) · /action-center
**Actors:** test-admin

**Objective:** Verify the Action Center shows a clear empty state when the queue is clear.

**Steps:**
1. Resolve or remove all pending actions (approve/reject flagged items, resolve disputes, decide ID badge requests, retry failed payouts, reset drifted config values, and wait for any cancellation spike to age out).
2. Refresh **/action-center**.

**Expected Result:**
- Instead of a blank panel, the page shows an "All caught up" message with a Success 500 (green) checkmark icon.
- No cards are rendered when every source count is 0.

---

### TC-X09 · Sidebar pinned nav item + live count badge

**Ref:** FLOW-18 · left sidebar /action-center
**Actors:** test-admin

**Objective:** Verify the sidebar shows a pinned Action Center item with a live count badge.

**Steps:**
1. With pending actions present, open any admin page; inspect the sidebar's OVERVIEW section.
2. Click the **Action Center** item.

**Expected Result:**
- **Action Center** appears as the first (pinned) item under **OVERVIEW**.
- When there are pending actions, the item shows a small count badge with an Accent 500 (orange) background; the badge disappears when the queue is clear.
- Clicking navigates to /action-center and the item highlights as active.
- The count refreshes automatically (polling) without a manual page reload.

---

### TC-X10 · Header bell opens Action Center + badge

**Ref:** FLOW-18 · top navbar bell
**Actors:** test-admin

**Objective:** Verify the header notification bell opens the Action Center and shows a live count.

**Steps:**
1. With pending actions present, click the header **bell** icon.

**Expected Result:**
- The bell navigates to **/action-center** (no dead dropdown).
- The bell shows a small Accent 500 count badge equal to the total pending actions; the badge disappears when the queue is clear.

---

### TC-X11 · Config drift card lists out-of-range settings

**Ref:** FLOW-18 · /action-center
**Actors:** test-admin

**Objective:** Verify the Config Drift card surfaces settings outside their documented recommended range.

**Steps:**
1. Set an admin_config value outside its recommended range (e.g. `grace_period_days` to 200 via /config or /tax/settings).
2. Open **/action-center**; expand **Config Drift**.

**Expected Result:**
- The Config Drift card shows a count and, when expanded, lists the drifted key with its current value, documented default, and recommended range (e.g. "grace_period_days — Current 200 · documented default 90 · recommended 30–180").
- The **Review** action deep-links to /config to fix the value; resetting the value to within range removes the row on refresh.

---

### TC-X12 · Dashboard embeds top-5 Action Center cards + View all link

**Ref:** FLOW-18 · / (dashboard) · /action-center
**Actors:** test-admin

**Objective:** Verify the dashboard homepage embeds the top pending admin actions (up to 5 cards) with a **View all →** deep-link to the full Action Center page.

**Steps:**
1. Ensure pending actions exist across several sources (e.g. flagged items, disputes, ID badge requests, failed payouts, config drift).
2. Open the dashboard (`/`); inspect the embedded Action Center section below the health strip.
3. Click **View all →**.

**Expected Result:**
- The embedded section shows at most **5** source cards (the top pending items by source order); if more than 5 sources have pending work, only the first 5 render here.
- The section header includes **View all →** which navigates to `/action-center`.
- The full `/action-center` page still shows **every** source with pending work (no cap).
- When the queue is clear, the embedded section shows the "All caught up" empty state.

---

## Group Y — Command Palette & Global Search

**Ref:** FLOW-18 (Admin Controls) · Global — all admin pages · `admin_global_search` RPC (`20260809000001_admin_global_search.sql`)
**Actors:** test-admin (admin); test-non-admin (regular user, for TC-Y10)

### TC-Y01 · ⌘K / Ctrl+K opens the command palette from any page

**Objective:** Verify the global shortcut opens the palette from every admin page.

**Steps:**
1. Log in as test-admin; navigate to a few different pages (Dashboard, /users, /trades, /config).
2. On each page press **⌘K** (Cmd+K on macOS) or **Ctrl+K** (Windows).

**Expected Result:**
- The command palette modal opens each time, focused on its search input.
- Pressing ⌘K again (or Esc) closes it.

### TC-Y02 · Clicking the header search bar opens the palette

**Objective:** Verify the top navbar search bar is the palette trigger.

**Steps:**
1. Click the **Search…** pill in the top navbar (or the search icon).
2. Optionally, tab to it and press Enter.

**Expected Result:**
- The palette opens with the input focused.
- The existing `topbar-global-search` input remains visible in the header.

### TC-Y03 · Parallel search across four entity types with grouped labels

**Objective:** Verify one query returns Settings, Users, Listings, and Trades grouped results.

**Steps:**
1. Open the palette and type a term likely to hit multiple types (e.g. `sara` for a user email/name, or `bike` for a listing).
2. Observe the results.

**Expected Result:**
- Results render grouped by type with an uppercase section label per group (Settings / Users / Listings / Trades).
- Empty groups are omitted.
- All four groups are fetched in a single search (parallel, not sequential).

### TC-Y04 · Breadcrumb context per result row

**Objective:** Verify each row shows where the result lives.

**Steps:**
1. Search for a setting key (e.g. `sms`), a user email, an item title, and a trade ID.

**Expected Result:**
- Each row shows breadcrumb context, e.g. `Config → SMS → sms_twilio_account_sid`, `Users → Sara Ahmed`, `Listings → Blue Backpack`, `Trades → b1f6a59f…`.

### TC-Y05 · Input is debounced (~200ms)

**Objective:** Verify typing does not fire a request per keystroke.

**Steps:**
1. Open the palette; type a query character-by-character without pausing.

**Expected Result:**
- The RPC fires roughly once ~200ms after typing stops, not per keystroke (observable via network tab / fast typing).

### TC-Y06 · Top 5 per group + "See all N results" expansion

**Objective:** Verify the top-N cap and inline expansion.

**Steps:**
1. Search a broad term (e.g. `a`) so a group exceeds 5 matches.

**Expected Result:**
- Each group shows up to 5 rows initially.
- A "See all N results" button appears when a group has more than 5; clicking it expands that group in place to show more (up to 25).

### TC-Y07 · Footer "View all in <domain>" navigates to the prefilled list page

**Objective:** Verify the footer deep-links to the matching list page.

**Steps:**
1. Search `sara`; click the footer **View all users →**, **View all listings →**, or **View all trades →**.

**Expected Result:**
- Users → `/users?search=sara` (users list prefilled and filtered).
- Listings → `/listings?tab=search&q=sara` (Search tab open, query prefilled, results filtered).
- Trades → `/trades?search=sara` (trade list filtered).

### TC-Y08 · Selecting a result navigates directly

**Objective:** Verify a row click (or Enter) navigates to the item/page.

**Steps:**
1. Search for a user, a listing, a trade ID, and a setting; select one of each.

**Expected Result:**
- Settings row → opens `/config` on the matching tab.
- Users row → opens `/users?search=<user_id>` (user surfaced in the list).
- Listings row → opens `/listings?tab=search&q=<id>` (listing surfaced).
- Trades row → opens `/trades/<trade_id>` (trade detail page).
- The palette closes after navigation.

### TC-Y09 · Keyboard navigation (↑/↓/↵/Esc) + focus trap

**Objective:** Verify keyboard-only use of the palette.

**Steps:**
1. Open the palette; type a query; use **ArrowDown/ArrowUp** to highlight rows, **Enter** to open the highlighted row, **Esc** to close, **Tab** to cycle within the modal.

**Expected Result:**
- Highlight moves with arrows (active row gets a highlight + right arrow).
- Enter opens the highlighted result and closes the palette.
- Esc closes; Tab stays inside the modal until the modal is closed (focus trap).

### TC-Y10 · Non-admin rejected (permission scoping)

**Objective:** Verify results are scoped to admins only.

**Steps:**
1. Log in as test-non-admin (a regular authenticated user).
2. Open the palette and search.

**Expected Result:**
- The palette shows an unavailable/forbidden message ("Only admins can use global search") and no entity results — settings/users/listings/trades are never exposed to non-admins.

### TC-Y11 · Secret settings values are never shown

**Objective:** Verify `is_secret` config rows do not leak their value.

**Steps:**
1. Search for a secret key's name (e.g. a Twilio/Stripe secret) or its value.

**Expected Result:**
- The row may appear by key/description but the secret **value** is never displayed in the palette and secret values are not matched as search terms.

### TC-Y12 · Empty + no-results states

**Objective:** Verify the palette's initial and empty states.

**Steps:**
1. Open the palette with an empty query; then type a term with no matches (e.g. `zzzzznope`).

**Expected Result:**
- Empty query shows the hint ("Search across settings, users, listings, and trades.").
- No matches shows "No results for …" with a friendly tip. Neither state errors out.

---

## Group Z — Dashboard Health Strip

### TC-Z01 · Health strip renders below title, above Action Center

**Ref:** FLOW-18 · / (dashboard)
**Actors:** test-admin

**Objective:** Verify the dashboard homepage shows the always-visible health strip below the page title and above the embedded Action Center.

**Steps:**
1. Log in and open the dashboard (`/`).

**Expected Result:**
- Below the "Welcome to Admin Portal" title, a single-row strip with a Neutral-100 background renders.
- The strip sits **above** the embedded Action Center section.
- The strip persists without requiring a scroll or toggle.

---

### TC-Z02 · Six indicators with colored dots + labels + values

**Ref:** FLOW-18 · / (dashboard)
**Actors:** test-admin

**Objective:** Verify all six health indicators render with a dot, label, and value.

**Steps:**
1. Open the dashboard (`/`); inspect the health strip.

**Expected Result:**
- Indicators present: **Payments**, **Email Delivery**, **Nodes Active**, **Failed Payouts**, **Uptime**, **GMV (7d)**.
- Each shows an 8px colored dot, a 12px label (Neutral 700), and its current value (e.g. "1.2%", "98.4%", "14/14", "3", "99.9%", "$12450").

---

### TC-Z03 · Dot color reflects configurable thresholds

**Ref:** FLOW-18 · / (dashboard) · `admin_health_summary()`
**Actors:** test-admin

**Objective:** Verify each dot is green/yellow/red based on its value vs. the configured thresholds (Success 500 / Warning 500 / Error 500).

**Steps:**
1. Open the dashboard and note each dot color.
2. Trigger a warning state (e.g. set `health_payment_failure_warn_pct` to `0` so any failure is a warning, or set `health_failed_payouts_warn` to `0`).
3. Refresh; confirm affected dots turn yellow.
4. Trigger a critical state (e.g. set `health_payment_failure_crit_pct` to `0`); confirm the dot turns red.

**Expected Result:**
- Healthy = green `#4CAF50`, warning = yellow `#FFA726`, critical = red `#E53935`.
- Dot changes happen after editing thresholds + refresh, with NO code change.

---

### TC-Z04 · Clicking an indicator navigates to its detail page

**Ref:** FLOW-18 · / (dashboard)
**Actors:** test-admin

**Objective:** Verify each indicator deep-links to the relevant page.

**Steps:**
1. Open the dashboard; click each indicator in turn.

**Expected Result:**
- Payments → `/payments?status=failed`
- Email Delivery → `/monitoring`
- Nodes Active → `/nodes`
- Failed Payouts → `/payouts/earnings?status=failed`
- Uptime → `/monitoring`
- GMV (7d) → `/analytics`

---

### TC-Z05 · Failed Payouts deep-link pre-filters to failed

**Ref:** FLOW-18 · /payouts/earnings
**Actors:** test-admin

**Objective:** Verify clicking **Failed Payouts** opens the Payouts page already filtered to failed.

**Steps:**
1. Open the dashboard; click **Failed Payouts**.

**Expected Result:**
- The Payouts page loads with the status filter set to **Failed** (rows filtered to `status=failed`).
- Changing the filter to All still works.

---

### TC-Z06 · Thresholds tunable via /config without code change

**Ref:** FLOW-18 · /config
**Actors:** test-admin

**Objective:** Verify health thresholds are stored in admin_config (category **health**) and editable through the config surface.

**Steps:**
1. Open `/config`; confirm a **Health** category tab is present with the `health_*` keys.
2. Edit a threshold (e.g. `health_gmv_warn_usd`), save, reload the dashboard.

**Expected Result:**
- The health keys persist after save (single source, editor recorded via `upsert_admin_config_setting`).
- The dashboard dot for that indicator reflects the new threshold without any code change.

---

### TC-Z07 · Dashboard embeds Action Center below the strip

**Ref:** FLOW-18 · / (dashboard)
**Actors:** test-admin

**Objective:** Verify the Action Center renders as an embedded section below the health strip, showing the top pending items (up to 5 cards) with the KPI stat cards underneath.

**Steps:**
1. Open the dashboard; confirm the Action Center section below the strip shows up to 5 source cards (or the "All caught up" empty state).
2. Click **View all →** in the embedded header.
3. Confirm the KPI stat cards render below the Action Center section.

**Expected Result:**
- The embedded Action Center behaves like the standalone page (cards, expand/drill, inline actions) but is capped at the top 5 pending sources.
- **View all →** navigates to `/action-center`.
- The KPI stat cards (Trade Analytics + SP Economy) sit below the Action Center section.

---

## Regression

### TC-R01 · Admin session persists across pages
**Objective:** Confirm the admin session stays valid navigating between areas.
**Steps:** 1. Log in; navigate across several areas; refresh a page.
**Expected Result:** No re-login required; pages load with data.

### TC-R02 · Confirmation required for destructive/financial actions
**Objective:** Confirm suspend/ban/delete, dispute refund, payout retry, SP adjust, and policy publish each show a confirmation.
**Steps:** 1. Trigger each action and observe.
**Expected Result:** Each prompts a confirmation before committing.

### TC-R03 · Admin config changes reflect in the mobile app
**Objective:** Confirm config edits (cart, trade-timing, fees, referral, grace) reach the app.
**Steps:** 1. Change a config; reload the corresponding app screen.
**Expected Result:** The app reflects the new value.

### TC-R04 · Read-only mode when write permission absent
**Objective:** Confirm `can_write = false` makes config read-only.
**Steps:** 1. Access /config (or /payouts) without write permission.
**Expected Result:** Inputs are disabled; saves are not possible.

### TC-R05 · Auditable actions logged
**Objective:** Confirm key admin actions appear in audit logs.
**Steps:** 1. Perform node deactivate / SP adjust / policy publish; check /audit-logs.
**Expected Result:** Each appears with actor + timestamp.

---

## Group N2 — Idempotency & Audit (Cross-Cutting)

**Ref:** SYSTEM_REQUIREMENTS_V2 §8B (N2) · Migration `20260810000006_n2_idempotency_audit.sql`
**Scope:** Payment / SP / fee / tax mutations are now retry-safe and audited. These cases verify the server-side guards from the admin side (audit journal, SP adjustments, refunds, payouts). No client changes.
**Added:** 2026-08-09

### TC-N2-A01 · Financial audit journal viewable per trade
**Objective:** Verify the unified `financial_audit_log` journal shows every payment/SP/fee/tax transition for a given trade.
**Steps:**
1. Open a trade that completed with SP + tax (or run the audit query for its trade id):
```sql
SELECT mutation_type, amount_cents, actor_id, created_at FROM financial_audit_log
WHERE entity_id='<trade_id>' ORDER BY created_at ASC;
```
2. Walk the trade lifecycle and re-query after each transition.
**Expected Result:** One row per transition — `offer_created`, `payment_intent_created`, `buyer_fee_charged`, `tax_quoted`, `payment_captured`, `sp_released`, `seller_fee_deducted`, `trade_completed`, `payout_*` — chronological, with actor + amount. No duplicates (idempotency keys).

### TC-N2-A02 · Admin SP adjustment — double-click cannot double-credit
**Objective:** Verify two identical SP adjustments (same idempotency key) credit the wallet once.
**Steps:**
1. Adjust a wallet by +10 SP with an explicit `p_idempotency_key` (e.g. `admin_adj_dod_test`), then repeat the exact same call.
2. Verify ledger + balance:
```sql
SELECT available_balance FROM sp_wallets WHERE user_id='<user>';
SELECT count(*) FROM sp_ledger WHERE idempotency_key='admin_adj_dod_test';
SELECT count(*) FROM financial_audit_log WHERE idempotency_key='admin_adj_dod_test';
```
**Expected Result:** Balance +10 exactly once; the second call returns `idempotent: true`; exactly one `sp_ledger` entry and one `sp_issued` audit row. A same-second double-click with no explicit key is deduped by the derived per-minute key.

### TC-N2-A03 · Duplicate refund attempt rejected (no double refund)
**Objective:** Verify a re-issued refund (or a re-delivered `charge.refunded` webhook) for an already-refunded trade cannot double-refund.
**Steps:**
1. Issue a full refund (force-cancel / dispute-refund / manual).
2. Re-issue the same refund or re-deliver the webhook for the same PI.
3. Check ledger:
```sql
SELECT count(*) FROM trade_refunds WHERE stripe_refund_id='<refund_id>';
SELECT refunded_cents, charged_cents FROM payments WHERE trade_id='<trade_id>';
SELECT count(*) FROM financial_audit_log WHERE idempotency_key='refund_<refund_id>';
```
**Expected Result:** Exactly one `trade_refunds` row per Stripe refund id (unique partial index); `refunded_cents` never exceeds `charged_cents`; a single `refund_issued` audit row — no double refund.

### TC-N2-A04 · Payout — single row per trade, single transfer
**Objective:** Verify a retried payout trigger does not create a second `seller_payouts` row or a second Stripe transfer.
**Steps:**
1. Trigger `initiate-payout` (or the payout trigger) for the same trade twice.
2. Check counts:
```sql
SELECT count(*) FROM seller_payouts WHERE trade_id='<trade_id>';
SELECT count(*) FROM trades WHERE id='<trade_id>' AND stripe_transfer_id IS NOT NULL;
SELECT mutation_type, idempotency_key FROM financial_audit_log WHERE entity_id='<trade_id>' AND mutation_type LIKE 'payout_%';
```
**Expected Result:** Exactly one `seller_payouts` row and one `stripe_transfer_id`; one `payout_initiated`/`payout_paid` (or `requires_action`/`failed`) audit row per transition, keyed by `payout_<trade_id>` — no duplicate payout.

### TC-N2-A05 · Financial Audit screen accessible from sidebar + renders
**Objective:** Verify the new **Financial Audit** screen (`/audit`) is reachable from the sidebar and renders the N2 journal UI.
**Steps:**
1. Log in to the admin portal; open the sidebar → **Monetization** → **Financial Audit** (route `/audit`).
2. Confirm the page loads with: title "Financial Audit", the N2 description, filter bar (search, Mutation type, Entity type, From, To), summary strip (Entries + Payments/Swap Points/Fees/Tax/Payouts/Refunds/Trade + Cash Movement), and a table area.
3. With no journal rows yet, confirm the friendly empty state appears.
**Expected Result:** The sidebar link navigates to `/audit`; the page renders all controls; the empty state reads "No audit entries yet. The journal is written as payments, Swap Points, fees, and taxes move — run a trade to see it populate." — no crash, no 401.

### TC-N2-A06 · Financial Audit — search & filters
**Objective:** Verify the audit screen can search and filter the journal.
**Steps:**
1. On `/audit`, use the **Mutation type** dropdown (all 27 types listed, e.g. Payment Captured, SP Released, Refund Issued).
2. Use the **Entity type** dropdown (trade / refund / payment / payout / wallet / listing).
3. Search by a **trade id**, an **entity id**, or an **idempotency key** (e.g. `offer_<trade_id>`, `sp_release_<trade_id>`).
4. Set **From / To** dates and observe the filtered window.
5. Clear all filters and confirm the full journal returns.
**Expected Result:** Each filter narrows the table; search by trade/entity/idempotency key works (text-cast view `admin_financial_audit_view`); combined filters (type + search + date) apply together; clearing filters restores all rows.

### TC-N2-A07 · Financial Audit — row details, trade link, amount formatting
**Objective:** Verify each journal row shows correct details and the expandable before/after state.
**Steps:**
1. Open a trade that has audit rows (submit an offer, complete it, refund it — or use existing rows).
2. In the table, confirm each row shows Time, Type pill (colored), Entity, Amount, Actor, Node, Idempotency key, and a **View** toggle.
3. Tap **View** on a row and confirm the **Before/After** JSON blocks expand.
4. Click the **Entity** link on a `trade` row and confirm it opens `/trades/<trade_id>`.
5. Confirm amount formatting: `sp_*` rows show "N SP" (no $), cash/fee/tax/payout rows show `$X.XX` from cents.
**Expected Result:** Rows are chronological (newest first); type pills are color-coded by category; before/after JSON renders readable; the trade link navigates to the trade detail; SP amounts display as SP units and money amounts in dollars.

### TC-N2-A08 · Financial Audit — summary strip reconciles with journal
**Objective:** Verify the summary counts and Cash Movement reconcile with the filtered rows.
**Steps:**
1. On `/audit` with no filters, note **Entries** and the per-category counts (Payments / Swap Points / Fees / Tax / Payouts / Refunds / Trade).
2. Apply a **Mutation type** filter (e.g. `Refund Issued`) and confirm the Entries count and the Refunds count both drop to that subset, and **Cash Movement** reflects the refunded total.
3. Cross-check one row against `SELECT mutation_type, amount_cents FROM financial_audit_log WHERE entity_id='<trade_id>' ORDER BY created_at DESC;`
**Expected Result:** Entries equals the number of table rows; category counts match the type pills in view; Cash Movement equals the sum of non-SP `amount_cents` in the filtered set; the table matches the underlying journal.

---

## Group FE — Tiered Buyer-Fee Configuration (R1 — first-trade protection) (New Implementation)

> Added 2026-08-09. Covers the admin side of the tiered buyer-fee engine: dynamic
> fee config (flat for active members / first-trade, % + fixed capped for free users
> with 1+ completed trades), fee-tier distribution stats, and the analytics breakdown.
> All amounts are DYNAMIC from `admin_config` (category `fees`) and take effect on new
> checkouts immediately — no deploy needed.
>
> Config keys: `buyer_fee_active_member_cents`, `buyer_fee_first_trade_cents`,
> `buyer_fee_subsequent_percentage`, `buyer_fee_subsequent_fixed_cents`,
> `buyer_fee_subsequent_max_cents`, `buyer_fee_label`. Editable on
> **Settings → Trade Timing** (Tiered Buyer Fee section). Legacy buyer fee keys
> (`transaction_fee_subscriber_cents`, `transaction_fee_non_subscriber_cents`,
> `platform_fee_buyer_fixed_cents`, `platform_fee_buyer_percentage`) are DEPRECATED.

### TC-FE-01 · View tiered buyer-fee config
**Objective:** Verify the admin can see all tiered buyer-fee keys.
**Steps:**
1. Go to **Settings → Trade Timing**.
2. Expand the **Tiered Buyer Fee — R1** section.
**Expected Result:** All six keys are visible with their live values (seed defaults: 149 / 149 / 5.0 / 199 / 499 / "Safety & Platform Fee") and "Last updated by" metadata.

### TC-FE-02 · Edit tiered fee config with validation
**Objective:** Verify edits save and validation blocks bad values.
**Steps:**
1. Change `buyer_fee_subsequent_fixed_cents` to 250 and save.
2. Try setting `buyer_fee_subsequent_percentage` to 150 (invalid).
3. Try setting `buyer_fee_subsequent_max_cents` below `buyer_fee_subsequent_fixed_cents` (invalid).
4. Try an empty `buyer_fee_label`.
**Expected Result:** Valid values save and appear in `admin_config` (via `upsert_admin_config_setting`, category `fees`). Invalid values show inline errors and block the save: percentage must be 0–100, cap must be ≥ fixed fee, label cannot be empty.

### TC-FE-03 · Fee changes take effect on the next checkout (dynamic)
**Objective:** Verify changes apply without a deploy.
**Steps:**
1. Set `buyer_fee_first_trade_cents` to a new value (e.g. 199).
2. As a free first-trade buyer, submit an offer on the mobile app.
**Expected Result:** The new value is charged immediately (`buyer_transaction_fee_cents` on the new trade = 199). No rebuild/redeploy needed.

### TC-FE-04 · Fee-tier distribution panel (Trade Timing)
**Objective:** Verify "how many users are in each tier vs out" on the Trade Timing page.
**Steps:**
1. Open **Settings → Trade Timing**.
2. Scroll to the **Buyer Fee-Tier Distribution** panel.
3. Compare to `SELECT fee_state, COUNT(*) FROM profiles GROUP BY fee_state;`
**Expected Result:** The panel lists each `fee_state` with a user count and a Flat/Percentage badge; flat = active_member + no_completed_trade + first_trade_in_progress; percentage = first_trade_completed + subsequent_free. Counts match the SQL.

### TC-FE-05 · Analytics page fee-tier breakdown
**Objective:** Verify the Analytics page shows the fee-tier breakdown.
**Steps:**
1. Open **Analytics**.
2. Locate the **Buyer Fee-Tier Distribution** card.
**Expected Result:** The card shows flat vs percentage user counts and percentages, plus a per-state table. Totals reconcile with `fn_admin_get_fee_tier_stats`.

### TC-FE-06 · Legacy buyer-fee keys deprecated
**Objective:** Confirm legacy fee keys are no longer the source of truth for the buyer fee.
**Steps:**
1. Change `transaction_fee_non_subscriber_cents` to a value (e.g. 999).
2. Submit a first-trade offer on mobile.
**Expected Result:** The charged fee is still the tiered first-trade fee (149 default), NOT the legacy value. The tiered keys are authoritative.

### TC-FE-07 · Fee config edits are audited
**Objective:** Verify fee config changes record the acting admin.
**Steps:**
1. Edit a tiered fee key on the Trade Timing page.
2. Check `admin_config.updated_by` for that key and the audit log.
**Expected Result:** `admin_config.updated_by` is set to the acting admin (via `upsert_admin_config_setting` with `p_admin_id`), and the admin audit log records the change. No direct table writes bypass the RPC.

### TC-FE-08 · Buyer fee-state visible in trade data
**Objective:** Verify the buyer's tier snapshot is stored per trade.
**Steps:**
1. After a buyer completes a checkout, run `SELECT id, buyer_fee_state, buyer_transaction_fee_cents FROM trades WHERE buyer_id='<buyer>' ORDER BY created_at DESC;`
**Expected Result:** Each trade has a `buyer_fee_state` snapshot (the tier at offer time) and the server-computed `buyer_transaction_fee_cents`.

---

## Group R3 — Delayed Seller Payout (Admin) (New Implementation)

> **Status:** Newly implemented 2026-08-10 (R3 — Delayed Seller Payout + Buffer, enforcement).
> These cases are **NOT yet executed**. They verify the admin side of the payout buffer:
> `payout_buffer_days` (default 2, 0–30) is now ENFORCED — payouts release on a stored
> `payout_release_at` (actual `trades.completed_at` + buffer), funds sit in `seller_balance.pending_balance_cents`
> until release, and the `release-due-payouts` cron (→ EF → `rpc_release_due_payouts`) dispatches due payouts.
> The config key itself was already tunable (TC-F05); R3 adds the enforcement and the admin visibility.
>
> Migration: `20260810000008_r3_delayed_payout_buffer.sql`. Surfaces: `/payouts/earnings`, `/trades/pipeline`, `/settings/trade-timing`.
> Functions: `release-due-payouts` (EF), `initiate-payout` (updated), `rpc_release_due_payouts`, `get_admin_payouts` (now returns `payout_release_at`), `admin_trades_view` (now exposes `payout_release_at`).

### TC-R3-01 · Scheduled payouts visible in the Payouts list with release dates

**Ref:** R3 (2026-08-10) · FLOW-25 · `/payouts/earnings`
**Actors:** test-admin
**Precondition:** Migration `20260810000008_r3_delayed_payout_buffer.sql` applied; at least one buffered `pending` payout exists (`payout_release_at` in the future).

**Objective:** Verify the admin Payouts management list shows a pending payout's scheduled release date.

**Steps:**
1. Open **Monetization → Payouts** (route `/payouts/earnings`).
2. Find a `PENDING` payout and confirm a green **"Releases [date]"** line appears under its status badge.
3. Confirm the API returns the field: `curl`/inspect `/api/admin/payouts` → each payout includes `payout_release_at`.
4. Confirm a payout with a past release date (or `processing`/`paid`) shows no release line.

**Expected Result:**
- Pending buffered payouts show "Releases [date]" (from `get_admin_payouts.payout_release_at`).
- Non-buffered / released payouts are unchanged.

### TC-R3-02 · payout_buffer_days enforcement — new completions use the edited value (no deploy)

**Ref:** R3 · N1 configurability (TC-F05) · `/settings/trade-timing`
**Actors:** test-admin + test-seller
**Precondition:** `payout_buffer_days` currently 2; migration applied.

**Objective:** Verify changing `payout_buffer_days` changes the payout release date on NEW completions, and buffer 0 = immediate.

**Steps:**
1. Open **Settings → Trade Timing → Pickup & Payout**; set **Payout Buffer = 5**; Save (validation 0–30).
2. Complete a cash trade (as the test seller's counterparty) and confirm `trades.payout_release_at = completed_at + 5 days` and the payout row is `pending`.
3. Set **Payout Buffer = 0**; complete another trade and confirm the payout dispatches immediately (`processing`/`paid`) with `payout_release_at = completed_at`.
4. Revert to the default (2). Confirm an EARLIER buffered payout's stored release date did not change.
5. Confirm the change is audited: `SELECT key, value, updated_by, updated_at FROM admin_config WHERE key='payout_buffer_days';` and the `update_trade_timing_settings` audit row.

**Expected Result:**
- New completions read the live `payout_buffer_days` (`fn_admin_config_int`) and store the corresponding release date; existing payouts keep theirs.
- Buffer 0 preserves immediate payout (regression); the config change records the editor + audit trail (BP-48).

### TC-R3-03 · Release via cron — payout → processing/paid, balance moves, no double payout

**Ref:** R3 · `release-due-payouts` EF + `rpc_release_due_payouts` · FLOW-25
**Actors:** test-admin + test-seller
**Precondition:** A buffered `pending` payout exists with `payout_release_at` in the future; seller has a verified method.

**Objective:** Verify the release processor dispatches due payouts exactly once and moves `seller_balance` pending → available.

**Steps:**
1. Fast-forward the release date: `UPDATE trades SET payout_release_at = now() - interval '1 minute' WHERE id='<trade_id>';` (mirror on `seller_payouts`).
2. Invoke the processor (either the cron by waiting for the hour, or manually via the EF / `SELECT public.rpc_release_due_payouts(100);`).
3. Confirm `payout_status` moved to `processing`/`paid` (or `requires_action` on provider failure) and `stripe_transfer_id` is set.
4. Confirm `seller_balance.available_balance_cents` increased and `pending_balance_cents` decreased by the same proceeds.
5. Re-run the processor and confirm the trade is not re-selected and there is still exactly ONE `seller_payouts` row and ONE `stripe_transfer_id`:
```sql
SELECT count(*) FROM seller_payouts WHERE trade_id='<trade_id>';
SELECT count(*) FROM trades WHERE id='<trade_id>' AND stripe_transfer_id IS NOT NULL;
SELECT mutation_type, idempotency_key FROM financial_audit_log WHERE entity_id='<trade_id>' AND mutation_type LIKE 'payout_%';
```

**Expected Result:**
- The payout dispatches exactly once after the release date; `seller_balance` moves pending → available once; idempotent re-runs add nothing (TC-N2-A04 still holds).

### TC-R3-04 · Trade Pipeline shows the payout release date on Completed cards

**Ref:** R3 · `/trades/pipeline` · `admin_trades_view.payout_release_at`
**Actors:** test-admin
**Precondition:** A `completed` trade has `payout_release_at` in the future (buffered payout); migration applied.

**Objective:** Verify the Trade Pipeline board surfaces the scheduled payout release date on Completed cards.

**Steps:**
1. Open **Trade Operations → Trade Pipeline** (`/trades/pipeline`).
2. Find a **Completed** card with a buffered payout and confirm it reads "Completed [date] · Payout releases [date]".
3. Confirm the pipeline data includes the field: inspect `admin_trades_view`:
```sql
SELECT id, status, payout_status, payout_release_at FROM admin_trades_view WHERE status='completed' ORDER BY created_at DESC LIMIT 10;
```

**Expected Result:**
- Completed cards with a future `payout_release_at` show the release date; released payouts show no extra text.
- `admin_trades_view` exposes `payout_release_at` (appended column, backward compatible).

---

## Group FE2 — Tiered Buyer-Fee on Subscription Marketing Screens (R1) (New Implementation)

> Added 2026-08-09. Verifies the admin-configured tiered buyer fee drives the MOBILE
> subscription marketing/plan screens. The screens read the flat active-member fee via
> `getActiveMemberFeeCents()` (dynamic from `admin_config.buyer_fee_active_member_cents`,
> force-refresh bypasses the 5-min cache) and the label from `buyer_fee_label`. The legacy
> `transaction_fee_subscriber_cents` / `transaction_fee_non_subscriber_cents` keys are no
> longer read by these screens.

### TC-FE2-01 · `buyer_fee_active_member_cents` drives the marketing screens
**Objective:** Verify an admin change to the flat member fee propagates to the mobile subscription screens.
**Steps:**
1. On **Settings → Trade Timing → Tiered Buyer Fee**, set `buyer_fee_active_member_cents` to 199 and save.
2. On the mobile app, open **Plan Comparison**, **Kids Club Overview**, **Manage Kids Club**, and **Subscription Payment** (remount each).
**Expected Result:** All four show "$1.99 flat" / "Pay a flat $1.99 …" (the new value) — none show the cached $1.49. The marketing screens call `getActiveMemberFeeCents(true)` so the change is immediate.
3. Restore `buyer_fee_active_member_cents` to 149.

### TC-FE2-02 · Legacy buyer-fee keys are no longer read by the marketing screens
**Objective:** Confirm the screens stopped using the legacy fee keys.
**Steps:**
1. On **Settings → Trade Timing**, change `transaction_fee_subscriber_cents` (e.g., to 999) and `transaction_fee_non_subscriber_cents` (e.g., to 999).
2. Open the 4 subscription screens.
**Expected Result:** The screens still show the tiered flat fee (149 default / whatever `buyer_fee_active_member_cents` is) — the legacy 999 values do NOT appear. The legacy keys are retained for backward compatibility but are no longer the source of truth for marketing copy.
3. Restore the legacy keys.

### TC-FE2-03 · `buyer_fee_label` drives the fee label on marketing screens
**Objective:** Verify the configurable fee label appears on the subscription screens.
**Steps:**
1. On **Settings → Trade Timing → Tiered Buyer Fee**, set `buyer_fee_label` to "Safety & Platform Fee" (or a custom label) and save.
2. Open the 4 subscription screens.
**Expected Result:** The fee copy uses the configured label (e.g., "Pay a flat $1.49 Safety & Platform Fee on every trade"). Changing the label updates the marketing copy on the next load.

### TC-FE2-04 · `charge_one_fee_per_bundle` is a single-source setting (managed only on Trade Timing)
**Objective:** Verify the one-fee-per-bundle flag has exactly ONE admin owner so two surfaces can never disagree.
**Steps:**
1. Open **Config → Fees** (`/config?tab=fees`).
2. Confirm the **Charge One Fee Per Bundle** toggle is NOT rendered there.
3. Confirm the "Open Trade Timing Settings" cross-link banner still shows on the fees tab.
4. Open **Settings → Trade Timing → Transaction Fees** and confirm the **Charge One Fee Per Bundle** toggle IS present, reads the live value (`Enabled`/`Disabled`), and can be changed.
5. Save a change on Trade Timing and confirm `/config?tab=fees` does not render a conflicting toggle for the same key.
**Expected Result:**
- `/config` no longer renders the editable toggle (single-source; hidden to prevent two pages with different fallback defaults from flipping the same `admin_config` row).
- The Trade Timing toggle is the only editor; the cross-link banner preserves discoverability from `/config`.

### TC-FE2-05 · All fee keys are single-source on Trade Timing (no editable duplicates on /config)
**Objective:** Verify the whole fee-config surface is consolidated — Trade Timing is the only editor for every fee key it renders.
**Steps:**
1. Open **Config → Fees** (`/config?tab=fees`).
2. Confirm NONE of these are rendered as editable items (they live on Trade Timing): `transaction_fee_subscriber_cents`, `transaction_fee_non_subscriber_cents`, `platform_fee_seller_percentage`, `platform_fee_seller_discount_percentage_kids_club_plus`, `platform_fee_buyer_fixed_cents`, `platform_fee_buyer_percentage`, `charge_one_fee_per_bundle`, `buyer_fee_*` (all 6), plus legacy keys `transaction_fee_member_cents`, `transaction_fee_non_member_cents`, `platform_fee_seller_discount_percentage_freemium`.
3. Confirm the "Open Trade Timing Settings" cross-link banner still shows on the fees tab.
4. Open **Settings → Trade Timing** and confirm all the above keys are still rendered + editable there (Transaction Fees + Tiered Buyer Fee + Legacy fee keys sections).
5. Confirm the fees tab still shows keys NOT owned by Trade Timing (e.g., Stripe fees, min transaction, min listing, min withdrawal, payout buffer, dispute fee).
6. On **Trade Timing → Transaction Fees**, confirm the "Legacy fee keys (audit only)" section renders the three legacy keys (`transaction_fee_member_cents`, `transaction_fee_non_member_cents`, `platform_fee_seller_discount_percentage_freemium`) with a clear note that they are NOT read by the current checkout.
**Expected Result:**
- No fee key is editable on both surfaces; Trade Timing owns every fee key it renders; `/config` keeps only the non-Trade-Timing fee keys + the cross-link banner; legacy keys are surfaced on Trade Timing but clearly labeled as audit-only (not used by current checkout).

---

## Group FE3 — R11 Category SP Config + R6 Entitlement Admin (New Implementation)

> Added 2026-08-09. R11 exposes the per-category Swap Points config (spend-cap %,
> multiplier m, optional absolute SP Redemption Cap) in the Category admin form and
> enforces it server-side at checkout. R6 gives admins visibility into the wallet
> states driven by subscription status (grace = spendable, post-grace = frozen).

### TC-FE3-01 · Admin edits SP Earning Multiplier (m) per category
**Objective:** Verify the multiplier is editable and persisted.
**Steps:**
1. **Categories → edit a category → SP Config tab**, set **SP Earning Multiplier** to 1.30. Save.
2. Reopen the category.
**Expected Result:** The multiplier shows 1.30×; a bonus badge renders (> 1.10). The saved value appears in the categories table.

### TC-FE3-02 · Admin edits SP Spending Cap % per category
**Objective:** Verify the spend-cap % is editable and persisted.
**Steps:**
1. Set **SP Spending Cap %** to 60. Save. Reopen.
**Expected Result:** Shows 60%; the live SP preview updates (e.g., "$50 item → 30 SP max"). New categories default to 50%.

### TC-FE3-03 · Admin sets / clears SP Redemption Cap (absolute) per category
**Objective:** Verify the new optional absolute per-item cap is editable.
**Steps:**
1. Set **SP Redemption Cap** to 10 and save; reopen.
2. Clear it (empty) and save; reopen.
**Expected Result:** The absolute cap persists (10) and clears back to no-cap (empty). Validation rejects values > 1000 or negative.

### TC-FE3-04 · Validation: invalid cap % / multiplier / redemption cap rejected
**Objective:** Verify bounds validation on the SP Config tab.
**Steps:**
1. Try multiplier 1.60, spend-cap % 40, redemption cap 2000.
**Expected Result:** Each is rejected inline (multiplier 1.05–1.40; spend-cap 50–80; redemption cap 0–1000 or empty). The category is not saved with invalid values.

### TC-FE3-05 · Enforcement reflected: over-cap offers rejected server-side
**Objective:** Verify admin-set caps are enforced at checkout (not just display).
**Steps:**
1. Set a category's spend-cap % to 50 and redemption cap to 10.
2. As a buyer, attempt an offer with SP = 20 on that item.
**Expected Result:** The offer is rejected (`SP_CAP_EXCEEDED`); no trade/SP reservation/Stripe hold is created. This confirms the admin config is authoritative on the server.

### TC-FE3-06 · Admin can view wallet state (grace_period / frozen) on user detail
**Objective:** Verify admin surfaces reflect the R6 wallet states.
**Steps:**
1. Open **Users → a user's detail** for a user in grace period, then for an expired user.
**Expected Result:** The wallet state shows `grace_period` (spendable — "can spend existing SP") for the grace user and `frozen` for the expired user. SP balance remains visible (not deleted).

---

## R8 & N4 — Approval Moderation Gate + Age Gate (Admin)

> Added 2026-08-09. R8: approval is gated on Google Vision image moderation. N4: no under-18 user can be created (hard registration gate).

### TC-R8-A01 · Approve button blocked while image moderation pending
**Objective:** Verify the admin cannot approve a listing whose images are unreviewed.
**Steps:**
1. Open **Listings** → select a pending listing with no AI moderation decision.
2. View the detail panel (**AI Image Moderation** row) and tap **Approve Listing**.
**Expected Result:** The detail panel shows "⏳ Reviewing images (N pending)"; approval fails with the `MODERATION_IN_PROGRESS` message.

### TC-R8-A02 · Approve button blocked when an image is flagged
**Objective:** Verify flagged images force reject/request-edits instead of approve.
**Steps:**
1. Open a pending listing with a flagged image (status `flagged`).
2. Tap **Approve Listing**.
**Expected Result:** Approval fails with `MODERATION_BLOCKED_FLAGGED`; the panel shows "⛔ Flagged (N image(s) block approval)"; Reject / Request Edits remain available.

### TC-R8-A03 · Approve succeeds when all images approved
**Objective:** Verify the normal approval path when moderation passed.
**Steps:**
1. Open a pending listing where every image has an `approved` moderation log.
2. Tap **Approve Listing**.
**Expected Result:** Approval succeeds; status becomes `available`; detail panel shows "✅ Approved (N/N images)".

### TC-R8-A04 · Moderation disabled state visible
**Objective:** Verify admins can see when the gate is disabled.
**Steps:**
1. With `moderation_ai_enabled` = false, open a listing detail panel.
**Expected Result:** The AI Image Moderation row shows "🚫 Disabled by admin config"; approval is not blocked by moderation.

### TC-N4-A01 · No under-18 accounts exist; DOB visible on user detail
**Objective:** Verify the age gate means no under-18 user can be created, and DOB is viewable.
**Steps:**
1. Open **Users** and search for any under-18 account (DOB < 18 years ago).
2. Open a user's detail and check DOB.
3. Attempt to create an under-18 user via the admin (or `auth.admin.createUser` with dob 2010-01-01).
**Expected Result:** No under-18 accounts exist (hard gate); user detail shows DOB for 18+ users; the under-18 creation attempt fails with `AGE_MINIMUM_REQUIRED`.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Admin login (FLOW-34) | TC-A01 |
| Non-admin rejected (RBAC) | TC-A02, TC-R04 |
| Dashboard hub + widgets | TC-A03 |
| User list/search/filters | TC-B01 |
| User detail drawer | TC-B02 |
| Suspend/ban/delete | TC-B03 |
| SP credit/debit + freeze (FLOW-30) | TC-B04 |
| User analytics cards | TC-B05 |
| Listing management tabs | TC-C01 |
| Flagged items filters | TC-C02 |
| Approve flagged item | TC-C03 |
| Reject item with reason | TC-C04 |
| Item detail + appeal | TC-C05 |
| Category list/filter/search (FLOW-21) | TC-D01 |
| Create/edit category + multiplier | TC-D02 |
| Activate/deactivate category | TC-D03 |
| Category suggestions queue | TC-D04 |
| Nodes list + stats (FLOW-03) | TC-E01 |
| Add/edit node | TC-E02 |
| Deactivate node members warning | TC-E03 |
| Node settings radius validation | TC-E04 |
| ZIP waitlist queue | TC-E05 |
| Node tagging completeness (N6) | TC-E06 |
| Per-node KPIs (N6) | TC-E07 |
| Global config inline edit | TC-F01, TC-R04 |
| Cart settings + validation (FLOW-07) | TC-F02 |
| Trade timing config (FLOW-08) | TC-F03, TC-R03 |
| Policy tabs + versions (FLOW-31/32/33) | TC-G01 |
| Create policy version (regex) | TC-G02 |
| Edit draft policy | TC-G03 |
| Publish policy confirmation | TC-G04, TC-R02 |
| Trade list filters (FLOW-08) | TC-H01 |
| Trade detail + breakdown | TC-H02 |
| Trade admin actions | TC-H03 |
| Dispute queue + SLA | TC-I01 |
| Mark under review | TC-I02 |
| Resolve dispute Complete | TC-I03 |
| Resolve dispute Refund (FLOW-27) | TC-I04, TC-R02 |
| Tax admin entry points (FLOW-22) | TC-J01 |
| Payout fee config (FLOW-25) | TC-K01 |
| Payouts list/stats/filters | TC-K02 |
| Retry failed payout | TC-K03, TC-R02 |
| Scheduled payouts visible with release dates (R3) | TC-R3-01 |
| payout_buffer_days enforcement — new completions use edited value (R3) | TC-R3-02 |
| Release via cron — processing/paid + balance move + idempotent (R3) | TC-R3-03 |
| Trade Pipeline shows payout release date (R3) | TC-R3-04 |
| SP economy hub tabs (FLOW-30) | TC-L01 |
| SP analytics + CSV export | TC-L02 |
| SP wallet admin metrics + search | TC-L03 |
| SP adjustment with reason | TC-L04, TC-R02 |
| Freeze/unfreeze/suspend wallet | TC-L05 |
| Grace period config (FLOW-12) | TC-M01 |
| Subscriptions list/filters/metrics | TC-M02 |
| Extend/cancel/reminder | TC-M03 |
| Referral configuration (FLOW-13) | TC-N01 |
| Referral analytics | TC-N02 |
| ID badge queue (FLOW-18/29) | TC-O01 |
| Review request approve | TC-O02 |
| Review request reject with reason | TC-O03 |
| Request details + privacy note | TC-O04 |
| Message templates edit | TC-O05 |
| Badge management + toggle | TC-P01 |
| Badge CRUD | TC-P02 |
| Manual award badge | TC-P03 |
| Badge sandbox simulation | TC-P04 |
| Reported reviews + reason filter | TC-Q01 |
| Hide review | TC-Q02 |
| Approve (unhide) review | TC-Q03 |
| Education CMS (FLOW-21/EDU-001) | TC-R01 |
| FAQ management | TC-R02 |
| Publish content reflects in app | TC-R03 |
| Support inbox + unread filter | TC-S01 |
| Support detail + mark read | TC-S02 |
| Revenue & Analytics dashboard | TC-T01 |
| Notification analytics (FLOW-17) | TC-T02 |
| Audit logs view (FLOW-20) | TC-U01, TC-R05 |
| Monitoring run + alerts (FLOW-28) | TC-V01 |
| Cron jobs status + history | TC-V02 |
| Sidebar grouped + collapsible | TC-W01, TC-W02 |
| Per-admin section state persistence | TC-W03 |
| Active-section auto-expand | TC-W04 |
| Sidebar visual hierarchy (labels/active/inactive) | TC-W05 |
| Collapsed icon rail | TC-W06 |
| Nav destination coverage | TC-W07 |
| Admin session persistence | TC-R01 |
| Action Center aggregated cards | TC-X01 |
| Bundled counts per source | TC-X02 |
| Severity tags (Urgent/Routine) | TC-X03 |
| Expand card drill-down | TC-X04 |
| Inline approve flagged item | TC-X05 |
| Inline mark dispute under review | TC-X06 |
| Inline retry failed payout (confirmation) | TC-X07, TC-R02 |
| Empty state "All caught up" | TC-X08 |
| Sidebar pinned Action Center + live badge | TC-X09 |
| Header bell opens Action Center + badge | TC-X10 |
| Config drift detection | TC-X11 |
