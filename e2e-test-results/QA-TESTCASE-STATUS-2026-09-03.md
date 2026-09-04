# QA Test-Case Status — All Canonical Guides

> Future-reference status of **every canonical test case** in the 6 consolidated guides under `cross-checked-and-consolidated/`, reconciled against all QA evidence on disk through **2026-09-03**. Read-only snapshot — no guides/code/reports modified. Full narrative + method in `TEST-COVERAGE-INVENTORY-v2.md` (repo root); raw data in `temp/tc-inventory-v2/`.

**Generated:** 2026-09-03 · **Total canonical cases:** 833

## Status legend

| Status | Meaning |
|---|---|
| ✅ PASS | Executed; latest verdict PASS (may carry minor copy/finding notes) |
| 🟡 PARTIAL | Executed with partial/limited evidence (source-confirmed, tooling-limited, or fixture-gapped sub-leg) |
| 🔴 STILL OPEN | Latest verdict FAIL or BLOCKED with no later PASS re-verification — real residual defect or env/fixture block |
| 📄 DOC-DRIFT | Guide assertion is obsolete/superseded; the underlying backend behavior was verified |
| ⏭️ SKIPPED | Attempted but explicitly not exercised (budget/persona/scope) |
| NEVER RUN | **Remaining** — no report on disk asserts a verdict under this canonical ID |

## 1 · Per-guide roll-up

| Guide | Canonical file | Cases | ✅ PASS | 🟡 PARTIAL | 🔴 OPEN | 📄 DRIFT | ⏭️ SKIP | **Remaining (NEVER RUN)** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **AUTH** | `AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` | 138 | 118 | 2 | 16 | 0 | 2 | **0** |
| **MSG** | `MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` | 72 | 63 | 2 | 2 | 2 | 0 | **3** |
| **TRD** | `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` | 288 | 234 | 28 | 2 | 3 | 2 | **19** |
| **ACC** | `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` | 75 | 57 | 0 | 17 | 0 | 1 | **0** |
| **ADM** | `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` | 160 | 0 | 0 | 0 | 0 | 1 | **159** |
| **SUB** | `MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` | 100 | 45 | 2 | 3 | 0 | 0 | **50** |

Completed = any of PASS/PARTIAL/OPEN/DRIFT/SKIP. A case that is PASS, PARTIAL or OPEN has been executed at least once; DRIFT/SKIP rows are documented; the **Remaining** column is what still needs a run.

## AUTH · Signup / Onboarding / Nodes / Listing / Discovery

**Guide file:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` · **Cases:** 138 · **PASS** 118 · **PARTIAL** 2 · **OPEN** 16 · **DOC-DRIFT** 0 · **SKIPPED** 2 · **Remaining (NEVER RUN)** 0

### Completed test cases (have a verdict on record)

| TC-ID | Description | Status | Latest | Date | Source | Notes |
|---|---|---|---|---|---|---|
| AUTH-TC-A01 | Successful signup with valid details | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-A02 | Field validation errors (name/email/phone/password) | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-A03 | Password mismatch + weak password | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-A04 | Under-18 date of birth blocked | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-A05 | Duplicate email blocked | ✅ PASS | PASS | 2026-08-23 | `spotcheck-sweeps-2026-08-23` |  |
| AUTH-TC-A06 | Optional referral code (valid / invalid handling) | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-A07 | Terms of Service & Privacy Policy links | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-A08 | Landing footer legal links (Terms / Privacy Policy) | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B01 | Successful login routes by onboarding status | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B02 | Invalid credentials error | ✅ PASS | PASS | 2026-08-23 | `spotcheck-sweeps-2026-08-23` |  |
| AUTH-TC-B03 | Forgot Password link | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B04 | Session restore after app kill/relaunch | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B05 | App resume refreshes silently (no spinner) | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B06 | Cold launch does not hang on spinner | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B07 | Empty-field + invalid-email inline validation | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B08 | ACCOUNT_DELETED login branch | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B09 | PROFILE_NOT_FOUND login branch | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B10 | Back button returns to previous screen | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B11 | Sign Up footer link | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-B12 | Log In footer link (Create Account) | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-C01 | Sign in / Continue with Google | ✅ PASS | PASS | 2026-08-16 | `phase21-auth-group-c01-google-2026-08-16` |  |
| AUTH-TC-C02 | Sign in / Continue with Facebook | ✅ PASS | PASS | 2026-08-16 | `phase20-auth-group-c-closure-2026-08-16` |  |
| AUTH-TC-C03 | Sign in / Continue with Apple (iOS + Android) | 🔴 STILL OPEN | BLOCKED | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` | BLOCKED (env/fixture) |
| AUTH-TC-C04 | Existing-email account-link prompt | ✅ PASS | PASS | 2026-08-19 | `qa-final-verify-e05-c04-2026-08-19` |  |
| AUTH-TC-C05 | Provider unavailable → email fallback banner | 🔴 STILL OPEN | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | BLOCKED (env/fixture) |
| AUTH-TC-C06 | User cancels OAuth — silent return | ✅ PASS | PASS | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` |  |
| AUTH-TC-C07 | Social-only user sets a password | 🔴 STILL OPEN | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | BLOCKED (env/fixture) |
| AUTH-TC-D01 | Logout from Profile with confirmation | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-D02 | Sign Out from Settings | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-D03 | After logout, app returns to Landing | ✅ PASS | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` |  |
| AUTH-TC-E01 | OTP screen sends + verifies 6-digit code | ✅ PASS | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` |  |
| AUTH-TC-E02 | Incomplete / invalid / expired code errors | ✅ PASS | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` |  |
| AUTH-TC-E03 | Resend cooldown (60s) | ✅ PASS | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` |  |
| AUTH-TC-E04 | OTP rate limiting message | ✅ PASS | PASS | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` |  |
| AUTH-TC-E05 | Gate blocks first listing until verified | ✅ PASS | PASS | 2026-08-19 | `qa-final-verify-e05-c04-2026-08-19` |  |
| AUTH-TC-F01 | Active ZIP → assigned to node, no waitlist | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-F02 | Inactive ZIP → "We're Coming Soon!" + Join Waitlist | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-F03 | Waitlist confirmation + fallback node access | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-F04 | Continue Trading without joining waitlist | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-F05 | ZIP auto-lookup shows city/state | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-F06 | Node-scoped content (My Node vs Show All Nodes) | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-G01 | Admin creates an active node (ZIP auto-lookup) | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-G02 | Admin creates an inactive node | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-G03 | Admin edits a node | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-G04 | Admin deactivates a node with members (warning) | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-G05 | Admin reactivates a node | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-G06 | Node stats cards + validation | ✅ PASS | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` |  |
| AUTH-TC-H01 | Profile Setup: avatar + display name + ZIP | ✅ PASS | PASS | 2026-08-24 | `group-j-h-closure-2026-08-24` |  |
| AUTH-TC-H02 | Profile Setup validation errors | ✅ PASS | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` |  |
| AUTH-TC-H03 | Avatar upload failure does not block | 🔴 STILL OPEN | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | BLOCKED (env/fixture) |
| AUTH-TC-H04 | ~~Welcome screen → Get Started~~ (REMOVED — screen deleted; superseded by H06/H07) | 🔴 STILL OPEN | BLOCKED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | BLOCKED (env/fixture) |
| AUTH-TC-H05 | ~~Feature Highlights carousel~~ (REMOVED — screen deleted; superseded by H06/H07) | 🔴 STILL OPEN | BLOCKED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | BLOCKED (env/fixture) |
| AUTH-TC-H06 | Onboarding carousel: Next / Skip / Get Started | ✅ PASS | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` |  |
| AUTH-TC-H07 | Onboarding completion routes to Home | ✅ PASS | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` |  |
| AUTH-TC-I01 | ~~Start Free Trial enrolls Kids Club+~~ (REMOVED — no in-app trial-choice step; subscription purchase superseded by web-first `JoinKidsClubScreen` path) | 🔴 STILL OPEN | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | BLOCKED (env/fixture) |
| AUTH-TC-I02 | ~~Continue Free stays on free tier~~ (REMOVED — post-Profile-Setup routes to EDU carousel → free-tier Home; no Continue Free step) | 🔴 STILL OPEN | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | BLOCKED (env/fixture) |
| AUTH-TC-I03 | ~~Trial limit reached hides trial CTA~~ (REMOVED — no in-app trial CTA; trial disabled via `admin_config.trial_enabled=false`) | 🔴 STILL OPEN | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | BLOCKED (env/fixture) |
| AUTH-TC-J01 | Photo-first gating (fields hidden until 1 photo) | ✅ PASS | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` |  |
| AUTH-TC-J02 | AI auto-fill Apply All + per-field Use | ✅ PASS | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` |  |
| AUTH-TC-J03 | Required field validation | ✅ PASS | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` |  |
| AUTH-TC-J04 | Condition / Age Group / Gender / Color options | ✅ PASS | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` |  |
| AUTH-TC-J05 | "Other" category → custom name required | ✅ PASS | PASS | 2026-08-24 | `group-j-h-closure-2026-08-24` |  |
| AUTH-TC-J06 | Payment preference — subscriber Accept SP toggle | ✅ PASS | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` |  |
| AUTH-TC-J07 | Payment preference — free user upgrade prompt | ✅ PASS | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` |  |
| AUTH-TC-J08 | SP earnings preview (subscriber) | ✅ PASS | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` |  |
| AUTH-TC-J09 | Submit for Review → pending + success modal | ✅ PASS | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` |  |
| AUTH-TC-J10 | Phone-verification gate before publish | ✅ PASS | PASS | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` |  |
| AUTH-TC-J11 | Draft auto-save + resume | ✅ PASS | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` |  |
| AUTH-TC-J12 | Listing photos — multiple upload, type and size validation | ✅ PASS | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` |  |
| AUTH-TC-J13 | Listing photos — remove, reorder, replace, and persist after resume | ✅ PASS | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` |  |
| AUTH-TC-J14 | Bonus category badge appears in picker and preview | ✅ PASS | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` |  |
| AUTH-TC-J15 | Category-specific SP earn and buyer-cap preview recalculates | ✅ PASS | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` |  |
| AUTH-TC-K01 | Multi-photo upload + auto-grouping | ✅ PASS | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` |  |
| AUTH-TC-K02 | Regroup / merge / move photos | ✅ PASS | PASS | 2026-08-20 | `phase27-groupk-ax-reverify-2026-08-20` |  |
| AUTH-TC-K03 | Step indicator: Photos → Group → Review → Publish | ✅ PASS | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` |  |
| AUTH-TC-K04 | Apply to All bar (brand/condition/age/gender) | ✅ PASS | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` |  |
| AUTH-TC-K05 | Submit N Items for Review + confirm sheet | 🟡 PARTIAL | PARTIAL | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` |  |
| AUTH-TC-K06 | Bulk SP summary (subscriber) | ✅ PASS | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` |  |
| AUTH-TC-L01 | New listing not visible in feed until approved | ✅ PASS | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` |  |
| AUTH-TC-L02 | Admin approves → item becomes visible | 🔴 STILL OPEN | BLOCKED | 2026-08-21 | `group-l-playwright-l01-l04-2026-08-21` | BLOCKED (env/fixture) |
| AUTH-TC-L03 | Seller receives approval notification | ✅ PASS | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` |  |
| AUTH-TC-L04 | Editing an approved listing returns to pending | ✅ PASS | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` |  |
| AUTH-TC-M01 | Search bar (debounced) + clear | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M02 | Recent searches + autocomplete | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M03 | Sort options | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M04 | Filters modal: SP toggle, Location/Category/Age, More Filters, live count | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M05 | "Accepts SP" quick-toggle (header ↔ sheet sync) | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M06 | Empty / no-results states | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M07 | Recent Searches chip row + Clear | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M08 | Trending in {State} section | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M09 | Result count + active filter chips (incl. gold SP chip) | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-M10 | Discover header: bookmark → Favorites (local header) | ✅ PASS | PASS | 2026-08-22 | `group-m-discover-2026-08-22` |  |
| AUTH-TC-N01 | Category browse filters results | ✅ PASS | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` |  |
| AUTH-TC-N02 | Favorite heart toggle on item card | ✅ PASS | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` |  |
| AUTH-TC-N03 | Infinite scroll pagination | ✅ PASS | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` |  |
| AUTH-TC-N04 | "Accepts SP" badge on item card (gold, §6.7) | ✅ PASS | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` |  |
| AUTH-TC-O01 | Results scoped to user's node | ✅ PASS | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` |  |
| AUTH-TC-O02 | Location ZIP + radius filter | ✅ PASS | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` |  |
| AUTH-TC-O03 | Inactive ZIP in filter → explicit waitlist opt-in (no auto-enroll) | ✅ PASS | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` |  |
| AUTH-TC-O04 | Subscriber vs free SP visibility | ✅ PASS | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` |  |
| AUTH-TC-O05 | Admin radius defaults and bounds reflect in Discover | ✅ PASS | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` |  |
| AUTH-TC-P01 | Header node chip shows registered market (read-only) | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P02 | Header right cluster: bell + chat + avatar; logout removed from header | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P03 | Header chat icon opens Messages with unread badge | 🔴 STILL OPEN | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | BLOCKED (env/fixture) |
| AUTH-TC-P04 | Floating pill nav: order, margins, radius, shadow, safe area | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P05 | Inbox removed from nav; Messages via header chat only | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P06 | Trades tab: Active Trades (item, counterpart, status label) | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P07 | Trades tab: Trade History (reverse chronological) | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P08 | Trades badge counts active (not completed/cancelled) | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P09 | Basket badge + Home active state unchanged | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P10 | Post FAB globally visible + opens Sell sheet | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P11 | Composer bar: tap focuses, type, placeholder | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P12 | Composer "+" → New Item Photos step, Title pre-filled | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P13 | Composer empty submit → empty Title | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P14 | Composer camera → New Item straight to camera | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P15 | AI never overwrites composer-pre-filled Title | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P16 | FAB Sell sheet unchanged (parallel entry point) | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P17 | Logout still reachable from Profile/Settings | ✅ PASS | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` |  |
| AUTH-TC-P18 | Composer analytics (tap + submit with/without text) | 🔴 STILL OPEN | FAIL | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | FAIL, unresolved |
| AUTH-TC-P19 | Accessibility identifiers (Trades tab, header chat) | 🔴 STILL OPEN | FAIL | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | FAIL, unresolved |
| AUTH-TC-Q01 | Education Help screen — published sections only | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-Q02 | Education Help screen — section by type | 🟡 PARTIAL | PARTIAL | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-Q03 | SP calculator — sell mode (no hardcoded rates) | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-Q04 | SP calculator — buy mode (cash + fee + cap) | 🔴 STILL OPEN | FAIL | 2026-08-23 | `group-qs-calibration-2026-08-23` | FAIL, unresolved |
| AUTH-TC-Q05 | SP calculator — bonus categories + example SP | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-Q06 | Education analytics — event tracking (no throw) | 🔴 STILL OPEN | FAIL | 2026-08-23 | `group-qs-calibration-2026-08-23` | FAIL, unresolved |
| AUTH-TC-Q07 | Education prompts — onboarding + in-app prompt state machine | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S01 | Forgot Password — success + Send Another Email | 🔴 STILL OPEN | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | BLOCKED (env/fixture) |
| AUTH-TC-S02 | Forgot Password — invalid email | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S03 | Forgot Password — rate-limit error | ⏭️ SKIPPED | SKIPPED | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S04 | Forgot Password — SMTP-config (500) error | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S05 | Forgot Password — 400 error | ⏭️ SKIPPED | SKIPPED | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S06 | Forgot Password — Back to Login | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S07 | Reset Password — validation + requirements card | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S08 | Reset Password — success → Login | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S09 | Reset Password — link-error (expired) → Request New Reset Email | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S10 | Reset Password — no active reset session | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |
| AUTH-TC-S11 | Deep link `p2pkidsmarketplace://reset-password | ✅ PASS | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` |  |

