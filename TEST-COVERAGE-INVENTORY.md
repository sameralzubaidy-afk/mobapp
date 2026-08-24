# TEST-COVERAGE-INVENTORY

> **Ground-truth QA test-coverage inventory** — every captured QA report cross-referenced against the full canonical guide index. Generated from evidence on disk. **Read-only reconciliation** — no guides, code, or reports were modified.

**Generated:** 2026-08-24

## 1 · Executive summary

- **Canonical test cases (unique TC-IDs across the 6 guides):** **820**
- **Have at least one PASS on record (latest verdict PASS / PASS partial):** **122** (14.9%)
- **NEVER RUN** (no report on disk covers them): **683** (83.3%)
- **STILL OPEN** (latest FAIL/BLOCKED with no later PASS re-verification): **13**

| Guide | Cases | Run | PASS (latest) | STILL OPEN | NEVER RUN |
|---|---:|---:|---:|---:|---:|
| AUTH (Signup→Discovery) | 138 | 137 | 122 | 13 | 1 |
| MSG (Messaging→Notifications) | 72 | 0 | 0 | 0 | 72 |
| TRD (TradeFlowV2) | 278 | 0 | 0 | 0 | 278 |
| ACC (Account/Dashboard/Help/Legal) | 73 | 0 | 0 | 0 | 73 |
| ADM (Admin Portal) | 159 | 0 | 0 | 0 | 159 |
| SUB (Subscriptions/Payouts/SP Wallet) | 100 | 0 | 0 | 0 | 100 |

**Key facts**

- All manual QA evidence on disk is **AUTH-guide** (groups A–S). The other five guides (**MSG, TRD, ACC, ADM, SUB**) have **no manual verdict rows** on record — their only coverage is the legacy automated-suite runs (appendix §6), which use a pre-prefix ID scheme and are not merged into the canonical rows below.
- 122 of 137 AUTH cases that have ever been run currently hold a PASS (many after fix→re-verify cycles). 13 remain STILL OPEN — 12 are fixture/config/environment or doc-drift blocks, 1 (Q04) is a stale-guide assertion with the underlying fee behavior verified.
- The `e2e-test-results/` corpus contains **58 report.md files** plus decision logs, results.json, and screenshot-only evidence; the full source register is in §5.

## 2 · Method (read-only reconciliation)

1. **Step 1 — Guides:** parsed the `## Test Case Index` table at the top of each of the 6 canonical files in `cross-checked-and-consolidated/`, extracting every TC-ID with its group and description (876 index rows → **820 unique TC-IDs**; some TC-IDs enumerate multiple sub-step assertions, e.g. `TRD-TC-O1` has 17 rows).
2. **Step 2 — Evidence:** scanned the whole repo for QA-run reports (`e2e-test-results/**/report.md`, `test-automation/trade-flow-v2/reports/**/report.md`, standalone reports, decision logs, results.json). Extracted per-case verdicts across the known report formats (verdict tables, section headers, inline `TC → VERDICT` prose, suffix-only tables, and `results.json` unit reconstruction for automated runs).
3. **Step 3 — Reconciliation:** for each canonical TC-ID, latest verdict = most recent evidence by (date, wall-clock start, path). **STILL OPEN** = latest verdict FAIL/BLOCKED with no later-dated PASS re-verification. **NEVER RUN** = no report on disk references it with a verdict. Curated attachments (fix-verify/re-verify reports asserting per-TC outcomes via Item/Check tables) are merged and documented in the source column.

**Scope limits (be explicit):**

- **Manual verdicts drive the canonical rows.** Automated-suite runs (May–Jun 2026) used a **legacy, pre-prefix ID scheme** (`TC-A01`, `REG-R01`, …) that does not map 1:1 to the current canonical IDs, and several of those runs were harness-broken (all-fail). They are reported separately in §6 rather than merged, to avoid falsely marking canonical cases as FAIL. 126/134 legacy IDs do map cleanly to a `TRD-TC-*` candidate (see §6.2).
- **Targeted spot-check / fix-verification reports** that don't assert per-TC verdicts (e.g. `group-p-reverify`, `spotcheck-*`, `tabbar-*`, `phase26`, `group-qs-fix-verify`) are listed in §7; where they re-verify a canonical case (L01–L04, P18, P19, Q06), the verdict was attached manually and is marked in the source column.

## 3 · Canonical coverage by guide

Columns: **Latest** = latest verdict on record · **Date** = date of that verdict · **Source** = run folder of the latest evidence · **Status** = `✅ PASS` / `🔴 STILL OPEN` / `⏭️ SKIPPED` / `NEVER RUN`.

