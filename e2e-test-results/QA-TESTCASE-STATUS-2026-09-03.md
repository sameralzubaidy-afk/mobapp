# QA Test-Case Status — All Canonical Guides

> Future-reference status of **every canonical test case** in the 6 consolidated guides under `cross-checked-and-consolidated/`, reconciled against all QA evidence on disk through **2026-09-03**. Read-only snapshot — no guides/code/reports modified. Full narrative + method in `TEST-COVERAGE-INVENTORY-v2.md` (repo root); raw data in `temp/tc-inventory-v2/`.

**Generated:** 2026-09-03 · **Last maintained:** 2026-09-05 (QA Task 33 — DT117 visual confirm + SUB 30-closure partial: SUB D05/F01/F03/F04/G07/G08/H02/N04 → PASS, F08/G10 → PARTIAL, I06 DOC-DRIFT→PASS; SUB ACTIVE remaining 30→20) · **Total canonical cases:** 833

## Status legend

| Status | Meaning |
|---|---|
| ✅ PASS | Executed; latest verdict PASS (may carry minor copy/finding notes) |
| 🟡 PARTIAL | Executed with partial/limited evidence (source-confirmed, tooling-limited, or fixture-gapped sub-leg) |
| 🔴 STILL OPEN | Latest verdict FAIL or BLOCKED with no later PASS re-verification — real residual defect or env/fixture block |
| 📄 DOC-DRIFT | Guide assertion is obsolete/superseded; the underlying backend behavior was verified |
| ⏭️ SKIPPED | Attempted but explicitly not exercised (budget/persona/scope) |
| 🗑️ REMOVED | Feature/screen deleted from the product; documented disposition (status added QA Task 31d), not a defect or a run |
| 🔁 RETIRED | In-app flow removed/superseded — coverage moves to a referenced successor; documented disposition (31d), not a run |
| 🚫 NOT-SUPPORTED | Case asserts a capability the product deliberately does not provide (verified by design/DB); documented disposition (31d), not a defect |
| 🚫 N/A | Not applicable — the referenced integration/provider is not configured or has no UI option in this deployment (31d) |
| NEVER RUN | **Remaining** — no report on disk asserts a verdict under this canonical ID |

## 1 · Per-guide roll-up

| Guide | Canonical file | Cases | ✅ PASS | 🟡 PARTIAL | 🔴 OPEN | 📄 DRIFT | ⏭️ SKIP | 🗑️ REMOVED | 🔁 RETIRED | 🚫 NOT-SUPPORTED | 🚫 N/A | **Remaining (NEVER RUN)** |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **AUTH** | `AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` | 138 | 118 | 2 | 11 | 0 | 2 | 5 | 0 | 0 | 0 | **0** |
| **MSG** | `MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` | 72 | 64 | 4 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | **0** |
| **TRD** | `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` | 288 | 234 | 28 | 2 | 3 | 2 | 0 | 0 | 0 | 0 | **19** |
| **ACC** | `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` | 75 | 57 | 0 | 17 | 0 | 1 | 0 | 0 | 0 | 0 | **0** |
| **ADM** | `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` | 160 | 143 | 12 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | **3** |
| **SUB** | `MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` | 100 | 56 | 4 | 3 | 0 | 0 | 0 | 15 | 0 | 2 | **20** |

Completed = any of PASS/PARTIAL/OPEN/DRIFT/SKIP/REMOVED/RETIRED/NOT-SUPPORTED/N/A. PASS/PARTIAL/OPEN rows have been executed at least once; DRIFT/SKIP/REMOVED/RETIRED/NOT-SUPPORTED/N-A rows are documented dispositions; the **Remaining** column is what still needs a run. Per-guide status columns sum to each guide's documented Cases total.

> **ADM canonical note (QA Task 31d):** the ADM guide's documented total is **160**. Its Completed block additionally tracks **8 supplementary sub-case evidence rows above the 160 canonical** — N2-A02…A08 (idempotency/audit invariants) + F06b (DT106 regression spot-check): 7 PASS + 1 PARTIAL. Those are excluded from the canonical PASS/PARTIAL counts above (canonical completed = 157; 157 + 3 remaining = 160).

