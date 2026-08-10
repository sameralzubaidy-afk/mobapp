# Pass it Up — Go-to-Market Plan (Westport, CT Pilot)

**Status:** EXECUTION BIBLE
**Pilot town:** Westport, CT (ZIP 06880)
**Public launch target:** September 1, 2026
**Pilot category:** Kids items only
**Founder posture:** Solo dev, zero existing Westport network
**Brand:** Pass it Up
**Owner of this plan:** Founder
**Last updated:** May 16, 2026

This document is the single executable source of truth for taking Pass it Up from "code complete" to a Westport-launched marketplace with real subscribers. It is structured to be read in order during execution.

If a section references an open decision, it is flagged with `⚠️ DECISION NEEDED`. Everything else is locked.

---

## 0. How To Use This Document

1. **Phase 0 (now → June 1):** Complete every box in §3 Legal & Business Prerequisites and §4 Business Infrastructure Checklist. Do not move to Phase 1 until §3 and §4 are 100% checked.
2. **Phase 1 (June 1 → July 1):** Hire the Founding Community Lead (§7) and run pricing validation (§9.1).
3. **Phase 2 (July 1 → August 31):** Execute the cold-start tactics (§8) and pre-launch playbook (§11).
4. **Phase 3 (September 1):** Public launch.
5. **Phase 4 (September → December):** Post-launch growth, annual plan rollout (month 3), iteration against §13 success metrics.

Re-read §12 Risk Register weekly. Re-read §2 Confirmed Decisions before any meeting where someone proposes a change.

### 0.1 Execution Standard

Every item in this plan should be executed with four fields:

| Field | Required answer |
|---|---|
| Owner | Founder, Founding Community Lead, CPA, lawyer, or contractor |
| Due date | Calendar date, not "soon" |
| Acceptance criteria | What must be true for this to count as done |
| Evidence | Link, screenshot, receipt, signed PDF, spreadsheet, dashboard, or shipped feature |

If any task lacks these four fields, it is not execution-ready. Put it in the weekly review and convert it into a proper task before work starts.

### 0.2 Weekly Command Center

Create one operating board in Notion, Linear, or ClickUp with these columns:

| Column | Meaning |
|---|---|
| Backlog | Not ready, needs definition |
| Ready This Week | Has owner, due date, acceptance criteria |
| In Progress | Being actively worked |
| Blocked | Waiting on person, vendor, legal, app build, or money |
| Done | Evidence attached |

Monday 8:00am: choose the week's tasks. Friday 4:00pm: review what shipped, what blocked, and what moves forward. If a task is not visible on this board, it does not exist operationally.

### 0.3 No-Assumption Rule

This plan intentionally avoids guessing on items only you can answer. Anything marked `⚠️ DECISION NEEDED` must be confirmed by you before spending money, signing an agreement, publishing a public claim, or changing product behavior.

### 0.4 Remaining Founder Decisions

Only three decisions remain open because they depend on product/legal setup facts that were not confirmed in the chat. Everything else has a recommended path.

| Decision | Recommendation | Needed by | Why it matters |
|---|---|---|---|
| Legal entity name | **Pass it Up LLC** unless trademark/domain check creates a conflict | May 18 | Needed for formation, bank, Stripe, Apple, Google |
| Seller payouts at launch | **Stripe Connect payouts in scope** if current app supports it; otherwise controlled beta with off-platform seller payment only if lawyer approves | May 26 | Changes ToS, Stripe setup, app-store review, and support burden |
| Lead commission basis | **Net subscription revenue after platform/payment fees** | Jun 10 | Must be in bonus addendum before any paid trial |

Do not leave these ambiguous. They create legal or financial confusion later.

---

## 1. Executive Summary

**Pass it Up** is a hyper-local, kids-focused, subscription + Swap Points (SP) marketplace launching in Westport, CT on **September 1, 2026**. The pilot is intentionally narrow: one town, one category, one local trust anchor.

**Three things make this plan win:**

1. **Trust beats reach.** Westport is 28K people. We do not need a Facebook-Marketplace-scale audience; we need ~300 active sellers and ~1,000 active buyers in one ZIP. A local trust anchor (the Founding Community Lead) plus three execution-grade cold-start tactics are sufficient.
2. **Real supply only.** No fake accounts. Supply comes from (a) Founder-seeded inventory ("Founder's Closet"), (b) Seller Bootcamps, (c) charity Donation Drives. Demand follows real listings.
3. **Disciplined economics.** $2,500–3,000/month operating cap. SP used as activation fuel, not perpetual subsidy. Annual plan introduced at month 3 only after monthly value is proven.

**What "success" looks like at 12 months:**
- 500 paying monthly subscribers ($7.99) in Westport
- 200 active sellers, 1,000 active buyers, 2,000 listings
- MRR ≥$4,000, gross margin ≥70%
- NPS ≥50, organic referral share ≥30% of signups
- A clean operating template ready to clone in town #2 in 2027

### 1.1 Strategy In One Page

| Question | Answer |
|---|---|
| Who is the wedge customer? | Westport parents with kids age 2-10 who have unused kids items and already trade, donate, or resell locally |
| What pain are we solving first? | Too much kids clutter, low trust on broad marketplaces, and the hassle of listing / coordinating locally |
| Why Westport first? | High household income, dense parent networks, sustainability-friendly culture, and strong local identity |
| Why not broad launch? | Marketplace density matters more than geographic reach; broad launch creates an empty-marketplace problem everywhere |
| Why subscription? | Filters serious users, funds trust and moderation, and makes the marketplace feel curated rather than chaotic |
| Why SP? | Creates activation, loyalty, and seller motivation without racing to cash discounts |
| Why local lead? | Founder is 100% cold in Westport; trust must be borrowed through a respected local operator |

### 1.2 Go / No-Go Launch Gates

Do not publicly launch on September 1 unless these are true by August 25:

| Gate | Minimum threshold | If not met |
|---|---|---|
| App stability | No blocker bugs in listing, checkout, subscription, payout, messaging, or login | Delay public launch or cut non-core features |
| App Store status | iOS approved and Android approved / ready | Launch only if both stores are approved or explicitly choose iOS-only beta |
| Supply | 150 approved live listings | Run emergency listing party + Founder's Closet push |
| Sellers | 40 active sellers with at least 1 live listing | Delay paid buyer acquisition |
| Buyer waitlist | 200 local parents reachable by email/SMS/social | Increase community outreach; do not spend on broad ads yet |
| Legal | LLC, EIN, ToS, Privacy Policy, AUP, insurance, Stripe business account complete | Do not collect payments or onboard sellers |
| Support | Support email, refund process, dispute workflow, moderation workflow ready | Do not launch paid subscriptions |

The launch date is important, but launching an empty or legally unprepared marketplace would do more damage than a short delay.

---

## 2. Confirmed Decisions (Locked — Do Not Re-Litigate)

Source: [WESTPORT-GTM-CONTEXT-AND-DECISIONS.md](WESTPORT-GTM-CONTEXT-AND-DECISIONS.md).

| Area | Decision |
|---|---|
| Pilot town | Westport, CT (ZIP 06880) |
| Category | Kids items only at launch |
| Launch date | September 1, 2026 |
| Subscription | $7.99/month; **annual plan $79/year introduced at month 3** |
| Fake supply | Rejected — real supply only |
| Founding Member perks | First 50 users earn: free 6-month subscription + badge + 50 SP (must complete a qualifying action — see §10.2) |
| Founding Community Lead title | **Founding Community Lead** |
| Founding Community Lead comp | $500/mo base + 20% MRR commission + $25/sub bonus (after 90-day retention) + milestone bonuses + Year-1 retention bonus + **Year-2 $10K loyalty bonus** (no equity) |
| Hire timing | ~July 1, 2026 (when beta is ready) |
| Trial period | 30-day paid trial for all candidates |
| Hiring channels | LinkedIn + Indeed + Nextdoor in parallel for 2 weeks; **professionally-written Facebook group post added** if those 3 yield <5 strong candidates |
| Monthly budget cap | $2,500–3,000 |
| Top 3 cold-start tactics | (1) Seller Bootcamp Workshop, (2) Founding Member Early Access, (3) Donation Drive Supply Seeding |
| SP signup/referral | Conservative: signup 15–25 SP (60–90 day expiry); first-listing 10 SP on approval; referral 25–50 SP **paid only after referee's first listing or purchase** |
| Founding Member perks model | **Earned, not auto-claimed** |
| Direct mail | Not a core channel until conversion is proven |

---

## 3. Legal & Business Prerequisites (must be complete by July 1, 2026)

These items must be in place before money moves, the Founding Community Lead is contracted, or any user data is collected.

This section is an operational checklist, not legal advice. Use it to brief a startup lawyer and CPA. Final legal and tax decisions should be confirmed by professionals before filing or signing.

### 3.0 Legal Setup Order Of Operations

| Step | Task | Owner | Due | Acceptance criteria |
|---|---|---|---|---|
| 1 | Choose formation provider | Founder | May 18 | Provider selected: Stripe Atlas, Clerky, Northwest, or lawyer |
| 2 | File Delaware LLC | Founder / provider | May 20 | Certificate of Formation received |
| 3 | Get EIN | Founder | May 21 | IRS EIN confirmation PDF saved |
| 4 | Open bank account | Founder | May 24 | Business checking active |
| 5 | Set up Stripe in LLC name | Founder | May 26 | Live-mode Stripe account approved |
| 6 | Foreign-qualify in CT | Founder / provider | May 30 | CT registration confirmation received |
| 7 | Draft ToS / Privacy / AUP | Lawyer or Termly + lawyer review | Jun 5 | Public URLs live |
| 8 | Contractor agreement package | Lawyer / founder | Jun 10 | Ready before candidate trial starts |
| 9 | Insurance quotes | Founder | Jul 15 | GL + cyber quote selected |
| 10 | App Store legal forms | Founder | Aug 1 | Apple privacy label + Google data safety complete |

### 3.1 Legal Entity

- [ ] **Form a Delaware LLC.** File via Delaware Division of Corporations or a service (Stripe Atlas $500 all-in, or Northwest Registered Agent ~$225 + $90 state fee). Single-member LLC, default tax classification.
- [ ] **Foreign-qualify the Delaware LLC in Connecticut.** File a Foreign Registration Statement with CT Secretary of State (~$120). Required because you operate from CT.
- [ ] **Appoint a Registered Agent in DE and in CT.** Use the formation service ($125/yr DE, $50–150/yr CT).
- [ ] **Operating Agreement.** Even as single-member, draft and sign one. Free templates at LegalZoom; better template via Clerky if you anticipate investors.
- [ ] **Obtain an EIN from the IRS** (free, online, 10 minutes at irs.gov).
- [ ] **CT Tax Registration (REG-1).** Required for sales tax collection and CT-specific filings.
- [ ] **DBA (optional).** Register "Pass it Up" as a trade name with the Westport Town Clerk if the LLC is named differently (e.g., "Pass it Up LLC" vs. "PIU Holdings LLC").

**Best recommendation:** Use a reputable formation provider for speed, but have a Connecticut startup lawyer review the operating agreement, marketplace ToS, privacy policy, and contractor agreement before beta. The legal risk is less about LLC filing and more about marketplace liability, recalled products, user payments, and contractor bonus terms.

⚠️ DECISION NEEDED: confirm whether the legal entity name should be exactly **Pass it Up LLC** or a holding-company name with "Pass it Up" as DBA.

### 3.2 Banking & Payments

- [ ] **Open business checking account** (Mercury or Relay recommended — free, no min, fast — or local Connecticut bank if you need cash deposits). Requires EIN + LLC formation docs.
- [ ] **Open business credit card** (Brex, Ramp, or Chase Ink). Used for all marketing spend, separates personal/business expenses, builds credit.
- [ ] **Stripe account in LLC name** with Connect Standard or Express enabled (peer-to-peer payments + subscriptions + payouts to sellers).
- [ ] **Stripe tax** enabled or external sales-tax tool (TaxJar) — CT charges 6.35% on most tangible goods, but **casual/occasional sales by individuals are generally exempt**; marketplace facilitator law may shift collection burden to the platform once volume crosses $250K in CT sales. Add as a known future trigger; not blocking at launch.
- [ ] **Plaid + bank verification** for seller payouts.