### AUTH (Signup→Discovery) — 138 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status |
|---|---|---:|---|---|---|---|
| AUTH-TC-A01 | Successful signup with valid details | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-A02 | Field validation errors (name/email/phone/password) | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-A03 | Password mismatch + weak password | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-A04 | Under-18 date of birth blocked | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-A05 | Duplicate email blocked | 1 | PASS | 2026-08-23 | `spotcheck-sweeps-2026-08-23` | ✅ PASS |
| AUTH-TC-A06 | Optional referral code (valid / invalid handling) | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-A07 | Terms of Service & Privacy Policy links | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-A08 | Landing footer legal links (Terms / Privacy Policy) | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B01 | Successful login routes by onboarding status | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B02 | Invalid credentials error | 1 | PASS | 2026-08-23 | `spotcheck-sweeps-2026-08-23` | ✅ PASS |
| AUTH-TC-B03 | Forgot Password link | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B04 | Session restore after app kill/relaunch | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B05 | App resume refreshes silently (no spinner) | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B06 | Cold launch does not hang on spinner | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B07 | Empty-field + invalid-email inline validation | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B08 | ACCOUNT_DELETED login branch | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B09 | PROFILE_NOT_FOUND login branch | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B10 | Back button returns to previous screen | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B11 | Sign Up footer link | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-B12 | Log In footer link (Create Account) | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-C01 | Sign in / Continue with Google | 1 | PASS | 2026-08-16 | `phase21-auth-group-c01-google-2026-08-16` | ✅ PASS |
| AUTH-TC-C02 | Sign in / Continue with Facebook | 1 | PASS | 2026-08-16 | `phase20-auth-group-c-closure-2026-08-16` | ✅ PASS |
| AUTH-TC-C03 | Sign in / Continue with Apple (iOS + Android) | 1 | BLOCKED | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` | 🔴 STILL OPEN |
| AUTH-TC-C04 | Existing-email account-link prompt | 1 | PASS | 2026-08-19 | `qa-final-verify-e05-c04-2026-08-19` | ✅ PASS |
| AUTH-TC-C05 | Provider unavailable → email fallback banner | 1 | BLOCKED | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` | 🔴 STILL OPEN |
| AUTH-TC-C06 | User cancels OAuth — silent return | 1 | PASS | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` | ✅ PASS |
| AUTH-TC-C07 | Social-only user sets a password | 1 | BLOCKED | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` | 🔴 STILL OPEN |
| AUTH-TC-D01 | Logout from Profile with confirmation | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-D02 | Sign Out from Settings | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-D03 | After logout, app returns to Landing | 1 | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |
| AUTH-TC-E01 | OTP screen sends + verifies 6-digit code | 1 | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` | ✅ PASS |
| AUTH-TC-E02 | Incomplete / invalid / expired code errors | 1 | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` | ✅ PASS |
| AUTH-TC-E03 | Resend cooldown (60s) | 1 | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` | ✅ PASS |
| AUTH-TC-E04 | OTP rate limiting message | 1 | BLOCKED | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` | 🔴 STILL OPEN |
| AUTH-TC-E05 | Gate blocks first listing until verified | 1 | PASS | 2026-08-19 | `qa-final-verify-e05-c04-2026-08-19` | ✅ PASS |
| AUTH-TC-F01 | Active ZIP → assigned to node, no waitlist | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-F02 | Inactive ZIP → "We're Coming Soon!" + Join Waitlist | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-F03 | Waitlist confirmation + fallback node access | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-F04 | Continue Trading without joining waitlist | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-F05 | ZIP auto-lookup shows city/state | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-F06 | Node-scoped content (My Node vs Show All Nodes) | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-G01 | Admin creates an active node (ZIP auto-lookup) | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-G02 | Admin creates an inactive node | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-G03 | Admin edits a node | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-G04 | Admin deactivates a node with members (warning) | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-G05 | Admin reactivates a node | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-G06 | Node stats cards + validation | 1 | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |
| AUTH-TC-H01 | Profile Setup: avatar + display name + ZIP | 1 | PASS | 2026-08-24 | `group-j-h-closure-2026-08-24` | ✅ PASS |
| AUTH-TC-H02 | Profile Setup validation errors | 1 | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` | ✅ PASS |
| AUTH-TC-H03 | Avatar upload failure does not block | 1 | BLOCKED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-H04 | ~~Welcome screen → Get Started~~ (REMOVED — screen deleted; superseded by H06/H07) | 1 | BLOCKED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-H05 | ~~Feature Highlights carousel~~ (REMOVED — screen deleted; superseded by H06/H07) | 1 | BLOCKED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-H06 | Onboarding carousel: Next / Skip / Get Started | 1 | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` | ✅ PASS |
| AUTH-TC-H07 | Onboarding completion routes to Home | 1 | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` | ✅ PASS |
| AUTH-TC-I01 | ~~Start Free Trial enrolls Kids Club+~~ (REMOVED — no in-app trial-choice step; subscription purchase superseded by web-first `JoinKidsClubScreen` path) | 1 | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-I02 | ~~Continue Free stays on free tier~~ (REMOVED — post-Profile-Setup routes to EDU carousel → free-tier Home; no Continue Free step) | 1 | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-I03 | ~~Trial limit reached hides trial CTA~~ (REMOVED — no in-app trial CTA; trial disabled via `admin_config.trial_enabled=false`) | 1 | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-J01 | Photo-first gating (fields hidden until 1 photo) | 1 | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |
| AUTH-TC-J02 | AI auto-fill Apply All + per-field Use | 1 | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |
| AUTH-TC-J03 | Required field validation | 1 | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |
| AUTH-TC-J04 | Condition / Age Group / Gender / Color options | 1 | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |
| AUTH-TC-J05 | "Other" category → custom name required | 1 | PASS | 2026-08-24 | `group-j-h-closure-2026-08-24` | ✅ PASS |
| AUTH-TC-J06 | Payment preference — subscriber Accept SP toggle | 1 | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |
| AUTH-TC-J07 | Payment preference — free user upgrade prompt | 1 | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |
| AUTH-TC-J08 | SP earnings preview (subscriber) | 1 | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |
| AUTH-TC-J09 | Submit for Review → pending + success modal | 1 | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |
| AUTH-TC-J10 | Phone-verification gate before publish | 1 | — | — | `—` | NEVER RUN |
| AUTH-TC-J11 | Draft auto-save + resume | 1 | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |
| AUTH-TC-J12 | Listing photos — multiple upload, type and size validation | 1 | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |
| AUTH-TC-J13 | Listing photos — remove, reorder, replace, and persist after resume | 1 | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |
| AUTH-TC-J14 | Bonus category badge appears in picker and preview | 1 | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |
| AUTH-TC-J15 | Category-specific SP earn and buyer-cap preview recalculates | 1 | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |
| AUTH-TC-K01 | Multi-photo upload + auto-grouping | 1 | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |
| AUTH-TC-K02 | Regroup / merge / move photos | 1 | PASS | 2026-08-20 | `phase27-groupk-ax-reverify-2026-08-20` | ✅ PASS |
| AUTH-TC-K03 | Step indicator: Photos → Group → Review → Publish | 1 | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |
| AUTH-TC-K04 | Apply to All bar (brand/condition/age/gender) | 1 | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |
| AUTH-TC-K05 | Submit N Items for Review + confirm sheet | 1 | PASS (partial) | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |
| AUTH-TC-K06 | Bulk SP summary (subscriber) | 1 | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |
| AUTH-TC-L01 | New listing not visible in feed until approved | 1 | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` | ✅ PASS |
| AUTH-TC-L02 | Admin approves → item becomes visible | 1 | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` | ✅ PASS |
| AUTH-TC-L03 | Seller receives approval notification | 1 | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` | ✅ PASS |
| AUTH-TC-L04 | Editing an approved listing returns to pending | 1 | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` | ✅ PASS |
| AUTH-TC-M01 | Search bar (debounced) + clear | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M02 | Recent searches + autocomplete | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M03 | Sort options | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M04 | Filters modal: SP toggle, Location/Category/Age, More Filters, live count | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M05 | "Accepts SP" quick-toggle (header ↔ sheet sync) | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M06 | Empty / no-results states | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M07 | Recent Searches chip row + Clear | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M08 | Trending in {State} section | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M09 | Result count + active filter chips (incl. gold SP chip) | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-M10 | Discover header: bookmark → Favorites (local header) | 1 | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |
| AUTH-TC-N01 | Category browse filters results | 1 | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |
| AUTH-TC-N02 | Favorite heart toggle on item card | 1 | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |
| AUTH-TC-N03 | Infinite scroll pagination | 1 | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |
| AUTH-TC-N04 | "Accepts SP" badge on item card (gold, §6.7) | 1 | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |
| AUTH-TC-O01 | Results scoped to user's node | 1 | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |
| AUTH-TC-O02 | Location ZIP + radius filter | 1 | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |
| AUTH-TC-O03 | Inactive ZIP in filter → explicit waitlist opt-in (no auto-enroll) | 1 | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |
| AUTH-TC-O04 | Subscriber vs free SP visibility | 1 | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |
| AUTH-TC-O05 | Admin radius defaults and bounds reflect in Discover | 1 | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |
| AUTH-TC-P01 | Header node chip shows registered market (read-only) | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P02 | Header right cluster: bell + chat + avatar; logout removed from header | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P03 | Header chat icon opens Messages with unread badge | 1 | BLOCKED | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-P04 | Floating pill nav: order, margins, radius, shadow, safe area | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P05 | Inbox removed from nav; Messages via header chat only | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P06 | Trades tab: Active Trades (item, counterpart, status label) | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P07 | Trades tab: Trade History (reverse chronological) | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P08 | Trades badge counts active (not completed/cancelled) | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P09 | Basket badge + Home active state unchanged | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P10 | Post FAB globally visible + opens Sell sheet | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P11 | Composer bar: tap focuses, type, placeholder | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P12 | Composer "+" → New Item Photos step, Title pre-filled | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P13 | Composer empty submit → empty Title | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P14 | Composer camera → New Item straight to camera | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P15 | AI never overwrites composer-pre-filled Title | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P16 | FAB Sell sheet unchanged (parallel entry point) | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P17 | Logout still reachable from Profile/Settings | 1 | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |
| AUTH-TC-P18 | Composer analytics (tap + submit with/without text) | 1 | PASS | 2026-08-23 | `group-p-reverify-appheader-composer-2026-08-23` | ✅ PASS |
| AUTH-TC-P19 | Accessibility identifiers (Trades tab, header chat) | 1 | PASS | 2026-08-23 | `group-p-reverify-appheader-composer-2026-08-23` | ✅ PASS |
| AUTH-TC-Q01 | Education Help screen — published sections only | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-Q02 | Education Help screen — section by type | 1 | PASS (partial) | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-Q03 | SP calculator — sell mode (no hardcoded rates) | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-Q04 | SP calculator — buy mode (cash + fee + cap) | 1 | FAIL | 2026-08-23 | `group-qs-calibration-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-Q05 | SP calculator — bonus categories + example SP | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-Q06 | Education analytics — event tracking (no throw) | 1 | PASS | 2026-08-23 | `group-qs-fix-verify-2026-08-23` | ✅ PASS |
| AUTH-TC-Q07 | Education prompts — onboarding + in-app prompt state machine | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S01 | Forgot Password — success + Send Another Email | 1 | BLOCKED | 2026-08-23 | `group-qs-calibration-2026-08-23` | 🔴 STILL OPEN |
| AUTH-TC-S02 | Forgot Password — invalid email | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S03 | Forgot Password — rate-limit error | 1 | SKIPPED | 2026-08-23 | `group-qs-calibration-2026-08-23` | ⏭️ SKIPPED |
| AUTH-TC-S04 | Forgot Password — SMTP-config (500) error | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S05 | Forgot Password — 400 error | 1 | SKIPPED | 2026-08-23 | `group-qs-calibration-2026-08-23` | ⏭️ SKIPPED |
| AUTH-TC-S06 | Forgot Password — Back to Login | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S07 | Reset Password — validation + requirements card | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S08 | Reset Password — success → Login | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S09 | Reset Password — link-error (expired) → Request New Reset Email | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S10 | Reset Password — no active reset session | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |
| AUTH-TC-S11 | Deep link `p2pkidsmarketplace://reset-password` | 1 | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |


### MSG (Messaging→Notifications) — 72 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status |
|---|---|---:|---|---|---|---|
| MSG-TC-A01 | Conversation list (search, unread badges, empty state) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A02 | Open a chat thread + trade context banner | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A03 | Send a text message + delivery status (sent→delivered→read) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A04 | Receive a message in real time | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A05 | Typing indicator | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A06 | Send an image message + full-screen viewer | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A07 | Message length limit (2000 chars) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A08 | Quick-reply meeting chips | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A09 | Safety meeting banner + Learn more | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-A10 | Photo permission denied error | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-B01 | My Badges grid (earned vs locked) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-B02 | Badge detail modal | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-B03 | Badge showcase on profile | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-B04 | Badge celebration modal on unlock | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-B05 | Leaderboard ranking | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-C01 | Submit a post-trade review (stars + comment) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-C02 | Rating required validation | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-C03 | Anonymous review | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-C04 | Skip review | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-C05 | Review display on seller profile + aggregate rating | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-C06 | Report a review (reviewee only) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D01 | Start ID verification + upload from library | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D02 | Capture ID with camera | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D03 | Submit creates pending request | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D04 | Duplicate pending request blocked | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D05 | No-image submit validation | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D06 | Pending state screen | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D07 | Approved → Verified badge on profile | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D08 | Rejected → reason shown + resubmit | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D09 | Submission confirmation notifications reach the user | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-D10 | Decision notifications honor channel preferences | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-E01 | Review queue (stats, filters, search) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-E02 | Approve a request | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-E03 | Reject with reason | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-E04 | View completed request details | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-E05 | Edit message templates | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-E06 | New submission creates admin alert notification | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F01 | View referral code + hero | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F02 | Copy referral code | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F03 | Share referral code (native share) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F04 | Active rewards display | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F05 | Referral history (pending vs completed) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F06 | Enter referral code at signup | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F07 | Program paused banner + disabled share | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-F08 | Admin configures referral rewards | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G01 | Listing flagged → Safety Review screen | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G02 | Appeal a flagged/rejected listing | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G03 | Resubmit a "needs edits" listing | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G04 | Remove a flagged listing | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G05 | Recall safety alert notification | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G06 | Appeal max-attempt limit follows admin config | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G07 | Appeal window follows admin config | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G08 | AI moderation toggle affects automated image review | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-G09 | Recall check toggle and threshold affect recall flagging | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-H01 | Flagged items moderation queue | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-H02 | Approve a flagged item | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-H03 | Reject with reason | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-H04 | Request edits | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-H05 | Trade dispute: mark under review | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-H06 | Trade dispute: resolve complete / refund | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-I01 | Enable push notifications | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-I02 | Push error states (Expo Go / web) | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-I03 | Notification center list + icons | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-I04 | Tap notification → deep link + mark read | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-I05 | Mark all as read | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-I06 | Pagination + pull to refresh | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-I07 | Real-time arrival | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-J01 | Category × channel toggles | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-J02 | Default preferences | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-J03 | Safety alerts always-on note | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-J04 | Quiet hours (subscriber) + validation | 1 | — | — | `—` | NEVER RUN |
| MSG-TC-J05 | ID verification preference controls decision delivery | 1 | — | — | `—` | NEVER RUN |