_All cases in this guide have a verdict on record — none remaining._

## MSG · Messaging / Badges / ID-Verification / Referrals / Safety / Notifications

**Guide file:** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` · **Cases:** 72 · **PASS** 63 · **PARTIAL** 2 · **OPEN** 2 · **DOC-DRIFT** 2 · **SKIPPED** 0 · **Remaining (NEVER RUN)** 3

### Completed test cases (have a verdict on record)

| TC-ID | Description | Status | Latest | Date | Source | Notes |
|---|---|---|---|---|---|---|
| MSG-TC-A01 | Conversation list (search, unread badges, empty state) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-A02 | Open a chat thread + trade context banner | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-A03 | Send a text message + delivery status (sent→delivered→read) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-A04 | Receive a message in real time | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-A05 | Typing indicator | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-A06 | Send an image message + full-screen viewer | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-A07 | Message length limit (2000 chars) | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-A08 | Quick-reply meeting chips | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-A09 | Safety meeting banner + Learn more | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-A10 | Photo permission denied error | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-B01 | My Badges grid (earned vs locked) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-B02 | Badge detail modal | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-B03 | Badge showcase on profile | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-B04 | Badge celebration modal on unlock | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-B05 | 🚫 DEFERRED (post-MVP) — Leaderboard ranking (no in-app entry — deep-link/notification only) | 🔴 STILL OPEN | BLOCKED | 2026-09-03 | `qa-msg-first-live-2026-09-03` | BLOCKED (env/fixture) |
| MSG-TC-C01 | Submit a post-trade review (stars + comment) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-C02 | Rating required validation | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-C03 | Anonymous review | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-C04 | Skip review | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-C05 | Review display on seller profile + aggregate rating | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-C06 | Report a review (reviewee only) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-D01 | Start ID verification + upload from library | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-D03 | Submit creates pending request | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` |  |
| MSG-TC-D06 | Pending state screen | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-D07 | Approved → Verified badge on profile | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | qa25 verbatim PASS: test-seller-3 ID screen "Identity Verified" + green Verified pill; other-user Seller Profile shows Verified + Trust level Ultimate. Caveat finding #2: OWN public-profile self-view showed Not-Verified ~1-2 min post-approval (DEV-TASK-102/Item 5 tracks) — badge legs pass |
| MSG-TC-D08 | Rejected → reason shown + resubmit | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | qa25 verbatim PASS: after E03 rejection test-seller's ID screen returns to upload state (resubmission possible, by design) + Notification Center top row shows "Your ID verification was not approved... Reason: Unclear Photo." — reason + notes delivered |
| MSG-TC-D09 | Submission confirmation notifications reach the user | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-D02 | Capture ID with camera | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | simulator leg: Use Camera → graceful inline "Failed to take photo" error, no crash (iOS sim has no camera hardware). Capture-success + permission-denied-alert legs require a physical device — genuine PARTIAL |
| MSG-TC-D04 | Duplicate pending request blocked | ✅ PASS | PASS | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | submitted new ID request (row 28846a18 pending) → re-enter ID Verification renders Pending state (no upload/Use-Camera/submit affordance) → 2nd request structurally impossible; DB: exactly 1 pending row. Doc-drift: guide's "Pending Request" alert branch is dead code — the Pending-state screen is the live guard |
| MSG-TC-D05 | No-image submit validation | ✅ PASS | PASS | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | Submit disabled (gray) until an image is selected; no-image tap = no-op, no error box (disabled-button guard, matches guide + DT97 doc-drift note) |
| MSG-TC-D10 | Decision notifications honor channel preferences — 🚫 NOT SUPPORTED (no such category) | 📄 DOC-DRIFT | NOT SUPPORTED | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | by-design NOT SUPPORTED confirmed: notification_category enum = subscription/sp_events/badges/trades/system (NO id_verification); ID-verif notifications route via badges — DB enum + test-buyer prefs verified. Mirrors J05. DOC-DRIFT label = tracker has no NOT-SUPPORTED status |
| MSG-TC-E01 | Review queue (stats, filters, search) | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-E02 | Approve a request | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | qa25 verbatim PASS: approve d148ee0f → DB approved + reviewed_at/by + approval_notes; id_badge_approved notification to test-seller-3; screenshot storage object deleted post-decision (privacy promise held) |
| MSG-TC-E03 | Reject with reason | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | qa25 verbatim PASS: no-reason submit fired "Please select a rejection reason" dialog (guide match) → reason + notes → rejected; DB rejected + rejection_reason=unclear_photo + id_badge_rejected notification with reason/notes |
| MSG-TC-E04 | View completed request details | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | details shows Approved (green pill), holds after reload — DEV-TASK-101 stale-status fix verified live |
| MSG-TC-E05 | Edit message templates | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | qa25 verbatim PASS: template text edited (appended QA-E05-temp) → Save → "✓ Saved successfully" + Last-updated bumped; reverted. Minor doc drift: confirmation copy is "✓ Saved successfully", not guide's "Message saved" |
| MSG-TC-E06 | New submission creates admin alert notification | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-F01 | View referral code + hero | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-F02 | Copy referral code | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-F03 | Share referral code (native share) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-F04 | Active rewards display | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-F05 | Referral history (pending vs completed) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-F06 | Enter referral code at signup | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-F07 | Program paused banner + disabled share | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-F08 | Admin configures referral rewards | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-G01 | Listing flagged → Safety Review screen | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | flagged ba6345ce loads (FLAGGED badge, correct actions) — DEV-TASK-101 owner-scoped fetch fix live |
| MSG-TC-G02 | Appeal a flagged/rejected listing | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | rejected-fresh ccf97ae4: empty/<10 char validation + valid appeal → flagged; DB-verified appeal_reason+appealed_at+edited_since_rejection |
| MSG-TC-G03 | Resubmit a "needs edits" listing | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | needs-edits afd3384a: Make Edits Now → pre-populated EditListing → edit → Save → auto-resubmit → pending (DB-verified, appeal_count 1) |
| MSG-TC-G04 | Remove a flagged listing | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | remove flow on rejected ce322cd9: Remove Listing → confirm modal → removed (DB status deleted). Note: pure-flagged shows Edit-only; Remove Listing renders on rejected only |
| MSG-TC-G06 | Appeal max-attempt limit follows admin config | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | appeal-count-3 ce322cd9: 4th appeal blocked "Appeal limit reached. Maximum allowed appeals: 3." (DB-verified unchanged) — matches moderation_appeal_max_attempts=3 |
| MSG-TC-G07 | Appeal window follows admin config | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | backdated-15d e2096de2: appeal blocked "Appeal window has expired... within 14 days" (DB unchanged) — matches moderation_appeal_window_days=14 |
| MSG-TC-H01 | Flagged items moderation queue | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-H02 | Approve a flagged item | ✅ PASS | PASS | 2026-09-04 | `qa-task27-sub-msg-closure-2026-09-04` | real admin /items/flagged approve of flagged ba6345ce (Cash-Only Item): confirm dialog → item left the moderation queue (DB-rendered; direct SQL read-back tool disabled mid-run). Consumed the last G01 fixture — documented |
| MSG-TC-H03 | Reject with reason | ✅ PASS | PASS | 2026-09-04 | `qa-task27-sub-msg-closure-2026-09-04` | real admin /items/flagged reject of flagged ccf97ae4: Reject disabled until Decision Note entered (guard verified) → note + confirm → queue row shows Rejected + "Latest Admin Decision Note" persisted (DB-rendered). Consumed the G02 fixture — documented |
| MSG-TC-H04 | Request edits | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-H05 | Trade dispute: mark under review | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` |  |
| MSG-TC-H06 | Trade dispute: resolve complete / refund | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` |  |
| MSG-TC-I03 | Notification center list + icons | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-I04 | Tap notification → deep link + mark read | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-I05 | Mark all as read | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-I06 | Pagination + pull to refresh | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-I07 | Real-time arrival | ✅ PASS | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` |  |
| MSG-TC-I01 | Enable push notifications | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | prompt leg PASS (🔔 Stay Connected + 5 benefit bullets + Privacy box render). Enable Notifications CTA occluded by floating PersistentTabBar (y868-905 pill band; NotificationSetup NOT in TAB_BAR_HIDDEN_ROUTES) → interaction not drivable; success leg needs a physical device (registerForPushNotifications returns null when !Device.isDevice) |
| MSG-TC-I02 | Push error states (Expo Go / web) | 🔴 STILL OPEN | BLOCKED | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | simulator error-state leg blocked on-device: Enable Notifications CTA occluded by the floating tab bar → cannot reach the 'Could not obtain push token' error. Behavior source-confirmed (sim → null token → iOS message). Fix: add NotificationSetup to TAB_BAR_HIDDEN_ROUTES (dev follow-up) |
| MSG-TC-J01 | Category × channel toggles (live screen — 5 categories, no Safety) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-J02 | Default preferences (DB-driven, no hardcoded defaults) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-J03 | Always-on note (live footer copy) | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-J04 | Quiet hours (subscriber) + validation | ✅ PASS | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` |  |
| MSG-TC-J05 | 🚫 NOT SUPPORTED — ID verification preference category (none exists) | 📄 DOC-DRIFT | NOT SUPPORTED | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | by-design NOT SUPPORTED re-confirmed via DB enum for D10 — no id_verification category; ID-verif routes via badges. DOC-DRIFT label = tracker has no NOT-SUPPORTED status |

