# STAGING — New Test Cases (Admin Portal — Batch 5b)

> **STATUS: DRAFT — DO NOT MERGE into the canonical file without explicit per-batch approval.**
> **Target canonical file:** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`
> **Drafted:** 2026-08-13 · grounded against current source (`p2p-kids-admin/src/app/disputes/page.tsx`, `subscriptions/manage/page.tsx`, `trades/[id]/page.tsx`, `settings/trade-timing/page.tsx`, `action-center/page.tsx` + `ActionCenterClient.tsx`, `cancellation-insights/page.tsx` + `CancellationInsightsClient.tsx` — read this session via exploration).
> **Entry format:** matches this file's convention — `### TC-XXX · Description`, then `**Ref:**`, `**Actors:**`, `**Objective:**`, `**Steps:**`, `**Expected Result:**`. A `**Surfaces: admin, mobile**` line marks cross-surface cases (same convention introduced in Batch 5a).
> **Merge instructions:** append `I05` to Group I, `M04–M06` to Group M, `H04–H06` to Group H, `F08–F11` to Group F, `X13–X14` to Group X, in both index and body.

---

## Index addendum (rows to add to the `Test Case Index` table)

| Group | TC# | Description |
|---|---|---|
| **F — Global Config & Settings** | TC-F08 | R1 tiered buyer-fee fields |
| | TC-F09 | Buyer Fee-Tier Distribution table |
| | TC-F10 | Legacy fee keys |
| | TC-F11 | Reset button |
| **H — Trades** | TC-H04 | Subscription Context section |
| | TC-H05 | External References (Stripe PI/refund + SP ledger IDs) |
| | TC-H06 | Sales Tax line in monetary breakdown |
| **I — Disputes** | TC-I05 | Filter-tab click behavior (All/Reported/Under Review) |
| **M — Subscriptions Admin** | TC-M04 | Reactivate button |
| | TC-M05 | Metrics cards (MRR/churn/trial) |
| | TC-M06 | "free" status filter |
| **X — Action Center** | TC-X13 | Cancellation Insights card drill |
| | TC-X14 | /cancellation-insights full page |

---

## Group F — Global Config & Settings (additions)

### TC-F08 · R1 tiered buyer-fee fields

**Ref:** /settings/trade-timing · RPC `fn_get_admin_config_values` / `upsert_admin_config_setting`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify the R1 tiered buyer-fee configuration fields.

**Steps:**
1. Open **/settings/trade-timing** and locate **Tiered Buyer Fee — R1 (first-trade protection)**.
2. Review and edit the fields, then save.

**Expected Result:**
- Fields: `Flat Fee — Active Members`, `Flat Fee — First Trade`, `Percentage — Free users (1+ completed trades)`, `Fixed Fee — Free users (1+ completed trades)`, `Maximum Total Fee (cap)`, and `Fee Display Label` (text).
- Saving persists each key via `upsert_admin_config_setting`; the buyer fee shown in the mobile checkout reflects the configured tier.

### TC-F09 · Buyer Fee-Tier Distribution table

**Ref:** /settings/trade-timing · GET `/api/admin/fee-tier-stats`
**Actors:** test-admin

**Objective:** Verify the Buyer Fee-Tier Distribution table.

**Steps:**
1. On **/settings/trade-timing**, review the **Buyer Fee-Tier Distribution** section.

**Expected Result:**
- Table columns `Tier`, `Fee State`, `Users`; tier badges `Flat fee` / `Percentage fee`.
- Shows `Loading…` then data, or `No fee-tier data yet.` when empty.

### TC-F10 · Legacy fee keys

**Ref:** /settings/trade-timing · `Legacy fee keys (audit only)`
**Actors:** test-admin

**Objective:** Verify the legacy fee keys are surfaced read-only.

**Steps:**
1. On **/settings/trade-timing**, review **Legacy fee keys (audit only)**.

**Expected Result:**
- Shows `Legacy Member Fee (cents)` (`transaction_fee_member_cents`), `Legacy Non-Member Fee (cents)` (`transaction_fee_non_member_cents`), and `Legacy Seller Discount % — Free` (`platform_fee_seller_discount_percentage_freemium`).

### TC-F11 · Reset button

**Ref:** /settings/trade-timing · `loadSettings`
**Actors:** test-admin

**Objective:** Verify the Reset button reloads the configured values.

**Steps:**
1. On **/settings/trade-timing**, change a value (unsaved), then click **Reset**.

**Expected Result:**
- **Reset** reloads the persisted settings (`loadSettings`), reverting any unsaved edits; **Save Settings** persists changes and writes an audit row (`update_trade_timing_settings`).

---

## Group H — Trades (additions)

### TC-H04 · Subscription Context section

**Ref:** /trades/[id] · `Subscription Context`
**Actors:** test-admin

**Objective:** Verify the buyer subscription context on trade detail.

**Steps:**
1. Open **/trades/[id]** for a trade.