### TRD (TradeFlowV2) — 278 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status |
|---|---|---:|---|---|---|---|
| TRD-TC-A01 | Cash Only: full happy path (buyer confirms) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-A02 | Accept SP: Use SP slider → seller accepts → buyer confirms | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-A03 | Accept SP: Pay Cash (0 SP) — subscriber seller still earns SP | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-A04 | Donate listing: [Claim] button, no charge | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B01 | Seller declines offer | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B02 | Offer expires (seller never responds) + seller ignore prompt | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B03 | Multiple competing offers — sort order + auto-decline | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B04 | Buyer cancels pending trade — no consequence level | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05 | Per-seller cap: max 3 pending offers per seller (2026-07-18) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05a | Per-seller cap: Buyer at 3 with Seller A can still submit to Seller B | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05b | Per-seller cap: Blocked at 4th offer to same seller | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05c | Per-seller cap: Bundle offer counts as 1 slot, not N | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05d | Per-seller cap: Expired offer frees slot immediately | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05e | Regression: No leftover global cap blocks buyer over old global limit | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05f | Admin config: Change offer cap from 3 to 5 on Trade Timing page | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05g | Admin config: Revert cap from 5 back to 3 (forward-looking only) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05h | Admin config: Validation — reject invalid values (0, 11) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05i | Mobile client: Config fetch failure — graceful degradation | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B05j | Regression: Per-seller scope + bundle=1 still hold after config change | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B06 | Card declined at offer submission | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B07 | Expired offer timeline — no message button | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B08 | Chat frozen after trade is cancelled or completed | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B09 | Chat remains active for in_progress trades | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B10 | Replace Card path (saved card → new card) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B11 | Subscribe-upsell → JoinKidsClub | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B12 | SP info tooltip (not wired — flag) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-B13 | Duplicate-offer modal navigation (dead code — flag) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C01 | SP reserved on offer submission | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C02 | SP restored to buyer on seller decline | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C03 | SP restored to buyer on offer expiry | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C04 | SP stays reserved when seller accepts | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C05 | SP released to seller at trade completion | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C06 | SP restored to buyer on seller cancel (in_progress) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C07 | Free user sees locked Use SP button + upgrade modal | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-C08 | SP slider capped at 50% of item price | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-D01 | Auto-complete when buyer never taps I Got It | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-D02 | Auto-complete skipped when dispute is open | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-D03 | Offer countdown pill color states | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-D04 | Auto-complete banner visible to buyer only | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-D05 | Post-meetup nudge after auto-complete | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-D06 | Pickup window drives the auto-complete deadline (R2 — configurable) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E01 | Buyer opens Report a Problem modal | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E02 | Disputed trade does not auto-complete | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E03 | Buyer UI during active dispute | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E04 | Seller UI during active dispute | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E05 | Admin resolves dispute → Complete | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E06 | Admin resolves dispute → Refund | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E07 | Trade Dispute — no reason (disabled submit) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E08 | Trade Dispute — reason selected (non-Other) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E09 | Trade Dispute — "Other" + min-20 description | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-E10 | Trade Dispute — submitting + confirm + success/error | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-F01 | Payout shown on completion (no dispute) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-F02 | Payout held when dispute is open | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-F03 | Payout needs action when seller has no payout method | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-G01 | Offer expiry reminders to seller | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-G02 | Auto-complete reminders to buyer | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-G03 | Notification throttle per trade | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-G04 | Push notifications deep-link to correct screen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-G05 | Pickup-window reminders to buyer (R2) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-H01 | Free buyer sees subscription CTA | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-H02 | Subscriber buyer used SP — "You saved $X" | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-H03 | Subscriber seller on Accept SP listing — SP pending notice | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-H04 | Subscriber seller on Cash Only listing — upsell | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-H05 | Subscription lifecycle — trial / paid / cancel regression | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I01 | Safe meetup card on in_progress trade | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I02 | Safe meetup card dismissible per trade | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I03 | In-chat safety banner persistent | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I04 | Pre-first-message safety modal once per listing | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I05 | Chat quick-reply chips on in_progress trade | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I06 | Liability disclaimer modal gates purchase (checkbox + Accept & Continue) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I07 | Disclaimer modal Cancel path — no trade created | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I08 | Disclaimer modal ✕ close behaves like Cancel | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I09 | Disclaimer checkbox resets to unchecked on reopen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I10 | Disclaimer modal loading state | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-I11 | Disclaimer modal not shown for non-trade actions | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-J01 | Seller cancels in_progress trade → Level 1 | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-J02 | 2nd post-acceptance cancel → Level 2 | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-J03 | 3rd post-acceptance cancel → Level 3 | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-J04 | Seller cancel button only on in_progress | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-J05 | Seller cancel modal shows seller reasons only | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K01 | Subscriber sees $0.99 fee + Sales Tax line in value stack | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K02 | Non-subscriber sees $2.99 fee + Sales Tax line in value stack | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K03 | SP discount row conditional on SP used | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K04 | Bundle checkout — fee charged per item (admin toggle OFF) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K05 | Bundle checkout — one fee per bundle (admin toggle ON) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K06 | Bundle timeline — fee display matches charge mode | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K07 | Admin partial refund — refund price only, keep fee | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K08 | Admin partial refund — tax ledger partially refunded | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K09 | Payments reconciliation page — charged vs refunded per trade | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K10 | Server-side enforcement — one-fee-per-bundle with stale client | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-K11 | Seller fee = 5% × cash portion (SP trade) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L01 | Bundle banner on trade detail | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L02 | Confirm All shortcut for bundle (buyer) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L03 | Bundle offer rows in Offers tab (seller) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L04 | Non-bundle offers render as single rows | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L05 | In-progress bundles section in Buying tab | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L06 | Bundle banner in Review Offer screen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L07 | Accept All N Items in Review Offer screen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L08 | Individual accept/decline alongside bundle siblings | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L09 | **Bundle card in Your Offers (buyer)** | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L10 | Bundle cancel prompt (buyer + seller) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-L11 | Bundle checkout skips items already in an active trade — buyer notified, flow continues | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M01 | Add first item → active cart created | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M02 | Add second item from same seller | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M03 | Add item from different seller → choice modal | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M04 | Replace Cart option | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M05 | Cannot add own item to cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M06 | Cannot add unavailable / out-of-node item | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M07 | Duplicate item prevented in same cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M08 | Remove item from cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M09 | Clear cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M10 | Saved carts: max 3, LRU eviction, switch cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M11 | Minimum cart value warning + checkout blocked | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M12 | Max SP available shown per cart item (subscriber) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M13 | Realtime: item becomes unavailable while in cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M14 | Favorites add / remove | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M15 | Favorites screen: availability + empty state | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M16 | Success toast appears and auto-dismisses on add-to-cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M17 | Cart badge increments in sync with toast | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M18 | Toast copy uses "Trade Basket" terminology | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M19 | Home dashboard Favorites quick-action tile navigates to Favorites | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-M20 | Discover header heart icon navigates to Favorites | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N01 | Admin sets minimum cart value → reflects in app | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N02 | Admin minimum cart value validation | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N03 | Admin updates Minimum Listing Price on Config → Fees tab | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N04 | Seller cannot publish single-item listing below threshold | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N05 | Bulk: below-threshold items flagged, valid items publish | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N06 | Existing listing auto-paused when threshold raised above price | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N07 | Seller raises price to meet threshold → listing repurchasable | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N08 | Regression: single-item + bundle checkout at/above threshold | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N09 | Price adjustment modal displays correct copy and button text (single-item) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N10 | "Update Price" dismisses modal and auto-scrolls + auto-focuses price field (single-item) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N11 | Price adjustment modal in edit listing flow (single-item edit) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N12 | Bulk listing: per-item chip shows dynamic threshold in missing-required warning | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N13 | Bulk listing: publish failure shows clear error message for below-threshold items | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N14 | Regression: minimum-price validation still blocks publish in single-item and bulk flows | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-N2 | Retried offer submission → exactly 1 PaymentIntent / 1 trade / 1 SP reservation / 1 audit row | 10 | — | — | `—` | NEVER RUN |
| TRD-TC-O01 | Sales tax shown in checkout/cart breakdown (0 SP) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O02 | Tax base stays on full item price as SP slider moves (offer + checkout) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O03 | Tax $0 when globally disabled | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O04 | Tax $0 when node tax disabled | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O05 | Tax-exempt user sees Tax Free badge | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O06 | Transaction history shows tax details | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O07 | Refund shows proportional tax refunded | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O08 | Tax shown on trade timeline/detail for buyer only | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-O1 | Admin creates a new tax rule for general_tangible_goods | 17 | — | — | `—` | NEVER RUN |
| TRD-TC-O2 | Single taxable item, no SP — offer is quoted/authorized, not collected | 12 | — | — | `—` | NEVER RUN |
| TRD-TC-O3 | Buyer wording: "Payment authorized" before capture (Awaiting Seller) | 14 | — | — | `—` | NEVER RUN |
| TRD-TC-P01 | Node tax rate config (view/edit, validation) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-P02 | Bulk tax update across nodes | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-P03 | Tax rate change history / audit | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-P04 | Global tax settings toggle + warning banner | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-P05 | Tax reporting dashboard: summary + date presets | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-P06 | Jurisdiction breakdown + 7 report types | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-P07 | CSV export for filing | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-P08 | Admin changes rate → new transactions use new rate | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q01 | Review prompt ([Rate Seller] / [Rate Buyer]) on completion | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q02 | Star rating required — submit blocked without rating | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q03 | Comment optional, max 500 characters | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q04 | Anonymous review hides reviewer identity | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q05 | Skip review — no blocking, no re-prompt for same trade | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q06 | Mutual review status shown on completed trade detail | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q07 | Completed reviews visible on counterparty's profile | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q08 | Average rating and total review count on user profile | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q09 | Rating breakdown (5 → 1 stars) on profile | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q10 | Edit review succeeds within 24h window | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q11 | Edit blocked after 24h window | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q12 | One review per trade — duplicate submission blocked | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q13 | 30-day same-counterparty cooldown enforced | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q14 | 24h post-completion cooldown — review locked | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q15 | Flag a review (select reason) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q16 | Auto-hide review after 3+ reports | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q17 | Cannot flag own review | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q18 | Admin moderation queue — reported reviews with counts | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q19 | Admin approves (unhides) a reported review | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Q20 | Admin deletes a reported review | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R01 | Buyer cancels pending trade → cancelled, auth voided, SP restored | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R02 | Seller declines pending offer → cancelled, SP restored | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R03 | Offer expiry → auto-cancel + competing offers cancelled | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R04 | Card declined at offer submission → no trade created | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R05 | Seller cancels in_progress → refund + consequence level | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R06 | Refund settlement breakdown (cash + proportional tax + fee) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R07 | SP reversal on refund (reserved/transferred returned) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R08 | Seller payout withheld / cancelled on refund | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R09 | Admin dispute resolve → Refund (full settlement) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R10 | Admin dispute resolve → Complete (no refund) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R11 | Refund / cancellation notifications to both parties | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R12 | Refund idempotency — no double refund | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-R13 | Cancelled / refunded trade status + timeline | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S01 | Different-seller modal uses generic copy (no seller name leak) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S02 | "More from this seller" icon appears only when 2+ approved listings | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S03 | "More from this seller" icon hidden when seller has exactly 1 listing | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S04 | Tapping icon opens "More from this seller" page — no seller identity | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S05 | Add to Cart from filtered seller page populates cart correctly | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S06 | "Matches Your Cart" indicator on filtered seller page | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S07 | Bundle CTA appears on CartScreen with 2+ same-seller items | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S08 | Bundle CTA hidden with single item or empty cart | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S09 | Bundle CTA navigates to checkout in bundle mode | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S10 | Bundle checkout shows "Bundle Offer" banner | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S11 | Regression: Discover/search grid unchanged (no badges) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S12 | Regression: single-item offer flow unchanged | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S13 | Regression: seller identity unlocks only post-acceptance | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S14 | More from seller — Item Detail CTA in standalone position (below seller card) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S15 | More from seller — Item Detail CTA hidden at 0 additional listings | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S16 | More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S17 | More from seller — Trade Basket banner shows correct remaining-item count | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S18 | More from seller — Trade Basket banner recalculates after adding item from filtered page | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S19 | More from seller — Trade Basket banner disappears when all seller's listings are in basket | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S20 | More from seller — Trade Basket banner dismissible via X button | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S21 | More from seller — Banner and filtered page never reveal seller identity | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S22 | Regression: Seller Info card elements unchanged | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S23 | Regression: Trade Basket subtotal/total/bundle CTA layout unaffected | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-S24 | More from seller — Return-to-Cart navigation after adding item from filtered page | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T01 | Points toggle appears only on eligible items; ineligible show "Not eligible" label | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T02 | Toggle ON applies correct amount (wallet + category cap both sufficient) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T03 | Toggle ON applies partial amount with "balance limit" label when wallet insufficient | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T04 | Category cap limits applied points even when wallet covers more | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T05 | Toggle OFF restores balance for sequential allocation | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T06 | Running "Points remaining" counter updates accurately across multiple toggles | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T07 | Order Summary "Points Applied" line and cash total correct after multiple toggles | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T08 | Seller Review Offer shows per-item points breakdown | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T09 | Seller Review Offer shows "Total Payout" and "Buyer's Total Paid" correctly | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T10 | "Includes points redemption" tag on seller's offer list/inbox card | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T11 | Wallet ledger: buyer debited, seller credited + bonus on acceptance | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T12 | No ledger transaction on offer decline | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T13 | Regression: single-item (non-bundle) offer flow with SP still works | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-T14 | Regression: bundle CTA, different-seller modal, "more from this seller" still functional | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-U01 | Root/tab screens use pattern 1 (no back button, greeting/avatar/title, bell) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-U02 | Secondary/detail screens use pattern 2 (back button + title + bell) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-U03 | Notification bell behavior + badge accuracy | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-U04 | Screens without ScreenLayout still have working headers | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-U05 | Checkout/payment screens intentionally hide the bell | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V01 | "Trade Basket" appears in bottom tab bar | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V02 | "Trade Basket" appears as screen title on Cart screen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V03 | Empty state shows "trade basket" in copy | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V04 | "View Trade Basket" button on Item Detail screen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V05 | "Add to Trade Basket" button on More from This Seller screen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V06 | "In Trade Basket" status on More from This Seller items already in basket | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V07 | "Added to Trade Basket" alert on item add | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V08 | "Matches Your Trade Basket" badge on matching items | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V09 | Different-seller modal references "trade basket" | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V10 | Bundle CTA says "Make one offer" (no "Bundle" visible) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V11 | "Combined Offer" banner on checkout (no "Bundle" visible) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V12 | Bundle Builder screen title shows "Build Offer" (no "Bundle" visible) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V13 | Favorites "Added to Trade Basket" alert copy | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-V14 | Functional behavior unchanged (adding items, submitting offers) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W01 | Trades page has "Single Trades" and "Bundle Trades" tabs | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W02 | Single Trades tab shows only non-bundle trades | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W03 | Bundle Trades tab groups trades by bundle_id | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W04 | Bundle row shows item count, totals, buyer/seller, statuses | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W05 | Clicking a bundle row navigates to bundle detail page | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W06 | Bundle detail page lists all trades in the bundle | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W07 | Bundle detail page shows monetary breakdown | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W08 | Each trade row links to individual trade detail | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W09 | Bundle detail page has "Force Cancel Entire Bundle" action | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W10 | Force Cancel succeeds for all trades in the bundle | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W11 | Status filter works in Bundle Trades view | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-W12 | Tab toggle resets filters when switching views | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X01 | Bottom nav renders identically on Home (Dashboard) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X02 | Bottom nav renders identically on Discover | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X03 | Bottom nav renders identically on Trades | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X04 | Bottom nav renders identically on Trade Basket | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X05 | Bottom nav renders on Item Detail / Cart Checkout / Trade screens | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X06 | Bottom nav renders on Profile, Settings, Wallet, Subscriptions | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X07 | Cart badge shows item count from multiple entry points | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X08 | Cart badge count accuracy — add / remove / clear | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X09 | "Me" tab removed — Profile still accessible via Home avatar | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X10 | Sell FAB opens action sheet on every screen | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-X16 | Flow Registry (nav) — flow-registry.md entries updated | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y01 | Trade List summary filter chips | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y02 | Trade List Load More history pagination | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y03 | Trade List Message button on rows | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y04 | Trade List "See all →" link | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y05 | R15 — Request More Time (requester) | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y06 | R15 — counterparty Accept | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y07 | R15 — counterparty Decline | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y08 | R15 — granted state | 1 | — | — | `—` | NEVER RUN |
| TRD-TC-Y09 | "What to do next" card + "Got it" toggle | 1 | — | — | `—` | NEVER RUN |