**Payment acceptance criteria:**
- Founder can create a paid subscription in test mode and live mode.
- Founder can process a $1 test transaction, issue a refund, and see the refund in Stripe.
- Seller payout workflow is documented even if payouts are disabled until beta.
- Stripe webhook logs are monitored in production before beta users transact.

⚠️ DECISION NEEDED: confirm whether seller payouts are in scope for September 1 or whether launch can start with buyer/seller coordination and seller-paid-off-platform during a controlled beta. My recommendation is **Stripe Connect payouts in scope** if the app already supports it; otherwise launch risk rises.

### 3.3 Intellectual Property

- [ ] **Domain:** secure `passitup.com`, `passitup.app`, `passitupkids.com` (registrar: Namecheap or Cloudflare; budget $50–500 if `.com` requires purchase from existing holder — check first).
- [ ] **Social handles:** reserve `@passitupapp` (or chosen variant) on Instagram, Facebook, TikTok, Nextdoor business, LinkedIn company page, X.
- [ ] **Trademark search:** USPTO TESS database — confirm "Pass it Up" is not already registered for marketplace / mobile software (class 035 and 042). Free.
- [ ] **Trademark filing (recommended, not blocking for launch):** File Intent-to-Use application via USPTO ($350/class) or LegalZoom ($699 + fees). Defensive against copycats once you have traction.
- [ ] **Logo & wordmark:** finalize before any marketing spend (Fiverr/99designs $200–500 or hire a Westport-based designer to build local goodwill).

### 3.4 Platform Compliance Docs

These three documents must exist on the website **before** beta users sign up and **before** App Store submission.

- [ ] **Terms of Service** — covers user accounts, marketplace rules, prohibited items, SP terms (non-redeemable for cash, can expire, can be revoked for fraud), subscription billing, refund policy, dispute resolution, arbitration clause, governing law (Delaware), limitation of liability. Use Termly ($10–39/mo) or hire a startup lawyer ($800–1,500 one-time, recommended given marketplace complexity).
- [ ] **Privacy Policy** — GDPR-light, **CCPA/CPRA-aware** (CT residents have CTDPA rights since July 2023), data we collect, how we use it, third-party processors (Stripe, Supabase, analytics), data retention, deletion requests, contact email.
- [ ] **Acceptable Use / Community Guidelines** — what items can be listed (kids items, no firearms, no recalled products, no infant car seats older than 6 years, no drop-side cribs, no helmets), prohibited behavior, dispute process.

**Required policy pages and links:**

| Page | Public URL pattern | Must be linked from |
|---|---|---|
| Terms of Service | `/terms` | Website footer, signup, App Store metadata |
| Privacy Policy | `/privacy` | Website footer, signup, App Store metadata |
| Community Guidelines | `/guidelines` | Website footer, listing flow, help center |
| Refund Policy | `/refunds` | Paywall, checkout, support auto-reply |
| Seller Payout Policy | `/seller-payouts` | Seller onboarding, ToS |
| Recalled Product Policy | `/recalls` | Listing flow, help center |

**Recommended legal-doc workflow:**
1. Generate first draft with Termly or iubenda.
2. Add marketplace-specific clauses manually: SP, user-generated listings, recalled goods, disputes, off-platform conduct, seller payouts.
3. Pay a startup lawyer for a 2-hour review.
4. Freeze docs before beta. Only update with version date and changelog after launch.

### 3.5 Marketplace-Specific Legal Considerations

- [ ] **CPSC recalled-products check.** Kids items are heavily regulated. Auto-block listings matching CPSC recall keywords (drop-side cribs, certain bath seats, etc.) — add to moderation rules. List of categories: cpsc.gov/Recalls.
- [x] **Age gate (N4, 2026-08-09).** App is **18+ only** — no user under 18 may register (hard gate, client + server; reverses the 2026-06-20 COPPA deprecation). Update ToS and the App Store age rating (17+/18+) to match.
- [ ] **Marketplace seller tax reporting.** Stripe will issue 1099-K to sellers exceeding the federal threshold ($5,000 in 2024, dropping to $600). Disclose this in ToS.
- [ ] **Insurance:**
  - General Liability + Cyber Liability via Next Insurance or Hiscox (~$50–100/mo). Defensive against user injury claims tied to listed items.
  - Errors & Omissions (skip for Year 1, revisit if revenue >$50K).
- [ ] **App Store legal:** Apple and Google both require privacy policy URL, support email, and app-specific data collection disclosures (Apple "Privacy Nutrition Label", Google "Data safety form"). Pre-fill these forms before submission.

**Moderation rules to implement before beta:**

| Rule | App behavior |
|---|---|
| Recalled-product keywords | Listing goes to manual review |
| Car seats | Require manufacture date, expiration date, accident-free attestation; default manual review |
| Cribs / sleep products | Manual review; block known unsafe categories |
| Helmets | Block sale unless policy explicitly allows with disclaimers; recommended: block |
| Medicine / formula / food | Block |
| Strollers / high chairs | Require condition checklist + photo of model label |
| User reports listing | Hide after 2 reports until reviewed |

**Support and dispute requirement:** every listing, transaction, user profile, and message thread needs a "Report" path before public launch.

### 3.6 Founding Community Lead Contract Package

Before any paid trial starts, prepare a signed contractor package. This protects you and prevents bonus misunderstandings.

| Document | Required clauses |
|---|---|
| Independent Contractor Agreement | Scope, hours expectation, pay, expense approval, termination, no authority to bind company |
| Bonus Addendum | Exact definitions for recruited subscriber, 90-day retention, MRR commission, milestones, Year-1 retention bonus, Year-2 loyalty bonus |
| Confidentiality Agreement | Non-public product, pricing, customer data, launch strategy |
| IP Assignment | Any copy, playbooks, contacts spreadsheets, event materials created for Pass it Up are company property |
| W-9 | Required before first payment |
| Background / reference check consent | Optional but recommended because role interacts with families |

**Classification pushback:** do not manage this person like a full employee while paying as a contractor. If you set fixed hours, control methods, and make her core ongoing labor, ask CPA/lawyer whether she should be W-2. Misclassification is a real risk.

### 3.7 App Store / Distribution Accounts

- [ ] **Apple Developer Program** enrollment in LLC name ($99/yr). LLC must have a verified D-U-N-S number first (free, takes 1–5 business days via Dun & Bradstreet).
- [ ] **Google Play Console** account in LLC name ($25 one-time).
- [ ] **TestFlight** beta tester capacity confirmed (up to 10,000 external testers — plenty for the 100-person Westport beta).
- [ ] **Submit to App Store 4 weeks before launch** (Aug 4) to allow for review/rejection cycles.

### 3.8 Compliance Calendar (recurring)

| Item | Frequency | Owner |
|---|---|---|
| DE Franchise Tax + Annual Report | Annual ($300 + $50) | Founder |
| CT Annual Report | Annual ($80) | Founder |
| Federal & CT taxes | Quarterly estimates + annual | CPA (hire one) |
| Stripe 1099-K issuance | Annual (January) | Stripe |
| ToS / Privacy Policy review | Annual | Lawyer |
| Trademark renewal | Year 5 then every 10 | Founder |

---

## 4. Business Infrastructure Checklist (already in place — confirm)

You said this is largely set up; confirm each line. Mark anything missing and complete before June 1.

| Item | Deadline | Acceptance criteria |
|---|---|---|
| Personal banking separate from business | May 24 | No Pass it Up transaction touches a personal account after LLC bank account opens |
| Business email | May 24 | `founder@passitup.com` or final domain email active; aliases: support@, legal@, press@ |
| Project management tool | May 20 | One board created with columns from §0.2; no parallel task tracking elsewhere |
| Calendly or similar | May 24 | Hiring interview link live with 15-min screen and 45-min interview options |
| Loom / screen recording | May 24 | Founder can record product demo for applicants, partners, and beta users |
| Password manager | May 24 | 1Password vault created; no credentials stored in notes, email, or browser-only save |
| Bookkeeping tool | May 30 | Wave, QuickBooks, or Bench account active; chart of accounts created |
| CPA shortlist | Jun 7 | 2 Connecticut startup CPAs identified; one intro call scheduled |
| Backups | Jun 1 | GitHub protected; Supabase PITR or daily backups enabled; legal docs stored encrypted |
| Support inbox | Jun 15 | `support@...` routes to founder; canned replies for refund, bug, safety, payout, account deletion |
| Analytics | Jul 1 | Event tracking for signup, listing created, listing approved, purchase, subscription, referral, SP earned, SP spent |

### 4.1 Support Operating Rules

| Request type | SLA | Owner | Required response |
|---|---|---|---|
| Payment / refund | 1 business day | Founder | Acknowledge, inspect Stripe, resolve or explain next step |
| Safety / recalled item | Same day | Founder | Hide listing immediately, investigate, document outcome |
| Bug blocking transaction | 24 hours | Founder | Triage, add to hotfix queue, update user |
| General question | 2 business days | Founder / lead | Answer or link help doc |
| Account deletion | 7 days | Founder | Confirm identity, delete/anonymize where legally allowed |

### 4.2 Minimum Help Center Before Beta

Create 8 short help articles before August 1:

- How Pass it Up works
- What are Swap Points?
- How to list an item
- What items are not allowed
- How subscriptions and trials work
- How refunds work
- How seller payouts work
- How to report a listing or user

---

## 5. Brand Setup (Pass it Up)

### 5.1 Identity
- **Name:** Pass it Up
- **Tagline (working — A/B test in beta):**
  - A. "Pass it up to a neighbor. Make space. Make money."
  - B. "Kid stuff, neighbor to neighbor."
  - C. "The Westport closet swap."
- **Color / tone:** warm, neighborly, slightly nostalgic. NOT eco-preachy. NOT generic-marketplace-grey.

**Best recommendation:** start with tagline B in product surfaces because it is clearest. Use tagline A in marketing copy because it carries the emotional benefit. Avoid tagline C as the primary tagline because it may sound too Westport-specific when you expand.

### 5.1.1 Messaging Pillars

| Pillar | Use when | Example copy |
|---|---|---|
| Declutter | Seller-facing | "Clear the playroom without sending good stuff to the basement." |
| Neighbor trust | Buyer-facing | "Buy kids' things from nearby parents, not anonymous strangers." |
| Value recovery | Subscription / seller | "Turn outgrown gear into cash, points, and more space." |
| Local pride | Westport launch | "Built first for Westport families." |
| Safety | Trust / legal | "Kids items reviewed with clear community rules." |

### 5.1.2 Words To Use / Avoid

| Use | Avoid |
|---|---|
| parent, neighbor, local, kids gear, outgrown, trusted, closet, pass it up | cheap, bargain bin, thrift, waste, save the planet, hustle, arbitrage, marketplace for everything |

The brand should feel practical and neighborly, not preachy or too polished. Westport parents should feel this was made by someone who understands their actual clutter and logistics.

### 5.1.3 Core Message Library

Use these as default copy blocks across the website, app store, flyers, and posts.

**One-line description:**
```text
Pass it Up is a Westport-first marketplace for parents to buy and sell kids' items with neighbors they can trust.
```

**Short pitch:**
```text
Kids outgrow everything fast. Pass it Up helps Westport parents clear out good gear, find useful things nearby, and keep trusted kids items moving through the neighborhood.
```

**Why not Facebook Marketplace:**
```text
Facebook Marketplace is broad and noisy. Pass it Up starts with one town, one category, and clear community rules so parents can find kids items faster and with more trust.
```

**Why subscription:**
```text
The subscription supports moderation, safer community rules, and a more focused marketplace for parents who are serious about buying and selling locally.
```

