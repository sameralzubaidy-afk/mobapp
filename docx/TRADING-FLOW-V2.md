# Trading Flow V2 — Requirements & Implementation Reference

**Project:** Kids P2P Marketplace  
**Document Version:** 2.2
**Date:** July 15, 2026
**Last Updated:** July 15, 2026 — Added seller name masking rule (D-31), "More from this seller" discovery flow, bundle CTA on CartScreen, different-seller modal fix (generic copy), and seller group identification.
**Status:** Approved — Ready for Implementation  
**Author:** Product Team (Brainstorm session with Copilot)  
**Supersedes:** Original trade flow in BRD V2 Section 6.4 FR-TX-001 through FR-TX-004

---

## Table of Contents

1. [Background & Why We Changed](#1-background--why-we-changed)
   - 1.3 [Product Design Principles](#13-product-design-principles)
2. [Research Findings — Competitive Analysis](#2-research-findings--competitive-analysis)
3. [Key Decisions Log](#3-key-decisions-log)
4. [Business Rules (Locked)](#4-business-rules-locked)
5. [New Trade Flow — Overview](#5-new-trade-flow--overview)
6. [Trade State Machine](#6-trade-state-machine)
   - 6.2 [Dispute State Machine](#62-dispute-state-machine)
   - 6.3 [Seller Payout Integration Rules](#63-seller-payout-integration-rules)
7. [Master Scenario Table — All Paths](#7-master-scenario-table--all-paths)
8. [Countdown Timer Requirements](#8-countdown-timer-requirements)
9. [Admin Configuration Spec](#9-admin-configuration-spec)
   - 9.5 [Notification Throttling Rules](#95-notification-throttling-rules)
10. [SP Behavior in Trade Flow](#10-sp-behavior-in-trade-flow)
11. [UI/UX Component Requirements](#11-uiux-component-requirements)
12. [Completion Screen CTAs by User Type](#12-completion-screen-ctas-by-user-type)
13. [Database Changes Required](#13-database-changes-required)
14. [Implementation Modules](#14-implementation-modules)
15. [TODO / Open Items](#15-todo--open-items)
16. [Event Instrumentation](#16-event-instrumentation)

---

## 1. Background & Why We Changed

### 1.1 Original Trade Flow (Deprecated)

The original flow had the following confirmed pain points:

1. **Two checkout paths** — "Buy Now" (via `TradeInitiationScreen`) charged Stripe immediately before seller approval. "Make Offer" (via `TradeOfferScreen`) went through seller review first. This asymmetry was a UX and trust risk.
2. **Two-step completion** — Seller marked complete first (`seller_marked_completed_at`), then buyer confirmed. For local pickup where both parties are physically present, this double confirmation added unnecessary friction.
3. **No offer expiry** — Offers sat in `pending` state indefinitely. Sellers could ghost buyers forever, items could be locked for multiple buyers simultaneously.
4. **Auto-complete window was 7 days** — Too long. SP is locked in "pending" longer than necessary, hurting SP circulation (target: 50%+ circulation rate per BRD KPI).
5. **No competing offer visibility** — Sellers reviewing offers could only see one at a time. No sorted inbox.
6. **No SP hold mechanism** — No code existed to reserve buyer SP at offer submission time. A buyer with 20 SP could submit two simultaneous offers for 15 SP each; both would pass the balance check.

### 1.2 Goals of the New Flow

- Unify to **one checkout path** regardless of payment type
- Make seller approval the gate before any Stripe charge
- **Buyer-only completion** to eliminate the double-confirmation step
- **48-hour auto-complete** (configurable) to free up SP faster
- **24-hour offer expiry** (configurable) to prevent indefinite holds
- Surface all competing offers to the seller, sorted by highest value
- Add SP soft-reserve at offer submission time

---

### 1.3 Product Design Principles

These principles anchor every module in this document. They must be the first filter applied before shipping any feature or screen.

| Principle | What It Means in Practice |
|---|---|
| **No parent should babysit the app** | Every async step must be self-explanatory. If a parent can't understand their next action in under 3 seconds, the screen has failed. |
| **Every timer needs a visible action** | Countdowns without a clear resolution create anxiety. Every timer shown to a user must be paired with the specific action they can take to resolve it early. |
| **Every payment state must be explainable in one sentence** | If a PM can't tell a parent exactly where their money is and why in one sentence, the state is too complex to ship. |
| **Build for the 6pm parent** | Our user just picked up kids from school, has 8 minutes before dinner starts, and is checking the app while standing in the kitchen. Flows must work in that context — minimum taps, zero ambiguity. |
| **Safety is the product, not a feature** | This is parents meeting strangers while carrying children's items. Trust and safety cues are not UX polish — they are the core value proposition versus Facebook Marketplace. Every screen in the trade flow is an opportunity to reinforce that. |

---

## 2. Research Findings — Competitive Analysis

| App | Auto-Complete | Seller Approval Required | Offer System | SP / Points System |
|---|---|---|---|---|
| **Mercari** | 3 days (buyer can extend) | No — payment confirms immediately | Make Offer (price negotiation) | None |
| **Poshmark** | 3 days after tracking shows delivered | No | Make Offer (price negotiation) | None |
| **OfferUp** | None (local, no protection) | No explicit approval | Yes (price negotiation) | None |
| **Vinted** | 2 days buyer confirmation window | No | None — fixed price only | None |
| **Kidizen** | Manual only | No | None | None |
| **FB Marketplace** | None | No | None — direct chat | None |
| **Kids P2P (V1)** | 7 days | Yes (via ReviewOfferScreen) | Yes (SP mix only, no price negotiation) | Yes (SP, subscribers only) |
| **Kids P2P (V2 — This doc)** | **48h configurable** | **Yes (before Stripe charge)** | **Yes (SP mix only, v1 scope)** | **Yes (SP, subscribers only)** |

### Key Research Takeaways

1. **Industry standard is 2–3 days for auto-complete**. Our 48h is at the aggressive end, which is deliberate — faster SP release = higher SP circulation = better subscription value.
2. **No competitor requires seller approval before payment**. We do, because this is a local pickup marketplace — both parties need to agree on the meetup. This is correct for our model.
3. **No competitor has a virtual currency tied to the trade** the way we do. This means we have no benchmark for SP hold/reserve mechanics. We must design this from scratch.
4. **Mercari, Poshmark, OfferUp all allow price negotiation** in their offer systems. We are keeping price fixed for V1 (SP allocation only), which simplifies the flow significantly.
5. **The biggest buyer frustration across all platforms is seller ghosting**. Our offer expiry timer directly solves this.

---

## 3. Key Decisions Log

| # | Decision | Rationale | Decided By |
|---|---|---|---|
| D-01 | Unify Buy Now + Make Offer into one flow | Eliminates Stripe pre-charge risk, consistent UX | Product |
| D-02 | Seller must approve before Stripe is charged | Local pickup = both parties must agree to meet | Product |
| D-03 | Buyer-only completion ("I Got It") — remove seller mark step | Double confirmation is unnecessary at local pickup | Product |
| D-04 | Auto-complete at 48h (default, configurable) | Faster SP release drives circulation (KPI: 50%+ circulation) | Product |
| D-05 | Offer expiry at 24h (default, configurable) | Prevents indefinite ghosting, respects buyer time | Product |
| D-06 | SP-only variable in offers (not cash price negotiation) | Keeps V1 simple; price negotiation deferred to V2 | Product |
| D-07 | Button labels: **"Request to Buy"** (was "Pay Cash") / **"Use SP"** on Accept SP listings | "Pay Cash" implied instant Stripe checkout; V2 creates an offer first with no charge until seller approves — label must match that mental model | Product |
| D-08 | "Use SP" **visible but locked** for free users — shows 🔒 icon; tapping opens upgrade modal | Free users cannot spend SP per FR-SP-006; visible-but-locked is more discoverable than hidden and drives subscription conversion at the highest-intent moment | Product |
| D-09 | Seller offer inbox sorted by highest total value (cash + SP×$1) | Helps seller identify best offer instantly, reduces decision time | Product |
| D-10 | SP soft-reserve at offer submission — deduct from available, restore if declined/expired | Prevents double-allocation across concurrent offers | Product |
| D-11 | SP total shown to seller without source breakdown | Better UX; show "[X] SP releasing in [N] days" — no immediate vs pending split | Product |
| D-12 | Subscription CTA at completion screen, targeted by user type | Highest-intent moment for upgrade, tied to real transaction value | Product |
| D-13 | Seller ignoring 2+ consecutive offers → prompt to pause listing | Reduces buyer frustration, improves marketplace health | Product |
| D-14 | All timing configs in hours unit, no guard rails in UI, defaults enforced at DB level | Admin flexibility, server-side minimum of 1h to prevent zero/negative values | Product + Eng |
| D-15 | Admin sets push notification times independently (not proportional auto-scaling) | More control for marketing team | Product |
| D-16 | Timing configs are global (all listings, all categories) | Simplicity for V1; per-category timing deferred to V2 | Product |
| D-17 | All SP (buyer SP + platform SP) released to seller in ONE single event at trade completion | Eliminates seller confusion from two separate SP arrivals in wallet; cleaner accounting | Product |
| D-18 | SP pending release period is admin-configurable (default 3 days, global for all categories) | Maintains chargeback fraud protection window; admin flexibility without per-category complexity | Product |
| D-19 | In-chat safety banner — persistent header on all chat screens | Passive, non-blocking deterrent targeting W-1 and W-2 leakage windows; zero false positives | Product |
| D-20 | Value stack line item on offer preview — show fee + SP earned side by side | Reframes the fee as smaller than the SP value returned; strongest at the exact moment a user might reconsider going off-platform | Product |
| D-21 | Pre-first-message one-time safety modal per listing | Shown once before the user sends their first message on a given listing; non-blocking, educational | Product |
| D-22 | Post-meetup buyer nudge push notification — T+6h after auto-complete fires if buyer never confirmed | Recovers honest forgetters; signals the platform noticed for intentional off-platform cases | Product |
| D-23 | Message content scanning — soft warn only, never hard-block (V1.1) | Warn on: Venmo, Zelle, Cash App, PayPal, phone number patterns, external payment URLs. Hard blocking creates false positives and is trivially bypassed | Product |
| D-24 | Auto-complete ratio metric per seller tracked in admin dashboard (V1.1) | >50% auto-complete rate on 5+ trades = admin review flag; indirect but meaningful leakage signal | Product |
| D-25 | Item Detail CTA renamed from "Pay Cash" to **"Request to Buy"** for cash offers; "Use SP" unchanged | Scope: button label on Item Detail + Section 4.2 Buyer Button column only. Scenario table offer-type descriptions retain "cash offer" / "cash payment" as conceptual language | Product |
| D-26 | Disputes implemented as `dispute_status` + `dispute_resolution` overlay columns on `trades` table — not new top-level states in the primary state machine | Keeps the primary state machine (pending → payment_processing → in_progress → completed/cancelled) clean and unchanged; dispute handling pauses automated actions without creating new terminal states | Product + Eng |
| D-27 | Cart checkout creates **one trade per item** (not a single bundled trade). All trades created from the same cart checkout are stamped with a shared `bundle_id UUID`. `bundle_id` is a pure UX grouping device — no business logic, state machine, dispute, SP, or payout rules reference it. This preserves all existing V2 guarantees per item (each trade is independently disputable, completable, and payable). | A single "bundle trade" record would require a new `trade_items` junction table, new dispute rules ("does one item's dispute pause the whole bundle?"), new payout rules, and SP recalculation logic — unacceptable scope for V1. One trade per item reuses the entire existing state machine unchanged. | Product + Eng |
| D-28 | Cart is **single-seller per active cart**. Buying from multiple sellers requires switching between saved carts (up to 3). Multi-seller single checkout is explicitly not supported. | Each seller = separate physical pickup trip. Combining sellers into one checkout creates multiple Stripe charges + multiple SP reservations + multiple payout recipients with zero reduction in real-world effort for the parent. Saved carts address the actual friction (losing your place while shopping), not checkout volume. | Product |
| D-29 | Saved cart eviction (when a 4th cart is attempted) is **explicit** — user is shown a warning modal naming the cart about to be deleted before proceeding. Silent LRU eviction is not acceptable. | Silently deleting a cart a parent spent time building destroys trust. The explicit warning gives them a chance to complete that cart first. | Product |
| D-30 | **Payment authorization hold required at offer submission** — Stripe pre-authorization (cash + platform fee) AND SP hold must both succeed before offer is created. Buyer must have a valid payment method on file. | Ensures buyer commitment, reduces spam/non-serious offers, protects market credibility. Authorization is captured only when seller accepts (D-02). If either hold fails, the entire offer submission is rejected with a clear error. Max 3 active pending offers per buyer to prevent fund lockup. | Product + Eng |

---

## 4. Business Rules (Locked)

### 4.1 User Tier Rules

| Rule | Free User | Kids Club+ Subscriber |
|---|---|---|
| Can browse and list | ✅ | ✅ |
| Can make cash offers | ✅ | ✅ |
| Can use SP in offers | ❌ | ✅ (up to 50% of item price) |
| Can earn SP from sales | ❌ | ✅ (when listing is "Accept SP") |
| Transaction fee | $2.99 | $0.99 |
| Can see "Use SP" button | ❌ (hidden, shows lock + upgrade CTA) | ✅ |

### 4.2 Listing Payment Preference Rules

| Preference | Set By | Who Can Use | Buyer Button |
|---|---|---|---|
| **Cash Only** | Seller at listing creation (free or subscriber) | Any buyer | **"Request to Buy"** only |
| **Accept SP** | Subscriber seller only | Any buyer, but only subscribers can include SP | **"Request to Buy"** OR "Use SP" |
| **Donate** | Subscriber seller only | Any buyer (free, no Stripe charge) | "Claim" |

**Rule**: Payment preference is **locked** once a buyer has made contact (first offer submitted). Cannot be changed after that point (per BRD FR-LM-002).

### 4.3 Payment Authorization Hold Rules (D-30)

**Required at Offer Submission:**
- Buyer must have a valid payment method on file (card added to Stripe Customer)
- Stripe pre-authorization hold is placed for `cash_amount + platform_fee` when offer is created
- Authorization hold is separate from the charge — funds are reserved on buyer's card but not captured
- Authorization typically expires after 7 days (Stripe constraint)
- If buyer's card is declined, offer submission fails immediately with clear error

**Max Pending Offers Limit (Per-Seller Cap — 2026-07-18):**
- Buyer can have max 3 active `pending` offers **per seller** at any time
- This prevents excessive fund lockup across multiple authorization holds while allowing buyers to engage with multiple sellers simultaneously
- A bundle offer (multiple items from the same seller) counts as 1 offer slot — not 1 per item
- An expired offer immediately frees its slot for that buyer-seller pair (status changes to `cancelled`, which removes it from the pending count)
- 4th offer to the SAME seller is rejected with error: *"You have 3 pending offers with this seller. Cancel one to make a new offer."*
- Offers to DIFFERENT sellers are counted independently — 3 open with Seller A does not block offers to Seller B

**Hold Lifecycle:**
- **Offer created (pending)**: Authorization placed, funds reserved on card
- **Seller accepts**: Authorization captured (converted to actual charge)
- **Seller declines OR offer expires**: Authorization released, card hold removed within 5-7 business days (Stripe processing time)
- **Authorization expires (rare)**: If seller doesn't respond within Stripe's 7-day window, offer auto-cancels

**Rollback on Failure:**
- If Stripe authorization succeeds but SP hold fails → release Stripe authorization immediately
- If SP hold succeeds but Stripe authorization fails → restore SP to buyer's `available_sp` immediately
- Both holds must succeed atomically or the entire offer submission is rejected

**Edge Cases:**
- **Card expires during pending window**: Offer auto-cancels, buyer notified to update payment method
- **Insufficient funds at offer time**: Immediate rejection with error
- **Insufficient funds when seller accepts** (authorization capture fails): Trade → `cancelled`, buyer + seller notified, SP restored

### 4.4 SP Rules in Trade Flow

**SP Earning (FR-SP-001):**
- Subscriber seller with "Accept SP" listing earns SP when their item sells
- Platform calculates: `25% × sale_price × category_multiplier` (admin-configurable per category)
- Status: **Pending** for N days after trade completes, where N = admin config `sp_pending_release_days` (default 3)
- Auto-releases after N days if no dispute filed

**SP Receiving (FR-SP-002 — Updated):**
- When buyer uses SP to pay → those SP are **held in buyer's `reserved_sp`** until trade completes
- At trade completion, buyer reserved SP transfers to seller as part of the **single SP release event** (D-17)
- **Change from original BRD**: FR-SP-002 previously stated "immediate transfer at acceptance." Changed per D-17 — all SP now releases together at completion, not at acceptance.

**SP Total Shown to Seller (UX Rule — D-11, D-17):**
- Show combined total: `buyer_sp_sent + platform_calculated_sp`
- Do NOT break down by source
- Timing disclosure: *"[X] SP releasing in [N] days"* where N = `sp_pending_release_days` config value
- All SP enters `pending_sp` at completion in one event — no split between immediate and pending portions

**SP Spending (FR-SP-003):**
- 1 SP = $1 discount
- Maximum 50% of item price can be paid with SP
- Platform fee ($0.99 or $2.99) is always charged in cash

**SP Hold Rule (D-10, D-17):**
- When buyer submits an offer with SP amount > 0: immediately move `sp_amount` from `available_sp` to `reserved_sp` in buyer's wallet
- If offer is declined, expired, or trade is cancelled at any stage: restore `reserved_sp` → `available_sp`
- If seller accepts (payment_processing): buyer SP **remains in `reserved_sp`** — NOT transferred to seller yet
- If trade completes: buyer `reserved_sp` deducted → combined with platform-calculated SP (FR-SP-001) → entire total added to seller's `pending_sp` in one single event
- SP releases from seller `pending_sp` → `available_sp` after N days (config: `sp_pending_release_days`, default 3)
- A buyer cannot have their SP reserved across more than one `in_progress` trade (only `pending` and `payment_processing` may hold reserved SP)

---

## 5. New Trade Flow — Overview

```
ITEM DETAIL SCREEN
│
├─ Listing type = CASH ONLY
│     └─ [Pay Cash] button only
│
└─ Listing type = ACCEPT SP
      ├─ [Pay Cash]    → Creates offer at full item price, 0 SP
      └─ [Use SP] ─────→ Opens SP slider (0–50% of price)
           (hidden/locked for free buyers)
         ↓
OFFER SUBMITTED (payment authorization hold placed — D-30)
  → Stripe pre-authorization hold placed (cash + platform fee)
  → Buyer's SP soft-reserved in wallet
  → Buyer must have valid payment method (card on file)
  → Max 3 active pending offers enforced
  → Seller notified (push + badge on Offers tab)
  → 24h offer expiry clock starts
         ↓
SELLER OFFER INBOX (TradeListScreen → Offers tab)
  → All pending offers on this item shown, sorted by total value (highest first)
  → Each row shows: buyer name, cash amount, SP amount, total value, ⏱ countdown pill
         ↓
SELLER REVIEWS OFFER (ReviewOfferScreen)
  → Shows: cash amount + total SP (with timing note) + seller's projected wallet state
  ┌─ [Accept] → Stripe charged → buyer SP stays reserved until trade completes
  └─ [Decline] → Offer cancelled, buyer notified, buyer SP unreserved, item stays listed
  
  If seller accepts ONE offer → all other pending offers on same item auto-declined
         ↓
TRADE IN PROGRESS
  → Both parties: TradeTimelineScreen
  → "Coordinate pickup via message" prompt
  → Buyer sees: auto-complete countdown banner (48h, configurable)
  → Seller sees: "Waiting for buyer confirmation" (no action needed)
         ↓
COMPLETION
  ├─ Buyer taps [I Got It] → trade → completed
  └─ Auto-complete fires at 48h if buyer doesn't respond → trade → completed
         ↓
COMPLETION SCREEN
  → SP pending notice (seller, if applicable)
  → Subscription CTA (targeted by user type)
  → [Rate & Review] prompt (non-blocking)
```

---

## 6. Trade State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
  Buyer submits     │  PENDING                                 │  Offer expires (24h)
  offer (D-30)      │  - Stripe pre-auth hold placed           ├──────────────────────┐
  ─────────────────►│  - SP soft-reserved in buyer wallet      │                      │
                    │  - offer_expires_at set                  │  Seller declines      │
                    │  - authorization_expires_at set          │                      │
                    └──────────┬───────────────────────────────┘  ────────────────────┤
                               │ Seller accepts                                        │
                               ▼                                                       │
                    ┌──────────────────────────┐                                       │
  Stripe charged    │  PAYMENT_PROCESSING      │  Stripe fails                         │
  ─────────────────►│  - Buyer SP stays in      ├──────────────────────────────────────┤
                    │    reserved_sp (D-17)     │                                       │
                    └──────────┬───────────────┘                                       │
                               │ Stripe success                                        │
                               ▼                                                       │
                    ┌──────────────────────────────────────────┐                       │
                    │  IN_PROGRESS                             │                       │
                    │  - auto_complete_at set (+48h)           │                       │
                    │  - Buyer sees countdown banner           │                       │
                    │  - Buyer: [I Got It] button              │                       │
                    └──────────┬───────────────────────────────┘                       │
                               │ Buyer taps "I Got It"                                 │
                               │ OR auto-complete fires at 48h                         ▼
                               ▼                                               ┌─────────────┐
                    ┌──────────────────────────┐                               │  CANCELLED  │
                    │  COMPLETED               │                               │  - SP       │
                    │  - Platform SP calc      │                               │    restored │
                    │    added (pending 3d)    │                               │  - Item     │
                    │  - Rate & review prompt  │                               │    relisted │
                    └──────────────────────────┘                               └─────────────┘
```

**State definitions:**

| State | Meaning | SP Status | Stripe Authorization Status (D-30) |
|---|---|---|---|
| `pending` | Offer submitted, awaiting seller response | Buyer SP soft-reserved | Pre-authorization hold placed (cash + fee); not captured yet |
| `payment_processing` | Seller accepted, Stripe charging | Buyer SP remains in `reserved_sp` — not transferred yet | Authorization captured (converted to charge) |
| `in_progress` | Payment confirmed, awaiting pickup confirmation | Buyer SP still reserved; seller wallet unchanged pending completion | Charge completed; funds in platform account |
| `completed` | Buyer confirmed receipt (or auto-complete fired) | Single SP release event: buyer reserved SP + platform SP (FR-SP-001) → all added to seller `pending_sp`; N-day release clock starts | Payout to seller initiated |
| `cancelled` | Declined / expired / Stripe failed / cancellation | Buyer SP unreserved and restored | Authorization released; no charge; card hold removed |

---

## 6.2 Dispute State Machine

Disputes are entered when a buyer reports a problem during an `in_progress` trade (e.g., seller didn't show up, item not as described, pickup couldn't be arranged). Disputes do **not** create new top-level states in the primary state machine — they are an overlay implemented via two columns on the `trades` table: `dispute_status` and `dispute_resolution` (Decision D-26).

### 6.2.1 Dispute Columns on `trades` Table

| Column | Type | Values | Default |
|---|---|---|---|
| `dispute_status` | TEXT | `none`, `reported`, `under_review`, `resolved` | `none` |
| `dispute_resolution` | TEXT (nullable) | `null`, `completed`, `refunded` | `null` |
| `dispute_reported_at` | TIMESTAMPTZ (nullable) | — | `null` |
| `dispute_reason` | TEXT (nullable) | Free-text reason + category tag | `null` |
| `dispute_resolved_at` | TIMESTAMPTZ (nullable) | — | `null` |
| `dispute_resolved_by` | UUID (nullable) | Admin user ID | `null` |

### 6.2.2 Dispute State Flow

```
TRADE STATUS: in_progress
        │
        │  Buyer taps [Report a Problem]
        ▼
  dispute_status: reported
  ─────────────────────────
  - auto_complete cron SKIPS this trade
  - SP release cron SKIPS this trade
  - Seller payout BLOCKED
  - Both parties notified
  - Admin queue notified
        │
        │  Admin reviews
        ▼
  dispute_status: under_review (optional intermediate — admin sets manually)
        │
        ├─── Admin: Resolve → Complete (seller fulfilled correctly)
        │         dispute_resolution = 'completed'
        │         dispute_status = 'resolved'
        │         → completeTradeV2() fires normally
        │         → SP release + payout proceed
        │         trade.status → completed
        │
        └─── Admin: Resolve → Refund (buyer's favor)
                  dispute_resolution = 'refunded'
                  dispute_status = 'resolved'
                  → Stripe refund issued to buyer
                  → Buyer reserved_sp restored to available_sp
                  → Item relisted
                  trade.status → cancelled
```

### 6.2.3 Entry Conditions

- Only trades with `trade.status = 'in_progress'` can have a dispute opened
- Entry point: buyer taps **[Report a Problem]** on `TradeTimelineScreen`
- Buyer selects a reason category: *Seller didn't show up* / *Item not as described* / *Couldn't agree on meetup* / *Other* (+ optional free-text)
- Once `dispute_status = 'reported'`, buyer cannot re-open a second dispute on the same trade

### 6.2.4 Effect on Automated Actions

| Automated Action | Normal Behavior | When `dispute_status = 'reported'` or `'under_review'` |
|---|---|---|
| `process_auto_complete` cron | Completes trade at `auto_complete_at` | **SKIPPED** — trade stays `in_progress` indefinitely until admin resolves |
| `release_pending_sp` cron | Releases seller pending SP after N days | **SKIPPED** — SP stays in `pending_sp` |
| Seller payout trigger | Fires on trade completion | **BLOCKED** — payout held until dispute resolved |

### 6.2.5 Notifications

| Event | Recipient | Message |
|---|---|---|
| Dispute filed | Seller | *"A buyer has reported an issue with your trade for [Item]. Our team will review within 24 hours."* Deep link: `TradeTimelineScreen` |
| Dispute filed | Admin | Internal queue notification with trade ID and reason |
| Dispute resolved → Complete | Buyer | *"Our team reviewed your trade for [Item] and confirmed it as complete."* |
| Dispute resolved → Complete | Seller | *"Your trade for [Item] has been confirmed complete. Your payout is on its way."* |
| Dispute resolved → Refund | Buyer | *"Your refund for [Item] has been issued. It may take 5–10 business days to appear."* |
| Dispute resolved → Refund | Seller | *"Our team resolved a dispute on your trade for [Item] in the buyer's favor. The sale has been cancelled."* |

### 6.2.6 Admin Dashboard Requirements

- Dispute queue: filterable list of all trades with `dispute_status IN ('reported', 'under_review')`
- Per-dispute view: trade details, buyer's reason, both parties' message history, timeline of state transitions
- Admin actions: **[Mark Under Review]**, **[Resolve → Complete]**, **[Resolve → Refund]**
- SLA target: disputes acknowledged within 24 hours (display age of dispute in queue)

---

## 6.3 Seller Payout Integration Rules

The payout lifecycle is an outcome of trade completion. These rules define when a payout is created, what blocks it, and how edge cases are handled. Detailed Stripe payout integration lives in the separate Payout Architecture doc; this section defines the trade-flow-specific rules that must govern payout triggering.

### 6.3.1 Payout Trigger Rules

| Condition | Payout Behavior |
|---|---|
| `trade.status → completed` AND `dispute_status = 'none'` | Payout record created immediately; processing begins |
| `trade.status → completed` AND `dispute_status = 'reported'` or `'under_review'` | Payout **held** — created only after `dispute_status = 'resolved'` with `dispute_resolution = 'completed'` |
| `trade.status → cancelled` (any reason) | No payout created; if payout was pending, it is voided |
| `trade.status → completed` AND seller has no verified payout method | Payout status set to `requires_action` — trade completes normally, SP releases, but cash held until seller adds payout method |

### 6.3.2 Payout Columns on `trades` Table

| Column | Type | Values | Default |
|---|---|---|---|
| `payout_status` | TEXT | `pending`, `requires_action`, `processing`, `paid`, `failed` | `pending` |
| `payout_idempotency_key` | TEXT (unique) | Set to `payout_[trade_id]` at payout creation | `null` |
| `payout_initiated_at` | TIMESTAMPTZ (nullable) | — | `null` |
| `payout_paid_at` | TIMESTAMPTZ (nullable) | — | `null` |

### 6.3.3 `requires_action` Flow

When `payout_status = 'requires_action'`:
1. Push notification to seller: *"Your [Item] sold! Add a payout method to receive your $[amount]."* Deep link: Payout setup screen
2. Repeat notification every 48h (max 3 times) until resolved
3. Admin dashboard flags all `requires_action` payouts in a dedicated column
4. Once seller adds payout method: system automatically retries payout using `payout_idempotency_key` to prevent double-payout

### 6.3.4 Idempotency

Every payout **must** use `payout_idempotency_key = 'payout_' || trade_id` as the Stripe idempotency key. If the payout trigger fires twice (e.g., trigger + retry), Stripe deduplicates using this key. This prevents double-payouts under any retry or crash scenario.

---

## 7. Master Scenario Table — All Paths

> **Legend**: 🛒 Buyer | 🏷️ Seller | ⚙️ System | ⏱ Countdown active

---

### S1 — Cash Only: Pay Cash → Seller Accepts → Buyer Confirms (Happy Path)

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1 | 🛒 | Item Detail | Price. "Cash Only" badge. Button: **[Request to Buy]** | — | [Request to Buy] | — | — |
| 2 | 🛒 | Offer Preview | "Offer: $30 cash. No SP." | — | [Submit Offer] [Cancel] | Trade created | `pending` |
| 3 | ⚙️ | — | — | ⏱ 24h offer clock starts | — | Push to seller | `pending` |
| 4 | 🏷️ | Offers Tab | Row: "[Item] — $30 cash — ⏱ 23h 55m" | ⏱ Active | [View Offer] | — | `pending` |
| 5 | 🏷️ | ReviewOfferScreen | "$30 cash offer from [Buyer Name]" + ⏱ pill in header | ⏱ Active | [Accept] [Decline] | — | `pending` |
| 6 | 🏷️ | — | Taps Accept | — | — | Stripe charge begins | `payment_processing` |
| 7 | ⚙️ | — | — | — | — | Stripe succeeds → notify both | `in_progress` |
| 8 | ⚙️ | — | — | ⏱ 48h auto-complete clock starts | — | `auto_complete_at` set | `in_progress` |
| 9 | 🛒 | TradeTimeline | "Payment confirmed. Coordinate pickup." + **auto-complete banner**: "Auto-completing in 47h 58m" | ⏱ 48h | [I Got It] [Message Seller] | — | `in_progress` |
| 10 | 🏷️ | TradeTimeline | "Buyer paid. Awaiting pickup confirmation." — no action button | — | [Message Buyer] [Cancel] | — | `in_progress` |
| 11 | 🛒 | — | Taps **I Got It** | — | — | `completeTradeV2()` called | `completed` |
| 12 | ⚙️ | — | — | — | — | Push to both parties | `completed` |
| 13 | 🛒 | Completion Screen | "Trade Complete! 🎉" + Subscription CTA (if free buyer) | — | [Rate Seller] [Done] | — | `completed` |
| 14 | 🏷️ | Completion Screen | "Sold! Cash releasing." + Subscription CTA (if free seller) | — | [Rate Buyer] [Done] | — | `completed` |

---

### S2 — Cash Only: Seller Declines

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1–5 | Same as S1 | | | ⏱ Active | | | `pending` |
| 6 | 🏷️ | ReviewOfferScreen | Taps [Decline] | — | — | — | — |
| 7 | 🏷️ | — | Confirmation toast: "Offer declined. Item stays listed." | — | — | Trade cancelled | `cancelled` |
| 8 | ⚙️ | — | — | — | — | Push to buyer | `cancelled` |
| 9 | 🛒 | Offers Tab | Row: "Declined — [Item] still available" | — | [View Item Again] | — | `cancelled` |

---

### S3 — Cash Only: Offer Expires (Seller Never Responds)

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1–4 | Same as S1 | | | ⏱ Active | | | `pending` |
| 5 | ⚙️ T–6h | — | — | ⏱ | — | Push to seller: "⏱ Offer expiring in 6h on [Item]" | `pending` |
| 6 | ⚙️ T–1h | — | — | ⏱ | — | Push to seller: "Last chance — offer on [Item] expires in 1h" | `pending` |
| 7 | ⚙️ T–0 | — | — | — | — | Auto-decline. SP unreserved (if any). Item stays listed. | `cancelled` |
| 8 | 🛒 | Offers Tab | "Expired — [Item] still available" | — | [View Item Again] | — | `cancelled` |
| 9 | 🏷️ | Offers Tab | Row removed (expired offers hidden after 24h) | — | — | — | — |
| 10 | ⚙️ | — | Check: was this seller's 2nd consecutive unanswered offer on this listing? | — | — | If yes: push prompt to seller | — |
| 11 | 🏷️ | Push / In-App | *"You're receiving offers but not responding on [Item]. Want to pause this listing?"* | — | [Pause Listing] [Dismiss] | — | — |

---

### S4 — Accept SP: Pay Cash (0 SP) → Seller Accepts → Buyer Confirms

| Step | Difference from S1 | Notes |
|---|---|---|
| Step 1 | Item shows "Accept SP" badge. Two buttons: **[Request to Buy]** and **[Use SP]** | "Use SP" shows 🔒 icon if buyer is free user; tapping the lock opens upgrade modal |
| Step 2 | Buyer chose [Pay Cash] → Offer: "$30 cash, 0 SP" | No SP reserved |
| Steps 3–14 | Identical to S1 | — |
| Step 14 (Seller) | Subscriber seller: "Sold! Platform SP earned pending 3 days." | No buyer SP was used → FR-SP-002 = 0 SP; FR-SP-001 platform SP still calculated on sale |

---

### S5 — Accept SP: Use SP (with SP amount) → Seller Accepts → Buyer Confirms (Full Happy Path)

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1 | 🛒 | Item Detail | Price. "Accept SP" badge. Buttons: **[Pay Cash]** / **[Use SP]** | — | [Pay Cash] [Use SP] | — | — |
| 2 | 🛒 | TradeOfferScreen | SP slider: 0–50% of price. Shows: "$22 cash + 8 SP = $30 total" | — | Adjust slider, [Submit Offer] | — | — |
| 3 | 🛒 | — | Taps Submit | — | — | Trade created. 8 SP moved to `reserved_sp` in buyer wallet. | `pending` |
| 4 | ⚙️ | — | — | ⏱ 24h starts | — | Push to seller | `pending` |
| 5 | 🏷️ | Offers Tab | Row: "[Item] — $22 cash + 8 SP — Total: $30 — ⏱ 23h 55m" | ⏱ Active | [View Offer] | — | `pending` |
| 6 | 🏷️ | ReviewOfferScreen | "$22 cash + **13 SP total** (all releasing in [N] days)" + "After this trade your SP balance: [current + 13 SP in [N] days]" | ⏱ Active | [Accept] [Decline] | — | `pending` |
| 7 | 🏷️ | — | Taps Accept | — | — | Stripe charges $22 cash. Buyer 8 SP remains in `reserved_sp` — not transferred yet. | `payment_processing` |
| 8 | ⚙️ | — | — | — | — | Stripe success → notify both. `auto_complete_at` set (+48h). | `in_progress` |
| 9 | 🛒 | TradeTimeline | "Payment confirmed. Used 8 SP + $22 cash." + **auto-complete banner** | ⏱ 48h | [I Got It] [Message Seller] | — | `in_progress` |
| 10 | 🏷️ | TradeTimeline | "Buyer paid. 13 SP releasing when trade completes." | — | [Message Buyer] | — | `in_progress` |
| 11 | 🛒 | — | Taps **I Got It** | — | — | `completeTradeV2()` | `completed` |
| 12 | ⚙️ | — | — | — | — | Single SP release event: buyer's 8 reserved SP + platform SP (5 SP = 25% × $30 × category_multiplier) = **13 SP total** → added to seller `pending_sp`. N-day release clock starts (config: `sp_pending_release_days`). | `completed` |
| 13 | 🏷️ | Completion Screen | "Sold! 13 SP releasing in [N] days — added to your pending wallet." | — | [Rate Buyer] [View Wallet] | — | `completed` |
| 14 | 🛒 | Completion Screen | "Got it! You saved $8 using SP." + subscription CTA if free | — | [Rate Seller] [Done] | — | `completed` |

> **Notes on Step 6 — ReviewOfferScreen SP Display:**
> - "13 SP total" = 8 SP from buyer (FR-SP-002) + 5 SP from platform (FR-SP-001, 25% × $30 × category_multiplier — exact value depends on admin-configured multiplier for the item's category)
> - Do NOT show source breakdown ("8 from buyer + 5 from platform")
> - DO show timing note: "all releasing in [N] days" where N = `sp_pending_release_days` config value — all SP is pending; there is no immediate portion
> - Show projected wallet state after completing

---

### S6 — Multiple Buyers Competing on Same Item

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1 | 🛒 Buyer A | TradeOfferScreen | Submits: $22 cash + 8 SP (total $30) | — | — | Trade A created, A's 8 SP reserved | A: `pending` |
| 2 | 🛒 Buyer B | TradeOfferScreen | Submits: $28 cash + 2 SP (total $30, 2h later) | — | — | Trade B created, B's 2 SP reserved | B: `pending` |
| 3 | 🛒 Buyer C | TradeOfferScreen | Submits: $30 cash + 0 SP (total $30, 4h later) | — | — | Trade C created, no SP reserved | C: `pending` |
| 4 | 🏷️ Seller | Offers Tab | **Sorted by total value (desc):** B ($30, $28+2SP ⏱ 19h), C ($30, all cash ⏱ 17h), A ($30, $22+8SP ⏱ 21h). Tie-broken by: most cash first, then earliest offer. | All ⏱ active | [View each] | — | All `pending` |
| 5 | 🏷️ | ReviewOffer B | Seller reviews Buyer B's offer | ⏱ Active | [Accept B] [Decline] | — | — |
| 6 | 🏷️ | — | Taps **Accept B** | — | — | Stripe charges Buyer B | B: `payment_processing` |
| 7 | ⚙️ | — | — | — | — | Trades A and C auto-declined. A and C's SP unreserved. Notifications sent to Buyers A and C. | A, C: `cancelled` |
| 8 | 🛒 A & C | Offers Tab | "Declined — item no longer available" | — | [Browse Similar] | — | — |

> **Tie-breaking rule for equal total value**: Sort by highest cash amount first (seller gets more liquid cash), then by earliest offer time.

---

### S7 — Auto-Complete Fires (Buyer Never Taps "I Got It")

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1 | 🛒 | TradeTimeline | Auto-complete banner: "Auto-completing in 47h 58m — tap 'I Got It' if you've received it" | ⏱ 48h starts | [I Got It] | — | `in_progress` |
| 2 | ⚙️ T–24h | — | — | ⏱ | — | Push to buyer: "Your [Item] trade auto-completes in 24h. Got it? Tap 'I Got It'." | `in_progress` |
| 3 | ⚙️ T–2h | — | — | ⏱ | — | Push to buyer: "[Item] trade auto-completes in 2 hours." | `in_progress` |
| 4 | ⚙️ T–0 | — | — | — | — | System checks: `dispute_status = 'none'` before firing. If none → calls `completeTradeV2()`. Single SP release event: buyer reserved SP + platform SP (FR-SP-001) → all added to seller `pending_sp`. | `completed` |
| 5 | Both | Push | "Your trade for [Item] was automatically marked complete." | — | [Rate & Review] | — | `completed` |

---

### S8 — Seller Cancels After Acceptance (Can't Do Pickup)

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1 | 🏷️ | TradeTimeline | Trade is `in_progress` | ⏱ 48h (buyer's) | [Cancel] [Message Buyer] | — | `in_progress` |
| 2 | 🏷️ | Cancel Modal | "Why are you cancelling?" → [Can't do pickup] [Item no longer available] [Other] | — | Select reason | — | — |
| 3 | ⚙️ | — | — | — | — | Stripe refund issued to buyer. Buyer `reserved_sp` returned to buyer `available_sp`. Platform SP (FR-SP-001) not created (trade didn't complete). Item relisted. | `cancelled` |
| 4 | 🛒 | Notification | "Seller cancelled. Full refund issued. See similar items." | — | [Browse Similar] | — | — |
| 5 | ⚙️ | — | — | — | — | Seller cancellation counter incremented. >3 cancellations = flag for admin review. | — |

> **Platform risk note**: Seller post-acceptance cancellations are the worst buyer experience on any marketplace. The seller cancellation counter (Step 5) feeds into a future "seller reliability score" visible on their profile after 5+ trades.

---

### S9 — Free User Encounters "Use SP" Button

| Step | Actor | Screen | What They See | Action | System Event |
|---|---|---|---|---|---|
| 1 | 🛒 Free | Item Detail | "Accept SP" listing. [Request to Buy] visible. [Use SP] shows lock icon 🔒. | Taps 🔒 Use SP | — |
| 2 | 🛒 Free | Upgrade Modal | "Unlock SP discounts with Kids Club+. Save up to 50% on items. 30 days free." | [Try Kids Club+ Free] [Not Now] | — |
| 3a | 🛒 Free | — | Taps [Try Kids Club+ Free] | — | Navigate to subscription signup |
| 3b | 🛒 Free | Item Detail | Dismisses modal | — | Returns to item detail, [Request to Buy] still available |

---

### S10 — Buyer Reports Pickup Problem

| Step | Actor | Screen | What They See | ⏱ Timer | Available Actions | System Event | State |
|---|---|---|---|---|---|---|---|
| 1–8 | Same as S1 through in_progress | | | ⏱ 48h active | | | `in_progress` |
| 9 | 🛒 | TradeTimeline | Sees buttons: [I Got It] and [Report a Problem] | ⏱ 48h | [I Got It] [Report a Problem] [Message Seller] | — | `in_progress` |
| 10 | 🛒 | Issue Report Modal | "What happened?" → reason selector: [Seller didn't show up] [Item not as described] [Couldn't agree on meetup] [Other] + optional free-text field | — | Select reason, [Submit Report] | — | — |
| 11 | ⚙️ | — | — | — | — | `dispute_status = 'reported'`. `dispute_reason` saved. `dispute_reported_at = NOW()`. Push to seller + admin. | `in_progress` (disputed) |
| 12 | ⚙️ | — | `process_auto_complete` cron now skips this trade. SP release cron skips. Payout blocked. | ⏱ paused | — | — | `in_progress` (disputed) |
| 13 | 🛒 | TradeTimeline | Banner replaces auto-complete banner: *"Your issue has been reported. Our team will review within 24 hours. Auto-complete is paused."* | — | [Message Seller] | — | `in_progress` (disputed) |
| 14 | 🏷️ | Push + TradeTimeline | *"A buyer has reported an issue with your trade for [Item]. Our team is reviewing. We'll be in touch within 24 hours."* | — | [Message Buyer] | — | `in_progress` (disputed) |
| 15a | ⚙️ Admin | Admin dashboard | Admin reviews: trade details, reason, message history. Decides seller fulfilled correctly. | — | [Resolve → Complete] | `dispute_status = 'resolved'`, `dispute_resolution = 'completed'`. `completeTradeV2()` fires. SP + payout proceed normally. | `completed` |
| 15b | ⚙️ Admin | Admin dashboard | Admin reviews: decides in buyer's favor. | — | [Resolve → Refund] | `dispute_status = 'resolved'`, `dispute_resolution = 'refunded'`. Stripe refund to buyer. Buyer reserved SP restored. Item relisted. | `cancelled` |
| 16a | Both | Push | Seller: *"Your trade for [Item] has been confirmed complete. Your payout is on its way."* Buyer: *"Our team confirmed your trade for [Item] as complete."* | — | [Rate & Review] / [Done] | — | `completed` |
| 16b | Both | Push | Buyer: *"Your refund for [Item] has been issued. It may take 5–10 business days to appear."* Seller: *"Our team resolved the dispute on [Item] in the buyer's favor."* | — | [Done] | — | `cancelled` |

> **Key invariants**: SP is never transferred to seller while a dispute is open. Payout is never initiated while a dispute is open. Auto-complete never fires while `dispute_status IN ('reported', 'under_review')`.

---

## 8. Countdown Timer Requirements

### 8.1 Offer Expiry Countdown

**Purpose**: Show both buyer and seller how much time is left before the offer auto-expires.

**Trigger**: Set `offer_expires_at = created_at + offer_expiry_hours` (from admin config, default 24h) when trade is inserted with `pending` status.

**Component: `<OfferCountdownPill />`**

```
Design spec:
┌─────────────┐
│ ⏱  14h 32m  │   ← pill shape, 8px border-radius
└─────────────┘
```

| Remaining Time | Background Color | Text Color | Label Format |
|---|---|---|---|
| >50% remaining (e.g., >12h on 24h expiry) | `#5DBB8E` (green) | White | `⏱ 14h 32m` |
| 25–50% remaining (e.g., 6–12h) | `#F59E0B` (amber) | White | `⏱ 8h 05m` |
| 10–25% remaining (e.g., 2–6h) | `#FF8C00` (orange) | White | `⏱ 3h 47m` |
| <10% remaining (e.g., <2h) | `#EF4444` (red) | White | `⏱ 48m` |
| Expired | `#9CA3AF` (gray) | White | `Expired` |

**Placement**:
- Seller's Offers Tab: right-aligned on each offer row
- ReviewOfferScreen: header area, below item title
- Buyer's submitted offer row in TradeListScreen: right-aligned

**Update frequency**: Every 60 seconds via `setInterval`. Do not update every second (battery drain).

**On expiry detected client-side**: Show "Expired" badge immediately. Actual state change happens server-side — client polls or receives real-time update via Supabase subscription.

---

### 8.2 Auto-Complete Countdown

**Purpose**: Show buyer how long until the trade auto-completes. Creates positive urgency to confirm.

**Trigger**: Set `auto_complete_at = NOW() + auto_complete_hours` (from admin config, default 48h) when trade transitions to `in_progress`.

**Component: `<AutoCompleteBanner />`**

```
Design spec:
┌──────────────────────────────────────────────────────┐
│  ⏱  Auto-completing in 23h 15m                        │
│     Received it already? Tap "I Got It" to confirm.   │
└──────────────────────────────────────────────────────┘
```

- Full-width banner at top of TradeTimelineScreen and TradeDetailScreen
- **Buyer view only** — not shown to seller (seller has no action)
- Same urgency color states as Offer Expiry Countdown above
- Hidden once trade is `completed` or `cancelled`
- Update frequency: every 60 seconds

---

## 9. Admin Configuration Spec

### 9.1 Where It Lives

Admin site → **Config page** → new section: **"Trade Timing Settings"**

### 9.2 Config Fields

| Field Name | Label in Admin UI | Default | Unit | Description |
|---|---|---|---|---|
| `offer_expiry_hours` | Offer Expiry Duration | `24` | hours | How long a pending offer stays open before auto-expiring |
| `auto_complete_hours` | Auto-Complete Duration | `48` | hours | How long after payment before trade auto-completes if buyer doesn't confirm |
| `sp_pending_release_days` | SP Pending Release Period | `3` | days | How many days after trade completion before seller's pending SP becomes available to spend |
| `offer_notif_1_hours_before` | Offer Expiry — First Reminder | `6` | hours before expiry | When to send first expiry reminder to seller |
| `offer_notif_2_hours_before` | Offer Expiry — Final Reminder | `1` | hours before expiry | When to send final expiry reminder to seller |
| `auto_complete_notif_1_hours_before` | Auto-Complete — First Reminder | `24` | hours before auto-complete | When to send first auto-complete reminder to buyer |
| `auto_complete_notif_2_hours_before` | Auto-Complete — Final Reminder | `2` | hours before auto-complete | When to send final auto-complete reminder to buyer |

### 9.3 Admin UI Spec

```
Trade Timing Settings
─────────────────────────────────────────────────────

Offer Expiry Duration
[  24  ] hours
"How long a buyer's offer stays open for seller review. Default: 24 hours."

Auto-Complete Duration
[  48  ] hours
"If buyer doesn't confirm receipt, trade auto-completes after this duration. Default: 48 hours."

SP Pending Release Period
[   3  ] days
"Days after trade completion before seller's Swap Points become spendable. Default: 3 days."

──── Notification Schedule ────────────────────────────

Offer Expiry Reminders (sent to seller):
  First reminder  [  6  ] hours before expiry
  Final reminder  [  1  ] hours before expiry

Auto-Complete Reminders (sent to buyer):
  First reminder  [ 24  ] hours before auto-complete
  Final reminder  [  2  ] hours before auto-complete

[ Save Changes ]
```

### 9.4 Validation Rules (Server-Side Only — Not Shown in Admin UI)

These are enforced at the API/DB level even though there are no visible min/max limits in the UI. This prevents a misconfiguration from breaking the system.

| Field | Server-Side Minimum | Reason |
|---|---|---|
| `offer_expiry_hours` | 1 | Zero or negative would immediately expire all new offers |
| `auto_complete_hours` | 1 | Zero or negative would immediately complete all in-progress trades |
| `sp_pending_release_days` | 1 | Zero would make SP immediately available with no fraud protection |
| `offer_notif_1_hours_before` | Must be ≤ `offer_expiry_hours` | Notification sent before expiry can't be after expiry |
| `offer_notif_2_hours_before` | Must be < `offer_notif_1_hours_before` | Final reminder must come after first |
| `auto_complete_notif_1_hours_before` | Must be ≤ `auto_complete_hours` | Same logic |
| `auto_complete_notif_2_hours_before` | Must be < `auto_complete_notif_1_hours_before` | Same logic |

If validation fails, the API returns an error and the admin config is not saved.

---

### 9.5 Notification Throttling Rules

V2 introduces multiple notification types across a single trade. These rules prevent notification fatigue for busy parents while ensuring every time-sensitive action remains visible.

**Per-trade notification limits:**

| Stage | Max Notifications to Send | Deep-Link Target | Recipient |
|---|---|---|---|
| Offer expiry reminders | 2 (first + final, per Section 9.2 config) | `ReviewOfferScreen` | Seller |
| Auto-complete reminders | 2 (first + final, per Section 9.2 config) | `TradeTimelineScreen` | Buyer |
| Post-meetup nudge | 1 (T+6h after auto-complete fires if buyer never confirmed) | `TradeTimelineScreen` | Buyer |
| Dispute filed | 1 | `TradeTimelineScreen` | Seller |
| Dispute resolved | 1 | `TradeTimelineScreen` | Both parties |
| Payout requires action | 1 per 48h until resolved (max 3 total) | Payout setup screen | Seller |
| Seller ignored offers prompt | 1 per listing (after 2nd consecutive unanswered offer) | Offers tab | Seller |

**Global rule**: No more than **3 push notifications per user per trade total** across all non-payout-related stages. Any notification beyond 3 for the same trade is dropped silently (logged for analytics, not sent).

**Deep-link requirement**: Every push notification **must** deep-link to the exact action screen listed above. Notifications that navigate to the home screen or a generic trade list are not acceptable. Each notification payload must include `trade_id` and the target screen route.

---

## 10. SP Behavior in Trade Flow

### 10.1 SP State Transitions (Buyer Wallet)

```
OFFER SUBMITTED (pending):
  available_sp: -8  →  reserved_sp: +8

SELLER ACCEPTS (payment_processing → in_progress):
  reserved_sp: unchanged (8 SP stays reserved — not transferred to seller yet)

TRADE CANCELLED (any reason, at any stage before completion):
  reserved_sp: -8  →  available_sp: +8  (restored)

TRADE COMPLETED (single SP release event — D-17):
  reserved_sp: -8  →  [transferred to seller pending_sp as part of combined SP release]
  [Buyer wallet fully cleared of the SP reservation]
```

### 10.2 SP State Transitions (Seller Wallet)

```
SELLER ACCEPTS (payment_processing → in_progress):
  [No SP change — seller wallet unchanged at acceptance]

TRADE COMPLETED (single SP release event — D-17):
  pending_sp: +[buyer_sp_amount + platform_calculated_sp]

  Where:
    buyer_sp_amount       = SP the buyer offered (transferred from buyer reserved_sp)
    platform_calculated_sp = ROUND(item_price_dollars * 0.25 * category_multiplier)

  Example: buyer sent 8 SP + platform calc 5 SP = 13 SP → all added to seller pending_sp

N DAYS AFTER COMPLETION (no dispute), where N = config sp_pending_release_days (default 3):
  pending_sp: -[total_sp]  →  available_sp: +[total_sp]
```

### 10.3 SP in ReviewOfferScreen Display Logic

```
total_sp_to_show = buyer_sp_amount + platform_calculated_sp

platform_calculated_sp = ROUND(item_price_dollars * 0.25 * category_multiplier)
  (category_multiplier fetched from admin config per category)

Display:
  All SP is pending for N days — no immediate/pending split to show.
  N is fetched from admin config sp_pending_release_days (default 3).

  If buyer_sp_amount > 0 AND platform_calculated_sp > 0:
    → "[total_sp_to_show] SP releasing in [N] days"

  If buyer_sp_amount > 0 AND platform_calculated_sp = 0:
    → This case should not occur (Cash Only listings cannot have SP in offer)

  If buyer_sp_amount = 0 AND platform_calculated_sp > 0:
    → "[platform_calculated_sp] SP releasing in [N] days"
    → (Pay Cash path on Accept SP listing)
```

### 10.4 SP Hold — Implementation Note

The SP reserve mechanism is **not currently in the codebase** (verified: `trade.ts` reads `available_points` at offer submission but does not deduct or lock it). This must be implemented as part of this module. See [Section 14 — Implementation Modules](#14-implementation-modules), Module 3.

---

## 11. UI/UX Component Requirements

### 11.1 Item Detail Screen — Button Logic

| Listing Type | Buyer Type | Buttons Shown |
|---|---|---|
| Cash Only | Any | **[Request to Buy]** only |
| Accept SP | Free buyer | **[Request to Buy]** + [Use SP 🔒] (visible but locked; tapping shows upgrade modal) |
| Accept SP | Subscriber | **[Request to Buy]** + [Use SP] |
| Donate | Any | [Claim] only (no Stripe charge) |

**Button style** (Whisk design system):
- Primary pill button: 52px height, 24px horizontal padding, `#5DBB8E` background
- Secondary pill button: 52px height, border `#5DBB8E`, transparent background
- Lock icon: Phosphor `Lock` icon 16px, shown inside "Use SP" button for free users

### 11.2 Offer Inbox (TradeListScreen — Offers Tab)

**Already partially built**: The "Offers" tab exists with `received` and `submitted` offer types. Changes needed:

- Add `offer_expires_at` to the query select
- Add `<OfferCountdownPill />` component to each offer row
- For `received` offers (seller view): sort by `total_value DESC` where `total_value = cash_amount_cents + (sp_amount * 100)`
- For `submitted` offers (buyer view): sort by `created_at DESC`
- Add auto-expired offer cleanup: hide offers where `offer_expires_at < NOW()` after 24 additional hours

### 11.3 ReviewOfferScreen — Changes Needed

Current state: Shows cash + SP side-by-side. Shows Accept/Decline only.

Changes:
- Add `<OfferCountdownPill />` in the header
- Update SP display to show total SP with timing note (see Section 10.3)
- Add projected wallet state after completing (see S5 Step 6)
- No counter-offer button for V1

**Bundle offer grouping** (Decision D-27): When a seller has multiple pending offers from the same buyer that share a `bundle_id`, the ReviewOfferScreen (and seller's Offers tab) groups them under a single row showing a "Bundle — N items" badge. Tapping expands to show all N offer rows. Seller can accept or decline the bundle as a whole (accepting fires `rpc_initiate_trade_v2` / moves to `payment_processing` for all N trades simultaneously) or act on each item individually. This is a display-layer grouping only — each trade is still accepted/declined independently under the hood.

**Bundle CTA on CartScreen** (Decision D-27 extension): When a buyer has 2+ items from the same seller in their active cart, a "Bundle these N items — Make one offer for all items from this seller" CTA appears below the cart summary. Tapping it navigates to CartCheckout in bundle mode with a "Bundle Offer" banner. This provides an explicit entry point for bundle discovery directly from the cart, complementing the existing checkout flow.

**"More from this seller" discovery** (SELLER-GROUP-007): From ItemDetailScreen, when a seller has 2+ approved (status='available') listings, a green CTA appears inside the seller info card: "This seller has N more items." Tapping opens a filtered page showing only that seller's available listings — with ZERO seller name, avatar, or identity visible. Each item supports direct "Add to Cart." If the buyer's active cart matches this seller, a "Matches Your Cart" banner appears at the top. This enables same-seller cart building without ever leaking seller identity.

**Seller Group Identification** (SELLER-GROUP-001): Each seller is assigned a stable, deterministic color + label (e.g., "Seller ● Blue") via SHA-256 hash of seller_id. The hash is opaque — cannot be reversed. The colored badge appears on ItemDetailScreen and the "More from this seller" page but NEVER on the Discover/search grid. This helps buyers visually identify same-seller items without identity exposure.

**Different-Seller Modal Fix** (SELLER-GROUP-003): The cart-conflict modal triggered when adding an item from a different seller now uses generic, seller-agnostic copy ONLY: "Your cart already has items from a different seller. Adding this item will clear your current cart." No seller name, ID, or PII is ever interpolated. The same modal component is shared between ItemDetailScreen and CartScreen as a single source of truth.

### 11.3.1 Bundle UX Spec

**Seller Offers tab — bundle row:**
```
┌─────────────────────────────────────────────────────────┐
│  👤 Emma W.  ·  Bundle — 3 items  ·  Total: $54 cash + 12 SP  ⏱ 23h 40m  │
│  > Nike jacket $22  |  Lego set $18  |  Art kit $14                        │
│                              [Accept Bundle]  [Review Each]  [Decline All] │
└─────────────────────────────────────────────────────────┘
```

**Buyer TradeListScreen — bundle row (in_progress):**
```
┌─────────────────────────────────────────────────────────┐
│  📦 Bundle with Emma W.  ·  3 items  ·  In progress                        │
│  Pickup arranged: all 3 items from same seller                              │
│  [View All Items]  ·  ⏱ Auto-complete in 42h                               │
└─────────────────────────────────────────────────────────┘
```
Tapping expands to show each item's individual `TradeTimelineScreen` row with its own [I Got It] button.

**"Confirm all" shortcut**: When a buyer taps [I Got It] on any trade in a bundle and all other bundle trades are also `in_progress`, show a prompt: *"Confirm all 3 items from Emma received?"* [Confirm All] [Just This One]. [Confirm All] loops through the bundle and calls `completeTradeV2()` for each trade. Reduces N taps to 1.

**TradeTimelineScreen — bundle context banner** (shown when `bundle_id IS NOT NULL`):
> *"This item is part of a 3-item bundle. View all bundle items →"*

**Key invariant**: If one bundle trade is disputed, the others continue normally. `bundle_id` is never checked by any cron, trigger, or business logic rule.

### 11.4 TradeTimelineScreen + TradeDetailScreen — Changes Needed

Current state: Shows `seller_marked_completed_at` step. Seller has "Mark Complete" button. Buyer has confirm button only after seller marks.

Changes (per Decision D-03):
- **Remove** seller "Mark Complete" button entirely
- **Remove** `seller_marked_completed_at` as a required flow step (field can remain in DB for historical data)
- **Add** `<AutoCompleteBanner />` component for buyer view only
- Buyer's **"I Got It"** button is now the **only** buyer completion action
- **Add** buyer **"Report a Problem"** button — visible when `trade.status = 'in_progress'` and `dispute_status = 'none'`
- Update state logic: `completeTradeV2()` is now called only by buyer tap or system auto-complete (system checks `dispute_status = 'none'` before firing)

**Buyer action buttons when `in_progress` (no dispute open):**

| Button | Style | Action |
|---|---|---|
| **[I Got It]** | Primary pill, green `#5DBB8E` | Calls `completeTradeV2()` |
| **[Report a Problem]** | Secondary pill, outlined `#EF4444` | Opens Issue Report Modal |
| **[Message Seller]** | Text link | Opens chat |

**Buyer view when `dispute_status = 'reported'` or `'under_review'`:**
- Replace `<AutoCompleteBanner />` with a dispute status banner (amber): *"Your issue has been reported. Our team will review within 24 hours. Auto-complete is paused."*
- Hide both [I Got It] and [Report a Problem] buttons (no further buyer action possible until admin resolves)
- [Message Seller] remains available

**Seller view when `dispute_status = 'reported'` or `'under_review'`:**
- Show dispute notice banner (amber): *"A buyer has reported an issue with this trade. Our team is reviewing."*
- Hide [Cancel] button (no seller actions during active dispute)
- [Message Buyer] remains available

### 11.5 Safe Meetup Guidance Card — V1-Lite

**Placement**: `TradeTimelineScreen`, shown as a persistent card when `trade.status = 'in_progress'`. Visible to both buyer and seller.

**Design spec**:
```
┌──────────────────────────────────────────────────────┐
│  🛡️  Stay Safe — Choose a Public Meetup Spot         │
│                                                      │
│  Meet somewhere busy and well-lit:                   │
│  • Library entrance or lobby                         │
│  • Coffee shop or food court                         │
│  • Police station lobby (safest option)              │
│  • Bank lobby or ATM vestibule                       │
│                                                      │
│  Avoid private addresses for first-time meetups.     │
│                                         [Got it ✓]  │
└──────────────────────────────────────────────────────┘
```

- **Dismissible** (unlike the chat safety banner): user taps [Got it] to collapse the card for this trade only
- **Dismissed state** stored per `trade_id` in local storage — not per user globally
- If the card is dismissed, show a compact version: *"🛡️ Meeting safely? [Tips]"* link that re-expands the card
- **Not** a curated location map — text guidance only (full location map feature deferred to V2, see TODO-06)
- This card is separate from and complements the `<AutoCompleteBanner />`

### 11.6 Structured Pickup Helpers — Chat Quick-Replies

**Placement**: `ChatScreen` when the associated trade has `status = 'in_progress'`. Quick-reply chips appear above the message input, visible to both parties.

**Quick-reply options** (tapping sends as a chat message from the user's perspective):

| Chip Label | Message Sent |
|---|---|
| 📅 Today | *"I can do a pickup today. What time works for you?"* |
| 📅 Tomorrow | *"I can do a pickup tomorrow. What time works for you?"* |
| 📍 Suggest times | *"Here are some times that work for me: [add your times]"* — opens message composer with prefill |
| 🏪 Public place | *"Happy to meet at a public spot — library, coffee shop, or similar. What's near you?"* |
| 🕐 Running late | *"Running a bit behind — I'll message you when I'm on my way."* |

- Only 3 chips visible at a time; remaining chips accessible via a "+ More" expand
- Once a message is sent using a chip, that chip is not auto-removed (user can send again if needed)
- Chips are informational shortcuts only — they have no system effect on trade state or `auto_complete_at`

### 11.7 Seller Cancellation — Progressive Consequences

Post-acceptance cancellations (where `trade.status` transitions from `in_progress` → `cancelled` via seller action) must be tracked and escalated progressively.

**Progressive rules:**

| Cancellation Count (lifetime, post-acceptance only) | System Action |
|---|---|
| 1 | In-app toast to seller after cancellation: *"Cancelling after payment is disappointing for buyers. This has been noted on your account."* Increment `post_acceptance_cancellation_count`. |
| 2 | Push notification to seller 24h later: *"You've cancelled 2 trades after payment. A third cancellation may affect your selling privileges."* |
| 3+ | Seller flagged for admin review. Admin dashboard shows flag. Seller receives: *"Your account is under review due to repeated post-payment cancellations. Our team will be in touch."* No automatic account suspension — admin reviews manually. |

**Fields needed on user profile** (feed into TODO-02 Seller Reliability Score):
- `post_acceptance_cancellation_count` INTEGER DEFAULT 0
- `admin_review_flagged_at` TIMESTAMPTZ (nullable)

> Note: Cancellations before acceptance (i.e., seller declines an offer before Stripe charge) do **not** increment this counter. Only post-Stripe-charge cancellations count.

### 11.8 Seller Ignoring Offers — Prompt Logic

Track: `consecutive_unanswered_offers_count` per `(seller_id, listing_id)`.

Increment when: an offer on this listing expires without seller responding (`status = cancelled` AND `cancellation_reason = 'offer_expired'` AND `seller_id` matches).

Reset to 0 when: seller accepts or explicitly declines an offer.

**Trigger**: When count reaches 2, send in-app push notification and show a modal next time seller opens the listing or Offers tab:

> *"You're receiving offers but not responding on [Item Title]. Unanswered offers frustrate buyers and reduce your chances of selling. Want to pause this listing until you're ready?"*
> 
> [Pause Listing] [I'll Respond] [Dismiss]

---

## 12. Completion Screen CTAs by User Type

Shown immediately after trade reaches `completed` state.

| User | Condition | Primary Message | CTA |
|---|---|---|---|
| 🛒 Free buyer | Any completed trade | "Trade complete! Kids Club+ would've saved you $2 on this trade — try it free for 30 days." | [Try Kids Club+ Free — 30 Days] |
| 🛒 Subscriber buyer | Used SP | "You saved $[sp_amount] using SP! You have [remaining_sp] SP left." | [Keep Shopping] |
| 🛒 Subscriber buyer | No SP used | "Trade complete! Consider using SP on your next purchase to save more." | [Browse Items] |
| 🏷️ Free seller | Any completed trade | "Great sale! Subscribe to earn Swap Points on your next sale — set 'Accept SP' when listing." | [Try Kids Club+ Free — 30 Days] |
| 🏷️ Subscriber seller | "Cash Only" listing | "Sold for cash! Try 'Accept SP' on your next listing to also earn SP." | [Create New Listing] |
| 🏷️ Subscriber seller | "Accept SP" listing, SP used | "[total_sp] SP releasing in [N] days — added to your pending wallet." where N = `sp_pending_release_days` | [View Wallet] |
| 🏷️ Subscriber seller | "Accept SP" listing, no SP used by buyer | "[platform_sp] SP releasing in [N] days (platform reward)." where N = `sp_pending_release_days` | [View Wallet] |

---

## 13. Database Changes Required

### 13.1 `trades` Table — New Columns

```sql
-- Offer expiry timestamp (set at trade creation)
ALTER TABLE trades
  ADD COLUMN offer_expires_at TIMESTAMPTZ;

-- Auto-complete timestamp (set when trade transitions to in_progress)
ALTER TABLE trades
  ADD COLUMN auto_complete_at TIMESTAMPTZ;

-- Bundle grouping column (Decision D-27 — UX only, no business logic attached)
-- Nullable: set when trade is created from a cart checkout; NULL for direct single-item offers
ALTER TABLE trades
  ADD COLUMN bundle_id UUID;

CREATE INDEX idx_trades_bundle_id ON trades(bundle_id) WHERE bundle_id IS NOT NULL;
```

-- Dispute overlay columns (Decision D-26 — overlay, not new state machine states)
ALTER TABLE trades
  ADD COLUMN dispute_status TEXT DEFAULT 'none'
    CHECK (dispute_status IN ('none', 'reported', 'under_review', 'resolved')),
  ADD COLUMN dispute_resolution TEXT
    CHECK (dispute_resolution IN ('completed', 'refunded') OR dispute_resolution IS NULL),
  ADD COLUMN dispute_reported_at TIMESTAMPTZ,
  ADD COLUMN dispute_reason TEXT,
  ADD COLUMN dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN dispute_resolved_by UUID REFERENCES auth.users(id);

-- Seller payout tracking columns (Section 6.3)
ALTER TABLE trades
  ADD COLUMN payout_status TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'requires_action', 'processing', 'paid', 'failed')),
  ADD COLUMN payout_idempotency_key TEXT UNIQUE,
  ADD COLUMN payout_initiated_at TIMESTAMPTZ,
  ADD COLUMN payout_paid_at TIMESTAMPTZ;
```

**Backfill for existing rows**: Set `offer_expires_at = created_at + INTERVAL '24 hours'` for existing `pending` trades (if any). Set `auto_complete_at = updated_at + INTERVAL '48 hours'` for existing `in_progress` trades.

### 13.2 Admin Config Table — New Fields

Add to existing admin config table/structure:

```sql
-- Trade timing config fields (add to existing admin_config table or equivalent)
offer_expiry_hours                    INTEGER DEFAULT 24,
auto_complete_hours                   INTEGER DEFAULT 48,
sp_pending_release_days               INTEGER DEFAULT 3,
offer_notif_1_hours_before            INTEGER DEFAULT 6,
offer_notif_2_hours_before            INTEGER DEFAULT 1,
auto_complete_notif_1_hours_before    INTEGER DEFAULT 24,
auto_complete_notif_2_hours_before    INTEGER DEFAULT 2
```

### 13.3 SP Wallet — Reserved SP Field

```sql
-- Add reserved_sp column to sp_wallet or user profile table
-- (exact table name depends on current schema — verify before running)
ALTER TABLE sp_wallets
  ADD COLUMN reserved_sp INTEGER DEFAULT 0 NOT NULL CHECK (reserved_sp >= 0);
```

### 13.4 Supabase Functions / Triggers Required

| Trigger/Function | When | What It Does |
|---|---|---|
| `fn_set_offer_expires_at` | BEFORE INSERT on `trades` (status = pending) | Sets `offer_expires_at = NOW() + (config.offer_expiry_hours * interval '1 hour')` |
| `fn_reserve_sp_on_offer` | AFTER INSERT on `trades` (sp_amount > 0) | Moves `sp_amount` from buyer `available_sp` to `reserved_sp` |
| `fn_set_auto_complete_at` | AFTER UPDATE on `trades` (status → in_progress) | Sets `auto_complete_at = NOW() + (config.auto_complete_hours * interval '1 hour')` |
| `fn_release_sp_on_cancel` | AFTER UPDATE on `trades` (status → cancelled) | Moves `sp_amount` from buyer `reserved_sp` back to `available_sp` |
| `fn_transfer_sp_on_accept` | AFTER UPDATE on `trades` (status → payment_processing) | **No SP movement** — buyer SP stays in `reserved_sp`. Trigger becomes a no-op for SP (retained for future use). |
| `fn_auto_decline_competing` | AFTER UPDATE on `trades` (status → payment_processing) | Sets all other `pending` trades on same `listing_id` to `cancelled` (offer_expired) |
| `fn_release_all_sp_on_complete` | AFTER UPDATE on `trades` (status → completed) | **Single SP release event (D-17)**: (1) deducts buyer `reserved_sp`, (2) calculates platform SP = 25% × price × category_multiplier, (3) adds combined total to seller `pending_sp` in one DB operation |
| Cron: `process_expired_offers` | Every 5 min | Cancels pending trades where `offer_expires_at < NOW()` |
| Cron: `process_auto_complete` | Every 5 min | Completes in_progress trades where `auto_complete_at < NOW()` **AND `dispute_status NOT IN ('reported', 'under_review')`** |
| Cron: `release_pending_sp` | Every hour | Moves `pending_sp` to `available_sp` where `completed_at + (sp_pending_release_days * interval '1 day') < NOW()` **AND `dispute_status NOT IN ('reported', 'under_review')`** |

---

## 14. Implementation Modules

Suggested implementation order and dependencies:

| Module | Name | Depends On | Scope |
|---|---|---|---|
| **Module 1** | Admin Config — Trade Timing Fields | DB column additions | Admin site config page + API |
| **Module 2** | DB Schema — `offer_expires_at` + `auto_complete_at` | Module 1 (to read config) | DB migration + triggers |
| **Module 3** | SP Reserve/Release Mechanism | Module 2 | DB triggers: `fn_reserve_sp_on_offer`, `fn_release_sp_on_cancel`, `fn_transfer_sp_on_accept` |
| **Module 4** | Offer Expiry — Cron + Auto-decline | Module 2, 3 | Supabase cron + `fn_auto_decline_competing` |
| **Module 5** | Auto-Complete — Cron | Module 2 | Supabase cron: `process_auto_complete` |
| **Module 6** | Platform SP Calculation on Completion | Module 5 | `fn_calc_platform_sp` trigger |
| **Module 7** | `<OfferCountdownPill />` Component | Module 2 | React Native component |
| **Module 8** | `<AutoCompleteBanner />` Component | Module 2 | React Native component |
| **Module 9** | TradeListScreen — Offers Tab Updates | Module 7 | Add expiry field, countdown pill, sort logic |
| **Module 10** | ReviewOfferScreen — SP Total Display + Wallet Projection | Module 3 | Update SP display logic |
| **Module 11** | TradeTimelineScreen + TradeDetailScreen — Remove Seller Mark Step | None | Remove `seller_marked_completed_at` from completion flow |
| **Module 12** | Item Detail — "Pay Cash" / "Use SP" Buttons + Free User Lock | None | Update button labels and logic |
| **Module 13** | Unified Offer Flow — Remove "Buy Now" Stripe Pre-charge | Module 12 | Deprecate `TradeInitiationScreen` inline Stripe path; all paths go through offer → seller approval → payment |
| **Module 14** | Completion Screen — Targeted CTAs by User Type | Module 6 | Update `TradeSuccessScreen` and post-completion navigation |
| **Module 15** | Seller Ignoring Offers Prompt | Module 4 | Track `consecutive_unanswered_offers_count`, push notification logic |
| **Module 16** | Push Notification Schedule | Module 1 (config), 4, 5 | Integrate admin-configured notification times into notification cron jobs; enforce throttling rules (Section 9.5) |
| **Module 17** | Dispute State Machine + Admin Dashboard | Modules 5, 6 | DB migration (dispute columns on `trades`); buyer [Report a Problem] modal on `TradeTimelineScreen`; admin queue UI with [Mark Under Review] / [Resolve → Complete] / [Resolve → Refund]; cron guards added to `process_auto_complete` and `release_pending_sp` |
| **Module 18** | Seller Payout Integration | Module 17 | Payout trigger on `completeTradeV2()`; payout columns (`payout_status`, `payout_idempotency_key`); `requires_action` flow + repeat notification; idempotency via Stripe idempotency key `payout_[trade_id]` |
| **Module 19** | Event Instrumentation | Modules 1–16 | `trade_events` table (or analytics webhook); all 16 events from Section 16 must fire server-side for both user-triggered and cron-triggered state changes |
| **Module 20** | Safe Meetup V1-Lite Card | Module 11 | Static dismissible text guidance card on `TradeTimelineScreen` when `trade.status = 'in_progress'` (Section 11.5 spec). No location API required. |
| **Module 21** | Structured Pickup Helpers | Module 11 | Canned quick-reply chips above message input on `ChatScreen` when `trade.status = 'in_progress'` (Section 11.6 spec). No trade state effect — chat convenience only. |
| **Module 22** | Cart Bundle Checkout | Modules 1–3, 15.2 cart infrastructure | `bundle_id` column migration + index; `rpc_initiate_trade_v2` accepts optional `p_bundle_id UUID` param; cart checkout loop (validate → generate bundle_id → N trade creates); bundle grouping UI on seller ReviewOfferScreen (Section 11.3.1); bundle row on buyer TradeListScreen; "Confirm all" shortcut on TradeTimelineScreen; explicit saved cart eviction warning modal (Decision D-29) |

---

## 15. TODO / Open Items

### TODO-01 — Off-Platform Deal Risk 🚨

**Risk**: In-app messaging allows sellers and buyers to coordinate pickup. Nothing prevents them from agreeing to complete the transaction outside the platform (e.g., "just Venmo me $30 and skip the app fee"). This is the #1 platform leakage risk in local P2P marketplaces.

**Impact**: Direct revenue loss (no transaction fee collected), no SP earned/spent, no rating generated, platform loses trust/dispute coverage, no safety record if something goes wrong.

---

#### Leakage Windows — When the Risk Is Highest

| # | Window | Description | Risk Level |
|---|---|---|---|
| W-1 | **Pre-offer messaging** | Buyer messages seller before submitting an offer — "is this available? can I pay you on Venmo?" | 🔴 High |
| W-2 | **Post-acceptance coordination** | After seller accepts, both parties are in active chat to coordinate pickup. Easiest moment for "just pay me cash in person." | 🔴 High |
| W-3 | **Auto-complete exploitation** | Buyer intentionally does NOT tap "I Got It." After 48h auto-complete fires. No payment is taken outside the platform, but buyer never confirms — they may have completed the deal in cash instead. | 🟡 Medium |
| W-4 | **No-offer direct meetup** | Buyer and seller find each other in-app, agree on a price via message, meet in person, exchange cash — never submit an offer at all. | 🟡 Medium |

---

#### Competitive Landscape — CORRECTED

> ⚠️ **Important correction**: Earlier analysis benchmarked against Mercari and Poshmark. These are primarily shipping platforms. Our app is a local meetup marketplace. The correct competitive baseline is local platforms — where the fee is **$0**.

| Platform | Local In-Person Transaction Fee | How they address leakage |
|---|---|---|
| **Facebook Marketplace** | **$0 — completely free for local cash meetups** | No leakage problem to solve — they give up on capturing fees for local |
| **OfferUp (local)** | **$0 — completely free for local meetups** | Message scanning for external payment terms; TrustBadge system for in-app payments |
| **Craigslist** | **$0** | No mitigation — purely cash-based by design |
| **Mercari** | 10% seller + ~2.9% buyer (but shipping only) | Auto-scans messages for phone numbers, Venmo/Zelle, external URLs; warns or blocks |
| **Poshmark** | $2.95 flat / 20% (but shipping only) | Eliminates risk entirely — no local pickup, ships through platform |

**Key insight**: The direct competitors for local transactions charge **nothing**. Our platform must earn the right to charge fees by delivering real, perceivable value that free alternatives cannot match. The SP system, trade protection, trusted community layer, and ratings are our value stack. Any fee we charge must feel smaller than the value gap relative to FB Marketplace.

---

#### Mitigation Options — Ranked by ROI / Effort

| Priority | Mitigation | Mechanism | Effort | Why |
|---|---|---|---|---|
| 🥇 P1 | **SP stickiness** | SP and ratings only generate through the platform. A seller who skips the app also skips earning SP on that sale. For active sellers, accumulated SP loss is real money. | Zero dev cost (already built) | Strongest economic disincentive. Self-reinforcing over time. |
| 🥇 P1 | **In-chat friction reminder** | Before/during chat, show persistent banner: *"SP and buyer protection only apply to in-app trades. Outside deals aren't covered."* | Low | Passive, non-blocking, addresses W-1 and W-2 directly |
| 🥈 P2 | **Message content scanning** | Scan outgoing messages for: Venmo, Zelle, Cash App, PayPal, external payment URLs, 10-digit phone numbers. Show warning toast: *"Sharing payment details outside the app removes your buyer protection."* — do NOT hard-block (too aggressive, false positives) | Medium | Industry standard (Mercari, OfferUp do this). Covers W-1, W-2 |
| 🥈 P2 | **Fee transparency at offer** | On the offer preview screen, show the fee as a line item alongside the SP earned: e.g., *"Platform fee: $0.99 | SP you'll earn: 8 SP ($8 value) → net benefit"*. Makes fee look small vs. value returned. | Low | Cognitive reframing — especially powerful once fee structure is finalized |
| 🥉 P3 | **Auto-complete leakage detection** | Track ratio of auto-completes vs. buyer-confirmed completions per seller. High auto-complete rate (>40%) is a signal the seller may be taking offline cash. Flag for admin review. | Medium | Indirect signal, many false positives. Better as a data metric than a blocker. |
| 🥉 P3 | **Post-meetup nudge** | Push notification to buyer: *"Did you pick up [Item] from [Seller]? Tap to confirm and release SP."* Sent at T+6h after auto-complete fires if buyer never tapped. | Low | Recovers honest forgetters AND signals to intentional leakers that the platform noticed |
| ⏳ P4 | **Safe meetup spots feature** | Surface verified public meetup spots (police station lobbies, community centers, libraries) when a trade enters `in_progress`. Increases perceived platform value and safety. NOT primarily a leakage deterrent — primarily a safety and trust signal. | Medium–High | Separate TODO below (TODO-07) |
| ⏳ P4 | **Verified identity badge** | Kids Club+ subscribers get a profile badge indicating KYC-level identity verification. Encourages in-app transactions as a trust signal. | High | Long-term trust infrastructure. Post-MVP. |
| ❌ Skip | **Hard-blocking payment keyword messages** | Full block on messages containing payment terms | High | Creates false positives, hurts UX, users route around it instantly (abbreviations, typos) |

---

---

#### ✅ LOCKED — V1 Implementation (with Trading Flow V2)

| # | Item | Where | Spec | Decision |
|---|---|---|---|---|
| V1-1 | **SP + ratings only through platform** | Already built | No action — confirm this is called out in onboarding copy | D-19 baseline |
| V1-2 | **No phone / external link fields on profile** | Profile schema | Do not add phone number or social link fields to user profile. Structural prevention by omission. | Structural |
| V1-3 | **In-chat safety banner** | `ChatScreen` header | Persistent, non-dismissible banner: *"SP and buyer protection only apply to in-app trades. Outside deals aren't covered."* | D-19 |
| V1-4 | **Value stack on offer preview** | `OfferPreviewScreen` | Add fee + SP earned line items: *"Platform fee: $X.XX \| SP you'll earn: N SP ($N value)"*. Depends on fee structure being finalised (TODO-07) — use current config values until resolved. | D-20 |
| V1-5 | **Pre-first-message safety modal** | `ChatScreen` | One-time modal shown before user's first message on a given listing. Copy: *"Keep your trade safe — SP and buyer protection only work for in-app transactions. Deals made outside the app aren't covered."* [Got it] button. Store dismissed state per listing in local storage. | D-21 |
| V1-6 | **Post-meetup buyer nudge** | Push notification | If `auto_complete_at` fires AND `buyer_confirmed_at` is null → send push to buyer at T+6h: *"Did you pick up [Item]? Tap to confirm and release your SP."* Deep link to `TradeTimelineScreen`. | D-22 |
| V1-7 | **ToS clause** | Terms of Service | Add clause: *"Transactions completed outside the platform are a violation of our Terms of Service and forfeit all buyer protection, SP earnings, and trade ratings."* Legal only — no dev. | Legal |

---

#### ✅ LOCKED — V1.1 Implementation (after first 200–300 completed trades)

> **Rationale for deferral**: Message scanning false-positive rates can only be calibrated against real message volume. Auto-complete ratio is only meaningful once there are enough trades to establish a baseline. Do not build these blind.

| # | Item | Where | Spec | Decision |
|---|---|---|---|---|
| V1.1-1 | **Message content scanning (soft warn)** | `ChatScreen` send handler | Client-side regex on outgoing message text before send. Patterns: `venmo`, `zelle`, `cashapp`, `cash app`, `paypal`, `pp me`, 10-digit phone strings `(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})`, external payment URLs. Action: show warning toast *"Sharing payment info outside the app removes your buyer protection"* — message still sends, never blocked. | D-23 |
| V1.1-2 | **Auto-complete ratio metric** | Admin dashboard | Per-seller stat: `auto_complete_rate = auto_completes / total_completions`. Display on seller detail page in admin. Flag sellers with >50% rate AND 5+ trades for manual review queue. No automated account action. | D-24 |
| V1.1-3 | **Safe Trades count on seller profile** | `SellerProfileScreen` | Display "X safe trades completed" badge on seller profile once they reach 5+ in-app completed trades. Visible to buyers on listing detail and offer screens. | — |

---

#### Deferred / Out of Scope

| Item | Why deferred |
|---|---|
| Progressive scanning escalation (L2/L3) | Needs V1.1 scanning data first to tune |
| Safe meetup spots map | Safety feature, not leakage — see TODO-06 |
| Verified identity badge / phone verification | High cost, post-MVP |
| Hard message blocking | Skip permanently — degrades UX, users trivially bypass |
| Geolocation meetup tracking | Skip permanently — privacy risk |

---

**Status**: ✅ V1 and V1.1 scope locked. Ready for implementation planning.

---

### TODO-02 — Seller Reliability Score (Post-MVP)

Track seller cancellation rate and response rate. Display on seller profile after 5+ completed trades. Feeds buyer trust and reduces ghosting behavior.

**Fields needed** (partially implemented in Module 11.7):
- `post_acceptance_cancellation_count` INTEGER — incremented on each post-Stripe-charge cancellation
- `response_rate` NUMERIC — % of offers responded to within 6h
- `avg_response_time_hours` NUMERIC
- `admin_review_flagged_at` TIMESTAMPTZ — set when seller reaches the review threshold

**Progressive cancellation enforcement** (V1 — implemented in Section 11.7 / Module 11.7):

| Post-Acceptance Cancellations | Action |
|---|---|
| 1 | In-app toast to seller; counter incremented |
| 2 | Push reminder 24h later: *"A third cancellation may affect your selling privileges."* |
| 3+ | Admin review flag set; seller notified; no automatic suspension — admin reviews manually |

**Full Reliability Score display** (post-MVP): Surface `cancellation_count`, `response_rate`, and `avg_response_time` on seller profile after 5+ completed trades. Score shown as a badge to buyers.

---

### TODO-03 — Per-Category Offer Expiry Timing (V2)

Currently all listings use global timing config (Decision D-16). High-value items (strollers, car seats) may warrant a longer offer window than low-value clothing. Defer to V2.

---

### TODO-04 — Counter-Offer (V2)

Seller can propose a different SP allocation in response to buyer's offer (without changing the cash price). Not in scope for V1 (Decision D-06).

---

### TODO-05 — Price Negotiation (V2)

Buyers can propose a lower cash price on any listing. Not in scope for V1. Would require changes to `cash_amount_cents` and a negotiation state in the state machine.

---

### TODO-06 — Safe Meetup Guidance

**V1 scope LOCKED** (Module 20 / Section 11.5): Static dismissible text guidance card shown on `TradeTimelineScreen` when `trade.status = 'in_progress'`. No external API, no curated location database, no map view required for V1.

**V1 copy** (locked):
> *"For your safety, choose a busy public spot — library entrance, coffee shop, or police station lobby. Never meet at a private address."*

**V1 implementation notes**:
- Card is dismissible per trade (dismissed state stored in local storage keyed by `trade_id`)
- Compact "🛡️ Meeting safely? [Tips]" link re-shows card after dismissal
- Visible to both buyer and seller
- Full spec in Section 11.5

**V2 — Full Safe Spots Feature** (still requires product + UX session):
- Surfacing verified, public meetup locations (police station lobbies, library entrances, community centers)
- Data source: static curated list per city/region vs. Google Places API vs. crowdsourced — TBD
- Scope: nationwide vs. pilot 1–2 launch cities — TBD
- UX: dedicated map picker screen, or inline on `TradeTimelineScreen` — TBD
- Integration: should chosen meetup spot be saved to trade record for dispute reference? — TBD
- Admin flag: `enable_safe_spots_map` in `feature_flags` category to toggle per region

---

### TODO-07 — Fee Structure & Platform Economics 🔴

**Background**: The current fee model was designed before competitive positioning was fully understood. A full health-economics review is needed before locking in numbers.

**Critical finding — two conflicting fee systems exist in the codebase:**

| System | Location | What it does | In production? |
|---|---|---|---|
| System A (flat fee) | `src/services/trade.ts` | Charges `transaction_fee_subscriber_cents` ($0.99) or `transaction_fee_non_subscriber_cents` ($2.99) per trade | ✅ Yes — this is the actual charge |
| System B (percentage fee) | `src/services/spCalculatorService.ts` | Shows `platform_fee_buyer_percentage` (2.5%) + `platform_fee_buyer_fixed_cents` ($0.25) | ❌ No — preview/educational display only |

**UX inconsistency**: The SP Calculator shows a different fee formula than what is actually charged at checkout. This creates a trust issue that must be resolved.

**Key constraints for the economic model:**
1. **Direct local competitors charge $0** — FB Marketplace and OfferUp local are free. Our fees must be justified by SP value, safety features, and trade protection — not just because we can.
2. **Minimum item price**: A $1 minimum (current `min_transaction_amount_cents = 100`) is economically broken. Stripe alone costs $0.33 on a $1 transaction. A $12 minimum (`min_transaction_amount_cents = 1200`) is a reasonable floor and needs confirmation.
3. **SP earnings as fee offset**: On a $34.50 average transaction, a subscriber seller earns ~$8.63 SP. The $0.99 fee is 11% of that SP gain — very easy to justify. Fee positioning should lean on this story.
4. **Subscription as primary revenue**: The subscription fee ($3.99/month) may carry more predictable revenue than transaction fees. Consider whether transaction fees are necessary at all for subscribers, or if they exist only to differentiate subscription value.

**Open questions (needs dedicated session):**
- Should subscribers pay zero transaction fee (pure subscription model) vs. current $0.99?
- Is a seller-side percentage fee (in addition to or instead of a buyer flat fee) the right model?
- What is the right minimum item price ($12 proposed)?
- How do we reconcile System A and System B — which formula becomes the single source of truth?
- Does the BRD revenue model hold up once we accept that our local competitors are free?

**Admin config keys that will need updating** (once model is decided):

| Key | Current Value | Issue |
|---|---|---|
| `min_transaction_amount_cents` | 100 ($1.00) | Too low — Stripe cost alone is $0.33 on $1 |
| `transaction_fee_non_subscriber_cents` | 299 ($2.99) | May be too high relative to a $0 baseline |
| `platform_fee_buyer_percentage` | 2.5 | Only used in preview (System B) — inconsistent with actual charge |
| `platform_fee_seller_percentage` | 5.0 | Not currently applied in any trade charge path |

**Status**: Deferred pending dedicated economics review session. Do NOT implement fee changes until this TODO is resolved and decisions logged here.

---

### TODO-08 — Pickup Scheduling with `auto_complete_at` Reset (V1.1)

**Context**: Buyers and sellers currently arrange pickup informally via chat. The `auto_complete_at` timer is fixed (set at `in_progress` + config hours) and has no awareness of the parties' agreed meetup time. If a trade enters `in_progress` on Monday but both parties agree to meet Saturday, the auto-complete timer may fire before the pickup happens.

**V1 decision**: Canned quick-reply chips only (Module 21 / Section 11.6). Chips are convenience shortcuts sent as chat messages — they have no effect on trade state or `auto_complete_at`.

**V1.1 full pickup scheduling spec** (deferred — requires V1 trade volume data to validate timing patterns before building):

Seller proposes one or more pickup windows after their offer is accepted. Buyer selects a window. System resets `auto_complete_at` based on the agreed time.

**Flow**:
1. After `trade.status → in_progress`, seller is prompted to suggest pickup windows (1–3 options)
2. Buyer selects one window (or buyer proposes their own alternatives)
3. On agreement: `agreed_pickup_at` is saved; `auto_complete_at` is reset to `agreed_pickup_at + 4h`
4. If no window is agreed within 12h of trade entering `in_progress`: `auto_complete_at` falls back to `in_progress_at + 48h` (existing default)

**New DB columns needed** (V1.1 migration, do not add to V1 DB migration):
```sql
ALTER TABLE trades
  ADD COLUMN suggested_pickup_windows JSONB,  -- Array of proposed windows [{proposed_at, slots: [{start, end}]}]
  ADD COLUMN agreed_pickup_at TIMESTAMPTZ;     -- The confirmed window start time
```

**`auto_complete_at` reset logic** (V1.1 only):
- If `agreed_pickup_at IS NOT NULL`: `auto_complete_at = agreed_pickup_at + INTERVAL '4 hours'`
- If no agreement within 12h: retain `auto_complete_at = in_progress_at + 48h`
- Admin config key: `scheduling_grace_period_hours` (default: 4) — hours after agreed pickup before auto-complete fires

**Dependency**: Requires sufficient trade volume data from V1 to understand typical pickup timing patterns before committing to the UX model.

---

## 16. Event Instrumentation

All trade lifecycle events must be logged server-side. Client-side analytics alone is insufficient — cron-triggered completions, auto-declines, and SP operations happen entirely server-side and would be invisible without server-side logging.

**Preferred implementation**: `trade_events` table (insert-only, append log) OR an analytics webhook (Segment, PostHog, etc.). Either approach must capture the events below. If using a table, the schema is: `(id UUID, trade_id UUID, event_name TEXT, user_id UUID, metadata JSONB, created_at TIMESTAMPTZ)`.

**Module**: Module 19.

### 16.1 Event Reference

| Event Name | Trigger | Key Properties | Notes |
|---|---|---|---|
| `offer_submitted` | Buyer submits offer (trade created, status `pending`) | `trade_id`, `buyer_id`, `seller_id`, `listing_id`, `cash_amount_cents`, `sp_amount`, `buyer_is_subscriber` | Server-side on trade INSERT |
| `offer_accepted` | Seller taps Accept on ReviewOfferScreen | `trade_id`, `seller_id`, `offer_age_seconds` | Server-side on status → `payment_processing` |
| `offer_declined` | Seller taps Decline | `trade_id`, `seller_id`, `decline_reason` (if captured), `offer_age_seconds` | Server-side |
| `offer_expired` | `process_expired_offers` cron fires | `trade_id`, `offer_age_seconds` | Cron-triggered — must log here |
| `payment_succeeded` | Stripe charge succeeds | `trade_id`, `buyer_id`, `amount_cents`, `stripe_payment_intent_id` | Server-side webhook handler |
| `payment_failed` | Stripe charge fails | `trade_id`, `buyer_id`, `failure_code`, `stripe_payment_intent_id` | Server-side webhook handler |
| `buyer_confirmed` | Buyer taps [I Got It] | `trade_id`, `buyer_id`, `time_to_confirm_seconds` (from `in_progress_at`) | Server-side |
| `auto_completed` | `process_auto_complete` cron fires | `trade_id`, `auto_complete_at`, `in_progress_duration_seconds` | Cron-triggered — must log here |
| `issue_reported` | Buyer taps [Report a Problem] and submits | `trade_id`, `buyer_id`, `dispute_reason`, `dispute_category` | Server-side |
| `dispute_resolved` | Admin resolves dispute | `trade_id`, `admin_id`, `dispute_resolution` (`completed` or `refunded`), `dispute_age_hours` | Server-side |
| `seller_cancelled` | Seller cancels after acceptance | `trade_id`, `seller_id`, `time_since_acceptance_seconds`, `seller_cancellation_count` | Server-side |
| `sp_reserved` | Buyer SP reserved on offer submission | `trade_id`, `buyer_id`, `sp_amount`, `buyer_reserved_sp_after` | Server-side trigger |
| `sp_released_to_seller` | SP transferred to seller `pending_sp` on completion | `trade_id`, `seller_id`, `buyer_sp_released`, `platform_sp_granted`, `total_sp_to_seller` | Server-side trigger |
| `sp_restored_to_buyer` | Buyer reserved SP restored on cancel | `trade_id`, `buyer_id`, `sp_amount`, `buyer_available_sp_after` | Server-side trigger |
| `payout_requires_action` | Payout set to `requires_action` (no payout method) | `trade_id`, `seller_id`, `cash_amount_cents` | Server-side |
| `payout_initiated` | Stripe payout call made | `trade_id`, `seller_id`, `payout_amount_cents`, `payout_idempotency_key` | Server-side |

### 16.2 Implementation Requirements

1. **Server-side required**: Events must be inserted by the server (Supabase triggers, Edge Functions, or backend functions). Do not rely on client-side `track()` calls as the only source — users who close the app mid-flow will create gaps.
2. **Both user-triggered AND cron-triggered events must be logged**: `offer_expired`, `auto_completed`, `sp_released_to_seller`, and `sp_restored_to_buyer` have no client-side origin.
3. **Idempotency**: Use `trade_id + event_name` as a deduplication key for cron-triggered events to prevent double-logging on cron retries.
4. **No PII in `metadata`**: Do not log names, email addresses, or payment card details. Trade IDs, user IDs, and SP amounts are acceptable.
5. **`trade_events` table** (if used): Enable Row-Level Security; read access limited to service role and admin role. No user can read another user's events.

---

*End of Document*

*Reference: BRD V2 Section 6.4 FR-TX-001 through FR-TX-004 is superseded by this document for all trade flow requirements.*