### ACC (Account/Dashboard/Help/Legal) — 73 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status |
|---|---|---:|---|---|---|---|
| ACC-TC-A01 | Settings screen sections + rows render | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-A02 | Sign Out confirmation | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-A03 | Test Push Notification (rate limit / quiet hours / queued) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-A04 | Settings → legal & help links navigate | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-A05 | "Manage Payment Methods" row navigates | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B01 | Edit profile fields load + save (optimistic) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B02 | Email change requires re-verification | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B03 | Phone change → OTP verification modal | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B04 | Avatar upload | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B05 | Profile screen stats, badges, reviews, status badge | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B06 | Form validation (phone 10-digit, email format) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B07 | "No Changes" alert | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B08 | Waitlist prompt (unreachable from Edit Profile — flag) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B09 | "Already verified" phone path | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-B10 | Locked-field "cannot be changed" alerts | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-C01 | Linked accounts list (email readonly, password, social) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-C02 | Link a social provider (password re-auth gate) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-C03 | Unlink provider (confirmation + last-method guard) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-C04 | Email mismatch on link blocked | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-D01 | Five categories × three channel toggles | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-D02 | Optimistic toggle reverts on failure | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-D03 | Quiet hours toggle + time validation | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-D04 | Empty state → Initialize Settings | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-E01 | Delete account consequences + password gate | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-E02 | Wrong password blocked | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-E03 | Two-step confirmation → deletion + logout | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-F01 | Suspended account screen (logout only) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-F02 | Unsubscribe via email token (success/error) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-F03 | Offline screen + Try Again | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-F04 | Suspended account — Log Out tap | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G01 | Greeting + subscription badge + SP balance | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G02 | Priority banners (grace > payment fail > trial > draft) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G03 | Quick action tiles route correctly | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G04 | ID verification CTA banner (dismissible) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G05 | Recommendations + recent trade card | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G06 | Pull-to-refresh reloads dashboard | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G07 | "Show more actions" toggle | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G08 | Free-user "Unlock Swap Points" strip | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G09 | "No session found" state | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G10 | Empty-trade state | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G11 | "View Timeline" nav | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G12 | "See All" → Discover nav | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-G13 | Subscription-card Upgrade button | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-H01 | Help & Support menu (3 cards) routes | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-H02 | FAQ list — search + category filter | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-H03 | FAQ fallback when offline | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-H04 | FAQ detail — helpful vote (Yes/No) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-H05 | Contact Support form (auth gate + validation) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-I01 | Education Help screen sections (accordion + deep link) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-I02 | SP Calculator (free mode) sell/buy outputs | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-I03 | SP Calculator bonus category badge | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-I04 | SP Calculator validation (price range) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-I05 | Education analytics events fire | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J01 | Terms of Service view + last updated | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J02 | TOS acceptance flow (requireAcceptance) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J03 | Privacy Policy view + acceptance | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J04 | Liability Disclaimer view (read-only + retry) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J05 | Policy versioning — re-acceptance on new version | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J06 | Signup implies TOS + Privacy agreement (no mandatory dialog) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J07 | Legal screen unavailable state (no published policy) | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J08 | Legal screen load failure — error + Retry | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J09 | Very long policy content renders + scrolls smoothly | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J10 | Legal screens render consistently on iOS and Android | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J11 | Legal screen loads < 2s and scrolls without lag | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-J12 | Liability Disclaimer unavailable state | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-K01 | MFA factors list + enrollment entry points | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-K02 | Enroll and verify an authenticator factor | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-K03 | Protected action prompts MFA challenge + invalid code handling | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-K04 | Recovery path and remove verified factor | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-L01 | Render-time error shows fallback instead of red/white screen | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-L02 | Try Again recovers after transient error | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-L03 | Persistent error stays contained to fallback | 1 | — | — | `—` | NEVER RUN |
| ACC-TC-L04 | Error reporting is safe with and without telemetry | 1 | — | — | `—` | NEVER RUN |