**SP explainer:**
```text
Swap Points reward helpful marketplace activity: listing good items, buying locally, and referring parents who actually participate. Points can be used for marketplace perks like listing boosts and subscription discounts.
```

**Safety language:**
```text
Pass it Up uses clear listing rules, report flows, and extra review for higher-risk kids categories like car seats, cribs, and strollers.
```

### 5.2 Asset Checklist
- [ ] Logo (primary + monochrome + favicon)
- [ ] App icon (1024×1024 + adaptive Android variants)
- [ ] Splash screen
- [ ] Marketing one-pager PDF (for partnerships)
- [ ] Pitch deck (10 slides, for retail / school partnership conversations)
- [ ] Social profile banners (5 platforms)
- [ ] Email signature template
- [ ] Business cards (200 — yes still relevant for in-person Westport meetings)

**Acceptance criteria for brand assets:**
- Logo is readable at 32px.
- App icon is recognizable without text.
- One-pager can be understood in 30 seconds by a preschool director.
- Pitch deck includes: problem, why Westport, how it works, safety, partner benefit, launch timeline, ask, contact.
- Business card includes QR code to waitlist, not just email.

### 5.2.1 One-Pager Outline

Create a one-page PDF before partnership outreach. It should contain:

| Section | Copy / content |
|---|---|
| Header | Pass it Up: Westport kids items, neighbor to neighbor |
| Problem | Parents have too much outgrown kids gear; broad marketplaces are noisy and low-trust |
| Solution | A Westport-first kids marketplace with community rules, local listings, subscriptions, and SP rewards |
| Who it serves | Westport parents with kids age 2-10 |
| Safety | Prohibited-item rules, recalled-product review, report button, moderation |
| Launch timeline | Beta Aug 1, launch Sep 1, first events Aug 8 / Aug 15 / Aug 22 |
| Partner ask | Share with parents, host flyer, co-promote event, refer a community lead candidate |
| Contact | Founder name, email, phone, QR to waitlist |

**Acceptance criteria:** a preschool director can read it in under 60 seconds and understand exactly what you are asking them to do.

### 5.3 Domain & Channel Inventory

| Asset | Status | Owner | Note |
|---|---|---|---|
| passitup.com | TBD | Founder | Check availability week 1 |
| passitup.app | TBD | Founder | Backup if .com unavailable |
| @passitupapp Instagram | TBD | Founder | Westport content focus |
| Facebook Page | TBD | Founder | For ads + group cross-posting |
| TikTok | TBD | Founding Community Lead post-hire | Optional, defer |
| Nextdoor Business Page | TBD | Founder | Critical — Westport-tied |
| LinkedIn Company Page | TBD | Founder | For hiring + B2B partnerships |

---

## 6. Pass it Up Pricing & Subscription Model

| Plan | Price | Available From | Notes |
|---|---|---|---|
| Free | $0 | Day 1 | Browse + buy; limited listings; standard SP earn |
| Monthly | $7.99/mo | Day 1 | Unlimited listings + boosted SP earn |
| Annual | $79/yr | Month 3 (Dec 1, 2026) | Introduced after monthly value proven |
| Founding Member (earned) | Free 6 mo + badge + 50 SP | Day 1, first 50 only | See §10.2 |
| 30-day Trial | Free 30 days | Day 1 | Auto-converts to monthly |

**Revenue model:**
1. Subscriptions (primary)
2. SP marketplace fees (secondary — once economics are stable, take rate ~3–5% on transactions)
3. Sponsored partnerships with local kids' brands / consignment stores (year 2+)

### 6.1 Pricing Test Rules

Do not change price casually. Price changes only happen after one of these signals:

| Signal | Action |
|---|---|
| ≥70% of surveyed target users say $7.99 is acceptable | Keep $7.99 |
| 40–69% say acceptable | Keep $7.99 but improve value communication |
| <40% say acceptable and $4.99 tests materially better | Consider $4.99 intro price for first 3 months only |
| Trial conversion <8% by month 2 | Test onboarding / paywall copy before cutting price |
| Annual conversion <20% in December | Add annual-only bonus, not lower annual price first |

### 6.2 Paywall Copy Draft

Use this as the first product copy unless testing proves otherwise:

```text
Pass it Up Plus
List unlimited kids items, earn more Swap Points, and get early access to local drops.

30 days free. Then $7.99/month. Cancel anytime.
```

**Annual plan copy for December:**

```text
Keep passing it up all year.
Get 12 months for $79 and save 17% versus monthly.
```

### 6.3 Refund Policy Recommendation

Use a simple first-year refund stance: refund the most recent month if a user asks within 7 days of billing and has not abused the system. This is cheaper than arguing with early users and protects local goodwill.

---

## 7. Founding Community Lead — Complete Role Package

### 7.1 Role Summary

**Title:** Founding Community Lead — Westport
**Reports to:** Founder
**Hours:** 20–30/week
**Start:** July 1, 2026 (or earlier if right candidate found)
**First 30 days:** Paid trial period
**Location:** Must live in Westport, CT (or 5-mile radius) for ≥2 years

### 7.2 Compensation (CONFIRMED — No Equity)

| Component | Amount | Trigger |
|---|---|---|
| Base salary | $500 / month | Monthly, ongoing |
| MRR commission | 20% of MRR from subscribers she recruited | First 12 months only |
| Subscriber bonus | $25 per subscriber | Paid after subscriber's 90-day retention |
| Milestone bonus | $500 / $1,000 / $2,500 | At 100 / 250 / 500 subs respectively |
| Year-1 retention bonus | $2,000–$5,000 | Paid Sep 1, 2027 if Westport hits Year-1 targets |
| **Year-2 loyalty bonus** | **$10,000 lump** | Paid Sep 1, 2028 if she stays 24 months AND Westport hits Year-2 targets |
| Equity | **NONE** | — |

Illustrative Year-1 take-home if she executes well: ~$18K. Year-2 stretch with loyalty bonus: ~$30K+.

### 7.2.1 Bonus Definitions (must be copied into contract addendum)

| Term | Definition |
|---|---|
| Recruited subscriber | User who enters her referral code, appears on her tracked invite list, or is manually attributed by founder before signup |
| Qualified subscriber | Recruited subscriber who remains paid after 90 days and has not been refunded |
| MRR commission | 20% of subscription MRR from recruited subscribers, excluding refunds, taxes, App Store fees if applicable, and fraud reversals |
| Milestone subscriber count | Number of qualified subscribers, not raw signups |
| Year-1 target | Must be defined before offer letter is signed; recommended: 500 paying subscribers and NPS ≥50 by Sep 1, 2027 |
| Year-2 target | Must be defined before offer letter is signed; recommended: Westport MRR ≥$8K and churn <4% monthly by Sep 1, 2028 |

⚠️ DECISION NEEDED: confirm whether commission is calculated on gross subscription revenue or net revenue after App Store / Stripe fees. My recommendation: **net revenue after platform/payment fees** to avoid paying commission on money you do not keep.

### 7.3 Hiring Scorecard

**Must-haves (all required — hard gate):**

| Criterion | How to verify |
|---|---|
| Lives in Westport ≥2 years | Driver's license + utility bill |
| Has kids age 2–10 | Self-disclosed in interview |
| Active in ≥2 local communities (PTA, preschool board, sports team, religious community, yoga studio) | Provide names + 1 reference per community |
| **Can name 20+ local parent contacts unprompted in interview** | Ask in-interview, time-boxed 5 minutes |
| Strong written communicator | Writing sample: 200-word post promoting a fictional swap event |
| Tech-comfortable | Can navigate iOS, install TestFlight, take screenshots, send Loom |
| Commits ≥12 months | Verbal + in offer letter |
| Available 20–30 hrs/week | Confirms childcare and other commitments |

**Nice-to-haves:**

- PTA leadership / volunteer coordinator / event organizer track record
- Existing Instagram or Facebook following ≥500 (local moms)
- Prior selling on Poshmark / Mercari / FB Marketplace
- Marketing or community-management background
- Known locally as a "sustainability advocate" or "the connector"

### 7.4 Sourcing Channels (Parallel 2-Week Test → Concentrate)

**Week 1–2 (parallel, all 3):**

| Channel | Search/Posting Detail |
|---|---|
| LinkedIn | Search: "Westport CT" + ("Community Manager" OR "Event Coordinator" OR "Marketing" OR "PTA"). Send 20 personalized InMails. Post on personal profile + company page. |
| Indeed | Sponsored job post (~$5/day budget). Title: "Founding Community Lead — Westport Kids Marketplace". |
| Nextdoor | Post in Westport neighborhood feed (free). Use the script in §7.6. |

**Week 3 (if <5 strong candidates from above):**

| Channel | Notes |
|---|---|
| Facebook groups: "Westport Moms", "Westport Parents Network", "06880 Connections" | Use the professional FB group script in §7.6.B. Post once, do not spam. |
| Pediatrician referrals | Email 3 Westport pediatric practices with the one-pager. Ask office managers if any of their moms might be interested. |
| Library community board | Print 10 flyers, post at Westport Library, Earthplace, Wakeman Town Farm. |

### 7.4.1 Daily Sourcing Checklist

For the first 10 sourcing days:

- [ ] Send 2 personalized LinkedIn messages per day (20 total)
- [ ] Review Indeed applicants daily; respond within 24 hours to strong candidates
- [ ] Post once on Nextdoor, then reply thoughtfully to every comment within 12 hours
- [ ] Add every lead to candidate tracker with source, stage, notes, and next step
- [ ] Schedule screens immediately; do not let strong candidates sit uncontacted

### 7.4.2 Candidate Tracker Fields

| Field | Required? |
|---|---|
| Name | Yes |
| Source | Yes |
| Town / years in Westport | Yes |
| Kids age range | Yes |
| Communities active in | Yes |
| 20-name test score | Yes |
| Writing sample score | Yes |
| Reference names | Yes |
| Availability | Yes |
| Compensation expectations | Yes |
| Stage | Yes |
| Red flags | Yes |
| Next action + date | Yes |

### 7.4.3 Outreach Scripts For Sourcing Candidates

#### LinkedIn InMail

```text
Hi [Name] — I'm launching Pass it Up, a Westport-first marketplace for parents
to buy/sell kids items locally. I'm looking for a part-time Founding Community
Lead: someone deeply connected with Westport parents who can help build the
seller community before our September launch.

Your background in [specific detail] caught my eye. This is paid, flexible,
and performance-based, with no equity or MLM structure. Would you be open to a
15-minute conversation this week?
```

#### Warm Referral Ask

```text
I'm looking for one person in Westport who is the parent everyone knows — the
organizer, connector, PTA / preschool / sports-network person. Paid part-time
role, launching a local kids marketplace in September. Who would you trust to
represent something new to Westport parents?
```

#### Pediatrician / Local Office Email

```text
Subject: Paid local role for a connected Westport parent

Hi [Name],

I'm launching Pass it Up, a Westport-first marketplace for parents to buy and
sell kids items locally. I'm hiring a paid part-time Founding Community Lead —
someone already trusted by local parents who can help organize events and
introduce the marketplace to families.

If anyone in your parent community comes to mind, I would be grateful for an
introduction. I can send a one-page summary if helpful.

Best,
Samer
```

### 7.5 Recruitment Funnel Targets

| Stage | Target |
|---|---|
| Total inbound / sourced leads | 30 |
| Phone screens (15 min) | 12 |
| First interviews (45 min, video) | 6 |
| Trial project candidates | 3 |
| Hire | 1 |

**Backup plan:** keep ranks #2 and #3 warm with a small honorarium ($100 each) for 60-day "second-look" availability in case primary hire doesn't work out in the 30-day trial.

### 7.6 Job Post Templates

#### 7.6.A LinkedIn / Indeed (professional)