### Remaining test cases — NEVER RUN (3)

| TC-ID | Description | Note / why remaining |
|---|---|---|
| MSG-TC-G05 | Recall safety alert notification | config/fixture-gated (needs a recall-flagged listing + alert scenario) — not tooling-queued |
| MSG-TC-G08 | AI moderation toggle affects automated image review | admin-config/toggle-gated — not tooling-queued |
| MSG-TC-G09 | Recall check toggle and threshold affect recall flagging | admin-config/toggle-gated — not tooling-queued |

## TRD · TradeFlow V2 (Module 15.1.2)

**Guide file:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` · **Cases:** 288 · **PASS** 234 · **PARTIAL** 28 · **OPEN** 2 · **DOC-DRIFT** 3 · **SKIPPED** 2 · **Remaining (NEVER RUN)** 19

### Completed test cases (have a verdict on record)

| TC-ID | Description | Status | Latest | Date | Source | Notes |
|---|---|---|---|---|---|---|
| TRD-TC-A01 | Cash Only: full happy path (buyer confirms) | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | cash happy path; earlier 08-26 BLOCKED (EF v52), fixed v56 (trd-part2 08-27 PASS) |
| TRD-TC-A02 | Accept SP: SP entry at offer → seller accepts → buyer confirms | ✅ PASS | PASS | 2026-08-28 | `qa-trd-reverify-a02-b02-b06-2026-08-28` | Accept-SP happy path; 08-28 P1 SP-settlement FAIL then PASS after trigger recreated (migration 20260828000001) |
| TRD-TC-B01 | Seller declines offer | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b01-b02-reverify-2026-08-28` | declined offer History placement |
| TRD-TC-B02 | Offer expires (seller never responds) + seller ignore prompt | 🟡 PARTIAL | PARTIAL | 2026-08-28 | `qa-trd-b01-b02-reverify-2026-08-28` | expiry mechanics + History PASS; residual F1 'offer_expired' vs 'Offer expired' string mismatch (reverify-a02-b02-b06 flagged FAIL) |
| TRD-TC-B03 | Multiple competing offers — sort order + auto-decline | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | competing offers auto-decline + SP restore (was SKIPPED) |
| TRD-TC-B04 | Buyer cancels pending trade — no consequence level | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | buyer cancels pending, no consequence |
| TRD-TC-B05 | Per-seller cap: max 3 pending offers per seller (2026-07-18) | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | 3 allowed, 4th blocked (copy deviation) |
| TRD-TC-B05a | Per-seller cap: Buyer at 3 with Seller A can still submit to Seller B | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` |  |
| TRD-TC-B05b | Per-seller cap: Blocked at 4th offer to same seller | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | copy deviation 'many pending' vs guide '3 pending' |
| TRD-TC-B05c | Per-seller cap: Bundle offer counts as 1 slot, not N | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | bundle counts as 1 slot |
| TRD-TC-B05d | Per-seller cap: Expired offer frees slot immediately | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | expiry frees slot |
| TRD-TC-B05e | Regression: No leftover global cap blocks buyer over old global limit | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | no leftover global cap (was BLOCKED) |
| TRD-TC-B05f | Admin config: Change offer cap from 3 to 5 on Trade Timing page | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | admin cap 3→5 client picks up (was SKIPPED) |
| TRD-TC-B05g | Admin config: Revert cap from 5 back to 3 (forward-looking only) | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | revert 5→3 forward-looking (was SKIPPED) |
| TRD-TC-B05h | Admin config: Validation — reject invalid values (0, 11) | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | admin validation (was SKIPPED) |
| TRD-TC-B05i | Mobile client: Config fetch failure — graceful degradation | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | config-fetch failure graceful (was BLOCKED) |
| TRD-TC-B05j | Regression: Per-seller scope + bundle=1 still hold after config change | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | per-seller scope + bundle=1 after cap change (was BLOCKED) |
| TRD-TC-B06 | Card declined at offer submission | ✅ PASS | PASS | 2026-08-28 | `qa-trd-reverify-a02-b02-b06-2026-08-28` | card-decline toggle; friendly error, no trade (was BLOCKED) |
| TRD-TC-B07 | Expired offer timeline — no message button | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | expired timeline no Message/Report/Cancel |
| TRD-TC-B08 | Chat frozen after trade is cancelled or completed | ✅ PASS | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | chat frozen after cancel |
| TRD-TC-B09 | Chat remains active for in_progress trades | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | chat active for in_progress; real verdict backing guide stamp |
| TRD-TC-B10 | Replace Card path (saved card → new card) | 🟡 PARTIAL | PARTIAL | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | attach/persist code-path verified (same path as DT83 D2 PASS); literal new-card entry native-sheet tooling-limited |
| TRD-TC-B11 | Subscribe-upsell → JoinKidsClub | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | subscribe-upsell → JoinKidsClub |
| TRD-TC-C01 | SP reserved on offer submission | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | SP reserved on offer |
| TRD-TC-C02 | SP restored to buyer on seller decline | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | SP restored on seller decline |
| TRD-TC-C03 | SP restored to buyer on offer expiry | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | SP restored on expiry |
| TRD-TC-C04 | SP stays reserved when seller accepts | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | SP stays reserved on accept |
| TRD-TC-C05 | SP released to seller at trade completion | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | SP released at completion |
| TRD-TC-C06 | SP restored to buyer on seller cancel (in_progress) | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | SP restored on seller cancel |
| TRD-TC-C07 | Free user sees locked Use SP button + upgrade modal | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | free user locked Use SP + upgrade modal (PASS* deviation) |
| TRD-TC-C08 | SP entry capped by the item's category cap (50–80%, admin-configurable) | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | category-driven % cap clamp (PASS* deviation) |
| TRD-TC-D01 | Auto-complete when buyer never taps I Got It | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | auto-complete fires (PASS* deviation) |
| TRD-TC-D02 | Auto-complete skipped when dispute is open | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | auto-complete skipped when dispute open |
| TRD-TC-D03 | Offer countdown pill color states | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | countdown pill colors (PASS* deviation) |
| TRD-TC-D04 | Auto-complete banner visible to buyer only | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | auto-complete banner buyer-only (PASS* deviation) |
| TRD-TC-E01 | Buyer opens Report a Problem modal | ✅ PASS | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | occlusion fixed; full submit→amber banner (was BLOCKED 08-28) |
| TRD-TC-E02 | Disputed trade does not auto-complete | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | disputed trade no auto-complete |
| TRD-TC-E03 | Buyer UI during active dispute | ✅ PASS | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | buyer dispute UI re-confirmed |
| TRD-TC-E04 | Seller UI during active dispute | ✅ PASS | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | seller dispute UI |
| TRD-TC-E07 | Report an Issue modal — no reason (disabled submit) | ✅ PASS | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | IssueReportModal no-reason disabled submit (was BLOCKED) |
| TRD-TC-E08 | Report an Issue modal — reason selected (non-Other) | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | reason-chip deselect toggle DT-53 (08-29 PARTIAL → PASS) |
| TRD-TC-E09 | Report an Issue modal — "Other" + min-20 description | ✅ PASS | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | Other + min-20 description |
| TRD-TC-E10 | Report an Issue modal — submitting + success/error | ✅ PASS | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | submit → amber banner; DT-42B |
| TRD-TC-F01 | Payout shown on completion (no dispute) | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | payout shown on completion |
| TRD-TC-F02 | Payout held when dispute is open | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | payout held on dispute; admin resolve-complete zeroing P1 fixed (task5 08-29 finding) |
| TRD-TC-F03 | Payout needs action when seller has no payout method | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | no payout method → requires_action |
| TRD-TC-G01 | Offer expiry reminders to seller | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | 6h+1h reminders, dedup |
| TRD-TC-G02 | Auto-complete reminders to buyer | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | 24h+2h auto-complete reminders |
| TRD-TC-G03 | Notification throttle per trade | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | throttle; payout not throttled |
| TRD-TC-G04 | Push notifications deep-link to correct screen | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | offer-reminder deep-link → Review Offer (08-29 PARTIAL gap fixed) |
| TRD-TC-G05 | Buyer cancel-request notification to seller | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | cancel-request notif to seller |
| TRD-TC-G06 | Cancel-request outcome notifications to buyer | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | cancel-request outcome notif to buyer |
| TRD-TC-G07 | Cancel-request resolution (keep-trade) notifications | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | keep-trade resolution notifs |
| TRD-TC-H01 | Free buyer sees subscription CTA | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | free-buyer upsell copy (qa-trade-success); task16 08-31 PASS* copy-variance |
| TRD-TC-H02 | Subscriber buyer used SP — "You saved $X" | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | 'Got it! You saved $8' permutation |
| TRD-TC-H03 | Subscriber seller on Accept SP listing — SP pending notice | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | seller Accept SP pending-SP notice |
| TRD-TC-H04 | Subscriber seller on Cash Only listing — upsell | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | cash-only upsell to Accept SP (task5 source+unit 08-29) |
| TRD-TC-H05 | Subscription lifecycle — trial / paid / cancel regression | 🟡 PARTIAL | PARTIAL | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | trial-start leg not on-device reachable (trial_enabled=false); state machine source-verified |
| TRD-TC-I01 | Safe meetup card on in_progress trade | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | safe-meetup card |
| TRD-TC-I02 | Safe meetup card dismissible per trade | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | dismiss persists per trade |
| TRD-TC-I03 | In-chat safety banner persistent | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | pinned banner |
| TRD-TC-I04 | Pre-first-message safety modal once per listing | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | once-per-trade modal |
| TRD-TC-I05 | Chat quick-reply chips on in_progress trade | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | quick-reply chips send (08-29 FAIL bug fixed DT-48) |
| TRD-TC-I06 | Liability disclaimer modal gates purchase (checkbox + Accept & Continue) | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | disclaimer gates purchase + ack recorded (task5 finding resolved) |
| TRD-TC-I07 | Disclaimer modal Cancel path — no trade created | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | cancel → no trade |
| TRD-TC-I08 | Disclaimer modal ✕ close behaves like Cancel | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✕ close like cancel |
| TRD-TC-I09 | Disclaimer checkbox resets to unchecked on reopen | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | checkbox resets on reopen |
| TRD-TC-I10 | Disclaimer modal loading state | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | disclaimer loading/retry |
| TRD-TC-I11 | Disclaimer modal not shown for non-trade actions | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | SP wallet opens, no modal |
| TRD-TC-J01 | Seller cancels in_progress trade → Level 1 | 📄 DOC-DRIFT | DOC-DRIFT | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | guide-drift: Level-1 seller-cancel alert removed per TFV2-023; backend count 0→1 verified |
| TRD-TC-J02 | 2nd post-acceptance cancel → Level 2 | 📄 DOC-DRIFT | DOC-DRIFT | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | guide-drift: Level-2 alert removed; backend count 1→2 verified |
| TRD-TC-J03 | 3rd post-acceptance cancel → Level 3 | 📄 DOC-DRIFT | DOC-DRIFT | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | guide-drift: Level-3 alert removed; backend 2→3 + admin flag verified |
| TRD-TC-J04 | Seller cancel button only on in_progress | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | cancel button only seller, in_progress |
| TRD-TC-J05 | Seller cancel modal shows seller reasons only | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | seller-only reasons (copy deviation) |
| TRD-TC-K01 | Subscriber sees $1.49 fee + Sales Tax line in value stack | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | subscriber stack |
| TRD-TC-K02 | Non-subscriber sees tiered fee (first-trade $1.49) + Sales Tax line in value stack | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | non-subscriber stack + gating |
| TRD-TC-K03 | SP discount row conditional on SP used | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | SP discount row show/hide |
| TRD-TC-K04 | Bundle checkout — fee charged per item (admin toggle OFF) | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | fee toggle OFF ×3 items |
| TRD-TC-K05 | Bundle checkout — one fee per bundle (admin toggle ON) | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | fee toggle ON 1× |
| TRD-TC-K06 | Bundle timeline — fee display matches charge mode | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | both bundle modes |
| TRD-TC-K07 | Admin partial refund — refund price only, keep fee | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | partial refund price-only |
| TRD-TC-K08 | Admin partial refund — tax ledger partially refunded | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | tax ledger on partial refund (task5 finding fixed DT-48) |
| TRD-TC-K09 | Payments reconciliation page — charged vs refunded per trade | ✅ PASS | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | payments reconciliation |
| TRD-TC-K10 | Server-side enforcement — one-fee-per-bundle with stale client | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | EF stale-client bundle → 409 SP_INSUFFICIENT (task5 TRADE_INSERT_ERROR fixed) |
| TRD-TC-K11 | Seller fee = 5% × cash portion (SP trade) | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | fee = pct × cash portion (staging 10/20%, guide 5% stale) |
| TRD-TC-L01 | Bundle banner on trade detail | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | bundle banner expand |
| TRD-TC-L02 | Confirm All shortcut for bundle (buyer) | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | Confirm All 2 |
| TRD-TC-L03 | Bundle offer rows in Offers tab (seller) | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | NEEDS ACTION bundle row |
| TRD-TC-L04 | Non-bundle offers render as single rows | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | single row Review only |
| TRD-TC-L05 | In-progress bundles section in Buying tab | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | IN PROGRESS bundle group |
| TRD-TC-L06 | Bundle banner in Review Offer screen | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | Review Offer bundle SP/net |
| TRD-TC-L07 | Accept All N Items in Review Offer screen | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | Accept All |
| TRD-TC-L08 | Individual accept/decline alongside bundle siblings | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | individual accept + sibling pending |
| TRD-TC-L09 | Bundle card in Your Offers (buyer) | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | Your Offers bundle card; disclaimer=Amazon boilerplate finding |
| TRD-TC-L10 | Bundle cancel prompt (buyer + seller) | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | cancel-all vs just-this-one |
| TRD-TC-L11 | Bundle checkout skips items already in an active trade — buyer notified, flow continues | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | bundle checkout active-trade item |
| TRD-TC-M01 | Add first item → active cart created | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | add first item |
| TRD-TC-M02 | Add second item from same seller | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | same-seller direct add |
| TRD-TC-M03 | Add item from different seller → choice modal | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | different-seller modal |
| TRD-TC-M04 | Replace Cart option | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | replace cart |
| TRD-TC-M05 | Cannot add own item to cart | ⏭️ SKIPPED | SKIPPED | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | own-item add — not exercised (second-persona need) |
| TRD-TC-M06 | Cannot add unavailable / out-of-node item | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | sold item not found |
| TRD-TC-M07 | Duplicate item prevented in same cart | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | duplicate add in-cart |
| TRD-TC-M08 | Remove item from cart | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | remove item |
| TRD-TC-M09 | Clear cart | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | clear cart $0 |
| TRD-TC-M10 | Saved carts: max 3, server rejects 4th save, switch cart | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | saved-cart 3/3 cap server reject; doc drift LRU |
| TRD-TC-M11 | Minimum cart value warning + checkout blocked | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | min cart value (via N01) |
| TRD-TC-M12 | Max SP available shown per cart item (subscriber) | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | Accepts Points badge; no numeric |
| TRD-TC-M13 | Realtime: item becomes unavailable while in cart | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | realtime-unavailable notice |
| TRD-TC-M14 | Favorites add / remove | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | favorite add/remove |
| TRD-TC-M15 | Favorites screen: availability + empty state | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | unavailable overlay |
| TRD-TC-M16 | Success toast appears and auto-dismisses on add-to-cart | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | toast 2.5s window; source-corroborated |
| TRD-TC-M17 | Cart badge increments in sync with toast | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | cart badge |
| TRD-TC-M18 | Toast copy uses "Trade Basket" terminology | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | toast; source-corroborated |
| TRD-TC-M19 | Home dashboard Favorites quick-action tile navigates to Favorites | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | home tile favorites |
| TRD-TC-M20 | Discover header heart icon navigates to Favorites | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | discover header favorites |
| TRD-TC-N01 | Admin sets minimum cart value → reflects in app | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | admin min cart value reflects in app + blocked checkout |
| TRD-TC-N02 | Admin minimum cart value validation | ✅ PASS | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | admin validation; no $5 floor (doc drift) |
| TRD-TC-N03 | Admin updates Minimum Listing Price on Config → Fees tab | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task10-dt66-fix-verify-tr-d-2026-08-30` | min listing price config-write leg 0→5→0 verified |
| TRD-TC-N04 | Seller cannot publish single-item listing below threshold | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | below-threshold adjust-price modal |
| TRD-TC-N05 | Bulk: below-threshold items flagged, valid items publish | ✅ PASS | PASS | 2026-08-31 | `qa-task13-dt71-dt72-verify-2026-08-31` | bulk below-min block closed (DT71/DT69); was BLOCKED/PARTIAL |
| TRD-TC-N06 | Existing listing auto-paused when threshold raised above price | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | admin auto-pause real |
| TRD-TC-N07 | Seller raises price to meet threshold → listing repurchasable | 🔴 STILL OPEN | BLOCKED | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | FLAG: needs auto-paused sub-min $4 listing fixture (R41); positive leg not driven |
| TRD-TC-N08 | Regression: single-item + bundle checkout at/above threshold | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | single + bundle at/above threshold |
| TRD-TC-N09 | Price adjustment modal displays correct copy and button text (single-item) | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | modal copy/button |
| TRD-TC-N10 | "Update Price" dismisses modal and auto-scrolls + auto-focuses price field (single-item) | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | dismiss + autoscroll/focus |
| TRD-TC-N11 | Price adjustment modal in edit listing flow (single-item edit) | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | edit-flow modal, no save |
| TRD-TC-N12 | Bulk listing: per-item chip shows dynamic threshold in missing-required warning | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | bulk chip dynamic threshold |
| TRD-TC-N13 | Bulk listing: publish failure shows clear error message for below-threshold items | ✅ PASS | PASS | 2026-08-31 | `qa-task13-dt71-dt72-verify-2026-08-31` | bulk publish error (was BLOCKED) |
| TRD-TC-N14 | Regression: minimum-price validation still blocks publish in single-item and bulk flows | ✅ PASS | PASS | 2026-08-31 | `qa-task13-dt71-dt72-verify-2026-08-31` | regression blocks (was PARTIAL) |
| TRD-TC-O01 | Sales tax shown in checkout/cart breakdown (0 SP) | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | tax in checkout $2.10 on $30 |
| TRD-TC-O1 | Admin creates a new tax rule for general_tangible_goods | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | /tax/rules admin surface confirmed (O1-C1..C17) |
| TRD-TC-O02 | Tax base stays on full item price as SP entry changes (offer + checkout) | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | SP=4 tax unchanged (BP-37) |
| TRD-TC-O2 | Single taxable item, no SP — offer is quoted/authorized, not collected | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | quote/authorize-not-collect mobile leg |
| TRD-TC-O03 | Tax $0 when globally disabled | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | global toggle honored read+write (task11 FAIL fixed DT68) |
| TRD-TC-O3 | Buyer wording: "Payment authorized" before capture (Awaiting Seller) | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | 'Payment authorized' while awaiting seller |
| TRD-TC-O04 | Tax $0 when node tax disabled | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | rule engine overrides node rate (re-verified DT69) |
| TRD-TC-O05 | Tax-exempt user sees Tax Free badge | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | Tax Free badge |
| TRD-TC-O06 | Transaction history shows tax details | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | completed Payment Details rows |
| TRD-TC-O07 | Refund shows proportional tax refunded | 🟡 PARTIAL | PARTIAL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | backend proportional tax refund DB-verified; end-user refund-detail UI deferred (guide ⏭️) |
| TRD-TC-O08 | Tax shown on trade timeline/detail for buyer only | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | Estimated Sales Tax buyer-only |
| TRD-TC-P01 | Node tax rate config (view/edit, validation) | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | node rate save + validation real |
| TRD-TC-P02 | Bulk tax update across nodes | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | no bulk-node UI exists; matches guide defer |
| TRD-TC-P03 | Tax rate change history / audit | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | rules version history; no node change-history UI |
| TRD-TC-P04 | Global tax settings toggle + warning banner | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | toggle round-trips (task11 FAIL fixed) |
| TRD-TC-P05 | Tax reporting dashboard: summary + date presets | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | tax reports summary |
| TRD-TC-P06 | Jurisdiction breakdown + 7 report types | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | by-jurisdiction breakdown |
| TRD-TC-P07 | CSV export for filing | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | export CSV wired; download env-limited |
| TRD-TC-P08 | Admin changes rate → new transactions use new rate | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | new txn uses rule rate (re-verified) |
| TRD-TC-Q01 | Review prompt ([Rate Seller] / [Rate Buyer]) on completion | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | rate prompt |
| TRD-TC-Q02 | Star rating required — submit blocked without rating | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | rating required |
| TRD-TC-Q03 | Comment optional, max 500 characters | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | char count |
| TRD-TC-Q04 | Anonymous review hides reviewer identity | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | anonymous |
| TRD-TC-Q05 | Skip review — no blocking, no re-prompt for same trade | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | Skip for Now (analytics-only) |
| TRD-TC-Q06 | Mutual review status shown on completed trade detail | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | reviewed-banner |
| TRD-TC-Q07 | Completed reviews visible on counterparty's profile | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | profile visible |
| TRD-TC-Q08 | Average rating and total review count on user profile | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | average |
| TRD-TC-Q09 | Rating breakdown (5 → 1 stars) on profile | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | breakdown |
| TRD-TC-Q12 | One review per trade — duplicate submission blocked | ✅ PASS | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | no duplicate prompt |
| TRD-TC-Q15 | Flag a review (select reason) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | reviewee-only report model PASS; spec deviation (guide: any user) |
| TRD-TC-Q17 | Cannot flag own review | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | cannot flag own review (model) |
| TRD-TC-Q18 | Admin moderation queue — reported reviews with counts | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | moderation queue |
| TRD-TC-Q19 | Admin approves (unhides) a reported review | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | Keep |
| TRD-TC-Q20 | Admin deletes a reported review | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | Hide |
| TRD-TC-R06 | Refund settlement breakdown (cash + proportional tax + fee) | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | void correct for uncaptured auth (DT68) |
| TRD-TC-R07 | SP reversal on refund (reserved/transferred returned) | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | source-confirmed SP reversal mechanism; SP in-progress cancel not UI-driven |
| TRD-TC-R08 | Seller payout withheld / cancelled on refund | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | no seller_payouts on cancel/void (re-confirmed) |
| TRD-TC-R09 | Admin dispute resolve → Refund (full settlement) | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | dispute queue verified; resolve→Refund money-flow fixture-gapped |
| TRD-TC-R10 | Admin dispute resolve → Complete (no refund) | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | admin dispute → Complete; payout row; PI-capture timing observation |
| TRD-TC-R11 | Refund / cancellation notifications to both parties | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | refund/cancel notifs both parties |
| TRD-TC-R12 | Refund idempotency — no double refund | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | refund idempotency |
| TRD-TC-R13 | Cancelled / refunded trade status + timeline | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | cancelled status + timeline |
| TRD-TC-S01 | Different-seller modal uses generic copy (no seller name leak) | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S02 | "More from this seller" icon appears only when 2+ approved listings | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S03 | "More from this seller" icon hidden when seller has exactly 1 listing | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | hide gate source-confirmed; no single-listing-seller fixture |
| TRD-TC-S04 | Tapping icon opens "More from this seller" page — no seller identity | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S05 | Add to Cart from filtered seller page populates cart correctly | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S06 | "Matches Your Cart" indicator on filtered seller page | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | matchesBanner source-verified |
| TRD-TC-S07 | Bundle CTA appears on CartScreen with 2+ same-seller items | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S08 | Bundle CTA hidden with single item or empty cart | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 1-item CTA source-confirmed |
| TRD-TC-S09 | Bundle CTA navigates to checkout in bundle mode | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S10 | Bundle checkout shows "Bundle Offer" banner | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | bundle banner bundleMode source |
| TRD-TC-S11 | Regression: Discover/search grid unchanged (no badges) | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | discover grid unchanged source |
| TRD-TC-S12 | Regression: single-item offer flow unchanged | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | single-offer flow unchanged source |
| TRD-TC-S13 | Regression: seller identity unlocks only post-acceptance | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S14 | More from seller — Item Detail CTA in standalone position (below seller card) | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S15 | More from seller — Item Detail CTA hidden at 0 additional listings | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | same hide gate as S03 |
| TRD-TC-S16 | More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | banner doesn't disrupt badge source |
| TRD-TC-S17 | More from seller — Trade Basket banner shows correct remaining-item count | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S18 | More from seller — Trade Basket banner recalculates after adding item from filtered page | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | count recalc source |
| TRD-TC-S19 | More from seller — Trade Basket banner disappears when all seller's listings are in basket | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | hidden when all in basket source |
| TRD-TC-S20 | More from seller — Trade Basket banner dismissible via X button | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S21 | More from seller — Banner and filtered page never reveal seller identity | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S22 | Regression: Seller Info card elements unchanged | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | seller card unchanged source |
| TRD-TC-S23 | Regression: Trade Basket subtotal/total/bundle CTA layout unaffected | ✅ PASS | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` |  |
| TRD-TC-S24 | More from seller — Return-to-Cart navigation after adding item from filtered page | 🟡 PARTIAL | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | return-to-cart nav source |
| TRD-TC-T01 | SP input appears only on eligible items; ineligible show "Not eligible" label | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | SP input on Accept-SP item only |
| TRD-TC-T02 | Entered SP applies correct amount (wallet + category cap both sufficient) | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | 45 SP applied to $60 (75% cap) |
| TRD-TC-T03 | Entered SP applies partial amount with "Limited by your SP balance" subtext when wallet insufficient | 🟡 PARTIAL | PARTIAL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | wallet-limited path w/ actual balance 4; guide 8-SP scenario not reproducible; DT72 phrasing verified |
| TRD-TC-T04 | Category cap limits applied points even when wallet covers more | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | admin-set cap → client hint + server reject (task15 divergence fixed) |
| TRD-TC-T05 | Clearing SP restores balance for sequential allocation | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | sequential allocation real-time |
| TRD-TC-T06 | Running "Points remaining" counter updates accurately across entries/clears | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | real-time counter on 3-item bundle (task12/task13/15) |
| TRD-TC-T07 | Order Summary "Points Applied" line and cash total correct after multiple SP entries | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | order-summary math |
| TRD-TC-T08 | Seller Review Offer shows per-item points breakdown | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | bundle-list vs payout-card SP off-by-one fixed (DT76) |
| TRD-TC-T09 | Seller Review Offer shows "Total Payout" and "Buyer's Total Paid" correctly | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | payout card + bundle totals |
| TRD-TC-T10 | "Includes points redemption" tag on seller's offer list/inbox card | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | 'Includes points redemption' tag on bundle (task15 finding fixed) |
| TRD-TC-T11 | Wallet ledger: buyer debited at offer, seller credited + bonus at completion | 🟡 PARTIAL | PARTIAL | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | SP transfers at COMPLETION by design (D-17); completion-time release verified across A02/C05/Z05 runs |
| TRD-TC-T12 | No ledger transaction on offer decline | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | seller decline no seller ledger; buyer refund |
| TRD-TC-T13 | Regression: single-item (non-bundle) offer flow with SP still works | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | single-item SP regression |
| TRD-TC-T14 | Regression: bundle CTA, different-seller modal, "more from this seller" still functional | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | bundle CTA / modal / more-from-seller regression |
| TRD-TC-U01 | Root/tab screens use pattern 1 (no back button, greeting/avatar/title, bell) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | root header pattern |
| TRD-TC-U02 | Secondary/detail screens use pattern 2 (back button + title + bell) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | detail back-button |
| TRD-TC-U03 | Notification bell behavior + badge accuracy | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | bell → notifications |
| TRD-TC-U04 | Screens without ScreenLayout still have working headers | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | EditProfile canonical header |
| TRD-TC-U05 | Checkout/payment screens intentionally hide the bell | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | checkout header hides bell |
| TRD-TC-V01 | "Basket" (short form) appears in bottom tab bar | 🔴 STILL OPEN | FAIL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | bottom-tab label 'Basket' not 'Trade Basket' (real copy defect; X01 same) |
| TRD-TC-V02 | "Trade Basket" appears as screen title on Cart screen | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | cart title |
| TRD-TC-V03 | Empty state shows "trade basket" in copy | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | empty state |
| TRD-TC-V04 | "View Trade Basket" button on Item Detail screen | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | Item Detail button |
| TRD-TC-V05 | "Add to Trade Basket" button on More from This Seller screen | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | more-from-seller add |
| TRD-TC-V06 | "In Trade Basket" status on More from This Seller items already in basket | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | in-basket dimmed |
| TRD-TC-V07 | "Added to Trade Basket" alert on item add | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | added alert |
| TRD-TC-V08 | "Matches Your Trade Basket" badge on matching items | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | badge immediate on Item Detail (task14 FAIL fixed DT75) |
| TRD-TC-V09 | Different-seller modal references "trade basket" | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | different-seller modal copy |
| TRD-TC-V10 | Bundle CTA says "Make one offer" (no "Bundle" visible) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | bundle CTA wording |
| TRD-TC-V11 | "Combined Offer" banner on checkout (no "Bundle" visible) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | checkout combined banner |
| TRD-TC-V12 | Bundle Builder screen title shows "Build Offer" (no "Bundle" visible) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | Build Offer title |
| TRD-TC-V13 | Favorites "Added to Trade Basket" alert copy | 🟡 PARTIAL | PARTIAL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | alert copy verified; favorites-screen trigger not driven |
| TRD-TC-V14 | Functional behavior unchanged (adding items, submitting offers) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | functional regression |
| TRD-TC-W01 | Trades page has "Single Trades" and "Bundle Trades" tabs | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | tabs |
| TRD-TC-W02 | Single Trades tab shows only non-bundle trades | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | single table |
| TRD-TC-W03 | Bundle Trades tab groups trades by bundle_id | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | bundle columns |
| TRD-TC-W04 | Bundle row shows item count, totals, buyer/seller, statuses | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | bundle row |
| TRD-TC-W05 | Clicking a bundle row navigates to bundle detail page | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | bundle detail |
| TRD-TC-W06 | Bundle detail page lists all trades in the bundle | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | trades in bundle |
| TRD-TC-W07 | Bundle detail page shows monetary breakdown | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | monetary breakdown |
| TRD-TC-W08 | Each trade row links to individual trade detail | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | single detail |
| TRD-TC-W09 | Bundle detail page has "Force Cancel Entire Bundle" action | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | Force Cancel visible on non-terminal fixture (task15 negative-only) |
| TRD-TC-W10 | Force Cancel succeeds for all trades in the bundle | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | Force Cancel succeeds + DB read-back |
| TRD-TC-W11 | Status filter works in Bundle Trades view | ✅ PASS | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | status filter |
| TRD-TC-W12 | Tab toggle resets filters when switching views | ✅ PASS | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | status filter resets on Single↔Bundle toggle (task15 minor defect fixed) |
| TRD-TC-X01 | Bottom nav renders identically on Home (Dashboard) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | tab label 'Basket' — see V01 |
| TRD-TC-X02 | Bottom nav renders identically on Discover | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X03 | Bottom nav renders identically on Trades | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X04 | Bottom nav renders identically on Trade Basket | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X05 | Bottom nav renders on Item Detail / Cart Checkout / Trade screens | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X06 | Bottom nav renders on Profile, Settings, Wallet, Subscriptions | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X07 | Cart badge shows item count from multiple entry points | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X08 | Cart badge count accuracy — add / remove / clear | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X09 | "Me" tab removed — Profile still accessible via Home avatar | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X10 | Sell FAB opens action sheet on every screen | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` |  |
| TRD-TC-X16 | Flow Registry (nav) — flow-registry.md entries updated | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | flow-registry entries source |
| TRD-TC-Y01 | Trade List summary filter chips | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | summary chips |
| TRD-TC-Y02 | Trade List Load More history pagination | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | history pagination |
| TRD-TC-Y03 | Trade List Message button on rows | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | row Message |
| TRD-TC-Y04 | Trade List "See all →" link | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | See all → History |
| TRD-TC-Y05 | R15 — Request More Time (requester) | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | request extension |
| TRD-TC-Y06 | R15 — counterparty Accept | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | counterparty accept |
| TRD-TC-Y07 | R15 — counterparty Decline | ⏭️ SKIPPED | SKIPPED | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | decline path not driven (single-extension-per-trade) |
| TRD-TC-Y08 | R15 — granted state | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | granted state |
| TRD-TC-Y09 | "What to do next" card + "Got it" toggle | ✅ PASS | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | what-to-do card |
| TRD-TC-Z01 | Buyer request → seller approves → cancel + refund | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | approve → cancel + refund |
| TRD-TC-Z02 | Seller declines → escalate → admin approve-cancel | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | decline → escalate → admin approves |
| TRD-TC-Z03 | Timeout auto-escalates to admin | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | timeout escalation → buyer notified (task17 no-notify defect fixed) |
| TRD-TC-Z04 | Buyer withdraws a pending request | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | buyer withdraw |
| TRD-TC-Z05 | Bundle: whole-bundle default + per-item option | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | whole-bundle cancel cascade + sibling SP release (task17 HIGH defect closed) |
| TRD-TC-Z06 | Escalation disabled → decline ends the request | ✅ PASS | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | escalation-off copy (task17 copy defect fixed) |
| TRD-TC-Z07 | Gating: no request on pending/completed/disputed/duplicate | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | gating by state |
| TRD-TC-Z08 | Regression: seller instant cancel unchanged | ✅ PASS | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | seller instant cancel + TFV2-023 consequence |