### ADM (Admin Portal) — 159 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status |
|---|---|---:|---|---|---|---|
| ADM-TC-A01 | Admin login with admin role | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-A02 | Non-admin login rejected (RBAC gate) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-A03 | Dashboard layout: intro → health strip → Action Center → KPIs (no duplicate nav) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-A04 | Direct protected route access without session redirects to login | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-A05 | Expired session redirects once without a loop | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-A06 | Dashboard KPI cards follow design-system styling | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B01 | User list, search, status filters, pagination | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B02 | User detail drawer (identity, subscription, SP, trades) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B03 | Suspend / ban / delete account | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B04 | Credit/debit SP + freeze wallet from user | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B05 | User analytics cards (totals, DAU/MAU) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B06 | Reset Password action | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B07 | Unsuspend action | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-B08 | Sort By / Sort Order | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C01 | Listing management — search & analytics tabs | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C02 | Flagged items — filter tabs + statuses | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C03 | Approve flagged item | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C04 | Reject item with required reason | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C05 | Item detail view + appeal info | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C06 | Force Delete | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C07 | Pause | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C08 | Approve | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C09 | Request Edits | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C10 | Reject | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C11 | Select-all / selection counter (no bulk execute — flag) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-C12 | Individual filter controls | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D01 | Category list, filters (incl. Bonus), search | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D02 | Create / edit category + SP multiplier | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D03 | Activate / deactivate category | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D04 | Category suggestions queue + count badge | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D05 | Icon / badge upload | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D06 | SP spending cap % | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D07 | SP redemption cap | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D08 | Drag-and-drop reorder | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D09 | Bulk actions (Activate / Deactivate / Delete / Export CSV) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D10 | Delete category + guards | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-D11 | Suggestion Approve / Merge / Reject | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E01 | Geographic nodes list + stats | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E02 | Add / edit node | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E03 | Deactivate node with members warning | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E04 | Node settings (radius validations) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E05 | ZIP waitlist queue + status filter | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E06 | Node tagging completeness (N6) — every record resolves to one node | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E07 | Per-node KPIs (N6) — expansion-gate metrics per node | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-E08 | Waitlist API authorization (401 without admin session) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F01 | Global configuration inline edit + permission gate | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F02 | Cart settings (min value, max carts, expiry) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F03 | Trade timing config (timing keys + nested validation) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F04 | Settings single-source — cross-link + last-updated + audit | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F05 | N1 configurability — pickup countdown + payout buffer (new keys) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F06 | R2 — 7-day trade-window guardrail (hard block) + pickup reminders (new keys) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F07 | Trade Pipeline visualization — see & track trades in all stages | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F08 | R1 tiered buyer-fee fields | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F09 | Buyer Fee-Tier Distribution table | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F10 | Legacy fee keys | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-F11 | Reset button | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-G01 | Policy tabs (TOS/Privacy/Liability) + versions | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-G02 | Create new policy version (version regex) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-G03 | Edit draft policy | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-G04 | Publish policy (confirmation) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-H01 | Trade list filters + columns | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-H02 | Trade detail (info, monetary breakdown, audit) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-H03 | Trade admin actions | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-H04 | Subscription Context section | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-H05 | External References (Stripe PI/refund + SP ledger IDs) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-H06 | Sales Tax line in monetary breakdown | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-I01 | Dispute queue + SLA highlighting | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-I02 | Mark dispute under review | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-I03 | Resolve dispute — Complete | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-I04 | Resolve dispute — Refund | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-I05 | Filter-tab click behavior (All/Reported/Under Review) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-J01 | Tax admin entry points (cross-ref TradeFlow Group P) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-K01 | Payout fee configuration + test breakdown | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-K02 | Payouts management list, stats, filters | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-K03 | Retry failed payout (confirmation) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L01 | SP Economy hub tabs (Health/Flow/Rules) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L02 | SP Analytics dashboard + CSV export | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L03 | SP Wallet admin — economy metrics + search | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L04 | SP adjustment (credit/deduct) with reason | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L05 | Freeze / unfreeze / suspend wallet | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L06 | SP Wallet entry points — home card, summary metrics, sidebar link | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L07 | SP Wallet state RPC — get_user_sp_wallet_summary returns wallet_state | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-L08 | SP Wallet warning banners (mobile) — frozen/suspended/grace | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-M01 | Grace period config (days + reminders) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-M02 | Subscriptions list, filters, metrics | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-M03 | Extend / cancel / reactivate | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-M04 | Reactivate button (confirm + mobile reflection) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-M05 | Metrics cards (MRR/churn/trial) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-M06 | "free" status filter | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-N01 | Referral configuration tab | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-N02 | Referral analytics tab | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-N03 | 5 SP fields + 3 toggles | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-N04 | "Missing configuration" warning | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-N2 | Financial audit journal viewable per trade | 8 | — | — | `—` | NEVER RUN |
| ADM-TC-O01 | ID badge queue + stats + status filter | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-O02 | Review request — approve | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-O03 | Review request — reject with reason | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-O04 | Request details (screenshot deleted note) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-O05 | Message templates edit | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-P01 | Badge management list + toggle | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-P02 | Create/edit/delete badge | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-P03 | Manual award badge | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-P04 | Badge sandbox event simulation | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Q01 | Reported reviews list + reason filter | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Q02 | Hide review (confirmation) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Q03 | Approve review (unhide + delete reports) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Q04 | Status filter dropdown | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Q05 | Sort-by dropdown | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Q06 | Search input | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-R01 | Education sections/examples/analytics | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-R02 | FAQ management (questions/categories/analytics) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-R03 | Publish FAQ / education content | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-S01 | Support inbox + unread filter | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-S02 | Support detail + mark as read | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-T01 | Revenue & Analytics dashboard | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-T02 | Notification analytics (category/type/variant) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-U01 | Audit logs view | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-V01 | Monitoring run + alerts (acknowledge/note) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-V02 | Cron jobs status + run history + timezone | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-W01 | Sidebar grouped into 7 labeled sections | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-W02 | Expand / collapse a section via label + chevron | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-W03 | Section state persists per admin across sessions | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-W04 | Active route auto-expands its parent section | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-W05 | Active/inactive item styling + label typography | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-W06 | Collapsed icon rail shows all destinations | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-W07 | All previous nav destinations still reachable | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X01 | Action Center page loads aggregated cards | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X02 | Same-type items bundled with count | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X03 | Severity tags (Urgent/Routine) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X04 | Expand card drills into item list | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X05 | Inline approve flagged item | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X06 | Inline mark dispute under review | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X07 | Inline retry failed payout (confirmation) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X08 | Empty state "All caught up" | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X09 | Sidebar pinned nav item + live count badge | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X10 | Header bell opens Action Center + badge | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X11 | Config drift card lists out-of-range settings | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X12 | Dashboard embeds top-5 Action Center cards + View all link | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X13 | Cancellation Insights card drill | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-X14 | /cancellation-insights full page | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y01 | ⌘K / Ctrl+K opens the palette from any page | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y02 | Header search bar opens the palette | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y03 | Parallel search across 4 entity types with grouped labels | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y04 | Breadcrumb context per result row | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y05 | Input debounced ~200ms | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y06 | Top 5 per group + "See all N results" expansion | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y07 | Footer "View all in <domain>" → prefilled list page | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y08 | Selecting a result navigates directly | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y09 | Keyboard navigation (↑/↓/↵/Esc) + focus trap | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y10 | Non-admin rejected (permission scoping) | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y11 | Secret settings values never shown | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Y12 | Empty + no-results states | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Z01 | Health strip renders below title, above Action Center | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Z02 | Six indicators with colored dots + labels + values | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Z03 | Dot color reflects configurable thresholds | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Z04 | Clicking an indicator navigates to its detail page | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Z05 | Failed Payouts deep-link pre-filters to failed | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Z06 | Thresholds tunable via /config (health) without code change | 1 | — | — | `—` | NEVER RUN |
| ADM-TC-Z07 | Dashboard embeds Action Center below the strip | 1 | — | — | `—` | NEVER RUN |