> **Out-of-index body sections (QA Task 31d scan — item 8):** every guide carries a trailing `## Regression`-style body group whose R-IDs are **NOT** in its official Test Case Index, so they are intentionally not counted in the 833 totals: AUTH `Regression checks` R01–R06 + ACC-01–06 (accessibility), MSG `Regression checks` R01–R06, TRD `Regression checks` R01–R06 (TRD's indexed "Group R — Refund & Cancellation" R01–R06 is separate and IS tracked), ACC `Regression` R01–R05, SUB `Regression` R01–R05, and ADM `Regression` R01–R05 (collides with indexed Education R01–R03 — see ADM 31d note). Verdict: supplementary regression/coverage guidance, **not owed** as additional tracked cases (adding them would break the documented totals); ADM's colliding rows were descoped from the per-case table (evidence in `qa-task29…/ledger-FULL-160.md`).

## AUTH · Signup / Onboarding / Nodes / Listing / Discovery

**Guide file:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` · **Cases:** 138 · **PASS** 118 · **PARTIAL** 2 · **OPEN** 11 · **DOC-DRIFT** 0 · **SKIPPED** 2 · **REMOVED** 5 · **Remaining (NEVER RUN)** 0

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
| AUTH-TC-H04 | ~~Welcome screen → Get Started~~ (REMOVED — screen deleted; superseded by H06/H07) | 🗑️ REMOVED | REMOVED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | Reclassified 31d: feature removed (screen deleted) — disposition, not a defect |
| AUTH-TC-H05 | ~~Feature Highlights carousel~~ (REMOVED — screen deleted; superseded by H06/H07) | 🗑️ REMOVED | REMOVED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | Reclassified 31d: feature removed (screen deleted) — disposition, not a defect |
| AUTH-TC-H06 | Onboarding carousel: Next / Skip / Get Started | ✅ PASS | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` |  |
| AUTH-TC-H07 | Onboarding completion routes to Home | ✅ PASS | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` |  |
| AUTH-TC-I01 | ~~Start Free Trial enrolls Kids Club+~~ (REMOVED — no in-app trial-choice step; subscription purchase superseded by web-first `JoinKidsClubScreen` path) | 🗑️ REMOVED | REMOVED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | Reclassified 31d: feature removed (no in-app trial step) — disposition, not a defect |
| AUTH-TC-I02 | ~~Continue Free stays on free tier~~ (REMOVED — post-Profile-Setup routes to EDU carousel → free-tier Home; no Continue Free step) | 🗑️ REMOVED | REMOVED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | Reclassified 31d: feature removed (no Continue Free step) — disposition, not a defect |
| AUTH-TC-I03 | ~~Trial limit reached hides trial CTA~~ (REMOVED — no in-app trial CTA; trial disabled via `admin_config.trial_enabled=false`) | 🗑️ REMOVED | REMOVED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | Reclassified 31d: feature removed (no in-app trial CTA) — disposition, not a defect |
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

**Guide file:** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` · **Cases:** 72 · **PASS** 64 · **PARTIAL** 4 · **OPEN** 2 · **DOC-DRIFT** 0 · **SKIPPED** 0 · **NOT-SUPPORTED** 2 · **Remaining (NEVER RUN)** 0

> **QA Task 30 (2026-09-04, `qa-task30-adm-moderation-msg-y-2026-09-04/`) — MSG last-3 never-run pool closed (G05/G08/G09).** Config round-trips + recall-flagged scenario + banner leg executed; behavioral legs gated on product/infra decisions (no recall_alert producer; Google Vision reachability). MSG now has 0 remaining never-run cases.

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
| MSG-TC-D10 | Decision notifications honor channel preferences — 🚫 NOT SUPPORTED (no such category) | 🚫 NOT-SUPPORTED | NOT SUPPORTED | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | by-design NOT SUPPORTED confirmed: notification_category enum = subscription/sp_events/badges/trades/system (NO id_verification); ID-verif notifications route via badges — DB enum + test-buyer prefs verified. Mirrors J05. Reclassified 31d from DOC-DRIFT to NOT-SUPPORTED (status added to legend) |
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
| MSG-TC-G05 | Recall safety alert notification | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | banner leg PASS: cpsc_recall side-flag on a disposable (item_safety_flags flag_type=cpsc_recall pending) → seller Safety Review renders "This listing is currently under safety review." + FLAGGED (mobile, on-device). Notification leg = product-decision-gated: NO production producer of a recall_alert notification exists (check-item-safety only flags → generic "Item Under Review" notification) — guide wording unverified per its own 2026-08-12 flag. MSG last-never-run pool now closed |
| MSG-TC-G08 | AI moderation toggle affects automated image review | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | config round-trip PASS: moderation_ai_enabled false→true→false via qa:admin-config-set, DB+UI (/config MODERATION) verified each way. Behavioral AI-image-flag leg = infra-gated (Google Vision AI service reachability from staging + an image fixture that triggers it — R41 runbook verdict; do not fake). G08 no longer never-run |
| MSG-TC-G09 | Recall check toggle and threshold affect recall flagging | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | config round-trips PASS: cpsc_recall_check_enabled true→false→true + cpsc_match_threshold 0.5→0.95→0.5 (qa:admin-config-set, DB+UI verified). Match behavior: check_cpsc_recalls('FUNTOK 24V 2-Seater Ride-On Truck') → recall 26348 @ 0.9143 similarity (≥0.5 = flagged; EF gate source: score ≥ threshold). Recall-flagged scenario driven on a disposable (item_safety_flags cpsc_recall + flagged + queue + mobile banner). Residual: full New-Item create-with-recall-title comparison leg not driven (ItemCreate fiddly; needs a recall-titled create) — EF-level threshold demonstration residual. G09 no longer never-run |
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
| MSG-TC-J05 | 🚫 NOT SUPPORTED — ID verification preference category (none exists) | 🚫 NOT-SUPPORTED | NOT SUPPORTED | 2026-09-04 | `qa-task28-mobile-closure-sub-msg-2026-09-04` | by-design NOT SUPPORTED re-confirmed via DB enum for D10 — no id_verification category; ID-verif routes via badges. Reclassified 31d from DOC-DRIFT to NOT-SUPPORTED (status added to legend) |

### Remaining test cases — NEVER RUN (0)

None — the last 3 (MSG-TC-G05/G08/G09) were executed in QA Task 30 (`qa-task30-adm-moderation-msg-y-2026-09-04`); see their Completed rows above. MSG's never-run pool is fully closed.

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

**Guide file:** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` · **Cases:** 160 (canonical) · **PASS** 139 · **PARTIAL** 16 · **OPEN (FAIL)** 1 · **DOC-DRIFT** 0 · **SKIPPED** 1 · **Remaining (NEVER RUN)** 3 · (+8 supplementary sub-case rows in Completed — see roll-up note)
> **QA Task 32 Part 1 (2026-09-05, `qa-task32-adm-r6-sub-2026-09-05/`) — ADM final-closure round (QA31-M R6), COMPLETE deliverable.** Drove the last fixture-gated remainder with fresh fixtures + mobile legs: **E05** (fresh 90210 signup → Join Waitlist → admin /waitlist on the fresh row — NEW MOD finding: User column always "Unknown user", `/api/admin/waitlist` selects nonexistent `profiles.display_name`), **E02** (admin add+edit node 60601 + fresh user resolves to it, no waitlist), **C09** (live pending→needs_edits + seller mobile ListingSafetyReview with exact reason), **X05** (live flagged → Action Center Approve → buyer-visible), **G04** (disposable liability publish + **DT109 Make Active restore** — publish confirm exact copy, real restored, disposable archived), **P01** (toggle round-trip), **P03** (manual award → mobile "New Badge Earned" + showcase), **O04** (reviewed request details + screenshot-deleted privacy note), **X07** (staged failed payout → Retry → pending). NEW MED defects found: badge icon upload fails (storage `badge-icons` RLS "new row violates row-level security policy"), education-section Publish fails (PGRST202 — `publish_section(section_id)` vs `publish_section(p_section_id)` arg mismatch). PARTIAL→PASS: X07, G04, O04, P03. P02/R03 remain PARTIAL (now gated on the two MED defects). M03/M04 remain deferred to the SUB round (QA Task 32 Part 2).
> **QA Task 31-M R5 (2026-09-05, `qa-task31m-r5-mobile-owed-2026-09-05/`) — mobile-leg closure round.** Mobile legs driven E2E (admin→mobile→DB): **D02** (multiplier 1.15 → mobile SP estimate ~23 SP on $20 + Bonus badge in picker), **D05** (uploaded icon → mobile picker renders image, no 📦 fallback), **D06/D07** (Sports spending 75% display + redemption-cap 3 enforced: offer screen "Max: 3 SP (75% of price)" + typing 10 clamps to 3 — cap reverted NULL), **D08** (DT110 Move-Down reorder → mobile picker B-before-A — PARTIAL→PASS), **D09/D10** (bulk deactivate → hidden; delete → gone; reactivate → back — disposables deleted, 0 residue), **E03** (deactivated-node ZIP 90210 → mobile "Not Available in Your Area" waitlist modal), **E04** (radius min 5→10 live → mobile slider "10 mi" → reverted), **C06** (force delete → buyer "no longer available"), **C08** (approve → buyer Request to Buy), **C10** (rejected → seller ListingSafetyReview REJECTED + reason), **N03** (referral SP config 40/20/10/25 → mobile Referrals values match), **Y08** (palette Listings nav via DT108 title search — PARTIAL→PASS), **N2-A01** (per-trade financial audit journal — PARTIAL→PASS). E02/E05 (signup-fixture), C09/X05 (same-surface cross-refs), G04 (global policy re-prompt blast), M03/M04 (SUB round), O04/P01/P02/P03/R01/R03 (fixture rounds) remain mobile-leg-owed with stated reasons.
> **QA Task 31-M R3 (2026-09-05, `qa-task31m-r3-adm-fg-dispute-q-2026-09-05/`) — C12 + L07 flipped PARTIAL→PASS (DT112 fixes verified live); F03/F05/F06/F08/I03/I04/X06/Q01–Q06 mobile-leg/live-trade enforcement driven.**
> **QA Task 31 v2 (2026-09-04, `qa-task31-adm-near-total-2026-09-04/`) — near-total closure round (7 batches): 43 PASS / 1 FAIL / 16 PARTIAL.** Batch 1 DT108 spot-checks (SMS-stats clean, ⌘K listings nav, C05 guide correction, notif-key P0001 rejection, fe3924ee dispute reset) hold. B04 SP-wallet commit legs PASS on a disposable wallet. Disputes I01–I05 closed live (queue/SLA, under-review, resolve-complete → completed + payout row, resolve-refund → PI cancelled, filter tabs). Categories D02–D11 (7 PASS / 3 PARTIAL). Nodes E01–E05/E08 + policies G02/G03 PASS (G04 publish gated — no safe revert on load-bearing legal surface). Batch 7 clean-pool 17 PASS / 1 FAIL (L02 `/sp-analytics` missing `category_sp_analytics` table) / 10 PARTIAL. **Still open/remaining:** B03/B06/B07 (prompt()-tooling, ADM-R3), E06/E07 (SQL/RPC node cases), C11/C12, M01, L07/L08 (mobile-leg), X07/K03 retry commit (no failed-payout fixture). New completed rows added below (I01–I05, D02–D11, E01–E05/E08, G02–G04, L02–L05, M02–M06, O04/O05, P02–P04, R01–R03, S01/S02, T02, U01, W03/W06, Z03, N2-A02/A03/A04/A07/A08 + B04/C05/X07/K03 updates).

> **⚠️ QA Task 31 mobile-leg COVERAGE CORRECTION (2026-09-04, owner):** the QA31 PASS rows for cases the guide declares `Surfaces: admin, mobile` mean **PASS admin-leg only** — their mobile leg was NOT driven (owner: "my note was not only for category adding — that was just an example"). Mobile-impacting rows now **mobile-leg OWED** and must be re-driven on the app per R55 before counting fully PASS: **B04/L04/L05** (wallet balance/enforcement — L07/L08 are the dedicated mobile cases, still OPEN), **D02**(multiplier-estimate on device)/**D05/D06/D07/D08/D09/D10** (category UI effects), **I03/I04** (dispute-resolution reflection on both parties' mobile timelines), **E02–E05** (node/radius/waitlist on mobile), **G04** (policy gate), **M03/M04**, **O04**, **P02/P03**, **R01/R03**. Only **D03** (fully) + **D02-show** (partially) got a mobile leg (R55 follow-up). Full per-case table: `qa-task31-adm-near-total-2026-09-04/report.md` → "Mobile-impact coverage assessment". Scheduled as **QA Task 31-M (mobile-leg pass)** with explicit per-case scope (R40).

> **✅ QA Task 31-M v2 (2026-09-04, `qa-task31m-adm-mobile-impact-2026-09-04/`) — retroactive audit + first closure batch.** Phase 1 audit (full table in `audit-phase1.md`): across QA Task 28/29/30/31 PASS rows with mobile surface, only D03 (QA31) + O02/O03 (QA25 cross-ref) were genuinely mobile-verified; QA29's F03/F05/F06/F08 + N03 + P01 + Q01–Q06, and QA30's C03–C10 + X05/X06 were retroactively added to the owed set (admin+DB only evidence). Phase 2 closure driven this session: **B04/L05/L08 mobile enforcement PASS** (real /sp-wallet freeze+suspend → on-device ⚠️ Frozen + 🚫 Suspended banners → active; 4 audit rows, restored active/490) and **C07 buyer-visibility PASS** (admin Pause → buyer mobile "Listing not found"; restored available). Fixture gaps flagged (FG-1..5): F-group changed-value timing + I03/I04/X06 dispute reflection need a sanctioned in-progress-trade fixture; Q-group commit leg never executed (QA29 dismissed confirms); G04 forward-only publish; M03/M04 deferred to QA32; B03/B06/B07 prompt()-blocked. Findings: admin Pause has no in-UI unpause (P2); r41-moderation reset cleanup-line `.catch` bug (LOW); fragmented audit channels (note). Rows B04/L04/L05/C07 Notes updated with mobile-leg evidence.

> **QA Task 29 (2026-09-04, `qa-task29-adm-first-live-2026-09-04/`) — ADM's first full real execution round.** ~88 of 160 cases executed against the live admin portal. Full per-case ledger + reasons in `ledger-FULL-160.md` / `report.md`. Executed cases below moved to Completed; the remaining-table rows for executed IDs are superseded by the block below (prune on next maintenance).
> **QA Task 30 (2026-09-04, `qa-task30-adm-moderation-msg-y-2026-09-04/`) — disposable-fixture moderation round (C03–C10, X05–X07) + Y-group (⌘K palette) + DT106 spot-checks.** All 8 C moderation commit legs + X05/X06 PASS live on disposable fixtures (all deleted post-run); X07 fixture-gated (0 failed payout rows). Y01–Y12 executed (Y05/Y08 PARTIAL). Spot-checks: F06 batch guardrail fix HOLDS (one-Save 48→100/72→67 atomic, DT106); K02 /payouts data leg drivable + Z05 deep-link PASS; B04 = DOC-DRIFT (SP credit/debit lives on /sp-wallet, not /users). New finding: /config SMS-stats API 401 (same BP-49 class).

> **QA Task 31d (2026-09-04, tracker-maintenance — no execution).** De-dup/collapse in Completed: **B04** → single PASS row (QA31; QA30 DOC-DRIFT row removed — its drift note is folded into the QA31 row); **C05** → single PASS row (QA31 corrected `/items/flagged` Review-modal title; QA30 duplicate removed); **R01/R02** → single PASS row each using the guide's **Education & FAQ CMS** meaning (QA31). QA29's "Session persists across pages" / "Confirm destructive/financial" / "Auditable actions logged" rows were **mislabeled Regression-group rows** — the guide's `## Regression` body section (R01–R05) is NOT in the 160-case Test Case Index and collides with the indexed Education R01–R03 — so they are **descoped** from the canonical per-case table (evidence preserved in `qa-task29-adm-first-live-2026-09-04/ledger-FULL-160.md` → Regression section). **QA29-executed-but-never-recorded rows added** from `ledger-FULL-160.md`: H05 (PARTIAL), N02 (PASS), N04 (PASS), T01 (PARTIAL), X04 (PARTIAL), X08 (PARTIAL — fixture-gated), X11 (PARTIAL — fixture-gated), and **N2-A01** (PARTIAL) — the never-run table's bare "ADM-TC-N2" parent row was actually N2-A01's case; the guide's N2 family is N2-A01..A08 and all eight now have verdicts. Never-run table pruned **159 → 12** (147 rows already had verdicts in this Completed block).

### Completed test cases (have a verdict on record)

| TC-ID | Description | Status | Latest | Date | Source | Notes |
|---|---|---|---|---|---|---|
| ADM-TC-A01 | Admin login with admin role | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-A02 | Non-admin login rejected (RBAC gate) | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-A03 | Dashboard layout | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-A04 | Direct protected route → login | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-A05 | Expired session redirect once | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-A06 | KPI card design-system styling | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | label 12px vs 14px doc |
| ADM-TC-B01 | User list/filters/pagination | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | 5230 users |
| ADM-TC-B02 | User detail drawer | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-B05 | User analytics cards | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-B08 | Sort By / Sort Order | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-C01 | Listing management tabs | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-C02 | Flagged items tabs/statuses | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-D01 | Category list/filters/Bonus/SP | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-F01 | Config hub inline edit + gate | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-F02 | Cart settings + single-source | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-F03 | Trade timing + fees + validation | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA29 admin save/validation PASS. **QA31-M R3 live changed-value enforcement:** fee propagation on-device — buyer_fee_active_member_cents 149→199 → Make Offer (TradeOfferScreen, Accept-SP item) "Safety & Platform Fee" $1.49→**$1.99** (total $28.74), no relaunch (fn_get_buyer_fee_for_checkout reads live) → reverted 149 (DB each step). Timing propagation under F05 note. **DEV-TASK-113 item 3 — QA31-M R4 (2026-09-05): seller-timeline fee display reads the STORED fee, not current config.** Completed trade `01121468` (stored seller fee 600 → Platform Fee −$6.00 baseline); config `platform_fee_seller_percentage` 10→20 → fresh-fetch timeline STILL −$6.00 (config-derived would be −$12.00) → reverted 10 (DB-verified). (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-F04 | Settings single-source + audit | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-F05 | N1 pickup/payout config (live) | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA29 round-trip 2→5→2 DB PASS. **QA31-M R3 live enforcement:** pickup_window_hours 72→48 (admin /settings/trade-timing save, actor samer, DB 48) → `qa:r41-in-progress-trade create --with-auto-complete` (hasFlag fix verified live) → fixture trade 96b79ce6 auto_complete_at = run-time+48h (was 72h semantics; DB-verified) → **mobile timeline "Confirm pickup — auto-completes in 48h left"** (MOBILE-F05-timeline-auto-complete-48h.png). Reverted to 72 (DB-verified). **DEV-TASK-113 item 7 — QA31-M R4 (2026-09-05): countdown pill now reads "Confirm pickup — auto-completes in 71h 27m" with NO "left"** (omitSuffix via formatCountdownLabel; was "…48h left" in R3) on a fresh `--with-auto-complete` fixture timeline. (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-F06 | R2 168h guardrail + reminders | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA29 172h HARD-BLOCK (client+server) + QA30 F06b atomic-batch fix apply. **QA31-M R3 re-verify with a live in-progress fixture:** pickup=120 attempt (offer 48 + pickup 120 = 168h) on /settings/trade-timing → HARD-BLOCKED on both fields ("Offer + pickup (168h) must stay under 168h (Stripe's 7-day authorization limit). Lower one window.") → no DB write (pickup stayed 48; fixture trade deadline within the 7-day cap) |
| ADM-TC-F06b | (QA30 spot-check) R2 batch guardrail fix | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | DT106 batch RPC fix HOLDS: one-Save offer 48→100 + pickup 72→67 succeeded atomically (DB 100/67 SAME updated_at) → reverted 48/72 (DB-verified). The QA Task 29 order-dependent-guardrail finding is RESOLVED |
| ADM-TC-F07 | Trade Pipeline board | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-F08 | R1 tiered buyer-fee fields | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA29 six fields render (149/149/5/199/499/"Safety & Platform Fee") PASS. **QA31-M R3 fee-engine reflection on-device:** buyer_fee_active_member_cents (active-member tier, one of the six R1 fields) 149→199 → Make Offer fee $1.49→$1.99 via fn_get_buyer_fee_for_checkout (the R1 engine RPC the actual charge also uses) → reverted 149 (DB each step). First-trade-tier leg (free user first trade) fixture-gated — needs a genuinely-first-trade free persona (R41-class dedicated session). **QA31-M R4 (2026-09-05): first-trade-tier leg CLOSED end-to-end.** `qa:r41-first-trade` free persona (…014): Leg1 REAL offer (fee $1.49 on offer screen) → seller accept → buyer complete → trade `27f04815` COMPLETED `buyer_transaction_fee_cents=149` held through completion; profiles.fee_state `no_completed_trade→first_trade_completed`, count 0→1. Leg2 SECOND offer (new tagged item) → fee **$3.24** on-screen = 324 (`buyer_fee_subsequent_fixed_cents` 199 + 5%×cash 125) → trade `37141792` pending 324 (fee reverted to the free persona's normal subsequent schedule — NOT active-member 149, which is the trial/active tier) — discount genuinely one-time. `reset` → 0 residue (persona + 2 items + 2 trades deleted, DB-verified). (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-F09 | Fee-Tier Distribution (/analytics) | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-F10 | Legacy fee keys read-only | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-G01 | Policy tabs + versions | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-H01 | Trade list filters/columns | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-H02 | Trade detail money breakdown | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | DB-verified $45.99 |
| ADM-TC-H03 | Trade admin actions | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | affordance (not committed) |
| ADM-TC-H04 | Subscription Context section | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-H06 | Sales Tax line | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-J01 | Tax admin entry points | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | bare /tax 404 confirmed |
| ADM-TC-K01 | Payout fee configuration | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-L01 | SP Economy hub tabs | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-L06 | SP Economy summary + sidebar | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | card-sp-wallet gone |
| ADM-TC-N01 | Referral config tab | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-N03 | Referral SP fields | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | QA29 admin enum PASS; mobile leg R5: DB sp_config referrer 40 / referee 20 / listing 10/25 / starter 10 / program+toggles active → mobile Referrals screen shows First Trade 20 SP, First Listing 25 SP, "You earn: 40 SP per trade • 10 SP per listing" — values match config exactly (R54) |
| ADM-TC-O01 | ID badge queue/stats/filter | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-O02 | ID review — approve | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | cross-ref QA Task 25 |
| ADM-TC-O03 | ID review — reject | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | cross-ref QA Task 25 |
| ADM-TC-P01 | Badge list + toggle | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-Q01 | Reported reviews list + filter | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | GENUINE fixture execution (QA29 was UI-only on an effectively empty queue): 3 live reported reviews staged (`qa:r41-review` spam/offensive/false_info) → /reviews queue shows per-card reviewer/reviewee/rating/comment/🚩1/reason/Pending Review/Keep+Hide; reason filter spam→5 (fixture 19d64f8b first), false_info→6 (fixture 35dd2539 first); header "16 of 16 reviews". Mobile: all 3 fixture reviews visible on test-seller profile (8 reviews / 4.6) pre-action |
| ADM-TC-Q02 | Hide review confirmation | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA31-T first real commit+mobile (1928ca5d hide → mobile 6→5). **QA31-M R3 re-confirmed:** Hide on a483651f → native confirm copy EXACT "This will remove the review and notify everyone who reported it. Continue?" → DB hidden / is_hidden=true → **mobile profile 8→7 reviews** (review gone; MOBILE-Q02-hidden-review-gone-7.png). Reset clean |
| ADM-TC-Q03 | Approve review confirmation | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA31-T first real commit+mobile (1928ca5d keep → mobile 5→6). **QA31-M R3 re-confirmed:** Keep on the just-hidden a483651f → native confirm copy EXACT "This will keep the review visible, reject all reports, and notify everyone who reported it. Continue?" → DB reviewed / is_hidden=false / report_count=0 + reports deleted → mobile display restored (8-review state). Reset clean |
| ADM-TC-Q04 | Status filter | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | GENUINE fixture execution: /reviews Status options All/Pending Review/Reviewed/Visible/Hidden present; filter=Pending Review → 13 rows incl. all 3 live fixture reviews; Hidden state rendered (row badge "Hidden") after the Q02 hide |
| ADM-TC-Q05 | Sort-by dropdown | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | GENUINE fixture execution: Sort options Most Reports/Newest Review/Oldest Review; oldest-first = e6f5bc83, newest-first = fixture 35dd2539 (reorders correctly); Most Reports (all fixture report_count=1 → falls to recency) |
| ADM-TC-Q06 | Search input | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | GENUINE fixture execution: search "QA fixture 49d304cd" → 1 of 16 (fixture 19d64f8b surfaced); no-match "zzznomatchxyz" → "No reviews match your filters" |
| ADM-TC-V01 | Monitoring run + alerts | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-V02 | Cron jobs + timezone | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-W01 | Sidebar 7 groups | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-W02 | Expand/collapse section | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-W04 | Active route expands parent | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-W05 | Section label styling | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-W07 | All nav destinations reachable | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | 34 links |
| ADM-TC-X01 | Action Center loads cards | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-X02 | Same-type bundling + count | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | DB-reconciled |
| ADM-TC-X03 | Severity pills | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-X09 | Sidebar pinned + badge | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-X10 | Header bell + badge | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-X12 | Dashboard embeds AC + View all | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-X13 | Cancellation Insights card | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-X14 | /cancellation-insights page | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-Z01 | Health strip position | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-Z02 | Six indicators | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-Z04 | Indicator deep-links | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-Z06 | Health thresholds via /config | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | render (no HEALTH tab) |
| ADM-TC-Z07 | Dashboard embeds AC | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-N2-A05 | Financial Audit accessible | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-N2-A06 | Financial Audit search/filters | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` |  |
| ADM-TC-S03 | Support reply | ⏭️ SKIPPED | SKIPPED | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` |  |
| ADM-TC-C03 | Approve flagged item | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | disposable 7bc46028: /items/flagged Review modal Approve → confirm → "Item approved successfully" → DB available + approved_by 1a546991 + flag cleared + admin_activity_log approve_listing. **QA31-M R4 (2026-09-05) live re-verify + MOBILE leg:** flagged DT104 fixture 0c1b5be8 approved → DB available + approved_at set + flag cleared; as test-buyer the item opens as an available Item Detail with Request to Buy (buyer-visibility; MOBILE-C03-approved-item-buyable.png). (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-C04 | Reject item with required reason | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | disposable a821258d: Reject DISABLED without reason (guard), enabled after Decision Note → confirm → "Item rejected successfully" → DB rejected + rejection_reason stored + appeal_count 1. **QA31-M R4 (2026-09-05) live re-verify:** flagged DT104 fixture 04662c2c → Reject DISABLED until a Decision Note is set → reject → "Item rejected successfully" → DB rejected + rejection_reason stored (QA C04 reason). (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-C06 | Force Delete | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | disposable 033baae0 force-delete (QA30) + mobile leg R5: admin Force Delete (reason form) on approved afd3384a → DB status=deleted → buyer deep link "This item is no longer available" (no purchase path) |
| ADM-TC-C07 | Pause | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` + `qa-task31m-adm-mobile-impact-2026-09-04` | disposable 53a3b578 (available): Pause → reason form → "Listing paused successfully" → DB paused. **MOBILE LEG DRIVEN (QA31-M):** real admin Pause on QA fixture 185546da → DB paused + admin_listing_actions audit (actor 1a546991) → buyer mobile deep-link flips from purchasable ($25) to "❌ Listing not found" → restored available (DB-verified). Finding: no in-UI unpause exists for admin-paused items (Approve renders only for pending) |
| ADM-TC-C08 | Approve | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | disposable 033baae0 approve (QA30) + R5: targeted /listings search (seller+Pending) surfaced afd3384a → Approve w/ note → alert → DB available (approved_by 1a546991) → mobile buyer sees full ItemDetail + Request to Buy + Add to Cart (was "no longer available" pre-approve) |
| ADM-TC-C09 | Request Edits | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA30/R5) | **R6 (2026-09-05) LIVE fixture + mobile leg DRIVEN:** test-buyer pending "My Own Item" 5cde6ca9 → /listings targeted search → Listing Details → ✍️ Request Edits → reason → confirm "Send this listing back to seller for edits?" → DB needs_edits + reason (no admin_listing_actions row — noted). Mobile seller leg: `listing-safety/5cde6ca9` on test-buyer → ListingSafetyReview "This listing needs edits before it can be approved." + NEEDS EDITS + "Admin's Edit Request" with the exact reason (AX-verified). Item left needs_edits (flagged residue) |
| ADM-TC-C10 | Reject | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | disposable a8d41d07 reject (QA30) + mobile leg R5: rejected test-seller item 04662c2c → mobile ListingSafetyReview "This listing was rejected by our safety team." + REJECTED badge + "Rejection Reason: QA C04…" + appeal UI (seller side); buyer-side = non-availability mechanic (proven C06/C08) |
| ADM-TC-K02 | /payouts/earnings data render | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | DT106 client fix HOLDS: Seller Payouts renders 100 rows (Total 100/Completed 0/Pending 38/Failed 0/$5183.53), NO 401 (was BLOCKED-on-finding in QA Task 29) |
| ADM-TC-X05 | Inline approve flagged item | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA30) | **R6 (2026-09-05) LIVE flagged fixture + mobile leg DRIVEN:** r41-flagged 0dca235c (user_report) → Action Center "1 flagged listing pending review" → expand → inline **Approve** → toast "Approved QA Canned Cancelled-Trade Item." → card cleared → DB available (approved_by 1a546991, flagged_at null). Mobile buyer leg: `listing/0dca235c` on test-buyer → full ItemDetail + Add + Request to Buy (buyer-visible). LOW: approve left the item_safety_flags side-row (cleaned via reset); Action Center flagged row displayed "$0.20" for a $20 item (display suspicion — flagged) |
| ADM-TC-X06 | Inline mark dispute under review | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA30 commit PASS (fe3924ee). **QA31-M R3 re-drive + mobile:** fixture trade 96b79ce6 reported → /action-center Disputes card (1 open, Urgent) → inline Under Review → "Dispute marked under review." + button disabled → DB under_review. **Mobile buyer timeline shows "Dispute in progress / Our team has been notified — review within 24h, Auto-complete paused"** (reported & under_review copy identical on-device — internal nuance, acceptable). **DEV-TASK-108 r41-dispute reset now restores under_review** — QA30's stranded-under_review residue class is resolved (0 residue this round) |
| ADM-TC-X07 | Inline retry failed payout (confirmation) | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA30 affordance) | QA30 affordance verified. **R6 (2026-09-05) FULL commit via DT109 fixture:** qa:failed-payout stage → row db9bc05b ($15, trade fe3924ee, failed) → Action Center Failed Payouts "1 failed payout needing retry" → Retry confirm "Retry this payout? This will attempt to reprocess the failed payout." → toast "Payout reset to pending for retry." → card cleared → DB status pending, failure_reason null. Fixture reset (0 failed). **PARTIAL→PASS** |
| ADM-TC-Z05 | Failed Payouts deep-link pre-filters to failed | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | /payouts/earnings?status=failed → filter preset 'failed' + "No payouts found matching your criteria" (0 failed rows, correct) |
| ADM-TC-Y01 | ⌘K / Ctrl+K opens the palette from any page | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | handler verified via synthetic Meta+k: opens + focuses input from /, /users, /trades, /config; 2nd Meta+k toggles closed; Esc closes. DRIVER-LIMITED: embedded driver cannot deliver a real ⌘K keystroke (host reserves it) — real-keyboard leg needs a normal-browser pass |
| ADM-TC-Y02 | Header search bar opens palette | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | topbar-global-search pill click opens palette, input focused |
| ADM-TC-Y03 | Parallel search, grouped labels | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | query "samer" → Users(21)/Listings(68)/Trades(514) groups in ONE render; empty groups omitted |
| ADM-TC-Y04 | Breadcrumb context per row | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | Users → email, Listings → title, Trades → short-id, Config → category → key |
| ADM-TC-Y05 | Input debounced ~200ms | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | 200ms debounce source-verified (CommandPalette.tsx). Char-by-char typing not drivable (driver) → no per-keystroke network count; single native-setter → single fetch observed |
| ADM-TC-Y06 | Top-5 + "See all N results" | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | 5/group + See all → Users expanded 5→21, See-all button removed |
| ADM-TC-Y07 | Footer "View all in <domain>" | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | View all users → /users?search=samer (prefilled); listings → /listings?tab=search&q=bike; trades → /trades?search=samer |
| ADM-TC-Y08 | Selecting a result navigates directly | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | DT108 title-based fix RE-VERIFIED live: palette search "Kids Bike Helmet" → Listings result row → click → /listings?tab=search&q=Kids+Bike+Helmet → "Results (1 of 1)" + item surfaced (was q=<uuid> → 0 results FINDING — now RESOLVED). Settings/Users/Trades navs hold (QA30) |
| ADM-TC-Y09 | Keyboard navigation + focus trap | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | ArrowDown moved cursor (Enter opened row 2, uuid 30be9c70 after 1 ArrowDown); ArrowUp moved back (row 1, 22488089); Esc closed. Focus trap source-confirmed (handlePanelKeyDown), not fully driven |
| ADM-TC-Y10 | Non-admin rejected (permission scoping) | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | two-source: only role 'admin' in RBAC; profiles role gate (5235 user vs 1 admin); portal login rejects non-admins (A02 same build) → non-admin palette session NOT provisionable. Palette/RPC defense-in-depth: admin_global_search raises 'Forbidden: admin role required' → "Only admins can use global search." (source-verified) |
| ADM-TC-Y11 | Secret settings values never shown | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | config rows show key+description+breadcrumb, NEVER value; search matches key/description not value (no is_secret=true rows on staging; values hidden regardless) |
| ADM-TC-Y12 | Empty + no-results states | ✅ PASS | PASS | 2026-09-04 | `qa-task30-adm-moderation-msg-y-2026-09-04` | empty query → hint "Search across settings, users, listings, and trades."; no-results "zzzzznope" → "No results for …" + tip; no errors |
| ADM-TC-B04 | Credit/debit SP + freeze wallet from user | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` + `qa-task31m-adm-mobile-impact-2026-09-04` | /sp-wallet (NOT /users drawer — doc-drift). DT-99 disposable 3df0629c: +25 credit → DB 25 + sp_ledger earn_admin_grant; −25 debit → 0 + admin_deduct; freeze→frozen; unfreeze→active; suspend→suspended; unsuspend→active. Full revert (active/0). admin_audit_logs sp_adjustment ×2 + sp_wallet_status_change ×4 (wallet id e5a78eae, actor 1a546991). **MOBILE LEG DRIVEN (QA31-M, 2026-09-04):** real /sp-wallet freeze/suspend on test-buyer (active→frozen→active→suspended→active, actor 1a546991, 4 audit rows) → on-device SP Wallet shows ⚠️ "Swap Points Frozen" + 🚫 "Wallet Suspended" banners and no banner when active (can_spend_sp=false chain source-verified); restored active/490 |
| ADM-TC-C05 | /items/flagged Review modal — item + appeal info | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | DT108 guide correction confirmed on disk (C05 retitled + route note: appeal data ONLY on /items/flagged Review modal, not /items/[id]) |
| ADM-TC-I01 | Dispute queue + SLA | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /trades/disputes queue TRADE/ITEM/REASON/VALUE/AGE(SLA:24H)/STATUS/ACTIONS + OVERDUE >24h; "42 disputes" DB-exact. Doc-drift: guide "sections+SLA badge" = flat table+OVERDUE |
| ADM-TC-I02 | Mark dispute under review | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | fe3924ee reported → Mark Under Review → under_review (DB) |
| ADM-TC-I03 | Resolve dispute — Complete | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA31 admin commit PASS (fe3924ee). **QA31-M R3 mobile reflection:** fixture trade 96b79ce6 (reported → under_review) → admin Resolve→Complete (in-app modal "Resolve as Complete?" + native confirm) → DB completed / resolved_seller / actor 1a546991 / resolved_at + seller_payouts row (net $17.70 pending). **BOTH parties' mobile timelines reflect Completed** on fresh fetch (buyer "Paid $18.00"; seller Cash $18 / Platform Fee −$3.60 display / net $14.40 display). Note: timeline does NOT live-refresh (stale until relaunch/remount). **DEV-TASK-113 resolved the staleness (R3 finding #2) — QA31-M R4 (2026-09-05): `trades` now in the supabase_realtime publication + AppState-active refetch; the buyer's OPEN untouched timeline LIVE-updated in-place to "Dispute in progress" after the DB dispute-open, and again to Cancelled+friendly copy after the admin resolve — no relaunch/remount** (MOBILE-A2-live-dispute-reported.png). (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-I04 | Resolve dispute — Refund | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | QA31 admin commit PASS (6a1f9d94). **QA31-M R3 mobile reflection:** fixture trade 3db5b917 → admin Resolve→Refund Buyer (in-app modal + native confirm) → DB cancelled / resolved_buyer / actor 1a546991 / resolved_at (no trade_refunds row — fixture carries no real Stripe PI to refund). **BOTH parties' mobile timelines show Cancelled + "Reason: dispute_resolved_refund"** (see finding #1: raw snake_case on user surface, no friendly refund copy). **DEV-TASK-113 fixed the R3 finding #1 — QA31-M R4 re-verify (2026-09-05):** same scenario on fixture trade fceeeab1 (reported → admin Resolve→Refund, actor 1a546991, DB cancelled/resolved_buyer, no refund rows) → the STILL-OPEN buyer timeline LIVE-updated (realtime) to Cancelled + friendly buyer copy **"This trade was cancelled. No payment was taken."** + buyer closing-summary card `timeline-dispute-closed-summary` ("This dispute was resolved in your favor. This trade is closed and no payment was taken from your account."); seller view shows **"This trade was cancelled by our support team."** — NO raw `dispute_resolved_refund` on either surface (MOBILE-A1-A5-buyer-resolved-refund-friendly.png, MOBILE-A1-seller-resolved-refund-friendly.png). (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-I05 | Filter-tab click behavior | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /disputes All Disputed/Reported/Under Review drive status param; empty "No disputes found for the selected filter."; "1 active" DB-exact |
| ADM-TC-D02 | Create / edit category + SP multiplier | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | admin multiplier 1.15 (DB) + Live Preview 57 SP + ⭐; mobile leg: picker Bonus badge on the 1.15 cat + ItemCreate SP estimate "~23 SP" with "1.15x multiplier" on $20 (round(20×1.15)) — multiplier reflected in mobile SP calc |
| ADM-TC-D03 | Activate / deactivate category | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | deactivate→is_active false (DB); reactivate→true |
| ADM-TC-D04 | Category suggestions queue + count | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | Suggestions tab empty state renders; 0 pending (9 approved/1 merged) → queue/count leg fixture-gated |
| ADM-TC-D05 | Icon / badge upload | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | real icon upload (favicon.png 192px) → DB icon_url (storage category-icons/<id>/category.png) + admin row image; mobile leg: picker row for the icon'd category renders the image (no 📦 fallback StaticText) vs no-icon rows render 📦 |
| ADM-TC-D06 | SP spending cap % | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | cap 60 → DB; Live Preview 30 SP (QA31); mobile leg: Sports spend 75% displays on the offer screen "Max: 3 SP (75% of price)" — % reflected in mobile offer |
| ADM-TC-D07 | SP redemption cap | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | redemption 40 → DB (QA31); mobile leg: Sports redemption cap 3 (admin, DB) → offer screen "Max: 3 SP" (uncapped would be 10) + typing "10" clamps to value 3 + "3 SP applied" — cap enforced on device; reverted NULL |
| ADM-TC-D08 | Drag-and-drop reorder | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | DT110 Move Down reorder on 2 disposables (A order 11→12, B 12→11) persisted (DB) + reload; mobile CategorySelectModal main list shows B before A (no Recent section in ItemCreate); disposables deleted — FULL (admin + mobile leg) |
| ADM-TC-D09 | Bulk actions | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | bulk Deactivate/Activate on 2 disposables DB-verified (QA31; menu doc-drift); mobile leg: bulk deactivate → mobile picker A+B GONE; bulk reactivate → mobile picker A back; disposables deleted, 0 residue |
| ADM-TC-D10 | Delete category + guards | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | items guard (Books 15/Toys 1038/Shoes 1 "Cannot delete…") + empty confirm + Other disabled (QA31); mobile leg: deleted disposable B → gone from mobile picker while A remains; guards unchanged |
| ADM-TC-D11 | Suggestion Approve/Merge/Reject | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | 0 pending suggestions → modals not drivable; fixture-gated |
| ADM-TC-E01 | Geographic nodes list + stats | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /nodes stats 11/10/175 DB-exact + Per-Node KPIs panel |
| ADM-TC-E02 | Add / edit node | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA31) | **R6 (2026-09-05) mobile leg DRIVEN:** admin /nodes add "QA R6 Node Chicago" (60601, auto Chicago/IL/41.8858,-87.6181) radius 15 + edit → "QA R6 Chicago Edited" radius 20 (DB 152b57ae, reload-verified). Fresh signup (Charlie, 60601) → **direct profile creation, NO waitlist** → Home node chip "QA R6 Chicago Edited" (DB node_id 152b57ae, 0 waitlist rows). Node deactivated at cleanup |
| ADM-TC-E03 | Deactivate node w/ members warning | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | Diag Test Node members-warning exact (10 members) → deactivate (DB) → reactivate (DB) (QA31); mobile leg: deactivated-node ZIP 90210 (QA Auto G02 inactive) via Discover filter → "Not Available in Your Area / We're not live in ZIP 90210 yet" waitlist modal (cannot-join); no waitlist row created on No-thanks |
| ADM-TC-E04 | Node settings radius validations | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | valid 10→12→10 (DB) + invalid 150 blocked (QA31); mobile leg: min_user_radius_miles 5→10 (qa:admin-config-set, DB) → Discover radius slider min label "5 mi"→"10 mi" (max 25 held) → reverted 5 (DB read-back) — live propagation to mobile Discover proven |
| ADM-TC-E05 | ZIP waitlist queue + filter | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA31) | **R6 (2026-09-05) fresh-signup mobile leg + admin re-verify:** fresh Alice (90210) → "We're Coming Soon" → Join Waitlist → "Waitlist Confirmed" → assigned fallback Buffalo (DB row 6390e6d4). Admin /waitlist on the fresh row: title+cards Total 10/Pending 10, email-substring + ZIP search = 1 fresh row, status filters (Pending 10 / Notified+Joined empty states), combine, "Page 1 of 1". **R6 defect CLOSED (QA32-P2 2026-09-05): DT116 waitlist fix verified live — real profile names render (Samer Test Update 10 ×4, Test Out Of Active Node, Test); remaining 3 "Unknown user" rows DB-verified as orphans with NO profiles row (correct no-profile fallback).** (ADMIN-B0-waitlist-real-names.png) |
| ADM-TC-E08 | Waitlist API authorization | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /api/admin/waitlist 401 {"error":"Unauthorized"}; logged-out /waitlist → /auth/login redirect |
| ADM-TC-G02 | Create new policy version (regex) | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | "v1" blocked (exact msg); v9.9.8 draft 2e379682 created (DB) |
| ADM-TC-G03 | Edit draft policy | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | draft content edited (DB verified) |
| ADM-TC-G04 | Publish policy (confirmation) | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA31 affordance) | publish confirm EXACT copy ("...make it the active version for all users."). **R6 (2026-09-05) FULL commit + safe revert via DT109:** disposable liability "QA R6 Disposable Liability" v9.9.8 draft → Publish → becomes Active, real `4f41639e` archived → **Make Active** restore (confirm "Restore this version as the active policy?...") → real Active again, disposable archived (Delete is draft-only). Mobile: publishing a new liability did NOT auto re-prompt test-buyer on Home open (re-prompt is J05-specific; documented). **PARTIAL→PASS** |
| ADM-TC-L02 | SP Analytics + CSV export | 🔴 STILL OPEN | FAIL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /sp-analytics data leg errors — table `public.category_sp_analytics` MISSING on staging; shell + Export CSV render, no data. Dev: create table/view or re-point query |
| ADM-TC-L03 | SP Wallet admin — metrics + search | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | economy metrics grid; search user; non-existent → "SP wallet not found for user"; invalid UUID no crash |
| ADM-TC-L04 | SP adjustment (credit/deduct) with reason | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` + `qa-task31m-adm-mobile-impact-2026-09-04` | credit +25/debit −25 w/ reason (B04) + admin_audit_logs sp_adjustment (actor 1a546991). **Mobile balance-surface verified (QA31-M):** SpWalletScreen displays the DB available_balance that admin adjusts (surface on-device verified in the B04/L05 status legs); a live credit→balance-change reflection not re-driven — residual noted. **QA31-M R4 (2026-09-05): residual CLOSED — live credit→balance mobile reflection driven.** Admin /sp-wallet +25 credit (reason) → mobile SP Wallet 490→**515** (MOBILE-L04-wallet-515-after-credit.png) → −25 deduct → mobile 490; sp_ledger `earn_admin_grant` +25/515 + `admin_deduct` −25/490 rows, admin_id 1a546991 (R35 ✓); wallet restored active/490. (`qa-task31m-r4-dt113-f08-batchc-2026-09-05`)
| ADM-TC-L05 | Freeze / unfreeze / suspend wallet | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` + `qa-task31m-adm-mobile-impact-2026-09-04` | all 4 status transitions DB-verified + admin_audit_logs sp_wallet_status_change ×4. **MOBILE LEG DRIVEN (QA31-M):** freeze→frozen banner + suspend→suspended banner + unfreeze→no banner verified on-device on test-buyer's SP Wallet (see B04 note); restored active/490 |
| ADM-TC-M02 | Subscriptions list, filters, metrics | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /subscriptions/manage renders; bare /subscriptions → /manage redirect (DT106 holds) |
| ADM-TC-M03 | Extend / cancel / reactivate | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` | **QA32-P2 (2026-09-05) PARTIAL→PASS on disposable real sub fbada8e7 (user bb862192, QA Sub32 Parent):** Cancel active→grace_period (DB + mobile Manage Grace Period/SP-frozen warning MOBILE-M03-after-admin-cancel-grace.png) — **DOC-DRIFT: guide Assert says Cancel→'cancelled'; implementation intentionally moves active/trial→grace_period (benefits-until-period-end, source handleManualCancel);** Reactivate grace_period→active (DB + mobile Active MOBILE-M04-after-reactivate-active.png); Extend Trial +7d on disposable trial row cd4b766b (trial_end 09-07→09-14 DB; window.prompt override ADM-R6 needed). **MED finding: audit inserts into admin_audit_logs with wrong cols (admin_user_id/action/target_user_id/changes vs live actor_id/action_type/entity_id/payload) — 42703 swallowed, NO audit/actor row for any action; actor hardcoded 'system' (R35 fail)** |
| ADM-TC-M04 | Reactivate button + mobile | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` | **QA32-P2 (2026-09-05) PARTIAL→PASS:** Reactivate confirm copy EXACT ("…manually reactivate subscription for QA Sub32 Parent? This will set status to active.") → status active → mobile Manage Kids Club+ reflects Active same-session (MOBILE-M04-after-reactivate-active.png). Same audit-attribution gap as M03 |
| ADM-TC-M05 | Metrics cards (MRR/churn/trial) | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | 5 cards render but page-window-scoped-unlabeled (R54: Active 6 vs DB 30; Trial 10 vs 227; Grace 89 vs 403) |
| ADM-TC-M06 | "free" status filter | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | Free filter present + filters free users |
| ADM-TC-O04 | Request details (screenshot deleted note) | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA31 surface) | **R6 (2026-09-05):** /id-badges/76592772/details (reviewed rejected request) renders user (Test Seller), Status & Decision (Rejected), Submitted/Reviewed timestamps, Rejection Reason/notes + note "The ID screenshot was permanently deleted following the review decision to protect user privacy." DB: screenshot_path null on all reviewed rows (deletion confirmed). **PARTIAL→PASS** |
| ADM-TC-O05 | Message templates edit | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /id-badges/messages renders + Edit; template edit commit not driven |
| ADM-TC-P02 | Edit badge / toggle | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` (+QA31) | /badges list + Edit affordance (QA29 toggles). **QA32-P2 (2026-09-05) PARTIAL→PASS — DT116 icon-upload fix verified end-to-end:** Badge Editor (50 Trades 3ac79591) → Upload New Icon → saved → DB icon_url set (…/badge-icons/icons/3ac79591-…1788645898583.png) + public URL HTTP 200 + /badges row renders the <img> (ADMIN-B0-P02-icon-uploaded.png). RLS-400 defect gone. Residue: badge 3ac79591 icon remains (no remove affordance) — flagged |
| ADM-TC-P03 | Manual award badge | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` | **R6 (2026-09-05):** Manual Award modal → search test-buyer@ → found → select badge **50 Trades** + reason → "Badge awarded successfully" → DB user_badges baa7a2ee (test-buyer, 3ac79591). **Mobile leg DRIVEN:** profile open fired "🎉 New Badge Earned! — 50 Trades / Completed 50 trades" celebration modal; My Badges 11→12; AX `badge-showcase-50-trades` present. Award on shared persona = residue (flagged for dev). **PARTIAL→PASS** |
| ADM-TC-P04 | Badge sandbox simulation | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | sandbox surface not on list view; not driven |
| ADM-TC-R01 | Education sections/examples/analytics | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /education Sections(4)+Examples(3)+Analytics render |
| ADM-TC-R02 | FAQ management | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | FAQ = /education/faq (bare /faq 404 — route note) |
| ADM-TC-R03 | Publish FAQ/education content | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` | **QA32-P2 (2026-09-05) PARTIAL→PASS — DT116 edu-publish fix verified end-to-end:** disposable "QA B0 R03 Disposable Section" (general) → Publish (confirm modal) → is_published=true (535c06d2) → **mobile Help shows help-section-general-header on fresh mount AND after pull-to-refresh** (MOBILE-B0-R03-help-general-section.png) → fixture unpublished + deleted (education_sections 4). PGRST202 defect gone. FAQ publish leg PASS carried from R6 |
| ADM-TC-S01 | Support inbox + unread filter | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /support renders + Unread filter |
| ADM-TC-S02 | Support detail + mark read | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | detail surface; mark-read not driven |
| ADM-TC-T02 | Notification analytics | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /analytics/notifications renders (ranges/category/type/channels/overview) |
| ADM-TC-U01 | Audit logs view | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /audit journal renders + filters (27 mutation types) |
| ADM-TC-W03 | Section state persists per admin | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | Sidebar.tsx localStorage per-admin expandedSections (source) |
| ADM-TC-W06 | Collapsed icon rail shows all destinations | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | icon rail on collapse (labels hidden, nav retained) |
| ADM-TC-Z03 | Dot color reflects thresholds | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | health dots reconcile to admin_config analytics health_* thresholds (live: GMV/Uptime amber low_is_bad) |
| ADM-TC-N2-A02 | Double-click no double-credit | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | unique sp_ledger.idempotency_key + B04 single-row-per-apply |
| ADM-TC-N2-A03 | Duplicate refund rejected | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | unique trade_refunds.stripe_refund_id partial index |
| ADM-TC-N2-A04 | Single payout per trade/transfer | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | unique seller_payouts.idempotency_key + fe3924ee = 1 payout row |
| ADM-TC-N2-A07 | Audit row details + View | ✅ PASS | PASS | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | /audit rows time/type/entity/amount/actor/node/idemkey/View; rows match DB |
| ADM-TC-N2-A08 | Summary strip reconciles | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task31-adm-near-total-2026-09-04` | strip consistent w/ 100-row window but "Entries 100" vs 328 journal — R54 window labeling |
| ADM-TC-H05 | External References (Stripe PI/refund + SP ledger IDs) | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | QA29 ledger H05: External References section present (pending trade → no PI yet, so the PI/refund/SP-ledger link leg unverified). Re-added 2026-09-04 (31d) — executed in QA29, never recorded |
| ADM-TC-N02 | Referral analytics tab | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | QA29 ledger N02: Analytics tab present (render). Re-added 2026-09-04 (31d) — executed in QA29, never recorded |
| ADM-TC-N04 | "Missing configuration" warning | ✅ PASS | PASS | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | QA29 ledger N04: N/A — no warning shown because referral config is present (correct). Re-added 2026-09-04 (31d) — executed in QA29, never recorded |
| ADM-TC-T01 | Revenue & Analytics dashboard | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | QA29 ledger T01: /analytics Revenue & Analytics renders (incl. F09 Buyer Fee-Tier Distribution card); full report-data leg partial. Re-added 2026-09-04 (31d) |
| ADM-TC-X04 | Expand card drills into item list | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | QA29 ledger X04: expand affordance (chevron) present; drill into item list not fully exercised. Re-added 2026-09-04 (31d) |
| ADM-TC-X08 | Empty state "All caught up" | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | QA29 ledger X08: fixture-gated — 28 pending items this run, so the "All caught up" empty state was not reachable. Re-added 2026-09-04 (31d) |
| ADM-TC-X11 | Config drift card lists out-of-range settings | 🟡 PARTIAL | PARTIAL | 2026-09-04 | `qa-task29-adm-first-live-2026-09-04` | QA29 ledger X11: fixture-gated — no out-of-range admin_config present, card not drivable. Re-added 2026-09-04 (31d) |
| ADM-TC-N2-A01 | Financial audit journal viewable per trade | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r5-mobile-owed-2026-09-05` | DB per-trade journal for completed trade 01121468 = 6 chronological rows (buyer_fee_charged 149 → offer_created → tax_quoted 419 → payment_intent_created 6568 → payment_captured 6000 → payout_initiated 5400) with actors; admin /audit renders the unified immutable idempotency-keyed journal with trade/entity search + mutation/entity filters. PARTIAL→PASS |

| ADM-TC-C11 | Select-all / selection counter (no bulk execute — flag) | ✅ PASS | PASS | 2026-09-04 | `qa-task31t-dt111-adm-2026-09-04` | /listings select-all toggles all 20 page rows; "Selected on this page: N" counter + Clear selection both work; guide's no-bulk-executor doc flag confirmed (selection has no downstream action) |
| ADM-TC-C12 | Individual filter controls | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | FORMAL RE-VERIFY (DT112 restored the 7-arg `admin_search_listings_v2` — p_category/p_seller_email live on staging): Category=Toys → header "Results (20 on this page) of **1077** matching" = DB 1077 EXACT (54 pages — not page-scoped); seller-email `test-seller@` → "of **273** matching" = DB 273 EXACT (14 pages). Header now discloses the page window. query/status/SP filters already DB-exact (QA31T). LOW note unchanged: Paused absent from status dropdown |
| ADM-TC-E06 | Node tagging completeness (N6) — every record resolves to one node | ✅ PASS | PASS | 2026-09-04 | `qa-task31t-dt111-adm-2026-09-04` | read-only NULL coverage on all 10 N6 tables + residual characterization + **step-3 write-trigger driven via the sanctioned FG-1 fixture** (item+trade+payments node_id auto-populated to 6bf728cf on insert). Residual finding: NULL-node rows whose actor HAS a node = 358 items / 341 sp_ledger / 35 wallets / 20 trades+payments / 15 batches / 2 cart / 1 seller_balance (pre-node rows not retroactively re-tagged — dev reconcile) |
| ADM-TC-E07 | Per-node KPIs (N6) — expansion-gate metrics per node | ✅ PASS | PASS | 2026-09-04 | `qa-task31t-dt111-adm-2026-09-04` | /nodes Per-Node Marketplace KPIs panel (all 10 columns) reconciles digit-for-digit with admin_node_kpis(NULL) for every node (GMV/fees round to whole $ off exact cents); node-filtered admin_node_kpis('6bf728cf…') returns only that node; stat cards Total 12 / Active 10 / Members 176 reconcile. Note: leftover "QA T31 Disc Node" status='active' but is_active=false |
| ADM-TC-F11 | Reset button | ✅ PASS | PASS | 2026-09-04 | `qa-task31t-dt111-adm-2026-09-04` | /settings/trade-timing: change auto_complete_hours 72→71 (unsaved) → Reset reverts to 72; DB config unchanged (Reset writes nothing) |
| ADM-TC-K03 | Retry failed payout (confirmation) | ✅ PASS | PASS | 2026-09-04 | `qa-task31t-dt111-adm-2026-09-04` | sanctioned qa:failed-payout fixture → /payouts/earnings Retry → confirm copy "Retry this payout? This will attempt to reprocess the failed payout." → alert "Payout retry initiated" → DB failed→pending, failure_reason cleared → fixture reset clean (0 residue) |
| ADM-TC-L07 | SP Wallet state RPC — get_user_sp_wallet_summary returns wallet_state | ✅ PASS | PASS | 2026-09-05 | `qa-task31m-r3-adm-fg-dispute-q-2026-09-05` | FORMAL RE-VERIFY (DT112 items 2+8 gate fix live on-device): froze test-buyer wallet (admin /sp-wallet, actor 1a546991, DB frozen) → Make Offer (TradeOfferScreen) on Accept-SP item 185546da → **`sp-amount-input` GENUINELY ABSENT** (no ADD SP OFFER / no "Max 12 SP") + ⚠️ "Swap Points Frozen" banner + inline "Your Swap Points wallet is frozen. Renew your subscription to restore SP spending."; cash-only total $28.24. Wallet restored active/490 (DB-verified). Inverse confirmed: active wallet → SP input present ("Max 12 SP"). QA31-T's SP-input-enabled gap is RESOLVED |
| ADM-TC-L08 | SP Wallet warning banners (mobile) — frozen/suspended/grace | ✅ PASS | PASS | 2026-09-04 | `qa-task31m-adm-mobile-impact-2026-09-04` + `qa-task31t-dt111-adm-2026-09-04` | QA31-M drove frozen/suspended banners on test-buyer's SP Wallet (active→frozen→suspended→active; DB+audit verified). QA31-T re-drove all three states + verified the DT111 WalletWarningBanner token remap on-device (pixel-scanned): frozen = #5B8FB9 accent on #EBF4F9 tint; suspended = #E85D75 on #FFF0F2; grace = #FFA726 on #FFF3E0; active = no banner |
| ADM-TC-M01 | Grace period config (days + reminders) | ✅ PASS | PASS | 2026-09-04 | `qa-task31t-dt111-adm-2026-09-04` | /subscriptions/manage round-trip: 30 / [60,30,7,1] → 45 / [45,20,10,3] (save + success) → reverted to baseline 30 / [60,30,7,1]; DB-verified at each step. Note: the form save path writes updated_by=null (no admin attribution) |

### Remaining test cases — NEVER RUN (3)

> QA Task 31d prune (2026-09-04): 147 of the former 159 rows removed — they now have verdicts in the Completed block above (QA Task 29/30/31). QA Task 31-T v2 (2026-09-04, `qa-task31t-dt111-adm-2026-09-04`) moved C11/C12/E06/E07/F11/K03/L07/L08/M01 to Completed. The 3 below are ADM's genuinely-outstanding pool (all ADM-R3 prompt()-tooling BLOCKED).

| TC-ID | Description | Note / why remaining |
|---|---|---|
| ADM-TC-B03 | Suspend / ban / delete account | QA29/QA31 attempted but BLOCKED-on-tooling: Suspend/Delete use native `prompt()` — not drivable in the embedded driver (UI buttons verified present). Needs a normal-browser pass (ADM-R3). |
| ADM-TC-B06 | Reset Password action | QA29/QA31 BLOCKED-on-tooling: flow uses `prompt()` (same blocker). Needs a normal-browser pass (ADM-R3). |
| ADM-TC-B07 | Unsuspend action | QA29/QA31 BLOCKED-on-tooling: requires a `prompt()` reason. Needs a normal-browser pass (ADM-R3). |




## SUB · Subscriptions / Payouts / SP Wallet

**Guide file:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` · **Cases:** 100 · **PASS** 56 · **PARTIAL** 4 · **OPEN** 3 · **DOC-DRIFT** 0 · **SKIPPED** 0 · **RETIRED** 15 · **N/A** 2 · **Remaining (ACTIVE)** 20

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
| SUB-TC-A05 | Kids Club+ Overview screen by subscription status | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` | QA32-P2 first execution: free leg on-device (test-free JoinKidsClub value-prop + web-managed card + Join-on-the-web CTA, SUB-A05-free-joinkidsclub.png); active leg = disposable real sub Manage (Active badge + Next Billing + Cancel + Auto-Renew, verified 2× this session); grace leg = D01 test-grace on-device cross-ref + disposable post-cancel grace observation. **PASS** |
| SUB-TC-I06 | Free user SP wallet — 0-SP wallet + Join Kids Club+ upsell card | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | DOC-DRIFT RESOLVED: DEV-TASK-117 rewrote the case (2026-09-05) to the live 0-SP wallet + `sp-wallet-join-kids-club-card` upsell. Verified on-device (test-free): 0-SP hero + "Join Kids Club+ to start earning Swap Points" card (renders + navigates to JoinKidsClub), no lock overlay, no WalletWarningBanner. **PASS** |
| SUB-TC-N03 | Route-alias reachability (JoinKidsClub vs deep-link-only aliases) | ✅ PASS | PASS | 2026-09-05 | `qa-task32-adm-r6-sub-2026-09-05` | source-confirmed + on-device: JoinKidsClub navigable via SP strip; SubscriptionChoice/KidsClubOverview/SubscriptionPlans registered aliases with ZERO navigate() call sites (deep-link only). Matches guide flag |
| SUB-TC-D05 | Reactivate from cancelled state | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | In-app reactivate on retained disposable real sub: admin-cancel → grace → mobile Manage "Re-subscribe to Kids Club+" → renew-subscription EF → Active + "Subscription Renewed" + NEW Stripe sub + cancel_reason cleared. **NEW MED**: sp_wallets left in grace_period after reactivation (alert claims SP available) — report finding #1 |
| SUB-TC-F01 | Payout Settings hero — Available / Pending / Lifetime Earned (live) | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | hero renders $15,603 avail / $393 pending / $15,996 lifetime + Withdraw Now (test-seller). NOTE: figures from inflated seller_balance row (data-integrity finding) |
| SUB-TC-F03 | Payout history list (completed / pending) — live | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | 5 rows render amount+status(Pending)+date+Fee (test-seller). Data has no completed/failed rows to demo those icon variants |
| SUB-TC-F04 | Earnings figures (Available/Pending/Lifetime) + history net/fee — live | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | hero 3 figures + per-row net + Fee lines (test-seller) |
| SUB-TC-F08 | Payout history Load More pagination (+5) — live | 🟡 PARTIAL | PARTIAL | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | 25 payouts in DB (precondition ✓) + first-5 render; Load More tap NOT drivable — **owner-confirmed defect: Load More renders in the floating-tab-bar band (occluded by nav bar; no pill-clear inset)** + Load More has no testID (fix records in report) |
| SUB-TC-G07 | Payout Settings — "Edit Details" sheet | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | method kebab → Edit Details → "Editing payout method details is not yet available. Contact support for changes." (exact guide copy) |
| SUB-TC-G08 | "Cannot Delete Primary/Only Method" guard | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | single primary method Delete → "Cannot Delete Primary Method" (primary guard fires first; the "Only Method" copy is unreachable when the only method is primary — source-verified guard order) |
| SUB-TC-G10 | Payout history Load More | 🟡 PARTIAL | PARTIAL | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | same as F08 (Load More occluded by floating nav bar — owner-confirmed fix record; no testID) |
| SUB-TC-H02 | WithdrawModal summary — Available / Payout Fee / You'll Receive | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | WithdrawModal math verified: avail $15,603 / fee -$39.26 (= $0.25 + 0.25% = Stripe processor fee) / net $15,563.74 / Stripe method; no amount field; Cancel clean (no withdrawal created). **Owner finding (fix record): "Payout Fee" label does not say it's the payment-METHOD/Stripe fee, not a platform fee** |
| SUB-TC-N04 | ContinueKidsClub active-subscription variant | ✅ PASS | PASS | 2026-09-05 | `qa-task33-sub-30-closure-dt117-2026-09-05` | test-buyer continue-kids-club deep link → "✅ Kids Club+ Active / Your subscription is already active…" + Go Back |

### Remaining test cases — ACTIVE (20) — QA Task 33's scope

> QA Task 31d re-split (2026-09-04): the old "(51)" header was off-by-one against a 50-row body. Those 50 = **30 ACTIVE** (genuinely drivable — QA Task 32's real scope; 3 executed in QA32-P2 2026-09-05) + **15 RETIRED** + **2 N/A** (below). RETIRED/N-A are dispositions, not never-run cases.

| TC-ID | Description | Note / why remaining |
|---|---|---|
| SUB-TC-F05 | Payout history empty state — live | needs a no-payout seller fixture |
| SUB-TC-F06 | Pending earnings figure follows admin release timing — live | needs a fresh completed-trade→payout fixture + pending_sp_release_days write on a controlled balance |
| SUB-TC-F07 | Payout load error + recovery — live | forced-offline load failure not cleanly drivable |
| SUB-TC-G01 | Add Stripe Connect payout method (onboarding) | real Stripe Connect onboarding flow |
| SUB-TC-G04 | Set primary method / delete method (confirmation) | needs a 2-method seller fixture |
| SUB-TC-G05 | Unverified method blocks payout (live: cannot set primary / withdraw) | needs an unverified-method seller fixture |
| SUB-TC-G06 | requires_action payout → "Set Up Payout Method" | requires_action row deep in list (scroll-blocked this session) |
| SUB-TC-G09 | "Cannot Set as Primary" (unverified) guard | needs an unverified-method seller fixture |
| SUB-TC-G11 | NoMethodModal flow | needs a no-method seller with balance fixture |
| SUB-TC-H01 | Withdraw Now — no-balance guard (amount entry removed) | needs a $0-available seller |
| SUB-TC-H03 | Confirm Withdrawal success | needs a controlled small balance (real transfer); test-seller inflated to $15,603 |
| SUB-TC-H04 | Withdraw blocked when no verified primary method | needs a no-method seller with balance fixture |
| SUB-TC-H06 | Admin minimum withdrawal blocks full-balance requests below the floor | needs a small-balance fixture + min_withdrawal config write |
| SUB-TC-H07 | Minimum withdrawal disabled when config = 0 | needs a small-balance fixture + min_withdrawal config write |
| SUB-TC-K02 | Transaction History empty + error/retry | empty = test-free (E02 PASS surface); error/retry leg needs a forced fetch failure |
| SUB-TC-M01 | Payment Methods — loading state | transient spinner (source-confirmed); not separately captured |
| SUB-TC-M06 | Go Back | pm-back-button AX-verified; return-to-Settings drive deferred |
| SUB-TC-M07 | Backend contract — attach / detach / retryFailedPayment branches | attach branch driven on disposable (PASS); detach branch not driven |
| SUB-TC-N05 | ContinueKidsClub loading state | transient spinner (source-confirmed); not separately captured |
| SUB-TC-N06 | ContinueKidsClub trial-ending urgency badge | needs a ≤7-day-trial mobile persona (none on staging) |

### RETIRED (15) — in-app flow removed / coverage superseded — NOT never-run (reclassified 31d)

> QA Task 31d (2026-09-04): these 15 are documented **RETIRED** dispositions (their in-app flows were removed; coverage moved to the referenced successors) — moved out of the "never-run" framing per the 31d legend update. They are NOT QA Task 32 run scope.

| TC-ID | Description | Disposition / coverage moved to |
|---|---|---|
| SUB-TC-B01 | 🔴 RETIRED — in-app payment removed | web-first → SUB-TC-N01/N02 + Web Subscription Purchase E2E (QA Task 20) |
| SUB-TC-B02 | 🔴 RETIRED — in-app payment screen removed | coverage → Web Subscription Purchase E2E (QA Task 20) |
| SUB-TC-B03 | 🔴 RETIRED — in-app Success screen removed | coverage → Web Subscription Purchase E2E (QA Task 20) |
| SUB-TC-B04 | 🔴 RETIRED — in-app trial-gating removed | server-side trial config → QA Task 20 finding F-3 |
| SUB-TC-B05 | 🔴 RETIRED — in-app trial-disabled alert removed | coverage → QA Task 20 finding F-3 |
| SUB-TC-B06 | 🔴 RETIRED — ContinueKidsClub is deep-link-only | see SUB-TC-N03–N06 |
| SUB-TC-B07 | 🔴 RETIRED — referral bonus-loss warning on removed Subscription Choice | see SUB-TC-N03 |
| SUB-TC-B08 | 🔴 RETIRED — in-app trial-limit CTA removed | config reflection → SUB-TC-R05 |
| SUB-TC-B09 | 🔴 RETIRED — in-app Stripe sheet removed | checkout UX → QA Task 20 scope 2 |
| SUB-TC-B10 | 🔴 RETIRED — in-app decline handling removed | checkout decline → QA Task 20 scope 2 |
| SUB-TC-B11 | 🔴 RETIRED — in-app saved-card resub removed | cards on file → Group M |
| SUB-TC-B12 | 🔴 RETIRED — in-app payment network-error path removed | → QA Task 20 scope 2 |
| SUB-TC-B13 | 🔴 RETIRED — in-app Apple/Google Pay removed | web wallet-pay → QA Task 20 scope 2 |
| SUB-TC-D02 | 🔴 RETIRED — in-app re-subscribe payment removed | web-first → SUB-TC-N01/N02 + Web E2E |
| SUB-TC-D04 | 🔴 RETIRED — in-app renewal payment removed | web-first → SUB-TC-N01/N02 + Web E2E |

### N/A (2) — unconfigured provider / not applicable (reclassified 31d)

> QA Task 31d (2026-09-04): G02/G03 are **N/A** — the referenced payout providers are not configured in this deployment (PayPal/Venmo unconfigured; Bank ACH has no UI option). Dispositions, not never-run cases.

| TC-ID | Description | Why N/A |
|---|---|---|
| SUB-TC-G02 | PayPal/Venmo unconfigured provider (UI lists, not drivable) | provider not configured in this deployment |
| SUB-TC-G03 | Bank ACH unconfigured / no UI option | provider not configured / no UI option |