### Remaining test cases — NEVER RUN (19)

| TC-ID | Description | Note / why remaining |
|---|---|---|
| TRD-TC-A03 | Accept SP: Pay Cash (0 SP) — subscriber seller still earns SP | Accept SP listing (buyer 0 SP, subscriber seller earns SP) — no run on disk |
| TRD-TC-A04 | Donate listing: [Claim] button, no charge | Donate listing [Claim] — no run on disk |
| TRD-TC-B12 | SP info tooltip (not wired — flag) | SP info tooltip — guide flags not wired |
| TRD-TC-B13 | Duplicate-offer modal navigation (dead code — flag) | Duplicate-offer modal navigation — guide flags dead code |
| TRD-TC-D05 | Post-meetup nudge after auto-complete | Post-meetup nudge after auto-complete — guide: post-MVP, not built |
| TRD-TC-D06 | Pickup window drives the auto-complete deadline (R2 — configurable) | (post-MVP / not built) |
| TRD-TC-E05 | Admin resolves dispute → Complete | Admin resolves dispute → Complete — not run under E-ID; same behavior PASS under TRD-TC-R10 (2026-09-02 qa-task18) |
| TRD-TC-E06 | Admin resolves dispute → Refund | Admin resolves dispute → Refund — not run under E-ID; same behavior PASS under TRD-TC-R09/R11 (qa-task12/18) |
| TRD-TC-N2 | Retried offer submission → exactly 1 PaymentIntent / 1 trade / 1 SP reservation / 1 audit row | Idempotency & Audit (N2-C01..C10) — no dedicated run; individual idempotency legs verified under B/C/O/R rows |
| TRD-TC-Q10 | Edit review succeeds within 24h window | 24h edit window — time-dependent, descoped |
| TRD-TC-Q11 | Edit blocked after 24h window | 24h edit window — time-dependent, descoped |
| TRD-TC-Q13 | 30-day same-counterparty cooldown enforced | 30-day cooldown — time/multi-account, descoped |
| TRD-TC-Q14 | 24h post-completion cooldown — review locked | 24h post-completion lock — time-dependent, descoped |
| TRD-TC-Q16 | Auto-hide review after 3+ reports | Auto-hide after 3+ reports — needs 3 distinct reporters, descoped |
| TRD-TC-R01 | Buyer cancels pending trade → cancelled, auth voided, SP restored | Buyer cancels pending — equivalent behavior PASS under TRD-TC-B04 |
| TRD-TC-R02 | Seller declines pending offer → cancelled, SP restored | Seller declines pending — equivalent PASS under TRD-TC-B01/C02 |
| TRD-TC-R03 | Offer expiry → auto-cancel + competing offers cancelled | Offer expiry auto-cancel — equivalent PASS under TRD-TC-B02/C03 |
| TRD-TC-R04 | Card declined at offer submission → no trade created | Card declined at offer — equivalent PASS under TRD-TC-B06 |
| TRD-TC-R05 | Seller cancels in_progress → refund + consequence level | Seller cancels in_progress — equivalent PASS under TRD-TC-C06 |