```
Founding Community Lead — Westport Kids Marketplace
Pass it Up · Westport, CT · Part-time (20–30 hrs/week) · Hybrid

About Pass it Up
We are launching a hyper-local marketplace in Westport for parents to buy
and sell kids' items neighbor-to-neighbor. Think the trust of a town
swap, the convenience of an app, and a points system that makes it fun.

About the Role
You will be the on-the-ground face of Pass it Up in Westport. You'll
build the seller community, run launch events (Seller Bootcamp,
Donation Drive), spotlight neighbors, and own local trust.

This is a paid role with significant performance upside.
Compensation: $500/month base + 20% commission on monthly subscribers
you recruit + per-subscriber bonus + milestone bonuses + retention bonus.
No equity. Year-1 upside: ~$18,000 for strong execution.

Who You Are
- Live in Westport ≥2 years
- Active parent in the community (PTA, preschool, sports team, etc.)
- Known as someone who connects people
- Strong writer, comfortable on social and in person
- Want to build something real from the ground up

To Apply
Email founder@passitup.com with: (a) why you, (b) three Westport parents
who'd vouch for you, (c) a 200-word post you'd write to promote a
"closet cleanout swap" event.

We respond to every applicant within 5 business days.
```

#### 7.6.B Facebook Group (only if Week 1–2 funnel is thin — professional voice, not spammy)

```
Westport parents — I'm building a local marketplace called Pass it Up
for buying and selling kids' items between neighbors. It's launching
here in September, and I'm looking for a Westport mom to help lead the
community side.

This is a paid part-time role (~25 hrs/week) with real performance bonuses.
Not an MLM, not commission-only, not a volunteer ask.

If you're plugged into local parent networks, love connecting people,
and have wanted to be part of building something for the community —
DM me or comment and I'll send you details. Happy to grab coffee at
The Granola Bar to talk.

— Samer, Founder
```

#### 7.6.C Nextdoor (community voice)

```
Hi Westport neighbors — I'm launching a hyper-local marketplace this
September called Pass it Up, just for buying/selling kids' stuff
between Westport families. I'm hiring a part-time Founding Community
Lead (paid, 25 hrs/week) to help build it.

If you're a Westport parent who's well-connected locally and looking
for a flexible paid role with growth upside, please reply or DM.
```

### 7.7 Interview Questions (for first 45-min video interview)

1. Walk me through your last 5 years in Westport — where did you live, what schools, what communities?
2. Without thinking too hard, name 20 Westport parents you could text right now and they'd reply within an hour. (5-minute timer.)
3. Tell me about the last time you organized something — an event, a fundraiser, a swap, a class. Walk me through how you got people there.
4. Have you ever sold something on Facebook Marketplace, Poshmark, or at a tag sale? Walk me through it.
5. A Westport mom tells you "I already use Facebook Marketplace, why would I pay $8 a month for this?" What do you say?
6. What's the next 12 months look like for your family / your other commitments? Anything that could pull you away?
7. If you could change one thing about how Westport parents buy and sell kids' stuff today, what would it be?
8. What questions do you have for me?

### 7.7.1 Scoring Rubric

Score each area 1-5. Do not advance anyone below 4 on community embeddedness or communication.

| Area | 1 | 3 | 5 |
|---|---|---|---|
| Community embeddedness | Few Westport ties | Some groups, weak specifics | Deep networks, names people quickly |
| Communication | Vague, generic | Clear but not compelling | Warm, concise, persuasive |
| Operator mindset | Needs direction | Can execute tasks | Creates plan, spots blockers, follows up |
| Trustworthiness | Evasive | Normal references | References strongly validate character |
| Marketplace intuition | No resale experience | Occasional buyer/seller | Understands pricing, photos, trust, friction |

Advance rules:
- Phone screen to interview: average ≥3.5 and no hard-gate failure.
- Interview to trial: average ≥4.0 and community embeddedness ≥4.
- Trial to hire: all Week 1-4 deliverables complete and founder would trust her to represent the brand alone.

### 7.8 30-Day Trial Project (paid $500 cash + reimbursed expenses)

- **Week 1:** Coffee chats with 15 Westport parents (founder provides target list = 0 since founder is cold; she generates the list herself). Deliverable: 15 written notes + 30-name "warm contact" master list.
- **Week 2:** Identify 25 candidate sellers willing to seed listings at beta. Deliverable: spreadsheet with names, contact, item categories, expected listing count.
- **Week 3:** Secure 3 partnership conversations (preschool, library, or local consignment store). Deliverable: meeting notes + next steps for each.
- **Week 4:** Co-design the first Seller Bootcamp event (date, venue, agenda, target attendees). Deliverable: event run-of-show + RSVP list ≥20.

**Go/no-go decision at day 30** based on these four deliverables.

### 7.9 Lead Management Cadence After Hire

| Meeting | Frequency | Agenda | Output |
|---|---|---|---|
| 15-minute standup | Mon/Wed/Fri during July-August | Leads contacted, blockers, next 48 hours | Updated tracker |
| 45-minute weekly review | Friday | Metrics, events, candidates/sellers, risks | Next week's plan |
| Monthly comp review | Monthly | Attributed subscribers, bonuses earned, disputed attribution | Signed comp worksheet |

**Management rule:** give her outcomes, scripts, and metrics. Do not over-control how she spends every hour unless lawyer/CPA advises W-2 classification. The role must stay contractor-safe if paid as contractor.

---

## 8. Cold-Start Tactics — Top 3 Execution Detail

Top 3 confirmed: (1) Seller Bootcamp, (2) Founding Member Early Access, (3) Donation Drive. Tactics #4–10 from §5.8 of the context doc remain in the "phase 2 or evaluate" backlog.

### 8.1 TACTIC #3 — Seller Bootcamp Workshop (PRIMARY)

**Objective:** 150 high-quality listings live by launch day.
**Cadence:** 2 bootcamps in August (Aug 8 and Aug 22), one in launch week (Sep 5).
**Format:** 2-hour in-person workshop at Westport Library Community Room (free) or a local coffee shop's back room.
**Capacity:** 25 attendees per session.

**Agenda:**
| Time | Topic |
|---|---|
| 0:00–0:15 | Welcome + Pass it Up story + why Westport |
| 0:15–0:35 | Live demo: how to take a great listing photo (lighting, angle, props) |
| 0:35–0:55 | Pricing strategy for kids' items + how SP works |
| 0:55–1:30 | Hands-on: every attendee lists ≥5 items live (founder + lead help) |
| 1:30–1:45 | Q&A + community photo |
| 1:45–2:00 | Free coffee + check that everyone's listings posted |

**Incentive:** Attendees get free 3-month subscription + 50 SP + Founding Member badge (if among first 50).

**Promotion:** Founding Community Lead's network + library bulletin + Nextdoor + Instagram.

**Cost per bootcamp:** ~$200 (venue free, coffee + snacks $80, printed materials $40, photographer for community photo $80).

#### 8.1.1 Seller Bootcamp Prep Checklist

**14 days before:**
- [ ] Venue confirmed in writing
- [ ] RSVP page live (Google Form, Eventbrite, or landing page)
- [ ] Invite list of 100 local parents created
- [ ] Promotion post drafted for Nextdoor, Facebook, Instagram, email
- [ ] Demo account and sample listings ready

**7 days before:**
- [ ] 20 RSVPs minimum; if below 20, Founding Community Lead must personally text/call 30 parents
- [ ] Printed handout ready: photo tips, pricing tips, prohibited items, SP quick guide
- [ ] Coffee/snacks ordered
- [ ] QR code tested for app download / beta invite / waitlist

**Day before:**
- [ ] Reminder email + SMS sent
- [ ] Founder tests app flow end-to-end: signup, listing, photo upload, approval
- [ ] Backup hotspot and charger packed
- [ ] Attendance sheet printed

**Day of:**
- [ ] Check-in every attendee
- [ ] Capture consent for photos/testimonials
- [ ] Every attendee creates at least 1 listing before leaving
- [ ] Identify 5 best sellers for Neighbor Spotlight follow-up

**48 hours after:**
- [ ] Send thank-you email
- [ ] Approve or reject all listings
- [ ] Ask attendees for referral to 2 other parents
- [ ] Record metrics: RSVPs, attendance, listings created, listings approved, new subscribers, bugs found

#### 8.1.2 Bootcamp Success Criteria

| Metric | Minimum | Strong |
|---|---|---|
| RSVPs | 20 | 35 |
| Attendance | 15 | 25 |
| Listings created | 50 | 125 |
| Approved listings | 40 | 100 |
| Founding Members unlocked | 10 | 20 |
| Bugs blocking listing | 0 | 0 |

### 8.2 TACTIC #1 — Founding Member Early Access (CONFIRMED)

**Objective:** First 50 active users locked in as advocates.

**Mechanics (earned, not auto-claimed):**
- First 50 users to complete **one** qualifying action unlock the Founding Member package:
  - List 5 approved items, OR
  - Complete first purchase, OR
  - Refer 2 parents who join, OR
  - Attend a Seller Bootcamp
- Package: Free 6-month subscription + permanent "Founding Member" badge + 50 SP
- Slack/WhatsApp group: exclusive to Founding Members — direct line to founder + lead

**Promotion:** Featured on signup screen ("Be one of the first 50"), countdown widget on landing page, called out in every Bootcamp and Donation Drive.

**Cost in foregone MRR:** ~$2,400 (50 × $7.99 × 6).

#### 8.2.1 Founding Member Operating Rules

| Rule | Action |
|---|---|
| Eligibility window | Opens when beta waitlist opens; closes when 50 users unlock or Sep 30, whichever comes first |
| Qualification source of truth | Admin dashboard field: `founding_member_status = pending / earned / granted / rejected` |
| Manual approval | Founder approves the first 10 manually to catch abuse, then Founding Community Lead can recommend approvals |
| Badge timing | Badge appears within 24 hours after qualifying action is verified |
| Free subscription timing | Trial converts into 6-month free period immediately after badge grant |
| SP timing | 50 SP granted after badge grant; expires after 180 days if unused |
| Abuse rule | Users lose status if they create fake referrals, low-quality duplicate listings, or unsafe listings |

#### 8.2.2 Founding Member Weekly Ritual

Every Friday from beta start through Sep 30:

- [ ] Export list of users with qualifying actions.
- [ ] Review pending users for duplicate accounts, same payment method, or low-quality listings.
- [ ] Grant badges and free period to approved users.
- [ ] Send personal welcome message from founder.
- [ ] Ask each new Founding Member for one action: invite 2 parents, list 3 more items, or give product feedback.
- [ ] Add best story to Neighbor Spotlight backlog.

**Success criteria by Sep 15:** 50 Founding Members unlocked, at least 35 have listed or bought something, and at least 15 have referred another parent.

### 8.3 TACTIC #2 — Donation Drive Supply Seeding

**Objective:** 50–100 listings from a charity partnership + local press coverage.

**Partner candidates (interview 3 in June):**
- Westport Department of Human Services
- Person-to-Person (P2P) Norwalk
- Bridgeport Rescue Mission
- Westport Library (book/toy drive arm)

**Mechanics:**
- Charity collects donated kids' items at a host venue (parking lot of Stop & Shop, library lawn, or a school).
- Pass it Up volunteers (founder + lead + 3 recruited beta users) photograph and list every item on the app, listed by "Pass it Up x [Charity Name]".
- 100% of sale proceeds go to charity.
- Charity promotes the event to its mailing list; we promote on social.

**Event date:** Saturday, August 15, 10am–2pm.

**Cost:** $500 (printed signage, snacks for volunteers, professional photographer for press kit).

**Press play:** Pitch Westport Journal, Westport Now, Patch, and Hearst CT local. One press story = ~6 months of organic search benefit.

#### 8.3.1 Donation Drive Runbook

**Partner pitch:**

```text
Pass it Up is launching a Westport-first kids marketplace. We want to host a
one-day kids item donation drive where 100% of sale proceeds go to your
organization. We handle photos, listings, buyer coordination, and promotion.
You get proceeds, visibility, and a simple community-good story.
```

**Donation acceptance rules:**
- Accept: clean toys, books, strollers in safe condition, kids furniture, clothes bundles, baby gear with visible labels.
- Do not accept: car seats unless policy approved, helmets, recalled products, medicine, formula, food, stained/unsafe items, anything without basic cleanliness.