### SUB (Subscriptions/Payouts/SP Wallet) — 100 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status |
|---|---|---:|---|---|---|---|
| SUB-TC-A01 | Subscription Plans screen — Free vs Kids Club+ cards | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-A02 | Plan Comparison table — feature-by-feature + POPULAR badge | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-A03 | Dynamic pricing & fees pulled from admin config | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-A04 | Current plan reflected (button disabled / "Current Plan") | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-A05 | Kids Club+ Overview screen by subscription status | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B01 | Start free trial from Plans → payment screen | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B02 | Payment screen benefits + pricing + "Due today $0.00" (trial) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B03 | Complete Stripe payment → Success screen | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B04 | Trial already used — blocked with support/subscribe options | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B05 | Trial disabled globally — Free tier only | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B06 | Continue Kids Club+ (mid-trial) urgency + benefits | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B07 | Referred user warned about bonus loss before choosing Free | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B08 | Admin changes trial-limit config → trial CTA updates | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B09 | Cancel Stripe payment sheet — no error, retry available | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B10 | Card declined — clear error + retry | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B11 | Re-subscribe reuses saved payment method (1-click) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B12 | Network error during payment — retry succeeds | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-B13 | Apple Pay / Google Pay payment | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C01 | My Subscription screen — paid member view | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C02 | My Subscription quick menu (Billing / Payment / Help) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C03 | Manage Kids Club+ — status, next billing, days remaining | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C04 | Cancel flow — retention screen "Keep My Benefits" | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C05 | Cancel reason modal + final confirmation | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C06 | Cancelled subscription stays active until period end | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C07 | Auto-renew toggle / update payment method | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C08 | Manage Kids Club+ free/no-subscription state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C09 | Manage Kids Club+ expired state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C10 | My Subscription free-user state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C11 | My Subscription "Learn More" link | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-C12 | My Subscription "Member Since" value (latent bug) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-D01 | Grace period banner + SP wallet frozen warning | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-D02 | Re-subscribe from grace period | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-D03 | Subscription Expired screen — benefits lost + Renew | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-D04 | Renew (isRenewal) — payment screen "Due today" = full price | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-D05 | Reactivate from cancelled state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-D06 | Subscription event notifications (trial reminders, renewal, failure) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-D07 | Grace reminder notifications follow configured thresholds | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-E01 | Billing History list — records, status badges, amounts | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-E02 | Billing History empty state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-E03 | Failed charge shows error message | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-E04 | Subscription Status screen — Stripe IDs + period + retries | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F01 | Payout Dashboard hero (SP balance + AUD equivalent) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F02 | Payout method section (add vs existing) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F03 | Payout history list (completed / pending) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F04 | Seller Earnings screen — totals, pending, payout breakdown | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F05 | Seller Earnings empty state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F06 | Pending earnings release follows admin-configured delay | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F07 | Seller Earnings error state + Retry | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-F08 | Seller Earnings Load More pagination | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G01 | Add Stripe Connect payout method (onboarding) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G02 | Add PayPal / Venmo payout method | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G03 | Add Bank ACH payout method | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G04 | Set primary method / delete method (confirmation) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G05 | Unverified method blocks payout | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G06 | requires_action payout → "Set Up Payout Method" | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G07 | Payout Settings — "Edit Details" sheet | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G08 | "Cannot Delete Primary/Only Method" guard | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G09 | "Cannot Set as Primary" (unverified) guard | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G10 | Payout history Load More | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-G11 | NoMethodModal flow | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-H01 | Request Payout — amount validation vs available | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-H02 | Fee + net summary by method type | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-H03 | Confirm Payout success | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-H04 | Request blocked when no method / unverified | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-H05 | Withdraw Now from Payout Settings hero | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-H06 | Admin minimum withdrawal blocks smaller payouts | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-H07 | Minimum withdrawal disabled when config = 0 | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I01 | SP Wallet hero balance + lifetime stats | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I02 | Quick actions (Shop / Sell / History) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I03 | How to Earn SP section + Learn More | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I04 | SP expiration info + expiring-soon alert | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I05 | Wallet warning banner by state (active/grace/expired) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I06 | Free user SP wallet inactive state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I07 | SP Wallet — "Reserved in trades" card | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I08 | SP Wallet — "Wallet Not Found" error | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-I09 | SP Wallet — pending-release summary note | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-J01 | SP History tabs (All / Earned / Spent) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-J02 | Transaction rows — type icon, label, signed amount | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-J03 | Empty state per tab | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-J04 | Pull-to-refresh updates ledger | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-K01 | Transaction History list + status badges | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-K02 | Transaction History empty + error/retry | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-L01 | Renewal webhook updates billing history and member state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-L02 | Payment-failed webhook moves subscription into retry / grace state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-L03 | Invalid webhook signature is rejected with no duplicate state change | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-L04 | Duplicate webhook delivery is idempotent | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-L05 | Payout-status webhook updates seller payout history | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-M01 | Payment Methods — loading state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-M02 | Empty state + Add Payment Method (Stripe sheet) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-M03 | Saved-card display + security banner | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-M04 | Update Payment Method | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-M05 | Remove This Card (confirm + success) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-M06 | Go Back | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-M07 | Backend contract — attach / detach / retryFailedPayment branches | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-N01 | JoinKidsClub value-prop + web CTA | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-N02 | JoinKidsClub web redirect (passitup.com) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-N03 | Route-alias reachability (JoinKidsClub vs deep-link-only aliases) | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-N04 | ContinueKidsClub active-subscription variant | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-N05 | ContinueKidsClub loading state | 1 | — | — | `—` | NEVER RUN |
| SUB-TC-N06 | ContinueKidsClub trial-ending urgency badge | 1 | — | — | `—` | NEVER RUN |


## 4 · STILL OPEN — unresolved / blocked findings (13)

Latest verdict FAIL or BLOCKED with **no later PASS re-verification** on disk. The finding note is taken from the latest report's verdict row.