## ACC · Account / Dashboard / Help / Legal

**Guide file:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` · **Cases:** 75 · **PASS** 57 · **PARTIAL** 0 · **OPEN** 17 · **DOC-DRIFT** 0 · **SKIPPED** 1 · **Remaining (NEVER RUN)** 0

### Completed test cases (have a verdict on record)

| TC-ID | Description | Status | Latest | Date | Source | Notes |
|---|---|---|---|---|---|---|
| ACC-TC-A01 | Settings screen sections + rows render | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-A02 | Sign Out confirmation | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-A03 | Test Push Notification (rate limit / quiet hours / queued) | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-A04 | Settings → legal & help links navigate | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-A05 | "Manage Payment Methods" row navigates | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-B01 | Edit profile fields load + save (optimistic) | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-B02 | Email change requires re-verification | ✅ PASS | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-B03 | Phone change → OTP verification modal | 🔴 STILL OPEN | BLOCKED | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | BLOCKED (env/fixture) |
| ACC-TC-B04 | Avatar upload | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-B05 | Profile screen stats, badges, reviews, status badge | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-B06 | Form validation (phone 10-digit, email format) | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-B07 | "No Changes" alert | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-B08 | Waitlist prompt (unreachable from Edit Profile — flag) | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-B09 | "Already verified" phone path | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-B10 | Locked-field "cannot be changed" alerts | ✅ PASS | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` |  |
| ACC-TC-C01 | Linked accounts list (email readonly, password, social) | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-C02 | Link a social provider (password re-auth gate) | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-C03 | Unlink provider (confirmation + last-method guard) | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-C04 | Email mismatch on link blocked | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-D01 | Five categories × three channel toggles | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-D02 | Optimistic toggle reverts on failure | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-D03 | Quiet hours toggle + time validation | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` |  |
| ACC-TC-D04 | Empty state → Initialize Settings | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-E01 | Delete account consequences + password gate | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-E02 | Wrong password blocked | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-E03 | Two-step confirmation → deletion + logout | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-F01 | Suspended account screen (Contact Support + Log Out, no email) | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-F02 | Unsubscribe via deep-link token (success/error) | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-F03 | Offline screen + Try Again | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-F04 | Suspended account — Log Out tap | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-G01 | Greeting + subscription badge + SP balance | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-G02 | Dashboard banners (independent top banners + Action Items list) | 🔴 STILL OPEN | BLOCKED | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | BLOCKED (env/fixture) |
| ACC-TC-G03 | Quick action tiles route correctly | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G04 | ID verification CTA banner (none / rejected only) | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G05 | Recommendations + recent trade card | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G06 | Pull-to-refresh reloads dashboard | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G07 | "Show more actions" toggle | ✅ PASS | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` |  |
| ACC-TC-G08 | Free-user "Unlock Swap Points" strip | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G09 | "No session found" state | 🔴 STILL OPEN | BLOCKED | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | BLOCKED (env/fixture) |
| ACC-TC-G10 | Empty-trade state | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G11 | "View Timeline" nav | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G12 | "See All" → Discover nav | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-G13 | Subscription-card Upgrade button | ✅ PASS | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` |  |
| ACC-TC-H01 | Help & Support menu (3 cards) routes (entered from Profile) | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-H02 | FAQ list — search + category filter | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-H03 | FAQ fallback when offline | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-H04 | FAQ detail — helpful vote (Yes/No) | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-H05 | Contact Support form (unified flow — logged-in AND logged-out) | ✅ PASS | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` |  |
| ACC-TC-H06 | No raw support-email surfaces (cross-screen sweep) | ✅ PASS | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` |  |
| ACC-TC-H07 | Contact Support reachable logged-out (Login + Signup entry) | ✅ PASS | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` |  |
| ACC-TC-I01 | Education Help screen sections (accordion + deep link) | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-I02 | SP Calculator (free mode) sell/buy outputs | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-I03 | SP Calculator bonus category badge | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-I04 | SP Calculator validation (price range) | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-I05 | Education analytics events fire | ✅ PASS | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` |  |
| ACC-TC-J01 | Terms of Service view + last updated | ✅ PASS | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-J02 | TOS acceptance flow (requireAcceptance) | 🔴 STILL OPEN | FAIL | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | FAIL, unresolved |
| ACC-TC-J03 | Privacy Policy view + acceptance | ✅ PASS | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-J04 | Liability Disclaimer view (read-only + retry) | ✅ PASS | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-J05 | Policy versioning — re-acceptance on new version | 🔴 STILL OPEN | FAIL | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | FAIL, unresolved |
| ACC-TC-J06 | Signup implies TOS + Privacy agreement (no mandatory dialog) | ✅ PASS | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-J07 | Legal screen unavailable state (no published policy) | 🔴 STILL OPEN | BLOCKED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | BLOCKED (env/fixture) |
| ACC-TC-J08 | Legal screen load failure — inline error (Retry only on Liability) | 🔴 STILL OPEN | BLOCKED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | BLOCKED (env/fixture) |
| ACC-TC-J09 | Very long policy content renders + scrolls smoothly | ✅ PASS | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-J10 | Legal screens render consistently on iOS and Android | ⏭️ SKIPPED | SKIPPED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-J11 | Legal screen loads < 2s and scrolls without lag | ✅ PASS | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` |  |
| ACC-TC-J12 | Liability Disclaimer unavailable state | 🔴 STILL OPEN | BLOCKED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | BLOCKED (env/fixture) |
| ACC-TC-K01 | 🚫 NOT IMPLEMENTED — MFA factors list + enrollment (no UI exists) | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-K02 | 🚫 NOT IMPLEMENTED — enroll/verify authenticator factor (no UI) | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-K03 | 🚫 NOT IMPLEMENTED — MFA challenge on protected action (no UI) | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-K04 | 🚫 NOT IMPLEMENTED — recovery / remove factor (no UI) | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-L01 | Render-time error shows fallback instead of red/white screen | ✅ PASS | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` |  |
| ACC-TC-L02 | Try Again recovers after transient error | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-L03 | Persistent error stays contained to fallback | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |
| ACC-TC-L04 | Error reporting is safe with and without telemetry | 🔴 STILL OPEN | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | BLOCKED (env/fixture) |

_All cases in this guide have a verdict on record — none remaining._

## ADM · Admin Portal

**Guide file:** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` · **Cases:** 160 · **PASS** 0 · **PARTIAL** 0 · **OPEN** 0 · **DOC-DRIFT** 0 · **SKIPPED** 1 · **Remaining (NEVER RUN)** 159

