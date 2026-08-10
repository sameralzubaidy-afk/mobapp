# P2P Kids Marketplace - System Requirements & Specifications Document V2

**Version:** 2.0  
**Last Updated:** August 9, 2026  
**Document Purpose:** Complete technical specifications for subscription-gated Swap Points model  
**Status:** Final - Ready for Development  

> **Added 2026-08-09 — N1 Configurability (Cross-Cutting):** Section 1.6 below establishes the single admin-tunable configuration layer that all requirement domains (R1–R13) read from instead of hardcoding values.

---

## 🎯 MAJOR UPDATE: Subscription-Gated Swap Points Model

This version reflects the **FINAL DECISION** to implement Swap Points as an **exclusive Kids Club+ benefit**. This represents a significant architecture change from V1 and provides the strongest legal protection while driving subscription revenue.

**Key Changes from V1:**
- SP earning/spending restricted to Kids Club+ subscribers only
- 3-day pending period for earned SP (fraud protection)
- Platform auto-calculates SP amounts (sellers don't choose)
- Sellers choose payment preferences: Cash Only, Accept SP, or Donate
- 50% maximum SP usage per transaction (ensures cash liquidity)
- Donation listings earn badges instead of SP

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Subscription System](#subscription-system)
5. [Swap Points System (Subscription-Gated)](#swap-points-system-subscription-gated)
6. [Core Features & Specifications](#core-features--specifications)
7. [Trade Flow & Seller Payouts](#trade-flow--seller-payouts)
8. [Business Rules & Logic](#business-rules--logic)
8A. [N6 — Node Tagging (Cross-Cutting)](#8a-n6--node-tagging-cross-cutting)
8B. [N2 — Idempotency & Audit (Cross-Cutting)](#8b-n2--idempotency--audit-cross-cutting)
9. [Data Models](#data-models)
10. [API Specifications](#api-specifications)
11. [Trust & Safety Implementation](#trust--safety-implementation)
12. [Admin Control Panel Specifications](#admin-control-panel-specifications)
13. [Analytics & Metrics](#analytics--metrics)
14. [Integration Requirements](#integration-requirements)
15. [Security & Privacy](#security--privacy)
16. [Performance Requirements](#performance-requirements)
17. [Testing Requirements](#testing-requirements)

---

## 1. Executive Summary

### 1.1 Product Overview

P2P Kids Marketplace is a hyper-local, mobile-first marketplace where verified parents buy, sell, or swap used kids' items (clothes, toys, gear) safely and privately within their community.

### 1.2 Core Differentiators

- **Privacy-First**: Masked identities, no public profiles
- **Swipe-Based Discovery**: Tinder-style interface for browsing relevant items
- **Subscription-Gated SP**: Swap Points exclusive to Kids Club+ subscribers
- **Dual User Tiers**: Free (cash-only) vs. Premium (SP + cash)
- **Bundle Enforcement**: $20 minimum cart value to protect unit economics
- **Child-Centric**: Personalized "For [Kid Name]" feeds per child profile
- **Trust & Safety**: Phone verification, recall checks, safe meetup guidance

### 1.3 Business Model (Updated)

| Revenue Stream | Amount | Notes |
|----------------|--------|-------|
| **Kids Club+ Subscription** | $7.99/month | Primary revenue driver (30-day free trial) |
| **Transaction Fee (Subscribers)** | $0.99/transaction | Reduced fee for members |
| **Transaction Fee (Free Users)** | $2.99/transaction | Standard fee |
| **Delivery Service** | $10/delivery | Optional same-day delivery |

**Revenue Strategy:** Subscription model creates predictable recurring revenue while transaction fees ensure cash flow on every sale. SP system drives subscription conversion and retention.

### 1.4 Target Scale (Year 1)

- **MAU**: ~7,200 users
- **Subscribers**: 2,160 (30% conversion target)
- **Monthly Subscription Revenue**: $17,257
- **Target AOV**: $34.50
- **LTV:CAC Target**: ≥ 3:1

### 1.5 Cost Optimization Philosophy

**Critical Requirement:** Infrastructure and third-party tool costs must be kept to a **minimum, preferably free**, without impacting user experience.

**Guidelines:**
- **Prioritize free tiers** of services (Supabase, Vercel, Railway, etc.)
- **Open-source first** - Use free, well-maintained open-source tools before paid alternatives
- **Scale gradually** - Start with free/low-cost solutions, upgrade only when necessary
- **Efficient architecture** - Optimize queries, caching, and asset delivery to minimize compute costs
- **Serverless where possible** - Leverage serverless functions to avoid idle server costs

**Examples:**
- Use **Supabase Free Tier** (500MB database, 1GB file storage, 2GB bandwidth) before upgrading
- Use **Vercel Free Tier** for frontend hosting (100GB bandwidth/month)
- Use **Cloudflare Free** for CDN and DDoS protection
- Use **GitHub Actions Free** for CI/CD (2,000 minutes/month)

**Non-Negotiable User Experience:**
- Page load times: <2 seconds
- Image load times: <1 second
- Real-time chat delivery: <500ms
- 99.9% uptime target
- Cost optimization should never compromise these metrics

---

### 1.6 N1 — Configurability (Cross-Cutting)

**Status:** Implemented 2026-08-09 (gap-fill + consolidation). This is a **shared dependency** for the R1–R13 requirement set: every other requirement must read its fee, timing, SP, and tax values from this config layer rather than hardcoding them.

**Goal:** An admin can change any of the six domains below in the admin portal and the change takes effect in the live app and E2E flows **without a code deploy**.

#### The six tunable domains → single source of truth

| # | Domain | Where the value lives (single source) | Admin surface |
|---|---|---|---|
| 1 | Countdown windows — **offer** | `admin_config.offer_timeout_hours`, `offer_notif_1/2_hours_before`, `auto_complete_hours`, `auto_complete_notif_hours_before` | `/settings/trade-timing` + `/config → trade` |
| 2 | Countdown windows — **pickup** | `admin_config.pickup_window_hours` (enforced — R2), `pickup_notif_1/2_hours_before` **(new)** | `/settings/trade-timing` (Pickup & Payout section) |
| 3 | Grace period length | `admin_config.grace_period_days` (canonical; `sp_config.grace_period_days` is the legacy duplicate — readers must prefer `admin_config`) | `/subscriptions/manage` + `/config` |
| 4 | Payout buffer | `admin_config.payout_buffer_days` (enforced — R3) | `/settings/trade-timing` (Pickup & Payout section) |
| 5 | SP caps / multipliers per category | `categories.sp_earning_multiplier`, `categories.sp_spending_cap_percent`, `categories.sp_rate_change_notify`, `categories.sp_redemption_cap` (absolute per-item cap, optional) | Category admin (Group D) — **server-enforced at checkout by R11/R5** |
| 6 | Tax rates per node/category | `nodes.tax_rate` / `nodes.tax_enabled`, `category_tax_rules`, plus `admin_config.default_sales_tax_rate` | `/tax/settings`, `/tax/nodes`, `/tax/rules` |
| — | Buyer/seller fee parameters | `admin_config` (fees): `platform_fee_*`, `transaction_fee_*`, `payout_fee_*` | `/config → fees` + `/settings/trade-timing` |

#### R2 — Auth-and-Capture + Countdown State Machine (enforcement, 2026-08-10)

R2 enforces the pickup countdown (previously tunable-but-unenforced) and adds the 7-day Stripe guardrail:

- **Auth-and-capture hold:** checkout places an **uncaptured** Stripe authorization hold (`capture_method='manual'`, `authorization_expires_at` = offer creation + 7 days). SP is soft-reserved; `tax_status='quoted'`. Payment is captured ONLY on buyer completion ("I Got It") or the auto-complete deadline — never at offer submission. (D-30; matches deployed code, spec §4.3 wording updated.)
- **Offer window (48h default):** `offer_timeout_hours`; unaccepted offers auto-cancel at `offer_expires_at` — Stripe hold cancelled/released, SP restored, tax voided.
- **Pickup window (72h default):** the post-acceptance deadline is now sourced from `pickup_window_hours` (fallback: legacy `auto_complete_hours`, then 72h). Auto-complete behavior at the deadline is **retained** (owner decision 2026-08-09): if the buyer never confirms, the trade auto-completes (capture + SP release + payout) rather than auto-cancelling.
- **7-day guardrail (HARD BLOCK):** admins cannot configure `offer_timeout_hours + pickup_window_hours ≥ 168h`. `fn_validate_trade_timing_config()` raises an exception (hard block, not auto-clamp); the admin UI validates the same rule; the runtime `check-authorization-expiry` cron remains the backstop. This guarantees capture always precedes Stripe's 7-day authorization expiry.
- **Reminders:** configurable in-app + push reminders fire in every window — offer reminders to the seller (`offer_notif_1/2_hours_before`), auto-complete reminders to the buyer (`auto_complete_notif_1/2_hours_before`, default 24h/2h, read from config by `rpc_send_auto_complete_reminders`), and pickup-window reminders to the buyer (`pickup_notif_1/2_hours_before`, default 24h/2h, via `rpc_send_pickup_reminders` + `send-pickup-reminders` cron every 5 min). All three pairs are admin-tunable and take effect without a code deploy.

#### R3 — Delayed Seller Payout + Buffer (enforcement, 2026-08-10)

R3 enforces the payout buffer (`admin_config.payout_buffer_days`, seeded default **2**, admin-tunable **0–30** at `/settings/trade-timing` → Pickup & Payout), previously tunable-but-unenforced:

- **Delayed payout release:** when a trade completes, the seller payout is created with a stored `payout_release_at` computed from the **actual completion timestamp** (`trades.completed_at`) + the buffer value in effect **when the trade completes** — never from the expected `auto_complete_at` window. A trade completed later (e.g. via a granted extension) naturally produces a correspondingly later release date, with no special-case logic.
- **Release date stored:** `seller_payouts.payout_release_at` (mirrored on `trades.payout_release_at`) is written at payout creation by `create_seller_payout_on_trade_completion()`.
- **Dispatch gated:** the completion trigger (`fn_queue_payout_on_complete`) no longer dispatches `initiate-payout` before the release date. A new hourly cron `release-due-payouts` → Edge Function → `rpc_release_due_payouts` dispatches due payouts (status `completed`, no open dispute, `payout_release_at ≤ now`, `payout_status = 'pending'`) and moves `seller_balance` funds from `pending_balance_cents` → `available_balance_cents` at release.
- **Funds pending until release:** buffered proceeds sit in `seller_balance.pending_balance_cents` (mirrors the SP 3-day pending pattern) and are not withdrawable until the release date.
- **Buffer 0 = immediate:** a buffer of 0 (or a missing/invalid config key) preserves today's instant-payout behavior — release date = completion time, trigger dispatches immediately.
- **Backward compatible:** existing completed payouts were backfilled to release immediately (no retroactive delay); new completions use the configured buffer. Mobile (Earnings / Payout Dashboard / Request Payout) and the admin payouts list surface the release date; manual withdrawal is blocked until release.

#### RPC contract (config read / write)

- **Write (single path):** `upsert_admin_config_setting(p_key, p_value, p_category, p_data_type, p_is_secret, p_is_active, p_admin_id)` — records `admin_config.updated_by` and lands an `admin_audit_log` row. All admin surfaces must use this RPC; never write `admin_config` directly (BP-48).
- **Read (bulk):** `fn_get_admin_config_values(p_keys text[])` — active-only, SECURITY DEFINER, used by admin settings pages.
- **Read (typed, for R1–R13):** `fn_admin_config_int(p_key text, p_default int)` **(new)** — returns the stored integer or `p_default` when missing/invalid so the caller can decide to fail loud (BP-28) instead of silently hardcoding.

#### Rules

1. **No hardcoded values** for fees, timing, SP caps/multipliers, or tax in the mobile app or Edge Functions — read from config at runtime. Migration `20260804000001_remove_hardcoded_config_fallbacks.sql` already removed referral-SP hardcoded fallbacks; remaining EF-level defaults (e.g. `?? 72`, `DEFAULT_GRACE_PERIOD_DAYS`) are flagged known gaps to migrate as each R-requirement lands.
2. **Single source of truth** — the `admin_config` key/value table is the hub; per-entity values (category SP, node/category tax) live on those entity tables and are all admin-editable.
3. **No duplicate config stores** — new keys must be added to `admin_config`; do not create a second config table.
4. **Audit every change** — editor + timestamp recorded on `admin_config` and in `admin_audit_log`.

---

### 1.7 R7 — Web-First Subscription Purchase + Status Sync (Option A)

> **Added 2026-08-09.** Subscription purchase is a **web-first** funnel. The mobile
> apps (iOS/Android) contain **NO purchase button, price-selection UI, or App
> Store / Play Store billing trigger** (App Store Guideline 3.1.3). Parents
> discover membership in-app, complete the Stripe purchase on the web
> (passitup.com), and the backend flags the account; R1 (fee) and R6 (SP gating)
> unlock automatically on the next app open. Renewals re-sync on every Stripe
> billing event.

**Full 7-step journey (locked 2026-08-09):**

| Step | What happens | Where |
|---|---|---|
| 1 | Parent downloads Pass It Up, creates a free account, browses, lists, trades | In app |
| 2 | Parent sees a "Join Kids Club" prompt surfacing the membership value prop (earn SP, flat $1.49 member fee instead of the free-user percentage fee) | In app |
| 3 | App shows manage-membership messaging pointing to the web ("Manage your membership at passitup.com") — **NO purchase button anywhere in the iOS/Android app** | In app |
| 4 | Parent goes to the website, subscribes via Stripe (hosted Checkout), with Apple Pay, Google Pay, and card | Web |
| 5 | Stripe confirms the subscription; the backend webhook flags that account as subscribed | Backend |
| 6 | Parent reopens the app; the app reads subscription status; member benefits (SP earn/spend per R6, $1.49 flat fee per R1) unlock | In app |
| Renewal | Stripe auto-charges the web-side card monthly/annually; the backend re-syncs on each renewal/failure so the app stays accurate | Web/backend |

**Key rules:**

1. **In-app prompt is non-purchase (Steps 2–3).** The "Join Kids Club" entry point (new `JoinKidsClubScreen`) explains the value prop and contains zero purchase UI. Tapping it opens the **external system browser** (`Linking.openURL` → Safari/Chrome) at `passitup.com/join` — never an in-app webview (3.1.3). No IAP, no native Stripe sheet for subscriptions, no price-selection cards.
2. **Web checkout (Step 4) uses Stripe hosted Checkout Session** (`mode=subscription`, `automatic_payment_methods` → card + Apple Pay + Google Pay). Card data is collected on Stripe's PCI-DSS Level 1 domain → **SAQ-A**; no client Stripe SDK and no custom card fields on the web. Price/trial come from `subscription_tiers` (default active tier's `stripe_price_id`, `trial_days`), fail-loud if unconfigured (BP-28).
3. **Account linking (Steps 4–5).** The checkout Edge Function resolves the app user by email (`profiles.email`) and sets `client_reference_id` + `metadata.supabase_user_id` on the Session so the webhook binds by ID. If no account exists yet, a one-time HMAC `bind_token` (over the email) is issued; `link-subscription-account` redeems it after the parent signs in (email-match + token).
4. **Webhook flags the account (Step 5).** `stripe-webhook-subscriptions` handles `checkout.session.completed`, `customer.subscription.created`, `invoice.payment_succeeded` (new) plus the existing `customer.subscription.updated/deleted`, `invoice.payment_failed`. Stripe `trialing` maps to internal `trial` (with `trial_end_date`); `active` → `active`. Writes go through the atomic RPC `rpc_upsert_web_subscription` (owner/service-role only) + a `subscription_events` audit row.
5. **Benefit unlock (Step 6).** R1 fee and R6 SP gating both read `subscriptions.status IN ('trial','active')` — no fee/SP code change needed; the webhook-set status flips them. The app refetches on app-foreground (`useSubscription` AppState listener) and on screen focus, so reopening reflects the new tier without manual refresh.
6. **Renewal sync (Renewal row).** `invoice.payment_succeeded` → `record_payment_attempt(success:true)` (resets retry count, clears `payment_failed_at`, sets last payment) + inserts a `billing_history` 'succeeded' row, and restores status to `active` if a prior failure had pushed it to grace. `invoice.payment_failed` (existing) → grace after 3 retries + SP freeze (R6); `grace-period-cron` transitions to `expired` past the grace end. The app reflects the updated status on next open.
7. **No app-store commission.** All subscription revenue flows through Stripe on the web; the apps take no cut.

**Consumer web app:** new `p2p-kids-web/` (Next.js) at passitup.com with `/` (landing), `/join` (value prop + email → Stripe Checkout via `create-checkout-session` EF), and `/account/subscription` (post-purchase confirmation).

**Edge Functions:** `create-checkout-session` (new), `link-subscription-account` (new), `stripe-webhook-subscriptions` (extended). **RPC:** `rpc_upsert_web_subscription` (new). **Env:** `SUBSCRIPTION_WEB_URL`, `SUBSCRIPTION_WEB_SECRET`, `SUBSCRIPTION_BIND_TOKEN_SECRET` (EF secrets); `EXPO_PUBLIC_SUBSCRIPTION_WEB_URL` (mobile).

---

## 2. System Architecture

### 2.1 Technology Stack (Recommended - Cost-Optimized)

**Frontend:**
- **React Native** (iOS + Android from single codebase)
- **React** (web admin panel)
- **Tailwind CSS** for styling
- **Vercel** for hosting (Free tier: 100GB/month bandwidth)

**Backend:**
- **Node.js + Express** or **Python + FastAPI**
- **Supabase** (PostgreSQL + Auth + Storage in one)
  - Free tier: 500MB database, 1GB storage, 2GB bandwidth
  - Upgrade at ~1,000 users to Pro ($25/month)
- **Redis** (caching, sessions)
  - **Upstash** (serverless Redis, free tier: 10,000 commands/day)
- **Cloudflare R2** for image storage (free tier: 10GB storage, no egress fees)

**Third-Party Services:**
- **Twilio** (SMS verification) - $0.0079/SMS (est. $50/month for 500 users)
- **Stripe** (payments, subscriptions) - 2.9% + $0.30/transaction
- **Supabase Auth** (email/phone authentication) - included in free tier
- **Cloudflare** (CDN, DDoS protection) - Free tier

**AI/ML (Optional for MVP):**
- **Open-source models** (self-hosted) for image moderation if cost is issue
- **AWS Rekognition** or **Google Vision AI** if budget allows ($1-5/1000 images)

### 2.2 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │ React Native│  │ React Web  │  │  Admin Portal   │   │
│  │   (Mobile)  │  │  (Future)  │  │   (React)       │   │
│  └────────────┘  └────────────┘  └─────────────────┘   │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTPS/WSS
┌───────────────────────▼──────────────────────────────────┐
│                  API GATEWAY LAYER                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Supabase Edge Functions / Custom API Server    │   │
│  │  - Authentication & Authorization                │   │
│  │  - Rate Limiting                                 │   │
│  │  - Request Validation                            │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────��───────────────────┐
│              APPLICATION LAYER (Business Logic)          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ User Mgmt│  │ Listings │  │Gamific.  │  │Messages │ │
│  │  Service │  │  Service │  │ Service  │  │ Service │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                ┌──────────┐                            │
│                │  Swap    │                            │
│                │  Points  │                            │
│                │  Service │                            │
│                └──────────┘                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Payment  │  │Geography │  │ Moderation│  │Analytics│ │
│  │  Service │  │  Service │  │  Service  │  │ Service │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                     DATA LAYER                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Supabase PostgreSQL (Primary Database)        │    │
│  │  - Users, Listings, Transactions                │    │
│  │  - Swap Points, Subscriptions, Badges           │    │
│  │  - Messages, Node Management, Badge Configs     │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Upstash Redis (Cache & Sessions)              │    │
│  │  - Session management                            │    │
│  │  - Real-time feed caching                       │    │
│  │  - Rate limiting counters                       │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Cloudflare R2 (Object Storage)                │    │
│  │  - User-uploaded images                         │    │
│  │  - Listing photos                                │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 3. User Roles & Permissions

### 3.1 User Types

#### 3.1.1 Free User

**Access:**
- ✅ Browse all listings
- ✅ Create listings (sell items)
- ✅ Buy items (cash only)
- ✅ Message other users
- ✅ Full marketplace functionality

**Restrictions:**
- ❌ Cannot earn Swap Points
- ❌ Cannot spend Swap Points
- ❌ Cannot create "Accept SP" listings
- ❌ Cannot donate items for badges
- ❌ Higher transaction fee ($2.99 vs $0.99)

**Permissions Matrix:**
```
{
  "can_browse": true,
  "can_create_listing": true,
  "can_buy": true,
  "can_sell": true,
  "can_message": true,
  "can_earn_sp": false,
  "can_spend_sp": false,
  "can_accept_sp_listings": false,
  "can_donate": false,
  "transaction_fee": 2.99
}
```

#### 3.1.2 Kids Club+ Subscriber

**Access:**
- ✅ Everything in Free tier, PLUS:
- ✅ Earn Swap Points on sales (platform-calculated amount)
- ✅ Spend SP for discounts (up to 50% of item price)
- ✅ Create "Accept SP" listings
- ✅ Donate items and earn badges
- ✅ Reduced transaction fee ($0.99)
- ✅ Priority matching algorithm
- ✅ Early access to new listings

**Permissions Matrix:**
```
{
  "can_browse": true,
  "can_create_listing": true,
  "can_buy": true,
  "can_sell": true,
  "can_message": true,
  "can_earn_sp": true,
  "can_spend_sp": true,
  "can_accept_sp_listings": true,
  "can_donate": true,
  "transaction_fee": 0.99,
  "priority_matching": true,
  "early_access": true
}
```

#### 3.1.3 Admin

**Full platform access:**
- ✅ User management
- ✅ Content moderation
- ✅ SP configuration
- ✅ Node management
- ✅ Analytics dashboard
- ✅ Manual SP adjustments
- ✅ Fraud investigation

**Permissions Matrix:**
```
{
  "can_view_all_users": true,
  "can_suspend_users": true,
  "can_moderate_content": true,
  "can_configure_sp": true,
  "can_manage_nodes": true,
  "can_adjust_sp_manually": true,
  "can_access_analytics": true,
  "can_export_data": true
}
```

### 3.2 Subscription States

| State | Description | SP Access | Grace Period |
|-------|-------------|-----------|--------------|
| **Free** | Never subscribed | No | N/A |
| **Trial** | In 30-day free trial | Yes (full access) | N/A |
| **Active** | Paid subscription active | Yes (full access) | N/A |
| **Cancelled** | Subscription cancelled; benefits continue until period end | Yes (benefits until period end) | 90 days (starts at period end) |
| **Grace Period** | Within 90 days of period end | Spend existing SP only (no new earn) | Days remaining |
| **Expired** | >90 days after period end | No (SP frozen — restored on resubscribe) | N/A |

> **R6 (2026-08-09):** Grace-period users CAN spend existing SP but CANNOT earn new SP, and they pay the free-user fee (R13). After grace ends, the SP balance is FROZEN (not deleted) and becomes spendable again on resubscription.

**State Transitions:**
```
Free → Trial (signup for KC+)
Trial → Active (trial ends, payment succeeds)
Trial → Free (trial ends, user doesn't convert)
Active → Cancelled (user cancels)
Cancelled → Grace Period (immediately)
Grace Period → Expired (after 90 days)
Grace Period → Active (user resubscribes)
```

---

## 4. Subscription System

### 4.1 Kids Club+ Subscription

**Pricing:**
- Monthly: $7.99/month
- Annual: Not offered in MVP (future: $79/year, save $16)
- Trial: 30 days free (no credit card required until trial ends)

**Features Included:**
1. **Swap Points System** - Earn and spend SP
2. **Reduced Transaction Fee** - $0.99 vs. $2.99
3. **Priority Matching** - Algorithm prioritizes subscribers in feeds
4. **Early Access** - See new listings 30 minutes before free users
5. **Enhanced Support** - Priority email support

**Subscription Lifecycle:**

```
┌─────────────────────────────────────────────────────┐
│ SIGNUP                                              │
│ User chooses "Try Kids Club+ Free"                 │
└───────────┬─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│ TRIAL PERIOD (30 Days)                             │
│ - Full SP access                                   │
│ - No payment required                              │
│ - Reminders at Day 23, 28, 29                      │
└───────────┬────────────────────────────────────────���┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│ TRIAL END (Day 30)                                 │
│ Prompt: "Add payment method to continue"           │
└───────┬────────────────────┬────────────────────────┘
        │                    │
        ▼                    ▼
  ┌──────────┐        ┌──────────────┐
  │ CONVERT  │        │ DON'T CONVERT│
  │ (Add card)│        │ (Downgrade)  │
  └────┬─────┘        └──────┬───────┘
       │                     │
       ▼                     ▼
  ┌──────────┐        ┌──────────────┐
  │  ACTIVE  │        │   FREE TIER  │
  │ (Billing │        │ (SP frozen)  │
  │  monthly)│        │              │
  └────┬─────┘        └──────────────┘
       │
       │ (User cancels)
       ▼
  ┌──────────┐
  │CANCELLED │
  │ (Wallet  │
  │  frozen) │
  └────┬─────┘
       │
       │ (90 days)
       ▼
  ┌──────────┐
  │ EXPIRED  │
  │ (SP lost)│
  └──────────┘
```

### 4.2 Subscription Business Rules

**BR-SUB-001: Trial Eligibility**
- Each user gets ONE free trial (tied to phone number + email)
- If user previously had trial and resubscribes → no second trial
- Exception: Admin can manually grant trial credits

**BR-SUB-002: Payment Processing**
- Trial ends Day 30 at 11:59 PM (user's timezone)
- First charge occurs Day 31 at 12:00 AM
- Billing date remains consistent (e.g., 15th of each month)
- Failed payment → 3 retry attempts over 7 days
- After 3 failures → downgrade to Free tier

**BR-SUB-003: Cancellation**
- User can cancel anytime
- Cancellation effective at end of current billing period
- Benefits (incl. SP spending) continue until the period ends
- 90-day grace period begins after subscription ends (R6: can spend existing SP, cannot earn new)

**BR-SUB-004: Grace Period**
- User has 90 days to resubscribe and recover SP
- SP wallet remains SPENDABLE for existing SP (R6) but the user CANNOT earn new SP
- The user pays the free-user fee at checkout during grace (R13)
- After 90 days → SP balance is FROZEN (not deleted); it becomes spendable again on resubscription
- Notifications sent at Day 60, 30, 7, and 1 before expiration

**BR-SUB-005: Resubscription**
- If within grace period → SP wallet unfrozen immediately
- If after grace period → start fresh with 0 SP
- User may receive "welcome back" bonus (e.g., 20 SP)

---

## 5. Swap Points System (Subscription-Gated)

### 5.1 Core Principles

1. **Membership Benefit** - SP is exclusive to Kids Club+ subscribers
2. **Platform-Calculated** - Sellers do not choose SP amounts (platform auto-calculates)
3. **Closed-Loop** - SP cannot be cashed out, must circulate in marketplace
4. **Contingent Earning** - Earned SP are pending for 3 days (can be cancelled if return occurs)
5. **50% Cap** - Buyers can use maximum 50% of item price in SP (rest must be cash)
6. **Seller Control** - Sellers choose whether to accept SP on their listings

### 5.2 How Subscribers Earn SP

#### 5.2.1 Earning Mechanics

**When:** Upon completing a sale (item delivered/picked up, no disputes)  
**Amount:** Platform auto-calculates based on configurable formula  
**Received As:** SP (NOT cash) - added to seller's SP wallet  
**Release Timing:** 3-day pending period (protects against returns)

**Earning Formula (Admin Configurable):**

Platform supports multiple formula types. Admin chooses one per node:

**Option A: Price Bands + Multipliers**
```
Price Band      Base SP    Category Multiplier    Final SP
────────────────────────────────────────────────────────────
$1-10          5 SP       × 1.0 (Toys)          = 5 SP
$11-25         10 SP      × 1.5 (Baby Gear)     = 15 SP
$26-50         20 SP      × 1.25 (Seasonal)     = 25 SP
$51-100        35 SP      × 1.0 (Clothes)       = 35 SP
$101-200       60 SP      × 1.5 (Baby Gear)     = 90 SP
$201+          100 SP     × 1.5 (Baby Gear)     = 150 SP
```

**Option B: Percentage-Based**
```
Base: 25% of sale price
Minimum: 10 SP per sale
Category multipliers apply

Example:
$20 toy (25% × 1.0) = 5 SP → 10 SP (minimum applied)
$100 stroller (25% × 1.5) = 37.5 SP → 38 SP (rounded)
```

**Option C: Hybrid**
```
Base: 20% of sale price
Minimum: 10 SP
Maximum: 200 SP per transaction
Category multipliers: 1.0x - 1.5x

Flexible approach balancing predictability with strategic incentives
```

**User Experience:**
- During listing creation, seller sees: "You may earn up to XX SP when this sells"
- SP amount is estimate only (final amount calculated at sale time)
- Sellers NEVER do math - platform always displays calculated amount

#### 5.2.2 Receiving SP from Buyers

**When buyer pays with SP:**
- Buyer's SP are deducted from their wallet
- Seller receives equivalent SP immediately (not pending)
- Example: Buyer uses 50 SP → Seller gets 50 SP in wallet (available now)

**Key Distinction:**
- **Earned SP** (from sale) = Pending for 3 days
- **Received SP** (from buyer) = Available immediately

### 5.3 How Subscribers Spend SP

#### 5.3.1 Redemption Mechanics

**Redemption Rate:** 1 SP = $1 discount  
**Maximum SP Usage:** 50% of item price (must pay at least 50% cash)  
**Platform Fee:** Always $0.99 cash (cannot be paid with SP)  
**Seller Listing Control:** Sellers choose "Cash Only" or "Accept SP"

#### 5.3.2 Purchase Examples

**Example 1: $100 Stroller (Seller Accepts SP)**
```
Subscriber Options:
├─ Option A: 50 SP + $50 cash + $0.99 fee = $50.99 total
├─ Option B: 25 SP + $75 cash + $0.99 fee = $75.99 total  
└─ Option C: 0 SP + $100 cash + $0.99 fee = $100.99 total

Free User:
└─ Only option: $100 cash + $2.99 fee = $102.99 total

Seller Receives (Option A):
├─ 50 SP (added to wallet immediately)
└─ $50.99 cash (minus 5% seller fee = $48.44 to bank)
```

**Example 2: $100 Stroller (Seller Cash Only)**
```
Everyone pays same item price:
├─ Subscriber: $100 cash + $0.99 fee = $100.99
└─ Free user: $100 cash + $2.99 fee = $102.99

Seller Receives:
└─ $100 cash (minus 5% seller fee = $95 to bank)
```

### 5.4 Seller Listing Payment Preferences

When creating a listing, sellers (subscribers only) choose:

#### 5.4.1 Option 1: Cash Only 💵
```
Description: Buyers must pay full price in cash
Seller Receives: 100% cash (minus platform fee)
Buyer Can Use SP: No
Best For: Sellers who need cash immediately
Badge: None
```

#### 5.4.2 Option 2: Accept SP 🔀
```
Description: Buyers can use up to 50% SP
Seller Receives: Mix of SP + cash
  - SP portion → Added to seller's wallet (available immediately)
  - Cash portion → Sent to bank account
Buyer Can Use SP: Yes (up to 50% of price)
Best For: Sellers who have SP to spend or want faster sales
Badge: "Accepts SP" shown on listing
```

#### 5.4.3 Option 3: Donate 🎁
```
Description: Item is free, buyer pays $0.99 fee only
Seller Receives: 0 SP + 0 cash
Seller Gets: Donation badge progress
Buyer Can Use SP: No (fee is cash only)
Best For: Community goodwill, decluttering, earning badges
Badge: "Free" shown on listing

Badge Progression:
├─ 1 donation   → 🌟 "Helper"
├─ 5 donations  → ⭐ "Generous"  
├─ 10 donations → 💫 "Community Champion"
└─ 25 donations → 🏆 "Super Parent"
```

**Important:** Sellers who choose "Accept SP" receive SP (not cash) from the SP portion of the transaction. Platform does NOT convert SP to cash for sellers. This is key to legal structure - sellers must spend SP in marketplace (closed-loop system).

### 5.5 SP Wallet Mechanics

#### 5.5.1 Two-State System

**Available SP**
- Can spend immediately
- Released after 3-day pending period
- Received from buyers immediately
- Displayed as: "Available Balance: XX SP"

**Pending SP**
- Earned from recent sales
- Waiting for 3-day return window to close
- Releases automatically after 3 days (if no return)
- Displayed as: "Pending: XX SP (releases Dec 8)"

#### 5.5.2 3-Day Pending Period (Fraud Protection)

```
Timeline:
────────────────────────────────────────────────────────
Day 0: Sale completed
  └─ Seller earns 25 SP (status: pending)
  └─ SP cannot be spent yet
  └─ Wallet shows: "25 SP pending (releases in 3 days)"

Day 1-2: Monitoring period
  └─ If buyer files return → SP cancelled
  └─ If buyer reports fraud → SP cancelled
  └─ Normal case: SP remain pending

Day 3: Auto-release (if no issues)
  └─ SP automatically change to "available"
  └─ Notification: "Your 25 SP are now available!"
  └─ Seller can now spend them

If return occurs on Day 2:
  └─ SP cancelled before release
  └─ Seller never receives them (no negative balance)
  └─ Notification: "25 SP cancelled due to buyer return"
```

**Why 3 Days?**
- ✅ Prevents fraud (users can't sell, earn SP, spend immediately, then return)  
- ✅ Legally defensible (contingent earning, not guaranteed payment)  
- ✅ Platform protected (no SP loss on legitimate returns)

#### 5.5.3 SP Expiration Rules

**While Subscribed:** SP never expire  

**After Cancellation:** 90-day grace period
```
User cancels Kids Club+ subscription
├─ SP wallet remains spendable for EXISTING SP (R6 — cannot earn new SP)
├─ 90-day countdown begins
├─ User can resubscribe anytime during grace period; SP stays spendable
└─ After 90 days: SP balance is FROZEN (not deleted) until the user resubscribes

Notifications:
├─ Day 60: "Your SP will be frozen in 30 days. Resubscribe to keep them!"
├─ Day 83: "Your SP freeze in 7 days. Don't lose 125 SP - resubscribe now!"
└─ Day 89: "Last chance! Your 125 SP freeze tomorrow."
```

### 5.6 Business Rules

**BR-SP-001: Earning Eligibility**
- Only Kids Club+ subscribers can earn SP
- Free users cannot earn SP even if they create "accept cash" listings
- If user downgrades from KC+ to Free mid-listing → listing auto-converts to "Cash Only"

**BR-SP-002: Spending Eligibility**
- Only Kids Club+ subscribers can spend SP — with one R6 exception
- R6 (2026-08-09): users in the 90-day grace period CAN spend existing SP (they just cannot earn new SP)
- Free users cannot use SP even if they have balance (shouldn't be possible but enforce)
- If user has frozen SP (post-grace expired) → cannot spend

**BR-SP-003: SP Calculation**
- Platform calculates SP at time of sale (not at listing time)
- Uses current admin-configured formula for that node
- Result is rounded to nearest whole SP (no fractional SP)
- Minimum SP per transaction: 5 SP (configurable)
- Maximum SP per transaction: 200 SP (configurable)

**BR-SP-004: SP Redemption Limits**
- Maximum 50% of item price can be paid with SP
- Minimum 50% of item price must be paid in cash
- Platform fee ($0.99) must always be paid in cash
- Cannot use SP on donated items (free listings)

**BR-SP-005: Pending Release**
- Earned SP remain pending for exactly 72 hours (3 days)
- Auto-release job runs daily at midnight UTC
- If return filed before release → SP cancelled
- If fraud detected before release → SP cancelled
- Manual admin override available for edge cases

**BR-SP-006: Seller Payment Preference**
- Only subscribers can select "Accept SP" or "Donate"
- Free users default to "Cash Only" (no choice shown)
- Sellers can change preference anytime before first buyer interest
- Once buyer has contacted → preference locked

**BR-SP-007: Return Handling**
- If buyer paid with SP and returns item:
  - Buyer gets SP refunded to wallet (not cash)
  - Seller's received SP are deducted (if spent, platform absorbs loss)
- If seller's earned SP are still pending:
  - SP cancelled before release (seller never gets them)
- If seller already spent the received SP:
  - Platform absorbs loss (cost of doing business)
  - Flag user for fraud monitoring

**BR-SP-008: Grace Period**
- Exactly 90 calendar days from subscription period end
- SP balance is spendable for EXISTING SP during grace (R6); the user cannot earn new SP and pays the free-user fee (R13)
- Resubscription within 90 days → instantly spendable again (wallet back to `active`)
- After 90 days → SP balance FROZEN (not deleted); it becomes spendable again on resubscription

**BR-SP-009: Negative Balance Prevention**
- System must validate available SP before allowing spend
- Cannot spend pending SP
- Cannot go into negative SP balance
- If edge case occurs → manual admin resolution

**BR-SP-010: Transaction Priority**
- SP transactions processed before cash portion
- If SP deduction fails → entire transaction fails
- If cash processing fails after SP deducted → SP auto-refunded

---

## 6. Core Features & Specifications

### 6.1 User Authentication & Onboarding

#### 6.1.1 Signup Flow

```
Step 1: Welcome Screen
├─ "Get Started" button
└─ "I Already Have an Account" button

Step 2: Account Creation
├─ First Name
├─ Last Name  
├─ Email Address
├─ Phone Number
├─ Password
└─ Agree to Terms checkbox

Step 3: Subscription Choice (NEW)
├─ Option A: Start Free ($0/month)
│   ├─ Buy & sell with cash
│   ├─ $2.99 per transaction
│   └─ [Start Free] button
│
└─ Option B: Try Kids Club+ Free
    ├─ Everything in Free, PLUS:
    ├─ Earn SP on sales
    ├─ Use SP for discounts
    ├─ $0.99 per transaction
    ├─ $7.99/month after 30-day trial
    └─ [Try Free for 30 Days] button

Step 4: Phone Verification
├─ 6-digit SMS code sent to phone
├─ User enters code
└─ Verification complete

Step 5: Child Profile Setup (Optional)
├─ Child's first name
├─ Birthdate (for age-appropriate recommendations)
├─ Sizes (auto-calculated from age)
└─ Interests/categories

Step 6: Geographic Node Assignment
├─ Auto-detect ZIP code from phone/IP
├─ Check if ZIP in active node
│   ├─ If YES → Proceed to main app
│   └─ If NO → Waitlist screen
└─ User can browse waitlist but not transact
```

**Data Captured:**
```json
{
  "user_id": "uuid",
  "first_name": "Sarah",
  "last_name": "Johnson",
  "email": "sarah@example.com",
  "phone": "+15555551234",
  "phone_verified": true,
  "password_hash": "bcrypt_hash",
  "subscription_type": "premium" | "free",
  "subscription_status": "trial" | "active" | "cancelled" | "expired",
  "trial_start_date": "2025-12-05T12:00:00Z",
  "trial_end_date": "2026-01-04T12:00:00Z",
  "created_at": "2025-12-05T12:00:00Z",
  "zip_code": "06850",
  "node_id": "norwalk_ct"
}
```

### 6.2 Listing Creation

#### 6.2.1 Create Listing Flow (Subscriber)

```
Step 1: Upload Photos
├─ 1-5 photos required
├─ First photo = main image
├─ AI scans photo for:
│   ├─ Item category
│   ├─ Brand recognition
│   ├─ Condition estimate
│   ├─ Safety recalls (if detected → warning)
│   └─ Inappropriate content (reject if found)
└─ Progress: [●○○○]

Step 2: AI Review (Auto-Fill Suggestions)
├─ Title: "Winter Coat - Excellent Condition"
├─ Category: "Clothes"
├─ Size: "4T"
├─ Brand: "Carter's"
├─ Condition: "Like New"
├─ Confidence: 85%
├─ User can accept all or edit manually
└─ Progress: [●●○○]

Step 3: Details & Pricing
├─ Title (editable)
├─ Category (dropdown)
├─ Size (dropdown, category-specific)
├─ Condition (5 options: New, Like New, Good, Fair, Just OK)
├─ Description (optional, 500 chars max)
├─ Price ($5 - $500 range, min $20 enforced)
└─ Progress: [●●●○]

Step 4: Payment Preference (SUBSCRIBERS ONLY) (NEW)
├─ Option 1: Cash Only 💵
│   ├─ "Buyers pay full $XX in cash"
│   ├─ "You receive: $XX.XX cash"
│   └─ Radio button
│
├─ Option 2: Accept Swap Points 🔀
│   ├─ "Buyers can use SP for discounts"
│   ├─ "You may earn: ~XX SP"
│   ├─ "Plus: Cash for non-SP portion"
│   ├─ Info tooltip: "SP amount based on price + category"
│   ├─ Note: "When buyers use SP, you receive SP (not cash)"
│   └─ Radio button (default selected)
│
└─ Option 3: Donate (Free) 🎁
    ├─ "Give it away, buyer pays $0.99 fee"
    ├─ "You earn: Donation badge 🌟"
    ├─ "Progress: X/10 donations to Champion badge"
    └─ Radio button

Progress: [●●●●]

Step 5: Review & Publish
├─ Photo carousel
├─ Title, category, size, condition
├─ Price
├─ Payment preference
├─ Estimated earnings:
│   ├─ Cash: $XX.XX (if applicable)
│   └─ SP: ~XX SP (pending 3 days after sale)
├─ [Edit] buttons for each section
└─ [Publish Listing] button
```

#### 6.2.2 Create Listing Flow (Free User)

Same as subscriber through Step 3, then:

```
Step 4: Payment Preference (FREE USERS)
├─ Option 1: Cash Only 💵
│   ├─ "Buyers pay full $XX in cash"
│   ├─ "You receive: $XX.XX cash"
│   └─ Selected by default (no other options)
│
└─ 🔒 MEMBERS ONLY FEATURES (Locked)
    ├─ 🔀 Accept Swap Points
    │   ├─ "Earn ~XX SP when this sells"
    │   └─ "Get paid faster with SP option"
    │
    ├─ 🎁 Donate & Earn Badges
    │   └─ "Build community karma"
    │
    └─ [Unlock with Kids Club+] button
        └─ Opens upgrade modal

Progress: [●●●●]
```

**Data Model (Listing):**
```json
{
  "listing_id": "uuid",
  "seller_id": "uuid",
  "title": "Winter Coat - Excellent Condition",
  "category": "clothes",
  "size": "4T",
  "brand": "Carter's",
  "condition": "like_new",
  "description": "Barely worn, perfect for...",
  "price": 25.00,
  "photos": [
    "https://cdn.../photo1.jpg",
    "https://cdn.../photo2.jpg"
  ],
  "payment_preference": "accept_sp" | "cash_only" | "donate",
  "estimated_sp": 15,  // Only if accept_sp or donate
  "status": "active" | "sold" | "deleted",
  "node_id": "norwalk_ct",
  "created_at": "2025-12-05T14:30:00Z",
  "views": 42,
  "favorites": 7
}
```

### 6.3 Browse & Discovery

#### 6.3.1 Home Feed (Swipe Interface)

**Layout:**
```
┌─────────────────────────────────────┐
│  [< Back]    For: Emma (4T)  [Filter│
├─────────────────────────────────────┤
│                                     │
│         [Item Image Card]           │
│                                     │
│  Winter Coat - Like New             │
│  $25  [Accepts SP 🔀]               │
│  Listed by Sarah M. ⭐⭐⭐⭐          │
│  2 miles away • 3 hours ago         │
│                                     │
│  [❌ Pass]         [❤️ Like]         │
│                                     │
├─────────────────────────────────────┤
│ Matches: 12 | Liked: 3 | SP: 125    │
└─────────────────────────────────────┘
```

**Swipe Actions:**
- **Swipe Right / Tap Heart** → Like (save to favorites)
- **Swipe Left / Tap X** → Pass (hide from feed)
- **Tap Card** → Open detail view

**Feed Algorithm:**
1. Child profile match (size, age, interests)
2. Distance (closer = higher priority)
3. Recency (newer = higher priority)
4. Subscriber priority (KC+ members see new items 30 min early)
5. SP acceptance (if user has SP, prioritize "Accept SP" listings)

#### 6.3.2 Listing Detail View

**For Subscriber viewing "Accept SP" listing:**
```
┌─────────────────────────────────────┐
│  [< Back]                    [Share]│
├─────────────────────────────────────┤
│                                     │
│  [Photo Carousel: 3 photos]         │
│  ● ○ ○                              │
│                                     │
├─────────────────────────────────────┤
│  Winter Coat - Like New             │
│  Listed 3 hours ago • 2.1 miles away│
│                                     │
│  $25                                │
│  Accepts: 💵 Cash + 🔀 Swap Points  │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  YOUR PRICE OPTIONS:                │
│                                     │
│  💎 Use 12 SP:  $13.99              │
│     (12 SP + $13 + $0.99 fee)       │
│     YOU SAVE $12! 🎉                │
│                                     │
│  💵 Pay all cash: $25.99            │
│     ($25 + $0.99 fee)               │
│                                     │
│  You have 125 SP available          │
│                                     │
│  [Buy Now]  [Message Seller]        │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Description:                       │
│  Barely worn winter coat, perfect   │
│  condition. No stains or tears...   │
│                                     │
│  • Brand: Carter's                  │
│  • Size: 4T                         │
│  • Condition: Like New              │
│  • Category: Clothes                │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  About Seller:                      │
│  Sarah M. ⭐⭐⭐⭐⭐ (4.9)            │
│  Member since: Nov 2025             │
│  Response time: < 1 hour            │
│  47 completed sales                 │
│  💫 Community Champion (12 donations)│
│                                     │
└─────────────────────────────────────┘
```

**For Free User viewing same listing:**
```
│  $25                                │
│  Accepts: 💵 Cash + 🔀 Swap Points  │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  YOUR PRICE:                        │
│  $27.99                             │
│  ($25 + $2.99 fee)                  │
│                                     │
│  ℹ️ Kids Club+ members can save     │
│     up to $12 on this with SP       │
│                                     │
│  [Buy Now]  [Learn About Kids Club+]│
```

### 6.4 Purchase Flow

#### 6.4.1 Checkout (Subscriber buying "Accept SP" listing)

```
┌─────────────────────────────────────┐
│  🛒 CHECKOUT                        │
├─────────────────────────────────────┤
│                                     │
│  Winter Coat - Like New             │
│  Price: $25                         │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  HOW WOULD YOU LIKE TO PAY?         │
│                                     │
│  USE SWAP POINTS?                   │
│                                     │
│  [━━━━━●━━━━━━] 12 SP              │
│   0 SP        12 SP (max 50%)       │
│                                     │
│  Quick Select:                      │
│  [Use Max SP] [Use Half] [Cash Only]│
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  YOUR TOTAL:                        │
│                                     │
│  Item Price:         $25.00         │
│  SP Discount:        -$12.00 (12 SP)│
│  Platform Fee:       $0.99          │
│  ─────────────────────────          │
│  TOTAL:              $13.99 + 12 SP │
│                                     │
│  New SP Balance: 113 SP             │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Pickup/Delivery:                   │
│  ○ Local Pickup (Free)              │
│  ○ Same-Day Delivery ($10)          │
│                                     │
│  Payment Method:                    │
│  Visa •••• 4242  [Change]           │
│                                     │
│  [Complete Purchase]                │
│                                     │
└─────────────────────────────────────┘
```

**Purchase Confirmation:**
```
┌─────────────────────────────────────┐
│  ✅ PURCHASE COMPLETE!              │
├─────────────────────────────────────┤
│                                     │
│  Winter Coat - Like New             │
│  Order #KC123456                    │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  PAYMENT SUMMARY:                   │
│                                     │
│  💎 SP Used:       12 SP            │
│  💵 Cash Paid:     $13.99           │
│                                     │
│  You saved $12 with Swap Points! 🎉 │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  NEXT STEPS:                        │
│                                     │
│  1. Sarah will confirm the item     │
│  2. Arrange pickup at:              │
│     📍 Starbucks, Main St           │
│     🕐 Tomorrow at 3 PM             │
│  3. Complete the exchange           │
│                                     │
│  [Message Sarah]  [View Order]      │
│                                     │
└─────────────────────────────────────┘
```

#### 6.4.2 Seller Notification (After sale with SP)

```
┌─────────────────────────────────────┐
│  🎉 SALE COMPLETE!                  │
├─────────────────────────────────────┤
│                                     │
│  Winter Coat - $25                  │
│  Sold to: Jessica K.                │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  YOUR EARNINGS:                     │
│                                     │
│  💵 Cash:  $13.94                   │
│     (on the way to your bank)       │
│     $13 (buyer paid) + $0.99 (fee)  │
│     - 5% seller fee                 │
│                                     │
│  ⏳ SP Earned:    15 SP (pending)   │
│     Releases in 3 days (Dec 8)      │
│     Based on $25 price + Clothes    │
│                                     │
│  ⭐ SP Received: 12 SP (available)  │
│     From buyer's payment            │
│     Added to your wallet now!       │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  WHY THE WAIT FOR EARNED SP?        │
│  Your earned 15 SP will release     │
│  after the 3-day return window      │
│  closes. The buyer's 12 SP are in   │
│  your wallet now!                   │
│                                     │
│  Current SP Balance: 137 SP         │
│  (125 available + 12 from this sale)│
│                                     │
│  [View SP Wallet]  [List Another]   │
│                                     │
└─────────────────────────────────────┘
```

### 6.5 SP Wallet Interface

(Already detailed in Section 5.5, but adding UI specs here)

**Main Wallet Screen:**
```
┌─────────────────────────────────────┐
│  ⭐ SWAP POINTS WALLET        [?]   │
├─────────────────────────────────────┤
│                                     │
│  💎 AVAILABLE NOW                   │
│  125 SP                             │
│  Ready to spend!                    │
│                                     │
│  [Shop with SP →]                   │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  ⏳ PENDING                         │
│  38 SP                              │
│                                     │
│  ├─ 38 SP (releases Dec 8)          │
│  │  Baby Stroller sale             │
│  │  [Why pending?]                 │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  📊 TOTAL SP: 163                   │
│  (125 available + 38 pending)       │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  THIS MONTH:                        │
│  Earned: 53 SP                      │
│  Received: 80 SP (from buyers)      │
│  Spent:  25 SP                      │
│  Net:    +108 SP 📈                 │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  RECENT ACTIVITY:                   │
│                                     │
│  Dec 5  Received SP      +50 SP     │
│         (Buyer used for stroller)   │
│                                     │
│  Dec 5  Earned SP        +38 SP ⏳  │
│         (Stroller sale - pending)   │
│                                     │
│  Dec 3  Used SP          -25 SP     │
│         (Bike purchase)             │
│                                     │
│  Dec 1  SP Released      +15 SP     │
│         (Toy sale)                  │
│                                     │
│  [View All Activity]                │
│                                     │
└─────────────────────────────────────┘
```

---

## 7. Trade Flow & Seller Payouts

### 7.1 Overview

**Seller Payout System** enables sellers to receive payment after trades complete through multiple provider-managed channels. Platform charges **zero transaction fee** on payouts; sellers pay transparent provider fees.

**Supported Methods (Phase 1):**
- **Stripe Connect (Express)**: $0.25 + 0.25% per payout
- **PayPal Payouts**: 2% (capped at $20)
- **Venmo**: 2% (capped at $20)
- **Bank ACH** (Post-MVP): ~$0.50 per deposit

### 7.2 Payout Method Management

**Seller Controls:**
- Add multiple payout methods (one per provider type)
- Mark one method as **primary** (must be verified)
- Change primary method anytime
- View method verification status
- Delete unused methods

**Verification Requirements:**
- **Stripe Connect**: Automatic via Stripe onboarding dashboard (checks payouts_enabled)
- **PayPal/Venmo**: Email confirmation or "verify later" option
- **Bank ACH**: Phone verification + micro-deposit confirmation (post-MVP)

### 7.3 Payout Ledger

**Automatic Creation:**
Every completed cash trade generates a payout record:

```
Payout Record Fields:
├── id: UUID (unique identifier)
├── seller_id: user UUID
├── trade_id: linked trade UUID  
├── payout_method_id: selected method
├── gross_amount: sale proceeds (before fees)
├── platform_fee: $0.00 (platform takes zero)
├── payout_fee: seller-paid provider fee
├── net_amount: gross - payout_fee
├── status: pending | requires_action | processing | completed | failed
├── provider: stripe | paypal
├── provider_reference_id: external tracking ID
├── idempotency_key: prevents duplicate payouts
├── payout_release_at: release date = completed_at + payout_buffer_days (R3)
└── timestamps: created_at, initiated_at, completed_at
```

**Status Lifecycle:**

```
Success Path:
pending → [payout_release_at elapses] → processing → completed

Blocked Path:
pending → requires_action (no verified method)

Failure Path:  
processing → failed → retry available
```

> **R3 — Delayed payout + buffer:** a payout created at completion sits in `pending` until `payout_release_at` (actual `completed_at` + `payout_buffer_days`). The `release-due-payouts` cron dispatches it (auto mode) and moves `seller_balance` `pending → available`. Buffer `0` = immediate dispatch.

### 7.4 Payout Calculation Engine

**Fee Formulas (Seller-Paid):**

```typescript
// Stripe Connect
fee = Math.round(amountCents * 0.0025) + 25

// PayPal / Venmo  
fee = Math.min(Math.round(amountCents * 0.02), 2000)
```

**Example:**
```
Sale Price: $50.00
Stripe Connect Fee: 0.25% + $0.25 = $0.375 + $0.25 = $0.625 → $0.63
Net to Seller: $49.37

Sale Price: $100.00
PayPal Fee: 2% = $2.00 (not capped since < $20)
Net to Seller: $98.00
```

### 7.5 Admin Configuration: Automatic Payouts

**New Admin Config Flag:**
`enable_automatic_seller_payout` (BOOLEAN, DEFAULT = false)

**Behavior with Flag = TRUE:**
- Payout created and dispatched immediately after trade completion
- If seller has no verified method:
  - Status = `requires_action`
  - Seller prompted to set up payment method
  - No funds held; awaiting seller action
- If verified method exists:
  - Payout routed to provider
  - Status = `processing`
  - Seller receives funds per provider timeline

**Behavior with Flag = FALSE (Default):**
- Payout created with status = `pending`
- Seller sees "Available for Withdrawal: $X.XX"
- Seller must manually request withdrawal via **EarningsScreen**
- Platform routes to provider only when seller initiates
- Aligns with current implementation; no urgent provider setup needed

**Delayed Payout + Buffer (R3):** with either flag, the payout is not dispatched — and buffered funds are not withdrawable — until `payout_release_at`, computed at completion as `trades.completed_at + payout_buffer_days` (admin-tunable 0–30, default 2). The `release-due-payouts` cron dispatches due payouts and moves `seller_balance` `pending_balance_cents → available_balance_cents`. Buffer `0` preserves immediate payout.

### 7.6 Webhook Reconciliation

**Stripe Webhooks:**
- `account.updated`: Verify payout_enabled flag and seller verification status
- `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`: Update payout ledger status

**PayPal Webhooks:**
- `PAYMENT.PAYOUTSBATCH.SUCCESS`: Item completed successfully
- `PAYMENT.PAYOUTSBATCH.DENIED`: Item failed
- Updates seller payout status with provider confirmation

**Security:**
- All webhooks signature-verified before processing
- Webhook delivery logged for audit trail
- Failed webhook delivery triggers retry queue

### 7.7 Mobile App Integration

**Seller Earnings Screen:**
- List recent payouts (last 20 with pagination)
- Show status (pending, processing, completed, failed)
- Display net amount and payout fee
- "Request Withdrawal" button (if auto_payout = FALSE and pending payouts exist)
- Filter by status and date range

**Payout Method Setup Screen:**
- Add new payout method (Stripe, PayPal, Venmo)
- List existing methods with verification badges
- Set one method as primary
- Edit or delete methods
- Stripe onboarding button (redirects to Stripe dashboard)

### 7.8 Admin Panel Integration

**Payout Management Screen:**
- Searchable table of all payouts (seller, status, amount, date)
- Filter by: user, status, date range, payout method
- Sort by amount, date, seller name
- View detailed payout record (amounts, fees, provider reference, timestamps)
- Manual retry button for failed payouts
- Scheduled release date per pending payout (R3) — "Releases [date]"
- Webhook delivery status dashboard

**Payout Configuration:**
- Toggle `enable_automatic_seller_payout`
- View payout volume metrics (last 30 days)
- Success rate by method
- Average payout time
- Failed payout analysis

### 7.9 Data Model

**seller_payout_methods Table:**
```sql
├── id UUID PRIMARY KEY
├── user_id UUID (FOREIGN KEY users.id)
├── method_type TEXT ('stripe_connect', 'paypal', 'venmo', 'bank_ach')
├── is_primary BOOLEAN (one per user, enforced by unique index)
├── is_verified BOOLEAN
├── stripe_account_id TEXT (optional)
├── stripe_onboarding_complete BOOLEAN
├── stripe_payouts_enabled BOOLEAN
├── paypal_email TEXT (optional)
├── venmo_handle TEXT (optional)
├── venmo_phone_e164 TEXT (optional)
├── bank_account_token TEXT (post-MVP)
├── bank_account_last4 TEXT
├── bank_routing_last4 TEXT
├── created_at TIMESTAMPTZ
└── updated_at TIMESTAMPTZ
```

**seller_payouts Table:**
```sql
├── id UUID PRIMARY KEY
├── user_id UUID (FOREIGN KEY users.id)
├── trade_id UUID (FOREIGN KEY trades.id, optional)
├── payout_method_id UUID (FOREIGN KEY seller_payout_methods.id)
├── currency TEXT (default 'usd')
├── gross_amount DECIMAL(10,2)
├── platform_fee DECIMAL(10,2) (always 0.00)
├── payout_fee DECIMAL(10,2)
├── net_amount DECIMAL(10,2)
├── status TEXT (pending, requires_action, processing, completed, failed)
├── provider TEXT (stripe, paypal, ach)
├── provider_reference_id TEXT (external ID)
├── idempotency_key TEXT UNIQUE
├── initiated_at TIMESTAMPTZ
├── completed_at TIMESTAMPTZ
├── failure_reason TEXT
├── payout_release_at TIMESTAMPTZ (R3 — release date = completed_at + payout_buffer_days)
├── created_at TIMESTAMPTZ
└── updated_at TIMESTAMPTZ
```

**Tiered Buyer-Fee Engine — data model additions (R1, first-trade protection):**

```sql
-- profiles: stored buyer fee-state + completed-trade counter (trigger-maintained)
profiles.fee_state TEXT                -- no_completed_trade | first_trade_in_progress
                                       -- | first_trade_completed | subsequent_free | active_member
profiles.completed_trade_count INTEGER -- increments ONLY on trades.status -> 'completed'

-- trades: tier snapshot at offer time + first-trade-consumption marker
trades.buyer_fee_state TEXT                       -- buyer's tier when the offer was created
trades.consumed_first_trade_eligibility BOOLEAN   -- true when this trade's completion consumed
                                                  -- first-trade eligibility (full refund restores it)

-- admin_config (fees category) — all tiered buyer-fee params (seeded defaults)
buyer_fee_active_member_cents    = 149
buyer_fee_first_trade_cents      = 149
buyer_fee_subsequent_percentage  = 5.0
buyer_fee_subsequent_fixed_cents = 199
buyer_fee_subsequent_max_cents   = 499
buyer_fee_label                  = "Safety & Platform Fee"
```

**admin_config Table Extension:**
```sql
ALTER TABLE admin_config ADD COLUMN 
  enable_automatic_seller_payout BOOLEAN DEFAULT FALSE;
```

### 7.10 API Endpoints (Edge Functions)

**Method Management:**
- `POST /create-stripe-connect-account` - Create Stripe Express account
- `POST /create-stripe-account-link` - Generate Stripe onboarding link
- `POST /add-paypal-method` - Add PayPal email
- `POST /add-venmo-method` - Add Venmo handle/phone
- `POST /set-primary-payout-method` - Mark method as primary
- `GET /get-payout-methods` - List seller's methods
- `DELETE /delete-payout-method/{id}` - Remove method

**Payout Processing:**
- `POST /trigger-seller-payout` - Create payout (called on trade completion)
- `POST /process-paypal-payout` - Submit PayPal batch
- `POST /request-seller-withdrawal` - Manual withdrawal request
- `GET /get-seller-payouts` - List payout history
- `GET /get-payout-details/{id}` - View single payout
- `POST /estimate-payout-fee` - Calculate fee before trade

**Webhooks:**
- `POST /stripe-webhooks` - Stripe events
- `POST /paypal-webhooks` - PayPal events

### 7.11 Security & Compliance

**No Sensitive Data Storage:**
✅ Platform stores: method type, Stripe account ID, PayPal email, Venmo handle/phone
❌ Platform NEVER stores: API keys, bank numbers, routing numbers, PayPal credentials

**Webhook Verification:**
- Stripe: Validates `Stripe-Signature` header
- PayPal: Validates signature per PayPal SDK
- All webhooks logged with timestamp, signature hash, and outcome

**RLS & Access Control:**
- Sellers view only their own payouts and methods
- Admins (admin role) view all payouts and manage settings
- Audit log tracks manual admin actions

**Idempotency:**
Every payout submission uses `idempotency_key = "trade:<tradeId>:seller:<sellerId>"`
Prevents duplicate payouts if Edge Function is called multiple times or retried

---

## 8. Business Rules & Logic


### 8.1 Transaction Fees

This section defines how buyer and seller transaction fees are calculated and configured.

> **R1 — Tiered Buyer-Fee Engine (first-trade protection):** the buyer fee is now a
> TIERED fee resolved at checkout by a stored buyer fee-state. Active members and free
> users on their first trade pay a flat **"Safety & Platform Fee"**; free users with one
> or more completed trades pay a percentage of the **cash portion** + a fixed fee, capped.
> All amounts are **DYNAMIC from `admin_config`** (category `fees`) — the values below
> are the seeded defaults, not hardcoded constants. First-trade eligibility is a **state,
> not a counter** — it is consumed ONLY when a trade is successfully captured and
> completed; it is NOT consumed on cancel / timeout / failed capture / refund.

#### 8.1.1 Overview

- Buyer fees are **tiered** by the buyer's fee-state and are **server-authoritative**
  (computed by the `create-trade-offer` Edge Function via `fn_get_buyer_fee_for_checkout`,
  never trusted from the client).
- **Three fee states:**
  1. **Active members** (subscription `trial` or `active`) → flat **Safety & Platform Fee**
     (`buyer_fee_active_member_cents`, default $1.49).
  2. **Free users with no completed trade** → flat fee on their first trade
     (`buyer_fee_first_trade_cents`, default $1.49) — **first-trade protection**.
  3. **Free users with one or more completed trades** → percentage of the cash portion
     + fixed fee, capped (`buyer_fee_subsequent_percentage` default 5.0%,
     `buyer_fee_subsequent_fixed_cents` default $1.99,
     `buyer_fee_subsequent_max_cents` default $4.99 cap on the TOTAL).
- **Only one fee is charged per checkout** regardless of bundle size (single seller,
  multiple items). The percentage fee applies **only to the cash portion** of the order,
  **never to any Swap-Points-covered amount**.
- **Swap Points can never be used to pay platform fees** — all fees are paid in cash.
- **Seller fees** remain percentage-based, deducted from the seller's cash payout on the
  cash portion (see §8.1.3).

#### 8.1.2 Buyer Fee-State Machine & Consumption Rule

The buyer's fee-state is stored on `profiles.fee_state` and transitions through:

```text
no_completed_trade → first_trade_in_progress → first_trade_completed → subsequent_free → active_member
```

| Fee state | Meaning | Fee applied |
|---|---|---|
| `no_completed_trade` | Free user, 0 completed trades, no active trade | Flat first-trade fee |
| `first_trade_in_progress` | Free user, 0 completed trades, has an active trade | Flat first-trade fee |
| `first_trade_completed` | Free user, exactly 1 completed trade | Percentage tier (5% + fixed, capped) |
| `subsequent_free` | Free user, 2+ completed trades | Percentage tier (5% + fixed, capped) |
| `active_member` | Subscription status `trial` or `active` | Flat active-member fee |

**Consumption rule (strictly completion-event driven):** `profiles.completed_trade_count`
increments ONLY when a trade's status transitions to `completed` (successful capture +
completion). Cancelled / timed-out / failed-capture / refunded trades do **not** consume
first-trade eligibility — the state reverts and the flat fee remains available for the next
attempt. Because consumption is tied to the completion event and **never to elapsed time**,
no special handling is required during any future extension-consent wait.

- **Full refund** of the trade that consumed first-trade eligibility restores it
  (counter decrements, state reverts). Partial refunds never restore eligibility.
- **Subscription changes** flip the state: entering `trial`/`active` → `active_member`;
  leaving them reverts to the free state computed from the completed-trade count.

**Fee resolution:** `fn_get_buyer_fee_for_checkout(p_user_id, p_cash_portion_cents)`
returns the buyer's current `fee_state`, the exact `fee_cents`, and the `label`. It is
called by both the mobile order summary (preview) and the Edge Function (authoritative
charge), so preview and charge always agree. If a required config key is missing, the
function returns `fee_cents = NULL` and the Edge Function fails loud
(`CONFIG_UNAVAILABLE`) — it never silently charges $0.

#### 8.1.3 Fee Formulas

**Buyer fee — flat tiers (active member / first trade)**

```text
fee = buyer_fee_active_member_cents        (active member)
fee = buyer_fee_first_trade_cents          (free, first trade — first-trade protection)
buyer_pays_fee_in_cash = round_to_cents(fee)
```

**Buyer fee — percentage tier (free user, 1+ completed trades)**

```text
cash_portion = order_total − swap_points_used        # SP never reduces the fee base below cash owed
pct_component = round(cash_portion_cents × buyer_fee_subsequent_percentage / 100)
fee           = buyer_fee_subsequent_fixed_cents + pct_component
fee           = min(fee, buyer_fee_subsequent_max_cents)   # cap applies to the TOTAL
buyer_pays_fee_in_cash = round_to_cents(fee)
```

**Seller fee (unchanged)**

```text
seller_fee = seller_percent_fee × cash_portion        # cash_portion = item_price − SP
seller_cash_payout = cash_portion − seller_fee
```

- The seller fee is ALWAYS calculated on the CASH PORTION (item price minus Swap Points),
  never on the full item price and never on the buyer's platform fee.
- The SP portion is credited to the seller's SP wallet (no fee deducted from SP).

| User Type | Transaction Fee | Applied To | Notes |
|-----------|----------------|------------|-------|
| **Free User — first trade** | $1.49 (flat, default) | Buyer | First-trade protection; consumed only on capture + completion |
| **Free User — 1+ completed trades** | 5% of cash + $1.99, capped $4.99 (defaults) | Buyer | Percentage applies only to the cash portion |
| **Active Member (trial/paid)** | $1.49 (flat, default) | Buyer | Same flat fee for trial or paid |
| **Seller Fee** | 5% (free tier default) | Seller | Deducted from cash payout on the cash portion; admin-configurable per tier |

**Fee Calculation Examples (defaults):**

```text
Example 1: Active member buys $25 item (cash only)
├─ Item price: $25.00
├─ Buyer fee (flat active-member): $1.49
├─ Total buyer pays: $26.49
└─ Seller receives: $25.00 - (5% × $25.00) = $23.75

Example 2: Free user, first trade, buys $25 item (cash only)
├─ Item price: $25.00
├─ Buyer fee (flat first-trade): $1.49
├─ Total buyer pays: $26.49
└─ After completion, fee-state becomes 'first_trade_completed' (flat fee no longer applies)

Example 3: Free user, 1+ completed trades, buys $60 item (cash only)
├─ Item price: $60.00
├─ Buyer fee: min(199 + round(6000 × 5%), 499) = min(499, 499) = $4.99 (capped)
├─ Total buyer pays: $64.99
└─ Seller receives: $60.00 - (5% × $60.00) = $57.00

Example 4: Free user, 1+ completed trades, buys $60 item using $20 SP
├─ Item price: $60.00, SP used: $20.00 → cash portion: $40.00
├─ Buyer fee: min(199 + round(4000 × 5%), 499) = min(399, 499) = $3.99 (computed on the $40 cash portion, NOT the $60 price)
├─ Total buyer pays: $40.00 + $3.99 = $43.99 cash + $20 SP
└─ Seller receives (5%): $40.00 − $2.00 = $38.00 cash + $20 SP
```

#### 8.1.4 Admin Configuration (fees category)

Admin can configure the following `admin_config` keys (category `fees`), editable on
**Settings → Trade Timing → Tiered Buyer Fee**:

| Config key | Seed default | Meaning |
|---|---|---|
| `buyer_fee_active_member_cents` | 149 | Flat fee (cents) for active members (trial or paid) |
| `buyer_fee_first_trade_cents` | 149 | Flat fee (cents) for free users on their first trade |
| `buyer_fee_subsequent_percentage` | 5.0 | Percentage of the cash portion for free users with 1+ completed trades |
| `buyer_fee_subsequent_fixed_cents` | 199 | Fixed fee component (cents) for free users with 1+ completed trades |
| `buyer_fee_subsequent_max_cents` | 499 | Cap (cents) on the TOTAL fee (fixed + percentage) |
| `buyer_fee_label` | Safety & Platform Fee | Display label on checkout / order summary |

**Seller (per subscription tier — admin-configurable)**

```text
seller_percent_fee_free        (default: 5.0%) — seller fee % for FREE (non-subscriber) sellers
seller_percent_fee_subscriber  (seeded default: 0.0%) — seller fee % for Kids Club+ (subscriber) sellers
```

> Implementer note: seller keys map to `platform_fee_seller_percentage` (free) and
> `platform_fee_seller_discount_percentage_kids_club_plus` (subscriber). The "discount" in
> the key name is legacy — each value is an ABSOLUTE percentage for that tier. Both are
> editable from **Config → Trade Timing → Transaction Fees**.

**Legacy buyer-fee keys** (`transaction_fee_subscriber_cents`,
`transaction_fee_non_subscriber_cents`, `platform_fee_buyer_fixed_cents`,
`platform_fee_buyer_percentage`) are **DEPRECATED** — retained for backward compatibility
but no longer the source of truth for the buyer fee.

#### 8.1.5 Fee-Tier Statistics (Admin)

- **Settings → Trade Timing → Buyer Fee-Tier Distribution** shows how many users are in
  each fee state (flat vs percentage), backed by `fn_admin_get_fee_tier_stats`.
- **Analytics → Buyer Fee-Tier Distribution** shows the flat vs percentage user counts and
  share of users by tier.

### 8.2 Minimum Transaction Value

**BR-MIN-001: $30 Minimum Rule**
- Individual items must be priced ≥ $30
- Exception: Bundled listings (multiple items) can total $20+
- Rationale: Protects unit economics (fees + delivery costs)

**Enforcement:**
- Listing creation: Hard block if price < $30
- Error message: "Minimum item value is $30. Please increase the price or bundle with other items."
- Admin override: Can manually approve < $30 items for special cases

### 8.3 Bundle Listings

**BR-BUNDLE-001: Bundle Creation**
- Users can create bundles (multiple items in one listing)
- Minimum bundle value: $20
- Maximum 10 items per bundle
- Each item in bundle must be photographed
- Bundle discount encouraged (e.g., 3 onesies for $25 instead of $10 each = $30)

**BR-BUNDLE-002: Bundle Purchasing**
- Buyer must purchase entire bundle (no splitting)
- SP usage applies to total bundle price
- If bundle = $60, max SP = 30 (50% rule applies to total)

### 8.4 Geographic Restrictions

**BR-GEO-001: Node-Based Marketplace**
- Users can only see listings in their assigned node
- Node assignment based on ZIP code at signup
- Cannot change node without admin approval
- Cross-node transactions: Not allowed in MVP

**BR-GEO-002: Waitlist Management**
- If user's ZIP not in active node → Waitlist
- Waitlist users can browse but not transact
- Auto-notify when node launches
- Waitlist converts to active user (retains signup data)

### 8.5 Listing Expiration

**BR-EXP-001: Auto-Expiration**
- Active listings expire after 90 days
- 7 days before expiration: Email notification
- 1 day before expiration: Push notification
- After expiration: Status = "expired" (not deleted)
- Seller can relist with one tap (re-uses photos/description)

**BR-EXP-002: Sold Items**
- Once sold, listing status = "sold"
- Listing visible in seller's history
- Listing hidden from search/feed
- Seller can relist if transaction falls through

### 7.6 Moderation & Safety

**BR-MOD-001: AI Content Moderation**
- All listing photos scanned for:
  - Inappropriate content (reject)
  - Product recalls (warning + block if confirmed)
  - Brand recognition (auto-fill)
  - Condition assessment (suggestion)
- Human review queue for flagged items
- Admin can approve/reject within 24 hours

**BR-MOD-002: User Reports**
- Users can report listings/users for:
  - Inappropriate content
  - Scam/fraud
  - Item not as described
  - Safety concerns
- Report → auto-hide listing pending review
- 3+ reports in 30 days → account flagged
- Admin review required to restore

**BR-MOD-003: Account Suspension**
- Admin can suspend accounts for:
  - Repeated policy violations
  - Confirmed fraud
  - Safety concerns
  - Spam/abuse
- Suspended users:
  - Cannot list new items
  - Cannot purchase
  - Cannot message
  - Can appeal via support ticket

---

## 8A. N6 — Node Tagging (Cross-Cutting)

**Owner summary:** Guarantees every user, listing, trade, and cost/ledger record
resolves to **exactly one node** (pilot market) so per-node KPIs and expansion-gate
metrics can be computed (BRD §6.10; GTM plan §13 Success Metrics + §15.6 Expansion
Readiness). Backward compatible — additive-only, no existing flow changes behavior.

### 8A.1 Node identity — single source of truth

| Entity | Column | Type | Resolved from |
|---|---|---|---|
| User | `profiles.node_id` | UUID FK → `nodes(id)` | ZIP / nearest active node at signup (**canonical**) |
| Listing | `items.node_id` | UUID FK → `nodes(id)` | seller profile node at INSERT (snapshot) |
| Trade | `trades.node_id` | UUID FK → `nodes(id)` | seller profile node at INSERT (snapshot; fallback buyer) |
| Tax | `tax_records.node_id` | UUID FK → `nodes(id)` | seller node at offer creation |
| Payment | `payments.node_id` | UUID FK → `nodes(id)` | related trade's node (fallback seller profile) |
| Refund | `trade_refunds.node_id` | UUID FK → `nodes(id)` | related trade's node |
| SP wallet | `sp_wallets.node_id` | UUID FK → `nodes(id)` | user profile node |
| SP ledger | `sp_ledger.node_id` | UUID FK → `nodes(id)` | related trade's node (fallback user profile) |
| SP batch | `sp_batches.node_id` | UUID FK → `nodes(id)` | user profile node |
| Payout | `seller_payouts.node_id` | UUID FK → `nodes(id)` | related trade's node (fallback user profile) |
| Seller balance | `seller_balance.node_id` | UUID FK → `nodes(id)` | user profile node |
| Cart item | `cart_items.node_id` | UUID FK → `nodes(id)` | listing's node (fallback seller profile) |

### 8A.2 Requirements

| ID | Requirement |
|----|-------------|
| SR-N6-001 | Every user resolves to exactly one node — `profiles.node_id` (UUID FK → `nodes(id)`, ON DELETE SET NULL). |
| SR-N6-002 | `items.node_id` is set at INSERT from the seller's profile node via a fill-only-when-NULL BEFORE INSERT trigger (`set_item_node_id_from_seller`). Snapshot semantics — never re-derived on UPDATE. |
| SR-N6-003 | `trades.node_id` is set at INSERT from the seller's profile node (fallback buyer) via the existing `populate_trade_node_id` trigger (migration 089). |
| SR-N6-004 | Cost/ledger tables (`payments`, `trade_refunds`, `sp_wallets`, `sp_ledger`, `sp_batches`, `seller_payouts`, `seller_balance`, `cart_items`) carry `node_id` (UUID FK, nullable) set by fill-only-when-NULL BEFORE INSERT/UPDATE triggers derived from the related trade / listing / user. |
| SR-N6-005 | Node resolution on write is server-enforced: DB triggers for every write path, plus a shared Edge Function helper (`supabase/functions/_shared/node.ts`) used by `create-trade-offer` to resolve the seller node for the trade + tax + payment write path. |
| SR-N6-006 | Read-only RPC `admin_node_kpis(p_node_id UUID DEFAULT NULL)` returns per-node KPIs: users, listings, trades, completed trades, GMV (cents), platform fees (cents), paid payouts (cents), SP earned / SP spent. Service-role only (mirrors `admin_health_summary`). |
| SR-N6-007 | Backward compatible: new columns are nullable; backfills touch NULL rows only; FKs are added `NOT VALID` and `VALIDATE` only when no orphaned node exists; rows whose actor has no node stay NULL (documented residual). |
| SR-N6-008 | Indexes exist on every `node_id` column (`idx_<table>_node_id`) for per-node aggregation. |

### 8A.3 Migration

`supabase/migrations/20260809000005_n6_node_tagging.sql` — Mode B (idempotent rerunnable).

### 8A.4 Verification

- `SELECT public.admin_node_kpis(NULL);` — one row per node with all §13 KPI fields.
- Per-table NULL-node counts → `0` for every table (except the documented residual:
  legacy rows whose user/listing/trade has no node assigned).
- Triggers present: `trg_set_item_node_id`, `trg_set_payment_node_id`, `trg_set_trade_refund_node_id`,
  `trg_set_wallet_node_id`, `trg_set_sp_ledger_node_id`, `trg_set_sp_batch_node_id`,
  `trg_set_payout_node_id`, `trg_set_seller_balance_node_id`, `trg_set_cart_item_node_id`.

---

## 8B. N2 — Idempotency & Audit (Cross-Cutting)

**Owner summary:** Guarantees every payment / Swap Points (SP) / fee / tax state
transition is **retry-safe (idempotent)** and **fully audited**. A retried mutation
(offer submission, payout trigger, refund, SP release, SP adjustment) must never
double-charge, double-issue SP, or double-log. Cross-cuts R1 (auth/capture), R2
(payout release), R3 (SP issue), R4 (SP redeem), R5 (SP freeze/release), R6 (fee
charges). Backward compatible — additive-only; existing flows behave identically,
they just become safe to retry and leave an audit trail.

### 8B.1 Requirements

| ID | Requirement |
|----|-------------|
| SR-N2-001 | Every payment/SP/fee/tax state transition MUST write exactly one row to `financial_audit_log` (mutation_type, entity refs, actor, before/after state, amount_cents, idempotency_key UNIQUE, node_id per N6, created_at). Insert-only; RLS = service-role + admin read. |
| SR-N2-002 | Retried mutations MUST be idempotent: a retry carrying the same idempotency key returns the prior result and produces **no duplicate side effect and no duplicate audit row** (`ON CONFLICT (idempotency_key) DO NOTHING`). |
| SR-N2-003 | Stripe PaymentIntent creation on offer submission MUST use a deterministic idempotency key (`pi_offer_<buyer>_<item>_<contentHash>` single / `pi_bundle_<bundle>_<item>_<contentHash>` bundle); `trades.stripe_payment_intent_id` is UNIQUE (partial index). A concurrent double-tap dedupes on Stripe's side and the losing trade insert replays the winner (23505 → existing trade). |
| SR-N2-004 | SP debit/credit/release mutations MUST set `sp_ledger.idempotency_key` and short-circuit on an existing entry: `debit_sp_for_trade` → `sp_debit_<trade_id>`, `credit_sp_for_cancelled_trade` → `sp_refund_<trade_id>`. Re-running an SP release processor (`rpc_release_pending_sp`) cannot double-credit. |
| SR-N2-005 | Payouts MUST remain idempotent via `seller_payouts.idempotency_key` (UNIQUE) + `trades.payout_idempotency_key`; the canonical key format is **`trade:<tradeId>:seller:<sellerId>`** (reconciles the earlier `payout_<trade_id>` wording in TRADING-FLOW-V2 §6.3.4). `initiate-payout` audits `payout_initiated / payout_paid / payout_requires_action / payout_failed`. |
| SR-N2-006 | Refunds MUST be idempotent via `trades.stripe_refund_id` guard + UNIQUE `trade_refunds.stripe_refund_id` (partial index) — closes the webhook-vs-EF TOCTOU race. `rpc_record_stripe_refund` / `rpc_sync_payment_refund_webhook` remain the single refund-recording path. |
| SR-N2-007 | Admin SP adjustments MUST use a deterministic idempotency key. `admin_adjust_sp_wallet` accepts an optional `p_idempotency_key`; when omitted it derives `admin_adj_<wallet>_<amount>_<actor>_<minute>` so a same-second double-click cannot double-credit. |
| SR-N2-008 | Error contract: on a duplicate key, the mutation returns the prior result (or a specific `DUPLICATE_MUTATION`-style code) — it must never leave a partial write. Audit writes are best-effort (never break the primary operation). |

### 8B.2 Mutation → audit mapping (what gets logged)

| Domain | Transitions audited (mutation_type) |
|---|---|
| R1 auth/capture | `offer_created`, `payment_intent_created`, `payment_captured`, `payment_capture_failed`, `payment_cancelled`, `buyer_fee_charged`, `tax_quoted`, `tax_collected`, `tax_voided` |
| R2 payout | `payout_initiated`, `payout_paid`, `payout_requires_action`, `payout_failed`, `seller_fee_deducted` |
| R3/R4/R5 SP | `sp_reserved`, `sp_restored`, `sp_released`, `sp_issued`, `sp_deducted`, `sp_frozen`, `sp_unfrozen`, `sp_expired` |
| R6 fees/refunds | `refund_issued`, `refund_voided`, `tax_refunded`, `trade_completed`, `trade_cancelled` |

### 8B.3 Migration

`supabase/migrations/20260810000006_n2_idempotency_audit.sql` — Mode B (idempotent rerunnable):
- `financial_audit_log` table + `fn_log_financial_audit()` (idempotent writer) + `trg_fill_financial_audit_node_id`.
- UNIQUE partial indexes: `idx_trades_stripe_payment_intent_id`, `idx_trade_refunds_stripe_refund_id`.
- `debit_sp_for_trade` / `credit_sp_for_cancelled_trade` / `admin_adjust_sp_wallet` made idempotent.

### 8B.4 Verification

- No double-log: `SELECT fn_log_financial_audit(...,'<key>');` twice → first `true`, second `false`, exactly 1 row for `<key>`.
- No double-debit/credit: pre-insert a ledger row with `sp_debit_<trade>` / `sp_refund_<trade>`; calling the RPC returns `idempotent: true` and the wallet balance is unchanged.
- Unique indexes present: `idx_trades_stripe_payment_intent_id`, `idx_trade_refunds_stripe_refund_id`.
- Manual retry cases: `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` Group N2 (TC-N2-C01…C10), `misc./MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` Group N2 (TC-N2-A01…A08).
- Admin UI: the **Financial Audit** screen (`/audit`, sidebar → Monetization) surfaces the journal via `admin_financial_audit_view` (text-cast, BP-45) with search/filters, category summary, before/after state, and trade links. Migration `20260810000007_admin_financial_audit_view.sql`.

---

## 8. Data Models

### 8.1 Users Table

```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  phone_verified BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Subscription fields
  subscription_type VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free' | 'premium'
  subscription_status VARCHAR(20) DEFAULT NULL, -- 'trial' | 'active' | 'cancelled' | 'grace_period' | 'expired'
  trial_start_date TIMESTAMP DEFAULT NULL,
  trial_end_date TIMESTAMP DEFAULT NULL,
  subscription_start_date TIMESTAMP DEFAULT NULL,
  subscription_end_date TIMESTAMP DEFAULT NULL,
  stripe_customer_id VARCHAR(255) DEFAULT NULL,
  stripe_subscription_id VARCHAR(255) DEFAULT NULL,
  grace_period_end_date TIMESTAMP DEFAULT NULL,
  
  -- Geographic
  zip_code VARCHAR(10) NOT NULL,
  node_id VARCHAR(50) NOT NULL,
  
  -- Profile
  profile_photo_url VARCHAR(500) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  rating DECIMAL(3,2) DEFAULT NULL, -- e.g., 4.85
  total_sales INTEGER DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  
  -- Badges
  donation_count INTEGER DEFAULT 0,
  donation_badge VARCHAR(20) DEFAULT NULL, -- 'helper' | 'generous' | 'champion' | 'super_parent'
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'suspended' | 'banned' | 'deleted'
  suspension_reason TEXT DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP DEFAULT NULL,
  deleted_at TIMESTAMP DEFAULT NULL,
  
  -- Indexes
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  INDEX idx_node_id (node_id),
  INDEX idx_subscription_status (subscription_status),
  INDEX idx_stripe_customer_id (stripe_customer_id)
);
```

### 8.2 Swap Points Wallet Table

```sql
CREATE TABLE sp_wallets (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- SP Balances
  available_sp INTEGER DEFAULT 0 NOT NULL,
  pending_sp INTEGER DEFAULT 0 NOT NULL,
  
  -- Lifetime Stats
  lifetime_earned INTEGER DEFAULT 0 NOT NULL,
  lifetime_received INTEGER DEFAULT 0 NOT NULL,
  lifetime_spent INTEGER DEFAULT 0 NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT positive_available CHECK (available_sp >= 0),
  CONSTRAINT positive_pending CHECK (pending_sp >= 0),
  UNIQUE (user_id)
);
```

### 8.3 SP Transactions Table

```sql
CREATE TABLE sp_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Transaction Details
  type VARCHAR(20) NOT NULL, -- 'earned' | 'received' | 'spent' | 'released' | 'cancelled' | 'admin_adjustment' | 'starter_pack'
  amount INTEGER NOT NULL, -- Can be negative for 'spent'
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'pending' | 'completed' | 'cancelled'
  
  -- Context
  description VARCHAR(255) NOT NULL,
  related_listing_id UUID DEFAULT NULL REFERENCES listings(listing_id),
  related_transaction_id UUID DEFAULT NULL REFERENCES transactions(transaction_id),
  
  -- Pending Release (for 'earned' type)
  pending_until TIMESTAMP DEFAULT NULL,
  released_at TIMESTAMP DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_pending_until (pending_until),
  INDEX idx_related_listing (related_listing_id)
);
```

### 8.4 Listings Table

```sql
CREATE TABLE listings (
  listing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Item Details
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  category VARCHAR(50) NOT NULL, -- 'clothes' | 'toys' | 'books' | 'gear' | 'shoes' | 'outdoor' | 'baby_gear' | 'sports'
  subcategory VARCHAR(50) DEFAULT NULL,
  size VARCHAR(20) DEFAULT NULL,
  brand VARCHAR(100) DEFAULT NULL,
  condition VARCHAR(20) NOT NULL, -- 'new' | 'like_new' | 'good' | 'fair' | 'just_ok'
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  payment_preference VARCHAR(20) NOT NULL DEFAULT 'cash_only', -- 'cash_only' | 'accept_sp' | 'donate'
  estimated_sp INTEGER DEFAULT NULL, -- Only if accept_sp or donate
  
  -- Photos
  photos JSON NOT NULL, -- Array of photo URLs
  main_photo_url VARCHAR(500) NOT NULL,
  
  -- AI Metadata
  ai_suggestions JSON DEFAULT NULL,
  ai_confidence DECIMAL(3,2) DEFAULT NULL,
  ai_flags JSON DEFAULT NULL, -- Recalls, safety issues, etc.
  
  -- Geographic
  node_id VARCHAR(50) NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'sold' | 'expired' | 'deleted' | 'flagged'
  sold_to_user_id UUID DEFAULT NULL REFERENCES users(user_id),
  sold_at TIMESTAMP DEFAULT NULL,
  
  -- Engagement
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL, -- created_at + 90 days
  deleted_at TIMESTAMP DEFAULT NULL,
  
  -- Indexes
  INDEX idx_seller_id (seller_id),
  INDEX idx_node_id (node_id),
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_payment_preference (payment_preference),
  INDEX idx_price (price),
  INDEX idx_created_at (created_at)
);
```

### 8.5 Transactions Table

```sql
CREATE TABLE transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parties
  buyer_id UUID NOT NULL REFERENCES users(user_id),
  seller_id UUID NOT NULL REFERENCES users(user_id),
  listing_id UUID NOT NULL REFERENCES listings(listing_id),
  
  -- Payment Details
  item_price DECIMAL(10,2) NOT NULL,
  sp_used INTEGER DEFAULT 0,
  sp_discount DECIMAL(10,2) DEFAULT 0.00,
  cash_paid DECIMAL(10,2) NOT NULL,
  buyer_fee DECIMAL(10,2) NOT NULL, -- $0.99 or $2.99
  seller_fee DECIMAL(10,2) NOT NULL, -- 5% of item_price
  
  -- Delivery
  delivery_method VARCHAR(20) NOT NULL, -- 'pickup' | 'delivery'
  delivery_fee DECIMAL(10,2) DEFAULT 0.00,
  delivery_address TEXT DEFAULT NULL,
  delivery_status VARCHAR(20) DEFAULT NULL, -- 'pending' | 'in_transit' | 'delivered' | 'cancelled'
  
  -- Payment Processing
  stripe_payment_intent_id VARCHAR(255) DEFAULT NULL,
  stripe_charge_id VARCHAR(255) DEFAULT NULL,
  payment_status VARCHAR(20) NOT NULL, -- 'pending' | 'completed' | 'failed' | 'refunded'
  
  -- SP Processing (Seller's earnings)
  sp_earned INTEGER DEFAULT 0, -- Platform-calculated SP for seller
  sp_earned_status VARCHAR(20) DEFAULT NULL, -- 'pending' | 'released' | 'cancelled'
  sp_earned_release_date TIMESTAMP DEFAULT NULL,
  sp_earned_released_at TIMESTAMP DEFAULT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'disputed' | 'refunded' | 'cancelled'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP DEFAULT NULL,
  
  -- Indexes
  INDEX idx_buyer_id (buyer_id),
  INDEX idx_seller_id (seller_id),
  INDEX idx_listing_id (listing_id),
  INDEX idx_status (status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_created_at (created_at)
);
```

### 8.6 Badge Definitions Table (Admin)

```sql
CREATE TABLE badge_configs (
  badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'community-champion'
  title VARCHAR(100) NOT NULL,
  description TEXT,
  icon_path VARCHAR(255), -- Path in 'badge-icons' bucket
  
  -- Logic Configuration (JSONB)
  -- Example: {"type": "donations", "threshold": 10}
  -- Example: {"type": "sales_count", "threshold": 50}
  earning_logic JSONB NOT NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badge_configs(badge_id) ON DELETE CASCADE,
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, badge_id)
);
```

### 8.7 SP Configuration Table (Admin)

```sql
CREATE TABLE sp_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id VARCHAR(50) NOT NULL,
  
  -- Formula Type
  formula_type VARCHAR(20) NOT NULL, -- 'price_bands' | 'percentage' | 'hybrid'
  
  -- Price Bands (if formula_type = 'price_bands')
  price_bands JSON DEFAULT NULL,
  /* Example:
  [
    {"min": 1, "max": 10, "sp": 5},
    {"min": 11, "max": 25, "sp": 10},
    {"min": 26, "max": 50, "sp": 20},
    {"min": 51, "max": 100, "sp": 35},
    {"min": 101, "max": 200, "sp": 60},
    {"min": 201, "max": null, "sp": 100}
  ]
  */
  
  -- Percentage (if formula_type = 'percentage' or 'hybrid')
  base_percentage DECIMAL(5,2) DEFAULT NULL, -- e.g., 25.00 for 25%
  min_sp_per_transaction INTEGER DEFAULT 10,
  max_sp_per_transaction INTEGER DEFAULT 200,
  
  -- Category Multipliers (applies to all formula types)
  category_multipliers JSON DEFAULT NULL,
  /* Example:
  {
    "baby_gear": 1.5,
    "seasonal_winter": 1.25,
    "seasonal_summer": 1.25,
    "toys": 1.0,
    "clothes": 1.0,
    "books": 1.0
  }
  */
  
  -- Redemption Settings
  max_sp_percentage_per_transaction INTEGER DEFAULT 50, -- Max 100% of item price
  platform_fee_subscribers DECIMAL(10,2) DEFAULT 0.99,
  platform_fee_free_users DECIMAL(10,2) DEFAULT 2.99,
  
  -- SP Lifecycle
  pending_period_days INTEGER DEFAULT 3,
  grace_period_days INTEGER DEFAULT 90,
  sp_never_expire BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by_admin_id UUID REFERENCES users(user_id),
  
  -- Constraints
  UNIQUE (node_id)
);
```

---

## 9. API Specifications

### 9.1 Authentication APIs

#### POST /api/auth/signup
```typescript
Request:
{
  "first_name": "Sarah",
  "last_name": "Johnson",
  "email": "sarah@example.com",
  "phone": "+15555551234",
  "password": "SecurePassword123!",
  "zip_code": "06850",
  "subscription_choice": "premium" | "free" // NEW
}

Response (200 OK):
{
  "user_id": "uuid",
  "access_token": "jwt_token",
  "refresh_token": "jwt_token",
  "phone_verification_required": true,
  "subscription_type": "premium",
  "subscription_status": "trial", // If premium
  "trial_end_date": "2026-01-04T12:00:00Z",
  "node_id": "norwalk_ct",
  "node_status": "active" | "waitlist"
}
```

#### POST /api/auth/verify-phone
```typescript
Request:
{
  "user_id": "uuid",
  "code": "123456"
}

Response (200 OK):
{
  "verified": true,
  "access_token": "updated_jwt_token"
}
```

### 9.2 Swap Points & Gamification APIs

#### GET /api/sp/wallet
```typescript
Request Headers:
Authorization: Bearer {jwt_token}

Response (200 OK) - Subscriber:
{
  "available_sp": 125,
  "pending_sp": 38,
  "lifetime_earned": 253,
  "lifetime_received": 180,
  "lifetime_spent": 105,
  "pending_transactions": [
    {
      "transaction_id": "uuid",
      "amount": 38,
      "description": "Baby Stroller sale",
      "pending_until": "2025-12-08T12:00:00Z",
      "days_remaining": 3
    }
  ],
  "monthly_stats": {
    "earned": 53,
    "received": 80,
    "spent": 25,
    "net": 108
  }
}

Response (200 OK) - Free User:
{
  "available_sp": 0,
  "pending_sp": 0,
  "message": "Swap Points are only available to Kids Club+ subscribers",
  "upgrade_url": "/subscription/upgrade"
}
```

#### GET /api/badges/list
```typescript
Request Headers:
Authorization: Bearer {jwt_token}

Response (200 OK):
[
  {
    "badge_id": "uuid",
    "title": "Community Champion",
    "icon_url": "https://...",
    "awarded_at": "2025-12-05T12:00:00Z"
  }
]
```

#### POST /api/admin/badges/upsert
```typescript
Request (Admin Only):
{
  "badge_id": "uuid", // Optional for new
  "slug": "generous",
  "title": "Generous Donor",
  "earning_logic": {"type": "donations", "threshold": 5},
  "icon_path": "icons/generous.svg"
}

Response:
{ "success": true, "badge_id": "uuid" }
```

#### POST /api/sp/calculate
```typescript
Request:
{
  "price": 100.00,
  "category": "baby_gear",
  "node_id": "norwalk_ct"
}

Response (200 OK):
{
  "estimated_sp": 38,
  "formula_used": "percentage",
  "base_sp": 25, // 25% of $100
  "category_multiplier": 1.5,
  "final_sp": 38, // Rounded
  "explanation": "25% of $100 (25 SP) × 1.5 Baby Gear multiplier = 38 SP"
}
```

### 9.3 Listing APIs

#### POST /api/listings/create
```typescript
Request:
{
  "title": "Winter Coat - Excellent Condition",
  "description": "Barely worn...",
  "category": "clothes",
  "size": "4T",
  "brand": "Carter's",
  "condition": "like_new",
  "price": 25.00,
  "payment_preference": "accept_sp" | "cash_only" | "donate", // NEW
  "photos": [
    "base64_encoded_photo_1",
    "base64_encoded_photo_2"
  ],
  "node_id": "norwalk_ct"
}

Response (200 OK):
{
  "listing_id": "uuid",
  "estimated_sp": 15, // If accept_sp
  "donation_badge_progress": "3/10", // If donate
  "status": "active",
  "expires_at": "2026-03-05T12:00:00Z",
  "ai_suggestions": {
    "title_confidence": 0.85,
    "category_confidence": 0.92,
    "brand_detected": true
  }
}

Response (403 Forbidden) - Free user tries accept_sp or donate:
{
  "error": "payment_preference_restricted",
  "message": "Accept SP and Donate options are only available to Kids Club+ subscribers",
  "upgrade_url": "/subscription/upgrade"
}
```

### 9.4 Transaction APIs

#### POST /api/transactions/create
```typescript
Request:
{
  "listing_id": "uuid",
  "sp_used": 12, // NEW - 0 for cash-only
  "delivery_method": "pickup" | "delivery",
  "delivery_address": "..." // If delivery
}

Response (200 OK):
{
  "transaction_id": "uuid",
  "stripe_payment_intent_id": "pi_...",
  "client_secret": "pi_..._secret_...",
  "amount_due": 13.99, // Cash portion + fee
  "sp_used": 12,
  "total_saved": 12.00,
  "seller": {
    "name": "Sarah M.",
    "rating": 4.9
  },
  "next_steps": [
    "Complete payment with Stripe",
    "Arrange pickup with seller",
    "Confirm receipt to release funds"
  ]
}

Response (400 Bad Request) - Free user tries to use SP:
{
  "error": "sp_usage_not_allowed",
  "message": "Swap Points can only be used by Kids Club+ subscribers"
}

Response (400 Bad Request) - Insufficient SP:
{
  "error": "insufficient_sp",
  "message": "You have 5 SP but tried to use 12 SP",
  "available_sp": 5
}
```

### 9.5 Subscription APIs

#### POST /api/subscription/upgrade
```typescript
Request:
{
  "user_id": "uuid",
  "payment_method_id": "pm_..." // Stripe payment method ID
}

Response (200 OK):
{
  "subscription_id": "sub_...",
  "status": "active",
  "current_period_end": "2026-01-05T12:00:00Z",
  "sp_wallet_unlocked": true,
  "benefits": [
    "Earn Swap Points on sales",
    "Use SP for discounts (up to 50%)",
    "$0.99 transaction fee (save $2 per transaction)",
    "Priority matching",
    "Early access to new listings"
  ]
}
```

#### POST /api/subscription/cancel
```typescript
Request:
{
  "user_id": "uuid",
  "reason": "optional_cancellation_reason"
}

Response (200 OK):
{
  "subscription_id": "sub_...",
  "status": "cancelled",
  "cancel_at_period_end": true,
  "current_period_end": "2026-01-05T12:00:00Z",
  "grace_period_end": "2026-04-05T12:00:00Z", // +90 days
  "sp_wallet_frozen": true,
  "sp_balance_at_cancellation": {
    "available": 125,
    "pending": 38
  },
  "message": "You have 90 days to resubscribe and keep your 163 SP"
}
```

---

## 10. Trust & Safety Implementation

### 10.1 Phone Verification

**Process:**
1. User enters phone number during signup
2. System sends 6-digit SMS code via Twilio
3. User enters code within 10 minutes
4. System validates code
5. If valid → phone_verified = true

**R8 note (2026-08-09):** Phone verification satisfies the "phone/email verification" requirement; a separate in-app email-verification flow is not required. Phone verification gates listing publication (AUTH-V3-008).

**Security Measures:**
- Rate limiting: 3 code requests per hour per phone number
- Code expiry: 10 minutes
- Max attempts: 5 wrong codes → lock account for 1 hour
- One phone per account (prevent multi-accounting)

### 10.2 AI Content Moderation

**Image Analysis (per photo uploaded):**
1. **Inappropriate Content Detection**
   - Nudity/sexual content → Auto-reject
   - Violence/gore → Auto-reject
   - Weapons/drugs → Auto-reject
   - Confidence threshold: 80%

2. **Product Recall Check**
   - Image recognition matches against CPSC recall database
   - If match detected → Show warning to seller
   - Seller must acknowledge or listing blocked

3. **Brand/Category Recognition**
   - Auto-fill brand name if detected (80%+ confidence)
   - Auto-suggest category (70%+ confidence)

4. **Condition Assessment**
   - Analyze wear, tears, stains
   - Suggest condition level (advisory only)

**Approval gate (R8, 2026-08-09):** No listing may be approved until every uploaded image has an `approved` Google Vision decision. A flagged image (LIKELY/VERY_LIKELY) moves the listing to `flagged` and blocks approval (`MODERATION_BLOCKED_FLAGGED`); unreviewed images block approval (`MODERATION_IN_PROGRESS`). Admins may disable the gate via the `moderation_ai_enabled` admin config.

**Text Analysis (title + description):**
- Profanity filter
- Contact info detection (phone, email) → Auto-remove
- External links → Auto-remove
- Spam keywords → Flag for review

### 10.3 Moderation Queue

**Auto-Flagged Items:**
- AI confidence < 50% on any check
- User reports (1+ reports → queue)
- New seller's first 3 listings
- High-value items (> $200)

**Admin Actions:**
- Approve (publish listing)
- Reject (notify seller with reason)
- Request edit (seller must update)
- Ban user (serious violations)

**SLA:**
- Moderation queue reviewed within 24 hours
- High-priority flags (safety) reviewed within 2 hours

### 10.4 User Reputation System

**Rating Formula:**
```
Overall Rating = (
  (Seller Ratings × 0.5) + 
  (Buyer Ratings × 0.3) + 
  (Response Time Score × 0.1) + 
  (Completion Rate × 0.1)
)

Seller Rating: Average of buyer ratings (1-5 stars) after completed sales
Buyer Rating: Average of seller ratings (1-5 stars) after completed purchases
Response Time Score: 
  - < 1 hour = 5.0
  - 1-6 hours = 4.5
  - 6-24 hours = 4.0
  - 24-48 hours = 3.5
  - > 48 hours = 3.0
Completion Rate: % of initiated transactions completed (not cancelled)
```

**Badges:**
- ⭐ "New Member" (< 5 transactions)
- ⭐⭐ "Trusted Seller" (10+ sales, 4.5+ rating)
- ⭐⭐⭐ "Top Seller" (50+ sales, 4.7+ rating)
- ⭐⭐⭐⭐ "Power Seller" (100+ sales, 4.8+ rating)
- 💫 "Community Champion" (10+ donations)
- 🏆 "Super Parent" (25+ donations)
- ✅ "Verified Parent" (phone verified)

---

## 11. Admin Control Panel Specifications

### 11.1 SP Configuration Interface

**Main Configuration Screen:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚙️ SWAP POINTS CONFIGURATION                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ NODE: [▼ Seattle Metro        ]  [Apply to All Nodes]  │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ CALCULATION METHOD                                      │
│                                                         │
│ ○ Price Bands + Multipliers (Complex, strategic)       │
│ ● Percentage-Based (Simple, predictable)               │
│ ○ Hybrid (Percentage + minimum + multipliers)          │
│                                                         │
│ [Configure Selected Method →]                           │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ CURRENT SETTINGS PREVIEW                                │
│                                                         │
│ Method: Percentage-Based                                │
│ Base Rate: 25%                                          │
│ Minimum SP: 10 SP                                       │
��                                                         │
│ Examples:                                               │
│ • $20 toy (Toys 1.0x) = 10 SP (minimum applied)         │
│ • $50 jacket (Clothes 1.0x) = 13 SP                     │
│ • $100 stroller (Baby Gear 1.5x) = 38 SP                │
│ • $200 car seat (Baby Gear 1.5x) = 75 SP                │
│                                                         │
│ [Test Calculator]                                       │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ CATEGORY MULTIPLIERS                                    │
│                                                         │
│ Baby Gear:        [1.5x__]  ✓ Active                    │
│ Seasonal (Winter):[1.25x_]  ✓ Active (ends Mar 1)       │
│ Seasonal (Summer):[1.25x_]  ☐ Active (starts Jun 1)     │
│ Toys:             [1.0x__]  ✓ Active                    │
│ Clothes:          [1.0x__]  ✓ Active                    │
│ Books:            [1.0x__]  ✓ Active                    │
│                                                         │
│ [Add New Category]                                      │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ REDEMPTION SETTINGS                                     │
│                                                         │
│ Maximum SP per Transaction: [50_%_] of item price       │
│ Minimum Cash Required:      [50_%_] of item price       │
│ Platform Fee (Subscribers): [$0.99__]                   │
│ Platform Fee (Free Users):  [$2.99__]                   │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ SP LIFECYCLE                                            │
│                                                         │
│ Pending Period:             [3__] days                  │
│ SP Expiration (subscribed): ☑ Never expire              │
│ Grace Period (cancelled):   [90_] days                  │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ [Preview Changes]  [Save Configuration]  [Cancel]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 11.2 SP Analytics Dashboard

**Metrics to Track:**

```
┌─────────────────────────────────────────────────────────┐
│ 📊 SP ANALYTICS - DECEMBER 2025                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ NODE: [▼ Seattle Metro        ]  [Export Data]          │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ TRANSACTION MIX                                         │
│                                                         │
│ Cash Only:      342 (57%)  ████████████                 │
│ SP + Cash:      198 (33%)  ███████                      │
│ 100% SP:         60 (10%)  ██                           │
│ ─────────────────────────                               │
│ Total:          600 transactions                        │
│                                                         │
│ ⚠️ Alert: SP-only transactions under 80% threshold      │
│     (Good - marketplace has healthy cash flow)          │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ SP CIRCULATION                                          │
│                                                         │
│ SP Issued:      15,420 SP                               │
│ SP Spent:        8,935 SP (58%)                         │
│ SP Pending:      2,180 SP (14%)                         │
│ SP Available:    4,305 SP (28%)                         │
│                                                         │
│ ✓ Healthy: 58% spent within 90 days                    │
│                                                         │
│ Avg SP Balance per User: 142 SP                         │
│ Trend: +8% from last month ↗                            │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ SUBSCRIPTION METRICS                                    │
│                                                         │
│ Active Subscribers: 487                                 │
│ Free Users:         1,243                               │
│ Conversion Rate:    28% (free → paid)                   │
│ Retention (3mo):    64%                                 │
│                                                         │
│ ✓ All metrics within target range                      │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ SELLER BEHAVIOR                                         │
│                                                         │
│ Listings accepting SP:  62%                             │
│ Listings cash only:     35%                             │
│ Donations:               3%                             │
│                                                         │
│ Avg time to sell:                                       │
│ • With SP:    4.2 days                                  │
│ • Cash only:  7.8 days                                  │
│                                                         │
│ 💡 Items accepting SP sell 46% faster                   │
│                                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│ RED FLAGS & ALERTS                                      │
│                                                         │
│ ⚠️ User #4821: SP balance growing 40%/mo (hoarding?)    │
│ ⚠️ User #2156: Sell → Buy → Return pattern (fraud?)     │
│ ✓ No SP-only transaction issues                        │
│ ✓ No cash liquidity concerns                           │
│                                                         │
│ [View Detailed Report]  [Download CSV]                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Metrics:**
- **Free → Paid Conversion**: 20-30% target
- **Subscription Retention (3mo)**: 60%+ target
- **SP Transaction Mix**: 40-60% ideal (not too high, not too low)
- **SP Circulation Rate**: 50%+ spent in 90 days
- **Seller SP Acceptance %**: 40-60% target
- **Cash vs. SP Listings**: Monitor for market health

**Alerts:**
- >80% SP-only transactions → Require minimum cash %
- <40% SP circulation → Increase expiration pressure
- User SP balance growing >20%/mo → Flag for hoarding
- Patterns of sell → buy → return → Flag for fraud

---

## 12. Analytics & Metrics

### 12.1 Critical Success Metrics

**For Node Test (First 30 Days):**

| Metric | Target | Red Flag | Action if Red Flag |
|--------|--------|----------|-------------------|
| **Free → Paid Conversion** | 25-35% | <20% | Improve value prop messaging |
| **Subscription Retention (30d)** | 70%+ | <60% | Enhance SP value or reduce churn |
| **Subscription Retention (90d)** | 60%+ | <50% | Major SP/product improvements needed |
| **SP Transaction Mix** | 40-60% | <30% or >80% | Adjust SP earning/spending rules |
| **SP Circulation Rate (90d)** | 50%+ | <40% | Users hoarding; increase pressure |
| **Seller SP Acceptance %** | 50-60% | <40% | Educate sellers or increase incentives |
| **Avg SP Balance Growth** | Steady | +20%/mo | Hoarding problem; need SP sinks |
| **Support Tickets (SP confusion)** | <5% | >10% | UX improvements or better education |

### 12.2 Secondary Metrics

- **Average Transaction Value**: $34.50 target
- **Time to Sell (SP vs Cash)**: Track difference
- **Cash-Out Requests**: Should be minimal
- **Fraud Reports**: Monitor patterns
- **User NPS Score**: 4.0+ target

---

## 13. Integration Requirements

### 13.1 Stripe Integration

**Purpose:** Payment processing, subscription management

**Required Stripe Products:**
- **Payment Intents**: For one-time transaction fees
- **Subscriptions**: For Kids Club+ recurring billing
- **Payment Methods**: Store customer cards
- **Webhooks**: subscription.updated, payment_intent.succeeded, etc.

**Webhook Events to Handle:**
```
subscription.created → Update user subscription_status to 'active'
subscription.updated → Update billing date, status
subscription.deleted → Update user to 'cancelled', start grace period
payment_intent.succeeded → Mark transaction as 'completed'
payment_intent.failed → Retry payment or notify user
customer.subscription.trial_will_end → Send reminder email (Day 23 of trial)
```

### 13.2 Twilio Integration

**Purpose:** SMS verification codes

**Required Twilio Services:**
- **Programmable SMS**: Send verification codes
- **Verify API** (optional): Twilio's built-in verification service

**Cost Estimate:**
- $0.0079 per SMS
- 500 users/month = ~$4/month
- 5,000 users/month = ~$40/month

---

## 14. Security & Privacy

### 14.1 Data Privacy

**PII Protection:**
- Phone numbers encrypted at rest
- Email addresses encrypted at rest
- Passwords hashed with bcrypt (cost factor 12)
- No full names visible to other users (first name + last initial only)

**Data Retention:**
- Active users: Indefinite
- Deleted accounts: 30-day soft delete → permanent purge
- Transaction history: 7 years (legal requirement)
- SP transactions: Retained with user account

**18+ Registration Gate (N4, 2026-08-09):** No user under 18 may create an account. Enforced client-side (DOB gate before any personal data is collected) and server-side (a BEFORE INSERT trigger on `auth.users` raises `AGE_MINIMUM_REQUIRED`, aborting the insert so no account data is persisted). Minimum age is admin-configurable via `min_registration_age` (default 18). This reverses the 2026-06-20 COPPA deprecation.

### 14.2 Payment Security

**PCI Compliance:**
- Never store credit card numbers
- Use Stripe for all payment processing
- Stripe handles PCI compliance
- Tokenize payment methods

**Fraud Prevention:**
- 3-day pending period for earned SP
- Monitor sell → buy → return patterns
- Flag users with >3 returns in 30 days
- Manual review for high-value transactions (>$200)

---

## 15. Performance Requirements

### 15.1 Response Time Targets

| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| API Response (GET) | <200ms | <500ms |
| API Response (POST) | <500ms | <1s |
| Page Load (First Contentful Paint) | <1s | <2s |
| Image Load | <500ms | <1s |
| Real-time Message Delivery | <300ms | <500ms |
| SP Calculation | <100ms | <200ms |

### 15.2 Scalability Targets

**Phase 1 (MVP): 500 users**
- Database: Supabase Free Tier (500MB)
- API: Vercel Serverless Functions
- Image Storage: Cloudflare R2 (10GB)

**Phase 2 (Growth): 5,000 users**
- Database: Supabase Pro ($25/month)
- API: Same (serverless scales automatically)
- Image Storage: Cloudflare R2 (100GB, ~$1.50/month)

**Phase 3 (Scale): 50,000 users**
- Database: Supabase Enterprise (custom pricing)
- API: Consider dedicated server or Kubernetes
- CDN: Cloudflare Pro ($20/month)

---

## 16. Testing Requirements

### 16.1 Unit Tests

**Coverage Target:** 80%+

**Critical Paths to Test:**
- SP calculation logic (all formula types)
- SP pending/release logic
- Subscription state transitions
- Payment processing
- Free vs. subscriber permission checks

### 16.2 Integration Tests

**Stripe Integration:**
- Subscription creation
- Payment intent processing
- Webhook handling
- Failed payment retry

**Twilio Integration:**
- SMS code delivery
- Code validation
- Rate limiting

### 16.3 E2E Tests

**Critical User Flows:**
1. Signup → Choose subscription → Verify phone → Create listing
2. Browse → View item → Purchase with SP → Complete transaction
3. Seller receives SP → Wait 3 days → SP release → Spend SP
4. Subscribe → Cancel → Grace period → Resubscribe → SP restored
5. Free user → Try to use SP → Upgrade prompt → Convert → Use SP

### 16.4 Load Testing

**Scenarios:**
- 100 concurrent users browsing
- 50 concurrent transactions
- 1,000 SP calculations/minute
- SP release cron job (daily at midnight)

**Tools:**
- Artillery.io or k6 for load testing
- Monitor response times, error rates

---

## END OF DOCUMENT

**Total Pages**: 68  
**Version**: 2.0  
**Status**: Final - Ready for Development  
**Next Steps**: 
1. Review with engineering team
2. Estimate development timeline
3. Begin Phase 1 implementation
4. Set up monitoring & analytics

---

**Change Log:**
- v2.0 (Dec 5, 2025): Complete rewrite for subscription-gated SP model
  - Added subscription system specifications
  - Rewrote SP earning/spending mechanics
  - Added 3-day pending period
  - Added seller payment preferences (Cash Only, Accept SP, Donate)
  - Added free vs. subscriber feature matrix
  - Updated all data models, APIs, and business rules
- v1.0 (Nov 24, 2025): Initial version with peer-to-peer SP model