**Staffing:**
- Founder: app/listing flow, Stripe/payment questions, final quality review
- Founding Community Lead: donor intake, volunteer coordination, press, parent conversations
- 3 volunteers: item sorting, photos, QR code signup help

**Metrics to capture:**
- Items donated
- Items accepted
- Items rejected and why
- Listings created
- Listings sold within 14 days
- Email/SMS leads captured
- Press mentions
- New Founding Members unlocked

#### 8.3.2 Press Pitch Draft

```text
Subject: Westport kids marketplace launches with charity closet-cleanout drive

Hi [Name],

I'm launching Pass it Up, a Westport-first app for parents to buy and sell
kids' items locally. Before public launch, we're hosting a donation drive on
August 15 where donated kids items will be listed in the app and 100% of sale
proceeds go to [Charity].

The story is local: Westport parents clearing out useful kids gear, keeping it
in the community, and supporting [Charity]. Happy to share photos, founder
quote, partner quote, and launch details.

Would this be useful for your community calendar or local business coverage?
```

### 8.4 Phase 2 Backlog (evaluate after Month 1 metrics)

| Tactic | Default status | Trigger to activate | Owner | Acceptance criteria |
|---|---|---|---|---|
| #4 Consignment Partnership | Hold | <150 approved listings by Aug 25 OR <300 listings by Oct 1 | Founder + lead | 1 shop signs simple revenue-share memo and lists 25+ items |
| #6 Lost & Found feature | Defer to Q1 2027 | DAU/WAU weak after 3 months OR parents request it repeatedly | Founder | Feature spec written; no build before core marketplace retention is proven |
| #7 School Supply Swap | Conditional August test | Bootcamp #1 oversubscribes OR school partner asks for it | Lead | 1 school/community partner co-promotes; 30 supply items listed |
| #5 Referral Jackpot | Do not run initially | Referral share <15% by month 3 despite SP referral | Founder | One-time test with clear CAC cap; never run as open-ended subsidy |
| #8 Mystery Box | Hold | Founder's Closet has excess inventory and transaction liquidity is weak | Founder | 10 mystery boxes listed; sell-through >50% in 14 days |
| #9 Neighbor Spotlight | Start month 2 | Launch has 5 credible seller/buyer stories | Lead | 1 spotlight/week for 8 weeks; each post drives at least 3 waitlist/app clicks |
| #10 Freecycle Friday | Defer to month 4 | Buyer traffic weak and listings are sufficient | Lead | 4-week pilot; measure buyer reactivation and conversion into paid listings |

**Rule:** activate only one backlog tactic at a time. If multiple things are weak, fix the biggest constraint first: supply before demand, trust before paid ads, retention before expansion.

---

## 9. Pre-Launch Validation Work

### 9.1 Pricing Validation (must complete before July 1)

**Step 1: Existing transcripts.** Share the 5 user-interview transcripts you mentioned. Founder + lead extract pricing signal: did anyone explicitly say $7.99 is too high / too low / acceptable? If 4 of 5 said acceptable → pricing validated. Stop.

**Step 2 (only if Step 1 inconclusive): Typeform survey.**
- 50 respondents, $2 each via Prolific or Pollfish ($100 total) — filter: parents in Fairfield County, kids age 2–10, household income >$100K.
- 7 questions: willingness to pay for kids-only resale marketplace, alternatives currently used, switching cost, sensitivity at $4.99 / $7.99 / $9.99 / $12.99 / annual $79.
- Deliverable: 1-page memo. Adjust pricing if Van Westendorp finds optimal <$7.

#### 9.1.1 Transcript Review Worksheet

For each interview transcript, fill this table before deciding whether a survey is needed:

| Field | What to capture |
|---|---|
| Parent profile | Town, kids age, household context if known |
| Current behavior | FB Marketplace, Buy Nothing, Poshmark, donation, consignment, nothing |
| Pain intensity | Low / medium / high; quote the strongest pain sentence |
| Trust concern | What would make them hesitate? |
| Pricing signal | Exact quote about $7.99/month and $79/year |
| SP reaction | Confusing / interesting / motivating / irrelevant |
| Must-have feature | What they said they need before paying |
| Likelihood to try | 1-5 score inferred from transcript |

**Pricing validation rule:** keep $7.99 if at least 4 of 5 target users say the price is acceptable or cheaper than alternatives, and no more than 1 target user says subscription is a hard blocker.

#### 9.1.2 Survey Question Draft (if needed)

Use these exact questions if transcripts are inconclusive:

1. What town do you live in?
2. Do you have children age 2-10?
3. In the last 12 months, how have you sold, donated, or bought used kids items?
4. What is your biggest frustration with the current options?
5. Would you try a Westport-only kids marketplace with verified local parents and safer listing rules?
6. At which monthly price would this feel too expensive: $4.99, $7.99, $9.99, $12.99, or I would not pay monthly?
7. Would you prefer $7.99/month or $79/year after trying it for 30 days?
8. Which incentive would make you most likely to list items first: free months, SP bonus, help photographing items, or community event?
9. What would make you trust this more than Facebook Marketplace?
10. Leave email if you want early access.

**Survey go/no-go:** If fewer than 30 qualified Fairfield County parents complete the survey, do not use it to change pricing. Treat it as directional only.

### 9.2 Beta Test (August 1 – August 31)