### Completed test cases (have a verdict on record)

| TC-ID | Description | Status | Latest | Date | Source | Notes |
|---|---|---|---|---|---|---|
| ADM-TC-S03 | Support reply (stored + emailed to user) | ⏭️ SKIPPED | SKIPPED | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` |  |

### Remaining test cases — NEVER RUN (159)

| TC-ID | Description | Note / why remaining |
|---|---|---|
| ADM-TC-A01 | Admin login with admin role |  |
| ADM-TC-A02 | Non-admin login rejected (RBAC gate) |  |
| ADM-TC-A03 | Dashboard layout: intro → health strip → Action Center → KPIs (no duplicate nav) |  |
| ADM-TC-A04 | Direct protected route access without session redirects to login |  |
| ADM-TC-A05 | Expired session redirects once without a loop |  |
| ADM-TC-A06 | Dashboard KPI cards follow design-system styling |  |
| ADM-TC-B01 | User list, search, status filters, pagination |  |
| ADM-TC-B02 | User detail drawer (identity, subscription, SP, trades) |  |
| ADM-TC-B03 | Suspend / ban / delete account |  |
| ADM-TC-B04 | Credit/debit SP + freeze wallet from user |  |
| ADM-TC-B05 | User analytics cards (totals, DAU/MAU) |  |
| ADM-TC-B06 | Reset Password action |  |
| ADM-TC-B07 | Unsuspend action |  |
| ADM-TC-B08 | Sort By / Sort Order |  |
| ADM-TC-C01 | Listing management — search & analytics tabs |  |
| ADM-TC-C02 | Flagged items — filter tabs + statuses |  |
| ADM-TC-C03 | Approve flagged item |  |
| ADM-TC-C04 | Reject item with required reason |  |
| ADM-TC-C05 | Item detail view + appeal info |  |
| ADM-TC-C06 | Force Delete |  |
| ADM-TC-C07 | Pause |  |
| ADM-TC-C08 | Approve |  |
| ADM-TC-C09 | Request Edits |  |
| ADM-TC-C10 | Reject |  |
| ADM-TC-C11 | Select-all / selection counter (no bulk execute — flag) |  |
| ADM-TC-C12 | Individual filter controls |  |
| ADM-TC-D01 | Category list, filters (incl. Bonus), search |  |
| ADM-TC-D02 | Create / edit category + SP multiplier |  |
| ADM-TC-D03 | Activate / deactivate category |  |
| ADM-TC-D04 | Category suggestions queue + count badge |  |
| ADM-TC-D05 | Icon / badge upload |  |
| ADM-TC-D06 | SP spending cap % |  |
| ADM-TC-D07 | SP redemption cap |  |
| ADM-TC-D08 | Drag-and-drop reorder |  |
| ADM-TC-D09 | Bulk actions (Activate / Deactivate / Delete / Export CSV) |  |
| ADM-TC-D10 | Delete category + guards |  |
| ADM-TC-D11 | Suggestion Approve / Merge / Reject |  |
| ADM-TC-E01 | Geographic nodes list + stats |  |
| ADM-TC-E02 | Add / edit node |  |
| ADM-TC-E03 | Deactivate node with members warning |  |
| ADM-TC-E04 | Node settings (radius validations) |  |
| ADM-TC-E05 | ZIP waitlist queue + status filter |  |
| ADM-TC-E06 | Node tagging completeness (N6) — every record resolves to one node |  |
| ADM-TC-E07 | Per-node KPIs (N6) — expansion-gate metrics per node |  |
| ADM-TC-E08 | Waitlist API authorization (401 without admin session) |  |
| ADM-TC-F01 | Global configuration inline edit + permission gate |  |
| ADM-TC-F02 | Cart settings (min value, max carts, expiry) |  |
| ADM-TC-F03 | Trade timing config (timing keys + nested validation) — incl. consolidated fees |  |
| ADM-TC-F04 | Settings single-source — cross-link + last-updated + audit |  |
| ADM-TC-F05 | N1 configurability — pickup countdown + payout buffer (live) |  |
| ADM-TC-F06 | R2 — 7-day guardrail (hard block) + pickup reminders (live) |  |
| ADM-TC-F07 | Trade Pipeline visualization — see & track trades in all stages |  |
| ADM-TC-F08 | R1 tiered buyer-fee fields (live) |  |
| ADM-TC-F09 | Buyer Fee-Tier Distribution table (moved → /analytics) |  |
| ADM-TC-F10 | Legacy fee keys (audit-only, read-only — live) |  |
| ADM-TC-F11 | Reset button |  |
| ADM-TC-G01 | Policy tabs (TOS/Privacy/Liability) + versions |  |
| ADM-TC-G02 | Create new policy version (version regex) |  |
| ADM-TC-G03 | Edit draft policy |  |
| ADM-TC-G04 | Publish policy (confirmation) |  |
| ADM-TC-H01 | Trade list filters + columns |  |
| ADM-TC-H02 | Trade detail (info, monetary breakdown, audit) |  |
| ADM-TC-H03 | Trade admin actions |  |
| ADM-TC-H04 | Subscription Context section |  |
| ADM-TC-H05 | External References (Stripe PI/refund + SP ledger IDs) |  |
| ADM-TC-H06 | Sales Tax line in monetary breakdown |  |
| ADM-TC-I01 | Dispute queue + SLA highlighting |  |
| ADM-TC-I02 | Mark dispute under review |  |
| ADM-TC-I03 | Resolve dispute — Complete |  |
| ADM-TC-I04 | Resolve dispute — Refund |  |
| ADM-TC-I05 | Filter-tab click behavior (All/Reported/Under Review) |  |
| ADM-TC-J01 | Tax admin entry points (no bare /tax — use sub-pages) |  |
| ADM-TC-K01 | Payout fee configuration + test breakdown |  |
| ADM-TC-K02 | Payouts management list, stats, filters |  |
| ADM-TC-K03 | Retry failed payout (confirmation) |  |
| ADM-TC-L01 | SP Economy hub tabs (Health/Flow/Rules) |  |
| ADM-TC-L02 | SP Analytics dashboard + CSV export |  |
| ADM-TC-L03 | SP Wallet admin — economy metrics + search |  |
| ADM-TC-L04 | SP adjustment (credit/deduct) with reason |  |
| ADM-TC-L05 | Freeze / unfreeze / suspend wallet |  |
| ADM-TC-L06 | SP Economy summary metrics — dashboard + /sp-wallet entry (no home card) |  |
| ADM-TC-L07 | SP Wallet state RPC — get_user_sp_wallet_summary returns wallet_state |  |
| ADM-TC-L08 | SP Wallet warning banners (mobile) — frozen/suspended/grace |  |
| ADM-TC-M01 | Grace period config (days + reminders) |  |
| ADM-TC-M02 | Subscriptions list, filters, metrics |  |
| ADM-TC-M03 | Extend / cancel / reactivate |  |
| ADM-TC-M04 | Reactivate button (confirm + mobile reflection) |  |
| ADM-TC-M05 | Metrics cards (MRR/churn/trial) |  |
| ADM-TC-M06 | "free" status filter |  |
| ADM-TC-N01 | Referral configuration tab |  |
| ADM-TC-N02 | Referral analytics tab |  |
| ADM-TC-N2 | Financial audit journal viewable per trade |  |
| ADM-TC-N03 | 5 SP fields + 3 toggles |  |
| ADM-TC-N04 | "Missing configuration" warning |  |
| ADM-TC-O01 | ID badge queue + stats + status filter |  |
| ADM-TC-O02 | Review request — approve |  |
| ADM-TC-O03 | Review request — reject with reason |  |
| ADM-TC-O04 | Request details (screenshot deleted note) |  |
| ADM-TC-O05 | Message templates edit |  |
| ADM-TC-P01 | Badge management list + toggle |  |
| ADM-TC-P02 | Create/edit/delete badge |  |
| ADM-TC-P03 | Manual award badge |  |
| ADM-TC-P04 | Badge sandbox event simulation |  |
| ADM-TC-Q01 | Reported reviews list + reason filter |  |
| ADM-TC-Q02 | Hide review (confirmation — copy corrected) |  |
| ADM-TC-Q03 | Approve review (unhide + delete reports — copy corrected) |  |
| ADM-TC-Q04 | Status filter dropdown |  |
| ADM-TC-Q05 | Sort-by dropdown |  |
| ADM-TC-Q06 | Search input |  |
| ADM-TC-R01 | Education sections/examples/analytics |  |
| ADM-TC-R02 | FAQ management (questions/categories/analytics) |  |
| ADM-TC-R03 | Publish FAQ / education content |  |
| ADM-TC-S01 | Support inbox + unread filter (incl. Guest tickets) |  |
| ADM-TC-S02 | Support detail + mark as read |  |
| ADM-TC-T01 | Revenue & Analytics dashboard |  |
| ADM-TC-T02 | Notification analytics (category/type/variant) |  |
| ADM-TC-U01 | Audit logs view |  |
| ADM-TC-V01 | Monitoring run + alerts (acknowledge/note) |  |
| ADM-TC-V02 | Cron jobs status + run history + timezone |  |
| ADM-TC-W01 | Sidebar grouped into 7 labeled sections |  |
| ADM-TC-W02 | Expand / collapse a section via label + chevron |  |
| ADM-TC-W03 | Section state persists per admin across sessions |  |
| ADM-TC-W04 | Active route auto-expands its parent section |  |
| ADM-TC-W05 | Active/inactive item styling + label typography |  |
| ADM-TC-W06 | Collapsed icon rail shows all destinations |  |
| ADM-TC-W07 | All previous nav destinations still reachable |  |
| ADM-TC-X01 | Action Center page loads aggregated cards |  |
| ADM-TC-X02 | Same-type items bundled with count |  |
| ADM-TC-X03 | Severity tags (Urgent/Routine) |  |
| ADM-TC-X04 | Expand card drills into item list |  |
| ADM-TC-X05 | Inline approve flagged item |  |
| ADM-TC-X06 | Inline mark dispute under review |  |
| ADM-TC-X07 | Inline retry failed payout (confirmation) |  |
| ADM-TC-X08 | Empty state "All caught up" |  |
| ADM-TC-X09 | Sidebar pinned nav item + live count badge |  |
| ADM-TC-X10 | Header bell opens Action Center + badge |  |
| ADM-TC-X11 | Config drift card lists out-of-range settings |  |
| ADM-TC-X12 | Dashboard embeds top-5 Action Center cards + View all link |  |
| ADM-TC-X13 | Cancellation Insights card drill |  |
| ADM-TC-X14 | /cancellation-insights full page |  |
| ADM-TC-Y01 | ⌘K / Ctrl+K opens the palette from any page |  |
| ADM-TC-Y02 | Header search bar opens the palette |  |
| ADM-TC-Y03 | Parallel search across 4 entity types with grouped labels |  |
| ADM-TC-Y04 | Breadcrumb context per result row |  |
| ADM-TC-Y05 | Input debounced ~200ms |  |
| ADM-TC-Y06 | Top 5 per group + "See all N results" expansion |  |
| ADM-TC-Y07 | Footer "View all in <domain>" → prefilled list page |  |
| ADM-TC-Y08 | Selecting a result navigates directly |  |
| ADM-TC-Y09 | Keyboard navigation (↑/↓/↵/Esc) + focus trap |  |
| ADM-TC-Y10 | Non-admin rejected (permission scoping) |  |
| ADM-TC-Y11 | Secret settings values never shown |  |
| ADM-TC-Y12 | Empty + no-results states |  |
| ADM-TC-Z01 | Health strip renders below title, above Action Center |  |
| ADM-TC-Z02 | Six indicators with colored dots + labels + values |  |
| ADM-TC-Z03 | Dot color reflects configurable thresholds |  |
| ADM-TC-Z04 | Clicking an indicator navigates to its detail page |  |
| ADM-TC-Z05 | Failed Payouts deep-link pre-filters to failed |  |
| ADM-TC-Z06 | Thresholds tunable via /config (health) without code change |  |
| ADM-TC-Z07 | Dashboard embeds Action Center below the strip |  |

## SUB · Subscriptions / Payouts / SP Wallet

**Guide file:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` · **Cases:** 100 · **PASS** 45 · **PARTIAL** 2 · **OPEN** 3 · **DOC-DRIFT** 0 · **SKIPPED** 0 · **Remaining (NEVER RUN)** 50

