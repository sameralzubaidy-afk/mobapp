# Business Requirements Document (BRD) V2

## P2P Kids Marketplace

**Document Version:** 2.0  
**Date:** December 5, 2025  
**Status:** Final  
**Author:** Product Team  
**Last Updated:** December 5, 2025

---

## 🎯 MAJOR UPDATE: Subscription-Gated Swap Points Model

This version reflects the **FINAL DECISION** to implement Swap Points as an **exclusive Kids Club+ benefit**, creating a stronger subscription value proposition and legal framework.

**Key Changes from V1:**

- Swap Points available ONLY to Kids Club+ subscribers ($7.99/month)
- Free tier introduced (cash-only marketplace access)
- Sellers choose payment preferences: Cash Only, Accept SP, or Donate
- 3-day pending period for earned SP (fraud/return protection)
- Platform auto-calculates SP amounts (sellers don't choose)
- Donation system with badge progression

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Objectives](#2-business-objectives)
3. [Stakeholders](#3-stakeholders)
4. [Product Overview](#4-product-overview)
5. [Market Analysis](#5-market-analysis)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [User Stories](#8-user-stories)
9. [Revenue Model](#9-revenue-model)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Technical Architecture](#11-technical-architecture)
12. [Security & Privacy](#12-security--privacy)
13. [Launch Strategy](#13-launch-strategy)
14. [Assumptions & Constraints](#14-assumptions--constraints)
15. [Risks & Mitigation](#15-risks--mitigation)
16. [Timeline & Milestones](#16-timeline--milestones)
17. [Appendix](#17-appendix)

---

## 1. Executive Summary

### 1.1 Product Vision

**Kids P2P Marketplace** is a hyper-local, mobile-first peer-to-peer marketplace exclusively for buying, selling, and swapping used children's clothes, toys, and gear. The platform creates trusted, privacy-first communities of parents within specific geographic nodes, enabling sustainable commerce while solving the challenge of rapidly outgrown kids' items.

**Unique Value Proposition:**  
We're the only kids marketplace offering a **dual-tier model** where free users get full marketplace access with cash, while **Kids Club+ subscribers** unlock a proprietary Swap Points system that reduces their buying costs by up to 100%, creating a powerful subscription lock-in effect.

### 1.2 Problem Statement

Parents face several challenges when dealing with outgrown children's items:

- **Financial Burden**: Children outgrow clothes and toys rapidly (every 3-6 months), creating $500-2,000 annual expenses per child
- **Waste**: Millions of tons of children's items end up in landfills annually despite having significant remaining value
- **Trust Issues**: Existing platforms (Craigslist, Facebook Marketplace) lack safety features, verification, and privacy protection
- **Discovery Friction**: Finding relevant local items requires extensive searching and filtering across multiple platforms
- **Transaction Complexity**: Coordinating meetups, pricing, and exchanges is time-consuming and risky
- **Subscription Fatigue**: Parents hesitant to commit to subscriptions without clear, measurable value

### 1.3 Solution Overview

Kids P2P Marketplace addresses these challenges through:

1. **Dual-Tier Access Model**
   - **Free Tier**: Full marketplace access, cash transactions only, buyer transaction fee per purchase (configurable; default: $2.99)
   - **Kids Club+ ($7.99/month)**: Swap Points system + discounted buyer transaction fee (configurable; default: $0.99) + priority features


2. **Subscription-Gated Swap Points**
   - Earn SP on sales (platform-calculated, ~25% of sale price)
   - Spend SP for discounts (1 SP = $1, up to 50% of item price)
   - 3-day pending period (protects against returns/fraud)
   - Closed-loop system (no cash-out, must circulate)

3. **Seller Payment Control**
   - Cash Only (sellers receive 100% cash)
   - Accept SP (sellers receive mix of SP + cash)
   - Donate (earn community badges, build reputation)

4. **Hyper-Local Trust & Safety**
   - Geographic nodes ensure local, convenient transactions
   - Phone verification for all users
   - AI-powered content moderation
   - Recall/safety checks

5. **Swipe-Based Discovery**
   - Modern, intuitive Tinder-style interface
   - Child profile matching (age, size, interests)
   - Priority matching for subscribers

### 1.4 Business Model

**Revenue Streams:**

| Stream                             | Amount (default config) | Target Volume (Year 1) | Annual Revenue |
| ---------------------------------- | ------------------------ | ---------------------- | -------------- |
| **Kids Club+ Subscriptions**       | $7.99/month              | 2,160 subscribers      | $207,086       |
| **Transaction Fees (Subscribers)** | $0.99/transaction        | 10,800 transactions    | $10,692        |
| **Transaction Fees (Free Users)**  | $2.99/transaction        | 7,200 transactions     | $21,528        |
| **Seller Fees**                    | 5% of sale price         | $621,000 GMV           | $31,050        |
| **Delivery Services**              | $10/delivery             | 1,800 deliveries       | $18,000        |
| **TOTAL**                          | —                        | —                      | **$288,356**   |

> **Note:** Transaction fee amounts above reflect the **default V1 fee configuration** (see Section 9.1.2). Actual fees are derived from configurable fixed + percentage components per node and per user tier.


**Key Insight:** Subscription revenue represents **72% of total revenue**, making subscriber acquisition and retention the primary business driver.

### 1.5 Target Launch

- **MVP Launch**: Q1 2026
- **Initial Nodes**: Norwalk, CT (06850-06856) and Little Falls, NJ (07424)
- **Target Users (End of Q2 2026)**: 500 active users, 150 subscribers
- **Expansion**: 5 additional nodes by end of 2026

### 1.6 Success Criteria (First 90 Days)

✅ **25-35% free-to-paid conversion rate**  
✅ **60%+ subscriber retention at 90 days**  
✅ **$34.50 average transaction value**  
✅ **50%+ SP circulation rate** (users spending SP, not hoarding)  
✅ **<$15 customer acquisition cost (CAC)**  
✅ **4.5+ app store rating**

---

## 2. Business Objectives

### 2.1 Primary Objectives

| Objective                        | Q1 2026  | Q2 2026   | Q3 2026   | Q4 2026   |
| -------------------------------- | -------- | --------- | --------- | --------- |
| **Total Active Users**           | 250      | 500       | 1,200     | 3,000     |
| **Kids Club+ Subscribers**       | 75 (30%) | 150 (30%) | 360 (30%) | 900 (30%) |
| **Monthly Transactions**         | 100      | 200       | 500       | 1,200     |
| **Avg Transaction Value**        | $30      | $34.50    | $35       | $36       |
| **Platform GMV**                 | $3,000   | $6,900    | $17,500   | $43,200   |
| **MRR (Subscriptions)**          | $599     | $1,199    | $2,876    | $7,191    |
| **Subscription Retention (90d)** | 60%      | 65%       | 70%       | 75%       |
| **Free→Paid Conversion**         | 25%      | 30%       | 32%       | 35%       |

### 2.2 Secondary Objectives

- ✅ Establish brand as the **safest, most trusted** kids marketplace
- ✅ Build defensible **geographic moats** in 2 initial nodes
- ✅ Validate **subscription + transaction fee** hybrid revenue model
- ✅ Achieve **50%+ SP circulation rate** (users actively spending SP)
- ✅ Create viral referral loops (15%+ organic growth from referrals)
- ✅ Achieve 4.5+ app store rating with <5% churn from SP confusion
- ✅ Maintain **<$15 CAC** while scaling (blended free + paid)

### 2.3 Strategic Goals (12-18 Months)

1. **Prove Node Model**: Demonstrate that hyper-local nodes create network effects and defensibility
2. **Subscription Lock-In**: Achieve 70%+ retention via SP value proposition
3. **Expand to 10 Nodes**: Replicate success in diverse geographies
4. **Profitability per Node**: Each node profitable at 500+ users
5. **Prepare for Series A**: Build metrics package for institutional fundraising

---

## 3. Stakeholders

### 3.1 Internal Stakeholders

| Role                 | Name/Team          | Responsibility                                   |
| -------------------- | ------------------ | ------------------------------------------------ |
| **Product Owner**    | [Name]             | Final decision authority on features, roadmap    |
| **Engineering Lead** | [Name]             | Technical architecture, development execution    |
| **Design Lead**      | [Name]             | UX/UI, brand identity, user research             |
| **Marketing Lead**   | [Name]             | User acquisition, retention, brand positioning   |
| **Customer Support** | [Name]             | User onboarding, issue resolution, feedback loop |
| **Legal/Compliance** | [External Counsel] | SP legal structure, terms of service, compliance |

### 3.2 External Stakeholders

| Stakeholder                     | Interest                                           | Influence Level |
| ------------------------------- | -------------------------------------------------- | --------------- |
| **Parents (Users)**             | Safe, easy, valuable marketplace                   | High            |
| **Investors**                   | Revenue growth, unit economics, scalability        | High            |
| **Payment Processors (Stripe)** | Transaction volume, compliance                     | Medium          |
| **App Stores (Apple/Google)**   | Policy compliance, IAP guidelines                  | High            |
| **Regulators**                  | Money transmission compliance, consumer protection | Medium          |
| **Local Communities**           | Safety, positive impact on neighborhood            | Low             |

---

## 4. Product Overview

### 4.1 Core Features (MVP)

#### 4.1.1 Free User Features

✅ **Full Marketplace Access**

- Browse all listings (swipe-based interface)
- Create listings (sell items for cash)
- Buy items (cash only)
- Secure messaging
- Phone verification
- Child profile setup

✅ **Cash Transactions**

- Pay $2.99 fee per transaction
- Receive 100% cash when selling (minus 5% seller fee)
- No Swap Points (locked feature)

✅ **Safety & Trust**

- Verified buyer/seller badges
- Ratings & reviews
- Safe meetup guidance
- Product recall checks

#### 4.1.2 Kids Club+ Subscriber Features

✅ **Everything in Free, PLUS:**

**Swap Points System**

- **Earn SP** when selling (platform-calculated, ~25% of price)
- **Receive SP** when buyers use SP to purchase your items
- **Spend SP** for discounts (1 SP = $1, up to 50% of item price)
- **Pending Period**: Earned SP release after 3 days (fraud protection)
- **Grace Period**: 90 days to resubscribe if cancelled (keep SP)

**Payment Preferences**

- Choose "Cash Only" or "Accept SP" or "Donate" on listings
- Mix of cash + SP earnings when selling
- Flexibility to optimize for cash vs. SP

**Cost Savings**

- $0.99 transaction fee (save $2 per transaction vs. free tier)
- Up to 50% discounts using SP on purchases
- Example: Sell $100 → Earn ~25 SP + $99.01 cash → Buy $50 item with 25 SP → Pay only $25.99

**Priority Features**

- Early access to new listings (30 minutes before free users)
- Priority in matching algorithm
- Priority customer support

**Donation & Badges**

- Donate items for free (earn badges)
- Badge progression: Helper (1) → Generous (5) → Champion (10) → Super Parent (25)
- Enhanced reputation/trust

### 4.2 Feature Comparison Table

| Feature               | Free User        | Kids Club+ Subscriber                  |
| --------------------- | ---------------- | -------------------------------------- |
| **Browse & Search**   | ✅ Full access   | ✅ Full access + early access (30 min) |
| **List Items**        | ✅ Cash only     | ✅ Cash Only / Accept SP / Donate      |
| **Buy Items**         | ✅ Cash only     | ✅ Cash + SP (up to 50% discount)      |
| **Messaging**         | ✅ Secure chat   | ✅ Secure chat                         |
| **Transaction Fee**   | ❌ $2.99         | ✅ $0.99 (save $2!)                    |
| **Earn Swap Points**  | ❌ Not available | ✅ ~25% of sale price                  |
| **Spend Swap Points** | ❌ Not available | ✅ 1 SP = $1 discount                  |
| **Donate Items**      | ❌ Not available | ✅ Earn badges                         |
| **Priority Matching** | ❌ Standard      | ✅ Priority                            |
| **Support**           | ✅ Email (48h)   | ✅ Priority email (24h)                |
| **Monthly Cost**      | 💰 $0            | 💰 $7.99 (30-day free trial)           |

### 4.3 User Experience Flow

#### 4.3.1 Free User Journey

```
1. Discover app → Download
2. Signup → Choose "Start Free"
3. Phone verification
4. Child profile setup (optional)
5. Browse listings (swipe interface)
6. Find item → Buy with cash ($2.99 fee)
7. See "Save $2 with Kids Club+" prompts throughout
8. List own items → Sell for cash only
9. Earn cash (minus 5% seller fee)
10. Encounter upgrade prompts:
    - "Earn SP on this sale with Kids Club+"
    - "Save $2 on transaction fees"
    - "Use SP for 50% discount on this item"
```

**Conversion Touchpoints:**

- Post-purchase: "You could have saved $2 with Kids Club+"
- Post-listing: "You could earn SP + cash with Kids Club+"
- When viewing "Accept SP" items: "Unlock SP discounts"
- In wallet: "Upgrade to unlock Swap Points"

#### 4.3.2 Subscriber Journey

```
1. Discover app → Download
2. Signup → Choose "Try Kids Club+ Free"
3. 30-day free trial begins
4. Phone verification
5. Child profile setup
6. Browse listings → See "Accepts SP" badges
7. Find item → Use SP slider (up to 50% discount)
8. Complete purchase: 25 SP + $25.99 cash
9. List own items → Choose "Accept SP"
10. Sell item → Earn:
    - 15 SP (pending 3 days)
    - 12 SP (received from buyer immediately)
    - $13.94 cash
11. SP release after 3 days → Available to spend
12. Repeat cycle → Build SP balance
13. Day 23 of trial: Reminder to add payment method
14. Trial ends → Convert to paid or downgrade to free
```

**Retention Touchpoints:**

- Day 7: "You've earned 45 SP this week!"
- Day 14: "Your SP saved you $38 so far!"
- Day 23: "Trial ends in 7 days. Add payment to keep your 125 SP!"
- Day 30: Convert or lose SP access

### 4.4 Technical Architecture Summary

**Frontend:**

- React Native (iOS + Android)
- Tailwind CSS styling
- Offline-first approach for browsing

**Backend:**

- Node.js + Express or Python + FastAPI
- Supabase (PostgreSQL + Auth + Storage)
- Upstash Redis (caching, sessions)
- Cloudflare R2 (image storage)

**Third-Party:**

- Stripe (payments, subscriptions)
- Twilio (SMS verification)
- AWS Rekognition/Google Vision (AI moderation)

**Cost Target:**

- Free tiers for <1,000 users
- <$200/month at 5,000 users
- <$1,000/month at 50,000 users

---

## 5. Market Analysis

### 5.1 Market Opportunity

**Total Addressable Market (TAM):**

- US households with children under 12: **~30 million**
- Average spend on kids' items: **$1,500/year per child**
- Total market size: **$45 billion annually**

**Serviceable Available Market (SAM):**

- Parents actively buying/selling used kids' items: **~12 million** (40%)
- Average resale value: **$500/year per household**
- SAM: **$6 billion annually**

**Serviceable Obtainable Market (SOM):**

- Year 1 target: **7,200 active users** in 2 nodes
- Year 3 target: **500,000 users** across 100 nodes
- Year 5 target: **5 million users** nationwide

### 5.2 Competitive Landscape

| Competitor               | Strengths                   | Weaknesses                                    | Our Advantage                             |
| ------------------------ | --------------------------- | --------------------------------------------- | ----------------------------------------- |
| **Facebook Marketplace** | Massive user base, free     | No verification, spam/scams, not kid-focused  | Trust & safety, kid-centric UX, SP system |
| **Mercari**              | Established brand, shipping | Generic (not kids), high fees (10%), no local | Hyper-local, lower fees, kid-specific     |
| **Poshmark**             | Strong community            | Primarily clothing, fashion-focused           | Broader kids' items, local pickup         |
| **Kidizen**              | Kids-focused, curated       | Complex onboarding, shipping only, slow       | Local pickup, simpler UX, SP rewards      |
| **OfferUp/Letgo**        | Local focus                 | Trust issues, not kid-specific                | Verification, kid-centric, SP system      |
| **ThredUp (Kids)**       | Established, easy selling   | Low seller payouts, consignment model         | Direct P2P, better payouts, SP bonus      |

**Competitive Moats:**

1. **Subscription-Gated SP System**: Proprietary incentive model creates lock-in
2. **Geographic Nodes**: First-mover advantage in each node
3. **Trust & Safety**: Best-in-class verification and moderation
4. **Kid-Centric UX**: Purpose-built for parents' specific needs

### 5.3 Market Trends

**Supporting Trends:**

- ✅ **Sustainability Focus**: Parents increasingly value circular economy
- ✅ **Inflation/Economic Pressure**: 73% of parents looking to save on kids' items
- ✅ **Subscription Acceptance**: Parents comfortable with subscriptions (Netflix, Amazon, etc.)
- ✅ **Local-First Movement**: COVID accelerated demand for hyper-local commerce

**Headwinds:**

- ⚠️ **Subscription Fatigue**: Average household has 6+ subscriptions
- ⚠️ **Trust Barriers**: Parents cautious about marketplace safety
- ⚠️ **Network Effects Required**: Need critical mass per node to succeed

---

## 6. Functional Requirements

### 6.1 User Management (FR-UM)

**FR-UM-001: User Registration**

- Users must provide: first name, last name, email, phone, password, ZIP code
- Users choose subscription tier at signup: Free or Kids Club+ (30-day trial)
- System validates email format and phone format
- System checks if ZIP code is in active node → If not, add to waitlist

**FR-UM-002: Phone Verification**

- System sends 6-digit SMS code via Twilio
- User enters code within 10 minutes
- Max 3 code requests per hour (rate limiting)
- Max 5 wrong attempts → lock account for 1 hour

**FR-UM-003: Child Profile Setup**

- Optional but recommended
- Capture: child's first name, birthdate, sizes, interests
- Support multiple child profiles per user
- Used for personalized feed matching

**FR-UM-004: Subscription Management**

- Users can upgrade from Free to Kids Club+ anytime
- 30-day free trial for new subscribers (one per user)
- Users can cancel anytime (effective at end of billing period)
- Cancelled users enter 90-day grace period (SP frozen)
- Users can resubscribe within grace period (SP unfrozen)

### 6.2 Listing Management (FR-LM)

**FR-LM-001: Create Listing**

- Users upload 1-5 photos
- AI analyzes photos for: category, brand, condition, safety recalls
- Users review AI suggestions and edit as needed
- Users enter: title, category, size, condition, price, description
- **Subscribers only**: Choose payment preference (Cash Only / Accept SP / Donate)
- **Free users**: Default to Cash Only (no choice)
- System validates: price ≥ $20 (or bundle)
- System calculates estimated SP if "Accept SP" selected

**FR-LM-002: Edit Listing**

- Users can edit all fields before first buyer contact
- After buyer contact → can only edit price and description
- Payment preference locked once buyer interested

**FR-LM-003: Delete Listing**

- Users can delete anytime
- Soft delete (mark as deleted, hide from feed)
- Retain in database for 30 days (legal/dispute purposes)

**FR-LM-004: Listing Expiration**

- Listings expire after 90 days
- Notify seller 7 days before expiration
- Allow one-tap relist (re-use photos/description)

### 6.3 Swap Points System (FR-SP) - **SUBSCRIBERS ONLY**

**FR-SP-001: Earning SP**

- When subscriber sells an item with "Accept SP" or "Donate" preference
- Platform calculates SP based on admin-configured formula
- Default: 25% of sale price × category multiplier
- SP status: "Pending" for 3 days after transaction
- SP auto-release after 3 days if no return filed
- If return filed → SP cancelled (never released)

**FR-SP-002: Receiving SP**

- When buyer uses SP to purchase subscriber's listing
- Seller receives SP immediately (not pending)
- Example: Buyer uses 25 SP → Seller gets 25 SP in wallet (available now)

**FR-SP-003: Spending SP**

- Subscribers can use SP when buying items with "Accept SP" preference
- 1 SP = $1 discount
- Maximum 50% of item price can be paid with SP
- Platform fee ($0.99) must be paid in cash
- SP deducted from available balance (not pending)

**FR-SP-004: SP Wallet**

- Display two balances: Available SP and Pending SP
- Available: Ready to spend now
- Pending: Waiting 3-day release period (show countdown)
- Show lifetime stats: earned, received, spent

**FR-SP-005: SP Expiration**

- **While subscribed**: SP never expire
- **After cancellation**: 90-day grace period
  - SP frozen (cannot earn new, cannot spend existing)
  - User can resubscribe to unfreeze
  - After 90 days → permanent deletion

**FR-SP-006: SP Restrictions (Free Users)**

- Free users cannot earn SP (even if they sell items)
- Free users cannot spend SP (even if they somehow have balance)
- System shows upgrade prompts when free users encounter SP features

### 6.4 Transaction Processing (FR-TX)

**FR-TX-001: Purchase Flow**

- Buyer selects item → Reviews details
- **If subscriber + listing accepts SP**: Show SP slider (0% to 50%)
- **If free user or cash-only listing**: Cash only option
- Calculate total: (Item price - SP discount) + platform fee
- Collect payment via Stripe
- Deduct SP from buyer's wallet (if used)
- Mark transaction as "pending"

**FR-TX-002: Seller Notification**

- Notify seller of sale immediately
- Display earnings breakdown:
  - Cash received (if any)
  - SP earned (pending 3 days)
  - SP received (from buyer's payment, if any)
- Facilitate pickup/delivery coordination

**FR-TX-003: Transaction Completion**

- Buyer confirms receipt → Release funds to seller
- Start 3-day countdown for pending SP
- Deduct 5% seller fee from cash payout
- Transfer cash to seller's bank account

**FR-TX-004: Returns & Disputes**

- Buyer can request return within 3 days
- If approved:
  - Refund buyer (cash + SP if used)
  - Cancel seller's pending SP (if not yet released)
  - If seller already spent received SP → platform absorbs loss
- Dispute resolution via support tickets

### 6.5 Search & Discovery (FR-SD)

**FR-SD-001: Home Feed (Swipe Interface)**

- Display listings relevant to user's child profiles
- Match by: size, age, category preferences
- Prioritize by: distance, recency, subscriber status
- **Subscribers**: See new listings 30 min before free users
- Swipe right → Like (save to favorites)
- Swipe left → Pass (hide from feed)

**FR-SD-002: Search**

- Filter by: category, size, price range, distance, condition
- Sort by: newest, price (low/high), distance
- **Subscribers**: Option to filter "Accepts SP only"

**FR-SD-003: Favorites**

- Users can save listings to favorites
- Notify when favorited item price drops
- Notify when favorited item about to expire

### 6.6 Messaging (FR-MSG)

**FR-MSG-001: Secure Chat**

- In-app messaging between buyer and seller
- No phone numbers or emails shared (privacy)
- Push notifications for new messages
- Message history retained for 90 days post-transaction

**FR-MSG-002: Safety Features**

- Auto-detect contact info in messages → block
- Auto-detect profanity → warn user
- Report message feature

### 6.7 Ratings & Reviews (FR-RR)

**FR-RR-001: Post-Transaction Rating**

- Both parties rate each other (1-5 stars)
- Optional written review (500 chars max)
- Ratings visible on user profiles
- Aggregate rating displayed (e.g., 4.8 ⭐⭐⭐⭐⭐)

**FR-RR-002: Reputation Score**

- Calculate from: seller ratings, buyer ratings, response time, completion rate
- Display badges: New Member, Trusted Seller, Top Seller, Power Seller
- **Donation badges** (subscribers only): Helper, Generous, Champion, Super Parent

---

## 7. Non-Functional Requirements

### 7.1 Performance (NFR-PERF)

**NFR-PERF-001: Response Times**

- API responses (GET): <200ms (p50), <500ms (p95)
- API responses (POST): <500ms (p50), <1s (p95)
- Page load (First Contentful Paint): <1s (p50), <2s (p95)
- Image load: <500ms (p50), <1s (p95)
- SP calculation: <100ms always

**NFR-PERF-002: Scalability**

- Support 500 concurrent users per node
- Handle 100 transactions/hour during peak
- Database: Scale from 500 users (free tier) to 50,000 users (enterprise tier)

### 7.2 Security (NFR-SEC)

**NFR-SEC-001: Data Encryption**

- All data encrypted in transit (HTTPS/TLS 1.3)
- PII encrypted at rest (phone, email)
- Passwords hashed with bcrypt (cost factor 12)

**NFR-SEC-002: Authentication**

- JWT-based authentication
- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- Phone verification required for all users

**NFR-SEC-003: Payment Security**

- Never store credit card numbers
- Use Stripe for PCI compliance
- Tokenize all payment methods

### 7.3 Privacy (NFR-PRIV)

**NFR-PRIV-001: Data Minimization**

- Collect only necessary PII
- No third-party analytics with PII
- No data sharing with advertisers

**NFR-PRIV-002: User Anonymity**

- Only first name + last initial visible to other users
- No public profiles
- Location masked to ZIP code level (not exact address)

### 7.4 Availability (NFR-AVAIL)

**NFR-AVAIL-001: Uptime**

- Target: 99.9% uptime (43 minutes downtime/month acceptable)
- Graceful degradation if backend services fail
- Offline mode for browsing cached listings

### 7.5 Usability (NFR-USE)

**NFR-USE-001: Accessibility**

- WCAG 2.1 Level AA compliance
- Screen reader support
- Minimum touch target: 44×44 pixels

**NFR-USE-002: Localization**

- English (US) for MVP
- Spanish (US) planned for Phase 2

---

## 8. User Stories

### 8.1 Free User Stories

**US-FREE-001: Signup and Browse**

```
As a parent with young kids,
I want to sign up for free and browse listings,
So that I can see what's available before committing to a subscription.

Acceptance Criteria:
✓ Can complete signup without payment method
✓ Can browse all active listings in my node
✓ Can see listings marked "Accepts SP" but cannot use SP
✓ See clear messaging about Kids Club+ benefits
```

**US-FREE-002: Buy with Cash Only**

```
As a free user,
I want to buy an item with cash,
So that I can test the platform before upgrading.

Acceptance Criteria:
✓ Can purchase any item with cash + $2.99 fee
✓ See post-purchase prompt: "You could have saved $2 with Kids Club+"
✓ Cannot use SP even if listing accepts it
✓ Transaction completes successfully with Stripe
```

**US-FREE-003: Sell for Cash Only**

```
As a free user,
I want to list and sell items for cash,
So that I can declutter without a subscription.

Acceptance Criteria:
✓ Can create listing with photos, price, details
✓ Payment preference automatically set to "Cash Only" (no choice)
✓ Receive cash payout (minus 5% seller fee)
✓ See post-sale prompt: "You could have earned SP with Kids Club+"
```

**US-FREE-004: Encounter Upgrade Prompts**

```
As a free user browsing an "Accept SP" listing,
I want to see clear benefits of upgrading,
So that I can decide if Kids Club+ is worth it for me.

Acceptance Criteria:
✓ See badge "Accepts SP" on listing card
✓ In detail view: "Kids Club+ members can save up to $X with SP"
✓ CTA button: "Learn About Kids Club+"
✓ Modal explains SP system with example savings
```

### 8.2 Subscriber User Stories

**US-SUB-001: Sign Up with Trial**

```
As a new user,
I want to try Kids Club+ free for 30 days,
So that I can experience the full value before paying.

Acceptance Criteria:
✓ Can select "Try Free for 30 Days" during onboarding
✓ No payment method required to start trial
✓ Trial status visible in account ("Trial ends Jan 4")
✓ Reminders sent at Day 23, 28, 29
```

**US-SUB-002: Create Listing with Payment Preference**

```
As a subscriber,
I want to choose whether my listing accepts SP or cash only,
So that I can optimize for cash or faster sales.

Acceptance Criteria:
✓ After entering price, see three options:
  - Cash Only (receive 100% cash)
  - Accept SP (receive mix of SP + cash)
  - Donate (free item, earn badge)
✓ If "Accept SP" selected, see estimated SP earnings
✓ Clear explanation of each option
```

**US-SUB-003: Earn SP from Sale**

```
As a subscriber who sold an item with "Accept SP" preference,
I want to see my SP earnings and understand the pending period,
So that I know when I can use them.

Acceptance Criteria:
✓ Sale notification shows:
  - Cash received (if any)
  - SP earned (pending 3 days)
  - SP received from buyer (available now, if any)
✓ SP wallet shows "Pending: 38 SP (releases Dec 8)"
✓ Tap "Why pending?" → explainer modal
✓ After 3 days, auto-release to available balance
```

**US-SUB-004: Buy with SP Slider**

```
As a subscriber with 125 SP,
I want to use some SP for a discount when buying,
So that I can save money.

Acceptance Criteria:
✓ On "Accept SP" listing, see SP slider (0% to 50%)
✓ Slider shows real-time total:
  "Use 25 SP → Pay $25.99 total (save $25!)"
✓ Quick select buttons: [Use Max SP] [Use Half] [Cash Only]
✓ Cannot use more than 50% of item price
✓ Cannot use pending SP (only available SP)
```

**US-SUB-005: Cancel Subscription & Grace Period**

```
As a subscriber who wants to cancel,
I want to understand what happens to my SP,
So that I can make an informed decision.

Acceptance Criteria:
✓ Cancel button shows confirmation modal:
  "You have 125 SP worth $125. Cancel now?"
✓ Explanation: "Your SP will be frozen. Resubscribe within 90 days to keep them."
✓ Upon cancellation, SP wallet shows:
  "Frozen: 125 SP (expires Apr 5, 2026)"
✓ Notifications at Day 60, 30, 7, 1 before expiration
```

**US-SUB-006: Donate Item for Badge**

```
As a subscriber who wants to give back to the community,
I want to donate an item and earn a badge,
So that I can build my reputation.

Acceptance Criteria:
✓ Select "Donate" payment preference when listing
✓ Listing shows "Free" badge
✓ Buyer pays $0.99 fee only (no item price)
✓ After sale, seller sees: "Donation complete! Progress: 3/10 to Community Champion"
✓ Badge visible on profile
```

### 8.3 Admin User Stories

**US-ADMIN-001: Configure SP Formula**

```
As a platform admin,
I want to configure the SP earning formula per node,
So that I can optimize for market conditions.

Acceptance Criteria:
✓ Select node from dropdown
✓ Choose formula type: Price Bands / Percentage / Hybrid
✓ Set base percentage (e.g., 25%)
✓ Set min/max SP per transaction
✓ Configure category multipliers
✓ Preview examples before saving
✓ Changes apply to future transactions only
```

**US-ADMIN-002: Monitor SP Health**

```
As a platform admin,
I want to see SP circulation metrics,
So that I can detect hoarding or liquidity issues.

Acceptance Criteria:
✓ Dashboard shows:
  - Total SP issued
  - Total SP spent (circulation rate %)
  - Total SP pending
  - Total SP available (user wallets)
✓ Alert if circulation rate < 40%
✓ Alert if user SP balance growing >20%/month
✓ Export data to CSV
```

**US-ADMIN-003: Manual SP Adjustment**

```
As a platform admin handling a dispute,
I want to manually adjust a user's SP balance,
So that I can resolve edge cases.

Acceptance Criteria:
✓ Search for user by ID or email
✓ View current SP balance (available + pending)
✓ Add or deduct SP with reason note
✓ Change logged in audit trail
✓ User notified of adjustment via email
```

---

## 9. Revenue Model

### 9.1 Revenue Streams (Detailed)

#### 9.1.1 Kids Club+ Subscriptions (Primary Revenue)

**Pricing:** $7.99/month  
**Trial:** 30 days free (no credit card required)  
**Conversion Target:** 30% of free users upgrade  
**Retention Target:** 70% at 3 months, 60% at 12 months

**Projections:**

| Month    | Total Users | Subscribers | MRR     | ARR (Projected) |
| -------- | ----------- | ----------- | ------- | --------------- |
| Month 3  | 250         | 75 (30%)    | $599    | $7,188          |
| Month 6  | 500         | 150 (30%)   | $1,199  | $14,388         |
| Month 12 | 3,000       | 900 (30%)   | $7,191  | $86,292         |
| Month 24 | 10,000      | 3,000 (30%) | $23,970 | $287,640        |

**Churn Mitigation:**

- SP lock-in effect (users have value in wallet)
- 90-day grace period (give users time to resubscribe)
- "Winback" campaigns at Day 60, 30, 7, 1
- Quarterly "bonus SP" for loyal subscribers

**Expansion Revenue (Future):**

- Annual plan: $79/year (save $16, ~17% discount)
- Family plan: $11.99/month for 2+ parents in household

#### 9.1.2 Transaction Fees

**Subscriber Fee:** $0.99 per transaction  
**Free User Fee:** $2.99 per transaction  
**Seller Fee:** 5% of sale price (both user types)

**Assumptions:**

- Average transaction value: $34.50
- Transactions per user per month: 1.5 (0.75 buy, 0.75 sell)
- 60% of users transact monthly (40% browse only)

**Projections (Year 1):**

| User Type                   | Users | Transactions/Mo | Fee/Tx | Monthly Revenue | Annual Revenue |
| --------------------------- | ----- | --------------- | ------ | --------------- | -------------- |
| **Subscribers (Buyer Fee)** | 900   | 540             | $0.99  | $535            | $6,420         |
| **Free Users (Buyer Fee)**  | 2,100 | 1,260           | $2.99  | $3,767          | $45,204        |
| **Seller Fee (5%)**         | 3,000 | 1,800           | $1.73  | $3,114          | $37,368        |
| **TOTAL**                   | —     | —               | —      | **$7,416**      | **$88,992**    |

**Strategic Note:** Transaction fees are secondary to subscriptions but ensure platform profitability even if subscriptions decline.

#### 9.1.3 Delivery Services (Optional)

**Pricing:** $10 per delivery (same-day local delivery)  
**Take Rate:** Platform takes $3, driver keeps $7  
**Assumptions:** 10% of transactions opt for delivery

**Projections (Year 1):**

- 1,800 transactions/month × 10% = 180 deliveries/month
- 180 × $3 = $540/month = $6,480/year

**Phase 2 Expansion:**

- Partner with local delivery services (Uber, DoorDash)
- Offer delivery subscriptions ($15/month unlimited)

### 9.2 Unit Economics

#### 9.2.1 Free User

**Lifetime Revenue (12 months):**

```
Transaction fees: 9 transactions × $2.99 = $26.91
Seller fees: 9 sales × $34.50 × 5% = $15.53
Total revenue: $42.44

Costs:
- CAC (acquisition): $10
- Platform costs: $2 (bandwidth, storage)
- Payment processing: $1.50
Total costs: $13.50

LTV: $42.44
CAC: $13.50
LTV:CAC = 3.1:1 ✅
```

#### 9.2.2 Subscriber

**Lifetime Revenue (12 months, assuming 70% retention):**

```
Subscription revenue: $7.99 × 8.4 months* = $67.12
Transaction fees: 9 transactions × $0.99 = $8.91
Seller fees: 9 sales × $34.50 × 5% = $15.53
Total revenue: $91.56

*8.4 months = 70% retention average

Costs:
- CAC (acquisition): $15
- Platform costs: $3 (SP system adds complexity)
- Payment processing: $3.50
- SP "cost" (discount): $15 (user uses ~60 SP worth $60 discount)
Total costs: $36.50

LTV: $91.56
CAC: $36.50
LTV:CAC = 2.5:1 ✅
```

**Note:** SP "cost" is internal (not cash out-of-pocket). It's a discount that reduces cash revenue but drives retention. Net effect is positive when factoring in subscription retention.

### 9.3 Path to Profitability

**Break-Even Analysis (Per Node):**

Fixed Costs per Node:

- Marketing: $2,000/month
- Support (part-time): $1,000/month
- Platform costs: $500/month
- Total: $3,500/month

Revenue Required to Break Even: $3,500/month

**At what user count?**

```
Assume:
- 30% subscribers: 150 subscribers
- 70% free: 350 free users
- Total: 500 users

Revenue:
- Subscriptions: 150 × $7.99 = $1,199/month
- Subscriber tx fees: 90 tx × $0.99 = $89
- Free tx fees: 210 tx × $2.99 = $628
- Seller fees: 300 tx × $34.50 × 5% = $518
Total: $2,434/month

Costs: $3,500/month

Loss: -$1,066/month ❌

Need ~750 users per node to break even
```

**Profitability at Scale:**

```
750 users = $3,650 revenue > $3,500 costs ✅
1,500 users = $7,300 revenue (fixed costs same) = $3,800 profit/month
3,000 users = $14,600 revenue = $11,100 profit/month
```

**Multi-Node Scaling:**

- 10 nodes × 1,500 users each = 15,000 total users
- Revenue: $73,000/month
- Costs: $50,000/month (economies of scale)
- Profit: $23,000/month = $276,000/year

---

## 10. Success Metrics & KPIs

### 10.1 North Star Metric

**Active Subscribers with Positive SP Balance**

This metric captures:

- Subscription acquisition
- Subscription retention
- SP system engagement
- Marketplace activity (need to sell to earn SP)

Target: **30% of total users** are active subscribers with >0 SP

### 10.2 Critical Metrics (Dashboard)

#### 10.2.1 Subscription Metrics

| Metric                           | Target     | Red Flag   | Measurement                                      |
| -------------------------------- | ---------- | ---------- | ------------------------------------------------ |
| **Free → Paid Conversion**       | 25-35%     | <20%       | % of free users who upgrade within 90 days       |
| **Trial → Paid Conversion**      | 60-70%     | <50%       | % of trial users who add payment method          |
| **Subscription Retention (30d)** | 70%+       | <60%       | % of paid subscribers still active after 30 days |
| **Subscription Retention (90d)** | 60%+       | <50%       | % of paid subscribers still active after 90 days |
| **MRR Growth**                   | 15%/month  | <5%/month  | Month-over-month recurring revenue growth        |
| **Churn Rate**                   | <10%/month | >15%/month | % of subscribers cancelling per month            |

#### 10.2.2 SP System Metrics

| Metric                          | Target          | Red Flag     | Measurement                                  |
| ------------------------------- | --------------- | ------------ | -------------------------------------------- |
| **SP Transaction Mix**          | 40-60%          | <30% or >80% | % of transactions using SP                   |
| **SP Circulation Rate (90d)**   | 50%+            | <40%         | % of issued SP spent within 90 days          |
| **Avg SP Balance per User**     | 100-150 SP      | >200 SP      | Average available SP in subscriber wallets   |
| **SP Balance Growth Rate**      | Steady          | >20%/month   | Rate of SP accumulation (hoarding indicator) |
| **Listings Accepting SP**       | 50-60%          | <40%         | % of subscriber listings with "Accept SP"    |
| **Avg SP Used per Transaction** | 20-30% of price | <10%         | Average % of item price paid with SP         |

#### 10.2.3 Marketplace Metrics

| Metric                            | Target   | Red Flag     | Measurement                                 |
| --------------------------------- | -------- | ------------ | ------------------------------------------- |
| **GMV (Gross Merchandise Value)** | Growth   | Decline      | Total $ value of items sold                 |
| **Transaction Volume**            | Growth   | Flat/Decline | Number of completed transactions            |
| **Average Transaction Value**     | $34.50   | <$25         | Average item price sold                     |
| **Time to Sell (SP listings)**    | 4-5 days | >7 days      | Avg days from listing to sale (SP accepted) |
| **Time to Sell (Cash only)**      | 7-8 days | >10 days     | Avg days from listing to sale (cash only)   |
| **Listing Conversion Rate**       | 60%+     | <40%         | % of listings sold within 90 days           |

#### 10.2.4 User Engagement Metrics

| Metric                   | Target | Red Flag | Measurement                                    |
| ------------------------ | ------ | -------- | ---------------------------------------------- |
| **DAU/MAU Ratio**        | 30%+   | <20%     | Daily active users / Monthly active users      |
| **Avg Session Length**   | 8+ min | <5 min   | Time spent per app session                     |
| **Swipes per Session**   | 20+    | <10      | Number of listings swiped per session          |
| **Repeat Purchase Rate** | 40%+   | <25%     | % of buyers making 2nd purchase within 90 days |
| **Seller Retention**     | 50%+   | <30%     | % of sellers listing 2nd item within 90 days   |

#### 10.2.5 Financial Metrics

| Metric                      | Target | Red Flag | Measurement                                 |
| --------------------------- | ------ | -------- | ------------------------------------------- |
| **CAC (Blended)**           | <$15   | >$25     | Cost to acquire one user (free or paid)     |
| **CAC (Paid Subscriber)**   | <$30   | >$50     | Cost to acquire one paying subscriber       |
| **LTV:CAC Ratio**           | ≥3:1   | <2:1     | Lifetime value to customer acquisition cost |
| **Subscriber LTV**          | $90+   | <$60     | 12-month lifetime value of subscriber       |
| **Revenue per User (ARPU)** | $12+   | <$8      | Average monthly revenue per active user     |
| **Contribution Margin**     | 60%+   | <40%     | (Revenue - variable costs) / Revenue        |

### 10.3 SP Success Metrics (Specific)

These metrics validate the subscription-gated SP model:

| Metric                              | Target             | What It Measures                           | Action if Red Flag           |
| ----------------------------------- | ------------------ | ------------------------------------------ | ---------------------------- |
| **SP Earners per Month**            | 60% of subscribers | How many subscribers are selling           | Increase listing incentives  |
| **SP Spenders per Month**           | 50% of subscribers | How many subscribers are buying with SP    | Improve SP spending UX       |
| **SP Earned per Active Seller**     | 50-75 SP/month     | Are sellers earning meaningful SP?         | Adjust earning formula       |
| **SP Spent per Active Buyer**       | 30-50 SP/month     | Are buyers finding value in SP?            | Improve SP acceptance rate   |
| **SP → Cash Conversion Attempts**   | <1%                | Are users trying to cash out? (bad sign)   | Strengthen messaging         |
| **SP Confusion Support Tickets**    | <5% of subscribers | Is SP system clear?                        | Improve onboarding/education |
| **"Accept SP" Listing Performance** | Sell 40% faster    | Does accepting SP help sellers?            | Promote this benefit         |
| **Subscriber Churn Due to SP**      | <2%                | Are users canceling due to SP frustration? | Fix UX pain points           |

---

## 11. Technical Architecture

(See SYSTEM_REQUIREMENTS_V2.md for detailed specs)

**Summary:**

**Frontend:**

- React Native (iOS + Android)
- Offline-first architecture
- State management: React Context + hooks

**Backend:**

- Node.js + Express OR Python + FastAPI
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Upstash Redis (caching, sessions)
- Cloudflare R2 (image storage, no egress fees)

**Third-Party Integrations:**

- Stripe (payments, subscriptions, webhooks)
- Twilio (SMS verification)
- AWS Rekognition / Google Vision (AI content moderation)

**Infrastructure:**

- Vercel (frontend hosting, serverless functions)
- Cloudflare (CDN, DDoS protection)
- GitHub Actions (CI/CD)

**Cost Optimization:**

- Start with free tiers (<1,000 users)
- Upgrade to paid tiers as needed
- Target: <$1,000/month at 50,000 users

---

## 12. Security & Privacy

### 12.1 Security Measures

✅ **Data Encryption**

- All data in transit: TLS 1.3 (HTTPS, WSS)
- PII at rest: AES-256 encryption
- Passwords: bcrypt with cost factor 12

✅ **Authentication & Authorization**

- JWT tokens (1-hour access, 30-day refresh)
- Phone verification required for all users
- Role-based access control (user, admin)

✅ **Payment Security**

- PCI DSS compliance via Stripe
- Never store credit card numbers
- Tokenize all payment methods

✅ **Fraud Prevention**

- 3-day SP pending period
- Monitor sell → buy → return patterns
- Flag users with >3 returns in 30 days
- Manual review for high-value transactions (>$200)

### 12.2 Privacy Protections

✅ **Data Minimization**

- Collect only necessary PII (name, email, phone, ZIP)
- No tracking pixels or third-party analytics with PII
- No data sharing with advertisers

✅ **User Anonymity**

- Only first name + last initial visible
- No public profiles
- Location masked to ZIP code (not exact address)
- Messages auto-detect and block contact info sharing

✅ **Compliance**

- GDPR-compliant (though US-focused)
- CCPA-compliant (California privacy law)
- COPPA-aware (no data collection from children)

---

## 13. Launch Strategy

### 13.1 Pre-Launch (Weeks 1-4)

**Week 1-2: Waitlist & Landing Page**

- Launch waitlist landing page
- Collect: email, ZIP code, # of kids, ages
- Run Facebook/Instagram ads ($500 budget)
- Target: 200+ waitlist signups in Norwalk, CT + Little Falls, NJ

**Week 3-4: User Research**

- 5-7 parent interviews (45 min each, $25 gift card)
- 20-30 parent surveys (15 min, $5 gift card)
- Test: Fee sensitivity, subscription willingness, SP appeal
- Decision point: Validate core assumptions or pivot

### 13.2 MVP Launch (Week 5-8)

**Week 5: Soft Launch (Invite-Only)**

- Invite 50 waitlist users (25 per node)
- Manually onboard via Zoom call (30 min each)
- Offer "Founder's Club" perks: Free subscription for 3 months
- Goal: Seed marketplace with initial listings

**Week 6-7: Beta Expansion**

- Invite next 200 waitlist users
- Continue manual onboarding (group Zoom sessions)
- Monitor: Listings created, transactions completed, feedback

**Week 8: Public Launch**

- Open to all users in Norwalk, CT + Little Falls, NJ
- Launch PR campaign (local news, parenting blogs)
- Paid ads: Facebook, Instagram ($2,000 budget)
- Goal: 500 total users by end of Q1 2026

### 13.3 Growth Strategy (Month 2-6)

**Referral Program**

- Give: Referrer gets 25 SP, referee gets 10 SP (subscribers only)
- Give: Free users get $5 credit for referrals
- Target: 15%+ of signups from referrals

**Content Marketing**

- Blog: "How to Sell Kids' Items Fast"
- Blog: "Maximize Your Swap Points"
- Local parenting Facebook groups (organic engagement)

**Community Building**

- Monthly "Swap Meetup" events (in-person)
- Feature "Member Spotlight" in email newsletter
- Gamification: Monthly "Top Seller" leaderboard

**Paid Acquisition**

- Facebook/Instagram ads ($5,000/month)
- Google Search ads (brand terms)
- Partnerships with local daycares, preschools

### 13.4 Node Expansion (Month 6-12)

**Criteria for New Node:**

- ✅ Waitlist ≥100 users in target ZIP codes
- ✅ Market research validates demand
- ✅ Existing nodes at 70%+ retention

**Expansion Nodes (Priority Order):**

1. Westport, CT (adjacent to Norwalk, affluent)
2. Montclair, NJ (adjacent to Little Falls, similar demo)
3. Greenwich, CT (high income, strong mom networks)
4. Summit, NJ (high income, strong mom networks)
5. New Canaan, CT (affluent, strong community)

**Launch Process (Per Node):**

- 4 weeks pre-launch: Waitlist building
- Week 1: Invite-only (50 users)
- Week 2-3: Beta (200 users)
- Week 4: Public launch

---

## 14. Assumptions & Constraints

### 14.1 Assumptions

**Market Assumptions:**

- ✅ Parents are willing to pay $7.99/month for SP system
- ✅ 30% of free users will convert to paid within 90 days
- ✅ 60%+ of subscribers will retain for 12+ months
- ✅ SP system drives retention (via lock-in effect)
- ✅ Hyper-local nodes create defensible network effects

**Product Assumptions:**

- ✅ Swipe-based UX is intuitive for parents
- ✅ SP pending period (3 days) is acceptable to users
- ✅ 50% SP cap per transaction balances user value with platform cash flow
- ✅ AI listing assistant reduces friction and increases listing quality
- ✅ Phone verification is sufficient for trust (no government ID needed)

**Financial Assumptions:**

- ✅ Average transaction value: $34.50
- ✅ Transactions per active user per month: 1.5
- ✅ Blended CAC: <$15
- ✅ Infrastructure costs stay <$200/month for first 5,000 users

### 14.2 Constraints

**Technical Constraints:**

- Must stay within free/low-cost infrastructure tiers initially
- Cannot build native iOS/Android apps separately (React Native required)
- Limited AI budget (must use free/low-cost image recognition APIs)

**Resource Constraints:**

- Small team (2-3 engineers, 1 designer, 1 product manager)
- Limited marketing budget ($5,000/month)
- No full-time customer support (founder-led initially)

**Regulatory Constraints:**

- Cannot operate as money transmitter (hence closed-loop SP)
- Must comply with App Store IAP guidelines (subscriptions OK)
- Must comply with marketplace regulations (seller fees disclosed)

**Geographic Constraints:**

- Start with 2 nodes only (limited resources)
- Cannot expand to new states until legal review complete
- Must achieve profitability per node before expanding

---

## 15. Risks & Mitigation

### 15.1 Business Risks

**Risk 1: Low Free → Paid Conversion (<20%)**

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**

- Conduct extensive user research before launch
- A/B test subscription pricing ($7.99 vs $9.99 vs $5.99)
- Offer extended trials (60 days instead of 30 days) if needed
- Strengthen SP value messaging throughout app
- Run "first month $1" promotions to reduce barrier

**Risk 2: High Subscriber Churn (>20%/month)**

**Impact:** Critical  
**Likelihood:** Medium  
**Mitigation:**

- Monitor churn reasons via exit surveys
- Implement 90-day grace period (reduce panic cancellations)
- Send targeted winback campaigns
- Add "pause subscription" option (vs. full cancellation)
- Enhance SP earning opportunities (loyalty bonuses, challenges)

**Risk 3: SP System Confusion (>10% support tickets)**

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**

- Extensive onboarding tutorial (interactive walkthrough)
- In-app tooltips and explainer modals
- Video tutorials (1-2 min each)
- FAQ section prominently placed
- Simplify UI (minimize jargon, use plain language)

### 15.2 Product Risks

**Risk 4: SP Hoarding (Circulation <40%)**

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**

- Introduce SP expiration for unused SP (e.g., 12 months)
- Send reminders: "You have 125 SP expiring soon!"
- Create "SP Flash Sales" (limited-time items accepting SP only)
- Gamification: "Spend 50 SP this month, earn 10 bonus SP"

**Risk 5: Cash Liquidity Issues (>80% SP transactions)**

**Impact:** Critical  
**Likelihood:** Low  
**Mitigation:**

- Maintain 50% SP cap per transaction (ensures 50% cash always)
- Monitor transaction mix weekly
- If >70% SP usage detected → adjust cap to 40% temporarily
- Encourage "Cash Only" listings with priority placement

**Risk 6: Fraud/Abuse (Sell → Buy → Return loops)**

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**

- 3-day SP pending period (prevents instant SP spending)
- Flag users with >3 returns in 30 days
- Manual review for flagged users
- Limit SP earning to 200 SP per transaction
- Ban users with confirmed fraud (no appeals)

### 15.3 Technical Risks

**Risk 7: Infrastructure Costs Exceed Budget**

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**

- Start with free tiers (Supabase, Vercel, Cloudflare)
- Set up billing alerts at 80% of free tier limits
- Optimize database queries and caching aggressively
- Use CDN for all images (reduce bandwidth costs)
- Monitor costs weekly, upgrade only when necessary

**Risk 8: Stripe Account Suspension (SP perceived as currency)**

**Impact:** Critical  
**Likelihood:** Low  
**Mitigation:**

- Clear terms of service: "SP are promotional credits, not currency"
- No cash-out option (closed-loop system)
- Work with Stripe compliance team before launch
- Legal review of SP structure
- Backup payment processor (PayPal, Adyen) if needed

### 15.4 Legal/Regulatory Risks

**Risk 9: Money Transmission Liability (SP treated as currency)**

**Impact:** Critical  
**Likelihood:** Low  
**Mitigation:**

- Legal counsel reviewed SP model (closed-loop exemption)
- Terms of service explicitly state "no cash value"
- No transfers between users (SP earned/spent with platform only)
- 3-day contingent earning (SP can be cancelled)
- Subscription-gated access (benefit, not payment)

**Risk 10: App Store Rejection (IAP policy violation)**

**Impact:** High  
**Likelihood:** Low  
**Mitigation:**

- Use Stripe for subscriptions (allowed per App Store guidelines)
- Physical goods transactions exempt from IAP rules
- SP used for physical goods only (not digital content)
- Pre-launch review with Apple/Google app review teams

### 15.5 Market Risks

**Risk 11: Competitive Response (Facebook/Mercari copies model)**

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**

- Move fast (launch before competitors notice)
- Build geographic moats (first-mover advantage per node)
- Focus on trust & safety (our differentiator)
- Patent SP system mechanics (if possible)
- Build strong brand loyalty early

**Risk 12: Low Node Density (Not enough users per ZIP code)**

**Impact:** High  
**Likelihood:** Medium  
**Mitigation:**

- Start with high-density, affluent areas (Norwalk, CT)
- Expand node boundaries if needed (county vs. ZIP)
- Cross-promote between adjacent nodes (e.g., Norwalk ↔ Westport)
- Offer delivery to expand effective radius

---

## 16. Timeline & Milestones

### 16.1 Development Timeline

**Phase 0: Pre-Development (Weeks 1-2)**

- Finalize requirements (this BRD)
- Legal review (SP structure, terms of service)
- Finalize design mockups
- Set up infrastructure (Supabase, Stripe, Twilio accounts)

**Phase 1: MVP Development (Weeks 3-10)**

| Week | Milestone                  | Deliverables                                                    |
| ---- | -------------------------- | --------------------------------------------------------------- |
| 3-4  | **User Auth & Onboarding** | Signup, phone verification, child profiles, subscription choice |
| 5-6  | **Listing Creation**       | Photo upload, AI analysis, pricing, payment preferences         |
| 7    | **Browse & Discovery**     | Swipe interface, search, filters                                |
| 8    | **SP System (Core)**       | SP wallet, earning logic, spending logic, pending release       |
| 9    | **Transaction Processing** | Stripe integration, purchase flow, seller notifications         |
| 10   | **Testing & Bug Fixes**    | QA, E2E tests, performance optimization                         |

**Phase 2: Beta Launch (Weeks 11-12)**

- Soft launch to 50 users
- Manual onboarding
- Monitor bugs, collect feedback
- Iterate on UX pain points

**Phase 3: Public Launch (Week 13)**

- Open to all users in Norwalk, CT + Little Falls, NJ
- PR push, paid ads
- Goal: 500 users by end of Q1 2026

### 16.2 Post-Launch Roadmap

**Q2 2026: Optimize & Scale**

- Improve SP onboarding based on user feedback
- A/B test subscription pricing
- Launch referral program
- Add messaging enhancements (photo sharing, voice notes)
- Goal: 500 → 1,200 users

**Q3 2026: Feature Expansion**

- Bundling tools (easier multi-item listings)
- Enhanced search (AI-powered recommendations)
- Delivery partnerships (Uber, DoorDash)
- In-app wallet (store cash balance, not just SP)
- Goal: 1,200 → 3,000 users

**Q4 2026: Node Expansion**

- Launch 3 new nodes (Westport, Montclair, Greenwich)
- Hire customer support team
- Build seller analytics dashboard
- Add "saved searches" and price alerts
- Goal: 3,000 → 7,000 users

**2027: Scale & Profitability**

- Expand to 10 total nodes
- Achieve profitability per node
- Prepare for Series A fundraising
- Goal: 7,000 → 50,000 users

---

## 17. Appendix

### 17.1 Free vs. Subscriber Feature Comparison (Detailed)

| Feature                    | Free User                      | Kids Club+ Subscriber                       |
| -------------------------- | ------------------------------ | ------------------------------------------- |
| **Marketplace Access**     | ✅ Full browse/search          | ✅ Full browse/search + 30 min early access |
| **Create Listings**        | ✅ Cash only                   | ✅ Cash Only / Accept SP / Donate           |
| **Buy Items (Cash)**       | ✅ Yes                         | ✅ Yes                                      |
| **Buy Items (with SP)**    | ❌ Locked                      | ✅ Yes (up to 50% discount)                 |
| **Transaction Fee**        | ❌ $2.99                       | ✅ $0.99 (save $2!)                         |
| **Earn SP on Sales**       | ❌ Locked                      | ✅ ~25% of sale price                       |
| **Receive SP from Buyers** | ❌ Locked                      | ✅ Immediate to wallet                      |
| **Spend SP**               | ❌ Locked                      | ✅ 1 SP = $1 discount                       |
| **SP Wallet**              | ❌ Hidden                      | ✅ Available + Pending balances             |
| **Donate Items**           | ❌ Locked                      | ✅ Yes, earn badges                         |
| **Badges**                 | ✅ Basic (New Member, Trusted) | ✅ All badges including donation badges     |
| **Priority Matching**      | ❌ Standard algorithm          | ✅ Priority in feed                         |
| **Early Access**           | ❌ Standard                    | ✅ See new listings 30 min early            |
| **Customer Support**       | ✅ Email (48h response)        | ✅ Priority email (24h response)            |
| **Referral Bonuses**       | ✅ $5 cash credit              | ✅ 25 SP (referrer) + 10 SP (referee)       |
| **Monthly Cost**           | 💰 $0                          | 💰 $7.99 (30-day free trial)                |

### 17.2 SP Success Metrics Summary

| Metric                           | Target     | Red Flag     | Action if Red Flag                            |
| -------------------------------- | ---------- | ------------ | --------------------------------------------- |
| **Free → Paid Conversion**       | 25-35%     | <20%         | Improve value prop, extend trial, lower price |
| **Subscription Retention (90d)** | 60%+       | <50%         | Enhance SP value, add loyalty bonuses         |
| **SP Circulation Rate (90d)**    | 50%+       | <40%         | Add expiration pressure, create SP sinks      |
| **SP Transaction Mix**           | 40-60%     | <30% or >80% | Adjust earning formula or redemption cap      |
| **Listings Accepting SP**        | 50-60%     | <40%         | Educate sellers on benefits, add incentives   |
| **SP Confusion Support Tickets** | <5%        | >10%         | Simplify UX, improve onboarding               |
| **Avg SP Balance per User**      | 100-150 SP | >200 SP      | Users hoarding; add expiration or bonuses     |
| **Subscriber Churn Due to SP**   | <2%        | >5%          | Major UX/value prop issues; fix immediately   |

### 17.3 Example User Scenarios

**Scenario 1: Free User Journey**

```
Sarah is a mom with two kids (2T, 4T). She signs up for the free tier.

Day 1: Browses 20 listings, likes 5 items
Day 3: Buys a $25 coat (pays $27.99 total with $2.99 fee)
  → Sees prompt: "Kids Club+ members save $2 on fees!"
Day 7: Lists 3 items (all cash only, total $60 value)
  → Sees prompt: "You could earn ~15 SP with Kids Club+!"
Day 14: Sells 1 item for $20 (receives $19 after 5% fee)
  → Sees prompt: "Upgrade to earn SP + cash!"
Day 21: Buys another item marked "Accepts SP" for $30
  → Sees: "Kids Club+ members can use SP for up to $15 discount!"
Day 30: Clicks "Learn More" → Sees value prop → Upgrades to trial
```

**Scenario 2: Subscriber Journey**

```
Jessica is a mom with three kids (12M, 3T, 6). She signs up for Kids Club+ trial.

Day 1: Completes onboarding, sees SP wallet (0 SP)
Day 2: Lists stroller ($100, "Accept SP")
  → Sees: "You may earn ~38 SP when this sells"
Day 5: Stroller sells!
  - Buyer paid 50 SP + $50 cash
  - Jessica receives:
    - 50 SP (available immediately)
    - 38 SP (pending 3 days)
    - $50.49 cash (50 + 0.99 fee - 5% seller fee)
Day 8: Pending SP released → Total: 88 SP available
Day 10: Buys bike for $50 marked "Accept SP"
  - Uses 25 SP + $25.99 cash = Total $25.99 (saves $24!)
Day 15: SP balance: 63 SP
Day 23: Notification: "Trial ends in 7 days. Add payment to keep your 63 SP!"
Day 30: Adds payment method → Converts to paid subscriber
Month 2: Continues selling/buying cycle, builds SP balance to 150 SP
Month 3: Retention secure due to SP value locked in wallet
```

---

## END OF DOCUMENT

**Total Pages:** 52  
**Version:** 2.0  
**Status:** Final - Ready for Review  
**Next Steps:**

1. Legal review (SP structure, terms of service)
2. Engineering review (technical feasibility, timeline)
3. Financial modeling validation (LTV, CAC, break-even)
4. Stakeholder approval
5. Begin development (Phase 1)

---

**Change Log:**

- **v2.0 (Dec 5, 2025):** Complete rewrite for subscription-gated SP model
  - Added dual-tier model (Free vs. Kids Club+)
  - Rewrote revenue model (subscriptions now 72% of revenue)
  - Added SP success metrics
  - Updated user stories for free/subscriber journeys
  - Added risks specific to SP system
  - Updated launch strategy with SP positioning
- **v1.0 (Dec 2, 2025):** Initial version with peer-to-peer SP model