- 100 invited TestFlight + Google Play internal-test users (Bootcamp attendees + Founding Members + lead's network).
- Goal: 50 listings, 20 transactions, NPS ≥40.
- Critical bug triage: founder fixes anything blocking transactions or payouts within 48 hrs.
- Iteration freeze: August 20. After Aug 20, only critical fixes go in.

#### 9.2.1 Beta Cohorts

| Cohort | Size | Invite date | Purpose | Required action |
|---|---|---|---|---|
| Internal smoke test | 5 | Jul 20 | Catch broken flows before locals see it | Complete signup, listing, purchase, subscription, report listing |
| Warm lead beta | 30 | Aug 1 | First real Westport usage | Create at least 1 listing or purchase |
| Seller Bootcamp beta | 40 | Aug 8 | Supply creation | Create at least 5 listings during / after bootcamp |
| Founding Member beta | 25 | Aug 15 | Advocacy and referral | Invite 2 parents and give feedback |

#### 9.2.2 Beta Bug Severity

| Severity | Definition | SLA | Launch impact |
|---|---|---|---|
| P0 | App crash, login broken, payment/subscription impossible, payout impossible, listing creation blocked | Same day | Blocks launch |
| P1 | Major workflow broken for >10% users, moderation/reporting broken, unsafe listing can bypass review | 24 hours | Blocks launch if unresolved by Aug 25 |
| P2 | Annoying bug with workaround, copy confusion, noncritical UI issue | 7 days | Does not block launch unless volume high |
| P3 | Nice-to-have, polish, minor copy | Post-launch backlog | Never blocks launch |

#### 9.2.3 Beta Exit Criteria

Do not move from beta to public launch unless all are true by Aug 25:

- [ ] 100 invited beta users, at least 60 activated.
- [ ] 150 approved listings OR emergency listing party scheduled and feasible before Sep 1.
- [ ] 20 successful transaction/payment flows in production or final staging.
- [ ] 0 open P0 bugs, 0 open P1 bugs.
- [ ] NPS >= 35 from at least 20 beta responses.
- [ ] At least 20 users can clearly explain SP back to you in their own words.
- [ ] Support inbox has handled at least 10 test support cases.
- [ ] Moderation/reporting flow tested on at least 5 mock bad listings.

### 9.3 App Store Submission

- Submit to Apple + Google by August 4, 2026.
- Reserve 2 weeks for rejection cycles.
- Pre-fill Apple Privacy Nutrition Label + Google Data Safety form.
- Set "release date" to Sep 1, 2026 in App Store Connect.

#### 9.3.1 App Store Submission Checklist

| Asset / requirement | Owner | Due | Acceptance criteria |
|---|---|---|---|
| App name and subtitle | Founder | Jul 20 | Matches brand and category; no unsupported claims |
| Screenshots | Founder / designer | Jul 25 | iPhone + Android required sizes; show actual product, not mock promises |
| App description | Founder | Jul 25 | Explains local kids marketplace, subscription, SP at a plain-English level |
| Privacy Policy URL | Founder / lawyer | Jul 25 | Public and reachable |
| Support URL / email | Founder | Jul 25 | Public support page or mailto works |
| Demo account | Founder | Aug 1 | Reviewer can log in and test core flows |
| In-app purchase config | Founder | Aug 1 | Monthly subscription configured, tested, and matches app copy |
| Data safety / privacy labels | Founder | Aug 1 | Stripe, analytics, messages, photos, location/town data disclosed accurately |
| Age rating | Founder | Aug 1 | No child-directed claim; app not for under-13 users |
| Review notes | Founder | Aug 4 | Tell Apple/Google exactly how to test listing, subscription, report listing |

**Pushback:** do not submit with placeholder screenshots or vague privacy answers. Store review rejection in late August is a launch-date risk you can avoid.

---

## 10. SP (Swap Points) Economics — Year 1 Configuration

### 10.1 Earn Rates

| Action | SP | Cap |
|---|---|---|
| Account signup | 15–25 (start at 20, expires 90 days) | One-time |
| First listing approved | 10 | One-time |
| Listing approved (after first) | 2 per listing | 20/week |
| Sale completed (seller) | 5% of sale value in SP (1 SP = $0.10) | None |
| Purchase completed (buyer) | 2% cashback in SP | None |
| Referral (referrer) | 25–50 SP (start at 30) | **Paid only after referee's first listing or purchase** |
| Referral (referee) | 0 at signup, 10 SP after first listing | — |
| Founding Member bonus | 50 SP | First 50 only |

### 10.2 Burn Rates

| Spend | SP cost |
|---|---|
| Featured listing 24hr boost | 50 SP |
| Skip approval queue | 25 SP |
| Top-of-feed for category (1hr) | 100 SP |
| Subscription discount $1 off | 100 SP (max $4 off in any month) |

### 10.3 Guardrails (must be enforced in code)

- Hard cap: SP balance per user max 1,000 in Year 1.
- Anti-fraud: no SP earned from same-IP referrals or same-payment-method linked accounts.
- Expiry: signup bonus 90 days; referral bonus 180 days; earned-from-sale SP 12 months.
- Admin kill-switch: founder can pause SP earning on any action with one toggle (see admin config docs).
- Weekly review: founder reviews SP inflation metric every Monday.

### 10.4 SP Adjustment Triggers

| Trigger | Action |
|---|---|
| >40% of users have ≥500 SP balance | Reduce earn rates by 25% |
| <10% of monthly SP earned is being spent | Add new burn options (featured, boost) |
| Any single user >2,000 SP (above cap) | Manual review for fraud |
| Subscription cancellation cites SP confusion | Simplify earn/burn UX |

### 10.5 SP Weekly Review Checklist

Every Monday, founder checks the SP dashboard before approving new promotions:

| Metric | Healthy range | Action if unhealthy |
|---|---|---|
| Total SP issued this week | Stable or growing with transactions | If issued grows without listings/transactions, pause promo earns |
| SP spent / SP earned | >=20% by month 2 | If <10%, add useful burn option or reduce earning |
| Avg SP balance per active user | <250 | If >250, reduce signup/referral SP by 25% |
| Users at cap | <2% of active users | Audit for fraud or overly generous events |
| Referral SP issued | Correlates with activated referred users | If referrals do not activate, pay only after first purchase/listing (already recommended) |
| Cancellation mentions SP | <10% of cancellation reasons | Rewrite SP UX, emails, and help article |

### 10.6 SP Product Requirements

Before beta, the app/admin must support:

- [ ] User-level SP ledger with reason codes, not just balance.
- [ ] Manual SP grant and revoke, with admin note.
- [ ] Promo configuration by action type (signup, listing, referral, purchase, sale).
- [ ] Expiration dates per SP grant.
- [ ] Referral attribution source and anti-fraud signals.
- [ ] Admin kill switch for each earn rule.
- [ ] Exportable weekly SP report.

**Acceptance criteria:** founder can explain any user's SP balance by reading ledger rows. If the system only stores a balance, do not launch SP publicly.

---

## 11. Phased Execution Playbook

### 11.0 Phase Management Rule

Each phase has a gate. If the gate is missed, do not silently roll forward. Hold a 30-minute decision meeting with yourself and write one of three decisions in the command center: **ship**, **cut scope**, or **move date**.

| Decision | Use when | Example |
|---|---|---|
| Ship | Gate is met or miss is minor and does not affect trust/legal/core marketplace | P2 polish bugs remain |
| Cut scope | Date matters but non-core features are blocking | Delay Lost & Found, referral contest, analytics polish |
| Move date | Legal, payments, safety, app stores, or supply gate is missed | No ToS, no payment flow, <100 listings |

### 11.1 Phase 0 (May 16 → June 1) — Foundation

**Goal:** Legal entity, accounts, brand assets live.

| Week | Owner | Tasks | Acceptance criteria |
|---|---|---|---|
| May 16–22 | Founder | LLC formation kickoff, EIN application, domain + handles, trademark search | Provider selected; entity filing started; domain/handles availability documented |
| May 23–29 | Founder + lawyer | Bank + Stripe + business CC; ToS/Privacy/AUP drafted; CPSC moderation rules added | Business checking and Stripe test account active; legal docs in review |
| May 30–Jun 1 | Founder | Logo + brand assets finalized; LinkedIn company page + Nextdoor business page live; pricing transcripts review (§9.1 Step 1) | Public brand presence live; transcript memo completed |

**Budget this phase:** ~$1,200 one-time (LLC formation, domain, logo, Apple Dev) — separate from monthly cap.

**Phase 0 gate:** no public recruiting spend until legal entity filing, business email, and role materials are ready. You can draft postings before this, but do not publish a messy hiring funnel.

### 11.2 Phase 1 (June 1 → July 1) — Recruit & Validate

**Goal:** Founding Community Lead hired and starting; pricing validated; beta build feature-frozen.

| Week | Owner | Tasks | Acceptance criteria |
|---|---|---|---|
| Week 1 | Founder | Post job on LinkedIn + Indeed + Nextdoor (§7.4 Week 1–2); founder finishes 90% of app build | 30 leads sourced/inbound target started; app core flows working in staging |
| Week 2 | Founder | Phone screens (12 → 6); start FB group post if funnel thin | At least 6 qualified interviews scheduled OR FB fallback activated |
| Week 3 | Founder | First interviews + trial project offers (top 3); pricing survey if needed (§9.1 Step 2); beta candidate TestFlight invites sent | 3 trial candidates selected; pricing memo complete |
| Week 4 | Founder | Hire decision; founder finishes critical features; beta opens July 1 | Signed contractor package or trial agreement; beta invite list ready |

**Spend this phase:** ~$1,500 (Indeed sponsored job $150, recruitment trial honoraria $300, pricing survey $100, app store prep, brand polish, lead's first 2 weeks $500 pro-rated).

**Phase 1 gate:** do not start paid trial if no candidate passes the must-have scorecard. A weak local lead is worse than no local lead because she will burn scarce trust.

### 11.3 Phase 2 (July 1 → August 31) — Beta + Pre-Launch

**Goal:** 100 beta users, 150 listings, 3 successful pre-launch events, App Store approved.

| Week | Owner | Tasks | Acceptance criteria |
|---|---|---|---|
| Jul 1–7 | Lead + founder | Lead's 30-day trial starts; she runs 15 coffee chats | 15 notes captured; 30-name warm list started |
| Jul 8–14 | Founder | Beta opens to first 30 users (lead's network) | 30 invites sent; 15 activated; no P0 bugs |
| Jul 15–21 | Lead | Lead delivers 25-seller warm list + 3 partnership conversations | 25 sellers logged; 3 partner meetings held/scheduled |
| Jul 22–28 | Lead + founder | First partnership confirmed; beta expands to 60 | 1 partner next step in writing; 60 invites; 50 listings target |
| Jul 29–Aug 4 | Founder | App Store submitted; Donation Drive partner secured | Apple/Google submitted; partner date/location confirmed |
| Aug 5–11 | Lead + founder | Seller Bootcamp #1 (Aug 8); beta at 100 users; founder fixes critical bugs only | 20 RSVPs, 40 approved listings from event, 100 beta invites |
| Aug 12–18 | Lead | Donation Drive (Aug 15); press pitch sent; bootcamp #2 promo | 50 accepted donated items; 4 press pitches sent |
| Aug 19–25 | Lead + founder | Seller Bootcamp #2 (Aug 22); App Store approved; feature freeze | 150 approved listings; 0 P0/P1 bugs; launch gates reviewed |
| Aug 26–31 | Founder + lead | Launch dress rehearsal; press embargo lift; final marketing assets locked | End-to-end launch checklist completed; all posts/emails scheduled |

**Spend this phase:** ~$5,500 total (lead $1,000 × 2mo, bootcamps $400, Donation Drive $500, ads $1,200, partnerships/swag $400, lead expenses $2,000).

**Phase 2 gate:** public launch requires §1.2 gates plus beta exit criteria in §9.2.3. If either fails, cut scope or move public launch.

### 11.4 Phase 3 (September 1, 2026) — Launch

| Day | Action |
|---|---|
| Sep 1 (Tues, 7am ET) | App live on App Store + Play Store; Founding Member countdown begins |
| Sep 1 9am | Email blast to 100 beta + 200-name warm list |
| Sep 1 10am | Nextdoor + Facebook + Instagram launch posts |
| Sep 1 12pm | Press release goes out (Westport Journal, Westport Now, Patch, Hearst CT) |
| Sep 5 (Sat) | Seller Bootcamp #3 — "Launch Edition", target 30 attendees |
| Sep 8 | Founding Member milestone check — should be 30+ filled by now |
| Sep 15 | First retention check — 30-day metrics review |

#### 11.4.1 Launch Day Command Center

| Time | Owner | Action | Evidence |
|---|---|---|---|
| 6:30am | Founder | Confirm app store availability, Stripe live mode, support inbox, admin dashboard | Screenshots saved |
| 7:00am | Founder | Flip launch flag / publish website waitlist-to-download links | Live links tested |
| 8:00am | Lead | Text top 25 warm parents with personal launch message | Tracker updated |
| 9:00am | Founder | Send launch email | Email analytics screenshot |
| 10:00am | Lead | Publish Nextdoor + FB + Instagram launch posts | URLs saved |
| 12:00pm | Founder | Press release / pitch follow-up | Sent email evidence |
| 3:00pm | Founder | First dashboard check | Signups/listings/subs recorded |
| 8:00pm | Founder + lead | End-of-day review | Issue list + next-day plan |

**Launch day rule:** no new feature work. Only fix P0/P1 bugs, answer users, approve/reject listings, and support the lead.

### 11.5 Phase 4 (September → December) — Growth & Annual Plan

| Month | Focus |
|---|---|
| September | Hit 50 Founding Members, 100 subscribers, 500 listings, NPS measurement starts |
| October | Neighbor Spotlight content engine (Tactic #9) starts; first partnership co-marketing |
| November | Consignment partnership evaluation; subscriber count target 200; first big retention test |
| December | **Annual plan rollout** (month 3); existing monthly subs offered $79/yr; target 30% conversion to annual; Founder's Closet rotates seasonal inventory |

#### 11.5.1 Monthly Operating Review Template

Use this every month before changing tactics:

| Question | Required answer |
|---|---|
| What is the biggest constraint right now? | Supply / demand / trust / product bug / pricing / retention |
| Which metric proves it? | Cite dashboard number, not a feeling |
| Which one tactic addresses it? | Choose one from §8 or write a new explicit test |
| What is the budget? | Dollar cap and owner |
| What is the stop condition? | Metric/date that ends the test |

If you cannot answer all five, do not spend.

### 11.6 Phase 5 (Q1–Q3 2027) — Sustain & Prep Town #2

- Q1: Subscriber 350+, settle on long-term SP economics, lead's Year-1 review.
- Q2: Hit 500 subscribers, evaluate town #2 candidates (New Canaan, Darien, Fairfield).
- Q3: If 500-sub milestone achieved, begin town-#2 lead recruitment using this same playbook.

---

## 12. Risk Register

| # | Risk | Probability | Impact | Mitigation | Trigger to escalate |
|---|---|---|---|---|---|
| R1 | Solo dev misses Sep 1 launch | High | Critical | Feature freeze Aug 20; cut scope before missing date | Slipping >2 weeks on Aug 1 review |
| R2 | Founding Community Lead bad fit | Medium | Critical | 30-day trial; 2 backup candidates on retainer | Day 21 trial review red flags |
| R3 | Empty marketplace at launch | High | Critical | 150 listings required pre-launch via bootcamps + Founder's Closet + Donation Drive | <100 listings on Aug 25 |
| R4 | $7.99 doesn't validate | Medium | High | Pricing survey before lead hire; lower to $4.99 if needed | Survey conversion <30% |
| R5 | Westport buyer density too low | Medium | High | Expand to neighboring ZIPs (Weston, Norwalk 06853) at month 6 if needed | Active buyer count <300 at month 4 |
| R6 | Legal exposure (recalled product listed) | Low | Critical | CPSC moderation rules; ToS limits liability | Any incident → 24hr remediation + lawyer call |
| R7 | SP inflation | Medium | Medium | Weekly inflation review + kill-switch | >40% users at ≥500 SP |
| R8 | Founder burnout (solo) | High | High | $500/month is part-time for lead = breathing room; CPA + bookkeeper offload admin | Founder reports >60hr weeks for 3 consecutive weeks |
| R9 | Apple/Google rejection | Medium | High | Submit Aug 4 (4 weeks before launch); follow review guidelines strictly | Rejection received → revise within 72hrs |
| R10 | Subscription conversion <10% of trials | Medium | High | A/B test trial length, in-app onboarding, founder personal outreach to non-converters | Month-2 conversion <8% |
| R11 | Negative press / social incident | Low | High | Crisis playbook (24hr response, transparency); insurance | Any complaint published online |
| R12 | Founding Member perks abused | Low | Medium | Earned-not-claimed model already mitigates | Founder review monthly |

### 12.1 Top-Risk Response Playbooks

#### R1: Solo Dev Misses Sep 1

**Early warning signs:** checkout not stable by Aug 1, App Store not submitted by Aug 4, P0 bug count >2 after Aug 15.

**Response order:**
1. Cut non-core features: Lost & Found, advanced referral UI, polished dashboards, complex SP burns.
2. Keep only: signup, listing, moderation, subscription, payment/payout or clear beta workaround, support, reporting.
3. If core transaction flow is still not stable by Aug 25, move public launch. Do not launch broken payments.

#### R2: Founding Community Lead Bad Fit

**Early warning signs:** fewer than 10 coffee chats by day 10, vague notes, no warm seller list, poor follow-up, cannot get references.

**Response order:**
1. Direct feedback at day 10 with exact missing deliverables.
2. Day 21 decision: continue, narrow role, or terminate trial.
3. Activate backup candidate #2 or founder-led emergency plan: founder personally runs two listing parties + direct Nextdoor outreach.

#### R3: Empty Marketplace

**Early warning signs:** <50 listings by Aug 15, <100 listings by Aug 25, fewer than 25 sellers.

**Response order:**
1. Emergency listing party with lead's warm network.
2. Founder's Closet inventory: 50 transparent founder listings.
3. Consignment shop partnership as backup supply.
4. Delay paid buyer acquisition until supply crosses 150 listings.

#### R10: Subscription Conversion Weak

**Early warning signs:** trial conversion <8%, users browse but do not subscribe, cancellations mention price or unclear value.

**Response order:**
1. Interview 10 non-converters; do not guess.
2. Rewrite paywall with clearer benefits and local trust language.
3. Add annual plan bonus only after month 3.
4. Test temporary intro price only if interviews say price is the real blocker.

---

## 13. Success Metrics & Dashboards

### 13.1 North Star

**Active monthly subscribers in Westport.** Everything else is downstream.

### 13.2 Stage-Based Targets

| Metric | Month 3 (Dec 1) | Month 6 (Mar 1) | Month 12 (Sep 1, 2027) |
|---|---|---|---|
| Total registered users | 300 | 700 | 1,500 |
| Active sellers (≥1 listing in 30d) | 75 | 150 | 250 |
| Active buyers (≥1 view in 30d) | 200 | 500 | 1,000 |
| Live listings | 500 | 1,200 | 2,500 |
| Monthly subscribers | 100 | 250 | 500 |
| MRR | $800 | $2,000 | $4,000 |
| Annual subs (after Dec 1) | 0 | 50 | 150 |
| Average listings / active seller | 6 | 8 | 10 |
| Transactions / month | 50 | 200 | 500 |
| Gross margin | 65% | 70% | 75% |
| NPS | 35 | 45 | 50 |
| Organic referral share of signups | 20% | 30% | 40% |
| 30-day retention (paid subs) | 70% | 80% | 85% |

### 13.3 Operating Cadence

- **Weekly (Mondays, 30 min):** Founder reviews dashboard — listings, subs, SP inflation, lead 1:1.
- **Monthly:** Founder + lead retrospective — what worked, what didn't, next month's focus.
- **Quarterly:** Strategy review — revise this document if any material change.

### 13.4 Tooling

- Supabase analytics + custom admin dashboard (already in your codebase per the ADMIN-V3-* docs).
- Stripe revenue dashboard.
- A free GA4 / Plausible for web landing page.
- Notion or Linear for ops.

### 13.5 Dashboard Event Definitions

Track these events before beta. Without these, weekly reviews become opinion-based.

| Event | Required properties |
|---|---|
| `signup_completed` | user_id, town, source, referral_code, created_at |
| `listing_created` | listing_id, user_id, category, price, source_event, created_at |
| `listing_approved` | listing_id, moderator_id, approval_time_hours, rejection_reason_if_any |
| `purchase_started` | buyer_id, listing_id, price, payment_method |
| `purchase_completed` | buyer_id, seller_id, listing_id, price, fees, completed_at |
| `subscription_started` | user_id, plan, trial_start, source, referral_code |
| `subscription_converted` | user_id, plan, trial_days, conversion_date |
| `subscription_canceled` | user_id, plan, cancellation_reason, days_active |
| `sp_earned` | user_id, amount, reason_code, expires_at |
| `sp_spent` | user_id, amount, burn_type |
| `referral_qualified` | referrer_id, referee_id, qualifying_action |
| `support_ticket_created` | user_id, category, severity, created_at |

### 13.6 Metric Formulas

| Metric | Formula |
|---|---|
| Activated user | User who creates listing, purchases, subscribes, or refers within 7 days |
| Active seller | User with >=1 approved live listing in last 30 days |
| Active buyer | User with listing view, message, purchase, or saved item in last 30 days |
| Trial conversion | Paid conversions / trials started in cohort |
| 30-day paid retention | Paid subscribers active 30 days after first paid date / paid subscribers in cohort |
| Referral share | Signups with valid referral source / total signups |
| Listing approval time | Median hours from listing_created to listing_approved |
| SP velocity | SP spent in period / SP earned in period |
| Marketplace liquidity | Transactions per active listing per month |
| CAC by channel | Channel spend / activated users from channel |

### 13.7 Weekly Dashboard Snapshot Template

Every Monday, paste this into the command center:

```text
Week of: [date]
Signups:
Activated users:
Active sellers:
Active buyers:
Approved live listings:
Transactions:
MRR:
Trial conversion:
30-day retention:
Referral share:
SP earned / spent:
Top support issue:
Biggest constraint:
This week's one growth focus:
```

---

## 14. Budget Summary (Pre-launch + Year 1 indicative)

| Phase | Period | Spend | Notes |
|---|---|---|---|
| One-time setup | May 16–Jun 1 | $1,500 | LLC, domain, logo, Apple Dev, legal docs |
| Phase 1 | Jun 1–Jul 1 | $1,500 | Hiring, pricing, brand polish |
| Phase 2 | Jul 1–Aug 31 | $5,500 | Lead 2mo + events + ads + beta |
| Launch month | Sep 2026 | $3,000 | At cap |
| Months 2–12 | Oct 26–Aug 27 | $30,000 | At ~$2,750/mo average × 11 |
| Founding Community Lead variable comp | Sep 26–Aug 27 | ~$10,000 | MRR commission + bonuses scale with success |
| **Year-1 total** | | **~$51,500** | Excluding founder time |

Detailed line-item Year-1 budget should live in a separate spreadsheet (`docx/PASS-IT-UP-BUDGET-YEAR1.xlsx` or `.md`) — to be built once Phase 0 closes.

### 14.1 Monthly Spend Allocation Under $3,000 Cap

| Category | Default monthly cap | Notes |
|---|---|---|
| Founding Community Lead base | $500 | Fixed base; variable comp paid only after triggers |
| Local events / bootcamps | $400 | Venue, snacks, print, photography |
| Paid acquisition tests | $500 | Nextdoor / Meta only after supply threshold met |
| Partnerships / donations / community goodwill | $300 | Donation Drive materials, small partner fees |
| Tools / software | $250 | Email, Typeform, analytics, support, design tools |
| Legal / accounting reserve | $500 | Smooths lumpy lawyer/CPA costs |
| Contingency | $550 | Bugs, emergency print, extra event, app store issue |

**Rule:** if one category goes over cap, another category must go under. Do not let "small" tools quietly create a fourth employee.

### 14.2 Spend Approval Rules

| Spend size | Approval rule |
|---|---|
| $0-$100 | Founder can approve if tied to current phase goal |
| $101-$500 | Must record owner, expected outcome, and stop condition in command center |
| $501-$1,000 | Must tie directly to launch gate, legal requirement, or top-3 cold-start tactic |
| >$1,000 | Do not spend unless it replaces an already budgeted item or prevents launch failure |

### 14.3 Unit Economics Watchlist

| Metric | Target | Why it matters |
|---|---|---|
| Paid CAC | <$25 per activated user by month 3 | $7.99 monthly cannot support high CAC early |
| Event CAC | <$15 per activated user | Events should outperform ads because trust is local |
| Payback period | <4 months | Longer payback strains cash under $3K/month cap |
| Gross margin | >65% by month 3 | Subscription revenue should not be eaten by tools/support |
| Monthly burn | <=$3,000 after launch | User-confirmed ceiling |

---

## 15. GPT-5.5 Evaluation

This section is a direct operator review of the GTM plan. It is intentionally blunt. The goal is not to make the plan sound good; the goal is to improve the odds that Pass it Up becomes a real, liquid Westport marketplace.

### 15.1 Overall Success Evaluation

The GTM plan is strong as an execution document, but the app's success still depends on three fragile assumptions:

1. The app is stable enough by August to support listing, subscription, payment / payout, moderation, support, and reporting.
2. The Founding Community Lead is genuinely embedded in Westport, not just available and friendly.
3. Westport parents accept a subscription before the marketplace has fully proven liquidity.

**Honest success estimate:**

| Scenario | Estimated chance of credible Westport pilot | Why |
|---|---:|---|
| Stable app + excellent Founding Community Lead + 150+ real listings pre-launch | 55-65% | The plan has enough density, trust, and event motion to work |
| Stable app but weak / average local lead | 25-35% | Founder is 100% cold in Westport; borrowed trust is the core acquisition channel |
| App slips into late August with unstable listing/payment/moderation | 25-35% | GTM energy turns into waiting, and launch confidence drops |
| No strong local lead and no strong supply before launch | <25% | The marketplace launches cold and empty, which is the failure mode |

**Blunt takeaway:** the document does not win by being detailed. The plan wins only if it creates real trusted supply before public demand is invited in.

### 15.2 Major Decision Review

| Decision | Evaluation | Recommendation / pushback |
|---|---|---|
| Westport first | Strong decision. Westport has income, identity, parent density, and local trust networks. | Keep. Do not expand to Fairfield County early. Density beats reach. |
| Kids-only launch | Correct wedge. Easier positioning, moderation, and safety scope. | Keep. Do not add home/family categories until kids liquidity is proven. |
| September 1 launch target | Good seasonal timing, but risky for a solo dev. | Treat as target, not ego deadline. If core flows are not stable by Aug 25, delay or cut scope. |
| Subscription-led model at $7.99 | Strategically attractive but commercially risky because alternatives are free. | Keep $7.99, but avoid making payment feel like an entry toll. Free browse/buy + limited free selling is safer. |
| Annual plan at month 3 | Good timing. Too early on day one would be premature. | Keep. Only push annual after monthly retention and marketplace activity are proven. |
| No fake supply | Essential. Fake supply would destroy trust if discovered. | Keep. Use Founder's Closet only if transparent. |
| No equity for local lead | Correct for future town expansion. | Keep. The Year-2 loyalty bonus is important; without it, she may leave after building the network. |
| Founding Community Lead title | Strong. Avoids co-founder confusion without equity. | Keep. Do not use co-founder language publicly or in contracts. |
| $2,500-$3,000 monthly cap | Good discipline, but tight. | Keep, but treat legal/setup costs as one-time setup, not normal monthly burn. Do not starve bootcamps. |
| Direct mail deprioritized | Correct. Direct mail before message validation is wasteful. | Keep as a test only after conversion signal exists. |
| LinkedIn / Indeed / Nextdoor + FB fallback | Improved from earlier plan. | Keep, but do not wait too long to use Facebook groups professionally if the first 2 weeks are weak. |

### 15.3 Tactic-by-Tactic Evaluation

| Tactic | Strength | Risk | Recommendation |
|---|---|---|---|
| Seller Bootcamp | Highest-value tactic. Creates supply, trust, education, and community in one motion. | Requires app to be ready enough for live listing; bad execution could feel awkward. | Make this the flagship. Add one smaller July pilot bootcamp with 8-10 people to debug the flow before August. |
| Founding Member Early Access | Good scarcity and status mechanic if earned. | If automatic, it becomes discount leakage and attracts passive users. | Keep earned model. Prioritize "list 5 approved items" as the primary unlock. |
| Donation Drive | Strong trust and PR story; creates authentic supply. | Operationally messy; donated inventory can be low quality or legally sensitive. | Keep, but restrict categories aggressively and reject anything risky or low quality. |
| Consignment Partnership | Strong backup supply tactic and more predictable than donations. | Consignment shops may see you as competition or may demand too much control. | Move from passive backlog to active July exploration. One shop with 25-50 listings can materially reduce empty-marketplace risk. |
| Neighbor Spotlight | Underrated trust compounding tactic. | Needs real stories; fake polish will read as marketing. | Start as soon as there are 3 credible users, not necessarily month 2. |
| School Supply Swap | Seasonally smart for August. | Can distract from core resale if treated as a full campaign. | Keep as opportunistic add-on, not a main pillar. |
| Referral Jackpot | Can create bursts of signups. | Incentive gaming, low-quality referrals, and CAC distortion. | Do not run early. SP referral is enough. |
| Lost & Found | Good engagement utility. | Product distraction before marketplace liquidity is proven. | Defer until core marketplace retention works. |
| Mystery Box | Fun, low-cost transaction unlock. | Can cheapen brand or create disappointment if quality varies. | Use only for Founder's Closet overflow. Not a GTM pillar. |
| Freecycle Friday | Good for traffic and habit. | Can train users toward free goods and weaken subscription value. | Defer to month 4+ after paid marketplace behavior exists. |

### 15.4 Biggest Pushbacks

#### Pushback 1: The Founding Community Lead base may be too low

$500/month is disciplined, but the right person is not just a part-time helper. She is the trust bridge into a town where the founder is 100% cold.

**Recommendation:** keep the default model, but allow an exception for an exceptional candidate:

| Candidate quality | Recommended base |
|---|---:|
| Good but unproven | $500/month + performance upside |
| Clearly exceptional, deeply connected, can name 20+ parents quickly | $750-$1,000/month for July-August, then performance-weighted after launch |

Do not cheap out on the person carrying the cold-start risk.

#### Pushback 2: Subscription cannot feel like a front-door tax

Parents already have free alternatives: Facebook Marketplace, Buy Nothing, parent chats, donation, and consignment. Charging before liquidity is obvious creates friction.

**Recommended model:**

| User type | Access |
|---|---|
| Free buyer | Browse, buy, save items, message sellers |
| Free seller | Up to 3 active listings |
| Paid seller / Plus | Unlimited listings, higher SP earn, listing boosts, early access, seller tools |
| Founding Member | Free 6 months after real contribution |

This keeps subscription value while reducing the empty-marketplace chicken-and-egg problem.

#### Pushback 3: Kids product safety must be stricter than a normal marketplace

The biggest legal risk is not LLC setup. It is unsafe kids items.

**Launch safety stance:**

| Category | Launch recommendation |
|---|---|
| Helmets | Block |
| Formula / medicine / food | Block |
| Car seats | Block at launch or manual review with manufacture date, expiration date, accident-free attestation |
| Cribs / sleep products | Manual review; block known unsafe categories |
| Strollers / high chairs | Require model label photo and condition checklist |
| Recalled-product keywords | Manual review |

Do not optimize for listing count by accepting risky inventory.

#### Pushback 4: The plan needs a sharper seller promise

The plan explains why the marketplace should exist, but seller motivation needs to be sharper. Sellers will not list just because the idea is nice.

**Stronger seller promise:**

```text
List once, sell to nearby parents, avoid flaky strangers, and get help pricing kids gear.
```

Every seller-facing page, bootcamp, and outreach message should reinforce: easier listing, safer local buyers, less noise than Facebook.

### 15.5 Recommended Changes Before Execution

These are the highest-leverage changes to improve success odds before launch work begins.

| Priority | Change | Why it matters | Owner | Timing |
|---|---|---|---|---|
| 1 | Move Consignment Partnership to active July exploration | Reduces empty marketplace risk with reliable inventory | Founder + lead | July |
| 2 | Add small July Bootcamp pilot | Debugs event/listing flow before public August events | Founder + lead | July |
| 3 | Make subscription less restrictive at the front door | Reduces user friction while liquidity is still forming | Founder | Before beta |
| 4 | Allow higher temporary base for exceptional lead | Improves chance of attracting the trust broker you actually need | Founder | During hiring |
| 5 | Block or heavily restrict risky kids categories | Prevents legal/trust failure | Founder + lawyer | Before beta |
| 6 | Add hard expansion rule | Prevents premature town #2 distraction | Founder | Before month 6 review |
| 7 | Sharpen seller promise in all seller-facing copy | Improves supply creation | Founder + lead | Before bootcamp promotion |

### 15.6 Expansion Readiness Rule

Do not open town #2 just because there is interest. Expand only when Westport proves repeatable liquidity.

| Level | Metric threshold | Meaning |
|---|---|---|
| Minimum viable pilot | 100 paid subscribers, 500 listings, 50 transactions/month by month 3 | Continue Westport, do not expand yet |
| Strong pilot | 250 paid subscribers, 1,200 listings, 200 transactions/month by month 6 | Begin town #2 research, not launch |
| Expansion-ready | 500 paid subscribers, 2,500 listings, NPS 50+, referral share 30%+ by month 12 | Start town #2 lead recruitment |

If Westport misses these thresholds, the correct move is not a new town. The correct move is to diagnose supply, trust, pricing, or product friction.

### 15.7 Final Operator Verdict

The plan is good enough to execute, but success is not evenly distributed across the plan. The top 20% of work drives most of the outcome:

1. Ship a stable listing/payment/moderation experience.
2. Hire a real Westport trust broker.
3. Create 150-300 real listings before public launch.
4. Keep subscription friction low until marketplace value is obvious.
5. Protect trust aggressively through safety rules and support.

Everything else supports those five points. Ads, SP, direct mail, press, and copy cannot compensate for an empty marketplace or a weak local operator.

---

## 16. Glossary

- **MRR:** Monthly Recurring Revenue
- **SP:** Swap Points (in-app loyalty currency)
- **NPS:** Net Promoter Score
- **Founding Member:** First 50 users who complete a qualifying action; receive free 6mo sub + badge + 50 SP
- **Founding Community Lead:** Hired part-time Westport operator; no equity; performance-based comp
- **CAC:** Customer Acquisition Cost
- **Founder's Closet:** Founder-seeded inventory used as transparent supply at launch

---

## 17. Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | May 16, 2026 | Founder + Assistant | Initial GTM bible based on locked decisions from WESTPORT-GTM-CONTEXT-AND-DECISIONS.md §1–§10 |
| 1.1 | May 16, 2026 | Founder + Assistant | Expanded into actionable execution runbook: launch gates, legal order of operations, contractor package, hiring scripts, beta gates, SP controls, event runbooks, dashboard definitions, budget controls, and launch/partner copy packs |
| 1.2 | May 23, 2026 | Founder + Assistant | Added GPT-5.5 Evaluation section with tactic-by-tactic critique, pushbacks, success odds, pricing/hiring/safety recommendations, and expansion readiness rule |

**Next review:** July 1, 2026 (after Founding Community Lead hired).

**Re-read triggers (mandatory):**
- Anyone proposes a change to launch town, category, price, or hiring model → re-read §2.
- Considering a new tactic → check §8 first.
- Hiring a contractor or making >$500 spend decision → check §3 and §14 first.
- Any user complaint or legal letter → check §3.5 and §12.

---

## Appendix A — Open Items Handed Off To Operations

These are deliberately left for the Founding Community Lead's first 30 days, founder's Phase 0 work, or later iteration. They do not block launch.

- A1. Final partnership prioritization (preschools vs. library vs. consignment) — lead's Week 3 deliverable.
- A2. Detailed Year-1 budget spreadsheet — owner: founder, by Jun 15.
- A3. CPA selection and engagement — owner: founder, by Jul 1.
- A4. Trademark filing (Intent-to-Use) — owner: founder, by Aug 1.
- A5. Insurance policy purchase (GL + Cyber) — owner: founder, by Aug 15.
- A6. Press kit + media list — owner: lead, by Aug 1.
- A7. Logo, app icon, splash final files — owner: founder, by Jun 1.
- A8. Founding Member Slack/WhatsApp group setup — owner: founder, by Aug 25.
- A9. Annual plan UX copy + paywall design — owner: founder, by Nov 1.
- A10. Town #2 evaluation criteria — owner: founder, by Q2 2027.

---

## Appendix B — Launch Copy Pack

### B1. Launch Email To Beta / Waitlist

```text
Subject: Pass it Up is live in Westport

Hi [First Name],

Pass it Up is now live for Westport parents.

The idea is simple: kids outgrow things quickly, and good items should be easy
to pass to another local family. You can list kids gear, browse nearby items,
earn Swap Points, and help shape the first version before we expand beyond
Westport.

The first 50 active users can earn Founding Member status: 6 months free,
a Founding Member badge, and 50 Swap Points after completing one qualifying
action like listing 5 approved items, making a first purchase, referring 2
parents, or attending a Seller Bootcamp.

Download here: [link]

Thanks for helping build this from the neighborhood up.

Samer
Founder, Pass it Up
```

### B2. Launch Nextdoor Post

```text
Westport parents — Pass it Up is now live.

It's a local marketplace for buying and selling kids items with nearby parents.
We built it first for Westport because trust and density matter more than a
huge generic marketplace.

If you have outgrown kids gear sitting in a closet, stroller, toys, books, or
seasonal clothing, we'd love for you to list a few items and help seed the
first Westport marketplace.

The first 50 active users can earn Founding Member perks after completing one
real action in the app.

Download / join here: [link]
```

### B3. Launch Facebook Group Post

```text
Westport parents — sharing something local I have been building: Pass it Up,
a kids-items marketplace just for Westport families.

The goal is to make it easier to clear out good kids gear, find useful things
nearby, and avoid the noise of broad marketplaces. We're starting small and
community-first, with listing rules and review flows for higher-risk kids items.

If you want to help seed the marketplace, list a few items or join as one of
the first Founding Members here: [link]

Happy to answer questions in comments.
```

### B4. Instagram Caption

```text
Westport parents, Pass it Up is live.

Outgrown kids gear deserves a second home nearby. List items, browse local finds,
earn Swap Points, and help build the first Westport kids marketplace from the
ground up.

First 50 active users can earn Founding Member perks.

Link in bio.
```

### B5. Seller Bootcamp Invite

```text
Subject: Join the Pass it Up Seller Bootcamp

Have outgrown kids items sitting around? Join us for a 2-hour hands-on Seller
Bootcamp where we'll help you photograph, price, and list your first items in
Pass it Up before launch.

Bring 5-10 clean kids items: clothes bundles, toys, books, baby gear, strollers,
or kids furniture. We'll provide coffee, listing help, and a quick guide to Swap
Points.

Date: [date]
Time: [time]
Location: [venue]
RSVP: [link]
```

### B6. Founder DM To Early Seller

```text
Hi [Name] — I'm launching Pass it Up in Westport, a kids-items marketplace for
local parents. We're looking for the first 25 sellers to seed good inventory
before public launch. You came to mind because [specific reason].

Would you be open to listing 5-10 outgrown kids items? We can help with photos
and pricing at our Seller Bootcamp, and early active sellers can earn Founding
Member perks.
```

---

## Appendix C — Partner Outreach Pack

### C1. Preschool / School Director Email

```text
Subject: Local Westport kids marketplace + parent event idea

Hi [Name],

I'm Samer, founder of Pass it Up, a Westport-first marketplace for parents to
buy and sell kids items locally. We're launching September 1 and looking for a
small number of trusted local partners to help parents clear out outgrown gear
and keep useful items in the community.

Would you be open to a 20-minute conversation about either:
1. sharing our Seller Bootcamp with parents,
2. hosting a flyer / QR code, or
3. partnering on a closet-cleanout event?

I can send a one-page summary first if helpful.

Best,
Samer
```

### C2. Consignment Shop Email

```text
Subject: Local listing partnership for overflow kids inventory

Hi [Name],

I'm launching Pass it Up, a Westport-first marketplace for kids items. One idea
we're exploring is a simple partnership with a local consignment shop: you list
select overflow items in the app, we promote you as a trusted local partner,
and you get another lightweight sales channel.

No commitment — I would love to learn how you handle inventory today and whether
this could be useful.

Would 20 minutes next week work?
```

### C3. Partnership Scoring Rubric

Score each partner 1-5 before committing time or money.

| Factor | 1 | 5 |
|---|---|---|
| Parent reach | Small or unrelated audience | Direct access to many Westport parents |
| Trust transfer | Weak reputation | Parents already trust them deeply |
| Execution ease | Complex approvals | One person can say yes |
| Supply impact | No listings likely | 25+ listings likely |
| Brand fit | Feels off-mission | Practical, family, local, safe |

Only pursue partners scoring 18+ out of 25 before launch.

---

## Appendix D — First 30 Days After Launch Daily Checklist

For September, do this every business day:

- [ ] Check support inbox by 9am and 4pm.
- [ ] Approve/reject listings within 24 hours.
- [ ] Review any reported listings or users immediately.
- [ ] Check Stripe for failed payments, disputes, refunds.
- [ ] Check dashboard: signups, listings, transactions, subscriptions, SP issued/spent.
- [ ] Personally message 3 high-intent users: new seller, new buyer, or non-converting trial.
- [ ] Founding Community Lead contacts 5 local parents or partners.
- [ ] Log one learning in the command center.

Weekly Friday deliverable:

```text
This week we gained:
This week we lost / failed:
Biggest user quote:
Biggest bug:
Biggest constraint:
Next week's one focus:
Spend this week:
```

---

*End of Pass it Up GTM Bible v1.2.*