### Completed test cases (have a verdict on record)

| TC-ID | Description | Status | Latest | Date | Source | Notes |
|---|---|---|---|---|---|---|
| SUB-TC-A01 | Subscription Plans screen — Free vs Kids Club+ cards | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-A02 | Plan Comparison table — feature-by-feature + POPULAR badge | ✅ PASS | PASS | 2026-09-02 | `qa-task22-sub-remainder-2026-09-02` | comparison table renders (qa22 "A02 PASS (render)" — render-level pass) |
| SUB-TC-A03 | Dynamic pricing & fees pulled from admin config | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-A04 | Current plan reflected (button disabled / "Current Plan") | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-C01 | My Subscription screen — paid member view | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-C02 | My Subscription quick menu (Billing / Payment / Help) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-C03 | Manage Kids Club+ — status, next billing, days remaining | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-C04 | Cancel flow — retention screen "Keep My Benefits" | ✅ PASS | PASS | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | real on-device cancel loop (disposable sub user): My Subscription → Cancel → retention "We'll miss you!" (C04 surface) → confirm → cancelled; Stripe cancel_at_period_end + DB status canceled verified (A6) |
| SUB-TC-C05 | Cancel reason modal + final confirmation | 🟡 PARTIAL | PARTIAL | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | cancel OUTCOME verified via the My Subscription retention/alert path (A6); the Manage Kids Club+ reason-modal surface (cancel-reason-* rows, disabled Confirm, Other free-text) NOT driven — genuine PARTIAL |
| SUB-TC-C06 | Cancelled subscription stays active until period end | ✅ PASS | PASS | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | Manage shows Cancelled / Access Until Oct 2 / 30 days / Auto-Renew OFF + benefits-until-end copy; Stripe cancel_at 2026-10-02 (A6) |
| SUB-TC-C07 | Auto-renew toggle / update payment method | ✅ PASS | PASS | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | in-app re-enable toggle → Stripe cancel_at_period_end=false + DB active again (A6) |
| SUB-TC-C08 | Manage Kids Club+ free/no-subscription state | ✅ PASS | PASS | 2026-09-02 | `qa-task22-sub-remainder-2026-09-02` | test-free Manage: "You don't have an active Kids Club+ subscription." + green Subscribe CTA (qa22 b4-C08) |
| SUB-TC-C09 | Manage Kids Club+ expired state | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` |  |
| SUB-TC-C10 | My Subscription free-user state | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-C11 | My Subscription "Learn More" link | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-C12 | My Subscription "Member Since" value (latent bug) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-D01 | Grace period banner + SP wallet frozen warning | ✅ PASS | PASS | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | test-grace Manage Kids Club+ (deep link): Status 'Grace Period' badge + warning box "Grace Period Active / Your Swap Points are frozen. Re-subscribe before November 2, 2026 to restore access, or they will be permanently deleted." + Re-subscribe to Kids Club+ CTA. Copy diff vs guide: live shows the re-subscribe DEADLINE (grace_ends_at 11/02/2026) rather than guide's "Your subscription ended on ..." phrasing + day-count — intent met. Closes the Manage-Kids-Club-surface equivalent of SUB-TC-I05 |
| SUB-TC-D03 | Subscription Expired screen — benefits lost + Renew | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` |  |
| SUB-TC-D06 | 📦 moved to Fixture-Gated Backlog (clock/push fixture) | 🔴 STILL OPEN | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | BLOCKED (env/fixture) |
| SUB-TC-D07 | 📦 moved to Fixture-Gated Backlog (clock/push fixture) | 🔴 STILL OPEN | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | BLOCKED (env/fixture) |
| SUB-TC-E01 | Billing History list — records, status badges, amounts | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | bundled with SUB-TC-K01 PASS (qa19, same live TransactionHistory surface) + qa21 E01-billing-recon renewal row |
| SUB-TC-E02 | Billing History empty state | ✅ PASS | PASS | 2026-09-02 | `qa-task22-sub-remainder-2026-09-02` | test-free Transaction History empty state — "No billing history yet." (on-device qa22; was budget-not-run in qa21, NOT blocked) |
| SUB-TC-E03 | Failed charge shows error message | ✅ PASS | PASS | 2026-09-04 | `qa-task26-msg-g-closing-2026-09-03` | FAILED row ($5.99 Sep 3) shows error_message caption under red badge — DEV-TASK-101 render fix live (test-buyer billing-history deep link)
| SUB-TC-E04 | ⏸ FIXTURE-GATED (push-payload) — Subscription Status screen diagnostics | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` |  |
| SUB-TC-F02 | Payout method section (add vs existing) — live | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-H05 | Withdraw Now from Payout Settings hero (verified template) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-I01 | SP Wallet hero balance + lifetime stats | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-I02 | Quick actions (Shop / Sell / History) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-I03 | How to Earn SP section + Learn More | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-I04 | SP expiration info + expiring-soon alert | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-I05 | Wallet warning banner by state (active/grace/expired) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-I07 | SP Wallet — "Reserved in trades" card | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-I08 | SP Wallet — "Wallet Not Found" error | 🔴 STILL OPEN | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | BLOCKED (env/fixture) |
| SUB-TC-I09 | SP Wallet — pending-release summary note | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-J01 | SP History tabs (All / Earned / Spent) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-J02 | Transaction rows — type icon, label, signed amount | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-J03 | Empty state per tab | ✅ PASS | PASS | 2026-09-02 | `qa-task22-sub-remainder-2026-09-02` | test-free SP History All/Earned/Spent all "No transactions yet" (qa22; was budget-not-run in qa21, NOT blocked) |
| SUB-TC-J04 | Pull-to-refresh updates ledger | ✅ PASS | PASS | 2026-09-02 | `qa-task22-sub-remainder-2026-09-02` | RefreshControl wired (SpTransactionHistoryScreen L147); pull gesture executed, no error (qa22; was budget-not-run in qa21) |
| SUB-TC-K01 | Transaction History list + status badges | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-L01 | Renewal webhook → billing + member state — **LIVE PASS** (QA Task 21: real test-clock renewal advanced `current_period_end` + wrote `billing_history` row) | ✅ PASS | PASS | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | qa21 §F upgrades PARTIAL→PASS (real test-clock renewal: current_period_end 10-02→11-02 + billing_history row in_1UBMIB4 599 SUCCEEDED) |
| SUB-TC-L02 | Payment-failed webhook → retry/grace — **PASS** (grace/freeze leg confirmed live via DT99 independent QA) | ✅ PASS | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | qa25 Batch4 PASS (cross-ref): DT99 independent QA drove real failing-renewal on a disposable user — 3rd failure → status grace_period + sp_wallets.state grace_period + 3 critical payment-failed notifs; upgrades PARTIAL→PASS |
| SUB-TC-L03 | Invalid webhook signature rejected — **PASS** (live negative-signature POST) | ✅ PASS | PASS | 2026-09-02 | `qa-task22-sub-remainder-2026-09-02` | qa22 L03 PASS (live): POST to stripe-webhook-subscriptions with bogus Stripe-Signature → HTTP 400 INVALID_SIGNATURE, no mutation; upgrades qa21 PARTIAL→PASS |
| SUB-TC-L04 | Duplicate webhook delivery idempotent — **LIVE PASS** (QA Task 21: 4 webhook events → ONE `subscriptions` + ONE `subscription_events` row) | ✅ PASS | PASS | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | qa21 §F upgrades PARTIAL→PASS (4 webhook events → ONE subscriptions + ONE subscription_events row; billing_history UNIQUE(charge_id) held) |
| SUB-TC-L05 | Payout-status webhook updates seller payout history (payout domain) | 🟡 PARTIAL | PARTIAL | 2026-09-02 | `qa-task21-sub-close-2026-09-02` |  |
| SUB-TC-M02 | Empty state + Add Payment Method (Stripe sheet) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-M03 | Saved-card display + security banner | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-M04 | Update Payment Method | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-M05 | Remove This Card (confirm + success) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-N01 | JoinKidsClub value-prop + web CTA | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |
| SUB-TC-N02 | JoinKidsClub web redirect (passitup.com) | ✅ PASS | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` |  |