| TC-ID | Group | Latest | Date | Finding (from latest report) |
|---|---|---|---|---|
| **AUTH-TC-C03** | C | BLOCKED | 2026-08-16 | BLOCKED, never passed (fixture/config/environment) — Apple provider still not enabled on staging (400 `validation_failed` re-confirmed) |
| **AUTH-TC-C05** | C | BLOCKED | 2026-08-16 | BLOCKED, never passed (fixture/config/environment) — No on-device trigger mechanism (pending C05 toggle); code/unit-verified only |
| **AUTH-TC-C07** | C | BLOCKED | 2026-08-16 | BLOCKED, never passed (fixture/config/environment) — No social-only fixture persona + depends on C01/C02 |
| **AUTH-TC-E04** | E | BLOCKED | 2026-08-17 | BLOCKED, never passed (fixture/config/environment) — Rate-limit condition NOT inducible in dev: 4 rapid sends for one phone never returned RATE_LIMIT_EXCEEDED (each → SEND_FAILED → DEV bypass dialog). Screen's rate-limit path is a generic `Alert.alert('Error', err.message) |
| **AUTH-TC-H03** | H | BLOCKED | 2026-08-23 | BLOCKED, never passed (fixture/config/environment) — `qa_avatar_upload_failure` toggle = `none` on staging — needs dev-team arm to induce the upload-failure path |
| **AUTH-TC-H04** | H | BLOCKED | 2026-08-23 | BLOCKED, never passed (fixture/config/environment) — Welcome screen is an orphaned/dead route (not in the live flow); **plus a confirmed defect: headline renders literal accessibility-prop junk text** |
| **AUTH-TC-H05** | H | BLOCKED | 2026-08-23 | BLOCKED, never passed (fixture/config/environment) — Feature Highlights 4-slide screen is an orphaned/dead route (content correct via deep link, but not reachable by any real user) |
| **AUTH-TC-I01** | I | BLOCKED | 2026-08-23 | BLOCKED, never passed (fixture/config/environment) — Subscription Choice screen does not exist; no Start Free Trial CTA anywhere in onboarding; `trial_enabled=false` (precondition unmet) |
| **AUTH-TC-I02** | I | BLOCKED | 2026-08-23 | BLOCKED, never passed (fixture/config/environment) — Subscription Choice screen does not exist; no Continue Free CTA anywhere |
| **AUTH-TC-I03** | I | BLOCKED | 2026-08-23 | BLOCKED, never passed (fixture/config/environment) — Subscription Choice screen does not exist; cannot reach a trial-limit state via UI |
| **AUTH-TC-P03** | P | BLOCKED | 2026-08-23 | BLOCKED, never passed (fixture/config/environment) — Chat→Messages verified; unread-badge precondition unreachable (no conversation fixture; messaging requires an in-progress trade that doesn't exist) |
| **AUTH-TC-Q04** | Q | FAIL | 2026-08-23 | FAIL, unresolved — Guide (fee=2.5=10%, SP-10 input) is stale — flat-fee model replaced it. Actual: max_sp_usable 17 ✓, cash $8.00 (no SP-input field), fee **$20.00** (non-subscriber flat), total $28.00. Doc drift + subscriber-sees-non-subs |
| **AUTH-TC-S01** | S | BLOCKED | 2026-08-23 | re-opened (env/fixture) — PASS on record 2026-08-16 — Staging SMTP cannot send reset emails — app's real send errors; success state unreachable. UI source-verified (non-disclosing Check Your Inbox + Send Another Email→cleared form). S04 live-triggered as proof of the env co |

**Notes on the open set:**

- `C03/C05/C07`, `E04`, `H03`, `P03` — **fixture/config/environment blocks** (Apple provider not enabled, no simulation toggles armed, no conversation fixture, rate-limit not inducible in dev). Code paths are often source-verified but not executable on-device.
- `H04/H05`, `I01/I02/I03` — the guide itself marks these **REMOVED / superseded** (Welcome & Feature-Highlights screens deleted; in-app trial-choice step removed in favor of the web-first `JoinKidsClubScreen`). `H04` additionally has a confirmed literal accessibility-prop-text defect (BP-61 class).
- `Q04` — **doc drift**: the guide's fee example (`2.5 = 10%`) is stale vs the flat-fee model; the actual buyer fee behavior was re-verified in `group-qs-fix-verify` (Fix 4). Guide text needs updating.
- `S01` — **re-opened by environment** (staging SMTP cannot send reset emails on 2026-08-23); the case passed on 2026-08-16. Staging mail delivery needs fixing to re-verify.

## 5 · NEVER RUN — no evidence on disk

**683** canonical TC-IDs have no verdict row in any report on disk. This is the **full remaining coverage gap** — concentrated in the five guides that have never had a manual QA pass:

| Guide | Total | NEVER RUN | Of which never run % |
|---|---:|---:|---:|
| AUTH (Signup→Discovery) | 138 | 1 | 0.7% |
| MSG (Messaging→Notifications) | 72 | 72 | 100.0% |
| TRD (TradeFlowV2) | 278 | 278 | 100.0% |
| ACC (Account/Dashboard/Help/Legal) | 73 | 73 | 100.0% |
| ADM (Admin Portal) | 159 | 159 | 100.0% |
| SUB (Subscriptions/Payouts/SP Wallet) | 100 | 100 | 100.0% |

Within the AUTH guide the only NEVER-RUN case is `AUTH-TC-J10` (explicitly excluded from the Group J run per the test brief as already closed).

## 6 · Evidence source register (58 reports on disk)

All report.md files found and parsed for this inventory, with the per-case evidence rows each produced (deduplicated).

| Date | Source type | Report (run folder) | Roll-up P/F/B/S | Evidence rows |
|---|---|---|---|---:|
| 2026-05-31 | automated | `2026-05-31T15-31-06` | — | 134 |
| 2026-05-31 | automated | `test-automation/trade-flow-v2/reports/2026-05-31T13-04-19-345Z` | — | 6 |
| 2026-05-31 | automated | `test-automation/trade-flow-v2/reports/2026-05-31T15-04-42-404Z` | — | 19 |
| 2026-05-31 | automated | `test-automation/trade-flow-v2/reports/2026-05-31T15-09-46-669Z` | — | 4 |
| 2026-05-31 | automated | `test-automation/trade-flow-v2/reports/2026-05-31T15-12-10-443Z` | — | 19 |
| 2026-06-01 | automated | `2026-06-01T00-10-52` | — | 134 |
| 2026-06-01 | automated | `2026-06-01T00-31-27` | — | 134 |
| 2026-06-02 | automated | `2026-06-02T10-55-31` | — | 117 |
| 2026-06-02 | automated | `2026-06-02T10-55-54` | — | 117 |
| 2026-06-02 | automated | `2026-06-02T11-11-23` | — | 117 |
| 2026-06-02 | automated | `2026-06-02T11-24-07` | — | 117 |
| 2026-06-02 | automated | `2026-06-02T11-32-53` | — | 117 |
| 2026-06-02 | automated | `2026-06-02T12-16-02` | — | 117 |
| 2026-06-02 | automated | `test-automation/trade-flow-v2/reports/2026-06-02T10-47-07-787Z` | — | 117 |
| 2026-06-05 | automated | `2026-06-05T18-58-08` | — | 1 |
| 2026-06-20 | automated | `2026-06-20T16-47-48` | — | 134 |
| 2026-06-24 | automated | `2026-06-24T21-08-11` | — | 134 |
| 2026-08-11 | manual | `stage2` | — | 0 |
| 2026-08-11 | manual | `stage3` | — | 0 |
| 2026-08-16 | manual | `phase14-auth-pw-recovery-2026-08-16` | 3/0/5/0 | 16 |
| 2026-08-16 | manual | `phase15-auth-group-s-reverify-2026-08-16` | 4/0/1/0 | 10 |
| 2026-08-16 | manual | `phase16-auth-group-s-closeout-2026-08-16` | 2/0/0/0 | 5 |
| 2026-08-16 | manual | `phase17-auth-groups-ab-2026-08-16` | 15/0/2/0 | 36 |
| 2026-08-16 | manual | `phase18-auth-group-c-social-login-2026-08-16` | 0/3/4/0 | 14 |
| 2026-08-16 | manual | `phase19-auth-group-c-closeout-2026-08-16` | 1/0/6/0 | 25 |
| 2026-08-16 | manual | `phase20-auth-group-c-closure-2026-08-16` | 1/1/1/0 | 6 |
| 2026-08-16 | manual | `phase21-auth-group-c01-google-2026-08-16` | 1/0/0/0 | 1 |
| 2026-08-17 | manual | `itemcreate-scroll-investigation-2026-08-17` | — | 0 |
| 2026-08-17 | manual | `phase22-auth-group-b-d-e-2026-08-17` | 8/0/2/1 | 25 |
| 2026-08-17 | manual | `phase23-auth-group-f-h-i-e05-2026-08-17` | 9/1/7/0 | 18 |
| 2026-08-17 | manual | `phase24-f06-reverify-discover-audit-2026-08-17` | — | 1 |
| 2026-08-18 | manual | `combined-verification-2026-08-18` | 5/0/0/0 | 1 |
| 2026-08-18 | manual | `phase23-wrapup-f06-reverify-f07-h03-2026-08-18` | — | 6 |
| 2026-08-18 | manual | `qa-combined-verify-e05-c04-f06-2026-08-18` | 1/1/1/0 | 3 |
| 2026-08-18 | manual | `tabbar-after-skip-recheck-2026-08-18` | — | 0 |
| 2026-08-19 | manual | `phase25-auth-group-k-bulk-2026-08-19` | — | 12 |
| 2026-08-19 | manual | `qa-final-verify-e05-c04-2026-08-19` | 2/0/0/0 | 3 |
| 2026-08-20 | manual | `phase26-bulk-four-fixes-verify-2026-08-20` | — | 1 |
| 2026-08-20 | manual | `phase27-groupk-ax-reverify-2026-08-20` | 4/0/0/0 | 3 |
| 2026-08-21 | manual | `group-l-playwright-l01-l04-2026-08-21` | 0/0/4/0 | 9 |
| 2026-08-21 | manual | `group-l-reverify-l01-l04-2026-08-21` | 4/0/0/0 | 4 |
| 2026-08-22 | manual | `group-m-discover-2026-08-22` | 10/0/0/0 | 20 |
| 2026-08-22 | manual | `group-n-discovery-category-favorites-2026-08-22` | 4/0/0/0 | 9 |
| 2026-08-22 | manual | `group-o-closeout-o03-o01-2026-08-22` | 2/0/0/0 | 4 |
| 2026-08-22 | manual | `group-o-node-scope-2026-08-22` | 5/0/0/0 | 10 |
| 2026-08-23 | manual | `group-a-b-d-auth-2026-08-23` | 23/0/0/0 | 23 |
| 2026-08-23 | manual | `group-fg-nodes-zip-gating-2026-08-23` | 12/0/0/0 | 24 |
| 2026-08-23 | manual | `group-h-profile-setup-2026-08-23` | 4/0/3/0 | 14 |
| 2026-08-23 | manual | `group-i-subscription-choice-2026-08-23` | 0/0/3/0 | 3 |
| 2026-08-23 | manual | `group-p-full-run-19-cases-2026-08-23` | — | 38 |
| 2026-08-23 | manual | `group-p-reverify-appheader-composer-2026-08-23` | 3/0/0/0 | 0 |
| 2026-08-23 | manual | `group-qs-calibration-2026-08-23` | — | 22 |
| 2026-08-23 | manual | `group-qs-fix-verify-2026-08-23` | — | 0 |
| 2026-08-23 | manual | `spotcheck-h01-avatar-carousel-2026-08-23` | — | 0 |
| 2026-08-23 | manual | `spotcheck-sweeps-2026-08-23` | — | 2 |
| 2026-08-24 | manual | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | 6/0/0/0 | 13 |
| 2026-08-24 | manual | `group-j-h-closure-2026-08-24` | 3/0/0/0 | 4 |
| 2026-08-24 | manual | `group-j-listing-creation-single-2026-08-24` | 8/1/5/0 | 28 |

Additional evidence not captured as report.md rows:

- **Decision / outcome logs** (8): `group-a-b-d-auth`, `group-h-profile-setup`, `group-l-playwright-l01-l04`, `group-p-full-run-19-cases`, `phase22-auth-group-b-d-e`, `phase23-wrapup-f06-reverify-f07-h03`, `phase25-auth-group-k-bulk`, `phase26-bulk-four-fixes-verify` (each `decision*-log.md` in the run folder).
- **results.json** (12 automated runs) — used as the authoritative per-case source for the automated runs in §7.
- **Screenshot-only run folder** `group-o-locator-fixes-2026-08-23/` (no report.md; fix-evidence captured as screenshots only).
- **Stage harness reports** `stage2/report.md`, `stage3/report.md` + `report-*.md`, `stage4/report-write-based-provisioning.md`, `stage5/report-auth-teardown.md`, `Stage1-iOS-Signup-HappyPath-report.md` (A01–A03/B01/B02 PASS merged above), `itemcreate-scroll-investigation-2026-08-17/report.md`.

## 7 · Automated suite runs (legacy ID scheme — kept separate)

The `run-suite.sh` automated runs (May–Jun 2026) exercised the TradeFlowV2 suite using a **legacy, pre-prefix ID scheme** (`TC-A01`…`TC-R13`, `REG-R01`…`R08`). Per-case verdicts were reconstructed from `results.json` (unit case lists + pass flags + `skipped` array) and reconcile exactly with each run's reported totals. They are **not** merged into the canonical rows because the legacy IDs don't map 1:1 to the current canonical IDs and several runs were harness-broken (all-fail).

| Run | Date | Passed | Failed | Skipped | Notes |
|---|---|---:|---:|---:|---|
| `e2e-test-results/2026-05-31T15-31-06` | 2026-05-31 | 112 | 7 | 15 | legacy IDs |
| `test-automation/trade-flow-v2/reports/2026-05-31T13-04-19-345Z` | 2026-05-31 | 4 | 0 | 2 | legacy IDs |
| `test-automation/trade-flow-v2/reports/2026-05-31T15-04-42-404Z` | 2026-05-31 | 18 | 0 | 1 | legacy IDs |
| `test-automation/trade-flow-v2/reports/2026-05-31T15-09-46-669Z` | 2026-05-31 | 0 | 3 | 1 | legacy IDs · harness-broken (all-fail) |
| `test-automation/trade-flow-v2/reports/2026-05-31T15-12-10-443Z` | 2026-05-31 | 0 | 18 | 1 | legacy IDs · harness-broken (all-fail) |
| `e2e-test-results/2026-06-01T00-10-52` | 2026-06-01 | 13 | 106 | 15 | legacy IDs |
| `e2e-test-results/2026-06-01T00-31-27` | 2026-06-01 | 0 | 119 | 15 | legacy IDs · harness-broken (all-fail) |
| `e2e-test-results/2026-06-02T10-55-31` | 2026-06-02 | 102 | 0 | 15 | legacy IDs |
| `e2e-test-results/2026-06-02T10-55-54` | 2026-06-02 | 102 | 0 | 15 | legacy IDs |
| `e2e-test-results/2026-06-02T11-11-23` | 2026-06-02 | 102 | 0 | 15 | legacy IDs |
| `e2e-test-results/2026-06-02T11-24-07` | 2026-06-02 | 102 | 0 | 15 | legacy IDs |
| `e2e-test-results/2026-06-02T11-32-53` | 2026-06-02 | 28 | 74 | 15 | legacy IDs |
| `e2e-test-results/2026-06-02T12-16-02` | 2026-06-02 | 102 | 0 | 15 | legacy IDs |
| `test-automation/trade-flow-v2/reports/2026-06-02T10-47-07-787Z` | 2026-06-02 | 0 | 102 | 15 | legacy IDs · harness-broken (all-fail) |
| `e2e-test-results/2026-06-05T18-58-08` | 2026-06-05 | 0 | 1 | 0 | legacy IDs · harness-broken (all-fail) |
| `e2e-test-results/2026-06-20T16-47-48` | 2026-06-20 | 0 | 119 | 15 | legacy IDs · harness-broken (all-fail) |
| `e2e-test-results/2026-06-24T21-08-11` | 2026-06-24 | 0 | 119 | 15 | legacy IDs · harness-broken (all-fail) |

### 7.1 Legacy → canonical candidate mapping

Of the **134 distinct legacy IDs** referenced by the automated runs, **126** map cleanly by suffix to a canonical `TRD-TC-*` ID that exists in the current guide (e.g. `TC-A01 → TRD-TC-A01`, `REG-R01 → TRD-TC-REG-R01`). The remaining 8 (`TC-O01`–`TC-O07`, `TC-R13`-style zero-padding variants) have no exact canonical suffix match because the guide renumbered those groups (e.g. `TRD-TC-O1`, not `O01`). These runs predate the module-prefix manifest change and are treated as historical harness evidence, not current coverage.

## 8 · Evidence IDs with no canonical match (phantom / legacy)

Five **manual-source phantom IDs** were produced by parser heuristics (suffix matching) or appear as dangling cross-references. None exist in any canonical guide index, so they are excluded from the coverage table. The legacy automated IDs are excluded by design (see §7).

| ID | Verdicts on record | Explanation |
|---|---|---|
| `AUTH-TC-F07` | PASS | Dangling cross-reference — the F06 Assert cites “see AUTH-TC-F07”; the wrap-up report notes F07 is NOT a registered case (Group F = F01–F06). Intent covered by F02/F03/F04. |
| `AUTH-TC-P0` | FAIL | Suffix-parse artifact from severity labels (P0) in report prose; the AUTH P-group is zero-padded (P01–P19), so no P0 exists. |
| `AUTH-TC-P1` | PASS | Suffix-parse artifact from commit/severity labels (P1) in report prose; the AUTH P-group is zero-padded (P01–P19), so no P1 exists. |
| `AUTH-TC-P3` | PASS | Suffix-parse artifact from commit/severity labels (P3) in report prose; the AUTH P-group is zero-padded (P01–P19), so no P3 exists. |
| `AUTH-TC-R7` | BLOCKED | Suffix-parse artifact from “JoinKidsClubScreen (R7 web-first)” route reference; the AUTH guide has no R group. |

- The **legacy automated IDs** (1538 rows / 134 distinct) are excluded from the canonical table by design — see §7.

## 9 · How to re-run / regenerate

Scratch tooling lives in `temp/tc-inventory/` (read-only over guides/code/reports):

```bash
python3 temp/tc-inventory/parse_indexes.py   # Step 1: guides → master-tcs.tsv
python3 temp/tc-inventory/parse_reports.py   # Step 2: reports → report-evidence.tsv
python3 temp/tc-inventory/reconcile.py       # Step 3a: reconcile → canonical-latest.tsv
python3 temp/tc-inventory/generate_inventory.py  # Step 3b: this file
```

To add a curated attachment (a targeted report that asserts canonical verdicts without parseable rows), append rows to `temp/tc-inventory/curated-supplements.tsv` and re-run steps 3a/3b.