**Expected Result:**
- `Subscription Context` shows `Status at Initiation` (from `buyer_subscription_status`, fallback `Unknown`) and `Current Status` (from the buyer's subscription, fallback `Unknown`).
- A `View Subscription History →` link navigates to `/subscriptions?user_id={buyer_id}`.

### TC-H05 · External References (Stripe PI/refund + SP ledger IDs)

**Ref:** /trades/[id] · `External References`
**Actors:** test-admin

**Objective:** Verify the external reference IDs render only when present.

**Steps:**
1. Open **/trades/[id]** for a trade with Stripe + SP ledger records.

**Expected Result:**
- `External References` shows `Stripe PaymentIntent` (`stripe_payment_intent_id`), `Stripe Refund ID` (`stripe_refund_id`), `SP Debit Ledger` (`sp_debit_ledger_entry_id`), and `SP Credit Ledger (Refund)` (`sp_credit_ledger_entry_id`), each rendered only when non-empty.

### TC-H06 · Sales Tax line in monetary breakdown

**Ref:** /trades/[id] · `Monetary Breakdown` (TAX-VISIBILITY 2026-07-30)
**Actors:** test-admin

**Objective:** Verify the Sales Tax line in the monetary breakdown.

**Steps:**
1. Open **/trades/[id]** and review **Monetary Breakdown**.

**Expected Result:**
- Shows `Item Price (Total)` (cash + SP), `Swap Points Applied`, `Cash Component`, `Platform Fee`, `Sales Tax` (`tax_amount_cents`), and `Total Charged (Cash)` = cash + fee + tax.

---

## Group I — Disputes (additions)

### TC-I05 · Filter-tab click behavior (All/Reported/Under Review)

**Ref:** /disputes · `DisputeFilters`
**Actors:** test-admin

**Objective:** Verify the dispute filter tabs drive the query.

**Steps:**
1. On **/disputes**, click **All Disputed**, then **Reported**, then **Under Review**.

**Expected Result:**
- Tabs are labeled `All Disputed`, `Reported`, `Under Review`.
- `All Disputed` clears the `status` query param; the other tabs set `status={value}` and re-render the list (`/disputes?...`).
- The header shows `{n} active disputes — {reportedCount} reported, {underReviewCount} under review`; an empty result shows `No disputes found for the selected filter.`

---

## Group M — Subscriptions Admin (additions)

### TC-M04 · Reactivate button

**Ref:** /subscriptions/manage · POST `/api/admin/subscriptions/actions` `{action:'reactivate'}`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify manually reactivating a cancelled/expired subscription.

**Steps:**
1. On **/subscriptions/manage**, find a row with status `cancelled` / `grace_period` / `expired` / `paused` and click **Reactivate**.
2. Confirm.

**Expected Result:**
- Confirm reads `Are you sure you want to manually reactivate subscription for {name}? This will set status to active.`
- On confirm the status becomes `active`; the mobile Manage Kids Club+ screen reflects the active status.

### TC-M05 · Metrics cards (MRR/churn/trial)

**Ref:** /subscriptions/manage · GET `/api/admin/subscriptions`
**Actors:** test-admin

**Objective:** Verify the subscription metrics cards.

**Steps:**
1. On **/subscriptions/manage**, review the metrics cards.

**Expected Result:**
- Five cards: `MRR`, `Active Subscribers`, `Trial Users`, `Grace Period`, `Churn Rate`.

### TC-M06 · "free" status filter

**Ref:** /subscriptions/manage · status filter
**Actors:** test-admin

**Objective:** Verify the `free` status filter button.

**Steps:**
1. Click the **Free** status filter.

**Expected Result:**
- Filter buttons are `All`, `Trial`, `Active`, `Grace Period`, `Cancelled`, `Expired`, `Free`; selecting **Free** filters the list to free (non-subscriber) users.
- **Note:** `free` is a filter only — it is not a rendered subscription status.

---

## Group X — Action Center (additions)

### TC-X13 · Cancellation Insights card drill

**Ref:** /action-center · `ActionCenterClient` → `/cancellation-insights`
**Actors:** test-admin

**Objective:** Verify the Cancellation Insights card and its drill-down.

**Steps:**
1. On **/action-center**, locate the **Cancel Insights** card and click its **Open cancellation insights** link.

**Expected Result:**
- Card label `Cancel Insights` with summary `Cancellation spike detected in the last 7 days`, severity `Routine`, and action `Review`.
- The link navigates to **/cancellation-insights**.
- With no spike, the card shows `No cancellation spikes detected.`

### TC-X14 · /cancellation-insights full page

**Ref:** /cancellation-insights · GET `/api/admin/cancellation-insights`
**Actors:** test-admin

**Objective:** Verify the cancellation insights page end to end.

**Steps:**
1. Open **/cancellation-insights**; switch presets (**Last 24h / Last 7 Days / Last 30 Days / Custom**) and, for Custom, set **From:** / **To:** dates.
2. Open a user's **View Details** modal; also trigger the error state.

**Expected Result:**
- KPI cards: `Cancelled Offers`, `Cancelled Trades`, `Total Created`, `Cancellation Rate`.
- Breakdowns: `Offer Cancellation Reasons` and `Trade Cancellation Reasons` (reason + `count (pct%)`).
- `Top Cancelling Users` table with columns `User / Role / Flagged / Cancelled Offers / Cancelled Trades / Total / Top Reason / Actions`; `⚑ Flagged` badge on flagged rows.
- **View Details** opens the `Cancellation History` modal (with **Close**); empty states read `No cancellations in this period.` / `No cancellations found for this user in the selected period.`
- Loading shows `Loading cancellation insights...`; error shows `Error Loading Data` with **Retry**; footer `Data as of {timestamp}`.