### Remaining test cases — NEVER RUN (51)

| TC-ID | Description | Note / why remaining |
|---|---|---|
| SUB-TC-A05 | Kids Club+ Overview screen by subscription status |  |
| SUB-TC-B01 | 🔴 RETIRED — in-app payment removed; web-first → SUB-TC-N01/N02 + Web Subscription Purchase E2E (QA Task 20) |  |
| SUB-TC-B02 | 🔴 RETIRED — in-app payment screen removed; coverage → Web Subscription Purchase E2E (QA Task 20) |  |
| SUB-TC-B03 | 🔴 RETIRED — in-app Success screen removed; coverage → Web Subscription Purchase E2E (QA Task 20) |  |
| SUB-TC-B04 | 🔴 RETIRED — in-app trial-gating removed; server-side trial config → QA Task 20 finding F-3 |  |
| SUB-TC-B05 | 🔴 RETIRED — in-app trial-disabled alert removed; coverage → QA Task 20 finding F-3 |  |
| SUB-TC-B06 | 🔴 RETIRED — ContinueKidsClub is deep-link-only; see SUB-TC-N03–N06 |  |
| SUB-TC-B07 | 🔴 RETIRED — referral bonus-loss warning on removed Subscription Choice; see SUB-TC-N03 |  |
| SUB-TC-B08 | 🔴 RETIRED — in-app trial-limit CTA removed; config reflection → SUB-TC-R05 |  |
| SUB-TC-B09 | 🔴 RETIRED — in-app Stripe sheet removed; checkout UX → QA Task 20 scope 2 |  |
| SUB-TC-B10 | 🔴 RETIRED — in-app decline handling removed; checkout decline → QA Task 20 scope 2 |  |
| SUB-TC-B11 | 🔴 RETIRED — in-app saved-card resub removed; cards on file → Group M |  |
| SUB-TC-B12 | 🔴 RETIRED — in-app payment network-error path removed; → QA Task 20 scope 2 |  |
| SUB-TC-B13 | 🔴 RETIRED — in-app Apple/Google Pay removed; web wallet-pay → QA Task 20 scope 2 |  |

| SUB-TC-D02 | 🔴 RETIRED — in-app re-subscribe payment removed; web-first → SUB-TC-N01/N02 + Web E2E |  |
| SUB-TC-D04 | 🔴 RETIRED — in-app renewal payment removed; web-first → SUB-TC-N01/N02 + Web E2E |  |
| SUB-TC-D05 | Reactivate from cancelled state |  |
| SUB-TC-F01 | Payout Settings hero — Available / Pending / Lifetime Earned (live) |  |
| SUB-TC-F03 | Payout history list (completed / pending) — live |  |
| SUB-TC-F04 | Earnings figures (Available/Pending/Lifetime) + history net/fee — live |  |
| SUB-TC-F05 | Payout history empty state — live |  |
| SUB-TC-F06 | Pending earnings figure follows admin release timing — live |  |
| SUB-TC-F07 | Payout load error + recovery — live |  |
| SUB-TC-F08 | Payout history Load More pagination (+5) — live |  |
| SUB-TC-G01 | Add Stripe Connect payout method (onboarding) |  |
| SUB-TC-G02 | 🚫 N/A — PayPal/Venmo unconfigured provider (UI lists, not drivable) |  |
| SUB-TC-G03 | 🚫 N/A — Bank ACH unconfigured / no UI option |  |
| SUB-TC-G04 | Set primary method / delete method (confirmation) |  |
| SUB-TC-G05 | Unverified method blocks payout (live: cannot set primary / withdraw) |  |
| SUB-TC-G06 | requires_action payout → "Set Up Payout Method" |  |
| SUB-TC-G07 | Payout Settings — "Edit Details" sheet |  |
| SUB-TC-G08 | "Cannot Delete Primary/Only Method" guard |  |
| SUB-TC-G09 | "Cannot Set as Primary" (unverified) guard |  |
| SUB-TC-G10 | Payout history Load More |  |
| SUB-TC-G11 | NoMethodModal flow |  |
| SUB-TC-H01 | Withdraw Now — no-balance guard (amount entry removed) |  |
| SUB-TC-H02 | WithdrawModal summary — Available / Payout Fee / You'll Receive |  |
| SUB-TC-H03 | Confirm Withdrawal success |  |
| SUB-TC-H04 | Withdraw blocked when no verified primary method |  |
| SUB-TC-H06 | Admin minimum withdrawal blocks full-balance requests below the floor |  |
| SUB-TC-H07 | Minimum withdrawal disabled when config = 0 |  |
| SUB-TC-I06 | Free user SP wallet inactive state |  |
| SUB-TC-K02 | Transaction History empty + error/retry |  |
| SUB-TC-M01 | Payment Methods — loading state |  |
| SUB-TC-M06 | Go Back |  |
| SUB-TC-M07 | Backend contract — attach / detach / retryFailedPayment branches |  |
| SUB-TC-N03 | Route-alias reachability (JoinKidsClub vs deep-link-only aliases) |  |
| SUB-TC-N04 | ContinueKidsClub active-subscription variant |  |
| SUB-TC-N05 | ContinueKidsClub loading state |  |
| SUB-TC-N06 | ContinueKidsClub trial-ending urgency badge |  |

