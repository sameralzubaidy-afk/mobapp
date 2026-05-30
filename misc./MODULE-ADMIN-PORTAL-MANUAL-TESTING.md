# MODULE-18 Admin Portal — Manual Testing Guide

**Source of truth:** `docs/flow-registry.md` (FLOW-18 Admin Controls / CPSC Recall Imports / ID Badge Verification · FLOW-20 Audit/Logging · FLOW-21 Category Management / Education CMS · FLOW-22 Sales Tax · FLOW-25 Manual Payout Admin · FLOW-28 Cron & Background Jobs · FLOW-30 SP Wallet Admin Ops · FLOW-34 Admin Auth Middleware)
**Tasks covered:** Admin Auth & Dashboard · Users · Listings/Items/Flagged · Categories · Nodes/Node Settings/Waitlist · Global Config (cart, trade-timing) · Policies · Trades · Disputes · Tax · Payouts (config + earnings) · SP Economy/Analytics/Wallet · Subscriptions · Referrals · ID Badges/Badges · Review Moderation · Education/FAQ CMS · Support · Revenue/Notification Analytics · Audit Logs · Monitoring/Cron
**Last updated:** 2026-05-30
**Scope:** Admin portal manual testing in a **web browser** (this is a web-based admin tool, not a mobile app). No SQL / no DB access required.
**Devices:** Desktop browser (Chrome/Safari/Firefox). Admin login required.

> Note: detailed **Sales Tax admin** cases (node rate config, bulk update, audit history, reporting dashboard, CSV export) live in `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` Group P (TC-P01–TC-P08). This guide's Tax group (Group J) covers entry points and cross-references those.

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Auth & Dashboard** | TC-A01 | Admin login with admin role |
| | TC-A02 | Non-admin login rejected (RBAC gate) |
| | TC-A03 | Dashboard hub links + summary widgets |
| | TC-A04 | Direct protected route access without session redirects to login |
| | TC-A05 | Expired session redirects once without a loop |
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
| **F — Global Config & Settings** | TC-F01 | Global configuration inline edit + permission gate |
| | TC-F02 | Cart settings (min value, max carts, expiry) |
| | TC-F03 | Trade timing config (8 keys + nested validation) |
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

---

## Pre-conditions (set up before testing)

- The admin portal is deployed/running and reachable in a browser.
- An admin account exists (role `admin` in `role_based_access_control`) and a non-admin account exists for the RBAC negative test.
- Seed data exists across domains: users in each account/subscription status; at least one flagged item, one rejected item, one item with an appeal; categories including a bonus category and a pending suggestion; an inactive node with members; a ZIP waitlist entry in each status; draft + published policy versions; trades in each status including one open dispute (reported) and one under review; failed and pending payouts; SP wallets including a frozen one; subscriptions in grace/cancelled; pending/approved/rejected ID badge requests; a reported review with 3+ reports; draft + published FAQ and education sections; unread support messages; cron jobs with at least one failed run.
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

### TC-A03 · Dashboard hub links + summary widgets

**Ref:** FLOW-18 · / (dashboard)
**Actors:** test-admin

**Objective:** Verify the dashboard hub renders all area links and summary widgets.

**Steps:**
1. After login, review the dashboard ("Welcome to Admin Portal").

**Expected Result:**
- Navigation cards/links are present for: Revenue & Analytics, SP Economy, Trades, Subscriptions, ID Badge Verification, Payouts, Manage Referral, Configuration, Geographic Nodes, Node Settings, Users, Monitoring, Audit Logs, Review Moderation.
- The Trade Analytics and SP Economy summary widgets render.

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

## Group F — Global Config & Settings

### TC-F01 · Global configuration inline edit + permission gate

**Ref:** FLOW-18 · /config
**Actors:** test-admin

**Objective:** Verify inline config editing and the write-permission gate.

**Steps:**
1. Open **/config**; edit a config item (e.g., sms_rate_limit_per_hour, moderation_ai_enabled); Save; then Reset another.

**Expected Result:**
- Items show value + edit/save/reset; saving shows success and persists; if `can_write` is false the items are read-only.

---

### TC-F02 · Cart settings (min value, max carts, expiry)

**Ref:** FLOW-07 · /settings/cart
**Actors:** test-admin

**Objective:** Verify cart settings + validation.

**Steps:**
1. Open **/settings/cart**; set minimum cart value (dollars), max saved carts (1–10), saved cart expiry (1–365); Save Changes; try invalid values.

**Expected Result:**
- Valid values save (min ≥ 0, carts 1–10, expiry 1–365) and reflect in the app's cart behavior; invalid values are blocked. (See also TradeFlow TC-N01/TC-N02.)

---

### TC-F03 · Trade timing config (8 keys + nested validation)

**Ref:** FLOW-08 · /settings/trade-timing
**Actors:** test-admin

**Objective:** Verify trade timing config and nested validations.

**Steps:**
1. Open **/settings/trade-timing**; set offer timeout, the two offer notifications, auto-complete timeout + notification, pending SP release days, and member/non-member transaction fees; Save.
2. Try invalid ordering (e.g., notif 1 ≥ timeout).

**Expected Result:**
- Valid values save; nested rules enforced (notif1 < timeout, notif2 < notif1 and ≥ 1, auto-complete notif < auto-complete hours, all ≥ 1, fees ≥ 0); invalid values are blocked.

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

**Objective:** Verify the tax admin sections load; detailed cases live in TradeFlow Group P.

**Steps:**
1. Open **/tax**, **/tax/nodes**, **/tax/settings**, **/tax/reports**.

**Expected Result:**
- Node tax rate config (view/edit, validation), bulk update, rate change history/audit, global settings toggle + warning banner, reporting dashboard (summary, date presets, jurisdiction breakdown, 7 report types), and CSV export are reachable.
- Execute the detailed checks in `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` **TC-P01 through TC-P08**.

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
| Admin session persistence | TC-R01 |
